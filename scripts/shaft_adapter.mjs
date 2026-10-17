// Printed shaft adapter: Ø8 D-shaft (flat) -> hub PCD 50.8 (6x M5), split clamp + set screw.
// Frame: Z = 0 is the hub mounting face (hub back face), motor side is -Z. Same X/Y as the wheel.
import Module from './manifold.js';
import fs from 'fs';
const w = await Module(); w.setup();
const { Manifold, CrossSection } = w;

const P = {
  bore: 8.2,         // Ø8 shaft + 0.2 clearance
  flat: 7.6,         // bore across the flat (fits shafts with 7.0–7.5 across flat; set screw takes up play)
  flangeD: 68, flangeT: 8,
  bossD: 30, bossL: 22,          // boss Z -30 .. -8
  earW: 18, earOut: 25.5,          // clamp ears: X ±9, out to 21 mm from axis
  slit: 1.5,
};
const Z0 = -(P.flangeT + P.bossL); // -30 (boss end, motor side)

const hex = (af, h) => Manifold.cylinder(h, af / Math.sqrt(3), af / Math.sqrt(3), 6); // across-flats -> circumradius

// ---- body (local frame: clamp ears toward -Y, flat/set screw toward +Y) ----
let body = Manifold.cylinder(P.flangeT, P.flangeD / 2, P.flangeD / 2, 160).translate([0, 0, -P.flangeT])
  .add(Manifold.cylinder(P.bossL, P.bossD / 2, P.bossD / 2, 96).translate([0, 0, Z0]))
  .add(Manifold.cube([P.earW, P.earOut - 9, P.bossL]).translate([-P.earW / 2, -P.earOut, Z0]));

// D-bore through everything
const dcs = CrossSection.circle(P.bore / 2, 64).intersect(CrossSection.square([20, P.flat / 2 + 10]).translate([-10, -10]));
const bore = Manifold.extrude(dcs, 40).translate([0, 0, Z0 - 5]);

// clamp slit (only through the boss + ears, stops 0 mm into flange -> flange stays solid)
const slit = Manifold.cube([P.slit, P.earOut + 1, P.bossL + 0.01]).translate([-P.slit / 2, -P.earOut - 0.5, Z0 - 0.01]);

// 2 clamp screws M4 along X through the ears (y = -16), head counterbore on +X, nut trap on -X
const clampCuts = [];
for (const z of [-13, -25]) {
  const cx = Manifold.cylinder(P.earW + 2, 2.2, 2.2, 32).rotate([0, 90, 0]).translate([-P.earW / 2 - 1, -18.8, z]);
  const head = Manifold.cylinder(5, 3.8, 3.8, 32).rotate([0, 90, 0]).translate([P.earW / 2 - 4, -18.8, z]);        // Ø7.6, 4 deep
  const nut = hex(7.2, 5).rotate([0, 90, 0]).translate([-P.earW / 2 - 1, -18.8, z]);                               // M4 nut, 4 deep
  clampCuts.push(cx, head, nut);
}

// set screw M4 radial along +Y onto the flat, nut trap slot entering from the boss end face
const zs = -18;
const setHole = Manifold.cylinder(20, 2.1, 2.1, 32).rotate([-90, 0, 0]).translate([0, P.flat / 2 - 0.5, zs]);
const setNut = hex(7.2, 3.6).rotate([-90, 0, 0]).rotate([0, 90, 0].map(() => 0)).translate([0, 7.0, zs]);     // nut plane ⟂ Y, y 7.0..10.6
const setSlot = Manifold.cube([7.2, 3.6, zs - Z0 + 1]).translate([-3.6, 7.0, Z0 - 1]);                          // slide nut in from the end

let adapter = body.subtract(Manifold.union([bore, slit, ...clampCuts, setHole, setNut, setSlot]));

// rotate so ears point to +X (between PCD holes at 330° and 30°)
adapter = adapter.rotate([0, 0, 90]);

// PCD 50.8: 6x Ø5.5 through, M5 nut traps (8 AF) 4.2 deep from the motor-side face of the flange
const pcd = [];
for (let k = 0; k < 6; k++) {
  const t = (30 + 60 * k) * Math.PI / 180, x = 25.4 * Math.cos(t), y = 25.4 * Math.sin(t);
  pcd.push(Manifold.cylinder(P.flangeT + 2, 2.75, 2.75, 32).translate([x, y, -P.flangeT - 1]));
  pcd.push(hex(8.2, 4.2 + 1).rotate([0, 0, 30 + 60 * k]).translate([x, y, -P.flangeT - 1]));
}
adapter = adapter.subtract(Manifold.union(pcd));

// ---- export: print with hub face (Z=0) on the bed, boss up ----
function writeSTL(m, file) {
  const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts, nt = tv.length / 3;
  const buf = Buffer.alloc(84 + nt * 50); buf.write('GT300 shaft adapter', 0); buf.writeUInt32LE(nt, 80); let o = 84;
  for (let i = 0; i < nt; i++) {
    const p = [0, 1, 2].map(k => { const v = tv[3 * i + k]; return [vp[v * np], vp[v * np + 1], vp[v * np + 2]]; });
    const a = p[1].map((x, j) => x - p[0][j]), b = p[2].map((x, j) => x - p[0][j]);
    let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const L = Math.hypot(...n) || 1;
    for (const x of n) { buf.writeFloatLE(x / L, o); o += 4; }
    for (const q of p) for (const x of q) { buf.writeFloatLE(x, o); o += 4; }
    buf.writeUInt16LE(0, o); o += 2;
  }
  fs.writeFileSync(file, buf); return nt;
}
const printed = adapter.rotate([180, 0, 0]);   // Z=0 face -> bed, boss up
const bb = printed.boundingBox();
const out = printed.translate([0, 0, -bb.min[2]]);
writeSTL(out, 'out/shaft_adapter_D8.stl');
writeSTL(adapter, 'out/_adapter_in_place.stl');
const b2 = out.boundingBox();
console.log(JSON.stringify({ status: out.status(), genus: out.genus(), vol_cm3: +(out.volume() / 1000).toFixed(1),
  size: [0, 1, 2].map(i => +(b2.max[i] - b2.min[i]).toFixed(1)) }));
