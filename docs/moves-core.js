// Exercise keyframes for the lower back and core. Same format as moves.js.
//
// Floor work happens on the mat, whose top is at y = MAT. Feet, knees and shins that bear weight are
// placed by leg IK in the room, so they stay put while the trunk moves over them. Every move here
// uses IK legs in all of its keys.

const MAT = 0.012;
const PALM_Y = MAT + 0.035;   // palm centre over the mat: the knuckles stand proud of it
const D = Math.PI / 180;

/** palm flat on the mat at (x, z), fingers along g (mirrored by aB like any other spec) */
const floorHand = (x, z, extra) => ({ f: "world", p: [x, PALM_Y, z], n: [0, -1, 0], g: [0, 0, 1], curl: "flat", ...extra });
const chest = (p, extra) => ({ f: "chest", p, ...extra });
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);

// ---------- on hands and knees ----------
// knees under the hips, shins and the tops of the feet on the mat; hands a little ahead of the
// shoulders so the wrists need no more than the 75 degrees they can bend
const KNEE_Z = -0.05;
const QUAD_ROOT = [0, 0.505, KNEE_Z];
const QUAD_LEG = { p: [0.09, 0.068, KNEE_Z - 0.4], pole: [0, -1, 0.15], foot: 148 };
const QUAD_HAND = floorHand(0.16, 0.57, { pole: [0.3, -1, 0.1] });

// ---------- lying on the back ----------
// head towards -Z; hips at SUP_Z; feet flat with the knees up
const SUP_ROOT = [0, 0.113, 0.15];
const HIP_L = [0.087, SUP_ROOT[1], SUP_ROOT[2]];
const HOOK_LEG = { p: [0.1, MAT + 0.058, SUP_ROOT[2] + 0.46], pole: [0, 1, 0.3], foot: 0 };
const SIDE_HAND = floorHand(0.27, 0.16, { pole: [1, 0, 0.2] });   // arms by the sides, palms down

/** a lifted leg seen from the side: thigh at `phi` degrees up from pointing at the feet, knee bent by `flex` */
function liftLeg(phi, flex, hip = HIP_L, foot = -20) {
  const d1 = [0, Math.sin(phi * D), Math.cos(phi * D)], psi = (phi - flex) * D, d2 = [0, Math.sin(psi), Math.cos(psi)];
  const knee = add(hip, d1, 0.425);
  return { leg: { p: add(knee, d2, 0.403), pole: add(d1, d2, -1), foot }, knee, d2, front: [0, Math.cos(psi), -Math.sin(psi)] };
}


// ---------- side plank ----------
// lying on the left side along the mat, head towards +Z, facing -X: r [0, -90, -z] first lays the
// body on its left side head towards +X (as r [0, 0, -z] does), then turns it a quarter round.
// `el` is how far the trunk line rises from the floor. The ankles stay where the straight body
// (el = 14.5) puts them, with the lower ankle joint 6 cm off the floor.
function sideBody(el) {
  const t = -(90 - el) * D, c = Math.cos(t), s = Math.sin(t);
  const R = (x, y) => [x * c - y * s, x * s + y * c];   // in the plane the body lies in, before the quarter turn
  const hipL = R(0.087, 0), hipR = R(-0.087, 0), leg = R(0, -1);
  const rootY = 0.06 - (hipL[1] + 0.825 * leg[1]), ankleZ = hipL[0] + 0.825 * leg[0];
  return { rootY, ankleL: [0, 0.06, ankleZ], ankleR: [0, rootY + hipR[1] + 0.825 * leg[1], hipR[0] + 0.825 * leg[0]] };
}
const SB = sideBody(14.5);
// toes forward (-X), soles towards the far end of the mat, each foot turned in 25 degrees to undo
// the scanned feet's toe-out, which would otherwise dip the lower foot's toes into the mat
const SIDE_FOOT_L = [-90, -65, 180], SIDE_FOOT_R = [90, -65, 0];
const SIDE_UP = { root: { p: [0, SB.rootY, 0], r: [0, -90, -75.5] }, lum: [0, 0, 0], thor: [0, 0, 0] };
// hips down on the mat: the pelvis lies flatter and the trunk bends up towards the propped shoulder
const SIDE_DOWN = { root: { p: [0, 0.182, 0.02], r: [0, -90, -83] }, lum: [0, 0, 22], thor: [0, 0, 13] };

