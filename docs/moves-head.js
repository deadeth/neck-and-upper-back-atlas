// Exercise keyframes for the head, face and jaw. Same format as moves.js, plus the jaw and brow keys
// (docs/contract.md, addendum 4): jaw (degrees of opening), jawSide (cm at the chin, + to the model's left),
// brow (cm the brows lift). All are seated upright on the stool and open framed on the face (closeAt, a point in
// the head frame).
//
// Hands that touch the face are placed so the fingertips (or the thumb pad) rest on the muscle or face surface
// over the bone, 1 to 3 mm off it: the palm positions were fitted against the skinned surfaces with a probe, so
// they are numbers here rather than `snap`, which only knows bone. Where the jaw moves under a fingertip the hand
// moves with it by the same amount.

const FACE = { start: "close", closeAt: [0, -0.045, 0.045], closeDist: 0.9, base: "sit", props: ["stool"] };

// index and middle fingertips on the jaw joints, just in front of the ears (index on the condyle, middle on the
// front of the joint under the cheekbone's arch); fingers up, palm towards the face, elbows down and out
// (fitted per side: the skull is not quite symmetrical)
const TMJ_L = { f: "head", p: [0.071, -0.0938, 0.0708], n: [-0.995, -0.271, 0.193], g: [-0.28, 1.008, -0.076], pole: [0.4, -1, 0.25], curl: "flat" };
const TMJ_R = { ...TMJ_L, p: [-0.0703, -0.0937, 0.073], n: [0.995, -0.271, 0.193], g: [0.28, 1.008, -0.076], pole: [-0.4, -1, 0.25] };
// riding the condyles' slide at 16 degrees: the fingertips move about 3 mm forward with them
const TMJ_OPEN = { aL: { ...TMJ_L, p: [0.0716, -0.0936, 0.0733] }, aR: { ...TMJ_R, p: [-0.0718, -0.0936, 0.0764] } };

// left thumb pad under the chin (on the front bellies of the digastric), angled back from a loose fist in front of
// the chin, fingers curled out of the way, elbow down
const THUMB = { f: "head", p: [0.0333, -0.1243, 0.1163], n: [-1, 0, 0], g: [0, 1, 0.5], pole: [0.4, -1, 0.5], curl: [85, 95, 50, -6, -6] };
const THUMB_OPEN = { ...THUMB, p: [0.034, -0.1292, 0.1096] };   // following the chin down and back at 5.5 degrees

// left fingers flat up the cheek over the jaw, the palm at the angle of the jaw and the fingertips resting on the
// cheekbone's arch (the most outward part of the side of the face, so a flat hand meets it first)
const CHEEK_FLAT = { f: "head", p: [0.0615, -0.0925, 0.0862], n: [-0.99, -0.227, 0.035], g: [-0.214, 0.992, -0.179], pole: [0.4, -1, 0.25], curl: "flat" };

// massage: index and middle fingertips on the masseter below the cheekbone, then on the temporalis at the temple.
// Each ring is eight hand placements [p, n, g] round a 1 cm circle (up the surface, then forward), each fitted so
// both fingertips stay 1.5 mm off the curved surface; the first is the resting placement.
const TIPS = { f: "head", pole: [0.4, -1, 0.25], curl: "rest" };
const CHEEK_RING = [
  [[0.0843, -0.1184, 0.0838], [-0.963, 0.122, 0.326], [-0.192, 0.99, -0.049]],
  [[0.0805, -0.1207, 0.0918], [-0.999, 0.12, 0.192], [-0.185, 0.99, -0.075]],
  [[0.0757, -0.127, 0.0955], [-1.012, 0.112, 0.111], [-0.186, 0.989, -0.088]],
  [[0.0726, -0.1336, 0.0927], [-1.004, 0.135, 0.153], [-0.168, 0.992, -0.084]],
  [[0.0748, -0.1367, 0.0846], [-0.968, 0.141, 0.305], [-0.173, 0.993, -0.059]],
  [[0.0771, -0.1341, 0.0771], [-0.937, 0.151, 0.387], [-0.169, 0.995, -0.048]],
  [[0.0822, -0.1279, 0.0733], [-0.904, 0.137, 0.462], [-0.185, 0.993, -0.028]],
  [[0.0822, -0.121, 0.0771], [-0.91, 0.158, 0.444], [-0.166, 0.995, -0.04]],
];
const TEMPLE_RING = [
  [[0.1102, -0.051, 0.0724], [-1.008, -0.05, 0.035], [-0.239, 0.976, -0.1]],
  [[0.1062, -0.0541, 0.0796], [-1.008, -0.057, -0.017], [-0.241, 0.974, -0.113]],
  [[0.1077, -0.061, 0.0825], [-1.003, -0.11, -0.039], [-0.289, 0.96, -0.121]],
  [[0.1063, -0.0681, 0.0796], [-1.004, -0.103, -0.024], [-0.284, 0.962, -0.116]],
  [[0.1066, -0.071, 0.0725], [-1.005, -0.089, 0.033], [-0.277, 0.966, -0.1]],
  [[0.1095, -0.0679, 0.0653], [-1.003, -0.09, 0.071], [-0.282, 0.965, -0.089]],
  [[0.1097, -0.0609, 0.0624], [-1.007, -0.067, 0.013], [-0.254, 0.972, -0.105]],
  [[0.1097, -0.0539, 0.0654], [-1.009, -0.04, 0.019], [-0.228, 0.978, -0.104]],
];
const at = (ring, k) => ({ ...TIPS, p: ring[k % 8][0], n: ring[k % 8][1], g: ring[k % 8][2] });
const CHEEK_TIPS = at(CHEEK_RING, 0), TEMPLE_TIPS = at(TEMPLE_RING, 0);

