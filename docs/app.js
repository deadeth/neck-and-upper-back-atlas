// Page logic: panel views, navigation, and the wiring between the panel and the two 3D scenes.
// The panel renders from content.js alone, so it still works if WebGL or the model fails to load.
import { GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO, RED_FLAGS } from "./content.js";

const $ = (id) => document.getElementById(id);
const panel = $("panel"), stage = $("stage"), canvas = $("gl");
const LAYER_HEX = { 1: "#b44a40", 2: "#a23c38", 3: "#8f3436", 4: "#7c2d35" };
const HEAT_HEX = ["#e89a10", "#e2861c", "#da7422", "#d06226", "#c5532a", "#b9472c"];
const VIEW_HINT = { "sternocleidomastoid": "frontLeft", "scalenes": "frontLeft", "deep-neck-flexors": "front", "suboccipitals": "backHigh", "supraspinatus": "backHigh" };
const XRAY = new Set(["deep-neck-flexors"]);

const M = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
const Gp = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
const Pt = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ICON = {
  back: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 2.5 4 7l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.6 6z" fill="currentColor"/></svg>',
  pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" fill="currentColor"/></svg>',
};

// ---------- navigation ----------
const nav = [{ view: "home" }];
const cur = () => nav[nav.length - 1];
function go(view, id, extra = {}) {
  const top = cur();
  if (top.view === view && top.id === id) return;
  nav.push({ view, id, ...extra });
  render();
}
function back() {
  if (nav.length > 1) nav.pop();
  render();
}
function home() {
  nav.length = 1;
  render();
}

// ---------- panel views ----------
const sec = (title, body) => `<section class="sec"><h3>${title}</h3>${body}</section>`;
const backBtn = (label) => `<button class="back" data-act="back">${ICON.back}${esc(label)}</button>`;
const muscleRow = (m) => `<li><button class="row" data-go="muscle" data-id="${m.id}"><span class="dot" style="background:${LAYER_HEX[m.layer]}"></span><span class="n">${esc(m.name)}</span><span class="l">${esc(m.latin)}</span></button></li>`;
const exCard = (id) => {
  const e = EXERCISE_INFO[id];
  return `<li><button class="ex" data-go="exercise" data-id="${id}"><span class="play">${ICON.play}</span><span><span class="n">${esc(e.name)}</span><span class="d">${esc(e.dose)}</span></span><span class="pill">${esc(e.type)}</span></button></li>`;
};
function backLabel() {
  const prev = nav[nav.length - 2];
  if (!prev || prev.view === "home") return "All muscles";
  if (prev.view === "muscle") return M[prev.id].name;
  if (prev.view === "group") return Gp[prev.id].name;
  if (prev.view === "pattern") return Pt[prev.id].name;
  if (prev.view === "exercise") return EXERCISE_INFO[prev.id].name;
  return "Back";
}

function viewHome() {
  const chips = (kind) => PATTERNS.filter((p) => p.kind === kind).map((p) => `<button class="chip" data-go="pattern" data-id="${p.id}">${esc(p.name)}</button>`).join("");
  const groups = GROUPS.map((g) => {
    const ms = MUSCLES.filter((m) => m.group === g.id);
    return `<div class="group"><button class="group-btn" data-go="group" data-id="${g.id}"><span>${esc(g.name)}</span><span>Show group</span></button><ul>${ms.map(muscleRow).join("")}</ul></div>`;
  }).join("");
  return `<div class="pad">
    <div class="head"><p class="lede">Click a muscle on the model, or start from the pain. Each muscle comes with a quick check and two or three exercises you can watch in 3D.</p></div>
    ${sec("Where it hurts", `<div class="chips">${chips("where")}</div>`)}
    ${sec("When it hurts", `<div class="chips">${chips("when")}</div>`)}
    ${sec("Muscles", `<div class="stack">${groups}</div>`)}
    ${flags()}
    <p class="fine">This atlas covers muscular sources of neck and upper back pain. It can't examine you, and joints, discs and nerves cause neck pain too.</p>
    <p class="fine">Anatomy meshes: BodyParts3D, © The Database Center for Life Science, licensed under <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en">CC BY-SA 2.1 Japan</a>. Meshes were cropped, simplified and rigged for this page, and the adapted model is shared under the same licence.</p>
  </div>`;
}
function flags() {
  return `<section class="flags"><h3>See a GP or physio first if you have</h3><ul>${RED_FLAGS.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></section>`;
}