// ---------- standing ----------
const STAND_LEG = { p: [0.1, 0.054, 0.002], pole: [0, 0, 1], foot: 0 };
const HANG_L = chest([0.255, -0.3, 0.035], { pole: [0.25, 0.1, -1], n: [-1, 0, 0.2], along: true });
// right palm against the outside of the right thigh, sliding down it as the trunk bends
const ARM_OUT = chest([0.5, 0.15, 0.12], { n: [0, 1, 0.2], along: true, pole: [0.3, -1, -0.3] });   // on the way up, out to the side
const ARM_UP = chest([0.1, 0.8, 0.02], { n: [-1, 0, 0], along: true, pole: [1, 0, -0.2] });
// hips drift left as the trunk curves right; the left arm arcs over the head
const BEND = {
  root: { p: [0.035, 0.879, 0], r: [0, 0, 3] }, lum: [0, 0, 12], thor: [0, 0, 16], neck: [0, 0, 6], head: [0, 0, 4],
  aL: chest([-0.13, 0.76, 0.03], { n: [-0.6, -0.8, 0], along: true, pole: [1, 0.4, -0.2] }), aR: THIGH_R(-0.27),
};
function THIGH_R(y) { return { f: "thigh", p: [-0.1, y, 0.01], n: [1, 0, 0], g: [0, -1, 0.1], snap: true, pole: [-0.4, 0.2, -1], curl: "cup" }; }

// ---------- half kneeling ----------
// left knee down behind the hip, right foot flat in front with the shin upright
const HK_ANKLE_R = [-0.1, MAT + 0.055, 0.5];
const HK_KNEE_L = { p: [0.1, 0.068, -0.52], pole: [0, -1, 0.25], foot: 148 };
// hands on the hips: palms on the sides of the pelvis, thumbs back
const ON_HIP_L = { f: "pelvis", p: [0.178, 0.08, 0.0], n: [-1, 0, 0], g: [0, -0.3, 1], pole: [1, -0.2, -0.6], curl: "cup" };
const ON_HIP_R = { ...ON_HIP_L, p: [-0.178, 0.08, 0.0], n: [1, 0, 0], pole: [-1, -0.2, -0.6] };

// ---------- face down ----------
const PRONE_ROOT = [0, 0.153, 0.05];
const BY_SHOULDER = floorHand(0.26, 0.54, { g: [-0.15, 0, 1], pole: [0.5, -0.4, -1] });

// ---------- plank ----------
// forearms on the mat, elbows under the shoulders, toes tucked under
const PLANK_ANKLE = [0.1, 0.14, -0.81];
const PLANK_UP = { root: { p: [0, 0.25, 0], r: [81.6, 0, 0] }, lum: [0, 0, 0], thor: [0, 0, 0] };
const FOREARM = floorHand(0.11, 0.78, { g: [-0.35, 0, 1], pole: [0.2, -0.3, 1] });

