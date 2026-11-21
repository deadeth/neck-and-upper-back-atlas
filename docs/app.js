// Page logic: two ways in (pain and stretch, region by region; strength, by training day), the panel views,
// navigation, lazy loading of each region's muscles, and the wiring between the panel and the two 3D scenes.
// The panel renders from content.js alone, so it still works if WebGL or a download fails.
import { REGIONS, STRENGTH, GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO, RED_FLAGS } from "./content.js";
import { STRENGTH_NOTE } from "./content-body.js";
import { buildIndex, search, KIND_LABEL } from "./search.js";

const $ = (id) => document.getElementById(id);
const panel = $("panel"), stage = $("stage"), canvas = $("gl");
const LAYER_HEX = { 1: "#b44a40", 2: "#a23c38", 3: "#8f3436", 4: "#7c2d35" };
const HEAT_HEX = ["#e89a10", "#e2861c", "#da7422", "#d06226", "#c5532a", "#b9472c"];
// The side of the model that shows a muscle best when it's picked from the panel. Anything not listed is seen from behind.
const VIEW_HINT = {
  "sternocleidomastoid": "frontLeft", "scalenes": "frontLeft", "deep-neck-flexors": "front", "suboccipitals": "backHigh", "supraspinatus": "backHigh",
  "rectus-abdominis": "front", "external-oblique": "frontLeft", "internal-oblique": "frontLeft", "transversus-abdominis": "frontLeft", "iliopsoas": "front",
  "pectoralis-major": "front", "pectoralis-minor": "front", "serratus-anterior": "left", "subscapularis": "front", "coracobrachialis": "front",
  "deltoid-anterior": "frontLeft", "deltoid-middle": "left", "biceps-brachii": "frontLeft", "brachialis": "frontLeft", "brachioradialis": "frontLeft", "forearm-flexors": "front",
  "tensor-fasciae-latae": "frontLeft", "adductors": "front",
  "masseter": "frontLeft", "temporalis": "left", "medial-pterygoid": "left", "lateral-pterygoid": "left", "digastric": "frontBelow", "frontalis": "front",
  "rectus-femoris": "front", "vasti": "frontLeft", "sartorius": "frontLeft", "tibialis-anterior": "frontLeft", "fibulares": "left",
};
// deep muscles hidden behind bone from every side: the bones turn see-through when these are selected
const XRAY = new Set(["deep-neck-flexors", "iliopsoas", "subscapularis", "medial-pterygoid", "lateral-pterygoid"]);
const REGION_VIEW = { shoulder: "front", leg: "front", head: "front" };   // camera side when a region opens; default from behind
const DAY_VIEW = { pull: "back", push: "front", legs: "back" };   // the side a day's main muscles sit on
const PATTERN_VIEW = { head: "frontLeft" };   // a pain pattern's side when most of its muscles aren't on the front; default from behind
const MOVE_HINT = "Drag to rotate, scroll to zoom, click a muscle";

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const M = byId(MUSCLES), Gp = byId(GROUPS), Pt = byId(PATTERNS), R = byId(REGIONS), D = byId(STRENGTH);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uniq = (a) => [...new Set(a)];
const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ICON = {
  back: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 2.5 4 7l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.6 6z" fill="currentColor"/></svg>',
  pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" fill="currentColor"/></svg>',
  next: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5.5 2.5 10 7l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---------- content helpers ----------
// a lift is anything on a strength day: the new lifts, plus the neck exercises and plank the days reuse
const DAY_EX = new Set(STRENGTH.flatMap((d) => d.exercises));
const isLift = (id) => EXERCISE_INFO[id].mode === "strength" || DAY_EX.has(id);
/** the muscles an exercise works: its own targets when it names them; otherwise the muscles that prescribe it */
function worksOn(id) {
  const e = EXERCISE_INFO[id];
  if (e.targets) {
    const main = (e.targets || []).filter((m) => M[m]);
    return { main, also: (e.also || []).filter((m) => M[m] && !main.includes(m)) };
  }
  return { main: MUSCLES.filter((m) => m.exercises.includes(id)).map((m) => m.id), also: [] };
}
/** strength lifts that train a muscle, main movers first */
function liftsFor(mid) {
  const lifts = Object.keys(EXERCISE_INFO).filter(isLift);
  const main = lifts.filter((id) => worksOn(id).main.includes(mid));
  return [...main.map((id) => ({ id, helper: false })), ...lifts.filter((id) => worksOn(id).also.includes(mid)).map((id) => ({ id, helper: true }))];
}
function dayMuscles(day) {
  const main = uniq(day.exercises.flatMap((id) => worksOn(id).main));
  return { main, also: uniq(day.exercises.flatMap((id) => worksOn(id).also)).filter((m) => !main.includes(m)) };
}
const regionsOf = (ids) => uniq(ids.filter((id) => M[id]).map((id) => M[id].region));
// every region with a muscle that strength mode shows, and the head so the whole body has a face; loaded up front
const STRENGTH_REGIONS = uniq([...regionsOf(STRENGTH.flatMap((d) => { const x = dayMuscles(d); return [...x.main, ...x.also]; })), "head"]);

// ---------- navigation ----------
// Each mode keeps its own back stack, so switching mode and back returns you where you were.
// In pain mode every entry carries the region it belongs to, so Back also restores the region.
let mode = "pain";
const navs = { pain: [{ view: "home", region: "neck" }], strength: [{ view: "home" }] };   // the landing region
const nav = () => navs[mode];
const cur = () => nav()[nav().length - 1];
function regionFor(view, id) {
  if (view === "muscle") return M[id].region;
  if (view === "group") return Gp[id].region;
  if (view === "pattern") return Pt[id].region;
  return cur().region;
}
function go(view, id, extra = {}) {
  if (view === "day" && mode !== "strength") setMode("strength", false);   // days only exist in strength mode
  const top = cur();
  if (top.view === view && top.id === id) return;
  nav().push({ view, id, region: regionFor(view, id), ...extra });
  render();
}
function back() {
  // an entry opened from search in the other mode carries `ret`: Back pops it and returns to that mode
  const ret = cur().ret;
  if (nav().length > 1) nav().pop();
  if (ret) setMode(ret, false);
  render();
}
function home() {
  // back to the home of the region in view, which may not be the one you started in
  const region = cur().region;
  nav().length = 1;
  if (mode === "pain") nav()[0].region = region;
  render();
}
function setMode(m, draw = true) {
  if (m !== "pain" && m !== "strength") return;
  mode = m;
  setPressed(document.querySelector(".modes"), "mode", m);
  if (draw) render();
}
function setRegion(id) {
  if (!R[id]) return;
  if (mode !== "pain") setMode("pain", false);
  navs.pain = [{ view: "home", region: id }];
  render();
}

// ---------- panel views ----------
const sec = (title, body) => `<section class="sec"><h3>${title}</h3>${body}</section>`;
const backBtn = (label) => `<button class="back" data-act="back">${ICON.back}${esc(label)}</button>`;
const muscleRow = (m) => `<li><button class="row" data-go="muscle" data-id="${m.id}"><span class="dot" style="background:${LAYER_HEX[m.layer]}"></span><span class="n">${esc(m.name)}</span><span class="l">${esc(m.latin)}</span></button></li>`;
const chipList = (ids, cls = "chip") => `<div class="chips">${ids.map((id) => `<button class="${cls}" data-go="muscle" data-id="${id}">${esc(M[id].name)}</button>`).join("")}</div>`;
const exCard = (id, pill) => {
  const e = EXERCISE_INFO[id];
  return `<li><button class="ex" data-go="exercise" data-id="${id}"><span class="play">${ICON.play}</span><span><span class="n">${esc(e.name)}</span><span class="d">${esc(e.dose)}</span></span><span class="pill">${esc(pill || e.type)}</span></button></li>`;
};
const exList = (ids) => `<ul class="stack">${ids.map((id) => exCard(id)).join("")}</ul>`;
const liftList = (lifts) => `<ul class="stack">${lifts.map((l) => exCard(l.id, l.helper ? "Helper" : null)).join("")}</ul>`;
const NOT_READY = `<p class="note">Pain notes and stretches for this region are still being written.</p>`;
const NO_STRETCHES = `<p class="note">Stretches for this region are still being made. Until then, each muscle lists the lifts that train it.</p>`;
const noStretches = (r) => r.ready && r.stretches === false;
const facts = (m) => `<dl class="facts"><dt>Attaches</dt><dd>${esc(m.attach)}</dd><dt>Nerve</dt><dd>${esc(m.nerve)}</dd></dl>`;

function backLabel() {
  const ret = cur().ret;
  const prev = ret ? navs[ret][navs[ret].length - 1] : nav()[nav().length - 2];
  if (!prev) return "Back";
  if (prev.view === "home") return (ret || mode) === "pain" ? R[prev.region].name : "Strength days";
  if (prev.view === "muscle") return M[prev.id].name;
  if (prev.view === "group") return Gp[prev.id].name;
  if (prev.view === "pattern") return Pt[prev.id].name;
  if (prev.view === "day") return `${D[prev.id].name} day`;
  if (prev.view === "exercise") return EXERCISE_INFO[prev.id].name;
  return "Back";
}

function groupBlock(g) {
  const ms = MUSCLES.filter((m) => m.group === g.id);
  return `<div class="group"><button class="group-btn" data-go="group" data-id="${g.id}"><span>${esc(g.name)}</span><span>Show group</span></button><ul>${ms.map(muscleRow).join("")}</ul></div>`;
}
function regionPicker(current) {
  const b = (r) => `<button class="region" data-region="${r.id}" aria-pressed="${r.id === current}">${esc(r.name)}</button>`;
  return `<nav class="regions" aria-label="Body region">${REGIONS.map(b).join("")}</nav>`;
}
function flags(r) {
  const list = r.flags || RED_FLAGS;
  return `<section class="flags"><h3>See a GP or physio first if you have</h3><ul>${list.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></section>`;
}
const CREDIT = `<p class="fine">Anatomy meshes: BodyParts3D, © The Database Center for Life Science, licensed under <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en">CC BY-SA 2.1 Japan</a>. Meshes were cropped, simplified and rigged for this page, and the adapted model is shared under the same licence.</p>`;

function viewPainHome(r) {
  const pats = PATTERNS.filter((p) => p.region === r.id);
  const chips = (kind) => pats.filter((p) => p.kind === kind).map((p) => `<button class="chip" data-go="pattern" data-id="${p.id}">${esc(p.name)}</button>`).join("");
  const finder = ["where", "when"].map((k) => chips(k) && sec(k === "where" ? "Where it hurts" : "When it hurts", `<div class="chips">${chips(k)}</div>`)).join("");
  const groups = GROUPS.filter((g) => g.region === r.id).map(groupBlock).join("");
  return `<div class="pad">
    ${nav().length > 1 ? backBtn(backLabel()) : ""}
    ${regionPicker(r.id)}
    <div class="head"><span class="eyebrow">Pain and stretch</span><h2 class="title">${esc(r.name)}</h2></div>
    ${noStretches(r)
      ? `<p class="lede">Click a muscle on the model, or start from the pain. Each muscle comes with a quick check.</p>${NO_STRETCHES}`
      : r.ready
      ? `<p class="lede">Click a muscle on the model, or start from the pain. Each muscle comes with a quick check and exercises you can watch in 3D.</p>`
      : NOT_READY}
    ${r.ready ? finder : ""}
    ${sec("Muscles", `<div class="stack">${groups}</div>`)}
    ${r.ready ? flags(r) : ""}
    <p class="fine">This atlas covers muscular sources of pain. It can't examine you, and joints, discs and nerves cause pain too.</p>
    ${CREDIT}
  </div>`;
}

function viewStrengthHome() {
  const card = (d) => {
    const { main } = dayMuscles(d);
    return `<li><button class="day" data-go="day" data-id="${d.id}">
      <span class="day-top"><span class="day-n">${esc(d.name)}</span><span class="day-m">${count(d.exercises.length, "lift")}, ${count(main.length, "muscle")}</span></span>
      <span class="d">${esc(d.blurb)}</span>
      <span class="go">${ICON.next}</span></button></li>`;
  };
  return `<div class="pad">
    <div class="head"><span class="eyebrow">Strength</span><h2 class="title">Three training days</h2></div>
    <p class="lede">Between them, the three days train the whole body. Pick a day to see the muscles it works and its lifts.</p>
    <ul class="stack">${STRENGTH.map(card).join("")}</ul>
    <p class="note">${esc(STRENGTH_NOTE)}</p>
    <p class="fine">Click a muscle on the model to see the lifts that train it.</p>
    ${CREDIT}
  </div>`;
}

function viewDay(d) {
  const { main, also } = dayMuscles(d);
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head"><span class="eyebrow">Strength day</span><h2 class="title">${esc(d.name)}</h2></div>
    <p class="lede">${esc(d.blurb)}</p>
    ${sec("Muscles it trains", chipList(main))}
    ${also.length ? sec("Also works", chipList(also, "chip minor")) : ""}
    ${sec("Lifts", exList(d.exercises))}
    <p class="fine">Pick a weight you can control for every rep. Sharp pain, tingling or dizziness means stop.</p>
  </div>`;
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
  const ex = uniq(ms.flatMap((m) => m.exercises));
  const lifts = uniq(ms.flatMap((m) => liftsFor(m.id).filter((l) => !l.helper).map((l) => l.id)));
  const exSec = ex.length ? sec("Exercises for the group", exList(ex)) : "";
  const liftSec = lifts.length ? sec("Strength lifts for the group", exList(lifts)) : "";
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head"><span class="eyebrow">Muscle group</span><h2 class="title">${esc(g.name)}</h2></div>
    <p class="lede">${esc(g.blurb)}</p>
    ${mode === "pain" && !R[g.region].ready ? NOT_READY : ""}
    ${sec("Muscles in this group", `<ul>${ms.map(muscleRow).join("")}</ul>`)}
    ${mode === "strength" ? liftSec + exSec : exSec + liftSec}
  </div>`;
}

function viewMuscle(m) {
  // a lift the muscle already prescribes (shrug for the upper trapezius) is listed once: as a lift in
  // strength mode, as an exercise in pain mode
  const all = liftsFor(m.id);
  const lifts = mode === "strength" ? all : all.filter((l) => !m.exercises.includes(l.id));
  const rest = mode === "strength" ? m.exercises.filter((id) => !all.some((l) => l.id === id)) : m.exercises;
  const head = `<div class="head">
      <button class="eyebrow" data-go="group" data-id="${m.group}">${esc(Gp[m.group].name)}</button>
      <h2 class="title">${esc(m.name)}</h2>
      <p class="latin">${esc(m.latin)}</p>
    </div>`;
  const liftSec = sec("Strength lifts that train it", lifts.length ? liftList(lifts) : `<p class="muted">None of the lifts in the three days work it directly.</p>`);
  const does = sec("What it does", `<p>${esc(m.does)}</p>`);
  const hasNotes = R[m.region].ready && m.pain;
  if (mode === "strength") {
    return `<div class="pad">${backBtn(backLabel())}${head}${does}${liftSec}
      ${rest.length ? sec("Stretches and control work", exList(rest)) : ""}
      ${facts(m)}
      ${hasNotes ? `<button class="link" data-act="pain-notes" data-id="${m.id}">Sore? How it hurts and what helps${ICON.next}</button>` : ""}
    </div>`;
  }
  if (!hasNotes) {
    const note = R[m.region].ready ? `<p class="note">Pain notes for this muscle are still being written.</p>` : NOT_READY;
    return `<div class="pad">${backBtn(backLabel())}${head}${note}${does}${liftSec}${m.exercises.length ? sec("Exercises", exList(m.exercises)) : ""}${facts(m)}</div>`;
  }
  return `<div class="pad">
    ${backBtn(backLabel())}
    ${head}
    ${sec("How it hurts", `<p>${esc(m.pain)}</p>`)}
    ${sec("What sets it off", `<p>${esc(m.triggers)}</p>`)}
    ${sec("Quick check", `<p>${esc(m.check)}</p>`)}
    ${m.exercises.length ? sec("Exercises", exList(m.exercises)) : ""}
    ${lifts.length || noStretches(R[m.region]) ? liftSec : ""}
    ${does}
    ${facts(m)}
  </div>`;
}

function viewExercise(id) {
  const e = EXERCISE_INFO[id];
  const { main, also } = worksOn(id);
  const lift = isLift(id);
  const works = lift
    ? sec("Muscles it trains", chipList(main)) + (also.length ? sec("Helpers", chipList(also, "chip minor")) : "")
    : sec("Works on", chipList(main));
  return `<div class="pad">
    ${backBtn(backLabel())}
    <div class="head"><span class="eyebrow">${lift ? "Strength lift" : `${esc(e.type)} exercise`}</span><h2 class="title">${esc(e.name)}</h2></div>
    <div class="meta"><span><b>Dose</b> ${esc(e.dose)}</span><span><b>Kit</b> ${esc(e.kit)}</span></div>
    ${sec("How to do it", `<ol class="steps" id="steps">${e.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>`)}
    ${sec("What you should feel", `<p>${esc(e.feel)}</p>`)}
    ${sec("Get it right", `<p>${esc(e.ease)}</p>`)}
    ${works}
    <p class="fine">${lift
      ? "The muscles doing the work are lit in teal. Pick a weight you can control for every rep. Sharp pain, tingling or dizziness means stop."
      : "The skeleton shows one side, with the working muscle in teal. Repeat stretches on the other side. Mild stretch or effort is fine; sharp pain, tingling or dizziness means stop."}</p>
  </div>`;
}

function viewFor(s) {
  if (s.view === "home") return mode === "pain" ? viewPainHome(R[s.region]) : viewStrengthHome();
  if (s.view === "day") return viewDay(D[s.id]);
  if (s.view === "pattern") return viewPattern(Pt[s.id]);
  if (s.view === "group") return viewGroup(Gp[s.id]);
  if (s.view === "muscle") return viewMuscle(M[s.id]);
  return viewExercise(s.id);
}

// ---------- region loading ----------
let THREE = null, renderer = null, anatomy = null, figure = null, unpack = null, MOVES = {}, failed = false;
const loaded = new Set(), loading = new Map();   // region id -> promise

/** fetch a region's muscle file once and add its muscles to both scenes */
function loadRegion(r) {
  if (!loading.has(r)) {
    const p = (async () => {
      const res = await fetch(`./muscles-${r}.json`);
      if (!res.ok) throw new Error(`muscles-${r}.json: ${res.status}`);
      const doc = await res.json(), buf = unpack(doc);
      anatomy.addMuscles(doc.parts, buf, r);
      figure.addMuscles(doc.parts, buf, r);
      loaded.add(r);
    })();
    p.catch(() => loading.delete(r));   // let a later visit try again
    loading.set(r, p);
  }
  return loading.get(r);
}
const ensure = (list) => Promise.all(list.map(loadRegion));

// ---------- stage ----------
let scene = "anatomy", lastStep = -1, lastLabel = null, syncToken = 0;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Real time: holds last their stated time and the dose is counted, set by set, so you can follow along.
// Remembered between exercises and visits; storage can throw (private browsing, blocked cookies), so it is optional.
const REAL_KEY = "atlas.realTime";
let realTime = false, lastCount = null, lastSess = null, capOverride = false, goPlan = "";
try { realTime = localStorage.getItem(REAL_KEY) === "1"; } catch (e) { /* not remembered */ }
// Rest between sets: the user's own choice for every exercise, or null for each exercise's setRest in timing.js.
const SETREST_KEY = "atlas.setRest", SETREST_CHOICES = [60, 90, 120, 180];
let setRest = null;
try { const v = Number(localStorage.getItem(SETREST_KEY)); setRest = SETREST_CHOICES.includes(v) ? v : null; } catch (e) { /* not remembered */ }
/** the "Rest between sets" pickers: under the big Start while waiting or done, and beside the countdown in a rest between sets */
function showRestPick(s) {
  const multi = !!(s && s.setRestBase);
  for (const sel of document.querySelectorAll("select[data-rest-pick]")) {
    if (multi) sel.options[0].textContent = `Default (${s.setRestBase} s)`;
    if (document.activeElement !== sel) sel.value = setRest ? String(setRest) : "";
  }
  $("go-rest").classList.toggle("on", multi && (s.state === "waiting" || s.state === "done") && scene === "figure");
  for (const el of document.querySelectorAll(".rest-pick.in-rest")) el.hidden = !(multi && s.rest && s.rest.kind === "set");
}
function applyRealTime() {
  if (figure) { figure.setRealTime(realTime); figure.setSetRest(setRest); }
  for (const b of document.querySelectorAll('[data-act="real"]')) b.setAttribute("aria-pressed", String(realTime));
  for (const b of $("tools-figure").querySelectorAll("[data-speed]")) b.disabled = realTime;   // speed is for the demonstration only
  if (!realTime) showSession(null);
  updatePlayBtn();
}
const COUNT_LABEL = { hold: "Hold", rest: "Rest", set: "Rest", side: "Change sides" };
/** the countdown for a hold (3 s or more) or a rest: whole seconds left, and a bar that shrinks */
function showCount(c) {
  const show = !!c && (c.kind !== "hold" || c.total >= 3);
  const n = show ? Math.ceil(c.left) : null, key = show ? c.kind + n : null;
  if (key !== lastCount) {
    lastCount = key;
    const resting = show && c.kind !== "hold";
    for (const el of [$("cap-count"), $("head-count")]) {
      el.hidden = !show;
      el.classList.toggle("rest", resting);
      el.querySelector(".count-n").textContent = show ? n : "";
      el.querySelector(".count-k").textContent = show ? COUNT_LABEL[c.kind] : "";
    }
    $("caption").classList.toggle("holding", show);
    $("caption").classList.toggle("resting", resting);
    stage.classList.toggle("rt-count", show);   // on a phone the countdown stands in for the phase pill
    $("caption").querySelector(".count-bar").hidden = !show;
    for (const b of document.querySelectorAll('[data-act="skip-rest"]')) b.hidden = !resting;
  }
  if (show && !reduced) for (const bar of document.querySelectorAll(".count-bar i")) bar.style.transform = `scaleX(${(c.left / c.total).toFixed(4)})`;
}
/** the whole dose in words: "2 sets of 8", "3 holds each side", "5, 3 and 1 each side" */
function doseSummary(s, withRest = true) {
  const p = s.plan;
  if (!p) return "";
  const w = s.unit === "hold" ? "hold" : "rep";
  const t = p.some((n) => n !== p[0]) ? `${p.slice(0, -1).join(", ")} and ${p.at(-1)}` : p.length > 1 ? `${p.length} sets of ${p[0]}` : count(p[0], w);
  return t + (s.sides > 1 ? " each side" : "") + (withRest && s.setRest ? `, ${s.setRest} s rest` : "");
}
/** the session read-outs: rep and set (the tally), the countdown, and the caption during rests and at the end */
function showSession(info) {
  const s = info && info.session;
  if (!s) { showCount(info && info.hold ? { ...info.hold, kind: "hold" } : null); }
  else showCount(s.rest ? s.rest : info.hold ? { ...info.hold, kind: "hold" } : null);
  let k = "", n = "", sub = "", cap = "";
  if (s) goPlan = doseSummary(s) || "Count as you go";
  if (s) {
    const unit = s.unit === "hold" ? "Hold" : "Rep", next = s.reps ? `${unit.toLowerCase()} ${s.rep} of ${s.reps}` : `${unit.toLowerCase()} ${s.rep}`;
    if (s.state === "waiting") { k = "Ready"; n = doseSummary(s, false) || "Count as you go"; sub = "Press Start"; }
    else if (s.state === "done") { k = "Done"; n = doseSummary(s, false); cap = `Done: ${doseSummary(s)}. Press Start again for another round.`; }
    else {
      k = unit; n = s.reps ? `${s.rep} of ${s.reps}` : String(s.rep);
      sub = [s.sets > 1 ? `Set ${s.set} of ${s.sets}` : "", s.sides > 1 ? (s.side === 1 ? "First side" : "Other side") : ""].filter(Boolean).join(" · ");
      if (s.rest && s.rest.kind === "side") sub = [s.sets > 1 ? `Set ${s.set} of ${s.sets}` : "", "Other side: mirror the model"].filter(Boolean).join(" · ");
      if (s.rest) cap = s.rest.kind === "side" ? "Change sides. Do the same on your other side, mirroring the model."
        : s.rest.kind === "set" ? `Rest before set ${s.set} of ${s.sets}.` : `Rest, then ${next}. Let the stretch go.`;
    }
  }
  const key = s ? [k, n, sub, s.state, s.rest ? s.rest.kind : "", s.setRest].join("|") : null;
  if (key !== lastSess) {
    lastSess = key;
    showRestPick(s);
    for (const el of [$("tally"), $("head-tally")]) {
      el.hidden = !s;
      el.querySelector(".tally-k").textContent = k;
      el.querySelector(".tally-n").textContent = n;
      el.querySelector(".tally-s").textContent = sub;
    }
    updatePlayBtn();
  }
  // during a rest and at the end the caption says so instead of showing a step
  if (cap) {
    if ($("cap-t").textContent !== cap) { $("cap-n").textContent = ""; $("cap-t").textContent = cap; }
    capOverride = true;
  } else if (capOverride) {
    capOverride = false;
    lastStep = -1;   // the next update writes the step back
  }
}

function setPressed(container, attr, value) {
  if (!container) return;
  for (const b of container.querySelectorAll(`[data-${attr}]`)) b.setAttribute("aria-pressed", String(b.dataset[attr] === String(value)));
}
function stageMsg(text, loadingNow = false) {
  const el = $("stage-msg");
  el.classList.toggle("loading", loadingNow);
  el.innerHTML = text ? `<div>${esc(text)}</div>` : "";
}

/** the camera side for a set of muscles: from the front when most of them are on the front of the body */
function sideFor(ids, fallback) {
  if (ids.length === 1) return VIEW_HINT[ids[0]] || "back";
  const front = ids.filter((id) => /^front/.test(VIEW_HINT[id] || "")).length;
  return ids.length && front * 2 > ids.length ? "front" : fallback;
}
/** the muscles to light on the exercise figure: just the muscle you came from, or all the main ones */
function figureTargets(s) {
  const { main, also } = worksOn(s.id);
  const prev = nav()[nav().length - 2];
  if (prev && prev.view === "muscle" && (main.includes(prev.id) || also.includes(prev.id))) return [prev.id];
  return main;
}

/**
 * What the stage shows for a nav entry: `show` is the regions whose muscles are visible (null = whole body),
 * `need` the regions that must be loaded first, `ids` the muscles to select.
 */
function stageSpec(s) {
  const strength = mode === "strength";
  const base = strength ? null : [s.region];
  let ids = [], ranked = false, title = "", sub = MOVE_HINT, view, fig = null, wide = false;
  const fallback = strength ? "front" : REGION_VIEW[s.region] || "back";
  if (s.view === "home") { title = strength ? "Whole body" : R[s.region].name; view = fallback; }
  else if (s.view === "pattern") { ids = Pt[s.id].muscles.map((x) => x.id); ranked = true; title = Pt[s.id].name; sub = "Likely muscles, brightest first"; view = sideFor(ids, PATTERN_VIEW[s.region] || "back"); }
  else if (s.view === "group") { ids = MUSCLES.filter((m) => m.group === s.id).map((m) => m.id); title = Gp[s.id].name; sub = count(ids.length, "muscle"); view = sideFor(ids, fallback); }
  else if (s.view === "muscle") { ids = [s.id]; title = M[s.id].name; sub = M[s.id].latin; view = sideFor(ids); }
  else if (s.view === "day") { ids = dayMuscles(D[s.id]).main; title = `${D[s.id].name} day`; sub = `Trains ${count(ids.length, "muscle")}`; view = DAY_VIEW[s.id] || "back"; wide = true; }
  else if (s.view === "exercise") {
    const w = worksOn(s.id);
    fig = figureTargets(s);
    ids = [...w.main, ...w.also];
    title = EXERCISE_INFO[s.id].name;
    sub = "No animation for this one yet. The steps are in the panel.";
    view = sideFor(w.main, fallback);
  }
  const show = base && uniq([...base, ...regionsOf(ids)]);
  const need = uniq([...(show || STRENGTH_REGIONS), ...regionsOf(ids)]);
  return { ids, ranked, title, sub, view, show, need, fig, wide };
}

function setScene(next) {
  scene = next;
  $("tools-anatomy").hidden = scene !== "anatomy";
  $("tools-figure").hidden = scene !== "figure";
  anatomy.controls.enabled = scene === "anatomy";
  anatomy.setRulerVisible(scene === "anatomy");
  anatomy.invalidate();
  figure.controls.enabled = scene === "figure";
  if (scene === "anatomy") $("phase").textContent = "";
  if (scene !== "figure") { showSession(null); $("btn-go").classList.remove("on"); $("go-rest").classList.remove("on"); }
  $("btn-real-head").parentElement.hidden = scene !== "figure";   // the phone's copy of the toggle sits outside the tools
}

/** tell the atlas how much of the canvas the title and the controls cover, so framing keeps clear of them */
function measureInsets() {
  if (!anatomy || scene !== "anatomy") return;
  const st = stage.getBoundingClientRect();
  const title = $("stage-title").parentElement.getBoundingClientRect();
  const tools = $("tools-anatomy").getBoundingClientRect();
  anatomy.setInsets(Math.round(title.bottom - st.top + 6), Math.round(st.bottom - tools.top + 6));
}

// ---------- where it hurts: light the area ----------
// Pointing at, focusing or pressing a "Where it hurts" chip lights that part of the body on the atlas. Touch has no
// hover, but a finger on the chip raises pointerover until it lifts (or scrolls away), so the same events cover it.
let glowHover = null, glowFocus = null;
function glowSync() {
  const id = glowHover || glowFocus;
  if (anatomy) anatomy.glowArea(id && scene === "anatomy" ? Pt[id].area : null, reduced);
}
function glowOff() { glowHover = glowFocus = null; glowSync(); }
const whereChip = (el) => {
  const b = el instanceof Element ? el.closest('.chip[data-go="pattern"]') : null;
  return b && Pt[b.dataset.id] && Pt[b.dataset.id].kind === "where" && Pt[b.dataset.id].area ? b : null;
};
panel.addEventListener("pointerover", (ev) => { const b = whereChip(ev.target); if (b) { glowHover = b.dataset.id; glowSync(); } });
panel.addEventListener("pointerout", (ev) => { const b = whereChip(ev.target); if (b && !b.contains(ev.relatedTarget)) { glowHover = null; glowSync(); } });
panel.addEventListener("focusin", (ev) => { const b = whereChip(ev.target); glowFocus = b && b.matches(":focus-visible") ? b.dataset.id : null; glowSync(); });
panel.addEventListener("focusout", (ev) => { if (whereChip(ev.target)) { glowFocus = null; glowSync(); } });

function render() {
  glowOff();   // the chips are about to go
  panel.innerHTML = viewFor(cur());
  panel.scrollTop = 0;
  syncStage();
}

function syncStage() {
  const s = cur(), spec = stageSpec(s), token = ++syncToken;
  $("tip").classList.remove("on");
  $("stage-title").textContent = spec.title;
  if (!anatomy) { $("stage-sub").textContent = ""; return; }   // no 3D: the panel carries on alone
  if (figure && !(s.view === "exercise" && MOVES[s.id])) figure.loaded = null;   // leaving an exercise ends its session
  const missing = spec.need.filter((r) => !loaded.has(r));
  if (missing.length) {
    // keep the last picture up with a note over it; draw the new view once the muscles arrive
    $("stage-sub").textContent = "";
    stageMsg(missing.length === 1 ? `Loading ${R[missing[0]].name.toLowerCase()}…` : "Loading muscles…", true);
    ensure(missing).then(
      () => { if (token === syncToken) syncStage(); },
      (e) => { console.warn(e); if (token === syncToken) stageMsg("These muscles couldn't load. The notes in the panel still work."); },
    );
    return;
  }
  if (!failed) stageMsg(null);

  if (s.view === "exercise" && MOVES[s.id]) {
    setScene("figure");
    $("stage-sub").textContent = EXERCISE_INFO[s.id].dose;
    const key = s.id + ":" + spec.fig.join(",");
    if (figure.loaded !== key) {
      figure.load(s.id, spec.fig);
      figure.loaded = key;
      figure.setPlaying(!reduced && !realTime);   // a real-time session waits for Start
      syncViewButtons();
    }
    lastStep = -1; lastLabel = null;
    updatePlayBtn();
    return;
  }
  // everything else, including an exercise with no animation yet, shows its muscles on the atlas
  setScene("anatomy");
  figure.loaded = null;
  $("stage-sub").textContent = spec.sub;
  $("clear-wrap").hidden = spec.ids.length === 0;
  measureInsets();
  const regionKey = spec.show ? spec.show.slice().sort().join(",") : "*";
  const regionChanged = anatomy.regionKey !== regionKey;
  if (regionChanged) {
    anatomy.setRegions(spec.show, anatomy.regionKey === undefined ? 0 : undefined);
    anatomy.regionKey = regionKey;
  }
  const key = mode + "|" + s.view + ":" + (s.id || "");
  if (regionChanged || anatomy.shown !== key) {
    anatomy.shown = key;
    // a muscle clicked on the model is already in view, so keep the angle; going back to a list keeps it too
    const keep = s.from === "model" || (!spec.ids.length && !regionChanged);
    const view = keep ? "keep" : spec.view;
    const d = anatomy.select(spec.ids, spec.ranked, view, spec.wide);
    setPressed($("tools-anatomy"), "depth", d);
    setPressed($("tools-anatomy"), "view", keep ? "" : view);
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
  const st = realTime && figure && figure.sessionState();
  const label = st === "waiting" ? "Start" : st === "done" ? "Start again" : on ? "Pause" : st === "run" ? "Resume" : "Play";
  b.innerHTML = (on ? ICON.pause : ICON.play) + label;
  b.setAttribute("aria-label", label);
  const ready = st === "waiting" || st === "done";
  b.classList.toggle("solid", ready || (st === "run" && !on));   // a paused session shows its Play just as plainly
  // the big Start over the model: a real-time session waits for it, so the player never looks stuck
  const go = $("btn-go");
  go.classList.toggle("on", ready && scene === "figure");
  if (ready) {
    go.setAttribute("aria-label", `${label}: ${goPlan}`);
    go.querySelector(".go-t").textContent = label;
    go.querySelector(".go-plan").textContent = goPlan;
  }
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
  showSession(info);
}

// ---------- search ----------
const INDEX = buildIndex({ REGIONS, STRENGTH, GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO });
const SEARCH_CAP = 8;
const sBox = $("search"), sInput = $("search-input"), sPop = $("search-pop"), sList = $("search-list"), sNone = $("search-none"), sClear = $("search-clear");
let hits = [], hitActive = -1, hitAll = false;

/** the region an exercise belongs to: that of the first muscle it works */
function exRegion(id) {
  const m = worksOn(id).main.find((x) => M[x]);
  return m ? M[m].region : cur().region;
}
/**
 * Open a search result on top of where you are, so Back returns there. Pain patterns and regions open in
 * pain mode, lifts and days in strength mode, everything else in the current mode. A jump to the other mode
 * marks the new entry with `ret`, and Back from it comes home to the mode you searched from.
 */
function openResult(kind, id) {
  const from = mode;
  const want = kind === "pattern" || kind === "region" ? "pain" : kind === "lift" || kind === "day" ? "strength" : mode;
  if (want !== mode) setMode(want, false);
  const view = kind === "lift" ? "exercise" : kind === "region" ? "home" : kind;
  const region = kind === "region" ? id : view === "exercise" ? exRegion(id) : regionFor(view, id);
  const top = cur();
  const same = top.view === view && (view === "home" ? top.region === region : top.id === id);
  if (!same) nav().push({ view, ...(view === "home" ? {} : { id }), region, ...(want !== from ? { ret: from } : {}) });
  render();
}

function fitSearch() {
  // keep the list above an on-screen keyboard: the visual viewport shrinks when one opens
  const vv = window.visualViewport;
  const bottom = vv ? vv.offsetTop + vv.height : innerHeight;
  const room = bottom - sPop.getBoundingClientRect().top - 10;
  sPop.style.setProperty("--search-max", Math.round(Math.max(140, Math.min(560, room))) + "px");
}
function setActive(i) {
  const opts = sList.children;
  hitActive = opts.length ? (i + opts.length) % opts.length : -1;
  [...opts].forEach((o, k) => o.setAttribute("aria-selected", String(k === hitActive)));
  if (hitActive >= 0) { sInput.setAttribute("aria-activedescendant", opts[hitActive].id); opts[hitActive].scrollIntoView({ block: "nearest" }); }
  else sInput.removeAttribute("aria-activedescendant");
}
function renderSearch(keep = -1) {
  const q = sInput.value;
  sBox.classList.toggle("has-value", q.length > 0);
  sClear.hidden = !q;
  hits = q.trim() ? search(INDEX, q) : [];
  const list = hitAll ? hits : hits.slice(0, SEARCH_CAP);
  const sub = (h) => [h.entry.sub && esc(h.entry.sub), h.matched && `matches: <i>${esc(h.matched)}</i>`].filter(Boolean).join(" · ");
  sList.innerHTML = list.map((h, i) => `<li role="option" class="hit" id="hit-${i}" data-hit="${i}" aria-selected="false"><span><span class="n">${esc(h.entry.name)}</span>${sub(h) ? `<span class="d">${sub(h)}</span>` : ""}</span><span class="pill">${KIND_LABEL[h.entry.kind]}</span></li>`).join("")
    + (hits.length > list.length ? `<li role="option" class="hit more" id="hit-more" data-more="1" aria-selected="false">Show all ${hits.length} results</li>` : "");
  const open = !!q.trim() && document.activeElement === sInput;
  sPop.hidden = !open;
  sList.hidden = !hits.length;
  sNone.hidden = !!hits.length;
  sInput.setAttribute("aria-expanded", String(open && hits.length > 0));
  setActive(hits.length ? Math.max(0, Math.min(keep, sList.children.length - 1)) : -1);
  if (open) fitSearch();
}
function chooseHit(i) {
  const li = sList.children[i];
  if (!li) return;
  if (li.dataset.more) { hitAll = true; return renderSearch(i); }
  const h = hits[Number(li.dataset.hit)];
  sInput.value = ""; hitAll = false;
  sInput.blur();   // closes the list and, on a phone, the keyboard
  renderSearch();
  openResult(h.entry.kind, h.entry.id);
}
sInput.addEventListener("input", () => { hitAll = false; renderSearch(0); });
sInput.addEventListener("focus", () => renderSearch(0));
sInput.addEventListener("blur", () => { sPop.hidden = true; sInput.setAttribute("aria-expanded", "false"); });
sInput.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    ev.preventDefault();
    if (sPop.hidden) return renderSearch(0);
    return setActive(hitActive + (ev.key === "ArrowDown" ? 1 : -1));
  }
  if (ev.key === "Enter") { ev.preventDefault(); if (hitActive >= 0) chooseHit(hitActive); return; }
  if (ev.key === "Escape") {
    ev.stopPropagation();   // not the page's Escape, which goes back
    if (sInput.value) { sInput.value = ""; hitAll = false; renderSearch(); } else sInput.blur();
  }
});
// keep focus in the field while a result or the clear button is pressed
sPop.addEventListener("pointerdown", (ev) => ev.preventDefault());
sClear.addEventListener("pointerdown", (ev) => ev.preventDefault());
sPop.addEventListener("click", (ev) => { const li = ev.target.closest("[role=option]"); if (li) chooseHit([...sList.children].indexOf(li)); });
sClear.addEventListener("click", () => { sInput.value = ""; hitAll = false; sInput.focus(); renderSearch(); });
if (window.visualViewport) for (const t of ["resize", "scroll"]) visualViewport.addEventListener(t, () => { if (!sPop.hidden) fitSearch(); });
const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// ---------- events ----------
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.go) return go(d.go, d.id);
  if (d.mode) return mode === d.mode ? undefined : setMode(d.mode);
  if (d.region) return setRegion(d.region);
  if (d.act === "back") return back();
  if (d.act === "clear") return home();
  if (d.act === "pain-notes") {
    // from a muscle in strength mode to the same muscle in pain mode, on top of whatever pain mode had open
    setMode("pain", false);
    navs.pain.push({ view: "muscle", id: d.id, region: M[d.id].region });
    return render();
  }
  if (d.act === "to-model") {
    // return to the muscle (or wherever) the exercise was opened from
    while (nav().length > 1 && cur().view === "exercise") nav().pop();
    return render();
  }
  if (d.act === "play" && figure) { figure.setPlaying(!figure.isPlaying()); return updatePlayBtn(); }
  if (d.act === "real" && figure) {
    realTime = !realTime;
    try { localStorage.setItem(REAL_KEY, realTime ? "1" : "0"); } catch (e) { /* not remembered */ }
    applyRealTime();
    if (!realTime && cur().view === "exercise") figure.setPlaying(!reduced);   // back to the ordinary loop
    return updatePlayBtn();
  }
  if (d.act === "skip-rest" && figure) { figure.skipRest(); return; }
  if (d.speed && figure) { figure.setSpeed(Number(d.speed)); return setPressed($("tools-figure"), "speed", d.speed); }
  if ((d.fframe || d.fangle) && figure) { figure.setView(d.fframe, d.fangle); return syncViewButtons(); }
  if (d.view && anatomy) { anatomy.setView(d.view); return setPressed($("tools-anatomy"), "view", d.view); }
  if (d.depth && anatomy) { anatomy.setDepth(Number(d.depth)); return setPressed($("tools-anatomy"), "depth", d.depth); }
});
document.addEventListener("change", (ev) => {
  if (!ev.target.matches("select[data-rest-pick]")) return;
  setRest = Number(ev.target.value) || null;
  try { localStorage.setItem(SETREST_KEY, setRest ? String(setRest) : ""); } catch (e) { /* not remembered */ }
  if (figure) figure.setSetRest(setRest);   // a rest between sets that is running takes the new length now
  lastSess = null;   // redraw the plan, the pickers and the done line on the next frame
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "/" && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !typing(ev.target)) { ev.preventDefault(); sInput.focus(); sInput.select(); return; }
  if (ev.key === "Escape") { glowOff(); if (nav().length > 1) back(); }
});

