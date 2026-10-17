// Build printable STL parts for the GT300 wheel (v5: leather-ready, split rim halves, tube channel)
// Frame: X = right, Y = up (12 o'clock), Z = toward driver (h). Base mount face at Z=0.
import Module from './manifold.js';
import fs from 'fs';

const wasm = await Module();
wasm.setup();
const { Manifold, CrossSection } = wasm;
const D2R = Math.PI / 180;

// ---------------- parameters (mm) ----------------
const Rm = 137, ra = 11.5, rb = 14.5, hc = 45;     // rim section centre, printed ellipse 23 x 29
const RC = 4.25;                                   // tube channel radius (Ø8 tube + 0.5)
const CH = 0.4;                                    // elephant-foot chamfer on bed edges
const SEG = +(process.env.SEG || 720);                                   // circular segments per 360°

const U = a => [Math.sin(a * D2R), Math.cos(a * D2R)];   // radial dir for clock angle a (0 = top, 90 = 3 o'clock)
const V = a => [Math.cos(a * D2R), -Math.sin(a * D2R)];  // tangential dir

function area(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; } return s / 2; }
function ccw(poly) { return area(poly) < 0 ? poly.slice().reverse() : poly; }

// half-section profile in (r, h). side = +1 -> front half (h >= hc), -1 -> back half (h <= hc)
function halfProfile(side) {
  const pts = [];
  const bc = Math.asin(CH / rb);
  const N = 40;
  pts.push([Rm + ra - CH, hc]);                                 // outer bed edge (chamfered)
  for (let i = 0; i <= N; i++) {                                // ellipse arc outer -> inner
    const b = bc + (Math.PI - 2 * bc) * i / N;
    pts.push([Rm + ra * Math.cos(b), hc + side * rb * Math.sin(b)]);
  }
  pts.push([Rm - ra + CH, hc]);                                 // inner bed edge (chamfered)
  // channel: from inner land to outer land, bulging into the half
  const tc = Math.asin(CH / (RC + CH));
  pts.push([Rm - RC - CH, hc]);
  const M = 24;
  for (let i = 0; i <= M; i++) {
    const t = Math.PI - tc - (Math.PI - 2 * tc) * i / M;
    pts.push([Rm + RC * Math.cos(t), hc + side * RC * Math.sin(t)]);
  }
  pts.push([Rm + RC + CH, hc]);
  return ccw(pts);
}

// revolve profile from clock angle a0 to a1 (a0 < a1)
function rimSegment(side, a0, a1) {
  const cs = CrossSection.ofPolygons([halfProfile(side)]);
  const deg = a1 - a0;
  const m = Manifold.revolve(cs, Math.round(SEG), deg);   // starts at +X, CCW about Z
  // +X (phi=0) corresponds to clock angle 90. phi = 90 - a. We need phi in [90-a1, 90-a0]
  return m.rotate([0, 0, 90 - a1]);
}

// stepped cylinder along Z. prof = [[h0,h1,r], ...]
function stepped(x, y, prof, n = 32) {
  let m = null;
  for (const [h0, h1, r] of prof) {
    const c = Manifold.cylinder(h1 - h0, r, r, n).translate([x, y, h0]);
    m = m ? m.add(c) : c;
  }
  return m;
}

// ---------------- cutters ----------------
const cutters = [];
const pockets = [];
// half-to-half: self-tapping 2.9x16 from base side (low h). counterbore Ø6.2, clearance Ø3.4, pilot Ø2.5
const R3 = 129.1;
for (let k = 0; k < 16; k++) {
  const a = 11.25 + 22.5 * k, [ux, uy] = U(a);
  cutters.push(stepped(R3 * ux, R3 * uy, [[24, 37, 3.1], [37, 45, 1.7], [45, 52, 1.25]]));
}
const SPOKES = [90, 180, 270];
for (const a of SPOKES) {
  const [ux, uy] = U(a), [vx, vy] = V(a);
  for (const t of [-6, 6]) // spoke clamp M4: counterbore Ø8.5, clearance Ø4.5 (through back half + tongue), insert M4x4 Ø5.6
    cutters.push(stepped(128.5 * ux + t * vx, 128.5 * uy + t * vy, [[24, 38, 4.25], [38, 49, 2.25], [49, 53, 2.8]]));
  for (const t of [-9, 9])  // spoke foot -> hub: insert Ø5.6 in hub (h4..10), clearance Ø4.5 in foot, counterbore Ø8.5 (h16..)
    cutters.push(stepped(38 * ux + t * vx, 38 * uy + t * vy, [[4, 10, 2.8], [10, 16, 2.25], [16, 24, 4.25]]));
  // tongue pocket (+0.2 clearance): t ±12.2, r 118..132.3, h 40.8..49.2
  const box = Manifold.cube([24.4, 14.3, 8.4]).translate([-12.2, 118, 40.8]).rotate([0, 0, -a]);
  pockets.push(box);
}
const CUT_NO_POCKET = Manifold.union(cutters);
const CUT = CUT_NO_POCKET.add(Manifold.union(pockets));

