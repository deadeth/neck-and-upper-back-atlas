"""Build site/model.json from the BodyExplorer GLB files (BodyParts3D and Z-Anatomy data).

Usage: python3 build_model.py <anatomy.glb> <skeleton.glb> <sacrum.stl> <out_dir>

The file holds three things:
  parts  - bones and muscles, each flagged for the atlas view, the exercise view, or both
  rig    - joint centres and arm geometry for the exercise skeleton, plus skin weights per muscle
  data   - all geometry packed as base64 (the artifact host serves .json but not .bin)
"""
import base64
import json
import re
import struct
import sys

import numpy as np
import scipy.sparse as sp
import trimesh
import fast_simplification
from scipy.spatial import cKDTree

from parts import (MUSCLES, SKULL, CERV, THOR, LUMB, RIBS, STERNUM, CARPUS, METACARPALS, DIGITS, FOOT_RE, LEVELS,
                   MUSCLE_KEEP, CUT_Z, HUMERUS_CUT_Z, ORIGIN)

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
SKIN_JOINTS = ["head", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "thorax", "l1",
               "clavL", "clavR", "scapL", "scapR", "humL", "humR"]


def read_glb(path):
    """Return {mesh name: (points float64 Nx3, faces int64 Mx3)} for every node with a mesh."""
    with open(path, "rb") as f:
        f.read(12)
        n, _ = struct.unpack("<II", f.read(8))
        j = json.loads(f.read(n))
        n, _ = struct.unpack("<II", f.read(8))
        blob = f.read(n)

    def acc(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        dt = np.dtype(CT[a["componentType"]])
        nc = NC[a["type"]]
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride")
        if stride and stride != dt.itemsize * nc:
            raise ValueError("interleaved buffers not supported")
        return np.frombuffer(blob, dtype=dt, count=a["count"] * nc, offset=off).reshape(a["count"], nc)

    out = {}
    for node in j["nodes"]:
        if "mesh" not in node:
            continue
        if any(k in node for k in ("translation", "rotation", "scale", "matrix")):
            raise ValueError("node transforms not supported: " + node["name"])
        pts, faces, base = [], [], 0
        for prim in j["meshes"][node["mesh"]]["primitives"]:
            p = acc(prim["attributes"]["POSITION"]).astype(np.float64)
            fidx = acc(prim["indices"]).astype(np.int64).reshape(-1, 3)
            pts.append(p)
            faces.append(fidx + base)
            base += len(p)
        out.setdefault(node["name"], (np.vstack(pts), np.vstack(faces)))
    return out


def clip_above(p, f, z):
    if z is None or p[:, 2].min() >= z:
        return p, f
    m = trimesh.Trimesh(p, f, process=False)
    try:
        m = trimesh.intersections.slice_mesh_plane(m, [0, 0, 1], [0, 0, z], cap=True)
    except Exception:
        m = trimesh.intersections.slice_mesh_plane(m, [0, 0, 1], [0, 0, z], cap=False)
    return np.asarray(m.vertices), np.asarray(m.faces)


def simplify(p, f, keep, force=False):
    if keep >= 0.999 or (len(f) < 3200 and not force):
        return p, f
    p2, f2 = fast_simplification.simplify(p.astype(np.float32), f.astype(np.int32), target_reduction=1.0 - keep)
    return p2.astype(np.float64), f2.astype(np.int64)


def weld(p, f):
    m = trimesh.Trimesh(p, f, process=False)
    m.merge_vertices()
    m.update_faces(m.nondegenerate_faces())
    m.remove_unreferenced_vertices()
    return np.asarray(m.vertices), np.asarray(m.faces)


def merge(meshes):
    pts, faces, base = [], [], 0
    for p, f in meshes:
        pts.append(p)
        faces.append(f + base)
        base += len(p)
    return np.vstack(pts), np.vstack(faces)


def mirror(p, f):
    q = p.copy()
    q[:, 0] *= -1
    return q, f[:, ::-1].copy()


def to_model(p):
    """Source mm (x left, y back, z up) -> model cm (X left, Y up, Z front)."""
    p = np.atleast_2d(np.asarray(p, dtype=np.float64))
    ox, oy, oz = ORIGIN
    return np.stack([(p[:, 0] - ox) / 10.0, (p[:, 2] - oz) / 10.0, -(p[:, 1] - oy) / 10.0], axis=1)


def skin_weights(p, f, allowed, trees):
    """Distance-weighted blend between the bones a muscle attaches to. Returns (idx Nx4 u8, w Nx4 u8)."""
    dist = np.stack([trees[j].query(p)[0] for j in allowed], axis=1)
    w = 1.0 / np.power(dist + 2.0, 3)
    w /= w.sum(axis=1, keepdims=True)
    # smooth along mesh edges so neighbouring vertices don't tear apart
    e = np.vstack([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    n = len(p)
    adj = sp.coo_matrix((np.ones(len(e) * 2), (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(n, n)).tocsr()
    adj.data[:] = 1.0
    deg = np.maximum(np.asarray(adj.sum(axis=1)).ravel(), 1.0)
    for _ in range(6):
        w = 0.5 * w + 0.5 * (adj @ w) / deg[:, None]
    k = min(4, len(allowed))
    top = np.argsort(-w, axis=1)[:, :k]
    tw = np.take_along_axis(w, top, axis=1)
    tw /= tw.sum(axis=1, keepdims=True)
    q = np.floor(tw * 255.0).astype(np.int64)
    q[:, 0] += 255 - q.sum(axis=1)
    gidx = np.array([SKIN_JOINTS.index(j) for j in allowed])[top]
    idx = np.zeros((n, 4), dtype=np.uint8)
    wq = np.zeros((n, 4), dtype=np.uint8)
    idx[:, :k] = gidx
    wq[:, :k] = q
    return idx, wq


FINGER_JOINTS = {}   # filled by hand_rig: finger joint centres in model space


def hand_rig(bones, s, S):
    """Palm frame and finger hinges for one hand, in model space.

    Returns the palm normal (pointing out of the palm), the direction the fingers run, and one
    flexion axis per digit. Finger joint centres go into FINGER_JOINTS.
    """
    unit = lambda v: v / np.linalg.norm(v)
    M = lambda name: to_model(bones[name][0])

    def long_axis(v, towards_from):
        """principal axis of a bone, pointing away from the given point"""
        c = v.mean(axis=0)
        a = np.linalg.svd(v - c, full_matrices=False)[2][0]
        return a if np.dot(c - towards_from, a) > 0 else -a

    mc = {i: M(f"{s} {o} metacarpal bone") for i, o in enumerate(METACARPALS, start=1)}
    palm_pts = np.vstack([mc[i] for i in (2, 3, 4, 5)])
    centre = palm_pts.mean(axis=0)
    carpal = np.vstack([M(f"{s} {c}") for c in ("capitate", "lunate", "hamate", "scaphoid")]).mean(axis=0)
    normal = np.linalg.svd(palm_pts - centre, full_matrices=False)[2][2]      # thinnest direction of the palm
    if np.dot(M(f"{s} pisiform").mean(axis=0) - carpal, normal) < 0:           # the pisiform sits on the palm side
        normal = -normal
    fingers = long_axis(mc[3], carpal)
    fingers = unit(fingers - normal * np.dot(fingers, normal))
    ulnar = unit(mc[5].mean(axis=0) - mc[2].mean(axis=0))
    out = {"palmN" + S: normal, "palmG" + S: fingers}
    for d, digit in enumerate(DIGITS, start=1):
        parent = mc[d]
        axis = None
        for seg in ("proximal", "middle", "distal"):
            name = f"{seg} phalanx of {s} {digit}"
            if name not in bones:
                continue
            v = M(name)
            a = long_axis(v, parent.mean(axis=0))
            t = (v - v.mean(axis=0)) @ a
            FINGER_JOINTS[f"f{d}{seg[0]}{S}"] = [round(float(x), 3) for x in v[t < t.min() + 0.2 * (t.max() - t.min())].mean(axis=0)]
            if axis is None:
                # fingers curl towards the palm; the thumb curls across it
                axis = unit(np.cross(a, unit(ulnar + 0.6 * normal) if d == 1 else normal))
            parent = v
        out[f"flex{d}{S}"] = axis
    return {k: [round(float(x), 4) for x in v] for k, v in out.items()}


def main(anatomy_path, skeleton_path, sacrum_path, out_dir):
    muscles = read_glb(anatomy_path)
    bones = read_glb(skeleton_path)
    sac = trimesh.load(sacrum_path)
    bones["sacrum"] = (np.asarray(sac.vertices, dtype=np.float64), np.asarray(sac.faces, dtype=np.int64))
    parts = []

    def prep(src, name, keep, cut=None):
        if name not in src:
            raise KeyError("missing source mesh: " + name)
        p, f = weld(*src[name])
        p, f = clip_above(p, f, cut)
        return simplify(p, f, keep)

    def pts(*names):
        return np.vstack([bones[n][0] for n in names])

    def matching(pattern, s):
        rx = re.compile(pattern.format(s=s))
        names = sorted(n for n in bones if rx.search(n))
        if not names:
            raise KeyError("no bones match " + pattern)
        return names

    def bone(pid, names, joint, name, keep, atlas, ex, side="", cut=None, as_one=False):
        if as_one:   # many tiny bones: weld each, merge, then simplify the lot
            p, f = merge([weld(*bones[n]) for n in names])
            p, f = simplify(p, f, keep, force=True)
        else:
            p, f = merge([prep(bones, n, keep, cut) for n in names])
        parts.append(dict(id=pid, kind="bone", side=side, name=name, joint=joint, atlas=atlas, ex=ex, p=p, f=f))

    # ---------- bones ----------
    bone("skull", SKULL, "head", "skull", 0.28, True, True)
    for i, n in enumerate(CERV):
        bone(f"c{i + 1}", [n], f"c{i + 1}", "cervical", 0.6, True, True)
    bone("thoracic", THOR, "thorax", "thoracic", 0.55, True, True)
    bone("ribs", RIBS, "thorax", "ribs", 0.2, True, True)
    bone("sternum", STERNUM, "thorax", "sternum", 0.35, True, True)
    bone("l1", [LUMB[0]], "l1", "lumbar", 0.5, True, True)
    for i in range(1, 5):
        bone(f"l{i + 1}", [LUMB[i]], f"l{i + 1}", "lumbar", 0.5, False, True)
    bone("hips", ["left hip bone", "right hip bone"], "pelvis", "pelvis", 1.0, False, True)
    bone("sacrum", ["sacrum"], "pelvis", "pelvis", 0.07, False, True)
    for s, S in (("left", "L"), ("right", "R")):
        bone("scapula", [f"{s} scapula"], "scap" + S, "scapula", 0.24, True, True, S)
        bone("clavicle", [f"{s} clavicle"], "clav" + S, "clavicle", 1.0, True, True, S)
        bone("humerus", [f"{s} humerus"], "hum" + S, "humerus", 0.9, True, False, S, cut=HUMERUS_CUT_Z)
        bone("humerus-full", [f"{s} humerus"], "hum" + S, "humerus", 0.7, False, True, S)
        bone("ulna", [f"{s} ulna"], "ulna" + S, "forearm", 1.0, False, True, S)
        bone("radius", [f"{s} radius"], "rad" + S, "forearm", 1.0, False, True, S)
        palm = [f"{s} {c}" for c in CARPUS if f"{s} {c}" in bones] + [f"{s} {o} metacarpal bone" for o in METACARPALS]
        bone("hand", palm, "hand" + S, "hand", 0.5, False, True, S, as_one=True)
        for d, digit in enumerate(DIGITS, start=1):
            for seg in ("proximal", "middle", "distal"):
                name = f"{seg} phalanx of {s} {digit}"
                if name in bones:   # the thumb has no middle phalanx
                    bone("phalanx", [name], f"f{d}{seg[0]}{S}", "hand", 0.7, False, True, S, as_one=True)
        bone("femur", [f"{s} femur"], "fem" + S, "femur", 1.0, False, True, S)
        bone("shin", [f"{s} tibia", f"{s} fibula", f"{s} patella"], "tib" + S, "shin", 1.0, False, True, S)
        bone("foot", matching(FOOT_RE, s), "foot" + S, "foot", 0.3, False, True, S, as_one=True)

    # ---------- joints (source mm) ----------
    def body_pivot(name):
        v = bones[name][0]
        ymin, ymax = v[:, 1].min(), v[:, 1].max()
        body = v[v[:, 1] < ymin + 0.35 * (ymax - ymin)]     # the vertebral body is the anterior third
        return np.array([0.0, ymin + 0.22 * (ymax - ymin), body[:, 2].min()])

    J, X = {}, {}   # joint centres; extra landmarks
    for i, n in enumerate(LUMB):
        J[f"l{i + 1}"] = body_pivot(n)
    J["thorax"] = body_pivot(THOR[11])
    for i, n in enumerate(CERV):
        J[f"c{i + 1}"] = body_pivot(n)
    at = bones["atlas"][0]
    J["head"] = np.array([0.0, at[:, 1].min() + 0.45 * (at[:, 1].max() - at[:, 1].min()), at[:, 2].max() - 3.0])
    for s, S, sg in (("left", "L", 1.0), ("right", "R", -1.0)):
        med = lambda v: v[:, 0] * sg     # larger = more lateral
        fem = bones[f"{s} femur"][0]
        top = fem[fem[:, 2] > fem[:, 2].max() - 55]
        head = top[med(top) < med(top).min() + 46]
        J["fem" + S] = np.array([sg * (med(top).min() + 23), head[:, 1].mean(), head[:, 2].max() - 23])
        low = fem[fem[:, 2] < fem[:, 2].min() + 25]
        J["tib" + S] = np.array([low[:, 0].mean(), low[:, 1].mean(), fem[:, 2].min() + 18])
        J["foot" + S] = bones[f"{s} talus"][0].mean(axis=0)
        hum = bones[f"{s} humerus"][0]
        top = hum[hum[:, 2] > hum[:, 2].max() - 42]
        J["hum" + S] = np.array([sg * (med(top).min() + 22), top[:, 1].mean(), hum[:, 2].max() - 22])
        low = hum[hum[:, 2] < hum[:, 2].min() + 22]
        J["ulna" + S] = low.mean(axis=0)
        X["humDistal" + S] = hum[hum[:, 2] < hum[:, 2].min() + 25]
        rad, uln = bones[f"{s} radius"][0], bones[f"{s} ulna"][0]
        J["rad" + S] = rad[rad[:, 2] > rad[:, 2].max() - 12].mean(axis=0)          # radial head
        X["pronEnd" + S] = uln[uln[:, 2] < uln[:, 2].min() + 12].mean(axis=0)      # ulnar head
        fa = np.vstack([rad, uln])
        J["hand" + S] = fa[fa[:, 2] < fa[:, 2].min() + 12].mean(axis=0)            # wrist centre
        X["palm" + S] = pts(*[f"{s} {o} metacarpal bone" for o in METACARPALS[1:]]).mean(axis=0)
        cl = bones[f"{s} clavicle"][0]
        J["clav" + S] = cl[med(cl) < med(cl).min() + 10].mean(axis=0)
        X["acrom" + S] = cl[med(cl) > med(cl).max() - 10].mean(axis=0)
        J["scap" + S] = bones[f"{s} scapula"][0].mean(axis=0)
    J["pelvis"] = (J["femL"] + J["femR"]) / 2
    floor = min(bones[n][0][:, 2].min() for n in matching(FOOT_RE, "left"))

    # ---------- muscles ----------
    cloud = {"head": pts(*SKULL), "thorax": pts(*THOR, *RIBS, *STERNUM), "l1": pts(LUMB[0])}
    for i, n in enumerate(CERV):
        cloud[f"c{i + 1}"] = pts(n)
    for s, S in (("left", "L"), ("right", "R")):
        cloud["clav" + S] = pts(f"{s} clavicle")
        cloud["scap" + S] = pts(f"{s} scapula")
        cloud["hum" + S] = pts(f"{s} humerus")
    trees = {k: cKDTree(v) for k, v in cloud.items()}

    for mid, (names, mirrored, joints) in MUSCLES.items():
        left = merge([prep(muscles, n.format(s="left"), MUSCLE_KEEP, CUT_Z) for n in names])
        right = mirror(*left) if mirrored else merge([prep(muscles, n.format(s="right"), MUSCLE_KEEP, CUT_Z) for n in names])
        for S, (p, f) in (("L", left), ("R", right)):
            idx, w = skin_weights(p, f, [j.format(S=S) for j in joints], trees)
            parts.append(dict(id=mid, kind="muscle", side=S, name=mid, joint="", atlas=True, ex=True, p=p, f=f, skin=(idx, w)))

    # ---------- pack ----------
    levels = []
    for label, name in LEVELS:
        v = bones[name][0]
        levels.append({"label": label, "p": [round(float(x), 3) for x in to_model(v[np.argmax(v[:, 1])])[0]]})

    blob = bytearray()

    def put(arr):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(arr.tobytes())
        return off

    manifest, n_atlas, n_ex = [], 0, 0
    for part in parts:
        p = to_model(part["p"])
        lo, hi = p.min(axis=0), p.max(axis=0)
        span = np.where(hi - lo > 1e-9, hi - lo, 1.0)
        big = len(p) > 65535
        entry = {
            "id": part["id"], "kind": part["kind"], "side": part["side"], "name": part["name"], "joint": part["joint"],
            "atlas": part["atlas"], "ex": part["ex"], "v": int(len(p)), "i": int(part["f"].size),
            "vo": put(np.round((p - lo) / span * 65535.0).astype("<u2")),
            "io": put(part["f"].astype("<u4" if big else "<u2")), "u32": bool(big),
            "min": [round(float(x), 4) for x in lo], "max": [round(float(x), 4) for x in hi],
        }
        if "skin" in part:
            entry["so"] = put(np.hstack(part["skin"]).astype(np.uint8))   # N x 8: four joint indices, four weights
        manifest.append(entry)
        n_atlas += len(p) if part["atlas"] else 0
        n_ex += len(p) if part["ex"] else 0
        print(f"{part['kind']:6} {part['id']:22} {part['side']:1} verts {len(p):6} {'A' if part['atlas'] else ' '}{'E' if part['ex'] else ' '}")

    r3 = lambda v: [round(float(x), 3) for x in np.ravel(v)]
    rig = {"floor": round((floor - ORIGIN[2]) / 10.0, 3), "skin": SKIN_JOINTS,
           "joints": {k: r3(to_model(v)) for k, v in J.items()}}
    for S in "LR":
        s0, e0 = to_model(J["hum" + S])[0], to_model(J["ulna" + S])[0]
        axis = (e0 - s0) / np.linalg.norm(e0 - s0)
        d = to_model(X["humDistal" + S])
        hinge = np.linalg.svd(d - d.mean(axis=0), full_matrices=False)[2][0]   # widest direction of the distal humerus
        if np.dot(hinge, np.cross(axis, [0, 0, 1])) < 0:
            hinge = -hinge
        rig["hinge" + S] = r3(hinge)
        for k in ("palm", "pronEnd", "acrom"):
            rig[k + S] = r3(to_model(X[k + S]))
        rig.update(hand_rig(bones, "left" if S == "L" else "right", S))
    rig["joints"].update(FINGER_JOINTS)

    with open(out_dir + "/model.json", "w") as fh:
        json.dump({"parts": manifest, "levels": levels, "rig": rig,
                   "data": base64.b64encode(bytes(blob)).decode("ascii")}, fh, separators=(",", ":"))
    print(f"atlas verts {n_atlas}  exercise verts {n_ex}  bytes {len(blob)}")
    print(json.dumps(rig["joints"]))
    if max(n_atlas, n_ex) > 180000:
        sys.exit("a scene is over the 180,000 vertex budget")


if __name__ == "__main__":
    main(*sys.argv[1:5])
