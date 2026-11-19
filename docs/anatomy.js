// The anatomy scene: decodes the packed model, draws bones and muscles, and handles
// selection, layer peeling, picking, camera views and the vertebral level ruler.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { geometry } from "./model.js";

const LAYER_COLOUR = { 1: 0xb44a40, 2: 0xa23c38, 3: 0x8f3436, 4: 0x7c2d35 };
const SELECT = [0x14b3a6, 0x35c9b6, 0x0f9a94, 0x5ad6c4, 0x0b8583];
const HEAT = [0xffb62e, 0xf79a2c, 0xee812b, 0xe36b2b, 0xd65a2c, 0xc94d2e];
const DIM = new THREE.Color(0x6f5a5c);
const BONE = 0xe7dec9;
const BONE_NAMES = {
  skull: "Skull", cervical: "Cervical spine (C1 to C7)", thoracic: "Thoracic spine (T1 to T12)", lumbar: "L1 vertebra",
  ribs: "Ribs", sternum: "Breastbone", scapula: "Shoulder blade", clavicle: "Collarbone", humerus: "Upper arm bone",
};
const VIEW_DIR = {
  back: [0, 0.12, -1], front: [0, 0.1, 1], left: [1, 0.08, -0.18], right: [-1, 0.08, -0.18],
  frontLeft: [0.62, 0.1, 0.78], backLeft: [0.5, 0.2, -0.86], backHigh: [0, 0.45, -1],
};
const HOME_TARGET = new THREE.Vector3(0, -1.5, 1.5);
const HOME_RADIUS = 36;

/**
 * @param canvas    the shared canvas
 * @param model     parsed model.json
 * @param buffer    ArrayBuffer from unpack(model)
 * @param meta      { [muscleId]: { name, layer, view?, xray? } }
 * @param rulerEl   element that receives the vertebral level ticks
 */
