// The exercise scene: the full skeleton carrying the atlas muscles, simple props, and a keyframe player.
//
// Bones are rigid meshes hung on a joint hierarchy. Spine, head and legs use forward kinematics;
// arms are solved by two-bone IK so a hand can be pinned to the head, the chest or a point in the room.
// Muscles are skinned to the bones they attach to, so they lengthen and shorten with the movement.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { geometry } from "./model.js";
import { MOVES, BASES, SEAT } from "./moves.js";

const D2R = Math.PI / 180, CM = 0.01;
const V3 = THREE.Vector3;
const LAYER_COLOUR = { 1: 0xb44a40, 2: 0xa23c38, 3: 0x8f3436, 4: 0x7c2d35 };
const TARGET = 0x14b3a6;
const DIM = new THREE.Color(0x6f5a5c);

const PARENT = {
  pelvis: null, l5: "pelvis", l4: "l5", l3: "l4", l2: "l3", l1: "l2", thorax: "l1",
  c7: "thorax", c6: "c7", c5: "c6", c4: "c5", c3: "c4", c2: "c3", c1: "c2", head: "c1",
  clavL: "thorax", clavR: "thorax", scapL: "thorax", scapR: "thorax",
  femL: "pelvis", tibL: "femL", footL: "tibL", femR: "pelvis", tibR: "femR", footR: "tibR",
  humL: null, ulnaL: null, radL: "ulnaL", humR: null, ulnaR: null, radR: "ulnaR",
};
const LUMBAR = ["l5", "l4", "l3", "l2", "l1"], LOWER_NECK = ["c7", "c6", "c5", "c4", "c3", "c2"];

const NUM = ["lum", "thor", "neck", "head", "shL", "shR", "hipL", "hipR"];
const ZERO = {
  root: { p: [0, 0.88, 0], r: [0, 0, 0] }, lum: [0, 0, 0], thor: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shL: [0, 0, 0], shR: [0, 0, 0], hipL: [0, 0], hipR: [0, 0], kneeL: 0, kneeR: 0, ankL: 0, ankR: 0,
};

