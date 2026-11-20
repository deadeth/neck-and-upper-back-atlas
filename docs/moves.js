// Keyframes for every exercise. Units are metres, angles in degrees.
//
// Figure space: X to the figure's left, Y up, Z forward.
// Joint angles are [x, y, z]: +x bends forward, +y turns left, +z tilts to the right.
//
// Arms are placed by inverse kinematics from a hand spec:
//   f     frame the numbers are in: "chest" (origin at the T12/L1 joint), "head" (where the skull sits
//         on C1), "neck" (C7), "pelvis" (between the hips), "thigh" (that side's hip joint, femur
//         running down -Y) or "world"
//   p     where the centre of the palm goes
//   n     the way the palm faces, or `at`: a point the palm faces
//   g     the way the fingers point; left out, they follow the forearm
//   along true = keep the fingers in line with the forearm and square the palm to that
//   snap  true = slide p along n onto the bone under it, stopping `clear` metres short (default 0.016)
//   pole  which way the elbow points (always in the chest frame)
//   curl  finger shape: "rest", "flat", "cup", "wrap", "hook", "grip"
// Between two keys the arm is blended joint by joint, so the hand swings round the body.
// aB sets both arms from a left-arm spec (mirrored for the right). shB does the same for shoulders.
//
// A key only lists what differs from the base pose plus the move's `rest`.
// side: "L" when only the left side is being worked, so only that side lights up.
// start: "close" opens framed on the neck and shoulders. view: the camera angle that shows the worked muscle.
// phases: which step of the instructions is on screen from `at` onward. w marks the working phase.

import { CORE_BASES, CORE_MOVES } from "./moves-core.js";
import { STRENGTH_BASES, STRENGTH_MOVES } from "./moves-strength.js";

export const SEAT = 0.41;   // stool height
const SKULL = [0, 0.065, 0.015];   // a point inside the skull, in the head frame, for palms to face

const HANG = { f: "chest", p: [0.255, -0.3, 0.035], pole: [0.25, 0.1, -1], n: [-1, 0, 0.2], along: true };
const HOLD = { ...HANG, p: [0.275, -0.3, 0.035], curl: "grip" };                                       // the same, holding a weight
const LAP = { f: "thigh", p: [-0.008, -0.3, 0.06], n: [0, 0, -1], g: [0.1, -1, 0], snap: true, pole: [0.7, 0.2, -1], curl: "cup" };
const SEAT_L = { f: "world", p: [0.185, SEAT + 0.019, 0.06], n: [0, -1, 0], g: [1, 0, 0.1], pole: [0.3, 0, -1], curl: "hook" };
// hands behind the head: left palm on the skull, right hand laid over the left's fingers
const BEHIND_L = { f: "head", p: [0.052, 0.088, -0.08], at: SKULL, g: [-1, 0.15, 0], snap: true, pole: [1, -0.5, 0.6], curl: "wrap" };
const BEHIND_R = { f: "head", p: [-0.052, 0.068, -0.08], at: SKULL, g: [1, 0.15, 0], snap: true, clear: 0.036, pole: [-1, -0.5, 0.6], curl: "wrap" };
const BEHIND = { aL: BEHIND_L, aR: BEHIND_R };
// waypoint beside the ear, so a hand heading behind the head goes round the skull
const BESIDE_L = { f: "head", p: [0.21, 0.07, 0.0], at: SKULL, g: [-0.2, 1, -0.2], pole: [0.6, -1, 0.3] };
const BESIDE_R = { f: "head", p: [-0.21, 0.07, 0.0], at: SKULL, g: [0.2, 1, -0.2], pole: [-0.6, -1, 0.3] };
const ON_HEAD = { f: "head", p: [0.04, 0.16, 0.0], at: SKULL, g: [1, 0.05, -0.1], snap: true, pole: [-1, 0.7, 0.2], curl: "rest" };
const BACK_OF_HEAD = { f: "head", p: [0.012, 0.115, -0.09], at: SKULL, g: [0.9, 0.45, 0], snap: true, pole: [-0.8, 0.2, 0.6], curl: "wrap" };

// palms on the floor when lying down: the floor sits at chest z = +0.122 face down, -0.084 face up
const PRONE_ARM = { f: "chest", p: [0.26, -0.3, 0.104], n: [0, 0, 1], g: [0, -1, 0], pole: [0.1, 0, -1], curl: "flat" };
const SUPINE_ARM = { f: "chest", p: [0.27, -0.3, -0.066], n: [0, 0, -1], g: [0, -1, 0], pole: [1, 0, 0.2], curl: "flat" };

