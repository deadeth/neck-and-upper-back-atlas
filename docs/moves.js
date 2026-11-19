// Keyframes for every exercise. Units are metres, angles in degrees.
//
// Figure space: X to the figure's left, Y up, Z forward.
// Joint angles are [x, y, z]: +x bends forward, +y turns left, +z tilts to the right.
// Arms are placed by inverse kinematics: { f: frame, p: palm position, pole: elbow direction, tw: forearm turn }.
//   frames: "chest" (origin at the T12/L1 joint), "head" (origin where the skull sits on C1),
//   "neck" (C7), "pelvis" (midway between the hips), "world". The pole is always in the chest frame.
//   tw is pronation from the scanned pose: 0 = palm forward, 90 = thumb forward, 180 = palm back.
//   aB sets both arms from a left-arm spec (mirrored for the right). shB does the same for shoulders.
// A key only lists what differs from the base pose plus the move's `rest`.
// side: "L" when only the left side is being worked, so only that side lights up.
// start: "close" opens framed on the neck and shoulders. view: the camera angle that shows the worked muscle.
// phases: which step of the instructions is on screen from `at` onward. w marks the working phase.

export const SEAT = 0.41;   // stool height
const HANG = { f: "chest", p: [0.258, -0.312, 0.045], pole: [0.25, 0.1, -1], tw: 75 };
const LAP = { f: "pelvis", p: [0.09, 0.045, 0.3], pole: [0.7, 0.2, -1], tw: 170 };
const SEAT_L = { f: "world", p: [0.225, SEAT + 0.005, 0.0], pole: [0.3, 0, -1], tw: 80 };
const BEHIND_HEAD = { f: "head", p: [0.035, 0.07, -0.1], pole: [1, -0.5, 0.6], tw: 30 };
const ON_HEAD = { f: "head", p: [0.04, 0.15, 0.005], pole: [-1, 0.7, 0.2], tw: 60 };

export const BASES = {
  stand: { root: { p: [0, 0.882, 0], r: [0, 0, 0] }, aB: HANG },
  sit: { root: { p: [0, SEAT + 0.06, 0], r: [0, 0, 0] }, hipB: [90, 5], kneeB: 90, aB: LAP },
  prone: { root: { p: [0, 0.14, 0.05], r: [90, 0, 0] }, ankB: 40, aB: { f: "chest", p: [0.26, -0.3, 0.125], pole: [1, 0, -0.3], tw: 170 } },
  supine: { root: { p: [0, 0.09, 0.3], r: [-90, 0, 0] }, hipB: [55, 0], kneeB: 122, ankB: -22, aB: { f: "chest", p: [0.27, -0.3, -0.06], pole: [1, 0, 0.2], tw: 170 } },
};

