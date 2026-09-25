/* Nails Avenue — zero-dependency Node server.
 * Serves the website and a JSON API so every customer and the admin share the same data.
 *   node server.js            → http://localhost:3000
 * Env: PORT, DATA_DIR (where db.json is stored), ADMIN_PASSWORD (optional: sets the admin password on first start),
 *      GOOGLE_PLACES_API_KEY (optional: shows live Google reviews; can also be saved in the admin panel). */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), nodeCrypto = require('crypto');
if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = nodeCrypto.webcrypto;
const B = require('./backend.js');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 25 * 1024 * 1024;
fs.mkdirSync(DATA_DIR, {recursive:true});

let db;
try { db = B.migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); console.log('Loaded data from', DB_FILE); }
catch (e) { db = B.emptyDb(); console.log('Starting with fresh data at', DB_FILE); }

function persistNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
let saveT = null;
const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { persistNow(); } catch (e) { console.error('Save failed:', e); } }, 150); };
// daily backup copy
setInterval(() => { try { fs.copyFileSync(DB_FILE, path.join(DATA_DIR, `backup-${new Date().toISOString().slice(0, 10)}.json`)); } catch (e) {} }, 6 * 3600e3).unref();

// Serialize requests so concurrent bookings can't double-book a slot.
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));

// Basic brute-force protection for login endpoints.
const hits = new Map();
function limited(ip, key) {
  const k = ip + key, now = Date.now(), h = (hits.get(k) || []).filter(t => now - t < 10 * 60e3);
  h.push(now); hits.set(k, h); return h.length > 20;
}

/* ---------- Google reviews (Places API New) ---------- */
const G_TTL = 6 * 3600e3;
let gCache = {key:'', at:0, data:null, error:null};
const googleKey = () => process.env.GOOGLE_PLACES_API_KEY || (db.secrets && db.secrets.googleApiKey) || '';
async function gFetch(url, opts, fields) {
  const r = await fetch(url, Object.assign({}, opts, {headers:Object.assign({'Content-Type':'application/json', 'X-Goog-Api-Key':googleKey(), 'X-Goog-FieldMask':fields}, (opts || {}).headers)}));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('Google responded ' + r.status));
  return j;
}
async function loadGoogle(force) {
  const R = db.content.reviews, key = googleKey();
  if (!key || !R.useGoogle) return null;
  const sig = key.slice(-6) + '|' + R.placeId + '|' + R.placeQuery;
  if (!force && gCache.key === sig && Date.now() - gCache.at < G_TTL) return gCache.data;
  try {
    let id = R.placeId;
    if (!id) {
      const s = await gFetch('https://places.googleapis.com/v1/places:searchText', {method:'POST', body:JSON.stringify({textQuery:R.placeQuery || db.content.shop.name})}, 'places.id,places.displayName');
      if (!s.places || !s.places.length) throw new Error('No Google place found for “' + R.placeQuery + '”.');
      id = s.places[0].id;
    }
    const p = await gFetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(id) + '?languageCode=en', {method:'GET'}, 'id,displayName,rating,userRatingCount,reviews,googleMapsUri');
    const data = {placeId:p.id, name:p.displayName && p.displayName.text, rating:p.rating || null, count:p.userRatingCount || null, mapsUri:p.googleMapsUri || '',
      items:(p.reviews || []).map(v => ({author:(v.authorAttribution || {}).displayName || 'Google user', authorUrl:(v.authorAttribution || {}).uri || '', photo:(v.authorAttribution || {}).photoUri || '',
        rating:v.rating || 5, text:(v.text && v.text.text) || (v.originalText && v.originalText.text) || '', date:v.relativePublishTimeDescription || '', source:'google'})).filter(v => v.text)};
    gCache = {key:sig, at:Date.now(), data, error:null};
  } catch (e) { gCache = {key:sig, at:Date.now(), data:gCache.key === sig ? gCache.data : null, error:e.message}; console.error('Google reviews:', e.message); }
  return gCache.data;
}
async function reviewsResponse(force) {
  const base = B.reviewsView(db.content);
  if (!base.enabled) return base;
  const g = await loadGoogle(force);
  if (!g) return base;
  return Object.assign(base, {source:'google', rating:g.rating || base.rating, count:g.count || base.count, items:[...g.items, ...base.items],
    mapsUrl:base.mapsUrl || g.mapsUri, writeUrl:db.content.reviews.writeUrl || ('https://search.google.com/local/writereview?placeid=' + encodeURIComponent(g.placeId))});
}
const isAdmin = token => { const s = token && db.sessions[token]; return !!(s && s.role === 'admin' && s.exp > Date.now()); };