export const CORE_BASES = {
  quad: { root: { p: QUAD_ROOT, r: [88, 0, 0] }, legB: QUAD_LEG, aB: QUAD_HAND, neck: [-6, 0, 0], head: [-4, 0, 0] },
  hook: { root: { p: SUP_ROOT, r: [-90, 0, 0] }, legB: HOOK_LEG, aB: SIDE_HAND },
  standLegs: { root: { p: [0, 0.882, 0], r: [0, 0, 0] }, legB: STAND_LEG, aL: HANG_L, aR: THIGH_R(-0.12) },
  sideLie: {
    ...SIDE_DOWN, legL: { p: SB.ankleL, pole: [-1, 0, 0], foot: SIDE_FOOT_L }, legR: { p: [0, 0.135, SB.ankleR[2]], pole: [-1, 0, 0], foot: SIDE_FOOT_R },
    aL: floorHand(-0.27, 0.5, { pole: [1, -0.3, 0], g: [-1, 0, 0] }),
    aR: { f: "thigh", p: [-0.1, -0.06, 0.0], n: [1, 0, 0], g: [0, -0.3, 1], snap: true, pole: [-0.5, 0, -1], curl: "cup" },
  },
  halfKneel: { root: { p: [0, 0.49, 0.0], r: [0, 0, 0] }, legL: HK_KNEE_L, legR: { p: HK_ANKLE_R, pole: [0, 0, 1], foot: 0 }, aL: ON_HIP_L, aR: ON_HIP_R },
  proneMat: { root: { p: PRONE_ROOT, r: [90, 0, 0] }, ankB: 40, aB: BY_SHOULDER },
  forearms: { root: { p: [0, 0.125, 0.02], r: [80, 0, 0] }, lum: [-16, 0, 0], thor: [-4, 0, 0], legB: { p: PLANK_ANKLE, pole: [0, -1, 0], foot: 32 }, aB: FOREARM, neck: [-14, 0, 0], head: [-6, 0, 0] },
};

// ---------- cat-cow ----------
const CAT = { root: { p: QUAD_ROOT, r: [66, 0, 0] }, lum: [17, 0, 0], thor: [20, 0, 0], neck: [12, 0, 0], head: [16, 0, 0] };
const COW = { root: { p: QUAD_ROOT, r: [101, 0, 0] }, lum: [-15, 0, 0], thor: [-4, 0, 0], neck: [-16, 0, 0], head: [-12, 0, 0] };

// ---------- child's pose ----------
// the hips swing back on an arc round the knees (so the shins stay flat) until they sit on the heels;
// u runs from hands and knees (0) to the full pose (1)
const lerp = (a, b, u) => a + (b - a) * u;
function child(u) {
  const a = lerp(90, 163, u) * D, y = 0.08 + 0.425 * Math.sin(a), z = KNEE_Z + 0.425 * Math.cos(a);
  return {
    root: { p: [0, y, z], r: [lerp(88, 80, u), 0, 0] }, legB: { ...QUAD_LEG, pole: [0, lerp(-1, -0.4, u), lerp(0.15, 1, u)] },
    lum: [16 * u, 0, 0], thor: [12 * u, 0, 0], neck: [lerp(-6, -23, u), 0, 0], head: [-4, 0, 0],
  };
}
const CHILD = child(1);

// ---------- knee to chest ----------
const kneeHands = (phi) => {
  const { leg, knee, d2, front } = liftLeg(phi, 130);
  const on = (s, c) => add(add(knee, d2, s), front, c);
  const down = front.map((v) => -v);
  return {
    legL: leg,
    aL: { f: "world", p: on(0.07, 0.045), n: down, g: [-1, 0, 0], pole: [1, -0.3, 0.3], curl: "wrap" },
    aR: { f: "world", p: on(0.15, 0.045), n: down, g: [1, 0, 0], pole: [-1, -0.3, 0.3], curl: "wrap" },
  };
};

// hands lifted off the mat beside the hips on their way to the knee
const REACH = {
  aL: { f: "world", p: [0.2, 0.26, 0.22], n: [-1, -0.3, 0], g: [0, 0.2, 1], pole: [1, -0.4, 0.3], curl: "rest" },
  aR: { f: "world", p: [-0.2, 0.26, 0.22], n: [1, -0.3, 0], g: [0, 0.2, 1], pole: [-1, -0.4, 0.3], curl: "rest" },
};