const tilt = (n, h) => ({ neck: [0, 0, n], head: [0, 0, h] });

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
      { t: 0.8, aR: ON_HEAD, ...tilt(17, 17) },
      { t: 0.92, aR: ON_HEAD },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.24, step: 2 }, { at: 0.4, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.8, step: 3 }],
  },

  "levator-stretch": {
    side: "L", start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 150, pitch: 10 },
    rest: { aL: SEAT_L, shL: [0, -0.02, 0] },
    keys: [
      { t: 0 },
      { t: 0.08 },
      { t: 0.22, neck: [0, -22, 0], head: [0, -23, 0] },
      { t: 0.4, neck: [17, -22, 0], head: [18, -23, 0], aR: { f: "head", p: [0.01, 0.12, -0.092], pole: [-0.8, 0.2, 0.6], tw: 40 } },
      { t: 0.8, neck: [17, -22, 0], head: [18, -23, 0], aR: { f: "head", p: [0.01, 0.12, -0.092], pole: [-0.8, 0.2, 0.6], tw: 40 } },
      { t: 0.92, neck: [0, -10, 0], head: [0, -10, 0] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1 }, { at: 0.22, step: 2 }, { at: 0.4, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.8, step: 3 }],
  },

  "scm-stretch": {
    side: "L", start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 22, pitch: 5 },
    rest: {
      aR: { f: "chest", p: [0.07, 0.262, 0.085], pole: [-0.6, -1, 0.2], tw: 150 },
      aL: { f: "chest", p: [0.1, 0.24, 0.09], pole: [0.8, -1, 0.1], tw: 150 },
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
    start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 118, pitch: 8 },
    keys: [
      { t: 0 },
      { t: 0.16, aB: BEHIND_HEAD },
      { t: 0.26, aB: BEHIND_HEAD, neck: [-4, 0, 0], head: [8, 0, 0] },
      { t: 0.44, aB: BEHIND_HEAD, neck: [24, 0, 0], head: [24, 0, 0] },
      { t: 0.8, aB: BEHIND_HEAD, neck: [24, 0, 0], head: [24, 0, 0] },
      { t: 0.92, aB: BEHIND_HEAD },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.16, step: 1 }, { at: 0.44, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.8, step: 3 }],
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
    rest: { aB: BEHIND_HEAD },
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
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.32, shB: [-0.006, 0.05, 0], aB: { f: "chest", p: [0.255, -0.262, 0.045], pole: [0.25, 0.1, -1], tw: 75 } },
      { t: 0.46, shB: [-0.006, 0.05, 0], aB: { f: "chest", p: [0.255, -0.262, 0.045], pole: [0.25, 0.1, -1], tw: 75 } },
      { t: 0.92 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.32, step: 2, w: 1 }, { at: 0.46, step: 3, w: 1 }],
  },

  "band-row": {
    base: "stand", props: ["bandFront"], dur: 6, view: { yaw: 122, pitch: 10, dist: 5.6, target: [0, 0.8, 0.4] },
    keys: [
      { t: 0, aB: { f: "chest", p: [0.14, 0.13, 0.52], pole: [0.6, -1, 0], tw: 90 }, shB: [0, 0, 0.02] },
      { t: 0.1, aB: { f: "chest", p: [0.14, 0.13, 0.52], pole: [0.6, -1, 0], tw: 90 }, shB: [0, 0, 0.02] },
      { t: 0.38, aB: { f: "chest", p: [0.2, 0.02, 0.16], pole: [0.25, -0.5, -1], tw: 90 }, shB: [-0.012, 0, -0.03] },
      { t: 0.56, aB: { f: "chest", p: [0.2, 0.02, 0.16], pole: [0.25, -0.5, -1], tw: 90 }, shB: [-0.012, 0, -0.03] },
      { t: 0.94, aB: { f: "chest", p: [0.14, 0.13, 0.52], pole: [0.6, -1, 0], tw: 90 }, shB: [0, 0, 0.02] },
      { t: 1, aB: { f: "chest", p: [0.14, 0.13, 0.52], pole: [0.6, -1, 0], tw: 90 }, shB: [0, 0, 0.02] },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.38, step: 2, w: 1 }, { at: 0.56, step: 3 }],
  },

  "prone-t": {
    base: "prone", props: ["mat"], dur: 6, view: { yaw: 148, pitch: 34, dist: 4.8 },
    keys: [
      { t: 0, aB: { f: "chest", p: [0.725, 0.245, 0.125], pole: [0, -1, 0], tw: 90 } },
      { t: 0.12, aB: { f: "chest", p: [0.725, 0.245, 0.125], pole: [0, -1, 0], tw: 90 } },
      { t: 0.36, aB: { f: "chest", p: [0.72, 0.245, 0.01], pole: [0, -1, 0], tw: 90 }, shB: [-0.012, 0, -0.028] },
      { t: 0.6, aB: { f: "chest", p: [0.72, 0.245, 0.01], pole: [0, -1, 0], tw: 90 }, shB: [-0.012, 0, -0.028] },
      { t: 0.94, aB: { f: "chest", p: [0.725, 0.245, 0.125], pole: [0, -1, 0], tw: 90 } },
      { t: 1, aB: { f: "chest", p: [0.725, 0.245, 0.125], pole: [0, -1, 0], tw: 90 } },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.12, step: 1, w: 1 }, { at: 0.36, step: 2, label: "Hold 2 s", w: 1 }, { at: 0.6, step: 3 }],
  },

  "prone-y": {
    base: "prone", props: ["mat"], dur: 7, view: { yaw: 148, pitch: 34, dist: 5.0, target: [0, -0.05, 0.25] },
    keys: [
      { t: 0, aB: { f: "chest", p: [0.41, 0.775, 0.125], pole: [1, 0, 0], tw: 90 } },
      { t: 0.1, aB: { f: "chest", p: [0.41, 0.775, 0.125], pole: [1, 0, 0], tw: 90 } },
      { t: 0.24, aB: { f: "chest", p: [0.41, 0.762, 0.125], pole: [1, 0, 0], tw: 90 }, shB: [0, -0.022, 0] },
      { t: 0.44, aB: { f: "chest", p: [0.41, 0.757, 0.01], pole: [1, 0, 0], tw: 90 }, shB: [-0.006, -0.022, -0.02] },
      { t: 0.66, aB: { f: "chest", p: [0.41, 0.757, 0.01], pole: [1, 0, 0], tw: 90 }, shB: [-0.006, -0.022, -0.02] },
      { t: 0.94, aB: { f: "chest", p: [0.41, 0.775, 0.125], pole: [1, 0, 0], tw: 90 } },
      { t: 1, aB: { f: "chest", p: [0.41, 0.775, 0.125], pole: [1, 0, 0], tw: 90 } },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.24, step: 2, w: 1 }, { at: 0.44, step: 2, label: "Hold 2 s", w: 1 }, { at: 0.66, step: 3 }],
  },

  "wall-angel": {
    base: "stand", props: ["wall"], dur: 7, view: { yaw: 156, pitch: 8 },
    rest: { neck: [-3, 0, 0], head: [4, 0, 0] },
    keys: [
      { t: 0, aB: { f: "chest", p: [0.44, 0.44, -0.085], pole: [0.8, -1, -0.15], tw: 10 } },
      { t: 0.14, aB: { f: "chest", p: [0.44, 0.44, -0.085], pole: [0.8, -1, -0.15], tw: 10 } },
      { t: 0.5, aB: { f: "chest", p: [0.38, 0.75, -0.085], pole: [0.8, -1, -0.15], tw: 10 } },
      { t: 0.62, aB: { f: "chest", p: [0.38, 0.75, -0.085], pole: [0.8, -1, -0.15], tw: 10 } },
      { t: 0.96, aB: { f: "chest", p: [0.44, 0.44, -0.085], pole: [0.8, -1, -0.15], tw: 10 } },
      { t: 1, aB: { f: "chest", p: [0.44, 0.44, -0.085], pole: [0.8, -1, -0.15], tw: 10 } },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.14, step: 1, w: 1 }, { at: 0.5, step: 2, w: 1 }, { at: 0.62, step: 3, w: 1 }],
  },

  "rhomboid-stretch": {
    start: "close", base: "sit", props: ["stool"], dur: 9, view: { yaw: 126, pitch: 12 },
    keys: [
      { t: 0 },
      { t: 0.06 },
      { t: 0.22, aB: { f: "chest", p: [0.03, 0.17, 0.4], pole: [1, -0.6, 0], tw: 120 } },
      { t: 0.44, aB: { f: "chest", p: [0.03, 0.12, 0.545], pole: [1, -0.5, 0], tw: 120 }, thor: [20, 0, 0], neck: [10, 0, 0], head: [14, 0, 0], shB: [0.008, 0, 0.045] },
      { t: 0.8, aB: { f: "chest", p: [0.03, 0.12, 0.545], pole: [1, -0.5, 0], tw: 120 }, thor: [20, 0, 0], neck: [10, 0, 0], head: [14, 0, 0], shB: [0.008, 0, 0.045] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.22, step: 1 }, { at: 0.36, step: 2 }, { at: 0.44, step: 2, label: "Hold 20 s", w: 1 }, { at: 0.8, step: 3 }],
  },

  "external-rotation": {
    side: "L", base: "stand", props: ["bandSide"], dur: 6, view: { yaw: 150, pitch: 10, dist: 5.6, target: [-0.3, 0.74, 0] },
    keys: [
      { t: 0, aL: { f: "chest", p: [0.03, -0.03, 0.26], pole: [0.4, -1, -0.5], tw: 90 } },
      { t: 0.1, aL: { f: "chest", p: [0.03, -0.03, 0.26], pole: [0.4, -1, -0.5], tw: 90 } },
      { t: 0.27, aL: { f: "chest", p: [0.22, -0.03, 0.3], pole: [0.1, -1, -0.55], tw: 90 }, e: "i" },
      { t: 0.44, aL: { f: "chest", p: [0.4, -0.03, 0.2], pole: [-0.2, -1, -0.6], tw: 90 }, e: "o" },
      { t: 0.58, aL: { f: "chest", p: [0.4, -0.03, 0.2], pole: [-0.2, -1, -0.6], tw: 90 } },
      { t: 0.77, aL: { f: "chest", p: [0.22, -0.03, 0.3], pole: [0.1, -1, -0.55], tw: 90 }, e: "i" },
      { t: 0.96, aL: { f: "chest", p: [0.03, -0.03, 0.26], pole: [0.4, -1, -0.5], tw: 90 }, e: "o" },
      { t: 1, aL: { f: "chest", p: [0.03, -0.03, 0.26], pole: [0.4, -1, -0.5], tw: 90 } },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.44, step: 2, w: 1 }, { at: 0.58, step: 3 }],
  },

  "cross-body-stretch": {
    side: "L", base: "stand", props: [], dur: 9, view: { yaw: 142, pitch: 8 },
    keys: [
      { t: 0 },
      { t: 0.06 },
      { t: 0.24, aL: { f: "chest", p: [-0.2, 0.22, 0.22], pole: [0, -1, 0.4], tw: 120 } },
      { t: 0.4, aL: { f: "chest", p: [-0.27, 0.225, 0.17], pole: [0, -1, 0.4], tw: 120 }, aR: { f: "chest", p: [0.03, 0.17, 0.225], pole: [-0.5, -1, 0.3], tw: 60 } },
      { t: 0.82, aL: { f: "chest", p: [-0.27, 0.225, 0.17], pole: [0, -1, 0.4], tw: 120 }, aR: { f: "chest", p: [0.03, 0.17, 0.225], pole: [-0.5, -1, 0.3], tw: 60 } },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.24, step: 1 }, { at: 0.4, step: 2, label: "Hold 30 s", w: 1 }, { at: 0.82, step: 3 }],
  },

  "scaption": {
    base: "stand", props: ["weights"], dur: 7, view: { yaw: 152, pitch: 10 },
    keys: [
      { t: 0 },
      { t: 0.08 },
      { t: 0.24, aB: { f: "chest", p: [0.511, -0.158, 0.197], pole: [0, 0, -1], tw: 90 }, e: "i" },
      { t: 0.4, aB: { f: "chest", p: [0.656, 0.25, 0.28], pole: [0, 0, -1], tw: 90 }, e: "o" },
      { t: 0.54, aB: { f: "chest", p: [0.656, 0.25, 0.28], pole: [0, 0, -1], tw: 90 } },
      { t: 0.74, aB: { f: "chest", p: [0.511, -0.158, 0.197], pole: [0, 0, -1], tw: 90 }, e: "i" },
      { t: 0.94, e: "o" },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1, w: 1 }, { at: 0.4, step: 2, w: 1 }, { at: 0.54, step: 3, w: 1 }],
  },

  "thoracic-extension": {
    base: "sit", props: ["chair"], dur: 7, view: { yaw: 104, pitch: 6 },
    rest: { aB: { f: "head", p: [0.035, 0.07, -0.1], pole: [1, -0.4, 0.8], tw: 30 } },
    keys: [
      { t: 0 },
      { t: 0.14 },
      { t: 0.46, lum: [-4, 0, 0], thor: [-24, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0] },
      { t: 0.66, lum: [-4, 0, 0], thor: [-24, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.06, step: 1 }, { at: 0.14, step: 2, w: 1 }, { at: 0.66, step: 3 }],
  },

  "prone-cobra": {
    base: "prone", props: ["mat"], dur: 8, view: { yaw: 118, pitch: 18, dist: 4.9, target: [0, -0.05, -0.05] },
    keys: [
      { t: 0, aB: { f: "chest", p: [0.26, -0.3, 0.125], pole: [1, 0, -0.3], tw: 170 } },
      { t: 0.1, aB: { f: "chest", p: [0.26, -0.3, 0.125], pole: [1, 0, -0.3], tw: 170 } },
      { t: 0.24, aB: { f: "chest", p: [0.26, -0.3, 0.11], pole: [1, 0, -0.3], tw: 150 }, shB: [-0.012, -0.02, -0.02] },
      { t: 0.44, aB: { f: "chest", p: [0.27, -0.3, 0.03], pole: [1, 0, -0.3], tw: 110 }, shB: [-0.012, -0.02, -0.03], lum: [-7, 0, 0], thor: [-13, 0, 0], neck: [-9, 0, 0], head: [9, 0, 0] },
      { t: 0.76, aB: { f: "chest", p: [0.27, -0.3, 0.03], pole: [1, 0, -0.3], tw: 110 }, shB: [-0.012, -0.02, -0.03], lum: [-7, 0, 0], thor: [-13, 0, 0], neck: [-9, 0, 0], head: [9, 0, 0] },
      { t: 0.96, aB: { f: "chest", p: [0.26, -0.3, 0.125], pole: [1, 0, -0.3], tw: 170 } },
      { t: 1, aB: { f: "chest", p: [0.26, -0.3, 0.125], pole: [1, 0, -0.3], tw: 170 } },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.24, step: 2, w: 1 }, { at: 0.44, step: 2, label: "Hold 5 to 10 s", w: 1 }, { at: 0.76, step: 3 }],
  },
};
