// Renders the live profile blocks from GitHub stats (runs daily in Actions, Node 20+, no deps):
//   assets/live/contrib3d.svg  3D calendar with a cell radar (top-right)
//   assets/live/stats.svg      one 6-row stats table on the left, art on the right
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const USER = process.env.USERNAME, TOKEN = process.env.GITHUB_TOKEN, OUT = 'assets/live';

// ---------- data ----------
async function loadStats() {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ variables: { login: USER }, query: `query($login:String!){ user(login:$login){
      pullRequests{ totalCount }
      repositoriesContributedTo(first:1, contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]){ totalCount }
      contributionsCollection{
        totalCommitContributions restrictedContributionsCount
        totalIssueContributions totalPullRequestReviewContributions
        contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount contributionLevel } } }
      } } }` }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  const u = j.data.user, cc = u.contributionsCollection;
  const lv = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  return {
    commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
    prs: u.pullRequests.totalCount,
    contributions: cc.contributionCalendar.totalContributions,
    issues: cc.totalIssueContributions,
    reviews: cc.totalPullRequestReviewContributions,
    repos: u.repositoriesContributedTo.totalCount,
    days: cc.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(x => [x.date, lv[x.contributionLevel] ?? 0, x.contributionCount]),
  };
}

// ---------- shared helpers ----------
const F = {A:"01110100011000111111100011000110001",B:"11110100011000111110100011000111110",C:"01111100001000010000100001000001111",D:"11110100011000110001100011000111110",E:"11111100001000011110100001000011111",F:"11111100001000011110100001000010000",G:"01111100001000010111100011000101111",H:"10001100011000111111100011000110001",I:"11111001000010000100001000010011111",J:"00111000100001000010000101001001100",L:"10000100001000010000100001000011111",M:"10001110111010110101100011000110001",N:"10001110011010110011100011000110001",O:"01110100011000110001100011000101110",P:"11110100011000111110100001000010000",Q:"01110100011000110001101011001001101",R:"11110100011000111110101001001010001",S:"01111100001000001110000010000111110",T:"11111001000010000100001000010000100",U:"10001100011000110001100011000101110",V:"10001100011000110001100010101000100",W:"10001100011000110101101011010101010",Y:"10001100010101000100001000010000100",
'0':"01110100111010111001100011000101110",'1':"00100011000010000100001000010001110",'2':"01110100010000100110010001000011111",'3':"11110000010000101110000010000111110",'4':"00010001100101010010111110001000010",'5':"11111100001111000001000011000101110",'6':"00110010001000011110100011000101110",'7':"11111000010001000100010000100001000",'8':"01110100011000101110100011000101110",'9':"01110100011000101111000010001001100",
'/':"00001000100001000100010000100010000",'%':"11001110010001000100010001001110011",'-':"00000000000000011111000000000000000",' ':"00000000000000000000000000000000000"};
const n2 = v => +v.toFixed(2);
function ptext(s, x, y, px, fill) {
  const d = []; let cx = x;
  for (const ch of String(s).toUpperCase()) { const g = F[ch] || F[' '];
    for (let i = 0; i < 35; i++) if (g[i] === '1') d.push(`M${n2(cx + (i % 5) * px)} ${n2(y + Math.floor(i / 5) * px)}h${px}v${px}h-${px}z`);
    cx += 6 * px; }
  return `<path fill="${fill}" d="${d.join('')}"/>`;
}
const tw = (s, px) => String(s).length * 6 * px - px;
const svg = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
const goal = (v, base) => { let g = base; while (v >= g) g *= 2; return g; };
const hex = c => c.match(/\w\w/g).map(h => parseInt(h, 16));
const mix = (a, b, k) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
// value -> colour (red only): burgundy -> red -> light red -> white
const red = t => { t = Math.max(0, Math.min(1, t));
  if (t < 0.5) return mix('#4a1416', '#e0262d', t / 0.5);
  if (t < 0.85) return mix('#e0262d', '#ff7a7a', (t - 0.5) / 0.35);
  return mix('#ff7a7a', '#fff1f1', (t - 0.85) / 0.15); };