function viewPattern(p) {
  const rows = p.muscles.map((x, i) => `<li><button class="rank" data-go="muscle" data-id="${x.id}"><span class="num" style="background:${HEAT_HEX[Math.min(i, HEAT_HEX.length - 1)]}">${i + 1}</span><span><span class="n">${esc(M[x.id].name)}</span><span class="w">${esc(x.why)}</span></span></button></li>`).join("");
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head"><span class="eyebrow">${p.kind === "where" ? "Where it hurts" : "When it hurts"}</span><h2 class="title">${esc(p.name)}</h2></div>
    <p class="${p.id === "into-arm" ? "note" : "lede"}">${esc(p.note)}</p>
    ${sec("Likely muscles, most likely first", `<ol class="stack">${rows}</ol>`)}
    <p class="fine">Brighter on the model means more likely. Open a muscle and try its quick check to confirm.</p>
  </div>`;
}

function viewGroup(g) {
  const ms = MUSCLES.filter((m) => m.group === g.id);
  const ex = [...new Set(ms.flatMap((m) => m.exercises))];
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head"><span class="eyebrow">Muscle group</span><h2 class="title">${esc(g.name)}</h2></div>
    <p class="lede">${esc(g.blurb)}</p>
    ${sec("Muscles in this group", `<ul>${ms.map(muscleRow).join("")}</ul>`)}
    ${sec("Exercises for the group", `<ul class="stack">${ex.map(exCard).join("")}</ul>`)}
  </div>`;
}