/** keys for `turns` slow circles round a ring, evenly spaced from t0 to t1, moving steadily through each */
function circles(ring, turns, t0, t1) {
  const keys = [], n = turns * 8;
  for (let k = 1; k <= n; k++) keys.push({ t: +(t0 + ((t1 - t0) * k) / n).toFixed(4), aB: at(ring, k), e: "l" });
  return keys;
}

export const HEAD_BASES = {};
export const HEAD_MOVES = {
  "jaw-rest": {
    ...FACE, dur: 9, view: { yaw: 30, pitch: 5 },
    keys: [{ t: 0 }, { t: 0.14 }, { t: 0.34, jaw: 2.5 }, { t: 0.76, jaw: 2.5 }, { t: 0.94 }, { t: 1 }],
    phases: [{ at: 0, step: 0 }, { at: 0.14, step: 1 }, { at: 0.34, step: 2, label: "Hold 10 s", w: 1 }, { at: 0.76, step: 3 }],
  },

  "jaw-opening": {
    ...FACE, dur: 10, view: { yaw: 30, pitch: 5 },
    rest: { aL: TMJ_L, aR: TMJ_R },
    keys: [{ t: 0 }, { t: 0.12 }, { t: 0.42, jaw: 16, ...TMJ_OPEN }, { t: 0.6, jaw: 16, ...TMJ_OPEN }, { t: 0.92 }, { t: 1 }],
    phases: [{ at: 0, step: 0 }, { at: 0.12, step: 1 }, { at: 0.42, step: 2, label: "Pause 2 s", w: 1 }, { at: 0.6, step: 3 }],
  },

  "jaw-open-resisted": {
    ...FACE, dur: 8, view: { yaw: 35, pitch: 0 },
    rest: { jaw: 1.5, aL: THUMB },
    keys: [{ t: 0 }, { t: 0.14 }, { t: 0.34, jaw: 5.5, aL: THUMB_OPEN }, { t: 0.74, jaw: 5.5, aL: THUMB_OPEN }, { t: 0.92 }, { t: 1 }],
    phases: [{ at: 0, step: 0 }, { at: 0.14, step: 1 }, { at: 0.34, step: 2, label: "Hold 5 s", w: 1 }, { at: 0.74, step: 3 }],
  },

  "jaw-sideways": {
    ...FACE, side: "L", dur: 8, view: { yaw: 35, pitch: 5 },
    rest: { jaw: 1.5, aL: CHEEK_FLAT },
    // the fingertips rest on the cheekbone, which doesn't move: the hand holds still while the jaw presses into it
    keys: [{ t: 0 }, { t: 0.14 }, { t: 0.32, jawSide: 0.25 }, { t: 0.74, jawSide: 0.25 }, { t: 0.9 }, { t: 1 }],
    phases: [{ at: 0, step: 0 }, { at: 0.14, step: 1 }, { at: 0.32, step: 2, label: "Hold 5 s", w: 1 }, { at: 0.74, step: 3 }],
  },

  "jaw-massage": {
    ...FACE, dur: 26, view: { yaw: 30, pitch: 5 },
    keys: [
      { t: 0 },
      { t: 0.08, aB: CHEEK_TIPS },
      ...circles(CHEEK_RING, 4, 0.08, 0.44),
      { t: 0.5, aB: TEMPLE_TIPS },
      ...circles(TEMPLE_RING, 3, 0.5, 0.8),
      { t: 0.9, jaw: 2.5 },
      { t: 0.96, jaw: 2.5 },
      { t: 1 },
    ],
    phases: [{ at: 0, step: 0 }, { at: 0.08, step: 1, w: 1 }, { at: 0.44, step: 2, w: 1 }, { at: 0.8, step: 3 }],
  },

  "forehead-release": {
    ...FACE, dur: 7, view: { yaw: 25, pitch: 5 },
    keys: [{ t: 0 }, { t: 0.12 }, { t: 0.3, brow: 0.55 }, { t: 0.46, brow: 0.55 }, { t: 0.84 }, { t: 1 }],
    phases: [{ at: 0, step: 0 }, { at: 0.12, step: 1 }, { at: 0.3, step: 2, label: "Hold 2 s", w: 1 }, { at: 0.46, step: 3 }],
  },
};
