// Exercise keyframes for the strength days. Same format as moves.js (see its header).
// Standing lifts plant the feet with leg IK (legB: ankle in the room, knee direction, foot pitch),
// so the pelvis can drop or hinge without the feet sliding. A foot up on its ball gives `ball` (where the toe
// joint goes) in place of `p`, in every key of the move: `foot` then pitches the foot heel up about the ball,
// and the figure lays the toes flat on the ground unless the spec gives `toes` (degrees, positive = up).

const chest = (p, extra) => ({ f: "chest", p, ...extra });
const world = (p, extra) => ({ f: "world", p, ...extra });

// a dumbbell in each hand hanging at the sides, palms facing in
const HOLD = { f: "chest", p: [0.275, -0.3, 0.035], pole: [0.25, 0.1, -1], n: [-1, 0, 0.2], along: true, curl: "grip" };
// feet under the hips, soles flat
const FEET = { p: [0.071, 0.054, 0.002], pole: [0, 0, 1], foot: 0 };
const STAND = [0, 0.878, 0];

export const STRENGTH_BASES = {
  standIK: { root: { p: STAND, r: [0, 0, 0] }, aB: HOLD, legB: FEET },
  // face up on the mat, knees bent, feet flat, arms long on the floor
  supineIK: {
    root: { p: [0, 0.09, 0.3], r: [-90, 0, 0] }, legB: { p: [0.1, 0.066, 0.63], pole: [0, 1, 0.2], foot: 0 },
    aB: world([0.26, 0.018, 0.2], { pole: [1, 0, 0.2], n: [0, -1, 0], g: [0, 0, 1], curl: "flat" }),
  },
  // high plank: hands under the shoulders, on the balls of the feet with the toes flat on the mat (leg specs
  // give the ball, not the ankle), a straight line from heels to head
  plank: {
    root: { p: [0, 0.403, 0.019], r: [73, 0, 0] }, legB: { ball: [0.0738, 0.0235, -0.7405], pole: [0, -1, 0], foot: 60 },
    aB: world([0.24, 0.016, 0.5], { pole: [0.6, -1, -0.3], n: [0, -1, 0], g: [0, 0, 1], curl: "flat" }),
  },
  // hanging from the pull-up bar, knees bent so the feet stay clear of the floor
  hang: {
    root: { p: [0, 1.06, 0], r: [0, 0, 0] }, hipB: [14, 2], kneeB: 50, ankB: 25, shB: [0, 0.03, 0],
    aB: world([0.28, 2.1, -0.002], { pole: [1, -0.3, -0.2], n: [0, 0, 1], g: [0, 1, 0], curl: "grip" }),
  },
};

// four standard phases: set up, the lift, the pause, the return
const PH = (a, b, c, label) => [{ at: 0, step: 0 }, { at: a, step: 1, w: 1 }, { at: b, step: 2, label, w: 1 }, { at: c, step: 3, w: 1 }];

