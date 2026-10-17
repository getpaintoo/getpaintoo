// Composes assets/live/stats.svg: rings + radar on the left, art on the right.
// One image instead of HTML floats, so GitHub always renders the layout the same way.
import { readFileSync, writeFileSync } from 'node:fs';

const inner = s => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[^<]*<\/title>/, '');
const size = s => s.match(/width="(\d+)" height="(\d+)"/).slice(1).map(Number);

const rings = readFileSync('assets/live/rings.svg', 'utf8');
const radar = readFileSync('assets/live/radar.svg', 'utf8');
const art = readFileSync('assets/v3/art_s.png').toString('base64');

const W = 860, ART_W = 300, ART_H = Math.round(ART_W * 640 / 360);
const [rw, rh] = size(rings), [dw, dh] = size(radar);
const leftH = rh + 10 + dh, H = Math.max(ART_H, leftH), top = Math.round((H - leftH) / 2);
const leftW = W - ART_W;

const body =
  `<svg x="${Math.round((leftW - rw) / 2)}" y="${top}" width="${rw}" height="${rh}" viewBox="0 0 ${rw} ${rh}">${inner(rings)}</svg>` +
  `<svg x="${Math.round((leftW - dw) / 2)}" y="${top + rh + 10}" width="${dw}" height="${dh}" viewBox="0 0 ${dw} ${dh}">${inner(radar)}</svg>` +
  `<image x="${leftW}" y="${Math.round((H - ART_H) / 2)}" width="${ART_W}" height="${ART_H}" href="data:image/png;base64,${art}"/>`;

writeFileSync('assets/live/stats.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="stats"><title>stats</title>${body}</svg>`);
console.log('compose', W, H);