const STATIC = {'/':'index.html', '/index.html':'index.html', '/backend.js':'backend.js'};
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8'};
const SEC = {'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'SAMEORIGIN'};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, SEC, headers || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) {
    const file = STATIC[url.pathname];
    if (!file || req.method !== 'GET') return send(res, 404, 'Not found', {'Content-Type':'text/plain'});
    return fs.readFile(path.join(__dirname, file), (err, buf) => err ? send(res, 500, 'Error') : send(res, 200, buf, {'Content-Type':TYPES[path.extname(file)], 'Cache-Control':'no-cache'}));
  }
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const apiPath = url.pathname.slice(4);
  if (req.method === 'POST' && /\/(auth\/login|admin\/login|admin\/setup)$/.test(apiPath) && limited(ip, apiPath))
    return send(res, 429, JSON.stringify({error:'Too many attempts. Please wait a few minutes.'}), {'Content-Type':'application/json'});
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > MAX_BODY) { send(res, 413, JSON.stringify({error:'Upload too large.'}), {'Content-Type':'application/json'}); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (res.writableEnded) return;
    let body = null;
    if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return send(res, 400, JSON.stringify({error:'Invalid JSON.'}), {'Content-Type':'application/json'}); } }
    const auth = req.headers.authorization || '', token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const json = (st, obj) => send(res, st, JSON.stringify(obj), {'Content-Type':'application/json', 'Cache-Control':'no-store'});
    if (req.method === 'GET' && apiPath === '/reviews') return reviewsResponse(false).then(r => json(200, r), e => json(500, {error:e.message}));
    if (apiPath === '/admin/google-status') {
      if (!isAdmin(token)) return json(401, {error:'Admin sign-in required.'});
      return (req.method === 'POST' ? reviewsResponse(true) : Promise.resolve()).then(() => json(200, {server:true, configured:!!googleKey(), fromEnv:!!process.env.GOOGLE_PLACES_API_KEY,
        fetchedAt:gCache.at || null, error:gCache.error, placeName:gCache.data && gCache.data.name, placeId:gCache.data && gCache.data.placeId, rating:gCache.data && gCache.data.rating, count:gCache.data && gCache.data.count, reviews:gCache.data ? gCache.data.items.length : 0}));
    }
    serial(async () => {
      const r = await B.handle(db, {method:req.method, path:apiPath, query:Object.fromEntries(url.searchParams), body, token, env:{googleKey:!!process.env.GOOGLE_PLACES_API_KEY}});
      if (apiPath === '/admin/secrets' || apiPath === '/admin/content') gCache.at = 0;
      if (req.method !== 'GET' || apiPath.startsWith('/admin')) persist();
      send(res, r.status, JSON.stringify(r.body), {'Content-Type':'application/json', 'Cache-Control':'no-store'});
    });
  });
});

(async () => {
  if (process.env.ADMIN_PASSWORD && !db.admin.hash) { await B.setAdminPassword(db, process.env.ADMIN_PASSWORD); persistNow(); console.log('Admin password set from ADMIN_PASSWORD.'); }
  server.listen(PORT, () => console.log(`Nails Avenue running on http://localhost:${PORT}`));
})();
const shutdown = () => { try { persistNow(); } catch (e) {} process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
