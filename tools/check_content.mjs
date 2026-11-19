// Data check: every id the panel and the scenes rely on resolves. Run: node tools/check_content.mjs
import fs from "node:fs";
import { GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO, RED_FLAGS } from "../docs/content.js";
import { MOVES, BASES } from "../docs/moves.js";

const model = JSON.parse(fs.readFileSync(new URL("../docs/model.json", import.meta.url)));
const errs = [];
const ok = (cond, msg) => { if (!cond) errs.push(msg); };
const groupIds = new Set(GROUPS.map((g) => g.id));
const muscleIds = new Set(MUSCLES.map((m) => m.id));
const sides = (id) => model.parts.filter((p) => p.kind === "muscle" && p.id === id).map((p) => p.side).sort().join("");

ok(MUSCLES.length === 17, `expected the 17 muscles in the design table, got ${MUSCLES.length}`);
ok(muscleIds.size === MUSCLES.length, "duplicate muscle id");
for (const m of MUSCLES) {
  ok(groupIds.has(m.group), `${m.id}: unknown group ${m.group}`);
  ok(sides(m.id) === "LR", `${m.id}: model parts are "${sides(m.id)}", expected LR`);
  ok(m.layer >= 1 && m.layer <= 4, `${m.id}: layer out of range`);
  ok(m.exercises.length >= 2, `${m.id}: fewer than 2 exercises`);
  for (const e of m.exercises) {
    ok(EXERCISE_INFO[e], `${m.id}: exercise ${e} has no notes`);
    ok(MOVES[e], `${m.id}: exercise ${e} has no animation`);
  }
  for (const k of ["name", "latin", "does", "attach", "nerve", "pain", "triggers", "check"]) ok(m[k] && m[k].length > 3, `${m.id}: missing ${k}`);
}
for (const g of GROUPS) ok(MUSCLES.some((m) => m.group === g.id), `group ${g.id} has no muscles`);
for (const p of model.parts) if (p.kind === "muscle") ok(muscleIds.has(p.id), `model part ${p.id} has no content`);
for (const p of PATTERNS) {
  ok(p.kind === "where" || p.kind === "when", `${p.id}: bad kind`);
  ok(p.muscles.length >= 3, `${p.id}: fewer than 3 muscles`);
  for (const x of p.muscles) ok(muscleIds.has(x.id), `${p.id}: unknown muscle ${x.id}`);
}
const used = new Set(MUSCLES.flatMap((m) => m.exercises));
for (const [id, e] of Object.entries(EXERCISE_INFO)) {
  ok(used.has(id), `exercise ${id} is not used by any muscle`);
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
ok(RED_FLAGS.length >= 5, "red flags list too short");
const banned = /\b(diagnos(e|is|es|tic))\b/i;
const text = JSON.stringify({ GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO });
ok(!banned.test(text), "content claims diagnosis");

if (errs.length) { console.log(errs.join("\n")); process.exit(1); }
console.log(`ok: ${MUSCLES.length} muscles, ${PATTERNS.length} patterns, ${Object.keys(EXERCISE_INFO).length} exercises`);