export function createAnatomy(canvas, model, buffer, meta, rulerEl) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 1, 1000);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x59626b, 1.15));
  const key = new THREE.DirectionalLight(0xfff4e8, 1.9);
  key.position.set(-0.5, 0.7, 1);
  camera.add(key);
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.5);
  fill.position.set(0.9, -0.2, 0.6);
  camera.add(fill);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 22;
  controls.maxDistance = 300;
  controls.rotateSpeed = 0.9;
  controls.zoomToCursor = true;

  const boneMat = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const muscles = [];   // meshes
  const bones = [];
  const byId = new Map();   // muscleId -> [meshes]
  let n = 0;
  for (const part of model.parts) {
    if (!part.atlas) continue;   // the rest of the skeleton belongs to the exercise view
    const geo = geometry(part, buffer);
    let mesh;
    if (part.kind === "bone") {
      mesh = new THREE.Mesh(geo, boneMat);
      bones.push(mesh);
    } else {
      const layer = meta[part.id] ? meta[part.id].layer : 2;
      const base = new THREE.Color(LAYER_COLOUR[layer]);
      // small lightness shift per muscle so neighbours of the same layer separate
      if (part.side === "L") n++;
      base.offsetHSL(0, 0, ((n * 7) % 5 - 2) * 0.012);
      const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.56, metalness: 0, side: THREE.DoubleSide });
      mesh = new THREE.Mesh(geo, mat);
      mesh.userData.base = base;
      mesh.userData.layer = layer;
      muscles.push(mesh);
      if (!byId.has(part.id)) byId.set(part.id, []);
      byId.get(part.id).push(mesh);
    }
    mesh.userData.id = part.kind === "bone" ? part.name : part.id;
    mesh.userData.kind = part.kind;
    scene.add(mesh);
  }

  // ---- state ----
  let selected = [];        // muscle ids, in rank order when ranked
  let ranked = false;
  let hoverId = null;
  let depth = 1;
  let dirty = true;
  let tween = null;
  let w = 1, h = 1;

  function colourFor(id) {
    const i = selected.indexOf(id);
    const set = ranked ? HEAT : SELECT;
    return set[Math.min(i, set.length - 1)];
  }

  function apply() {
    const any = selected.length > 0;
    let deepest = 0;
    for (const id of selected) deepest = Math.max(deepest, meta[id].layer);
    let xray = false;
    for (const id of selected) if (meta[id].xray) xray = true;
    boneMat.transparent = xray;
    boneMat.opacity = xray ? 0.3 : 1;
    boneMat.depthWrite = !xray;
    boneMat.needsUpdate = true;

    for (const m of muscles) {
      const { id, layer, base } = m.userData;
      const mat = m.material;
      const isSel = selected.includes(id);
      const peeled = layer < depth && !isSel;
      m.visible = !peeled;
      m.userData.ghost = false;
      let opacity = 1;
      if (!any) {
        mat.color.copy(base);
        mat.emissive.setHex(0x000000);
      } else if (isSel) {
        mat.color.setHex(colourFor(id));
        mat.emissive.setHex(colourFor(id)).multiplyScalar(0.18);
        opacity = layer === deepest ? 1 : 0.55;
      } else if (layer > deepest) {
        mat.color.copy(base).lerp(DIM, 0.55);
        mat.emissive.setHex(0x000000);
      } else {
        mat.color.copy(base).lerp(DIM, 0.4);
        mat.emissive.setHex(0x000000);
        opacity = 0.1;
        m.userData.ghost = true;
      }
      if (id === hoverId) mat.emissive.add(new THREE.Color(isSel ? 0x0a3a36 : 0x4a1612));
      const t = opacity < 1;
      if (mat.transparent !== t) { mat.transparent = t; mat.needsUpdate = true; }
      mat.opacity = opacity;
      mat.depthWrite = !t;
      m.renderOrder = t ? (m.userData.ghost ? 3 : 2) : 0;
    }
    dirty = true;
  }

  // ---- camera ----
  function fitDistance(radius) {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(v) * camera.aspect);
    return (radius / Math.sin(Math.min(v, hHalf))) * 1.06;
  }
  function flyTo(target, dirArr, radius, ms = 650) {
    const dir = new THREE.Vector3().fromArray(dirArr).normalize();
    const dist = THREE.MathUtils.clamp(fitDistance(radius), controls.minDistance, controls.maxDistance);
    const to = target.clone().addScaledVector(dir, dist);
    if (ms === 0) {
      camera.position.copy(to); controls.target.copy(target); controls.update(); dirty = true; return;
    }
    // interpolate on a sphere around the target so the camera orbits instead of cutting through the model
    const fromOff = camera.position.clone().sub(controls.target);
    tween = {
      t: 0, ms, fromTarget: controls.target.clone(), toTarget: target.clone(),
      fromSph: new THREE.Spherical().setFromVector3(fromOff), toSph: new THREE.Spherical().setFromVector3(to.clone().sub(target)),
    };
    let d = tween.toSph.theta - tween.fromSph.theta;
    if (d > Math.PI) tween.toSph.theta -= 2 * Math.PI;
    if (d < -Math.PI) tween.toSph.theta += 2 * Math.PI;
  }
  function setView(name, ms) {
    const sel = selectionSphere();
    flyTo(sel ? sel.center : HOME_TARGET.clone(), VIEW_DIR[name] || VIEW_DIR.back, sel ? sel.radius : HOME_RADIUS, ms);
  }
  function selectionSphere() {
    if (!selected.length) return null;
    const box = new THREE.Box3();
    for (const id of selected) for (const m of byId.get(id) || []) box.union(m.geometry.boundingBox);
    const s = box.getBoundingSphere(new THREE.Sphere());
    s.radius = Math.max(s.radius * 1.5, 17);
    if (s.radius > HOME_RADIUS) { s.radius = HOME_RADIUS; s.center.copy(HOME_TARGET); }
    return s;
  }

  // ---- picking ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const solid = [], ghosts = [];
    for (const m of muscles) if (m.visible) (m.userData.ghost ? ghosts : solid).push(m);
    if (boneMat.opacity === 1) for (const b of bones) solid.push(b);
    let hit = ray.intersectObjects(solid, false)[0];
    if (!hit) hit = ray.intersectObjects(ghosts, false)[0];
    if (!hit) return null;
    const { id, kind } = hit.object.userData;
    return { id, kind, label: kind === "bone" ? BONE_NAMES[id] : meta[id].name };
  }

  // ---- ruler ----
  const ticks = (model.levels || []).map((lv) => {
    const el = document.createElement("span");
    el.textContent = lv.label;
    rulerEl.appendChild(el);
    return { el, p: new THREE.Vector3().fromArray(lv.p) };
  });
  const tmp = new THREE.Vector3();
  function updateRuler() {
    const off = tmp.copy(camera.position).sub(controls.target);
    const upright = Math.abs(off.y) / off.length() < 0.5;
    for (const t of ticks) {
      const v = t.p.clone().project(camera);
      const y = (1 - v.y) * 0.5 * h;
      const show = upright && y > 54 && y < h - 64;
      t.el.style.opacity = show ? "1" : "0";
      t.el.style.top = y + "px";
    }
  }

  apply();
  return {
    scene, camera, controls,
    resize(width, height) {
      const first = w === 1 && h === 1;
      w = width; h = height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (first) setView("back", 0);
      dirty = true;
    },
    /** advance tweens and damping; returns true when the scene needs drawing */
    tick(dt) {
      if (tween) {
        tween.t = Math.min(1, tween.t + (dt * 1000) / tween.ms);
        const u = tween.t * tween.t * (3 - 2 * tween.t);
        const s = new THREE.Spherical(
          THREE.MathUtils.lerp(tween.fromSph.radius, tween.toSph.radius, u),
          THREE.MathUtils.lerp(tween.fromSph.phi, tween.toSph.phi, u),
          THREE.MathUtils.lerp(tween.fromSph.theta, tween.toSph.theta, u));
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, u);
        camera.position.setFromSpherical(s).add(controls.target);
        if (tween.t >= 1) tween = null;
        dirty = true;
      }
      if (controls.update()) dirty = true;
      const d = dirty;
      dirty = false;
      if (d) updateRuler();
      return d;
    },
    invalidate() { dirty = true; },
    cancelTween() { tween = null; },
    pick,
    hover(id) { if (id !== hoverId) { hoverId = id; apply(); } },
    /** select muscles; ranked=true colours them by position in the list */
    select(ids, isRanked = false, view) {
      selected = ids.filter((id) => byId.has(id));
      ranked = isRanked;
      if (selected.length) {
        let shallow = 4;
        for (const id of selected) shallow = Math.min(shallow, meta[id].layer);
        if (depth > shallow) depth = shallow;
      }
      apply();
      if (view === "keep") {
        // keep the viewer's angle, recentre and zoom on the selection (or the whole model)
        const sel = selectionSphere();
        const dir = camera.position.clone().sub(controls.target).normalize().toArray();
        flyTo(sel ? sel.center : HOME_TARGET.clone(), dir, sel ? sel.radius : HOME_RADIUS);
      } else if (view !== null) setView(view);
      return depth;
    },
    setDepth(d) { depth = d; apply(); },
    getDepth() { return depth; },
    setView,
    colourOf(id) { return "#" + new THREE.Color(colourFor(id)).getHexString(); },
    setRulerVisible(v) { rulerEl.style.display = v ? "" : "none"; },
  };
}