const mirrorArm = (a) => ({ ...a, p: [-a.p[0], a.p[1], a.p[2]], pole: [-a.pole[0], a.pole[1], a.pole[2]] });
/** expand the "both sides" shorthands of one pose layer */
function expand(layer) {
  const o = { ...layer };
  if (o.aB) { o.aL = o.aL || o.aB; o.aR = o.aR || mirrorArm(o.aB); delete o.aB; }
  if (o.shB) { o.shL = o.shL || o.shB; o.shR = o.shR || o.shB; delete o.shB; }
  if (o.hipB) { o.hipL = o.hipL || o.hipB; o.hipR = o.hipR || o.hipB; delete o.hipB; }
  if (o.kneeB !== undefined) { o.kneeL = o.kneeL ?? o.kneeB; o.kneeR = o.kneeR ?? o.kneeB; delete o.kneeB; }
  if (o.ankB !== undefined) { o.ankL = o.ankL ?? o.ankB; o.ankR = o.ankR ?? o.ankB; delete o.ankB; }
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

  const muscles = [];
  for (const part of model.parts) {
    if (!part.ex || part.kind !== "bone") continue;
    const m = new THREE.Mesh(geometry(part, buffer, CM), mats.bone);
    m.castShadow = true;
    holder[part.joint].add(m);
  }
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(R.skin.map((n) => bone[n]));   // bind pose = rest pose
  for (const part of model.parts) {
    if (!part.ex || part.kind !== "muscle") continue;
    const layer = meta[part.id] ? meta[part.id].layer : 2;
    const mat = new THREE.MeshStandardMaterial({ color: LAYER_COLOUR[layer], roughness: 0.56, side: THREE.DoubleSide });
    const m = new THREE.SkinnedMesh(geometry(part, buffer, CM, true), mat);
    m.frustumCulled = false;
    m.castShadow = true;
    m.userData = { id: part.id, side: part.side, layer, base: new THREE.Color(LAYER_COLOUR[layer]) };
    scene.add(m);
    m.bind(skeleton);
    muscles.push(m);
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
    };
  }
  const frames = { chest: bone.thorax, head: bone.head, neck: bone.c7, pelvis: bone.pelvis, world: scene };

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
        dyn.push(() => g.position.copy(arms[side].T));
      }
    },
    bandFront: () => {
      box(0.04, 1.4, 0.04, [0, 0.7, 1.3]);
      const anchor = new V3(0, 1.22, 1.28);
      for (const side of ["L", "R"]) {
        const set = segment(mats.band, 0.007);
        dyn.push(() => set(anchor, arms[side].T));
      }
    },
    bandSide: () => {
      box(0.04, 1.3, 0.04, [-0.9, 0.65, 0.22]);
      const anchor = new V3(-0.88, 1.1, 0.22);
      const set = segment(mats.band, 0.007);
      dyn.push(() => set(anchor, arms.L.T));
    },
  };

  // ---------- player ----------
  let move = null, poses = [], time = 0, playing = true, speed = 1, autoView = null, glowT = 0;
  const view = { frame: "whole", angle: "best" };
  const targetMats = [];

  function paint(id, focus) {
    // light up the muscles this exercise works; ghost anything lying over the deepest of them
    // opened from one muscle's page, only that muscle lights up; otherwise everything the move works
    const ids = focus ? [focus] : Object.keys(meta).filter((m) => meta[m].exercises.includes(id));
    const onSide = (m) => !move.side || move.side === m.userData.side;
    let deepest = 0;
    for (const m of ids) deepest = Math.max(deepest, meta[m].layer);
    targetMats.length = 0;
    for (const m of muscles) {
      const { id: mid, layer, base } = m.userData;
      const mat = m.material;
      const isT = ids.includes(mid) && onSide(m);
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

  function load(id, focus) {
    move = MOVES[id];
    if (!move) return false;
    const base = { ...ZERO, ...expand(BASES[move.base]), ...expand(move.rest || {}) };
    poses = move.keys.map((k) => ({ ...base, ...expand(k) }));
    time = 0;
    dyn.length = 0;
    for (const c of [...props.children]) props.remove(c);
    for (const p of move.props) BUILD[p]();
    paint(id, focus);
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
  function armTarget(spec, out) {
    out.fromArray(spec.p);
    if (spec.f !== "world") frames[spec.f].localToWorld(out);
    return out;
  }

  function solveArm(side, A, B, u, shOff) {
    const a = arms[side], scap = bone["scap" + side], clav = bone["clav" + side];
    const thorQ = bone.thorax.getWorldQuaternion(q).clone();
    armTarget(A, v1); armTarget(B, v2);
    const T = a.T.lerpVectors(v1, v2, u);
    const pole = new V3().fromArray(lerpArr(A.pole, B.pole, u)).applyQuaternion(thorQ).normalize();
    const tw = ((A.tw || 0) + ((B.tw || 0) - (A.tw || 0)) * u) * D2R * a.sx;

    // where the palm sits relative to the elbow once the forearm has rotated
    const palmRel = a.palmFromP0.clone().applyAxisAngle(a.pronAxis, tw).add(a.p0FromE);
    const fore = palmRel.length(), fR = palmRel.normalize();

    scap.position.set(a.scapRest.x + shOff[0] * a.sx, a.scapRest.y + shOff[1], a.scapRest.z + shOff[2]);
    let upRot = 0, nrm, perp, L, cosA, sinA;
    for (let pass = 0; pass < 2; pass++) {
      scap.quaternion.setFromAxisAngle(a.nScap, upRot * a.sx);
      scap.updateMatrixWorld(true);
      a.S.copy(a.shLocal).applyMatrix4(scap.matrixWorld);
      const d = T.clone().sub(a.S);
      L = d.length();
      const maxL = a.upper + fore - 0.002, minL = Math.abs(a.upper - fore) + 0.03;
      if (L > maxL) { d.multiplyScalar(maxL / L); L = maxL; }
      if (L < minL) { d.multiplyScalar(minL / Math.max(L, 1e-6)); L = minL; }
      nrm = d.clone().normalize();
      cosA = (a.upper * a.upper + L * L - fore * fore) / (2 * a.upper * L);
      sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      perp = pole.clone().addScaledVector(nrm, -pole.dot(nrm));
      if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0).addScaledVector(nrm, nrm.y);
      perp.normalize();
      a.E.copy(a.S).addScaledVector(nrm, a.upper * cosA).addScaledVector(perp, a.upper * sinA);
      if (pass === 0) {
        // the shoulder blade turns upward by about a third of how far the arm is raised
        const down = new V3(0, -1, 0).applyQuaternion(thorQ);
        const elev = a.E.clone().sub(a.S).normalize().angleTo(down);
        upRot = THREE.MathUtils.clamp((elev - 30 * D2R) * 0.33, 0, 45 * D2R);
        if (upRot < 1e-4) break;
      }
    }
    T.copy(a.S).addScaledVector(nrm, L);   // the palm, after any clamping to arm's length

    // the collarbone pivots at the breastbone so its outer end follows the shoulder blade
    const acrom = a.acromLocal.clone().applyQuaternion(scap.quaternion).add(scap.position);
    clav.quaternion.setFromUnitVectors(a.clavRestDir, acrom.sub(a.clavPos).normalize());

    const hC = new V3().crossVectors(perp, nrm).normalize();
    const hum = bone["hum" + side], ulna = bone["ulna" + side];
    hum.position.copy(a.S);
    frameQuat(a.aR, a.hR, a.E.clone().sub(a.S).normalize(), hC, hum.quaternion);
    ulna.position.copy(a.E);
    frameQuat(fR, a.hR, T.clone().sub(a.E).normalize(), hC, ulna.quaternion);
    bone["rad" + side].quaternion.setFromAxisAngle(a.pronAxis, tw);
  }

  const setEuler = (b, e, k = 1) => b.rotation.set(e[0] * k * D2R, e[1] * k * D2R, e[2] * k * D2R);
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
      bone["tib" + side].rotation.x = (A["knee" + side] + (B["knee" + side] - A["knee" + side]) * u) * D2R;
      bone["foot" + side].rotation.x = (A["ank" + side] + (B["ank" + side] - A["ank" + side]) * u) * D2R;
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

  return {
    scene, camera, controls, load,
    resize(width, height) { camera.aspect = width / height; camera.updateProjectionMatrix(); },
    /** advance the animation; returns { step, label, working } for the instructions */
    update(dt) {
      controls.update();
      if (!move) return null;
      if (playing) time = (time + dt * speed) % move.dur;
      const f = time / move.dur;
      pose(f);
      const ph = phaseAt(f);
      glowT += dt;
      const glow = ph.w ? 0.3 + 0.22 * Math.sin(glowT * 3.2) : 0.1;
      for (const mat of targetMats) mat.emissive.copy(mat.color).multiplyScalar(glow);
      return { step: ph.step, label: ph.label || "", working: !!ph.w, f };
    },
    seek(f) { if (move) time = f * move.dur; },
    setPlaying(p) { playing = p; },
    isPlaying() { return playing; },
    setSpeed(s) { speed = s; },
    setView,
    getView() { return { ...view }; },
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
