// Real-time playback: how long each part of an exercise lasts when you do it, in seconds.
//
// REAL[id] = { hold?: seconds, tempo?: { [phaseIndex]: seconds } }
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
export const REAL = {
  // neck and upper back
  "chin-tuck": { hold: 5 },
  "supine-nod": { hold: 10 },
  "upper-trap-stretch": { hold: 25 },
  "levator-stretch": { hold: 25 },
  "scm-stretch": { hold: 20 },
  "scalene-stretch": { hold: 20 },
  "neck-flexion-stretch": { hold: 25 },
  "neck-rotation": { tempo: { 1: 5, 2: 3, 3: 7.7 } },   // turn 3 s, then the 2 second pause at each end
  "iso-extension": { hold: 7.5 },
  "shrug": { tempo: { 1: 1.5, 2: 1, 3: 3.5 } },   // lower over three seconds
  "band-row": { tempo: { 1: 1.5, 2: 1, 3: 3.5 } },
  "prone-t": { hold: 2, tempo: { 1: 1.5, 3: 3.5 } },
  "prone-y": { hold: 2, tempo: { 2: 1.5, 4: 3.6 } },
  "wall-angel": {},
  "rhomboid-stretch": { hold: 20 },
  "external-rotation": { tempo: { 1: 1.5, 2: 1, 3: 3.3 } },
  "cross-body-stretch": { hold: 30 },
  "scaption": { tempo: { 1: 1.5, 2: 1, 3: 3.5 } },   // lower over three seconds
  "thoracic-extension": {},
  "prone-cobra": { hold: 7.5, tempo: { 2: 1.5, 4: 3.6 } },

  // lower back and core
  "cat-cow": {},
  "childs-pose": { hold: 25 },
  "knee-to-chest": { hold: 22 },
  "bird-dog": { hold: 10 },
  "dead-bug": { hold: 2 },
  "side-plank": { hold: 10 },
  "side-bend-stretch": { hold: 22 },
  "hip-flexor-stretch": { hold: 25 },
  "prone-press-up": { hold: 2 },
  "plank": { hold: 20 },

  // strength days
  "squat": { hold: 1, tempo: { 1: 2, 3: 1.75 } },
  "romanian-deadlift": { hold: 1, tempo: { 1: 2, 3: 1.75 } },
  "split-squat": { hold: 1, tempo: { 1: 2, 3: 1.75 } },
  "calf-raise": { hold: 1, tempo: { 1: 1.5, 3: 3.5 } },
  "glute-bridge": { hold: 2, tempo: { 1: 1.5, 3: 3.5 } },
  "push-up": { hold: 1, tempo: { 1: 2, 3: 1.75 } },
  "floor-press": { hold: 1, tempo: { 1: 1.5, 3: 2.3 } },
  "overhead-press": { hold: 1, tempo: { 1: 1.5, 3: 2.3 } },
  "lateral-raise": { hold: 1, tempo: { 1: 1.5, 3: 3.5 } },
  "triceps-extension": { hold: 1, tempo: { 1: 2, 3: 1.75 } },
  "biceps-curl": { hold: 1, tempo: { 1: 1.5, 3: 3.5 } },
  "bent-over-row": { hold: 1, tempo: { 1: 1.5, 3: 2.3 } },
  "pull-up": { hold: 1, tempo: { 1: 1.5, 3: 3.5 } },
};
