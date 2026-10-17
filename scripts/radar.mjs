// Renders assets/live/radar.svg: activity-by-type radar ("heat" bands, pixel icons).
// Runs in GitHub Actions (Node 20+, no deps). Needs GITHUB_TOKEN and USERNAME.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const USER = process.env.USERNAME, TOKEN = process.env.GITHUB_TOKEN, OUT = 'assets/live';

async function loadStats() {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query($login:String!){ user(login:$login){ contributionsCollection{
      totalCommitContributions restrictedContributionsCount totalPullRequestContributions
      totalIssueContributions totalPullRequestReviewContributions totalRepositoryContributions } } }`,
      variables: { login: USER } }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  const c = j.data.user.contributionsCollection;
  return {
    commits: c.totalCommitContributions + c.restrictedContributionsCount,
    prs: c.totalPullRequestContributions,
    issues: c.totalIssueContributions,
    reviews: c.totalPullRequestReviewContributions,
    repos: c.totalRepositoryContributions,
  };
}

// ---------- pixel font + icons ----------
const F = {A:"01110100011000111111100011000110001",B:"11110100011000111110100011000111110",C:"01111100001000010000100001000001111",D:"11110100011000110001100011000111110",E:"11111100001000011110100001000011111",H:"10001100011000111111100011000110001",I:"11111001000010000100001000010011111",L:"10000100001000010000100001000011111",M:"10001110111010110101100011000110001",N:"10001110011010110011100011000110001",O:"01110100011000110001100011000101110",P:"11110100011000111110100001000010000",Q:"01110100011000110001101011001001101",R:"11110100011000111110101001001010001",S:"01111100001000001110000010000111110",T:"11111001000010000100001000010000100",U:"10001100011000110001100011000101110",V:"10001100011000110001100010101000100",W:"10001100011000110101101011010101010",Y:"10001100010101000100001000010000100",
'0':"01110100111010111001100011000101110",'1':"00100011000010000100001000010001110",'2':"01110100010000100110010001000011111",'3':"11110000010000101110000010000111110",'4':"00010001100101010010111110001000010",'5':"11111100001111000001000011000101110",'6':"00110010001000011110100011000101110",'7':"11111000010001000100010000100001000",'8':"01110100011000101110100011000101110",'9':"01110100011000101111000010001001100",'%':"11001110010001000100010001001110011",' ':"00000000000000000000000000000000000"};
const n2 = v => +v.toFixed(2);
function ptext(s, x, y, px, fill) {
  const d = []; let cx = x;
  for (const ch of String(s).toUpperCase()) { const g = F[ch] || F[' '];
    for (let i = 0; i < 35; i++) if (g[i] === '1') d.push(`M${n2(cx + (i % 5) * px)} ${n2(y + Math.floor(i / 5) * px)}h${px}v${px}h-${px}z`);
    cx += 6 * px; }
  return `<path fill="${fill}" d="${d.join('')}"/>`;
}
const tw = (s, px) => String(s).length * 6 * px - px;
// 7x7 pixel glyphs: commit, pull request, issue, review (eye), repo (book)
const ICONS = {
  commits: ["0001000","0001000","0011100","1110111","0011100","0001000","0001000"],
  prs:     ["0100010","1110111","0100010","0100010","0100010","1110111","0100010"],
  issues:  ["0011100","0100010","1001001","1001001","1000001","0101010","0011100"],
  reviews: ["0000000","0011100","0100010","1001001","0100010","0011100","0000000"],
  repos:   ["1111110","1000010","1011010","1000010","1011010","1000010","1111110"],
};
function icon(name, cx, cy, px, fill) {
  const g = ICONS[name], d = [], x0 = cx - 3.5 * px, y0 = cy - 3.5 * px;
  g.forEach((row, r) => [...row].forEach((b, c) => { if (b === '1') d.push(`M${n2(x0 + c * px)} ${n2(y0 + r * px)}h${px}v${px}h-${px}z`); }));
  return `<path fill="${fill}" d="${d.join('')}"/>`;
}

// ---------- radar ----------
const goal = (v, base) => { let g = base; while (v >= g) g *= 2; return g; };
function radar(st) {
  const W = 860, H = 230, R = 84, legendW = 230, gap = 70;
  const groupW = legendW + gap + (R + 34) * 2, start = (W - groupW) / 2;
  const lx = start, cx = n2(start + legendW + gap + R + 34), cy = H / 2 + 4;
  const axes = [
    ["commits", "COMMITS", st.commits, 50],
    ["prs", "PULL REQUESTS", st.prs, 20],
    ["issues", "ISSUES", st.issues, 10],
    ["reviews", "REVIEWS", st.reviews, 10],
    ["repos", "NEW REPOS", st.repos, 5],
  ].map(([k, label, v, base]) => ({ k, label, v, g: goal(v, base) }));
  const N = axes.length, ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
  const P = (i, r) => [n2(cx + r * Math.cos(ang(i))), n2(cy + r * Math.sin(ang(i)))];
  const poly = r => axes.map((_, i) => P(i, r).join(',')).join(' ');
  const BG = "#0d1117", GRID = ["#1a211d", "#202923", "#26302a", "#2c3830"];
  const HEAT = ["#2dc04f", "#a3d94a", "#f2b84b", "#ff3b3b"]; // outer -> core
  const b = [];
  // grid: 4 grey bands with gaps (outer first)
  for (let L = 4; L >= 1; L--) b.push(`<polygon points="${poly(R * L / 4)}" fill="${GRID[4 - L]}" stroke="${BG}" stroke-width="3" stroke-linejoin="round"/>`);
  // data shape: each axis at least 8% so empty axes still read as a point
  const ratio = axes.map(a => Math.max(0.08, Math.min(1, a.v / a.g)));
  const shape = axes.map((_, i) => P(i, R * ratio[i]).join(',')).join(' ');
  b.push(`<clipPath id="rd"><polygon points="${shape}"/></clipPath><g clip-path="url(#rd)">`);
  for (let L = 4; L >= 1; L--) b.push(`<polygon points="${poly(R * L / 4)}" fill="${HEAT[4 - L]}" stroke="${BG}" stroke-width="3" stroke-linejoin="round"/>`);
  b.push(`</g>`);
  // icons at vertices; strongest axis highlighted
  const best = ratio.indexOf(Math.max(...ratio));
  axes.forEach((a, i) => { const [x, y] = P(i, R + 20); b.push(icon(a.k, x, y, 2, i === best ? "#e6ede8" : "#56635b")); });
  // legend (left)
  const rowH = 30, ly = cy - (N * rowH) / 2 + 6;
  axes.forEach((a, i) => {
    const y = n2(ly + i * rowH), col = i === best ? "#ff3b3b" : "#2dc04f";
    b.push(icon(a.k, lx + 4, y + 4, 1.2, i === best ? "#e6ede8" : "#56635b"));
    b.push(ptext(a.label, lx + 18, y, 1.5, "#d5ddd8"));
    b.push(ptext(`${a.v}`, lx + 18, y + 14, 1, "#6f7d75"));
    const val = `${Math.round(Math.min(1, a.v / a.g) * 100)}%`;
    b.push(ptext(val, lx + legendW - tw(val, 1.5), y, 1.5, col));
    b.push(`<rect x="${lx + 18}" y="${y + 24}" width="${legendW - 18}" height="0.6" fill="#24302a"/>`);
  });
  const body = b.join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="activity by type"><title>activity by type</title>${body}</svg>`;
}

const st = process.env.RADAR_JSON ? JSON.parse(readFileSync(process.env.RADAR_JSON, 'utf8')) : await loadStats();
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/radar.svg`, radar(st));
console.log('radar', JSON.stringify(st));
