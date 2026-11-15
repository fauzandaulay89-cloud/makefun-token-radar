// Local replica of the gate's seven checks (RULES.txt "The gate"), run against
// an output directory. Not the scorer itself — the scorer stays on the server —
// but it refuses exactly the shapes the gate refuses.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';

const out = process.argv[2] ?? 'out';
const snap = JSON.parse(readFileSync('../token-radar-01-kit/input/snapshot.json', 'utf8'));
const snapSlugs = new Set(snap.protocols.map((p) => p.slug));
const watchlist = snap.watchlist;
let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fail++;
};

// 1. dashboard_files
{
  const files = readdirSync(join(out, 'dashboard'));
  const hasHtml = files.includes('index.html');
  const hasCss = files.some((f) => f.endsWith('.css'));
  const hasJs = files.some((f) => f.endsWith('.js'));
  let bytes = 0;
  let netRef = null;
  for (const f of files) {
    const p = join(out, 'dashboard', f);
    bytes += statSync(p).size;
    const text = readFileSync(p, 'utf8');
    // no http(s) in HTML attribute values, CSS, or JS import specifiers
    if (f.endsWith('.html') && /(href|src)\s*=\s*["']https?:\/\//i.test(text)) netRef = f + ' html attr';
    if (f.endsWith('.css') && /https?:\/\//.test(text)) netRef = f + ' css url';
    if (f.endsWith('.js') && /(from\s+["']|import\s*\(\s*["']|require\s*\(\s*["'])https?:\/\//.test(text)) netRef = f + ' js import';
    if (/https?:\/\//.test(text) && f.endsWith('.html')) {
      // visible text may carry URLs; only attribute values are refused — re-check narrowly
      const attrs = [...text.matchAll(/(href|src|action|poster)\s*=\s*["'][^"']*["']/gi)];
      if (attrs.some((m) => /https?:\/\//.test(m[0]))) netRef = f + ' html attr';
    }
  }
  check('dashboard_files', hasHtml && hasCss && hasJs && files.length <= 400 && bytes <= 4 * 1024 * 1024 && !netRef,
    `${files.length} files, ${bytes} bytes, html=${hasHtml} css=${hasCss} js=${hasJs}${netRef ? ' net ref in ' + netRef : ''}`);
}

// 2/3/4/5. board
const board = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8'));
const rows = board.rows;
{
  let bad = null;
  if (!Array.isArray(rows) || rows.length < 100 || rows.length > 4000) bad = `rows=${rows?.length}`;
  const seen = new Set();
  for (const r of rows ?? []) {
    if (!snapSlugs.has(r.slug)) { bad = `invented slug ${r.slug}`; break; }
    if (seen.has(r.slug)) { bad = `duplicate slug ${r.slug}`; break; }
    seen.add(r.slug);
    if (typeof r.name !== 'string' || r.name.length === 0) { bad = `${r.slug} empty name`; break; }
    if (!Number.isSafeInteger(r.rank) || r.rank <= 0) { bad = `${r.slug} rank ${r.rank}`; break; }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) { bad = `${r.slug} implied ${r.implied_value_usd}`; break; }
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) { bad = `${r.slug} ${r.farm_steps?.length} steps`; break; }
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) { bad = `${r.slug} step ${t.length} chars`; break; }
    }
    if (bad) break;
  }
  check('board_file', !bad, `${rows.length} rows${bad ? ', ' + bad : ''}`);
}
{
  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  let bad = null;
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) { bad = `rank ${i + 1} is ${ranks[i]}`; break; }
  if (!bad) for (let i = 1; i < rows.length; i++) if (rows[i].implied_value_usd > rows[i - 1].implied_value_usd) { bad = `row ${i + 1} outranks row ${i}`; break; }
  if (!bad && rows.length >= 2 && rows[0].implied_value_usd === rows[rows.length - 1].implied_value_usd) bad = 'all implied values equal';
  check('sorted_by_value', !bad, bad ?? `ranks 1..${rows.length}, top ${rows[0].implied_value_usd}, bottom ${rows[rows.length - 1].implied_value_usd}`);
}
{
  const have = new Set(rows.map((r) => r.slug));
  const missing = watchlist.filter((s) => !have.has(s));
  check('coverage', missing.length === 0, missing.length === 0 ? `all ${watchlist.length} watchlist slugs present` : `missing: ${missing.join(', ')}`);
}
{
  let bad = null;
  for (const r of rows) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) { bad = r.slug; break; }
    for (const s of r.farm_steps) if (s.trim().length < 20 || s.trim().length > 600) { bad = r.slug; break; }
    if (bad) break;
  }
  check('farm_steps', !bad, bad ?? `every row has 6 steps of 20..600 chars`);
}

// 6. screenshots
{
  const shots = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.'));
  let bad = null;
  if (shots.length < 3 || shots.length > 4) bad = `${shots.length} images`;
  for (const f of shots) {
    const buf = readFileSync(join(out, 'screenshots', f));
    if (buf.length > 524288) { bad = `${f} ${buf.length} bytes`; break; }
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!isPng && !isJpg) { bad = `${f} not PNG/JPEG`; break; }
    let w = 0, h = 0;
    if (isPng) { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    if (isJpg) {
      // walk segments for SOF
      let off = 2;
      while (off < buf.length - 9) {
        if (buf[off] !== 0xff) break;
        const marker = buf[off + 1];
        const len = buf.readUInt16BE(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          h = buf.readUInt16BE(off + 5); w = buf.readUInt16BE(off + 7); break;
        }
        off += 2 + len;
      }
    }
    const long = Math.max(w, h), short = Math.min(w, h);
    if (long > 1440 || short < 800) { bad = `${f} ${w}x${h}`; break; }
  }
  check('screenshots', !bad, bad ?? `${shots.length} images within caps`);
}

// 7. dossier_matches
{
  const want = buildDossier(out, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
  const got = readFileSync(join(out, 'dossier.json'));
  check('dossier_matches', Buffer.from(want).equals(got), `dossier ${got.length} bytes${Buffer.from(want).equals(got) ? '' : ' — MISMATCH'}`);
  const doc = JSON.parse(got.toString('utf8'));
  const cut = /left out/.test(doc.text);
  console.log(`INFO dossier text ${Buffer.byteLength(doc.text, 'utf8')} bytes, cut=${cut}, images=${doc.images.length}`);
}

console.log(fail === 0 ? 'GATE: 7/7 PASS' : `GATE: ${7 - fail}/7 pass, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