function viewMuscle(m) {
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head">
      <button class="eyebrow" data-go="group" data-id="${m.group}">${esc(Gp[m.group].name)}</button>
      <h2 class="title">${esc(m.name)}</h2>
      <p class="latin">${esc(m.latin)}</p>
    </div>
    ${sec("How it hurts", `<p>${esc(m.pain)}</p>`)}
    ${sec("What sets it off", `<p>${esc(m.triggers)}</p>`)}
    ${sec("Quick check", `<p>${esc(m.check)}</p>`)}
    ${sec("Exercises", `<ul class="stack">${m.exercises.map(exCard).join("")}</ul>`)}
    ${sec("What it does", `<p>${esc(m.does)}</p>`)}
    <dl class="facts"><dt>Attaches</dt><dd>${esc(m.attach)}</dd><dt>Nerve</dt><dd>${esc(m.nerve)}</dd></dl>
  </div>`;
}

function viewExercise(id) {
  const e = EXERCISE_INFO[id];
  const targets = MUSCLES.filter((m) => m.exercises.includes(id));
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head"><span class="eyebrow">${esc(e.type)} exercise</span><h2 class="title">${esc(e.name)}</h2></div>
    <div class="meta"><span><b>Dose</b> ${esc(e.dose)}</span><span><b>Kit</b> ${esc(e.kit)}</span></div>
    ${sec("How to do it", `<ol class="steps" id="steps">${e.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>`)}
    ${sec("What you should feel", `<p>${esc(e.feel)}</p>`)}
    ${sec("Get it right", `<p>${esc(e.ease)}</p>`)}
    ${sec("Works on", `<div class="chips">${targets.map((m) => `<button class="chip" data-go="muscle" data-id="${m.id}">${esc(m.name)}</button>`).join("")}</div>`)}
    <p class="fine">The skeleton shows one side, with the working muscle in teal. Repeat stretches on the other side. Mild stretch or effort is fine; sharp pain, tingling or dizziness means stop.</p>
  </div>`;
}

// ---------- scenes ----------
let THREE = null, renderer = null, anatomy = null, figure = null;
let mode = "anatomy", lastStep = -1, lastLabel = null;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function setPressed(container, attr, value) {
  for (const b of container.querySelectorAll(`[data-${attr}]`)) b.setAttribute("aria-pressed", String(b.dataset[attr] === String(value)));
}

function render() {
  const s = cur();
  const html = s.view === "home" ? viewHome() : s.view === "pattern" ? viewPattern(Pt[s.id]) : s.view === "group" ? viewGroup(Gp[s.id]) : s.view === "muscle" ? viewMuscle(M[s.id]) : viewExercise(s.id);
  panel.innerHTML = html;
  panel.scrollTop = 0;
  syncStage();
}

function syncStage() {
  const s = cur();
  const wantFigure = s.view === "exercise" && figure;
  mode = wantFigure ? "figure" : "anatomy";
  $("tools-anatomy").hidden = mode !== "anatomy" || !anatomy;
  $("tools-figure").hidden = mode !== "figure";
  $("tip").classList.remove("on");
  $("stage-msg").hidden = mode === "figure";
  if (anatomy) { anatomy.controls.enabled = mode === "anatomy"; anatomy.setRulerVisible(mode === "anatomy"); anatomy.invalidate(); }
  if (figure) figure.controls.enabled = mode === "figure";

  if (mode === "figure") {
    const e = EXERCISE_INFO[s.id];
    $("stage-title").textContent = e.name;
    $("stage-sub").textContent = e.dose;
    // opened from a muscle's page: that muscle gets the strongest highlight
    const prev = nav[nav.length - 2];
    const focus = prev && prev.view === "muscle" && M[prev.id].exercises.includes(s.id) ? prev.id : null;
    if (figure.loaded !== s.id + ":" + focus) {
      figure.load(s.id, focus);
      figure.loaded = s.id + ":" + focus;
      figure.setPlaying(!reduced);
      syncViewButtons();
    }
    lastStep = -1; lastLabel = null;
    updatePlayBtn();
    return;
  }
  $("phase").textContent = "";
  let title = "", sub = "Drag to rotate, scroll to zoom, click a muscle";
  let ids = [], ranked = false;
  if (s.view === "pattern") { ids = Pt[s.id].muscles.map((x) => x.id); ranked = true; title = Pt[s.id].name; sub = "Likely muscles, brightest first"; }
  else if (s.view === "group") { ids = MUSCLES.filter((m) => m.group === s.id).map((m) => m.id); title = Gp[s.id].name; sub = ids.length + " muscles"; }
  else if (s.view === "muscle") { ids = [s.id]; title = M[s.id].name; sub = M[s.id].latin; }
  else if (s.view === "exercise") title = EXERCISE_INFO[s.id].name;
  $("stage-title").textContent = title;
  $("stage-sub").textContent = anatomy ? sub : "";
  $("clear-wrap").hidden = ids.length === 0;
  if (anatomy) {
    const key = s.view + ":" + (s.id || "");
    if (anatomy.shown !== key) {
      anatomy.shown = key;
      // a muscle clicked on the model is already in view, so keep the angle; from the panel, turn to its best side
      const view = !ids.length || s.from === "model" ? "keep" : (ids.length === 1 && VIEW_HINT[ids[0]]) || "back";
      const d = anatomy.select(ids, ranked, view);
      setPressed($("tools-anatomy"), "depth", d);
      if (view !== "keep") setPressed($("tools-anatomy"), "view", view);
    }
  }
}

function syncViewButtons() {
  const v = figure.getView();
  setPressed($("tools-figure"), "fframe", v.frame);
  setPressed($("tools-figure"), "fangle", v.angle);
}

function updatePlayBtn() {
  const b = $("btn-play");
  const on = figure && figure.isPlaying();
  b.innerHTML = (on ? ICON.pause : ICON.play) + (on ? "Pause" : "Play");
  b.setAttribute("aria-label", on ? "Pause" : "Play");
}

function updateSteps(info) {
  if (!info) return;
  if (info.step !== lastStep) {
    lastStep = info.step;
    const list = document.getElementById("steps");
    if (list) [...list.children].forEach((li, i) => li.classList.toggle("on", i === info.step));
    const e = EXERCISE_INFO[cur().id];
    $("cap-n").textContent = info.step + 1;
    $("cap-t").textContent = e.steps[info.step];
  }
  if (info.label !== lastLabel) { lastLabel = info.label; $("phase").textContent = info.label; }
}

// ---------- events ----------
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.go) return go(d.go, d.id);
  if (d.act === "back") return back();
  if (d.act === "clear") return home();
  if (d.act === "to-model") {
    // return to the muscle (or wherever) the exercise was opened from
    while (nav.length > 1 && cur().view === "exercise") nav.pop();
    return render();
  }
  if (d.act === "play" && figure) { figure.setPlaying(!figure.isPlaying()); return updatePlayBtn(); }
  if (d.speed && figure) { figure.setSpeed(Number(d.speed)); return setPressed($("tools-figure"), "speed", d.speed); }
  if ((d.fframe || d.fangle) && figure) { figure.setView(d.fframe, d.fangle); return syncViewButtons(); }
  if (d.view && anatomy) { anatomy.setView(d.view); return setPressed($("tools-anatomy"), "view", d.view); }
  if (d.depth && anatomy) { anatomy.setDepth(Number(d.depth)); return setPressed($("tools-anatomy"), "depth", d.depth); }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && nav.length > 1) back();
});

