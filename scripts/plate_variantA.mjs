import Module from './manifold.js'; import fs from 'fs';
const w=await Module(); w.setup(); const {CrossSection}=w;
const D=Math.PI/180;
const circle=(r,n=96,x=0,y=0)=>CrossSection.circle(r,n).translate([x,y]);
const U=a=>[Math.sin(a*D),Math.cos(a*D)];
// ring 128..146, hub R40, spokes 30 wide at 90/180/270 (clock)
let ring = circle(146,192).subtract(circle(128,192));
let hub = circle(40,96);
let spokes = [];
for (const a of [90,180,270]) {
  // rectangle along +Y (clock 0) then rotate: CrossSection.rotate is CCW degrees; clock a -> rotate(-a)
  spokes.push(CrossSection.square([30, 100]).translate([-15, 30]).rotate(-a));
}
let plate = CrossSection.union([ring, hub, ...spokes]);
// round concave corners R10 (close), convex corners R3 (open)
plate = plate.offset(10, 'Round', 2, 48).offset(-10, 'Round', 2, 48);
plate = plate.offset(-3, 'Round', 2, 24).offset(3, 'Round', 2, 24);
// holes
const holes=[circle(10,48)];
for (let k=0;k<6;k++){const t=(30+60*k)*D; holes.push(circle(2.75,24,25.4*Math.cos(t),25.4*Math.sin(t)));}
for (let k=0;k<16;k++){const [ux,uy]=U(11.25+22.5*k); holes.push(circle(1.75,20,137*ux,137*uy));}   // Ø3.5 for 2.9 self-tappers
// lightening slots in spokes 12 x 46 (rounded), r 60..106
for (const a of [90,180,270]) {
  const slot = CrossSection.square([12-0.01,46]).translate([-6,60]).offset(0,'Round').rotate(-a);
  holes.push(slot.offset(-5.99,'Round',2,24).offset(5.99,'Round',2,24));
}
plate = plate.subtract(CrossSection.union(holes));
const polys = plate.toPolygons();
const area = plate.area();
fs.writeFileSync('plate_polys.json', JSON.stringify(polys.map(p=>p.map(q=>[+q[0].toFixed(3),+q[1].toFixed(3)]))));
console.log(JSON.stringify({contours:polys.length, pts:polys.reduce((s,p)=>s+p.length,0), area_mm2:Math.round(area), mass_g_Al4mm: Math.round(area*4*2.7/1000)}));