// ---------- bird dog ----------
const BIRD = {
  legL: { p: [0.09, 0.53, KNEE_Z - 0.82], pole: [0, -1, 0], foot: 95 },
  aR: chest([-0.16, 0.8, 0.03], { n: [0, 0, 1], g: [0, 1, 0], pole: [-1, 0, 0], curl: "rest" }),
};
const BIRD_MID = {   // knee just off the mat and the hand just lifted, so nothing scrapes along
  legL: { p: [0.09, 0.14, KNEE_Z - 0.46], pole: [0, -1, 0.1], foot: 120 },
  aR: floorHand(-0.16, 0.62, { p: [-0.16, 0.12, 0.65], pole: [-0.3, -1, 0.1], curl: "rest" }),
};

// ---------- dead bug ----------
const TABLE_L = liftLeg(90, 90).leg;
const TABLE_R = liftLeg(90, 90, [-0.087, SUP_ROOT[1], SUP_ROOT[2]]).leg;
const UP_L = chest([0.15, 0.245, 0.55], { n: [-1, 0, 0], along: true, pole: [1, -0.5, 0], curl: "rest" });
const UP_R = chest([-0.15, 0.245, 0.55], { n: [1, 0, 0], along: true, pole: [-1, -0.5, 0], curl: "rest" });
const OVER_L = chest([0.17, 0.79, 0.04], { n: [-1, 0, 0], along: true, pole: [1, 0, 0], curl: "rest" });
const DEAD_LEG_R = { p: [-0.1, 0.125, SUP_ROOT[2] + 0.82], pole: [0, 1, 0], foot: -70 };

