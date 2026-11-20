// Tests for site/search.js against the real content plus fixture aliases. Run: node tools/test_search.mjs
// The fixture (applyFixture) is test-only. tools/shots.mjs reuses it to stand in for content that isn't written
// yet: aliases, and shoulder, hip and leg as ready regions without stretches. It only fills what's missing,
// so it keeps working once the real content lands.
import { pathToFileURL } from "node:url";

/** add aliases and stand-in pain notes to the content module's exports, in place */
export function applyFixture(C) {
  const A = {
    muscles: {
      "latissimus-dorsi": ["lats", "wings"], "upper-trapezius": ["traps", "upper traps"], "middle-trapezius": ["traps", "mid traps"],
      "lower-trapezius": ["traps", "lower traps"], "rectus-abdominis": ["abs", "six pack", "sixpack"], "gluteus-maximus": ["glutes", "bum"],
      "gluteus-medius": ["glutes", "side glute"], "gluteus-minimus": ["glutes"], "biceps-femoris": ["hamstrings", "hammies"],
      "medial-hamstrings": ["hamstrings", "hammies"], "vasti": ["quadriceps", "vastus lateralis", "vmo"], "rectus-femoris": ["quads", "quadriceps"],
      "gastrocnemius": ["calves", "gastrocs"], "soleus": ["calf", "calves"], "iliopsoas": ["psoas", "hip flexors"],
      "pectoralis-major": ["chest", "pec"], "deltoid-anterior": ["delts", "front delts"], "deltoid-middle": ["delts", "side delts"],
      "deltoid-posterior": ["delts", "rear delts"], "supraspinatus": ["rotator cuff"], "infraspinatus": ["rotator cuff"],
      "teres-minor": ["rotator cuff"], "subscapularis": ["rotator cuff"], "sternocleidomastoid": ["scm"], "erector-spinae": ["spinal erectors"],
    },
    groups: { "hamstrings": ["hammies"], "abdominals": ["abs", "core"], "quads": ["quads", "quadriceps"], "deltoid": ["delts", "shoulders"], "chest": ["pecs"] },
    exercises: {
      "push-up": ["press up", "pressup"], "pull-up": ["chin up", "chinup"], "romanian-deadlift": ["rdl", "stiff leg deadlift"],
      "split-squat": ["lunge", "bulgarian split squat"], "calf-raise": ["heel raise"], "lateral-raise": ["side raise"],
    },
    patterns: { "core-buttock-leg": ["sciatica"], "back-of-neck": ["stiff neck", "crick in the neck"], "turning": ["stiff neck"], "skull-base": ["tension headache"] },
    regions: { "neck": ["upper back"], "core": ["lower back", "low back"] },
    days: { "pull": ["back day"], "push": ["chest day"], "legs": ["leg day"] },
  };
  const put = (list, key, map) => { for (const x of list) if (map[x[key]] && !x.aliases) x.aliases = map[x[key]]; };
  put(C.MUSCLES, "id", A.muscles); put(C.GROUPS, "id", A.groups); put(C.PATTERNS, "id", A.patterns);
  put(C.REGIONS, "id", A.regions); put(C.STRENGTH, "id", A.days);
  for (const [id, a] of Object.entries(A.exercises)) if (C.EXERCISE_INFO[id] && !C.EXERCISE_INFO[id].aliases) C.EXERCISE_INFO[id].aliases = a;

  // shoulder, hip and leg: pain notes but no stretches yet (docs/contract.md, Addendum 2 > Region states)
  const STAND_IN = {
    shoulder: { flags: ["Fixture flag: shoulder pain after a fall or a dislocation", "Fixture flag: an arm you can't lift at all", "Fixture flag: chest pain or breathlessness with the ache"],
      where: [["fx-shoulder-front", "Front of the shoulder", ["deltoid-anterior", "pectoralis-major", "biceps-brachii", "subscapularis"]], ["fx-shoulder-outer-elbow", "Outside of the elbow", ["forearm-extensors", "brachioradialis", "triceps-brachii"]]],
      when: [["fx-shoulder-overhead", "Reaching overhead", ["deltoid-middle", "teres-minor", "serratus-anterior"]]] },
    hip: { flags: ["Fixture flag: a hip that gave way or a fall onto it", "Fixture flag: fever or feeling unwell with the pain", "Fixture flag: numbness in the groin or saddle area"],
      where: [["fx-hip-buttock", "Deep in the buttock", ["piriformis", "gluteus-medius", "deep-rotators", "gluteus-maximus"]]],
      when: [["fx-hip-stairs", "Climbing stairs", ["gluteus-maximus", "gluteus-medius", "tensor-fasciae-latae"]]] },
    leg: { flags: ["Fixture flag: a hot, swollen, tender calf", "Fixture flag: a snap or a kick felt at the back of the heel", "Fixture flag: a leg that is getting weaker"],
      where: [["fx-leg-back-thigh", "Back of the thigh", ["biceps-femoris", "medial-hamstrings", "gastrocnemius"]]],
      when: [["fx-leg-running", "Running or jumping", ["gastrocnemius", "soleus", "tibialis-anterior", "vasti"]]] },
  };
  for (const [rid, s] of Object.entries(STAND_IN)) {
    const r = C.REGIONS.find((x) => x.id === rid);
    if (!r || r.ready) continue;
    r.ready = true; r.stretches = false; r.flags = r.flags || s.flags;
    for (const m of C.MUSCLES.filter((x) => x.region === rid)) {
      m.pain ||= `Fixture: an ache felt in and around the ${m.name.toLowerCase()}, often worse after use.`;
      m.triggers ||= "Fixture: sudden loads, long sessions and too little rest.";
      m.check ||= "Fixture: press along the muscle and see if it matches your ache.";
    }
    for (const kind of ["where", "when"]) for (const [id, name, ms] of s[kind]) {
      if (!C.PATTERNS.some((p) => p.id === id)) C.PATTERNS.push({ id, region: rid, kind, name, note: `Fixture: likely muscles for ${name.toLowerCase()}.`, muscles: ms.map((mid) => ({ id: mid, why: "Fixture reason" })) });
    }
  }
}

