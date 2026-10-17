// Renders assets/live/rings.svg and assets/live/contrib3d.svg from live GitHub stats.
// Runs in GitHub Actions (Node 20+, no dependencies). Needs GITHUB_TOKEN and USERNAME.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const USER = process.env.USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = 'assets/live';

// ---------- data ----------
async function gql(query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

async function loadStats() {
  const d = await gql(`query($login:String!){
    user(login:$login){
      pullRequests{ totalCount }
      repositoriesContributedTo(first:1, contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]){ totalCount }
      contributionsCollection{
        totalCommitContributions
        restrictedContributionsCount
        contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount contributionLevel } } }
      }
    }
  }`, { login: USER });
  const u = d.user, cc = u.contributionsCollection;
  const levels = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const days = cc.contributionCalendar.weeks.flatMap(w => w.contributionDays)
    .map(x => [x.date, levels[x.contributionLevel] ?? 0, x.contributionCount]);
  return {
    commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
    prs: u.pullRequests.totalCount,
    contributions: cc.contributionCalendar.totalContributions,
    repos: u.repositoriesContributedTo.totalCount,
    days,
  };
}

// ---------- pixel font ----------
const F = {A:"01110100011000111111100011000110001",B:"11110100011000111110100011000111110",C:"01111100001000010000100001000001111",D:"11110100011000110001100011000111110",E:"11111100001000011110100001000011111",F:"11111100001000011110100001000010000",G:"01111100001000010111100011000101111",I:"11111001000010000100001000010011111",J:"00111000100001000010000101001001100",L:"10000100001000010000100001000011111",M:"10001110111010110101100011000110001",N:"10001110011010110011100011000110001",O:"01110100011000110001100011000101110",P:"11110100011000111110100001000010000",Q:"01110100011000110001101011001001101",R:"11110100011000111110101001001010001",S:"01111100001000001110000010000111110",T:"11111001000010000100001000010000100",U:"10001100011000110001100011000101110",V:"10001100011000110001100010101000100",Y:"10001100010101000100001000010000100",
'0':"01110100111010111001100011000101110",'1':"00100011000010000100001000010001110",'2':"01110100010000100110010001000011111",'3':"11110000010000101110000010000111110",'4':"00010001100101010010111110001000010",'5':"11111100001111000001000011000101110",'6':"00110010001000011110100011000101110",'7':"11111000010001000100010000100001000",'8':"01110100011000101110100011000101110",'9':"01110100011000101111000010001001100",
'/':"00001000100001000100010000100010000",'%':"11001110010001000100010001001110011",'-':"00000000000000011111000000000000000",' ':"00000000000000000000000000000000000"};
const n2 = v => +v.toFixed(2);
function ptext(s, x, y, px, fill) {
  const d = []; let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = F[ch] || F[' '];
    for (let i = 0; i < 35; i++) if (g[i] === '1') d.push(`M${n2(cx + (i % 5) * px)} ${n2(y + Math.floor(i / 5) * px)}h${px}v${px}h-${px}z`);
    cx += 6 * px;
  }
  return `<path fill="${fill}" d="${d.join('')}"/>`;
}
const tw = (s, px) => String(s).length * 6 * px - px;
const svg = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;

const G = ["#0f2a16","#14552a","#1e8a3a","#2dc04f","#52e070","#a6ffbc"], TEXT = "#e6ede8", MUTED = "#7f8f86";
const W = 860;

// goal grows with the value so the ring never overflows
const goal = (v, base) => { let g = base; while (v >= g) g *= 2; return g; };

// value -> colour: burgundy/red when low, green in the middle, white near the top
const hex = c => c.match(/\w\w/g).map(h => parseInt(h, 16));
const mix = (a, b, k) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
const heat = t => { t = Math.max(0, Math.min(1, t));
  if (t < 0.45) return mix('#4a1416', '#e0262d', t / 0.45);
  if (t < 0.85) return mix('#1e8a3a', '#52e070', (t - 0.45) / 0.4);
  return mix('#52e070', '#f2fff5', (t - 0.85) / 0.15); };