let down = null;
canvas.addEventListener("pointerdown", (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; if (anatomy) anatomy.cancelTween(); });
canvas.addEventListener("pointerup", (ev) => {
  if (!down || scene !== "anatomy" || !anatomy) return;
  const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
  const quick = performance.now() - down.t < 600;
  down = null;
  if (moved > 6 || !quick) return;
  const hit = anatomy.pick(ev.clientX, ev.clientY);
  if (hit && hit.kind === "muscle") go("muscle", hit.id, { from: "model" });
});
let hoverQueued = null;
canvas.addEventListener("pointermove", (ev) => {
  if (scene !== "anatomy" || !anatomy || ev.pointerType !== "mouse" || ev.buttons) return;
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
  failed = true;
  anatomy = null;
  stageMsg(msg);
  $("tools-anatomy").hidden = true;
  $("tools-figure").hidden = true;
  $("stage-sub").textContent = "";
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

  stageMsg("Loading the 3D model…", true);
  try {
    // only the skeleton up front; each region's muscles follow when a view first needs them
    const res = await fetch("./model.json");
    if (!res.ok) throw new Error("model fetch failed");
    const model = await res.json();
    unpack = mods[3].unpack;
    const buffer = unpack(model);
    const meta = Object.fromEntries(MUSCLES.map((m) => [m.id, { name: m.name, layer: m.layer, region: m.region, exercises: m.exercises, view: VIEW_HINT[m.id], xray: XRAY.has(m.id) }]));
    anatomy = mods[1].createAnatomy(canvas, model, buffer, meta, $("ruler"));
    figure = mods[2].createFigure(canvas, model, buffer, meta);
    MOVES = mods[2].MOVE_IDS;
    figure.setTheme(isDark());
    applyRealTime();
  } catch (e) {
    console.error(e);
    return fail("The 3D model couldn't load. The muscle notes and exercise steps in the panel still work.");
  }

  anatomy.controls.addEventListener("start", () => setPressed($("tools-anatomy"), "view", ""));
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
    if (scene === "figure") {
      updateSteps(figure.update(dt));
      renderer.render(figure.scene, figure.camera);
    } else if (anatomy) {
      doHover();
      if (anatomy.tick(dt)) renderer.render(anatomy.scene, anatomy.camera);
    }
  }
  requestAnimationFrame(frame);

  /** open an exercise page and wait until its muscles are loaded and the figure is posed */
  async function openExercise(id) {
    const n = nav();
    n.length = 1;
    n.push({ view: "exercise", id, region: n[0].region });
    render();
    await idle();
  }
  /** resolves once every region the current view needs has loaded and the stage shows it */
  async function idle() {
    await ensure(stageSpec(cur()).need);
    syncStage();
  }

  // hooks for automated checks
  window.__atlas = {
    go, home, render, anatomy, figure, moves: MOVES, idle,
    get nav() { return nav(); },
    get mode() { return mode; },
    get navs() { return navs; },
    setMode, setRegion, openResult,
    /** draw one exercise at a point in its loop and return the frame as a data URL */
    async snap(id, f, view) {
      await openExercise(id);
      if (!MOVES[id]) { window.__atlas.drawNow(); return canvas.toDataURL("image/jpeg", 0.8); }   // no animation: the atlas shows its muscles
      if (view) { const [fr, an] = view.split("/"); figure.setView(fr || undefined, an || undefined); }
      figure.setPlaying(false); figure.seek(f); updateSteps(figure.update(0));
      renderer.render(figure.scene, figure.camera);
      return canvas.toDataURL("image/jpeg", 0.8);
    },
    /** the same, with the camera on one hand */
    async snapHand(id, f, side, az, el, dist) {
      await openExercise(id);
      if (!MOVES[id]) { window.__atlas.drawNow(); return canvas.toDataURL("image/jpeg", 0.8); }
      figure.setPlaying(false); figure.seek(f); updateSteps(figure.update(0));
      figure.handCam(side, az, el, dist); figure.update(0);
      renderer.render(figure.scene, figure.camera);
      return canvas.toDataURL("image/jpeg", 0.8);
    },
    drawNow() { if (scene === "anatomy" && anatomy) { anatomy.tick(1); anatomy.invalidate(); anatomy.tick(0); renderer.render(anatomy.scene, anatomy.camera); } },
  };
}

function resize() {
  if (!renderer) return;
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  if (anatomy) { anatomy.resize(w, h); measureInsets(); }
  if (figure) figure.resize(w, h);
}

boot();