// ---------- tests ----------
async function run() {
  const C = await import("../docs/content.js");
  const S = await import("../docs/search.js");
  const plain = S.buildIndex(C);   // today's data, before the fixture
  applyFixture(C);
  const idx = S.buildIndex(C);
  let fails = 0, n = 0;
  const top = (q, i = idx) => S.search(i, q);
  const ids = (q, i) => top(q, i).map((h) => `${h.entry.kind}:${h.entry.id}`);
  const check = (name, cond, info = "") => { n++; if (!cond) { fails++; console.log(`FAIL ${name}${info ? "  " + info : ""}`); } };
  const firstIs = (q, want, k = 1) => { const got = ids(q).slice(0, k); check(`"${q}" -> ${want} in top ${k}`, got.includes(want), `got ${got.join(" ") || "nothing"}`); };
  const has = (q, want, k = 8) => { const got = ids(q).slice(0, k); check(`"${q}" finds ${want} in top ${k}`, got.includes(want), `got ${got.join(" ")}`); };

  // the required queries
  firstIs("lats", "muscle:latissimus-dorsi");
  for (const m of ["upper-trapezius", "middle-trapezius", "lower-trapezius"]) has("traps", `muscle:${m}`, 4);
  firstIs("six pack", "muscle:rectus-abdominis");
  firstIs("abs", "muscle:rectus-abdominis", 2); has("abs", "group:abdominals", 5);
  firstIs("glutes", "group:glutes"); has("glutes", "muscle:gluteus-maximus", 4); has("glutes", "muscle:gluteus-medius", 4);
  has("hammies", "group:hamstrings", 3); has("hammies", "muscle:biceps-femoris", 3); has("hammies", "muscle:medial-hamstrings", 3);
  firstIs("quads", "muscle:vasti", 2); has("quads", "group:quads", 4); has("quads", "muscle:rectus-femoris", 3);
  firstIs("calf", "muscle:gastrocnemius"); has("calf", "lift:calf-raise", 4); has("calf", "muscle:soleus", 5);
  firstIs("hip flexor", "muscle:iliopsoas"); has("hip flexor", "group:hip-flexors", 5); has("hip flexor", "exercise:hip-flexor-stretch", 8);
  has("rotator cuff", "group:cuff", 2); has("rotator cuff", "group:cuff-deep", 2); has("rotator cuff", "muscle:supraspinatus");
  firstIs("pecs", "muscle:pectoralis-major"); has("pecs", "group:chest", 3);
  for (const m of ["deltoid-anterior", "deltoid-middle", "deltoid-posterior"]) has("delts", `muscle:${m}`, 4);
  firstIs("press up", "lift:push-up"); has("press up", "exercise:prone-press-up", 3);
  firstIs("chin up", "lift:pull-up");
  firstIs("rdl", "lift:romanian-deadlift");
  firstIs("lunge", "lift:split-squat");
  firstIs("sciatica", "pattern:core-buttock-leg");
  has("stiff neck", "pattern:back-of-neck", 2); has("stiff neck", "pattern:turning", 3);
  firstIs("trapezuis", "group:trapezius"); has("trapezuis", "muscle:upper-trapezius", 4);
  check(`nonsense string finds nothing`, top("qzxv wplk").length === 0, ids("qzxv wplk").join(" "));
  check(`empty query finds nothing`, top("  ").length === 0 && top("").length === 0);

  // without the fixture, real names still work
  firstIs("lats", "muscle:latissimus-dorsi"); check(`"lats" works on today's data`, ids("lats", plain)[0] === "muscle:latissimus-dorsi", ids("lats", plain).slice(0, 3).join(" "));
  check(`"six pack" works on today's data`, ids("six pack", plain)[0] === "muscle:rectus-abdominis", ids("six pack", plain).slice(0, 3).join(" "));
  check(`"trap" finds trapezius on today's data`, ids("trap", plain).slice(0, 4).includes("muscle:upper-trapezius"), ids("trap", plain).slice(0, 4).join(" "));

  // case, accents, punctuation, spacing
  for (const q of ["pull up", "pullup", "pull-up", "PULL UP", "Pull-Up!"]) firstIs(q, "lift:pull-up");
  firstIs("Trapézius", "group:trapezius");
  firstIs("childs pose", "exercise:childs-pose"); firstIs("child's", "exercise:childs-pose");
  firstIs("sterno-cleido", "muscle:sternocleidomastoid");
  // word prefixes and any order
  firstIs("glut", "muscle:gluteus-maximus", 3); firstIs("trap", "group:trapezius");
  firstIs("trapezius upper", "muscle:upper-trapezius"); firstIs("neck back", "pattern:back-of-neck", 2);
  firstIs("skull base", "pattern:skull-base");
  // typos: one edit for 5+ letters, never for short words
  firstIs("supraspinatous", "muscle:supraspinatus"); firstIs("rhomboyd", "muscle:rhomboid-minor", 2);
  has("levator scapulea", "muscle:levator-scapulae", 1);
  check(`no typo for short words: "lsts"`, !ids("lsts").includes("muscle:latissimus-dorsi"));
  check(`no typo for short words: "pex"`, !ids("pex").includes("muscle:pectoralis-major"));
  // singular and plural
  firstIs("glute", "muscle:gluteus-maximus", 3); firstIs("bicep", "muscle:biceps-brachii", 2); firstIs("hamstring", "group:hamstrings");
  firstIs("scalene", "muscle:scalenes");
  // ranking: exact name, then name prefix, then alias exact, alias prefix, then other words
  const order = ids("plank"); check(`"plank" exact name before "Side plank"`, order[0] === "exercise:plank" && order.indexOf("exercise:side-plank") > 0, order.join(" "));
  const sq = ids("squat"); check(`"squat": exact Squat, then prefix-less Split squat`, sq[0] === "lift:squat" && sq.includes("lift:split-squat"), sq.join(" "));
  const pull = ids("pull"); check(`"pull": day name exact before "Pull-up" prefix`, pull[0] === "day:pull" && pull[1] === "lift:pull-up", pull.join(" "));
  const tr = ids("traps"); check(`"traps": alias exact (trapezius muscles) before the latin-only matches`, tr.slice(0, 3).every((x) => /trapezius/.test(x)), tr.join(" "));
  const sh = top("shrug"); check(`"shrug": exercise found with its region`, sh[0].entry.id === "shrug" && sh[0].entry.sub === "Neck and upper back", JSON.stringify(sh[0].entry.sub));
  // muscles before exercises on a tie, and stable
  const lv = ids("levator"); check(`"levator": muscle before its stretch`, lv[0] === "muscle:levator-scapulae" && lv.indexOf("exercise:levator-stretch") > 0, lv.join(" "));
  check(`stable: same query twice gives the same order`, ids("neck").join() === ids("neck").join());
  // the matched alias is reported when it produced the hit
  const w = top("bum")[0]; check(`"bum" -> gluteus maximus, matches: bum`, w && w.entry.id === "gluteus-maximus" && w.matched === "bum", JSON.stringify(w && [w.entry.id, w.matched]));
  const ln = top("lunge")[0]; check(`"lunge" reports alias`, ln.matched === "lunge");
  const nm = top("plank")[0]; check(`name hit reports no alias`, nm.matched === null);
  check(`"trap": name also matches, so the alias isn't shown`, top("trap").slice(0, 4).every((h) => h.matched === null));
  const lt = top("longus colli")[0]; check(`latin hit reports the latin`, lt && lt.entry.id === "deep-neck-flexors" && /longus colli/i.test(lt.matched || ""), JSON.stringify(lt && [lt.entry.id, lt.matched]));
  // types and labels
  check(`kinds`, top("pull")[0].entry.kind === "day" && top("neck and upper back")[0].entry.kind === "region" && top("bent over row")[0].entry.kind === "lift");
  check(`lift sub is its day`, top("bent over row")[0].entry.sub === "Pull day", top("bent over row")[0].entry.sub);
  check(`stopwords dropped: "pain in the skull base"`, ids("the skull base")[0] === "pattern:skull-base");

  console.log(fails ? `${fails} of ${n} failed` : `ok: ${n} search checks`);
  if (fails) process.exit(1);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
