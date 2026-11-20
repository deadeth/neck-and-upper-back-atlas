// The exercise scene: the full skeleton carrying the atlas muscles, simple props, and a keyframe player.
//
// Bones are rigid meshes hung on a joint hierarchy. Spine, head and legs use forward kinematics;
// arms are solved by two-bone IK so a hand can be pinned to the head, the chest or a point in the room.
// Muscles are skinned to the bones they attach to, so they lengthen and shorten with the movement.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { geometry, splitTendon } from "./model.js";
import { MOVES, BASES, SEAT } from "./moves.js";
import { REAL } from "./timing.js";

export const MOVE_IDS = MOVES;   // for checks
const D2R = Math.PI / 180, CM = 0.01;
const V3 = THREE.Vector3;
const LAYER_COLOUR = { 1: 0xb44a40, 2: 0xa23c38, 3: 0x8f3436, 4: 0x7c2d35 };
const TARGET = 0x14b3a6;
const DIM = new THREE.Color(0x6f5a5c);
const TENDON = 0xeee3d3;   // aponeuroses: a pale translucent sheet, drawn as in anatomy.js
const TENDON_OPACITY = 0.34;
const WHITE = new THREE.Color(0xffffff);

const PARENT = {
  pelvis: null, l5: "pelvis", l4: "l5", l3: "l4", l2: "l3", l1: "l2", thorax: "l1",
  c7: "thorax", c6: "c7", c5: "c6", c4: "c5", c3: "c4", c2: "c3", c1: "c2", head: "c1",
  clavL: "thorax", clavR: "thorax", scapL: "thorax", scapR: "thorax",
  femL: "pelvis", tibL: "femL", footL: "tibL", femR: "pelvis", tibR: "femR", footR: "tibR",
  humL: null, ulnaL: null, radL: "ulnaL", humR: null, ulnaR: null, radR: "ulnaR",
};
// wrist, then each finger as a chain of hinges: f<digit><p|m|d><side>, digit 1 = thumb
const DIGITS = [1, 2, 3, 4, 5];
const segs = (d) => (d === 1 ? ["p", "d"] : ["p", "m", "d"]);
for (const S of "LR") {
  PARENT["hand" + S] = "rad" + S;
  PARENT["toes" + S] = "foot" + S;   // the toes hinge at the ball of the foot
  for (const d of DIGITS) {
    let prev = "hand" + S;
    for (const seg of segs(d)) { PARENT[`f${d}${seg}${S}`] = prev; prev = `f${d}${seg}${S}`; }
  }
}
const LUMBAR = ["l5", "l4", "l3", "l2", "l1"], LOWER_NECK = ["c7", "c6", "c5", "c4", "c3", "c2"];
// Finger shapes as [knuckle, middle joint, end joint, thumb base, thumb tip] in degrees of extra curl.
// 0 is the scanned hand, which is already loosely curled.
const CURL = { rest: [0, 0, 0, 0, 0], flat: [-26, -24, -12, -6, -6], cup: [-12, -10, -4, 0, 0], wrap: [16, 26, 14, 6, 8], hook: [8, 34, 22, 0, 0], grip: [34, 52, 30, 14, 28] };
const curlOf = (spec) => (Array.isArray(spec.curl) ? spec.curl : CURL[spec.curl || "rest"]);
const SNAP_JOINTS = { head: ["head"], chest: ["thorax", "clavL", "clavR"], thigh: ["femL", "femR"] };

const NUM = ["lum", "thor", "neck", "head", "shL", "shR", "hipL", "hipR"];
const ZERO = {
  root: { p: [0, 0.88, 0], r: [0, 0, 0] }, lum: [0, 0, 0], thor: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shL: [0, 0, 0], shR: [0, 0, 0], hipL: [0, 0], hipR: [0, 0], kneeL: 0, kneeR: 0, ankL: 0, ankR: 0,
};

const flipX = (v) => v && [-v[0], v[1], v[2]];
const mirrorArm = (a) => ({ ...a, p: flipX(a.p), pole: flipX(a.pole), n: flipX(a.n), g: flipX(a.g), at: flipX(a.at) });
/** expand the "both sides" shorthands of one pose layer */
function expand(layer) {
  const o = { ...layer };
  if (o.aB) { o.aL = o.aL || o.aB; o.aR = o.aR || mirrorArm(o.aB); delete o.aB; }
  if (o.shB) { o.shL = o.shL || o.shB; o.shR = o.shR || o.shB; delete o.shB; }
  if (o.hipB) { o.hipL = o.hipL || o.hipB; o.hipR = o.hipR || o.hipB; delete o.hipB; }
  if (o.kneeB !== undefined) { o.kneeL = o.kneeL ?? o.kneeB; o.kneeR = o.kneeR ?? o.kneeB; delete o.kneeB; }
  if (o.ankB !== undefined) { o.ankL = o.ankL ?? o.ankB; o.ankR = o.ankR ?? o.ankB; delete o.ankB; }
  if (o.legB) { o.legL = o.legL || o.legB; o.legR = o.legR || { ...o.legB, p: flipX(o.legB.p), pole: flipX(o.legB.pole), ball: flipX(o.legB.ball) }; delete o.legB; }
  return o;
}
const ease = (u, kind) => kind === "i" ? u * u : kind === "o" ? 1 - (1 - u) * (1 - u) : kind === "l" ? u : u * u * (3 - 2 * u);
const lerpArr = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

/**
 * @param model   parsed model.json
 * @param buffer  ArrayBuffer from unpack(model)
 * @param meta    { [muscleId]: { layer, exercises: [id] } }
 */