const shade = (c, k) => '#' + hex(c).map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('');
// 7x7 pixel icons
const ICONS = {
  commits:       ["0001000","0001000","0011100","1110111","0011100","0001000","0001000"],
  prs:           ["0100010","1110111","0100010","0100010","0100010","1110111","0100010"],
  contributions: ["1101011","1101011","0000000","1101011","1101011","0000000","1101011"],
  issues:        ["0011100","0100010","1001001","1001001","1000001","0101010","0011100"],
  reviews:       ["0000000","0011100","0100010","1001001","0100010","0011100","0000000"],
  repos:         ["1111110","1000010","1011010","1000010","1011010","1000010","1111110"],
};
function icon(name, cx, cy, px, fill) {
  const d = [], x0 = cx - 3.5 * px, y0 = cy - 3.5 * px;
  ICONS[name].forEach((row, r) => [...row].forEach((b, c) => { if (b === '1') d.push(`M${n2(x0 + c * px)} ${n2(y0 + r * px)}h${px}v${px}h-${px}z`); }));
  return `<path fill="${fill}" d="${d.join('')}"/>`;
}
const BG = "#0d1117";

function metrics(st) {
  return [
    { k: 'commits', label: 'COMMITS', v: st.commits, g: goal(st.commits, 50) },
    { k: 'prs', label: 'PULL REQUESTS', v: st.prs, g: goal(st.prs, 20) },
    { k: 'contributions', label: 'CONTRIBUTIONS', v: st.contributions, g: goal(st.contributions, 100) },
    { k: 'issues', label: 'ISSUES', v: st.issues, g: goal(st.issues, 10) },
    { k: 'reviews', label: 'REVIEWS', v: st.reviews, g: goal(st.reviews, 10) },
    { k: 'repos', label: 'REPOS', v: st.repos, g: goal(st.repos, 5) },
  ].map(m => ({ ...m, t: Math.min(1, m.v / m.g) }));
}