export const CORE_MOVES = {
  "cat-cow": {
    base: "quad", props: ["mat"], dur: 10, view: { yaw: 80, pitch: 12, dist: 4.2, target: [0, 0.35, 0.1] },
    keys: [
      { t: 0 },
      { t: 0.08 },
      { t: 0.3, ...CAT },
      { t: 0.42, ...CAT },
      { t: 0.68, ...COW },
      { t: 0.8, ...COW },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1, w: 1 }, { at: 0.42, step: 2, w: 1 }, { at: 0.8, step: 3 }],
  },

  "childs-pose": {
    base: "quad", props: ["mat"], dur: 11, view: { yaw: 120, pitch: 22, dist: 4.2, target: [0, 0.25, 0.05] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.19, ...child(0.33), e: "i" },
      { t: 0.27, ...child(0.67), e: "l" },
      { t: 0.36, ...CHILD, e: "o" },
      { t: 0.78, ...CHILD },
      { t: 0.85, ...child(0.67), e: "i" },
      { t: 0.92, ...child(0.33), e: "l" },
      { t: 1, e: "o" },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.36, step: 2, label: "Hold 30 s", w: 1 }, { at: 0.78, step: 3 }],
  },

  "knee-to-chest": {
    side: "L", base: "hook", props: ["mat"], dur: 10, view: { yaw: 70, pitch: 20, dist: 4.2, target: [0, 0.15, 0.1] },
    keys: [
      { t: 0 },
      { t: 0.08 },
      { t: 0.17, ...REACH, e: "i" },
      { t: 0.3, ...kneeHands(108), e: "o" },
      { t: 0.46, ...kneeHands(132) },
      { t: 0.76, ...kneeHands(132) },
      { t: 0.86, ...kneeHands(108) },
      { t: 0.93, ...REACH, e: "i" },
      { t: 1, e: "o" },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1 }, { at: 0.3, step: 2 }, { at: 0.46, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.76, step: 3 }],
  },

  "bird-dog": {
    base: "quad", props: ["mat"], dur: 9, view: { yaw: 120, pitch: 16, dist: 4.4, target: [0, 0.4, 0.1] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.2, ...BIRD_MID, e: "i" },
      { t: 0.38, ...BIRD, e: "o" },
      { t: 0.66, ...BIRD },
      { t: 0.82, ...BIRD_MID, e: "i" },
      { t: 0.92, e: "o" },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.38, step: 2, label: "Hold 5 s", w: 1 }, { at: 0.66, step: 3 }],
  },

  "dead-bug": {
    base: "hook", props: ["mat"], dur: 9, view: { yaw: 60, pitch: 24, dist: 4.4, target: [0, 0.2, 0.1] },
    rest: { legL: TABLE_L, legR: TABLE_R, aL: UP_L, aR: UP_R, root: { p: SUP_ROOT, r: [-90, 0, 0] } },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.4, aL: OVER_L, legR: DEAD_LEG_R },
      { t: 0.6, aL: OVER_L, legR: DEAD_LEG_R },
      { t: 0.9 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.4, step: 2, label: "Pause 2 s", w: 1 }, { at: 0.6, step: 3, w: 1 }],
  },
  "side-plank": {
    side: "L", base: "sideLie", props: ["mat"], dur: 9, view: { yaw: -100, pitch: 14, dist: 4.2, target: [0, 0.2, 0] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.34, ...SIDE_UP },
      { t: 0.7, ...SIDE_UP },
      { t: 0.92 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.34, step: 2, label: "Hold 10 to 20 s", w: 1 }, { at: 0.7, step: 3 }],
  },

  "side-bend-stretch": {
    side: "L", base: "standLegs", props: [], dur: 12, view: { yaw: 150, pitch: 8 },
    keys: [
      { t: 0 },
      { t: 0.02 },
      { t: 0.11, aL: ARM_OUT, e: "i" },
      { t: 0.25, aL: ARM_UP, e: "o" },
      { t: 0.29, aL: ARM_UP },
      { t: 0.46, ...BEND },
      { t: 0.72, ...BEND },
      { t: 0.81, aL: ARM_UP },
      { t: 0.915, aL: ARM_OUT, e: "i" },
      { t: 1, e: "o" },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.29, step: 1, w: 1 }, { at: 0.46, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.72, step: 3 }],
  },

  "hip-flexor-stretch": {
    side: "L", base: "halfKneel", props: ["mat"], dur: 10, view: { yaw: 70, pitch: 8, dist: 4.4, target: [0, 0.5, 0.05] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.24, root: { p: [0, 0.488, 0.0], r: [-9, 0, 0] }, lum: [7, 0, 0] },
      { t: 0.42, root: { p: [0, 0.415, 0.15], r: [-9, 0, 0] }, lum: [7, 0, 0] },
      { t: 0.76, root: { p: [0, 0.415, 0.15], r: [-9, 0, 0] }, lum: [7, 0, 0] },
      { t: 0.92 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1 }, { at: 0.42, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.76, step: 3 }],
  },

  "prone-press-up": {
    base: "proneMat", props: ["mat"], dur: 8, view: { yaw: 110, pitch: 16, dist: 4.4, target: [0, 0.1, 0.1] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.38, lum: [-28, 0, 0], thor: [-16, 0, 0], neck: [-4, 0, 0], head: [4, 0, 0] },
      { t: 0.6, lum: [-28, 0, 0], thor: [-16, 0, 0], neck: [-4, 0, 0], head: [4, 0, 0] },
      { t: 0.92 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.38, step: 2, label: "Pause 2 s", w: 1 }, { at: 0.6, step: 3 }],
  },

  "plank": {
    base: "forearms", props: ["mat"], dur: 10, view: { yaw: 70, pitch: 14, dist: 4.4, target: [0, 0.2, -0.05] },
    keys: [
      { t: 0 },
      { t: 0.1 },
      { t: 0.3, ...PLANK_UP },
      { t: 0.66, ...PLANK_UP },
      { t: 0.82, root: { p: [0, 0.175, 0.0], r: [73, 0, 0] }, lum: [0, 0, 0], thor: [0, 0, 0] },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.1, step: 1, w: 1 }, { at: 0.3, step: 2, label: "Hold 20 to 30 s", w: 1 }, { at: 0.66, step: 3 }],
  },
};