export const STRENGTH_MOVES = {
  // feet a little wider than the hips, knees out over the toes, arms forward to balance the hips going back
  "squat": {
    base: "standIK", props: [], dur: 5, view: { yaw: 135, pitch: 8 },
    rest: { legB: { p: [0.17, 0.054, 0.0], pole: [0.3, 0, 1], foot: 0 }, aB: chest([0.16, 0.245, 0.55], { pole: [1, -0.5, 0], n: [0, -1, 0], along: true, curl: "rest" }) },
    keys: [
      { t: 0, root: { p: [0, 0.865, 0], r: [0, 0, 0] } },
      { t: 0.1, root: { p: [0, 0.865, 0], r: [0, 0, 0] } },
      { t: 0.45, root: { p: [0, 0.42, -0.2], r: [30, 0, 0] }, lum: [10, 0, 0], thor: [5, 0, 0], neck: [-18, 0, 0], head: [-10, 0, 0], aB: chest([0.16, 0.634, 0.389], { pole: [1, -0.5, 0], n: [0, -0.7, 0.7], along: true, curl: "rest" }) },
      { t: 0.6, root: { p: [0, 0.42, -0.2], r: [30, 0, 0] }, lum: [10, 0, 0], thor: [5, 0, 0], neck: [-18, 0, 0], head: [-10, 0, 0], aB: chest([0.16, 0.634, 0.389], { pole: [1, -0.5, 0], n: [0, -0.7, 0.7], along: true, curl: "rest" }) },
      { t: 0.94, root: { p: [0, 0.865, 0], r: [0, 0, 0] } },
      { t: 1, root: { p: [0, 0.865, 0], r: [0, 0, 0] } },
    ],
    phases: PH(0.1, 0.45, 0.6, "Pause 1 s"),
  },

  // at the bottom the hands are placed in the room so the weights hang just in front of the shins
  "romanian-deadlift": {
    base: "standIK", props: ["weights"], dur: 5, view: { yaw: 120, pitch: 6 },
    rest: { legB: { ...FEET, p: [0.09, 0.054, 0.002] } },
    keys: [
      { t: 0, aB: chest([0.15, -0.33, 0.18], { pole: [0.6, 0, -1], n: [0, 0, -1], along: true, curl: "grip" }) },
      { t: 0.1, aB: chest([0.15, -0.33, 0.18], { pole: [0.6, 0, -1], n: [0, 0, -1], along: true, curl: "grip" }) },
      { t: 0.45, root: { p: [0, 0.78, -0.2], r: [78, 0, 0] }, thor: [4, 0, 0], neck: [-14, 0, 0], aB: world([0.13, 0.28, 0.21], { pole: [0.6, 0, -1], n: [0, 0, -1], g: [0, -1, 0], curl: "grip" }) },
      { t: 0.6, root: { p: [0, 0.78, -0.2], r: [78, 0, 0] }, thor: [4, 0, 0], neck: [-14, 0, 0], aB: world([0.13, 0.28, 0.21], { pole: [0.6, 0, -1], n: [0, 0, -1], g: [0, -1, 0], curl: "grip" }) },
      { t: 0.94, aB: chest([0.15, -0.33, 0.18], { pole: [0.6, 0, -1], n: [0, 0, -1], along: true, curl: "grip" }) },
      { t: 1, aB: chest([0.15, -0.33, 0.18], { pole: [0.6, 0, -1], n: [0, 0, -1], along: true, curl: "grip" }) },
    ],
    phases: PH(0.1, 0.45, 0.6, "Pause 1 s"),
  },

  // left foot forward; the back heel is up on the ball of the foot (its spec gives the ball, not the ankle),
  // the back knee stops about 1 cm off the floor
  "split-squat": {
    side: "L", base: "standIK", props: ["weights"], dur: 5, view: { yaw: 120, pitch: 8 },
    rest: { legL: { p: [0.09, 0.054, 0.33], pole: [0, 0, 1], foot: 0 }, legR: { ball: [-0.0959, 0.0116, -0.4635], pole: [0, -0.4, 1], foot: 50 } },
    keys: [
      { t: 0, root: { p: [0, 0.76, -0.02], r: [0, 0, 0] } },
      { t: 0.1, root: { p: [0, 0.76, -0.02], r: [0, 0, 0] } },
      { t: 0.45, root: { p: [0, 0.485, -0.02], r: [0, 0, 0] } },
      { t: 0.6, root: { p: [0, 0.485, -0.02], r: [0, 0, 0] } },
      { t: 0.94, root: { p: [0, 0.76, -0.02], r: [0, 0, 0] } },
      { t: 1, root: { p: [0, 0.76, -0.02], r: [0, 0, 0] } },
    ],
    phases: PH(0.1, 0.45, 0.6, "Pause 1 s"),
  },

  // the feet pivot on the balls (leg specs give the ball, not the ankle), so the heels rise, the ankles come up
  // and forward and the body goes with them; the toes stay flat on the floor
  "calf-raise": {
    base: "standIK", props: [], dur: 4, view: { yaw: 150, pitch: 6 },
    rest: { aB: { ...HOLD, curl: "rest" }, legB: { ball: [0.1237, 0.01, 0.0918], pole: [0, 0, 1], foot: 0 } },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.4, root: { p: [0, 0.934, 0.04], r: [0, 0, 0] }, legB: { ball: [0.1237, 0.01, 0.0918], pole: [0, 0, 1], foot: 40 } },
      { t: 0.56, root: { p: [0, 0.934, 0.04], r: [0, 0, 0] }, legB: { ball: [0.1237, 0.01, 0.0918], pole: [0, 0, 1], foot: 40 } },
      { t: 0.94 },
      { t: 1 },
    ],
    phases: PH(0.1, 0.4, 0.56, "Pause 1 s"),
  },

  // the pelvis rises and tilts about the shoulder blades; the neck bends so the head stays down
  "glute-bridge": {
    base: "supineIK", props: ["mat"], dur: 5, view: { yaw: 75, pitch: 12 },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.42, root: { p: [0, 0.284, 0.22], r: [-115, 0, 0] }, neck: [47, 0, 0], head: [10, 0, 0] },
      { t: 0.6, root: { p: [0, 0.284, 0.22], r: [-115, 0, 0] }, neck: [47, 0, 0], head: [10, 0, 0] },
      { t: 0.94 },
      { t: 1 },
    ],
    phases: PH(0.1, 0.42, 0.6, "Squeeze 2 s"),
  },

  // the body pivots on the balls of the feet, staying straight; hands stay planted under the shoulders
  "push-up": {
    base: "plank", props: ["mat"], dur: 4, view: { yaw: 40, pitch: 12 },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.45, root: { p: [0, 0.193, 0.075], r: [88, 0, 0] }, legB: { ball: [0.0738, 0.0235, -0.7405], pole: [0, -1, 0], foot: 68 } },
      { t: 0.58, root: { p: [0, 0.193, 0.075], r: [88, 0, 0] }, legB: { ball: [0.0738, 0.0235, -0.7405], pole: [0, -1, 0], foot: 68 } },
      { t: 0.94 },
      { t: 1 },
    ],
    phases: PH(0.1, 0.45, 0.58, "Pause 1 s"),
  },

  // upper arms rest on the floor at the bottom with the forearms upright, palms towards the feet
  "floor-press": {
    base: "supineIK", props: ["mat", "weights"], dur: 4, view: { yaw: 40, pitch: 30 },
    keys: [
      { t: 0, aB: chest([0.358, 0.049, 0.235], { pole: [0.5, -0.5, -1], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 0.1, aB: chest([0.358, 0.049, 0.235], { pole: [0.5, -0.5, -1], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 0.42, aB: chest([0.16, 0.22, 0.54], { pole: [1, -0.3, -0.2], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 0.56, aB: chest([0.16, 0.22, 0.54], { pole: [1, -0.3, -0.2], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 0.94, aB: chest([0.358, 0.049, 0.235], { pole: [0.5, -0.5, -1], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 1, aB: chest([0.358, 0.049, 0.235], { pole: [0.5, -0.5, -1], n: [0, -1, 0], along: true, curl: "grip" }) },
    ],
    phases: PH(0.1, 0.42, 0.56, "Pause 1 s"),
  },

  "overhead-press": {
    base: "standIK", props: ["weights"], dur: 4, view: { yaw: 30, pitch: 6, dist: 5.6, target: [0, 0.9, 0] },
    keys: [
      { t: 0, aB: chest([0.22, 0.32, 0.1], { pole: [0.4, -1, 0.3], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 0.1, aB: chest([0.22, 0.32, 0.1], { pole: [0.4, -1, 0.3], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 0.42, aB: chest([0.15, 0.8, 0.03], { pole: [1, 0, 0], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 0.56, aB: chest([0.15, 0.8, 0.03], { pole: [1, 0, 0], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 0.94, aB: chest([0.22, 0.32, 0.1], { pole: [0.4, -1, 0.3], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 1, aB: chest([0.22, 0.32, 0.1], { pole: [0.4, -1, 0.3], n: [0, 0, 1], along: true, curl: "grip" }) },
    ],
    phases: PH(0.1, 0.42, 0.56, "Pause 1 s"),
  },

  "lateral-raise": {
    base: "standIK", props: ["weights"], dur: 4, view: { yaw: 25, pitch: 6 },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.42, aB: chest([0.7, 0.22, 0.06], { pole: [0, 0.3, -1], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 0.56, aB: chest([0.7, 0.22, 0.06], { pole: [0, 0.3, -1], n: [0, -1, 0], along: true, curl: "grip" }) },
      { t: 0.94 },
      { t: 1 },
    ],
    phases: PH(0.1, 0.42, 0.56, "Pause 1 s"),
  },

  // the elbows point up throughout, so the weights travel behind the head, not in front of the face
  "triceps-extension": {
    base: "standIK", props: ["weights"], dur: 4, view: { yaw: 140, pitch: 6, dist: 5.6, target: [0, 0.9, 0] },
    keys: [
      { t: 0, aB: chest([0.13, 0.81, 0.0], { pole: [0.2, 1, 0.4], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 0.1, aB: chest([0.13, 0.81, 0.0], { pole: [0.2, 1, 0.4], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 0.45, aB: chest([0.125, 0.36, -0.185], { pole: [0.2, 1, 0.4], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 0.58, aB: chest([0.125, 0.36, -0.185], { pole: [0.2, 1, 0.4], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 0.94, aB: chest([0.13, 0.81, 0.0], { pole: [0.2, 1, 0.4], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 1, aB: chest([0.13, 0.81, 0.0], { pole: [0.2, 1, 0.4], n: [-1, 0, 0], along: true, curl: "grip" }) },
    ],
    phases: PH(0.1, 0.45, 0.58, "Pause 1 s"),
  },

  // palms forward at the bottom, turning to face the shoulders at the top; elbows stay at the sides
  "biceps-curl": {
    base: "standIK", props: ["weights"], dur: 4, view: { yaw: 30, pitch: 6 },
    keys: [
      { t: 0, aB: chest([0.25, -0.3, 0.06], { pole: [0.1, -0.2, -1], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 0.1, aB: chest([0.25, -0.3, 0.06], { pole: [0.1, -0.2, -1], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 0.42, aB: chest([0.2, 0.18, 0.15], { pole: [0.1, -1, -0.3], at: [0.17, 0.25, 0], along: true, curl: "grip" }) },
      { t: 0.56, aB: chest([0.2, 0.18, 0.15], { pole: [0.1, -1, -0.3], at: [0.17, 0.25, 0], along: true, curl: "grip" }) },
      { t: 0.94, aB: chest([0.25, -0.3, 0.06], { pole: [0.1, -0.2, -1], n: [0, 0, 1], along: true, curl: "grip" }) },
      { t: 1, aB: chest([0.25, -0.3, 0.06], { pole: [0.1, -0.2, -1], n: [0, 0, 1], along: true, curl: "grip" }) },
    ],
    phases: PH(0.1, 0.42, 0.56, "Pause 1 s"),
  },

  "bent-over-row": {
    base: "standIK", props: ["weights"], dur: 4, view: { yaw: 150, pitch: 20 },
    rest: { root: { p: [0, 0.81, -0.15], r: [56, 0, 0] }, thor: [5, 0, 0], neck: [-12, 0, 0], legB: { ...FEET, p: [0.1, 0.054, 0.002] } },
    keys: [
      { t: 0, aB: chest([0.18, -0.03, 0.45], { pole: [0.3, 0, -1], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 0.1, aB: chest([0.18, -0.03, 0.45], { pole: [0.3, 0, -1], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 0.4, aB: chest([0.24, -0.12, 0.1], { pole: [0.2, 0.3, -1], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [-0.012, 0, -0.03] },
      { t: 0.56, aB: chest([0.24, -0.12, 0.1], { pole: [0.2, 0.3, -1], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [-0.012, 0, -0.03] },
      { t: 0.94, aB: chest([0.18, -0.03, 0.45], { pole: [0.3, 0, -1], n: [-1, 0, 0], along: true, curl: "grip" }) },
      { t: 1, aB: chest([0.18, -0.03, 0.45], { pole: [0.3, 0, -1], n: [-1, 0, 0], along: true, curl: "grip" }) },
    ],
    phases: PH(0.1, 0.4, 0.56, "Squeeze 1 s"),
  },

  // hands round the bar (y = 2.1, z = 0.02), palms forward; the legs hang with the knees a little bent
  "pull-up": {
    base: "hang", props: ["bar"], dur: 5, view: { yaw: 160, pitch: 6, dist: 6, target: [0, 1.25, 0] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.45, root: { p: [0, 1.52, -0.08], r: [-6, 0, 0] }, neck: [-8, 0, 0], head: [-6, 0, 0], shB: [-0.01, -0.01, -0.02], aB: world([0.28, 2.1, -0.002], { pole: [0.8, -1, 0.2], n: [0, 0, 1], g: [0, 1, 0], curl: "grip" }) },
      { t: 0.58, root: { p: [0, 1.52, -0.08], r: [-6, 0, 0] }, neck: [-8, 0, 0], head: [-6, 0, 0], shB: [-0.01, -0.01, -0.02], aB: world([0.28, 2.1, -0.002], { pole: [0.8, -1, 0.2], n: [0, 0, 1], g: [0, 1, 0], curl: "grip" }) },
      { t: 0.94 },
      { t: 1 },
    ],
    phases: PH(0.1, 0.45, 0.58, "Pause 1 s"),
  },
};