// ---------- cell radar: 5 sectors x 4 rings, whole cells light up ----------
function radarGroup(ms, cx, cy, R) {
  const ax = ['commits', 'prs', 'issues', 'reviews', 'repos'].map(k => ms.find(m => m.k === k));
  const N = 5, L = 4, ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
  const V = (i, l) => [cx + R * l / L * Math.cos(ang(i)), cy + R * l / L * Math.sin(ang(i))];
  const M = (i, l) => { const a = V(i, l), b = V((i + 1) % N, l); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const P = p => p.map(n2).join(',');
  const RING = ["#6b171b", "#a81f25", "#e0262d", "#ff6b6b"]; // centre -> edge
  const b = [];
  ax.forEach((m, i) => {
    const lit = m.v > 0 ? Math.max(1, Math.ceil(m.t * L)) : 0;
    for (let l = 1; l <= L; l++) {
      const pm = (i + N - 1) % N;
      const pts = l === 1
        ? [[cx, cy], M(pm, 1), V(i, 1), M(i, 1)]
        : [M(pm, l - 1), V(i, l - 1), M(i, l - 1), M(i, l), V(i, l), M(pm, l)];
      b.push(`<polygon points="${pts.map(P).join(' ')}" fill="${l <= lit ? RING[l - 1] : '#211c1d'}" stroke="${BG}" stroke-width="2.5" stroke-linejoin="round"/>`);
    }
  });
  return b.join('');
}

// ---------- 3D calendar with overlays ----------
function contrib3d(st, ms) {
  const W = 860, h = 450, days = st.days;
  const total = days.reduce((s, d) => s + d[2], 0), max = Math.max(1, ...days.map(d => d[2]));
  const wv = [12.6, 4.3], dv = [-9, 9], ox = 30 + 7 * 9, oy = 96;
  const pt = (w, d, z) => [n2(ox + w * wv[0] + d * dv[0]), n2(oy + w * wv[1] + d * dv[1] - z)];
  const empty = "#1f1a1b";
  const firstDow = new Date(days[0][0] + 'T00:00:00Z').getUTCDay();
  const cells = days.map((c, i) => { const k = i + firstDow; return { w: Math.floor(k / 7), d: k % 7, n: c[2] }; });
  cells.sort((a, b) => (a.w * wv[1] + a.d * dv[1]) - (b.w * wv[1] + b.d * dv[1]) || a.w - b.w);
  const gap = 0.12, out = [];
  for (const c of cells) {
    const z = c.n ? 10 + 90 * Math.sqrt(c.n / max) : 2, col = c.n ? red(Math.sqrt(c.n / max)) : empty;
    const w0 = c.w + gap, w1 = c.w + 1 - gap, d0 = c.d + gap, d1 = c.d + 1 - gap, Q = (w, d, zz) => pt(w, d, zz).join(',');
    out.push(`<polygon fill="${shade(col, 0.62)}" points="${Q(w0, d1, 0)} ${Q(w1, d1, 0)} ${Q(w1, d1, z)} ${Q(w0, d1, z)}"/>`);
    out.push(`<polygon fill="${shade(col, 0.42)}" points="${Q(w1, d0, 0)} ${Q(w1, d1, 0)} ${Q(w1, d1, z)} ${Q(w1, d0, z)}"/>`);
    out.push(`<polygon fill="${col}" points="${Q(w0, d0, z)} ${Q(w1, d0, z)} ${Q(w1, d1, z)} ${Q(w0, d1, z)}"/>`);
  }
  const b = [out.join('')];
  b.push(radarGroup(ms, 735, 128, 94));       // empty corner above the grid
  const label = `${total} CONTRIBUTIONS`;
  b.push(ptext(label, W - 28 - tw(label, 1.5), h - 28 - 7 - 10.5, 1.5, "#e6edf3"));
  const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const f = new Date(days[0][0]), l = new Date(days[days.length - 1][0]);
  const range = `${mon[f.getUTCMonth()]} ${f.getUTCFullYear()} - ${mon[l.getUTCMonth()]} ${l.getUTCFullYear()}`;
  b.push(ptext(range, W - 28 - tw(range, 1), h - 28, 1, "#8b949e"));
  b.push(ptext("LAST YEAR", 28, 24, 1, "#8b949e"));
  [empty, red(0.15), red(0.45), red(0.75), red(1)].forEach((c, i) => b.push(`<rect x="${W - 28 - 66 + i * 14}" y="${h - 28 - 7 - 10.5 - 20}" width="10" height="10" fill="${c}"/>`));
  return svg(W, h, b.join(''), `${total} contributions in the last year`);
}

// ---------- stats table (left) + art (right) ----------
function statsBlock(ms) {
  const W = 860, ART_W = 240, ART_H = Math.round(ART_W * 640 / 360), H = ART_H;
  const lx = 40, tableW = 500, rowH = 62, rowContent = 34;
  const ly = Math.round((H - ((ms.length - 1) * rowH + rowContent)) / 2);
  const b = [];
  ms.forEach((m, i) => {
    const y = ly + i * rowH;
    b.push(icon(m.k, lx + 5, y + 5, 1.5, "#6e7681"));
    b.push(ptext(m.label, lx + 24, y, 1.5, "#e6edf3"));
    b.push(ptext(`${m.v} / ${m.g}`, lx + 24, y + 17, 1, "#6e7681"));
    const pct = `${Math.round(m.t * 100)}%`;
    b.push(ptext(pct, lx + tableW - tw(pct, 1.5), y, 1.5, red(Math.max(m.t, 0.3))));
    b.push(`<rect x="${lx + 24}" y="${y + rowContent}" width="${tableW - 24}" height="1" fill="#21262d"/>`);
  });
  const art = readFileSync('assets/v3/art_s.png').toString('base64');
  b.push(`<image x="${W - ART_W}" y="0" width="${ART_W}" height="${ART_H}" href="data:image/png;base64,${art}"/>`);
  return svg(W, H, b.join(''), 'stats');
}

const st = process.env.STATS_JSON ? JSON.parse(readFileSync(process.env.STATS_JSON, 'utf8')) : await loadStats();
const ms = metrics(st);
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/contrib3d.svg`, contrib3d(st, ms));
writeFileSync(`${OUT}/stats.svg`, statsBlock(ms));
console.log(ms.map(m => `${m.k}=${m.v}/${m.g}`).join(' '));