export const BASES = {
  stand: { root: { p: [0, 0.882, 0], r: [0, 0, 0] }, aB: HANG },
  sit: { root: { p: [0, SEAT + 0.06, 0], r: [0, 0, 0] }, hipB: [90, 5], kneeB: 90, aB: LAP },
  prone: { root: { p: [0, 0.14, 0.05], r: [90, 0, 0] }, ankB: 40, aB: PRONE_ARM },
  supine: { root: { p: [0, 0.09, 0.3], r: [-90, 0, 0] }, hipB: [55, 0], kneeB: 122, ankB: -22, aB: SUPINE_ARM },
};

const tilt = (n, h) => ({ neck: [0, 0, n], head: [0, 0, h] });
const chest = (p, extra) => ({ f: "chest", p, ...extra });

export const MOVES = {
  "chin-tuck": {
    start: "close", base: "sit", props: ["stool"], dur: 7, view: { yaw: 82, pitch: 6 },
    keys: [
      { t: 0, neck: [9, 0, 0], head: [-7, 0, 0] },
      { t: 0.12, neck: [9, 0, 0], head: [-7, 0, 0] },
      { t: 0.32, neck: [-10, 0, 0], head: [11, 0, 0] },
      { t: 0.74, neck: [-10, 0, 0], head: [11, 0, 0] },
      { t: 0.92, neck: [9, 0, 0], head: [-7, 0, 0] },
      { t: 1, neck: [9, 0, 0], head: [-7, 0, 0] },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.12, step: 1 }, { at: 0.32, step: 2, label: "Hold 5 s", w: 1 }, { at: 0.74, step: 3 }],
  },

  "supine-nod": {
    base: "supine", props: ["mat"], dur: 8, view: { yaw: 100, pitch: 14 },
    keys: [
      { t: 0, head: [0, 0, 0] },
      { t: 0.12, head: [0, 0, 0] },
      { t: 0.3, head: [14, 0, 0] },
      { t: 0.78, head: [14, 0, 0] },
      { t: 0.94, head: [0, 0, 0] },
      { t: 1, head: [0, 0, 0] },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.12, step: 1 }, { at: 0.3, step: 2, label: "Hold 10 s", w: 1 }, { at: 0.78, step: 3 }],
  },

  "upper-trap-stretch": {
    side: "L", start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 160, pitch: 8 },
    rest: { aL: SEAT_L, shL: [0, -0.02, 0] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.24, aR: ON_HEAD },
      { t: 0.4, aR: ON_HEAD, ...tilt(17, 17) },
      { t: 0.76, aR: ON_HEAD, ...tilt(17, 17) },
      { t: 0.86, aR: ON_HEAD },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.24, step: 2 }, { at: 0.4, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.76, step: 3 }],
  },

  "levator-stretch": {
    side: "L", start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 150, pitch: 10 },
    rest: { aL: SEAT_L, shL: [0, -0.02, 0] },
    keys: [
      { t: 0 },
      { t: 0.08 },
      { t: 0.22, neck: [0, -22, 0], head: [0, -23, 0] },
      { t: 0.39, neck: [9, -22, 0], head: [9, -23, 0], aR: BESIDE_R, e: "i" },
      { t: 0.46, neck: [17, -22, 0], head: [18, -23, 0], aR: BACK_OF_HEAD, e: "o" },
      { t: 0.74, neck: [17, -22, 0], head: [18, -23, 0], aR: BACK_OF_HEAD },
      { t: 0.8, neck: [9, -18, 0], head: [9, -18, 0], aR: BESIDE_R, e: "i" },
      { t: 0.96, neck: [0, -4, 0], head: [0, -4, 0], e: "o" },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1 }, { at: 0.22, step: 2 }, { at: 0.46, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.74, step: 3 }],
  },

  "scm-stretch": {
    side: "L", start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 22, pitch: 5 },
    // right palm on the left collarbone, left hand pressed over it
    rest: {
      aR: chest([0.072, 0.268, 0.07], { n: [0, -0.25, -1], g: [1, 0.2, 0], snap: true, pole: [-0.6, -1, 0.2], curl: "cup" }),
      aL: chest([0.088, 0.262, 0.07], { n: [0, -0.25, -1], g: [-1, 0.3, 0], snap: true, clear: 0.036, pole: [0.8, -1, 0.1], curl: "cup" }),
    },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.26, neck: [0, 0, 13], head: [0, 0, 12] },
      { t: 0.42, neck: [-5, 12, 13], head: [-8, 14, 12] },
      { t: 0.8, neck: [-5, 12, 13], head: [-8, 14, 12] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.26, step: 2 }, { at: 0.42, step: 2, label: "Hold 20 s", w: 1 }, { at: 0.8, step: 3 }],
  },

  "scalene-stretch": {
    side: "L", start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 34, pitch: 5 },
    rest: { aL: SEAT_L, shL: [0, -0.025, 0] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.28, neck: [0, 0, 15], head: [0, 0, 15] },
      { t: 0.42, neck: [-4, 6, 15], head: [-7, 6, 15] },
      { t: 0.8, neck: [-4, 6, 15], head: [-7, 6, 15] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.28, step: 2 }, { at: 0.42, step: 2, label: "Hold 20 s", w: 1 }, { at: 0.8, step: 3 }],
  },

  "neck-flexion-stretch": {
    start: "close", base: "sit", props: ["stool"], dur: 10, view: { yaw: 118, pitch: 8 },
    keys: [
      { t: 0 },
      { t: 0.12, aL: BESIDE_L, aR: BESIDE_R, e: "i" },
      { t: 0.19, ...BEHIND, e: "o" },
      { t: 0.28, ...BEHIND, neck: [-4, 0, 0], head: [8, 0, 0] },
      { t: 0.44, ...BEHIND, neck: [24, 0, 0], head: [24, 0, 0] },
      { t: 0.7, ...BEHIND, neck: [24, 0, 0], head: [24, 0, 0] },
      { t: 0.8, ...BEHIND },
      { t: 0.87, aL: BESIDE_L, aR: BESIDE_R, e: "i" },
      { t: 1, e: "o" },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.19, step: 1 }, { at: 0.44, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.7, step: 3 }],
  },

  "neck-rotation": {
    start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 152, pitch: 8 },
    keys: [
      { t: 0 },
      { t: 0.06 },
      { t: 0.24, neck: [0, -32, 0], head: [0, -34, 0] },
      { t: 0.36, neck: [0, -32, 0], head: [0, -34, 0] },
      { t: 0.54 },
      { t: 0.72, neck: [0, 32, 0], head: [0, 34, 0] },
      { t: 0.84, neck: [0, 32, 0], head: [0, 34, 0] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.06, step: 1, w: 1 }, { at: 0.36, step: 2 }, { at: 0.54, step: 3, w: 1 }],
  },

  "iso-extension": {
    start: "close", base: "sit", props: ["stool"], dur: 8, view: { yaw: 118, pitch: 8 },
    rest: BEHIND,
    keys: [
      { t: 0, neck: [-2, 0, 0], head: [4, 0, 0] },
      { t: 0.18, neck: [-2, 0, 0], head: [4, 0, 0] },
      { t: 0.28, neck: [-5, 0, 0], head: [3, 0, 0] },
      { t: 0.78, neck: [-5, 0, 0], head: [3, 0, 0] },
      { t: 0.9, neck: [-2, 0, 0], head: [4, 0, 0] },
      { t: 1, neck: [-2, 0, 0], head: [4, 0, 0] },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.18, step: 1 }, { at: 0.28, step: 2, label: "Hold 5 to 10 s", w: 1 }, { at: 0.78, step: 3 }],
  },

  "shrug": {
    base: "stand", props: ["weights"], dur: 6, view: { yaw: 158, pitch: 8 },
    rest: { aB: HOLD },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.32, shB: [-0.006, 0.05, 0], aB: { ...HOLD, p: [0.272, -0.25, 0.035] } },
      { t: 0.46, shB: [-0.006, 0.05, 0], aB: { ...HOLD, p: [0.272, -0.25, 0.035] } },
      { t: 0.92 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.32, step: 2, w: 1 }, { at: 0.46, step: 3, w: 1 }],
  },

  "band-row": {
    base: "stand", props: ["bandFront"], dur: 6, view: { yaw: 122, pitch: 10, dist: 5.6, target: [0, 0.8, 0.4] },
    keys: [
      { t: 0, aB: chest([0.14, 0.13, 0.5], { pole: [0.6, -1, 0], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [0, 0, 0.02] },
      { t: 0.1, aB: chest([0.14, 0.13, 0.5], { pole: [0.6, -1, 0], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [0, 0, 0.02] },
      { t: 0.38, aB: chest([0.2, 0.02, 0.17], { pole: [0.25, -0.5, -1], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [-0.012, 0, -0.03] },
      { t: 0.56, aB: chest([0.2, 0.02, 0.17], { pole: [0.25, -0.5, -1], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [-0.012, 0, -0.03] },
      { t: 0.94, aB: chest([0.14, 0.13, 0.5], { pole: [0.6, -1, 0], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [0, 0, 0.02] },
      { t: 1, aB: chest([0.14, 0.13, 0.5], { pole: [0.6, -1, 0], n: [-1, 0, 0], along: true, curl: "grip" }), shB: [0, 0, 0.02] },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.38, step: 2, w: 1 }, { at: 0.56, step: 3 }],
  },

  // thumbs up: the palm faces towards the head, the hand resting on its little-finger edge
  "prone-t": {
    base: "prone", props: ["mat"], dur: 6, view: { yaw: 148, pitch: 34, dist: 4.8 },
    keys: [
      { t: 0, aB: chest([0.72, 0.245, 0.082], { pole: [0, -1, 0], n: [0, 1, 0], g: [1, 0, 0] }) },
      { t: 0.12, aB: chest([0.72, 0.245, 0.082], { pole: [0, -1, 0], n: [0, 1, 0], g: [1, 0, 0] }) },
      { t: 0.36, aB: chest([0.715, 0.245, -0.02], { pole: [0, -1, 0], n: [0, 1, 0], g: [1, 0, -0.1] }), shB: [-0.012, 0, -0.028] },
      { t: 0.6, aB: chest([0.715, 0.245, -0.02], { pole: [0, -1, 0], n: [0, 1, 0], g: [1, 0, -0.1] }), shB: [-0.012, 0, -0.028] },
      { t: 0.94, aB: chest([0.72, 0.245, 0.082], { pole: [0, -1, 0], n: [0, 1, 0], g: [1, 0, 0] }) },
      { t: 1, aB: chest([0.72, 0.245, 0.082], { pole: [0, -1, 0], n: [0, 1, 0], g: [1, 0, 0] }) },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.12, step: 1, w: 1 }, { at: 0.36, step: 2, label: "Hold 2 s", w: 1 }, { at: 0.6, step: 3 }],
  },

  "prone-y": {
    base: "prone", props: ["mat"], dur: 7, view: { yaw: 148, pitch: 34, dist: 5.0, target: [0, -0.05, 0.25] },
    keys: [
      { t: 0, aB: chest([0.41, 0.775, 0.082], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }) },
      { t: 0.1, aB: chest([0.41, 0.775, 0.082], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }) },
      { t: 0.24, aB: chest([0.41, 0.762, 0.082], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }), shB: [0, -0.022, 0] },
      { t: 0.44, aB: chest([0.41, 0.757, -0.02], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }), shB: [-0.006, -0.022, -0.02] },
      { t: 0.66, aB: chest([0.41, 0.757, -0.02], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }), shB: [-0.006, -0.022, -0.02] },
      { t: 0.94, aB: chest([0.41, 0.775, 0.082], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }) },
      { t: 1, aB: chest([0.41, 0.775, 0.082], { pole: [1, 0, 0], n: [-0.9, 0.42, 0], along: true }) },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.24, step: 2, w: 1 }, { at: 0.44, step: 2, label: "Hold 2 s", w: 1 }, { at: 0.66, step: 3 }],
  },

  // backs of the hands against the wall, which stands at chest z = -0.116
  "wall-angel": {
    base: "stand", props: ["wall"], dur: 7, view: { yaw: 156, pitch: 8 },
    rest: { neck: [-3, 0, 0], head: [4, 0, 0] },
    keys: [
      { t: 0, aB: chest([0.43, 0.44, -0.098], { pole: [0.8, -1, -0.15], n: [0, 0, 1], g: [0.1, 1, 0], curl: "flat" }) },
      { t: 0.14, aB: chest([0.43, 0.44, -0.098], { pole: [0.8, -1, -0.15], n: [0, 0, 1], g: [0.1, 1, 0], curl: "flat" }) },
      { t: 0.5, aB: chest([0.38, 0.75, -0.098], { pole: [0.8, -1, -0.15], n: [0, 0, 1], g: [0.35, 1, 0], curl: "flat" }) },
      { t: 0.62, aB: chest([0.38, 0.75, -0.098], { pole: [0.8, -1, -0.15], n: [0, 0, 1], g: [0.35, 1, 0], curl: "flat" }) },
      { t: 0.96, aB: chest([0.43, 0.44, -0.098], { pole: [0.8, -1, -0.15], n: [0, 0, 1], g: [0.1, 1, 0], curl: "flat" }) },
      { t: 1, aB: chest([0.43, 0.44, -0.098], { pole: [0.8, -1, -0.15], n: [0, 0, 1], g: [0.1, 1, 0], curl: "flat" }) },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.14, step: 1, w: 1 }, { at: 0.5, step: 2, w: 1 }, { at: 0.62, step: 3, w: 1 }],
  },

  // palms pressed together, reaching forward
  "rhomboid-stretch": {
    start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 126, pitch: 12 },
    keys: [
      { t: 0 },
      { t: 0.06 },
      { t: 0.22, aB: chest([0.016, 0.17, 0.4], { pole: [1, -0.6, 0], n: [-1, 0, 0], g: [0, 0, 1], curl: "flat" }) },
      { t: 0.44, aB: chest([0.016, 0.12, 0.55], { pole: [1, -0.5, 0], n: [-1, 0, 0], g: [0, 0, 1], curl: "flat" }), thor: [20, 0, 0], neck: [10, 0, 0], head: [14, 0, 0], shB: [0.008, 0, 0.045] },
      { t: 0.8, aB: chest([0.016, 0.12, 0.55], { pole: [1, -0.5, 0], n: [-1, 0, 0], g: [0, 0, 1], curl: "flat" }), thor: [20, 0, 0], neck: [10, 0, 0], head: [14, 0, 0], shB: [0.008, 0, 0.045] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.22, step: 1 }, { at: 0.36, step: 2 }, { at: 0.44, step: 2, label: "Hold 20 s", w: 1 }, { at: 0.8, step: 3 }],
  },

  "external-rotation": {
    side: "L", base: "stand", props: ["bandSide"], dur: 6, view: { yaw: 150, pitch: 10, dist: 5.6, target: [-0.3, 0.74, 0] },
    keys: [
      { t: 0, aL: chest([0.03, -0.03, 0.26], { pole: [0.4, -1, -0.5], n: [-1, 0, 0.6], along: true, curl: "grip" }) },
      { t: 0.1, aL: chest([0.03, -0.03, 0.26], { pole: [0.4, -1, -0.5], n: [-1, 0, 0.6], along: true, curl: "grip" }) },
      { t: 0.27, aL: chest([0.22, -0.03, 0.3], { pole: [0.1, -1, -0.55], n: [-1, 0, 0.6], along: true, curl: "grip" }), e: "i" },
      { t: 0.44, aL: chest([0.4, -0.03, 0.2], { pole: [-0.2, -1, -0.6], n: [-1, 0, 0.6], along: true, curl: "grip" }), e: "o" },
      { t: 0.58, aL: chest([0.4, -0.03, 0.2], { pole: [-0.2, -1, -0.6], n: [-1, 0, 0.6], along: true, curl: "grip" }) },
      { t: 0.77, aL: chest([0.22, -0.03, 0.3], { pole: [0.1, -1, -0.55], n: [-1, 0, 0.6], along: true, curl: "grip" }), e: "i" },
      { t: 0.96, aL: chest([0.03, -0.03, 0.26], { pole: [0.4, -1, -0.5], n: [-1, 0, 0.6], along: true, curl: "grip" }), e: "o" },
      { t: 1, aL: chest([0.03, -0.03, 0.26], { pole: [0.4, -1, -0.5], n: [-1, 0, 0.6], along: true, curl: "grip" }) },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.44, step: 2, w: 1 }, { at: 0.58, step: 3 }],
  },

  // left arm across the chest, right palm pressing it in just above the elbow
  "cross-body-stretch": {
    side: "L", base: "stand", props: [], dur: 9, view: { yaw: 142, pitch: 8 },
    keys: [
      { t: 0 },
      { t: 0.06 },
      { t: 0.24, aL: chest([-0.2, 0.22, 0.22], { pole: [0, -1, 0.4], n: [0.3, 0, -1], along: true }) },
      { t: 0.4, aL: chest([-0.27, 0.225, 0.17], { pole: [0, -1, 0.4], n: [0.3, 0, -1], along: true }), aR: chest([-0.02, 0.235, 0.155], { pole: [-0.5, -1, 0.3], n: [0.2, 0, -1], g: [1, 0.25, 0.2], curl: "cup" }) },
      { t: 0.82, aL: chest([-0.27, 0.225, 0.17], { pole: [0, -1, 0.4], n: [0.3, 0, -1], along: true }), aR: chest([-0.02, 0.235, 0.155], { pole: [-0.5, -1, 0.3], n: [0.2, 0, -1], g: [1, 0.25, 0.2], curl: "cup" }) },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.24, step: 1 }, { at: 0.4, step: 2, label: "Hold 30 s", w: 1 }, { at: 0.82, step: 3 }],
  },

  "scaption": {
    base: "stand", props: ["weights"], dur: 7, view: { yaw: 152, pitch: 10 },
    rest: { aB: HOLD },
    keys: [
      { t: 0 },
      { t: 0.08 },
      { t: 0.24, aB: chest([0.5, -0.16, 0.19], { pole: [0, 0, -1], n: [-0.5, 0, 0.87], along: true, curl: "grip" }), e: "i" },
      { t: 0.4, aB: chest([0.645, 0.25, 0.275], { pole: [0, 0, -1], n: [-0.5, 0, 0.87], along: true, curl: "grip" }), e: "o" },
      { t: 0.54, aB: chest([0.645, 0.25, 0.275], { pole: [0, 0, -1], n: [-0.5, 0, 0.87], along: true, curl: "grip" }) },
      { t: 0.74, aB: chest([0.5, -0.16, 0.19], { pole: [0, 0, -1], n: [-0.5, 0, 0.87], along: true, curl: "grip" }), e: "i" },
      { t: 0.94, e: "o" },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1, w: 1 }, { at: 0.4, step: 2, w: 1 }, { at: 0.54, step: 3, w: 1 }],
  },

  "thoracic-extension": {
    base: "sit", props: ["chair"], dur: 7, view: { yaw: 104, pitch: 6 },
    rest: { aL: { ...BEHIND_L, pole: [1, -0.4, 0.8] }, aR: { ...BEHIND_R, pole: [-1, -0.4, 0.8] } },
    keys: [
      { t: 0 },
      { t: 0.14 },
      { t: 0.46, lum: [-4, 0, 0], thor: [-24, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0] },
      { t: 0.66, lum: [-4, 0, 0], thor: [-24, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.06, step: 1 }, { at: 0.14, step: 2, w: 1 }, { at: 0.66, step: 3 }],
  },

  // arms by the sides, palms down; on the lift the thumbs turn up and the palms face out
  "prone-cobra": {
    base: "prone", props: ["mat"], dur: 8, view: { yaw: 118, pitch: 18, dist: 4.9, target: [0, -0.05, -0.05] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.24, aB: { ...PRONE_ARM, p: [0.26, -0.3, 0.09], n: [0.4, 0, 0.9], pole: [-0.4, 0, -1], curl: "rest" }, shB: [-0.012, -0.02, -0.02] },
      { t: 0.44, aB: { ...PRONE_ARM, p: [0.27, -0.3, 0.02], n: [1, 0, 0.1], pole: [-1, 0, -0.6], curl: "rest" }, shB: [-0.012, -0.02, -0.03], lum: [-7, 0, 0], thor: [-13, 0, 0], neck: [-9, 0, 0], head: [9, 0, 0] },
      { t: 0.76, aB: { ...PRONE_ARM, p: [0.27, -0.3, 0.02], n: [1, 0, 0.1], pole: [-1, 0, -0.6], curl: "rest" }, shB: [-0.012, -0.02, -0.03], lum: [-7, 0, 0], thor: [-13, 0, 0], neck: [-9, 0, 0], head: [9, 0, 0] },
      { t: 0.96 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.24, step: 2, w: 1 }, { at: 0.44, step: 2, label: "Hold 5 to 10 s", w: 1 }, { at: 0.76, step: 3 }],
  },
};

Object.assign(BASES, CORE_BASES, STRENGTH_BASES);
Object.assign(MOVES, CORE_MOVES, STRENGTH_MOVES);
