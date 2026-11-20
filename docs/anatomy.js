// The anatomy scene: decodes the packed model, draws bones and muscles, and handles
// selection, layer peeling, picking, camera views and the vertebral level ruler.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { geometry } from "./model.js";
import { areaSpots } from "./areas.js";

const LAYER_COLOUR = { 1: 0xb44a40, 2: 0xa23c38, 3: 0x8f3436, 4: 0x7c2d35 };
const SELECT = [0x14b3a6, 0x35c9b6, 0x0f9a94, 0x5ad6c4, 0x0b8583];
const HEAT = [0xffb62e, 0xf79a2c, 0xee812b, 0xe36b2b, 0xd65a2c, 0xc94d2e];
const DIM = new THREE.Color(0x6f5a5c);
const BONE = 0xe7dec9;
const BONE_NAMES = {
  skull: "Skull", cervical: "Cervical spine (C1 to C7)", thoracic: "Thoracic spine (T1 to T12)", lumbar: "L1 vertebra",
  ribs: "Ribs", sternum: "Breastbone", scapula: "Shoulder blade", clavicle: "Collarbone", humerus: "Upper arm bone",
  lumbar: "Lumbar spine (L1 to L5)", pelvis: "Pelvis", forearm: "Forearm bones", hand: "Hand", femur: "Thigh bone", shin: "Shin bones", foot: "Foot", toes: "Toes",
};
const VIEW_DIR = {
  back: [0, 0.12, -1], front: [0, 0.1, 1], left: [1, 0.08, -0.18], right: [-1, 0.08, -0.18],
  frontLeft: [0.62, 0.1, 0.78], backLeft: [0.5, 0.2, -0.86], backHigh: [0, 0.45, -1],
};
const HOME_TARGET = new THREE.Vector3(0, -1.5, 1.5);
const HOME_RADIUS = 36;
const GLOW = 0xff7a1a;      // the "where it hurts" glow
const MAX_SPOTS = 48;
const GLOW_FADE = 0.15;     // seconds to fade in or out

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
  controls.maxDistance = 900;   // far enough to frame the whole body on a narrow phone stage
  controls.rotateSpeed = 0.9;
  controls.zoomToCursor = true;

  // ---- glow ----
  // Bone and muscle materials share one set of uniforms: up to MAX_SPOTS spheres, and how bright they are now.
  // A surface inside a sphere is tinted and lit towards the glow colour, fading out to its edge. With no spots
  // the shader loop ends at once, so idle frames cost nothing extra and no material ever recompiles.
  const glowU = {
    uGlowSpot: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector4()) },
    uGlowN: { value: 0 }, uGlow: { value: 0 }, uGlowCol: { value: new THREE.Color(GLOW) },
  };
  function glowable(mat) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, glowU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGlowPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvGlowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