export function createFigure(canvas, model, buffer, meta) {
  const R = model.rig;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 0.6;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.enabled = false;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8794, 1.2));
  const sun = new THREE.DirectionalLight(0xfff6ea, 1.8);
  sun.position.set(1.6, 3.6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.5, far: 9 });
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xcfe3ff, 0.7);
  rim.position.set(-2, 1.5, -2.5);
  scene.add(rim);

  const mats = {
    bone: new THREE.MeshStandardMaterial({ color: 0xe7dec9, roughness: 0.75, side: THREE.DoubleSide }),
    prop: new THREE.MeshStandardMaterial({ color: 0x8794a1, roughness: 0.8 }),
    soft: new THREE.MeshStandardMaterial({ color: 0x8794a1, roughness: 0.9, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    band: new THREE.MeshStandardMaterial({ color: 0xe0762a, roughness: 0.5 }),
    weight: new THREE.MeshStandardMaterial({ color: 0x3d4853, roughness: 0.5 }),
    floor: new THREE.MeshBasicMaterial({ color: 0x8a97a4, transparent: true, opacity: 0.16 }),
    shadow: new THREE.ShadowMaterial({ opacity: 0.2 }),
    sheetDepth: new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: 2 }),
  };
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mats.shadow);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.002;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // ---------- skeleton ----------
  // Rest pose = the model as scanned, in metres. Every joint has an identity rest rotation, and a
  // "holder" child that cancels the joint's rest position so meshes can stay in model coordinates.
  const rest = {};
  for (const [k, v] of Object.entries(R.joints)) rest[k] = new V3().fromArray(v).multiplyScalar(CM);
  const mark = (k) => new V3().fromArray(R[k]).multiplyScalar(CM);
  const bone = {}, holder = {};
  for (const name of Object.keys(PARENT)) {
    const b = new THREE.Bone();
    b.position.copy(rest[name]);
    if (PARENT[name]) { b.position.sub(rest[PARENT[name]]); bone[PARENT[name]].add(b); } else scene.add(b);
    const h = new THREE.Group();
    h.position.copy(rest[name]).negate();
    b.add(h);
    bone[name] = b; holder[name] = h;
  }
  for (const n of [...LUMBAR, "thorax", ...LOWER_NECK, "c1", "head"]) bone[n].rotation.order = "YXZ";
  for (const n of ["femL", "femR"]) bone[n].rotation.order = "ZXY";

  const muscles = [], rigid = {};
  for (const part of model.parts) {
    if (part.kind !== "bone") continue;
    const m = new THREE.Mesh(geometry(part, buffer, CM), mats.bone);
    m.castShadow = true;
    holder[part.joint].add(m);
    (rigid[part.joint] ||= []).push(new THREE.Mesh(m.geometry, mats.bone));   // untransformed copy, in rest coordinates
  }
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(R.skin.map((n) => bone[n]));   // bind pose = rest pose
  /** add one region's muscles (parts of a muscles-<region>.json file), skinned to the skeleton */
  function addMuscles(parts, buf, region) {
    for (const part of parts) {
      const layer = meta[part.id] ? meta[part.id].layer : 2;
      const mat = new THREE.MeshStandardMaterial({ color: LAYER_COLOUR[layer], roughness: 0.56, side: THREE.DoubleSide });
      const [flesh, sheet] = splitTendon(geometry(part, buf, CM, true), part);
      const m = new THREE.SkinnedMesh(flesh, mat);
      m.frustumCulled = false;
      m.visible = false;
      m.userData = { id: part.id, side: part.side, layer, region, base: new THREE.Color(LAYER_COLOUR[layer]) };
      scene.add(m);
      m.bind(skeleton, new THREE.Matrix4());   // geometry is in rest coordinates whatever pose the skeleton is in now
      muscles.push(m);
      if (sheet) {   // the aponeurosis shares the vertices and skin, so it moves with the muscle with no seam
        const t = new THREE.SkinnedMesh(sheet, new THREE.MeshStandardMaterial({
          color: TENDON, roughness: 0.32, side: THREE.DoubleSide, transparent: true, depthWrite: true, depthFunc: THREE.LessDepth, opacity: TENDON_OPACITY }));
        const d = new THREE.SkinnedMesh(sheet, mats.sheetDepth);
        for (const x of [t, d]) { x.frustumCulled = false; x.bind(skeleton, new THREE.Matrix4()); }
        d.renderOrder = 4;
        t.add(d);
        t.visible = false;
        t.userData = { ...m.userData, tendon: true, depthPass: d, base: new THREE.Color(TENDON) };
        scene.add(t);
        muscles.push(t);
      }
    }
  }

  // ---------- arm geometry ----------
  const arms = {};
  for (const [S, sx] of [["L", 1], ["R", -1]]) {
    const s0 = rest["hum" + S], e0 = rest["ulna" + S], p0 = rest["rad" + S];
    const acrom = mark("acrom" + S);
    const aR = e0.clone().sub(s0);
    arms[S] = {
      sx, upper: aR.length(), aR: aR.normalize(), hR: new V3().fromArray(R["hinge" + S]).normalize(),
      pronAxis: mark("pronEnd" + S).sub(p0).normalize(),          // forearm rotation axis: radial head to ulnar head
      palmFromP0: mark("palm" + S).sub(p0), p0FromE: p0.clone().sub(e0),
      shLocal: s0.clone().sub(rest["scap" + S]), acromLocal: acrom.clone().sub(rest["scap" + S]),
      clavRestDir: acrom.clone().sub(rest["clav" + S]).normalize(),
      scapRest: bone["scap" + S].position.clone(), clavPos: bone["clav" + S].position.clone(),
      nScap: new V3(-0.5 * sx, 0, 0.866),                         // normal of the shoulder blade's plane
      S: new V3(), E: new V3(), T: new V3(),
      // hand: wrist centre, palm centre, palm frame (n out of the palm, g along the fingers)
      wFromP0: rest["hand" + S].clone().sub(p0), palmFromW: mark("palm" + S).sub(rest["hand" + S]),
      n0: new V3().fromArray(R["palmN" + S]).normalize(), g0: new V3().fromArray(R["palmG" + S]).normalize(),
      flex: DIGITS.map((d) => new V3().fromArray(R[`flex${d}${S}`]).normalize()),
      tw: 0, handQ: new THREE.Quaternion(), nW: new V3(), restBasisT: new THREE.Matrix4(),
    };
    handBasis(arms[S].n0, arms[S].g0, arms[S].restBasisT).transpose();
    arms[S].barQ = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), new V3().crossVectors(arms[S].n0, arms[S].g0).normalize());
  }
  /** orthonormal frame with columns n, g (made square to n), n x g */
  function handBasis(n, g, m) {
    const gg = g.clone().addScaledVector(n, -g.dot(n)).normalize();
    return m.makeBasis(n, gg, new V3().crossVectors(n, gg));
  }
  const frames = { chest: bone.thorax, head: bone.head, neck: bone.c7, pelvis: bone.pelvis, world: scene, thighL: bone.femL, thighR: bone.femR };
  const legs = {};
  for (const S of "LR") {
    const th = rest["tib" + S].clone().sub(rest["fem" + S]), sh = rest["foot" + S].clone().sub(rest["tib" + S]);
    legs[S] = { thigh: th.length(), shin: sh.length(), thR: th.normalize(), shR: sh.normalize(), hinge: new V3(1, 0, 0) };
    // toes: hinge axis along the ball of the foot, and the toe pads (points of the toes that touch the floor
    // standing, at least 2 cm in front of the hinge), in the foot's frame with their heights above that floor
    const toeAxis = new V3().fromArray(R["toeAxis" + S]).normalize(), toeFwd = new V3().crossVectors(new V3(0, 1, 0), toeAxis).normalize();
    const pos = rigid["toes" + S][0].geometry.attributes.position, p = new V3(), pads = [];
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
    const ball = rest["toes" + S], floorY = R.floor * CM;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      if (p.y < minY + 0.004 && p.clone().sub(ball).dot(toeFwd) > 0.02) pads.push({ p: p.clone().sub(rest["foot" + S]), h: p.y - floorY });
    }
    Object.assign(legs[S], { toeAxis, toeFwd, ball: ball.clone().sub(rest["foot" + S]), ballH: ball.y - floorY, pads });
  }
  const frameOf = (spec, side) => (spec.f === "thigh" ? bone["fem" + side] : frames[spec.f]);
  const frameJoint = (spec, side) => (spec.f === "thigh" ? "fem" + side : { chest: "thorax", head: "head", neck: "c7", pelvis: "pelvis", thighL: "femL", thighR: "femR" }[spec.f]);

  // A hand that rests on a bone is placed by casting a ray at the bone in the rest pose, so the
  // palm sits just clear of the surface instead of hovering above it or sinking into it.
  const snapCache = new Map(), caster = new THREE.Raycaster();
  function palmPoint(spec, side) {
    if (!spec.snap) return spec.p;
    const key = side + JSON.stringify([spec.f, spec.p, spec.n, spec.at, spec.clear]);
    if (snapCache.has(key)) return snapCache.get(key);
    const origin = rest[frameJoint(spec, side)];
    const p = new V3().fromArray(spec.p);
    const dir = spec.at ? new V3().fromArray(spec.at).sub(p).normalize() : new V3().fromArray(spec.n).normalize();
    caster.set(p.clone().add(origin).addScaledVector(dir, -0.12), dir);
    caster.far = 0.4;
    const targets = SNAP_JOINTS[spec.f].filter((j) => spec.f !== "thigh" || j.endsWith(side)).flatMap((j) => rigid[j] || []);
    const hit = caster.intersectObjects(targets, false)[0];
    const out = hit ? hit.point.clone().addScaledVector(dir, -(spec.clear || 0.016)).sub(origin).toArray() : spec.p;
    snapCache.set(key, out);
    return out;
  }

  // ---------- props ----------
  const props = new THREE.Group();
  scene.add(props);
  const dyn = [];
  const Y = new V3(0, 1, 0);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 16).translate(0, 0.5, 0);
  const box = (w, h, d, pos, mat = mats.prop) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.fromArray(pos); m.castShadow = true; m.receiveShadow = true; props.add(m); return m;
  };
  function stool(withBack) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 32), mats.prop);
    seat.position.set(0, SEAT - 0.02, 0.06); seat.castShadow = true; seat.receiveShadow = true; props.add(seat);
    for (const [x, z] of [[0.15, 0.2], [-0.15, 0.2], [0.15, -0.08], [-0.15, -0.08]]) box(0.03, SEAT - 0.04, 0.03, [x, (SEAT - 0.04) / 2, z]);
    if (withBack) {
      box(0.38, 0.22, 0.02, [0, SEAT + 0.2, -0.11]);
      box(0.03, 0.34, 0.03, [0.17, SEAT + 0.14, -0.11]);
      box(0.03, 0.34, 0.03, [-0.17, SEAT + 0.14, -0.11]);
    }
  }
  function segment(mat, radius) {
    const m = new THREE.Mesh(unitCyl, mat);
    m.castShadow = true;
    props.add(m);
    return (a, b) => {
      const d = b.clone().sub(a), len = d.length();
      m.position.copy(a);
      m.quaternion.setFromUnitVectors(Y, d.normalize());
      m.scale.set(radius, len, radius);
    };
  }
  const BUILD = {
    stool: () => stool(false),
    chair: () => stool(true),
    mat: () => { const m = box(0.76, 0.012, 2.1, [0, 0.006, 0]); m.castShadow = false; },
    wall: () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 0.03), mats.soft);
      m.position.set(0, 1.05, -0.125); props.add(m);
    },
    weights: () => {
      for (const side of ["L", "R"]) {
        const g = new THREE.Group();
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 12), mats.weight);
        bar.rotation.x = Math.PI / 2; g.add(bar);
        for (const z of [-0.075, 0.075]) {
          const end = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 20), mats.weight);
          end.rotation.x = Math.PI / 2; end.position.z = z; end.castShadow = true; g.add(end);
        }
        props.add(g);
        dyn.push(() => {
          const a = arms[side];
          g.position.copy(a.T).addScaledVector(a.nW, 0.022);   // the bar lies across the palm
          g.quaternion.copy(a.handQ).multiply(a.barQ);
        });
      }
    },
    bar: () => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 16), mats.weight);
      b.rotation.z = Math.PI / 2; b.position.set(0, 2.1, 0.02); b.castShadow = true; props.add(b);
      box(0.04, 2.1, 0.04, [0.6, 1.05, 0.02]); box(0.04, 2.1, 0.04, [-0.6, 1.05, 0.02]);
    },
    bandFront: () => {
      box(0.04, 1.4, 0.04, [0, 0.7, 1.3]);
      const anchor = new V3(0, 1.22, 1.28);
      for (const side of ["L", "R"]) {
        const set = segment(mats.band, 0.007);
        dyn.push(() => set(anchor, arms[side].T.clone().addScaledVector(arms[side].nW, 0.02)));
      }
    },
    bandSide: () => {
      box(0.04, 1.3, 0.04, [-0.9, 0.65, 0.22]);
      const anchor = new V3(-0.88, 1.1, 0.22);
      const set = segment(mats.band, 0.007);
      dyn.push(() => set(anchor, arms.L.T.clone().addScaledVector(arms.L.nW, 0.02)));
    },
  };

  // ---------- player ----------
  let move = null, poses = [], time = 0, playing = true, speed = 1, autoView = null, glowT = 0, ground = 0;
  let real = false, rt = 0, plan = null;   // real-time playback: seconds into the real loop, and its phase timings
  let session = null, moveId = null, setRestChoice = null;   // the user's rest between sets (seconds), null = each move's own   // real-time session: the reps, rests and changeovers of the dose (see sessionFor)
  const view = { frame: "whole", angle: "best" };
  const targetMats = [];

  function paint(ids) {
    // light up the muscles this exercise works; ghost anything lying over the deepest of them
    const onSide = (m) => !move.side || move.side === m.userData.side;
    const regions = new Set(ids.map((m) => meta[m].region));
    let deepest = 0;
    for (const m of ids) deepest = Math.max(deepest, meta[m].layer);
    targetMats.length = 0;
    for (const m of muscles) {
      const { id: mid, layer, base, region } = m.userData;
      const mat = m.material;
      m.visible = regions.has(region);
      if (!m.visible) continue;
      const isT = ids.includes(mid) && onSide(m);
      if (m.userData.tendon) {
        // a target's sheet is a lighter tint of the target colour; any other sheet is ghosted so it never veils one
        mat.color.copy(isT ? new THREE.Color(TARGET).lerp(WHITE, 0.22) : base.clone().lerp(DIM, 0.3));
        mat.emissive.setHex(0);
        mat.opacity = isT ? 0.62 : 0.06;
        m.userData.depthPass.visible = mat.depthWrite = isT;
        m.renderOrder = isT ? 5 : 3;
        m.castShadow = false;
        if (isT) targetMats.push(mat);
        continue;
      }
      let opacity = 1;
      mat.emissive.setHex(0);
      if (isT) {
        mat.color.setHex(TARGET);
        opacity = layer === deepest ? 1 : 0.6;
        targetMats.push(mat);
      } else if (layer > deepest) {
        mat.color.copy(base).lerp(DIM, 0.45);
      } else {
        mat.color.copy(base).lerp(DIM, 0.4);
        opacity = 0.1;
      }
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
      mat.depthWrite = opacity === 1;
      mat.needsUpdate = true;
      m.renderOrder = opacity < 1 ? (isT ? 2 : 3) : 0;
      m.castShadow = opacity > 0.5;
    }
  }

  /** @param targets muscle ids to light up */
  function load(id, targets) {
    move = MOVES[id];
    if (!move) return false;
    const base = { ...ZERO, ...expand(BASES[move.base]), ...expand(move.rest || {}) };
    poses = move.keys.map((k) => ({ ...base, ...expand(k) }));
    time = 0;
    plan = planFor(id);
    rt = 0;
    session = sessionFor(id);
    moveId = id;
    if (real) playing = false;   // a session waits for Start
    dyn.length = 0;
    for (const c of [...props.children]) props.remove(c);
    for (const p of move.props) BUILD[p]();
    ground = move.props.includes("mat") ? 0.012 : 0;   // what the feet stand on: the floor or the mat's top
    paint(targets);
    const lying = move.base === "prone" || move.base === "supine";
    // targets sit below the figure's middle so the controls along the bottom of the stage don't cover the feet
    autoView = { yaw: 30, pitch: 8, dist: lying ? 4.4 : move.base === "sit" ? 4.4 : 5.2, target: lying ? [0, -0.05, 0.05] : [0, move.base === "sit" ? 0.56 : 0.74, 0], ...move.view };
    pose(0);
    setView(move.start || "whole", "best");
    return true;
  }

  /**
   * @param frame  "whole" or "close" (neck and shoulders)
   * @param angle  "best" (the move's own angle), "front", "side" or "back"
   */
  function setView(frame = view.frame, angle = view.angle) {
    if (!autoView) return;
    view.frame = frame; view.angle = angle;
    const v = { ...autoView, target: [...autoView.target] };
    const lying = move.base === "prone" || move.base === "supine";
    if (angle === "front") { v.yaw = 0.01; v.pitch = lying ? 55 : 5; }
    if (angle === "side") { v.yaw = 90; v.pitch = lying ? 14 : 5; }
    if (angle === "back") { v.yaw = 180; v.pitch = lying ? 40 : 6; }
    if (frame === "close") {
      // frame the neck and shoulders so the working muscle fills the view
      const c = bone.c7.getWorldPosition(new V3());
      v.target = [c.x, c.y + (lying ? 0 : 0.01), c.z];
      v.dist = move.closeDist || 1.45;
      if (lying) v.pitch = Math.max(v.pitch, 24);
    }
    const fit = camera.aspect < 0.9 ? Math.min(0.9 / camera.aspect, 1.5) : 1;
    const yaw = v.yaw * D2R, pitch = v.pitch * D2R;
    controls.target.fromArray(v.target);
    camera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(v.dist * fit).add(controls.target);
    controls.update();
  }

  const q = new THREE.Quaternion(), v1 = new V3(), v2 = new V3(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  /** rotation taking the rest frame (axis aR, hinge hR) to the current frame (aC, hC) */
  function frameQuat(aR, hR, aC, hC, out) {
    const basis = (a, h, m) => {
      const hh = h.clone().addScaledVector(a, -h.dot(a)).normalize();
      return m.makeBasis(a, hh, new V3().crossVectors(a, hh));
    };
    basis(aC, hC, mA);
    basis(aR, hR, mB);
    return out.setFromRotationMatrix(mA.multiply(mB.transpose()));
  }
  function armTarget(spec, side, out) {
    out.fromArray(palmPoint(spec, side));
    if (spec.f !== "world") frameOf(spec, side).localToWorld(out);
    return out;
  }
  /** direction given in a spec's frame -> world */
  function frameDir(spec, side, arr, out) {
    out.fromArray(arr);
    if (spec.f !== "world") out.applyQuaternion(frameOf(spec, side).getWorldQuaternion(q));
    return out.normalize();
  }

  /** two-bone IK from the shoulder: where the elbow goes for a given end point and elbow direction */
  function ik(S, target, upper, fore, pole) {
    const d = target.clone().sub(S);
    let L = d.length();
    const maxL = upper + fore - 0.002, minL = Math.abs(upper - fore) + 0.03;
    if (L > maxL) { d.multiplyScalar(maxL / L); L = maxL; }
    if (L < minL) { d.multiplyScalar(minL / Math.max(L, 1e-6)); L = minL; }
    const nrm = d.clone().normalize();
    const cosA = (upper * upper + L * L - fore * fore) / (2 * upper * L);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const perp = pole.clone().addScaledVector(nrm, -pole.dot(nrm));
    if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0).addScaledVector(nrm, nrm.y);
    perp.normalize();
    return {
      E: S.clone().addScaledVector(nrm, upper * cosA).addScaledVector(perp, upper * sinA),
      end: S.clone().addScaledVector(nrm, L),                    // the end point after clamping to arm's length
      hinge: new V3().crossVectors(perp, nrm).normalize(),       // elbow hinge axis
    };
  }
  /** wrist position relative to the elbow, in forearm coordinates, for a given forearm rotation */
  const wristRel = (a, tw) => a.wFromP0.clone().applyAxisAngle(a.pronAxis, tw).add(a.p0FromE);

  /** the hand orientation a key asks for: palm facing n (or towards a point), fingers along g */
  function wantedHand(a, side, spec, palm, pole, out) {
    const n = spec.at ? armTarget({ ...spec, p: spec.at, snap: false }, side, new V3()).sub(palm).normalize()
      : frameDir(spec, side, spec.n || [0, 0, 1], new V3());
    let g;
    if (spec.g && !spec.along) g = frameDir(spec, side, spec.g, new V3());
    else {
      // fingers carry on along the forearm
      const w = palm.clone().addScaledVector(n, 0);   // close enough to the wrist for a direction
      g = w.sub(ik(a.S, palm, a.upper, wristRel(a, 0).length() + 0.06, pole).E).normalize();
    }
    if (spec.along) n.addScaledVector(g, -n.dot(g)).normalize();   // keep the fingers' line, square the palm to it
    handBasis(n, g, mA);
    return out.setFromRotationMatrix(mA.multiply(a.restBasisT));
  }

  const qU = new THREE.Quaternion(), qRel = new THREE.Quaternion();
  /**
   * Solve one arm for one key under the current body pose. Returns joint rotations, so that two
   * keys can be blended joint by joint: the arm then swings round between poses instead of the
   * hand sliding along a straight line through the body.
   */
  function solveKey(side, spec, thorQ) {
    const a = arms[side], scap = bone["scap" + side];
    const palm = armTarget(spec, side, new V3());
    const pole = new V3().fromArray(spec.pole).applyQuaternion(thorQ).normalize();

    // the shoulder blade turns upward by about a third of the arm's lift
    const reach = wristRel(a, 0).length() + 0.06;
    let upRot = 0;
    for (let pass = 0; pass < 2; pass++) {
      scap.quaternion.setFromAxisAngle(a.nScap, upRot * a.sx);
      scap.updateMatrixWorld(true);
      a.S.copy(a.shLocal).applyMatrix4(scap.matrixWorld);
      if (pass === 0) {
        const down = new V3(0, -1, 0).applyQuaternion(thorQ);
        const elev = ik(a.S, palm, a.upper, reach, pole).E.sub(a.S).normalize().angleTo(down);
        upRot = THREE.MathUtils.clamp((elev - 30 * D2R) * 0.33, 0, 45 * D2R);
        if (upRot < 1e-4) break;
      }
    }

    // wrist from palm, then elbow from wrist; the forearm's rotation and the wrist's bend make up the rest
    const qD = wantedHand(a, side, spec, palm, pole, new THREE.Quaternion());
    const W = palm.clone().sub(a.palmFromW.clone().applyQuaternion(qD));
    let tw = 0, sol;
    for (let it = 0; it < 4; it++) {
      const wr = wristRel(a, tw);
      sol = ik(a.S, W, a.upper, wr.length(), pole);
      frameQuat(wr.clone().normalize(), a.hR, sol.end.clone().sub(sol.E).normalize(), sol.hinge, qU);
      qRel.copy(qU).invert().multiply(qD);
      // the part of qRel that is a turn about the forearm's axis
      let pron = 2 * Math.atan2(qRel.x * a.pronAxis.x + qRel.y * a.pronAxis.y + qRel.z * a.pronAxis.z, qRel.w) * a.sx;
      // pronation from the scanned palm-forward pose runs from about -25 to 185 degrees; wrap in the
      // middle of the range the forearm can't reach so a borderline pose can't flip between the two ends
      while (pron < -100 * D2R) pron += 2 * Math.PI;
      while (pron >= 260 * D2R) pron -= 2 * Math.PI;
      tw = THREE.MathUtils.clamp(pron, -25 * D2R, 185 * D2R) * a.sx;
    }
    const bend = new THREE.Quaternion().setFromAxisAngle(a.pronAxis, tw).invert().multiply(qRel);
    const bendAngle = 2 * Math.acos(Math.min(1, Math.abs(bend.w)));
    if (bendAngle > 75 * D2R) bend.slerp(new THREE.Quaternion(), 1 - (75 * D2R) / bendAngle);   // wrists only bend so far
    const hum = frameQuat(a.aR, a.hR, sol.E.clone().sub(a.S).normalize(), sol.hinge, new THREE.Quaternion());
    return { upRot, hum, elbow: hum.clone().invert().multiply(qU), tw, bend, curl: curlOf(spec) };
  }

  const qT = new THREE.Quaternion();
  function solveArm(side, A, B, u, shOff) {
    const a = arms[side], scap = bone["scap" + side], clav = bone["clav" + side];
    const thorQ = bone.thorax.getWorldQuaternion(new THREE.Quaternion());
    scap.position.set(a.scapRest.x + shOff[0] * a.sx, a.scapRest.y + shOff[1], a.scapRest.z + shOff[2]);

    const k = solveKey(side, A, thorQ);
    if (B !== A) {
      const kb = solveKey(side, B, thorQ);
      k.upRot += (kb.upRot - k.upRot) * u;
      k.hum.slerp(kb.hum, u);
      k.elbow.slerp(kb.elbow, u);
      k.tw += (kb.tw - k.tw) * u;
      k.bend.slerp(kb.bend, u);
      k.curl = k.curl.map((v, i) => v + (kb.curl[i] - v) * u);
    }

    scap.quaternion.setFromAxisAngle(a.nScap, k.upRot * a.sx);
    scap.updateMatrixWorld(true);
    a.S.copy(a.shLocal).applyMatrix4(scap.matrixWorld);
    // the collarbone pivots at the breastbone so its outer end follows the shoulder blade
    const acrom = a.acromLocal.clone().applyQuaternion(scap.quaternion).add(scap.position);
    clav.quaternion.setFromUnitVectors(a.clavRestDir, acrom.sub(a.clavPos).normalize());

    const hum = bone["hum" + side], ulna = bone["ulna" + side];
    hum.position.copy(a.S);
    hum.quaternion.copy(k.hum);
    a.E.copy(a.aR).multiplyScalar(a.upper).applyQuaternion(k.hum).add(a.S);
    ulna.position.copy(a.E);
    ulna.quaternion.copy(k.hum).multiply(k.elbow);
    qT.setFromAxisAngle(a.pronAxis, k.tw);
    bone["rad" + side].quaternion.copy(qT);
    bone["hand" + side].quaternion.copy(k.bend);
    a.tw = k.tw;
    a.handQ.copy(ulna.quaternion).multiply(qT).multiply(k.bend);
    a.nW.copy(a.n0).applyQuaternion(a.handQ);
    // where the palm is: wrist bend, then forearm rotation, then the forearm itself
    a.T.copy(a.palmFromW).applyQuaternion(k.bend).add(a.wFromP0).applyQuaternion(qT).add(a.p0FromE).applyQuaternion(ulna.quaternion).add(a.E);

    const c = k.curl.map((v) => v * D2R);
    for (const d of DIGITS) {
      const axis = a.flex[d - 1], angles = d === 1 ? [c[3], c[4]] : [c[0], c[1], c[2]];
      segs(d).forEach((seg, i) => bone[`f${d}${seg}${side}`].quaternion.setFromAxisAngle(axis, angles[i]));
    }
  }

  const setEuler = (b, e, k = 1) => b.rotation.set(e[0] * k * D2R, e[1] * k * D2R, e[2] * k * D2R);
  const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
  /**
   * Toe extension (degrees) that brings the toe pads back down onto the ground and no further, for a foot
   * pitched heel up with the ball on or near the ground. It fades to 0 for a flat foot, a foot in the air
   * or a sole that doesn't face down, so there the toes stay as scanned.
   */
  const qF = new THREE.Quaternion(), J = new V3(), ax = new V3(), r = new V3(), perp = new V3(), w = new V3();
  function autoToes(side) {
    const g = legs[side], foot = bone["foot" + side], m = foot.matrixWorld;
    foot.getWorldQuaternion(qF);
    J.copy(g.ball).applyMatrix4(m);
    ax.copy(g.toeAxis).applyQuaternion(qF);
    let e = -Infinity;
    for (const pad of g.pads) {
      // a pad's height after turning t about the axis is J.y + par.y + perp.y cos t + w.y sin t
      r.copy(pad.p).applyMatrix4(m).sub(J);
      const par = ax.y * ax.dot(r);
      perp.copy(r).addScaledVector(ax, -ax.dot(r));
      w.crossVectors(ax, perp);
      const c = THREE.MathUtils.clamp((ground + pad.h - J.y - par) / Math.max(Math.hypot(perp.y, w.y), 1e-6), -1, 1);
      let t = (Math.atan2(w.y, perp.y) - Math.acos(c)) / D2R;   // the root where turning further lifts the pad
      while (t < -120) t += 360;
      while (t >= 240) t -= 360;
      e = Math.max(e, t);   // the pad that needs the most lift decides
    }
    const pitch = Math.asin(THREE.MathUtils.clamp(-r.copy(g.toeFwd).applyQuaternion(qF).y, -1, 1)) / D2R;
    const soleDown = r.set(0, 1, 0).applyQuaternion(qF).y;
    const k = smooth(pitch, 0, 2) * smooth(soleDown, 0.05, 0.25) * (1 - smooth(J.y - ground - g.ballH, 0.015, 0.04));
    return THREE.MathUtils.clamp(e, 0, 70) * k;
  }
  function pose(f) {
    let i = 0;
    while (i < move.keys.length - 2 && f >= move.keys[i + 1].t) i++;
    const k0 = move.keys[i], k1 = move.keys[i + 1], A = poses[i], B = poses[i + 1];
    const u = ease(THREE.MathUtils.clamp((f - k0.t) / Math.max(1e-6, k1.t - k0.t), 0, 1), k1.e);

    bone.pelvis.position.fromArray(lerpArr(A.root.p, B.root.p, u));
    setEuler(bone.pelvis, lerpArr(A.root.r, B.root.r, u));
    const P = {};
    for (const key of NUM) P[key] = lerpArr(A[key], B[key], u);
    for (const n of LUMBAR) setEuler(bone[n], P.lum, 1 / LUMBAR.length);
    setEuler(bone.thorax, P.thor);
    for (const n of LOWER_NECK) setEuler(bone[n], P.neck, 1 / LOWER_NECK.length);
    // the top two joints: nodding mostly at the skull, turning mostly between C1 and C2
    bone.c1.rotation.set(P.head[0] * 0.3 * D2R, P.head[1] * 0.8 * D2R, P.head[2] * 0.3 * D2R);
    bone.head.rotation.set(P.head[0] * 0.7 * D2R, P.head[1] * 0.2 * D2R, P.head[2] * 0.7 * D2R);
    for (const [side, sx] of [["L", 1], ["R", -1]]) {
      const hip = P["hip" + side];
      bone["fem" + side].rotation.set(-hip[0] * D2R, 0, hip[1] * D2R * sx);
      bone["tib" + side].rotation.set((A["knee" + side] + (B["knee" + side] - A["knee" + side]) * u) * D2R, 0, 0);
      bone["foot" + side].rotation.set((A["ank" + side] + (B["ank" + side] - A["ank" + side]) * u) * D2R, 0, 0);
    }
    scene.updateMatrixWorld(true);
    for (const side of "LR") {
      const LA = A["leg" + side], LB = B["leg" + side];
      if (!LA || !LB) continue;
      // feet planted: ankle target in the room, knee pointing along `pole`, foot pitched by `foot` degrees
      const g = legs[side], fem = bone["fem" + side], tib = bone["tib" + side];
      const hipW = fem.getWorldPosition(new V3());
      // on the ball of the foot (`ball` in both keys): `ball` is where the toe joint goes and `foot` turns the
      // foot heel up about the line through the ball, so the ball stays put whatever the pitch; the ankle follows
      const fA = LA.foot || 0, fB = LB.foot || 0, onBall = LA.ball && LB.ball;
      const ballQ = onBall && new THREE.Quaternion().setFromAxisAngle(g.toeAxis, -(fA + (fB - fA) * u) * D2R);
      const ankle = onBall ? g.ball.clone().negate().applyQuaternion(ballQ).add(new V3().fromArray(lerpArr(LA.ball, LB.ball, u)))
        : new V3().fromArray(lerpArr(LA.p, LB.p, u));
      const pole = new V3().fromArray(lerpArr(LA.pole, LB.pole, u)).normalize();
      const sol = ik(hipW, ankle, g.thigh, g.shin, pole);
      const pelQ = bone.pelvis.getWorldQuaternion(new THREE.Quaternion());
      const femQ = frameQuat(g.thR, g.hinge, sol.E.clone().sub(hipW).normalize(), sol.hinge, new THREE.Quaternion());
      const tibQ = frameQuat(g.shR, g.hinge, sol.end.clone().sub(sol.E).normalize(), sol.hinge, new THREE.Quaternion());
      fem.quaternion.copy(pelQ).invert().multiply(femQ);
      tib.quaternion.copy(femQ).invert().multiply(tibQ);
      // foot: degrees of pitch, or [x, y, z] Euler degrees (XYZ) for a foot turned out of the sagittal plane
      const footQ = onBall ? ballQ : Array.isArray(fA) ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...lerpArr(fA, fB, u).map((v) => v * D2R)))
        : new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), (fA + (fB - fA) * u) * D2R);
      bone["foot" + side].quaternion.copy(tibQ).invert().multiply(footQ);
    }
    scene.updateMatrixWorld(true);
    // toes: degrees of extension from the leg spec, or else whatever lays them on the ground
    for (const side of "LR") {
      const LA = A["leg" + side], LB = B["leg" + side], set = (L) => L && L.toes !== undefined;
      const auto = set(LA) && set(LB) ? 0 : autoToes(side);
      const tA = set(LA) ? LA.toes : auto, tB = set(LB) ? LB.toes : auto;
      bone["toes" + side].quaternion.setFromAxisAngle(legs[side].toeAxis, (tA + (tB - tA) * u) * D2R);
    }
    scene.updateMatrixWorld(true);
    solveArm("L", A.aL, B.aL, u, P.shL);
    solveArm("R", A.aR, B.aR, u, P.shR);
    for (const fn of dyn) fn();
  }

  function phaseAt(f) {
    let cur = move.phases[0];
    for (const p of move.phases) if (f >= p.at) cur = p;
    return cur;
  }

  // Real time maps wall-clock seconds onto the same loop fraction the keys and phases use: each phase keeps
  // its span of the loop but lasts its real length (REAL in timing.js), so poses are exactly those of the
  // animated loop, only paced differently.
  function planFor(id) {
    const r = REAL[id] || {}, ph = move.phases;
    let hold = ph.findIndex((p) => p.w && p.label);
    if (hold < 0) hold = ph.findIndex((p) => p.w);
    const at = ph.map((p) => p.at).concat(1), len = [], start = [];
    let total = 0;
    for (let i = 0; i < ph.length; i++) {
      const own = (at[i + 1] - at[i]) * move.dur;
      len.push(i === hold && r.hold ? r.hold : (r.tempo && r.tempo[i]) || own);
      start.push(total);
      total += len[i];
    }
    return { at, len, start, total, hold: r.hold ? hold : -1 };
  }
  // A session is a list of items: a rep (one real loop of the move) or a rest (the start pose, waiting).
  // `i` is the current item and `t` the seconds into a rest; `rt` is the seconds into a rep's loop.
  // state: "waiting" (before Start), "run", "done" (stopped on the start pose).
  function sessionFor(id) {
    const r = REAL[id] || {}, sides = r.eachSide ? 2 : 1;
    const sets = Array.isArray(r.reps) ? r.reps : r.reps ? Array(r.sets || 1).fill(r.reps) : null;
    let items = null;
    if (sets) {
      items = [];
      sets.forEach((n, s) => {
        for (let side = 1; side <= sides; side++) {
          for (let k = 1; k <= n; k++) {
            items.push({ rep: k, reps: n, set: s + 1, side });
            if (k < n && r.rest) items.push({ kind: "rest", len: r.rest });
          }
          if (side < sides && r.sideRest) items.push({ kind: "side", len: r.sideRest });
        }
        if (s < sets.length - 1 && r.setRest) items.push({ kind: "set", len: setRestChoice || r.setRest, base: r.setRest });
      });
      // a rest shows the rep that comes after it
      for (let k = items.length - 1, next = null; k >= 0; k--) if (items[k].kind) items[k].next = next; else next = items[k];
    }
    return { items, sets: sets ? sets.length : 1, reps: sets, sides, unit: r.unit || "rep", setRest: r.setRest || null, i: 0, t: 0, count: 0, state: "waiting" };
  }
  function restartSession() { Object.assign(session, { i: 0, t: 0, count: 0, state: "run" }); rt = 0; }
  function nextItem() {
    const S = session;
    S.t = 0; rt = 0;
    if (!S.items) return;
    if (S.i + 1 >= S.items.length) { S.state = "done"; playing = false; return; }
    S.i++;
  }
  /** move the session on by dt seconds, carrying any remainder into the next item */
  function stepSession(dt) {
    const S = session;
    while (dt > 0 && S.state === "run") {
      const it = S.items && S.items[S.i];
      if (it && it.kind) {
        const left = Math.max(0, it.len - S.t);   // a rest shortened below the time already spent ends now
        if (dt < left) { S.t += dt; return; }
        dt -= left; nextItem();
      } else {
        const left = plan.total - rt;
        if (dt < left) { rt += dt; return; }
        dt -= left; S.count++; nextItem();
      }
    }
  }
  function sessionInfo() {
    const S = session, it = S.items ? S.items[S.i] : null;
    const resting = S.state === "run" && it && it.kind;
    const cur = it ? (it.kind ? it.next : it) : { rep: S.count + 1, reps: null, set: 1, side: 1 };
    return {
      state: S.state === "run" ? (resting ? "rest" : "rep") : S.state,
      rep: cur.rep, reps: cur.reps, set: cur.set, sets: S.sets, side: cur.side, sides: S.sides, unit: S.unit,
      plan: S.reps, done: S.count,
      setRest: S.setRest && (setRestChoice || S.setRest), setRestBase: S.setRest,
      rest: resting ? { kind: it.kind, left: Math.max(0, it.len - S.t), total: it.len } : null,
    };
  }
  /** real seconds into the loop -> loop fraction */
  function realToF(s) {
    const { at, len, start } = plan;
    let i = 0;
    while (i < len.length - 1 && s >= start[i + 1]) i++;
    return at[i] + (len[i] ? Math.min(1, (s - start[i]) / len[i]) : 0) * (at[i + 1] - at[i]);
  }
  /** loop fraction -> real seconds into the loop */
  function fToReal(f) {
    const { at, len, start } = plan;
    let i = 0;
    while (i < len.length - 1 && f >= at[i + 1]) i++;
    const span = at[i + 1] - at[i];
    return start[i] + (span ? (f - at[i]) / span : 0) * len[i];
  }

  return {
    scene, camera, controls, load, addMuscles,
    resize(width, height) { camera.aspect = width / height; camera.updateProjectionMatrix(); },
    /** advance the animation; returns { step, label, working, f, hold } for the instructions.
     *  hold is { left, total } in seconds while a timed hold runs in real time, otherwise null */
    update(dt) {
      controls.update();
      if (!move) return null;
      if (real) {
        if (playing) stepSession(dt);
        const still = session.state === "done" || (session.state === "run" && session.items && session.items[session.i].kind);
        time = still ? 0 : realToF(rt) * move.dur;   // rests and the end stay on the start pose
      }
      else if (playing) time = (time + dt * speed) % move.dur;
      const f = time / move.dur;
      pose(f);
      const ph = phaseAt(f);
      glowT += dt;
      const glow = ph.w ? 0.3 + 0.22 * Math.sin(glowT * 3.2) : 0.1;
      for (const mat of targetMats) mat.emissive.copy(mat.color).multiplyScalar(glow);
      let hold = null;
      const info = real ? sessionInfo() : null;
      if (real && plan.hold >= 0 && info.state === "rep") {
        const i = plan.hold, left = plan.start[i] + plan.len[i] - rt;
        if (rt >= plan.start[i] && left > 0) hold = { left, total: plan.len[i] };
      }
      return { step: ph.step, label: ph.label || "", working: !!ph.w, f, hold, session: info };
    },
    seek(f) { if (move) { time = f * move.dur; rt = fToReal(f); } },
    /** play at the pace you would do the exercise: holds last their stated time, Speed is ignored */
    // Turning it on goes back to the start pose and waits for Start; turning it off carries on the ordinary
    // loop from the pose on screen.
    setRealTime(on) {
      on = !!on;
      if (on && !real && move) { rt = 0; time = 0; session = sessionFor(moveId); playing = false; }
      real = on;
    },
    /** rest between sets in seconds for every move (null: each move's own setRest). A rest between sets that is
     *  running takes the new length at once; if that is already used up, it ends on the next frame. */
    setSetRest(sec) {
      setRestChoice = sec || null;
      if (session && session.items) for (const it of session.items) if (it.kind === "set") it.len = setRestChoice || it.base;
    },
    /** end a rest or changeover now */
    skipRest() { if (real && session && session.state === "run" && session.items && session.items[session.i].kind) nextItem(); },
    /** the session's items (for checks) */
    sessionItems() { return session && session.items && session.items.map((x) => ({ ...x, next: undefined })); },
    isRealTime() { return real; },
    /** "waiting", "run" or "done" while Real time is on, otherwise null */
    sessionState() { return real && session ? session.state : null; },
    /** the real-time loop: phase lengths and total in seconds (for checks) */
    realPlan() { return plan && { len: [...plan.len], start: [...plan.start], total: plan.total, hold: plan.hold }; },
    /** in real time, playing from waiting or done starts the session from the top */
    setPlaying(p) {
      if (p && real && session && session.state !== "run") restartSession();
      playing = p;
    },
    isPlaying() { return playing; },
    setSpeed(s) { speed = s; },
    setView,
    getView() { return { ...view }; },
    /** forearm rotation (degrees) and palm position of one arm (for checks) */
    armState(side) { const a = arms[side]; return { tw: (a.tw * a.sx) / D2R, palm: a.T.toArray(), elbow: a.E.toArray() }; },
    /** point the camera at one hand (for checks): azimuth and elevation in degrees, distance in metres */
    handCam(side, az, el, dist = 0.45) {
      const t = arms[side].T;
      controls.target.copy(t);
      camera.position.set(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R)).multiplyScalar(dist).add(t);
      controls.update();
    },
    setTheme(dark) {
      mats.prop.color.setHex(dark ? 0x4f5c68 : 0x8d99a5);
      mats.soft.color.setHex(dark ? 0x6b7a88 : 0x8d99a5);
      mats.weight.color.setHex(dark ? 0x222a31 : 0x3d4853);
      mats.floor.color.setHex(dark ? 0x9fb0bf : 0x7f8c99);
      mats.floor.opacity = dark ? 0.1 : 0.16;
      mats.shadow.opacity = dark ? 0.4 : 0.2;
    },
  };
}