let down = null;
canvas.addEventListener("pointerdown", (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; if (anatomy) anatomy.cancelTween(); });
canvas.addEventListener("pointerup", (ev) => {
  if (!down || mode !== "anatomy" || !anatomy) return;
  const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
  const quick = performance.now() - down.t < 600;
  down = null;
  if (moved > 6 || !quick) return;
  const hit = anatomy.pick(ev.clientX, ev.clientY);
  if (hit && hit.kind === "muscle") go("muscle", hit.id, { from: "model" });
});
let hoverQueued = null;
canvas.addEventListener("pointermove", (ev) => {
  if (mode !== "anatomy" || !anatomy || ev.pointerType !== "mouse" || ev.buttons) return;
  hoverQueued = { x: ev.clientX, y: ev.clientY };
});
canvas.addEventListener("pointerleave", () => { hoverQueued = null; $("tip").classList.remove("on"); if (anatomy) anatomy.hover(null); canvas.style.cursor = ""; });
function doHover() {
  if (!hoverQueued) return;
  const { x, y } = hoverQueued;
  hoverQueued = null;
  const hit = anatomy.pick(x, y);
  const tip = $("tip");
  anatomy.hover(hit && hit.kind === "muscle" ? hit.id : null);
  canvas.style.cursor = hit && hit.kind === "muscle" ? "pointer" : "";
  if (hit) {
    const r = stage.getBoundingClientRect();
    tip.textContent = hit.label;
    tip.style.left = Math.min(x - r.left, r.width - 190) + "px";
    tip.style.top = y - r.top + "px";
    tip.classList.add("on");
  } else tip.classList.remove("on");
}

// ---------- boot ----------
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
function fail(msg) {
  $("stage-msg").innerHTML = `<div>${esc(msg)}</div>`;
  $("tools-anatomy").hidden = true;
}

async function boot() {
  render();   // panel first: it needs nothing but content.js
  let mods;
  try {
    mods = await Promise.all([import("three"), import("./anatomy.js"), import("./figure.js"), import("./model.js")]);
  } catch (e) {
    return fail("The 3D viewer couldn't load. The muscle notes and exercise steps in the panel still work.");
  }
  THREE = mods[0];
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return fail("This browser can't show 3D graphics. The muscle notes and exercise steps in the panel still work.");
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  $("stage-msg").innerHTML = "<div>Loading the 3D model…</div>";
  try {
    const res = await fetch("./model.json");
    if (!res.ok) throw new Error("model fetch failed");
    const model = await res.json();
    const buffer = mods[3].unpack(model);
    const meta = Object.fromEntries(MUSCLES.map((m) => [m.id, { name: m.name, layer: m.layer, exercises: m.exercises, view: VIEW_HINT[m.id], xray: XRAY.has(m.id) }]));
    anatomy = mods[1].createAnatomy(canvas, model, buffer, meta, $("ruler"));
    figure = mods[2].createFigure(canvas, model, buffer, meta);
    figure.setTheme(isDark());
    $("stage-msg").innerHTML = "";
  } catch (e) {
    console.error(e);
    return fail("The 3D model couldn't load. The muscle notes and exercise steps in the panel still work.");
  }

  if (anatomy) anatomy.controls.addEventListener("start", () => setPressed($("tools-anatomy"), "view", ""));
  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);
  resize();
  syncStage();
  const themeWatch = () => figure && figure.setTheme(isDark());
  new MutationObserver(themeWatch).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeWatch);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === "figure") {
      updateSteps(figure.update(dt));
      renderer.render(figure.scene, figure.camera);
    } else if (anatomy) {
      doHover();
      if (anatomy.tick(dt)) renderer.render(anatomy.scene, anatomy.camera);
    }
  }
  requestAnimationFrame(frame);

  // hooks for automated checks
  window.__atlas = {
    go, home, nav, anatomy, figure, render, moves: mods[2].MOVE_IDS,
    /** draw one exercise at a point in its loop and return the frame as a data URL */
    snap(id, f, view) {
      nav.length = 1; nav.push({ view: "exercise", id }); render();
      if (view) { const [fr, an] = view.split("/"); figure.setView(fr || undefined, an || undefined); }
      figure.setPlaying(false); figure.seek(f); updateSteps(figure.update(0));
      renderer.render(figure.scene, figure.camera);
      return canvas.toDataURL("image/jpeg", 0.8);
    },
    /** the same, with the camera on one hand */
    snapHand(id, f, side, az, el, dist) {
      nav.length = 1; nav.push({ view: "exercise", id }); render();
      figure.setPlaying(false); figure.seek(f); updateSteps(figure.update(0));
      figure.handCam(side, az, el, dist); figure.update(0);
      renderer.render(figure.scene, figure.camera);
      return canvas.toDataURL("image/jpeg", 0.8);
    },
    drawNow() { if (mode === "anatomy" && anatomy) { anatomy.tick(1); anatomy.invalidate(); anatomy.tick(0); renderer.render(anatomy.scene, anatomy.camera); } },
  };
}

function resize() {
  if (!renderer) return;
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  if (anatomy) anatomy.resize(w, h);
  if (figure) figure.resize(w, h);
}

boot();