uniform vec4 uGlowSpot[${MAX_SPOTS}];
uniform int uGlowN;
uniform float uGlow;
uniform vec3 uGlowCol;
varying vec3 vGlowPos;`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
float glowA = 0.0;
for (int i = 0; i < ${MAX_SPOTS}; i++) {
  if (i >= uGlowN) break;
  glowA = max(glowA, 1.0 - smoothstep(uGlowSpot[i].w * 0.4, uGlowSpot[i].w, distance(vGlowPos, uGlowSpot[i].xyz)));
}
glowA *= uGlow;
diffuseColor.rgb = mix(diffuseColor.rgb, uGlowCol, glowA * 0.55);
totalEmissiveRadiance += uGlowCol * glowA * 0.55;`);
    };
    mat.customProgramCacheKey = () => "glow";
    return mat;
  }
  // a faint soft halo per spot, drawn over everything, so an area on the far side still shows
  const haloTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.45, "rgba(255,255,255,0.45)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, color: GLOW, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
  const halos = Array.from({ length: MAX_SPOTS }, () => {
    const s = new THREE.Sprite(haloMat);
    s.visible = false; s.renderOrder = 10;
    scene.add(s);
    return s;
  });
  const glow = { on: false, fade: 0, t: 0, steady: false, freeze: null, key: null };
  function setSpots(spots) {
    spots = spots.slice(0, MAX_SPOTS);
    glowU.uGlowN.value = spots.length;
    halos.forEach((h, i) => {
      h.visible = i < spots.length;
      if (h.visible) { h.position.fromArray(spots[i]); h.scale.setScalar(spots[i][3] * 1.5); glowU.uGlowSpot.value[i].fromArray(spots[i]); }
    });
  }
  /** fade and pulse; returns true while the glow needs frames */
  function glowTick(dt) {
    if (!glow.on && glow.fade === 0) return false;
    glow.fade = THREE.MathUtils.clamp(glow.fade + (glow.on ? dt : -dt) / GLOW_FADE, 0, 1);
    glow.t = (glow.t + dt) % 1;
    // one slow swell a second between 65% and full, never off; steady at full for reduced motion
    const phase = glow.freeze === null ? glow.t : glow.freeze;
    const level = glow.fade * (glow.steady ? 1 : 0.65 + 0.35 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase)));
    glowU.uGlow.value = level;
    haloMat.opacity = 0.38 * level;
    if (glow.fade === 0) { setSpots([]); glow.key = null; }
    return true;
  }

  const boneMat = glowable(new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }));
  const muscles = [];   // meshes
  const bones = [];
  const byId = new Map();   // muscleId -> [meshes]
  let n = 0;
  function addPart(part, buf, region) {
    const geo = geometry(part, buf);
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
      const mat = glowable(new THREE.MeshStandardMaterial({ color: base, roughness: 0.56, metalness: 0, side: THREE.DoubleSide }));
      mesh = new THREE.Mesh(geo, mat);
      mesh.userData.base = base;
      mesh.userData.layer = layer;
      mesh.userData.region = region;
      muscles.push(mesh);
      if (!byId.has(part.id)) byId.set(part.id, []);
      byId.get(part.id).push(mesh);
    }
    mesh.userData.id = part.kind === "bone" ? part.name : part.id;
    mesh.userData.kind = part.kind;
    scene.add(mesh);
  }
  for (const part of model.parts) addPart(part, buffer, null);   // the skeleton
  const homeTarget = HOME_TARGET.clone();
  let homeRadius = HOME_RADIUS, active = null;   // active: Set of region ids on show, null = all

  // ---- state ----
  let selected = [];        // muscle ids, in rank order when ranked
  let ranked = false;
  let wide = false;         // frame the whole shown area rather than zooming to the selection
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
      m.visible = !peeled && (!active || active.has(m.userData.region));
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
  // The stage title sits over the top of the canvas and the controls over the bottom. The view window is
  // shifted so the orbit centre lands in the middle of the clear band between them, and fits are made to that band.
  const inset = { top: 0, bottom: 0 };
  function applyInsets() {
    if (w > 1 && h > 1) camera.setViewOffset(w, h, 0, (inset.bottom - inset.top) / 2, w, h);
    else camera.updateProjectionMatrix();
  }
  function fitDistance(radius) {
    const band = h - inset.top - inset.bottom;
    const free = band > h * 0.4 ? band / h : 1;
    const v = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * free);
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
    flyTo(sel ? sel.center : homeTarget.clone(), VIEW_DIR[name] || VIEW_DIR.back, sel ? sel.radius : homeRadius, ms);
  }
  function selectionSphere() {
    if (!selected.length) return null;
    const box = new THREE.Box3();
    for (const id of selected) for (const m of byId.get(id) || []) box.union(m.geometry.boundingBox);
    const s = box.getBoundingSphere(new THREE.Sphere());
    // a wide selection (a strength day) fills the stage with the muscles it lights, not with room around one muscle
    s.radius = Math.max(s.radius * (wide ? 1.08 : 1.5), 17);
    if (s.radius > homeRadius) { s.radius = homeRadius; s.center.copy(homeTarget); }
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
    const pts = ticks.map((t) => t.p.clone().project(camera));
    // only label levels when the spine is on screen and big enough to read: from the legs it is out of
    // frame, and on the whole body the ticks would sit on top of each other
    const span = pts.length > 1 ? Math.abs(pts.at(-1).y - pts[0].y) * 0.5 * h : 0;
    const spine = upright && span > h * 0.3;
    ticks.forEach((t, i) => {
      const v = pts[i];
      const y = (1 - v.y) * 0.5 * h;
      const show = spine && Math.abs(v.x) < 1 && v.z < 1 && y > Math.max(54, inset.top + 10) && y < h - Math.max(64, inset.bottom + 10);
      t.el.style.opacity = show ? "1" : "0";
      t.el.style.top = y + "px";
    });
  }

  apply();
  return {
    scene, camera, controls,
    resize(width, height) {
      const first = w === 1 && h === 1;
      w = width; h = height;
      camera.aspect = width / height;
      applyInsets();
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
      if (glowTick(dt)) dirty = true;
      const d = dirty;
      dirty = false;
      if (d) updateRuler();
      return d;
    },
    invalidate() { dirty = true; },
    cancelTween() { tween = null; },
    pick,
    hover(id) { if (id !== hoverId) { hoverId = id; apply(); } },
    /** light a pattern's `area` (null fades it out); steady = no pulse. The camera stays where it is. */
    glowArea(area, steady = false) {
      const key = area ? JSON.stringify(area) : null;
      glow.steady = steady;
      if (!area) { if (glow.on) { glow.on = false; dirty = true; } return; }
      if (key !== glow.key) { setSpots(areaSpots(area, model.rig)); glow.key = key; }
      if (!glow.on && glow.fade === 0) glow.t = 0.5;   // start bright
      glow.on = true;
      dirty = true;
    },
    /** for tests: pin the pulse at a phase (0.5 is the brightest), or null to let it run; reads the state */
    glowTest(phase) { if (phase !== undefined) glow.freeze = phase; return { on: glow.on, fade: glow.fade, level: glowU.uGlow.value, spots: glowU.uGlowN.value }; },
    /** select muscles; ranked=true colours them by position in the list; isWide keeps the camera on the whole area */
    select(ids, isRanked = false, view, isWide = false) {
      selected = ids.filter((id) => byId.has(id));
      ranked = isRanked;
      wide = isWide;
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
        flyTo(sel ? sel.center : homeTarget.clone(), dir, sel ? sel.radius : homeRadius);
      } else if (view !== null) setView(view);
      return depth;
    },
    /** add one region's muscles (the parts of a muscles-<region>.json file) */
    addMuscles(parts, buf, region) { for (const part of parts) addPart(part, buf, region); apply(); },
    /** show only these regions' muscles and frame the camera on them; null = all, framed on the whole body */
    setRegions(list, ms) {
      active = list ? new Set(list) : null;
      const box = new THREE.Box3();
      for (const m of muscles) if (!active || active.has(m.userData.region)) box.union(m.geometry.boundingBox);
      if (!active) for (const b of bones) box.union(b.geometry.boundingBox);
      if (!box.isEmpty()) {
        // fit the larger of the half height and the half width/depth, not the bounding sphere, which
        // overshoots on wide boxes and falls short on tall ones such as the legs or the whole body
        const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        box.getCenter(homeTarget);
        homeRadius = Math.max(half.y, half.x, half.z, 20) * 1.02;
      }
      depth = 1;
      apply();
      if (!selected.length) setView("back", ms);
    },
    setDepth(d) { depth = d; apply(); },
    /** pixels covered by overlays at the top and bottom of the canvas; framing keeps clear of them */
    setInsets(top, bottom) {
      if (top === inset.top && bottom === inset.bottom) return;
      inset.top = top; inset.bottom = bottom;
      applyInsets();
      dirty = true;
    },
    getDepth() { return depth; },
    setView,
    colourOf(id) { return "#" + new THREE.Color(colourFor(id)).getHexString(); },
    setRulerVisible(v) { rulerEl.style.display = v ? "" : "none"; },
  };
}

