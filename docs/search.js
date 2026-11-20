// Search over the atlas content: muscles, groups, exercises, lifts, pain patterns, regions and strength days.
// Pure functions, no DOM, so tools/test_search.mjs can run it under Node.
//
// Matching: case and accent insensitive; punctuation and hyphens ignored, and spaces don't matter inside a run
// of words ("pull up", "pullup", "pull-up"); each query word may be the start of a word ("glut"); words match
// in any order; one typo is allowed in a query word of five letters or more; a trailing plural "s" is ignored.
// Ranking, best first: exact name; name starts with the query; exact alias; alias starts with the query; any
// other match (words of the name, then aliases, then latin and group). A typo costs half a tier. Ties keep
// muscles first, then groups, exercises, lifts, pain patterns, regions, days, then content order.

export const KIND_LABEL = {
  muscle: "Muscle", group: "Group", exercise: "Exercise", lift: "Lift", pattern: "Pain pattern", region: "Region", day: "Strength day",
};
const KIND_ORDER = { muscle: 0, group: 1, exercise: 2, lift: 3, pattern: 4, region: 5, day: 6 };
const STOP = new Set(["the", "of", "a", "an", "and", "in", "on", "my", "to", "for", "with", "at"]);

/** lower case, accents stripped, apostrophes dropped, every other non-letter-or-digit a space */
export function normalise(s) {
  return String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
/** cheap singular: glutes > glute, quads > quad, bodies > body; leaves -ss, -us, -is and short words alone */
export function stem(w) {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}
const words = (s) => normalise(s).split(" ").filter(Boolean);

/** optimal string alignment distance, stopping early once it passes `max` */
function osa(a, b, max = 1) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** a prepared string: its words (raw and singular) and the words run together */
function prep(text) {
  const raw = words(text);
  const st = raw.map(stem);
  return { text, raw, st, compact: raw.join(""), compactSt: st.join("") };
}

/** how one query word meets one field word: 0 = equal, 1 = prefix, 2 = with a typo, -1 = no match */
function wordHit(q, fw) {
  if (fw === q) return 0;
  if (fw.startsWith(q)) return 1;
  if (q.length >= 5) {
    if (osa(q, fw) <= 1) return 2;
    // a typo while still typing: compare with the start of the longer word
    if (fw.length > q.length && osa(q, fw.slice(0, q.length)) <= 1) return 2;
  }
  return -1;
}

/**
 * Score one query against one field. Returns null or { how: "exact"|"prefix"|"words", typo }.
 * "words" means every query word starts (or nearly starts) a word of the field, in any order, or the
 * whole query, spaces removed, starts at a word boundary of the field with its spaces removed.
 */
function matchField(q, f) {
  if (!f.raw.length) return null;
  if (q.compact === f.compact || q.compactSt === f.compactSt) return { how: "exact", typo: false };
  if (f.compact.startsWith(q.compact)) return { how: "prefix", typo: false };
  // the plural dropped ("glutes" against "Gluteus maximus") counts as a word match, not a name prefix,
  // so "quads" doesn't put Quadratus lumborum ahead of the muscles called quads
  if (f.compactSt.startsWith(q.compactSt)) return { how: "words", typo: false };
  const long = q.compact.length >= 5;
  if (long && osa(q.compact, f.compact) <= 1) return { how: "exact", typo: true };
  // the query run together, from the start of any later word of the field ("press up" in "Prone press-up")
  for (let i = 1; i < f.raw.length; i++) {
    const tail = f.raw.slice(i).join("");
    if (tail.startsWith(q.compact) || f.st.slice(i).join("").startsWith(q.compactSt)) return { how: "words", typo: false };
  }
  // each query word on its own, any order
  let typo = false;
  for (const qw of q.st) {
    let best = -1;
    for (const fw of f.st) {
      const h = wordHit(qw, fw);
      if (h !== -1 && (best === -1 || h < best)) best = h;
      if (best === 0) break;
    }
    if (best === -1) {
      // also try the field's words run together in pairs ("pullup" against "pull up")
      for (let i = 0; i + 1 < f.raw.length && best === -1; i++) if ((f.raw[i] + f.raw[i + 1]).startsWith(qw)) best = 1;
    }
    if (best === -1) return null;
    if (best === 2) typo = true;
  }
  return { how: "words", typo };
}

/** split "Latissimus dorsi (lats)" into the whole name, the name before the bracket, and what's in the bracket */
function nameForms(name) {
  const out = [name];
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
  if (m) out.push(m[1], ...m[2].split(/,|\bor\b/).map((s) => s.trim()).filter(Boolean));
  return out;
}

/**
 * Build the search index from the content module's exports.
 * Each entry: { kind, id, name, sub, fields: [{ f, role: "name"|"alias"|"other" }], order }.
 */
export function buildIndex({ REGIONS, STRENGTH, GROUPS, MUSCLES, PATTERNS, EXERCISE_INFO }) {
  const regionName = Object.fromEntries(REGIONS.map((r) => [r.id, r.name]));
  const groupOf = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const out = [];
  const add = (kind, id, name, sub, extra = {}, others = [], names = []) => {
    const fields = [
      ...[...nameForms(name), ...names].map((t) => ({ f: prep(t), role: "name" })),
      ...(extra.aliases || []).map((t) => ({ f: prep(t), role: "alias" })),
      ...others.filter(Boolean).map((t) => ({ f: prep(t), role: "other" })),
    ];
    out.push({ kind, id, name, sub, fields, order: out.length });
  };
  for (const m of MUSCLES) {
    const g = groupOf[m.group];
    add("muscle", m.id, m.name, regionName[m.region || (g && g.region)] || "", m, [m.latin, g && g.name]);
  }
  for (const g of GROUPS) add("group", g.id, g.name, regionName[g.region] || "", g);
  for (const [id, e] of Object.entries(EXERCISE_INFO)) {
    const days = STRENGTH.filter((d) => d.exercises.includes(id)).map((d) => `${d.name} day`);
    if (e.mode === "strength") { add("lift", id, e.name, days.join(", "), e); continue; }
    const regions = [...new Set(MUSCLES.filter((m) => m.exercises.includes(id)).map((m) => regionName[m.region]).filter(Boolean))];
    add("exercise", id, e.name, (regions.length ? regions : days).join(", "), e);
  }
  for (const p of PATTERNS) add("pattern", p.id, p.name, regionName[p.region] || "", p);
  for (const r of REGIONS) add("region", r.id, r.name, "Pain and stretch", r);
  for (const d of STRENGTH) add("day", d.id, `${d.name} day`, "Strength", d, [], [d.name]);
  return out;
}

const TIER = { name: { exact: 0, prefix: 1 }, alias: { exact: 2, prefix: 3 } };
const WORD_WEIGHT = { name: 0, alias: 0.1, other: 0.2 };

/** score one entry; null when it doesn't match */
function scoreEntry(q, e) {
  let best = null, nameHit = false;
  for (const { f, role } of e.fields) {
    const m = matchField(q, f);
    if (!m) continue;
    if (role === "name") nameHit = true;
    const tier = (TIER[role] && TIER[role][m.how]) ?? 4;
    const s = tier + (m.typo ? 0.5 : 0) + (tier === 4 ? WORD_WEIGHT[role] : 0);
    if (!best || s < best.score) best = { score: s, role, text: f.text, typo: m.typo };
  }
  if (!best) {
    // words spread over the name, aliases and other fields of one entry ("upper trap neck")
    let typo = false, worst = "name";
    for (const qw of q.st) {
      let hit = null;
      for (const { f, role } of e.fields) for (const fw of f.st) {
        const h = wordHit(qw, fw);
        if (h !== -1 && (!hit || h < hit.h)) hit = { h, role };
      }
      if (!hit) return null;
      if (hit.h === 2) typo = true;
      if (WORD_WEIGHT[hit.role] > WORD_WEIGHT[worst]) worst = hit.role;
    }
    best = { score: 4.3 + (typo ? 0.5 : 0), role: worst, text: null, typo };
  }
  // the shown name already explains the hit, so there's no need to say which alias matched
  if (nameHit) best.text = null;
  return best;
}

/**
 * Search the index. Returns every match, best first: [{ entry, score, matched }], where `matched` is the alias,
 * latin or group name that produced the hit when the shown name doesn't match the query itself (null otherwise).
 */
export function search(index, query) {
  const all = words(query);
  if (!all.length) return [];
  // whole-query comparisons use every word; word-by-word matching skips words like "the" and "of"
  const kept = all.filter((w) => !STOP.has(w));
  const qw = kept.length ? kept : all;
  const q = { raw: qw, st: qw.map(stem), compact: all.join(""), compactSt: all.map(stem).join("") };
  const hits = [];
  for (const e of index) {
    const b = scoreEntry(q, e);
    if (b) hits.push({ entry: e, score: b.score, typo: b.typo, matched: b.role !== "name" && b.text ? b.text : null });
  }
  // typo matches are a fallback for a misspelt query: when the query matches something as typed, guesses such as
  // "hammies" ~ "hammer" or "wrist" ~ "waist" would only be noise
  const clean = hits.filter((h) => !h.typo);
  return (clean.length ? clean : hits).sort((a, b) => a.score - b.score || KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] || a.entry.order - b.entry.order);
}