// ---------- rings ----------
function rings(st) {
  const H = 190, sw = 11, SHIFT = 24;
  const rs = [
    ["COMMITS", st.commits, goal(st.commits, 50), "#a6ffbc"],
    ["PULL REQUESTS", st.prs, goal(st.prs, 20), "#52e070"],
    ["CONTRIBUTIONS", st.contributions, goal(st.contributions, 100), "#2dc04f"],
    ["REPOS", st.repos, goal(st.repos, 5), "#1e8a3a"],
  ];
  rs.forEach(r => { r[3] = heat(r[1] / r[2]); });
  const radii = [78, 63, 48, 33], outer = 78 + sw / 2;
  const RW = 520; // compact block that sits next to the art
  const legendW = 230, gap = 48, groupW = outer * 2 + gap + legendW, start = (RW - groupW) / 2;
  const cx = n2(start + outer - SHIFT), cy = H / 2, lx = n2(start + outer * 2 + gap + SHIFT), lex = lx + legendW;
  const b = [];
  rs.forEach(([, v, g, col], i) => {
    const r = radii[i], C = n2(2 * Math.PI * r), off = n2(C * (1 - Math.min(1, v / g)));
    b.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-opacity="0.14" stroke-width="${sw}"/>`);
    b.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cy})"><animate attributeName="stroke-dashoffset" from="${C}" to="${off}" dur="${1.2 + i * 0.25}s" calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" fill="freeze"/></circle>`);
  });
  const rowH = 30, ly = cy - (rs.length * rowH) / 2 + 6;
  rs.forEach(([name, v, g, col], i) => {
    const y = n2(ly + i * rowH);
    b.push(`<circle cx="${lx + 3}" cy="${y + 4}" r="3" fill="${col}"/>`);
    b.push(ptext(name, lx + 14, y, 1.5, "#d5ddd8"));
    b.push(ptext(`${v} / ${g}`, lx + 14, y + 14, 1, "#6f7d75"));
    const pct = `${Math.round((v / g) * 100)}%`;
    b.push(ptext(pct, lex - tw(pct, 1.5), y, 1.5, col));
    b.push(`<rect x="${lx + 14}" y="${y + 24}" width="${legendW - 14}" height="0.6" fill="#24302a"/>`);
  });
  return svg(RW, H, b.join(''), 'activity rings');
}

// ---------- 3D calendar ----------
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
function contrib3d(days) {
  const h = 420, total = days.reduce((s, d) => s + d[2], 0), max = Math.max(1, ...days.map(d => d[2]));
  const wv = [12.6, 4.3], dv = [-9, 9], ox = 30 + 7 * 9, oy = 96;
  const pt = (w, d, z) => [n2(ox + w * wv[0] + d * dv[0]), n2(oy + w * wv[1] + d * dv[1] - z)];
  const empty = "#1c2420";
  // GitHub weeks start on Sunday; pad the first week so day index == weekday
  const firstDow = new Date(days[0][0] + 'T00:00:00Z').getUTCDay();
  const cells = days.map((c, i) => { const k = i + firstDow; return { w: Math.floor(k / 7), d: k % 7, lv: c[1], n: c[2] }; });
  cells.sort((a, b) => (a.w * wv[1] + a.d * dv[1]) - (b.w * wv[1] + b.d * dv[1]) || a.w - b.w);
  const gap = 0.12, out = [];
  for (const c of cells) {
    const z = c.n ? 10 + 90 * Math.sqrt(c.n / max) : 2;
    const col = c.n ? heat(Math.sqrt(c.n / max)) : empty;
    const w0 = c.w + gap, w1 = c.w + 1 - gap, d0 = c.d + gap, d1 = c.d + 1 - gap;
    const P = (w, d, zz) => pt(w, d, zz).join(',');
    out.push(`<polygon fill="${shade(col, 0.62)}" points="${P(w0, d1, 0)} ${P(w1, d1, 0)} ${P(w1, d1, z)} ${P(w0, d1, z)}"/>`);
    out.push(`<polygon fill="${shade(col, 0.42)}" points="${P(w1, d0, 0)} ${P(w1, d1, 0)} ${P(w1, d1, z)} ${P(w1, d0, z)}"/>`);
    out.push(`<polygon fill="${col}" points="${P(w0, d0, z)} ${P(w1, d0, z)} ${P(w1, d1, z)} ${P(w0, d1, z)}"/>`);
  }
  const b = [out.join('')];
  const label = `${total} CONTRIBUTIONS`;
  b.push(ptext(label, W - 28 - tw(label, 1.5), h - 28 - 7 - 10.5, 1.5, TEXT));
  const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const f = new Date(days[0][0]), l = new Date(days[days.length - 1][0]);
  const range = `${mon[f.getUTCMonth()]} ${f.getUTCFullYear()} - ${mon[l.getUTCMonth()]} ${l.getUTCFullYear()}`;
  b.push(ptext(range, W - 28 - tw(range, 1), h - 28, 1, MUTED));
  b.push(ptext("LAST YEAR", 28, 24, 1, MUTED));
  [empty, heat(0.15), heat(0.4), heat(0.65), heat(1)].forEach((c, i) => b.push(`<rect x="${28 + i * 14}" y="${h - 38}" width="10" height="10" fill="${c}"/>`));
  return svg(W, h, b.join(''), `${total} contributions in the last year`);
}

// ---------- main ----------
const st = process.env.STATS_JSON ? JSON.parse(readFileSync(process.env.STATS_JSON, 'utf8')) : await loadStats();
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/rings.svg`, rings(st));
writeFileSync(`${OUT}/contrib3d.svg`, contrib3d(st.days));
console.log(`commits=${st.commits} prs=${st.prs} contributions=${st.contributions} repos=${st.repos} days=${st.days.length}`);
