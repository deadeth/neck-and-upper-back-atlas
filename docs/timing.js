// Real-time playback: how long each part of an exercise lasts when you do it, in seconds.
//
// REAL[id] = { hold?: seconds, tempo?: { [phaseIndex]: seconds },
//              reps?: number | number[], sets?: number, eachSide?: true, unit?: "hold",
//              rest?: seconds, setRest?: seconds, sideRest?: seconds }
// - hold: how long the working phase (the phase with w: 1 and a label such as "Hold 20 to 30 s") lasts.
//   Taken from the exercise's own copy; a stated range uses its midpoint. Where the on-screen label and the
//   dose differ, the label wins, because it is what the caption shows during the hold.
// - tempo: how long a moving phase lasts, keyed by its index in the move's `phases` list (not by step).
//   Used where the copy states a tempo ("Lower over three seconds", "2 second pause at the end"), and for
//   rep-based strength work, which uses one training tempo throughout:
//     lifting (concentric) 1.5 s, lowering 2 s, lowering "slowly" or "under control" 3 s,
//     a pause the copy asks for without a time 1 s.
//   A phase that ends a loop also holds the brief settle at the start pose (the last few per cent of the
//   loop), so its value is a little longer than the movement itself: 1.75 for a 1.5 s lift, 2.3 for a 2 s
//   lower, 3.5 for a 3 s lower.
// Any phase not listed keeps its animated length (its share of the move's `dur`), which is already about
// the speed you would move at. An empty entry means the animation already runs in real time.
//
// The session (what Real time counts):
// - reps: reps (or holds) in each set, from the dose. A stated range uses its LOW end ("8 to 15" is 8). An array
//   is one entry per set, for a pyramid ("5 each side, then 3, then 1" is [5, 3, 1]). Omitted: no count is
//   given, so the session loops without a target and just counts.
// - sets: how many sets of `reps` (default 1; ignored when reps is an array). Low end of a range ("2 to 3 sets"
//   is 2). "3 times a day" or "a few times a day" is how often, not sets, so it is left out.
// - eachSide: the dose says "each side" or "each leg": each set runs its reps on
//   one side, then a changeover ("Other side": mirror the model), then the same reps on the other side.
//   Neck rotation's "10 times each way" is not eachSide: one loop of the model already turns both ways.
// - unit: "hold" when the dose counts holds or times ("3 times, 20 second hold", "3 holds") rather than reps.
// - rest: seconds after each rep or hold within a set (not after the last one). Only for holds of 15 s or more.
// - setRest: seconds between sets. sideRest: seconds for the changeover between sides.
// The copy states no rest anywhere, so rests are one consistent choice:
//   10 s after a stretch hold of 15 s or more, 30 s after a plank hold, 10 s to change sides,
//   between sets 90 s for strength-day lifts, 60 s for the light shoulder and neck strength work,
//   30 s for control work (wall angel, dead bug) and the McGill pyramids (bird-dog, side plank).
export const REAL = {
  // neck and upper back
  "chin-tuck": { hold: 5, reps: 10 },
  "supine-nod": { hold: 10, reps: 10 },
  "upper-trap-stretch": { hold: 25, reps: 3, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "levator-stretch": { hold: 25, reps: 3, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "scm-stretch": { hold: 20, reps: 3, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "scalene-stretch": { hold: 20, reps: 3, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "neck-flexion-stretch": { hold: 25, reps: 3, unit: "hold", rest: 10 },
  "neck-rotation": { tempo: { 1: 5, 2: 3, 3: 7.7 }, reps: 10 },   // turn 3 s, then the 2 second pause at each end
  "iso-extension": { hold: 7.5, reps: 8 },
  "shrug": { tempo: { 1: 1.5, 2: 1, 3: 3.5 }, reps: 10, sets: 3, setRest: 60 },   // lower over three seconds
  "band-row": { tempo: { 1: 1.5, 2: 1, 3: 3.5 }, reps: 12, sets: 3, setRest: 60 },
  "prone-t": { hold: 2, tempo: { 1: 1.5, 3: 3.5 }, reps: 10, sets: 3, setRest: 60 },
  "prone-y": { hold: 2, tempo: { 2: 1.5, 4: 3.6 }, reps: 8, sets: 3, setRest: 60 },
  "wall-angel": { reps: 10, sets: 2, setRest: 30 },
  "rhomboid-stretch": { hold: 20, reps: 3, unit: "hold", rest: 10 },
  "external-rotation": { tempo: { 1: 1.5, 2: 1, 3: 3.3 }, reps: 12, sets: 3, eachSide: true, setRest: 60, sideRest: 10 },
  "cross-body-stretch": { hold: 30, reps: 3, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "scaption": { tempo: { 1: 1.5, 2: 1, 3: 3.5 }, reps: 10, sets: 3, setRest: 60 },   // lower over three seconds
  "thoracic-extension": { reps: 10 },
  "prone-cobra": { hold: 7.5, tempo: { 2: 1.5, 4: 3.6 }, reps: 8 },

  // head, face and jaw
  "jaw-rest": { hold: 10, reps: 5, unit: "hold" },
  "jaw-opening": { hold: 2, tempo: { 1: 3, 3: 3.5 }, reps: 5 },   // slow opens and closes, about 3 s each way
  "jaw-open-resisted": { hold: 5, reps: 5, unit: "hold" },
  "jaw-sideways": { hold: 5, reps: 10, eachSide: true, unit: "hold", sideRest: 10 },
  "jaw-massage": { tempo: { 1: 60, 2: 60 }, reps: 1 },   // about a minute on the cheeks, then on the temples
  "forehead-release": { hold: 2, reps: 5 },

  // lower back and core
  "cat-cow": { reps: 8 },
  "childs-pose": { hold: 25, reps: 2, unit: "hold", rest: 10 },
  "knee-to-chest": { hold: 22, reps: 2, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "bird-dog": { hold: 10, reps: [5, 3, 1], eachSide: true, setRest: 30, sideRest: 10 },
  "dead-bug": { hold: 2, reps: 6, sets: 2, eachSide: true, setRest: 30, sideRest: 10 },
  "side-plank": { hold: 10, reps: [5, 3, 1], eachSide: true, unit: "hold", setRest: 30, sideRest: 10 },
  "side-bend-stretch": { hold: 22, reps: 2, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "hip-flexor-stretch": { hold: 25, reps: 2, eachSide: true, unit: "hold", rest: 10, sideRest: 10 },
  "prone-press-up": { hold: 2, reps: 8 },
  "plank": { hold: 20, reps: 3, unit: "hold", rest: 30 },

  // strength days
  "squat": { hold: 1, tempo: { 1: 2, 3: 1.75 }, reps: 8, sets: 2, setRest: 90 },
  "romanian-deadlift": { hold: 1, tempo: { 1: 2, 3: 1.75 }, reps: 8, sets: 2, setRest: 90 },
  "split-squat": { hold: 1, tempo: { 1: 2, 3: 1.75 }, reps: 8, sets: 2, eachSide: true, setRest: 90, sideRest: 10 },
  "calf-raise": { hold: 1, tempo: { 1: 1.5, 3: 3.5 }, reps: 10, sets: 2, setRest: 90 },
  "glute-bridge": { hold: 2, tempo: { 1: 1.5, 3: 3.5 }, reps: 10, sets: 2, setRest: 90 },
  "push-up": { hold: 1, tempo: { 1: 2, 3: 1.75 }, reps: 5, sets: 2, setRest: 90 },
  "floor-press": { hold: 1, tempo: { 1: 1.5, 3: 2.3 }, reps: 8, sets: 2, setRest: 90 },
  "overhead-press": { hold: 1, tempo: { 1: 1.5, 3: 2.3 }, reps: 8, sets: 2, setRest: 90 },
  "lateral-raise": { hold: 1, tempo: { 1: 1.5, 3: 3.5 }, reps: 10, sets: 2, setRest: 90 },
  "triceps-extension": { hold: 1, tempo: { 1: 2, 3: 1.75 }, reps: 8, sets: 2, setRest: 90 },
  "biceps-curl": { hold: 1, tempo: { 1: 1.5, 3: 3.5 }, reps: 8, sets: 2, setRest: 90 },
  "bent-over-row": { hold: 1, tempo: { 1: 1.5, 3: 2.3 }, reps: 8, sets: 2, setRest: 90 },
  "pull-up": { hold: 1, tempo: { 1: 1.5, 3: 3.5 }, reps: 3, sets: 3, setRest: 90 },
};