// ---------------- parts ----------------
const parts = {};

// Rim front halves: centred on 0/90/180/270 (joints at 45+90k)
const frontNames = { 0: '12h', 90: '3h', 180: '6h', 270: '9h' };
for (const c of [0, 90, 180, 270]) parts[`rim_front_${frontNames[c]}`] = { m: rimSegment(+1, c - 45, c + 45).subtract(CUT), kind: 'rimF', c };
const backNames = { 45: '1-30', 135: '4-30', 225: '7-30', 315: '10-30' };
for (const c of [45, 135, 225, 315]) parts[`rim_back_${backNames[c]}`] = { m: rimSegment(-1, c - 45, c + 45).subtract(CUT), kind: 'rimB', c };

// Hub Ø90 x 10, PCD 50.8 6x Ø5.5, centre Ø20
let hub = Manifold.cylinder(10, 45, 45, 128);
const holes = [Manifold.cylinder(12, 10, 10, 64).translate([0, 0, -1])];
for (let k = 0; k < 6; k++) { const t = (30 + 60 * k) * D2R; holes.push(Manifold.cylinder(12, 2.75, 2.75, 32).translate([25.4 * Math.cos(t), 25.4 * Math.sin(t), -1])); }
hub = hub.subtract(Manifold.union(holes)).subtract(CUT);
parts['hub_PCD50.8'] = { m: hub, kind: 'flat' };

// Centre cap Ø40 x 6
parts['center_cap'] = { m: Manifold.cylinder(6, 20, 20, 96).translate([0, 0, 10]), kind: 'flat' };

// Spoke (local: x = tangential t, y = radial r, z = h), 4 stations, union of convex hulls
const st = [[31, 18, 10, 18], [48, 18, 10, 18], [121, 12, 41, 49], [132, 12, 41, 49]];
const ring = ([r, hw, h0, h1]) => [[-hw, r, h0], [hw, r, h0], [hw, r, h1], [-hw, r, h1]];
let spokeLocal = null;
for (let i = 0; i < 3; i++) { const h = Manifold.hull([...ring(st[i]), ...ring(st[i + 1])]); spokeLocal = spokeLocal ? spokeLocal.add(h) : h; }
for (const a of SPOKES) parts[`spoke_${frontNames[a]}`] = { m: spokeLocal.rotate([0, 0, -a]).subtract(CUT_NO_POCKET), kind: 'spoke', a };

// ---------------- print orientation ----------------
function toBed(m) {
  const b = m.boundingBox();
  return m.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]);
}
function orient(p) {
  let m = p.m;
  if (p.kind === 'rimF') { m = m.rotate([0, 0, p.c]).translate([0, 0, -hc]); }              // flat split face on bed, centre at 12 o'clock
  if (p.kind === 'rimB') { m = m.rotate([0, 0, p.c]).translate([0, 0, -hc]).rotate([180, 0, 0]); } // flip: split face down
  if (p.kind === 'flat' ) { }
  if (p.kind === 'spoke') { m = m.rotate([0, 0, p.a]).rotate([0, -90, 0]); }                // back to local, lay on its side (t = -18 face down)
  return toBed(m);
}

// ---------------- export ----------------
function writeSTL(m, file) {
  const mesh = m.getMesh();
  const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
  const nt = tv.length / 3;
  const buf = Buffer.alloc(84 + nt * 50);
  buf.write('GT300 wheel part', 0);
  buf.writeUInt32LE(nt, 80);
  let o = 84;
  for (let i = 0; i < nt; i++) {
    const p = [0, 1, 2].map(k => { const v = tv[3 * i + k]; return [vp[v * np], vp[v * np + 1], vp[v * np + 2]]; });
    const e1 = p[1].map((x, j) => x - p[0][j]), e2 = p[2].map((x, j) => x - p[0][j]);
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const L = Math.hypot(...n) || 1; n = n.map(x => x / L);
    for (const x of n) { buf.writeFloatLE(x, o); o += 4; }
    for (const q of p) for (const x of q) { buf.writeFloatLE(x, o); o += 4; }
    buf.writeUInt16LE(0, o); o += 2;
  }
  fs.writeFileSync(file, buf);
  return nt;
}

const OUT = process.env.OUT || 'out';
fs.mkdirSync(OUT, { recursive: true });
const report = [];
let assembly = [];
for (const [name, p] of Object.entries(parts)) {
  const pm = orient(p);
  const b = pm.boundingBox();
  const nt = writeSTL(pm, `${OUT}/${name}.stl`);
  report.push({ name, status: pm.status(), genus: pm.genus(), volume_cm3: +(pm.volume() / 1000).toFixed(1),
    size_mm: [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(1)), tris: nt });
  assembly.push(p.m);
}
writeSTL(Manifold.union(assembly), OUT + '/_assembly_preview.stl');
fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
