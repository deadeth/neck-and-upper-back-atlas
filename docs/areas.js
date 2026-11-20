// Resolves a pain pattern's `area` (see content-body.js) into glow spots. No three.js here, so the data check
// can use it from Node.
/**
 * Resolve a pattern's `area` (see content-body.js) to spots [x, y, z, r] in model space. Every spot is drawn on
 * both sides of the body, with x in `off` pointing outwards; one that lands on the midline is drawn once.
 * A paired landmark is named without its side ("hum" is humL on the left copy, humR on the right).
 * @param rig  model.rig
 */
export function areaSpots(area, rig) {
  const land = (name, s) => (name === "acrom" ? rig["acrom" + s] : rig.joints[name] || rig.joints[name + s]);
  const out = [];
  for (const sp of area) for (const s of ["L", "R"]) {
    const a = land(sp.at, s), b = sp.to ? land(sp.to, s) : a;
    const [f0, f1] = Array.isArray(sp.f) ? sp.f : [sp.f || 0, sp.f || 0];
    const off = sp.off || [0, 0, 0], sx = s === "L" ? 1 : -1;
    // a range is a chain of spots 0.8 of a radius apart, close enough to merge into one even band
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * Math.abs(f1 - f0);
    const n = f0 === f1 ? 1 : Math.max(2, Math.ceil(len / (sp.r * 0.8)) + 1);
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? f0 : f0 + ((f1 - f0) * k) / (n - 1);
      const p = [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t + (i === 0 ? off[0] * sx : off[i]));
      if (s === "R" && Math.abs(p[0]) < 0.5) continue;   // on the midline: once is enough
      out.push([...p, sp.r]);
    }
  }
  return out;
}
