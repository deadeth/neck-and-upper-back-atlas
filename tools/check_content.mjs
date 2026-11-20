// Data check: every id the panel and the scenes rely on resolves. Run: node tools/check_content.mjs
// Muscle meshes live in one file per region (docs/muscles-<region>.json); the skeleton is in docs/model.json.
import fs from "node:fs";
import { REGIONS, STRENGTH, GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO, RED_FLAGS } from "../docs/content.js";
import { MOVES, BASES } from "../docs/moves.js";
import { REAL } from "../docs/timing.js";
import { areaSpots } from "../docs/anatomy.js";

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../docs/${f}`, import.meta.url)));
const errs = [];
const ok = (cond, msg) => { if (!cond) errs.push(msg); };
const regionIds = new Set(REGIONS.map((r) => r.id));
const ready = new Set(REGIONS.filter((r) => r.ready).map((r) => r.id));
// ready regions whose stretches are written; `stretches: false` means pain notes only, lifts stand in (contract, Addendum 2)
const stretched = new Set(REGIONS.filter((r) => r.ready && r.stretches !== false).map((r) => r.id));
const groupIds = new Set(GROUPS.map((g) => g.id));
const muscleIds = new Set(MUSCLES.map((m) => m.id));
const byMuscle = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

// ---- regions and their muscle files ----
ok(regionIds.size === REGIONS.length, "duplicate region id");
const parts = [];   // { id, side, region }
for (const r of REGIONS) {
  ok(r.name && typeof r.ready === "boolean", `region ${r.id}: needs name and ready`);
  ok(r.flags === null || (Array.isArray(r.flags) && r.flags.length >= 3), `region ${r.id}: flags must be null or a list of at least 3`);
  ok(r.stretches === undefined || typeof r.stretches === "boolean", `region ${r.id}: stretches must be true or false`);
  if (r.ready) {
    // null falls back to RED_FLAGS, which is written for the neck; every other ready region needs its own list
    ok(Array.isArray(r.flags) || (r.flags === null && r.id === "neck"), `region ${r.id}: ready, so it needs its own flags`);
    for (const kind of ["where", "when"]) ok(PATTERNS.some((p) => p.region === r.id && p.kind === kind), `region ${r.id}: ready, so it needs at least one "${kind}" pattern`);
  }
  let doc = null;
  try { doc = read(`muscles-${r.id}.json`); } catch (e) { errs.push(`region ${r.id}: docs/muscles-${r.id}.json missing or unreadable`); continue; }
  for (const p of doc.parts) {
    ok(p.kind === "muscle", `muscles-${r.id}.json: part ${p.id || p.name} is not a muscle`);
    parts.push({ id: p.id, side: p.side, region: r.id });
  }
}
const model = read("model.json");
ok(!model.parts.some((p) => p.kind === "muscle"), "model.json should hold the skeleton only; muscles go in the region files");
const sides = (id) => parts.filter((p) => p.id === id).map((p) => p.side).sort().join("");
for (const p of parts) {
  ok(muscleIds.has(p.id), `muscles-${p.region}.json: part ${p.id} has no content`);
  if (byMuscle[p.id]) ok(byMuscle[p.id].region === p.region, `${p.id}: shipped in muscles-${p.region}.json but its group is in region ${byMuscle[p.id].region}`);
}

// ---- groups and muscles ----
ok(GROUPS.length === groupIds.size, "duplicate group id");
for (const g of GROUPS) {
  ok(regionIds.has(g.region), `group ${g.id}: unknown region ${g.region}`);
  ok(MUSCLES.some((m) => m.group === g.id), `group ${g.id} has no muscles`);
}
ok(muscleIds.size === MUSCLES.length, "duplicate muscle id");
for (const m of MUSCLES) {
  ok(groupIds.has(m.group), `${m.id}: unknown group ${m.group}`);
  ok(sides(m.id) === "LR", `${m.id}: model parts are "${sides(m.id)}", expected LR`);
  ok(m.layer >= 1 && m.layer <= 4, `${m.id}: layer out of range`);
  ok(m.ppl === null || m.ppl === undefined || ["pull", "push", "legs"].includes(m.ppl), `${m.id}: ppl must be pull, push, legs or null`);
  for (const k of ["name", "latin", "does", "attach", "nerve"]) ok(m[k] && m[k].length > 3, `${m.id}: missing ${k}`);
  for (const e of m.exercises) {
    ok(EXERCISE_INFO[e], `${m.id}: exercise ${e} has no notes`);
    ok(!EXERCISE_INFO[e] || EXERCISE_INFO[e].mode !== "strength", `${m.id}: ${e} is a strength lift; lifts list their muscles in targets, not the other way round`);
  }
  // regions without pain notes yet may have no exercises; ready ones need the notes, and exercises unless
  // the region is marked `stretches: false`
  if (ready.has(m.region)) {
    if (stretched.has(m.region)) ok(m.exercises.length >= 2, `${m.id}: fewer than 2 exercises`);
    for (const k of ["pain", "triggers", "check"]) ok(m[k] && m[k].length > 3, `${m.id}: missing ${k}`);
  }
}

// ---- pain patterns ----
ok(new Set(PATTERNS.map((p) => p.id)).size === PATTERNS.length, "duplicate pattern id");
for (const p of PATTERNS) {
  ok(regionIds.has(p.region), `${p.id}: unknown region ${p.region}`);
  ok(p.kind === "where" || p.kind === "when", `${p.id}: bad kind`);
  ok(p.muscles.length >= 3, `${p.id}: fewer than 3 muscles`);
  for (const x of p.muscles) ok(muscleIds.has(x.id), `${p.id}: unknown muscle ${x.id}`);
  // the area lit on the model while a "where" chip is hovered (contract, Addendum 3)
  if (p.kind !== "where") { ok(p.area === undefined, `${p.id}: only "where" patterns have an area`); continue; }
  if (!Array.isArray(p.area) || !p.area.length) { errs.push(`${p.id}: "where" pattern needs an area with at least one spot`); continue; }
  const known = (n) => typeof n === "string" && (n === "acrom" || (n in model.rig.joints && !/[LR]$/.test(n)) || (n + "L" in model.rig.joints && n + "R" in model.rig.joints));
  const before = errs.length;
  for (const sp of p.area) {
    const extra = Object.keys(sp).filter((k) => !["at", "to", "f", "off", "r"].includes(k));
    ok(!extra.length, `${p.id}: area spot has unknown keys ${extra.join(", ")}`);
    ok(known(sp.at), `${p.id}: area landmark "${sp.at}" is not in the rig`);
    ok(sp.to === undefined || known(sp.to), `${p.id}: area landmark "${sp.to}" is not in the rig`);
    const fs = sp.f === undefined ? [] : Array.isArray(sp.f) ? sp.f : [sp.f];
    ok(fs.length <= 2 && fs.every((v) => typeof v === "number" && v >= 0 && v <= 1), `${p.id}: area f must be 0..1 or a pair of them`);
    ok(sp.f === undefined || sp.to !== undefined, `${p.id}: area f needs a "to" landmark`);
    ok(sp.off === undefined || (Array.isArray(sp.off) && sp.off.length === 3 && sp.off.every((v) => typeof v === "number" && Math.abs(v) <= 20)), `${p.id}: area off must be [x, y, z] within 20 cm`);
    ok(typeof sp.r === "number" && sp.r >= 2 && sp.r <= 10, `${p.id}: area radius ${sp.r} outside 2..10 cm`);
  }
  if (errs.length === before) {
    const n = areaSpots(p.area, model.rig).length;
    ok(n >= 1 && n <= 48, `${p.id}: area makes ${n} spots, at most 48`);
  }
}

// ---- strength days and lifts ----
const dayIds = STRENGTH.map((d) => d.id);
ok(["pull", "push", "legs"].every((id) => dayIds.includes(id)) && dayIds.length === 3, `strength days must be pull, push and legs, got ${dayIds.join(", ")}`);
// the day each lift belongs to, from the table in docs/contract.md
const LIFT_DAY = {
  "pull-up": "pull", "bent-over-row": "pull", "biceps-curl": "pull",
  "push-up": "push", "floor-press": "push", "overhead-press": "push", "lateral-raise": "push", "triceps-extension": "push",
  "squat": "legs", "romanian-deadlift": "legs", "split-squat": "legs", "glute-bridge": "legs", "calf-raise": "legs",
};
const daysOf = (id) => STRENGTH.filter((d) => d.exercises.includes(id)).map((d) => d.id);
for (const d of STRENGTH) {
  ok(d.name && d.exercises.length > 0, `day ${d.id}: needs a name and exercises`);
  ok(new Set(d.exercises).size === d.exercises.length, `day ${d.id}: lists an exercise twice`);
  for (const e of d.exercises) ok(EXERCISE_INFO[e], `day ${d.id}: exercise ${e} has no notes`);
}
for (const [id, e] of Object.entries(EXERCISE_INFO)) {
  if (e.mode !== "strength") {
    const onDay = STRENGTH.some((d) => d.exercises.includes(id));
    ok(onDay || (!e.targets && !e.also), `${id}: targets/also only belong on strength lifts or exercises a day reuses`);
    for (const t of [...(e.targets || []), ...(e.also || [])]) ok(MUSCLES.some((m) => m.id === t), `${id}: target ${t} is not a muscle`);
    continue;
  }
  ok(Array.isArray(e.targets) && e.targets.length > 0, `${id}: strength lift with no targets`);
  for (const t of [...(e.targets || []), ...(e.also || [])]) ok(muscleIds.has(t), `${id}: unknown muscle ${t}`);
  for (const t of e.also || []) ok(!(e.targets || []).includes(t), `${id}: ${t} is in both targets and also`);
  const want = LIFT_DAY[id], got = daysOf(id).join(",");
  if (want) ok(got === want, `${id}: should be in the ${want} day (docs/contract.md), found in ${got || "none"}`);
  else ok(got, `${id}: strength lift is not in any day`);
}

// ---- exercises and their animations ----
const used = new Set([...MUSCLES.flatMap((m) => m.exercises), ...STRENGTH.flatMap((d) => d.exercises)]);
for (const [id, e] of Object.entries(EXERCISE_INFO)) {
  ok(used.has(id), `exercise ${id} is not used by any muscle or strength day`);
  ok(Array.isArray(e.steps) && e.steps.length === 4, `${id}: needs exactly 4 steps`);
  for (const k of ["name", "type", "kit", "dose", "feel", "ease"]) ok(e[k], `${id}: missing ${k}`);
  ok(["Stretch", "Strength", "Control", "Mobility"].includes(e.type), `${id}: bad type ${e.type}`);
  const mv = MOVES[id];
  if (!mv) { errs.push(`exercise ${id} has no animation`); continue; }
  ok(BASES[mv.base], `${id}: unknown base ${mv.base}`);
  ok(mv.keys[0].t === 0 && mv.keys.at(-1).t === 1, `${id}: keys must run from t=0 to t=1`);
  for (let i = 1; i < mv.keys.length; i++) ok(mv.keys[i].t > mv.keys[i - 1].t, `${id}: key times not increasing at ${i}`);
  for (const ph of mv.phases) ok(ph.step >= 0 && ph.step < e.steps.length, `${id}: phase points at step ${ph.step}, only ${e.steps.length} steps`);
  ok(new Set(mv.phases.map((p) => p.step)).size === e.steps.length, `${id}: not every step is shown by a phase`);
  ok(mv.phases.some((p) => p.w), `${id}: no working phase`);
}
for (const id of Object.keys(MOVES)) ok(EXERCISE_INFO[id], `animation ${id} has no notes`);
// real-time playback: every animation has timings, and every timing belongs to an exercise
for (const id of Object.keys(MOVES)) ok(REAL[id], `animation ${id} has no real-time entry in site/timing.js`);
for (const id of Object.keys(REAL)) ok(EXERCISE_INFO[id] && MOVES[id], `site/timing.js: ${id} is not an animated exercise`);
// ...and each entry is well formed (shape in the header of site/timing.js)
const posNum = (v) => typeof v === "number" && v > 0 && isFinite(v);
const posInt = (v) => Number.isInteger(v) && v > 0;
for (const [id, r] of Object.entries(REAL)) {
  const where = `site/timing.js ${id}`, mv = MOVES[id];
  for (const k of Object.keys(r)) ok(["hold", "tempo", "reps", "sets", "eachSide", "unit", "rest", "setRest", "sideRest"].includes(k), `${where}: unknown field ${k}`);
  if ("hold" in r) ok(posNum(r.hold) && mv && mv.phases.some((p) => p.w), `${where}: hold must be seconds on a move with a working phase`);
  for (const [k, v] of Object.entries(r.tempo || {})) ok(mv && posInt(+k + 1) && +k < mv.phases.length && posNum(v), `${where}: tempo ${k} must be a phase index with seconds`);
  const many = Array.isArray(r.reps);
  if ("reps" in r) ok(many ? r.reps.length > 1 && r.reps.every(posInt) : posInt(r.reps), `${where}: reps must be a whole number or a list of them`);
  if ("sets" in r) ok(posInt(r.sets) && "reps" in r && !many, `${where}: sets needs reps as a number`);
  if ("eachSide" in r) ok(r.eachSide === true && posNum(r.sideRest), `${where}: eachSide must be true and have a sideRest`);
  if ("sideRest" in r) ok(r.eachSide === true && posNum(r.sideRest), `${where}: sideRest belongs with eachSide`);
  if ("unit" in r) ok(r.unit === "hold" && r.hold, `${where}: unit can only be "hold", on an entry with a hold`);
  if ("rest" in r) ok(posNum(r.rest) && (many || r.reps > 1), `${where}: rest needs more than one rep in a set`);
  if ("setRest" in r) ok(posNum(r.setRest) && (many || r.sets > 1), `${where}: setRest needs more than one set`);
}

// ---- search aliases (optional on every entry) ----
const aliased = [
  ...MUSCLES.map((x) => ["muscle " + x.id, x]), ...GROUPS.map((x) => ["group " + x.id, x]), ...PATTERNS.map((x) => ["pattern " + x.id, x]),
  ...REGIONS.map((x) => ["region " + x.id, x]), ...STRENGTH.map((x) => ["day " + x.id, x]), ...Object.entries(EXERCISE_INFO).map(([id, x]) => ["exercise " + id, x]),
];
for (const [label, x] of aliased) {
  if (x.aliases === undefined) continue;
  if (!Array.isArray(x.aliases)) { errs.push(`${label}: aliases must be a list`); continue; }
  const own = [x.name, x.latin].filter(Boolean).map((s) => s.toLowerCase().trim());
  for (const a of x.aliases) {
    if (typeof a !== "string" || !a.trim()) { errs.push(`${label}: empty alias`); continue; }
    ok(a === a.trim() && /^[\p{Ll}\p{N}]+(?:[ -][\p{Ll}\p{N}]+)*$/u.test(a), `${label}: alias "${a}" must be lower case, words joined by single spaces or hyphens`);
    ok(!own.includes(a), `${label}: alias "${a}" repeats its own name or latin`);
  }
  ok(new Set(x.aliases).size === x.aliases.length, `${label}: an alias is listed twice`);
}

// ---- copy ----
ok(RED_FLAGS.length >= 5, "red flags list too short");
const banned = /\b(diagnos(e|is|es|tic))\b/i;
const text = JSON.stringify({ REGIONS, STRENGTH, GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO });
ok(!banned.test(text), "content claims diagnosis");

if (errs.length) { console.log(errs.join("\n")); console.log(`${errs.length} problems`); process.exit(1); }
console.log(`ok: ${REGIONS.length} regions, ${MUSCLES.length} muscles, ${PATTERNS.length} patterns, ${Object.keys(EXERCISE_INFO).length} exercises, ${STRENGTH.length} strength days`);
