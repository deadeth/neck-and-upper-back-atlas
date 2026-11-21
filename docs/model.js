// Unpacks model.json: base64 -> ArrayBuffer, and one part -> BufferGeometry (split into muscle and tendon sheet
// when the part has `tendon`, see docs/contract.md addendum 4). A part flagged `context: true` (the face's expression
// muscles in muscles-head.json, addendum 4) is ordinary geometry that the scenes draw but never pick or list.
import * as THREE from "three";

/** decode the base64 payload of a parsed model.json and release the string */
export function unpack(model) {
  const bin = atob(model.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  model.data = null;
  return bytes.buffer;
}

/**
 * @param scale  multiplies positions (model units are centimetres)
 * @param skin   also attach skinIndex / skinWeight when the part carries them
 */
export function geometry(part, buffer, scale = 1, skin = false) {
  const q = new Uint16Array(buffer, part.vo, part.v * 3);
  const pos = new Float32Array(part.v * 3);
  for (let a = 0; a < 3; a++) {
    const lo = part.min[a] * scale, k = ((part.max[a] - part.min[a]) / 65535) * scale;
    for (let i = a; i < pos.length; i += 3) pos[i] = lo + q[i] * k;
  }
  const idx = part.u32 ? new Uint32Array(buffer, part.io, part.i) : new Uint16Array(buffer, part.io, part.i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (skin && part.so !== undefined) {
    const raw = new Uint8Array(buffer, part.so, part.v * 8);
    const si = new Uint16Array(part.v * 4), sw = new Float32Array(part.v * 4);
    for (let v = 0; v < part.v; v++) for (let k = 0; k < 4; k++) {
      si[v * 4 + k] = raw[v * 8 + k];
      sw[v * 4 + k] = raw[v * 8 + 4 + k] / 255;
    }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * A part with `tendon` (an index offset) draws its aponeurosis from that index on. Returns the fleshy and the
 * tendon geometry; they share the vertex attributes, so the edge between them has no seam. No `tendon`: [geo, null].
 */
export function splitTendon(geo, part) {
  if (part.tendon === undefined) return [geo, null];
  const idx = geo.index.array;
  const sub = (a, b) => {
    const g = new THREE.BufferGeometry();
    for (const [k, attr] of Object.entries(geo.attributes)) g.setAttribute(k, attr);
    g.setIndex(new THREE.BufferAttribute(idx.slice(a, b), 1));
    g.boundingBox = geo.boundingBox;
    g.boundingSphere = geo.boundingSphere;
    return g;
  };
  return [sub(0, part.tendon), sub(part.tendon, idx.length)];
}
