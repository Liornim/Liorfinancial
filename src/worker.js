// Kupa — blind storage. The server only ever sees ciphertext and a hash of an auth key.
// All encryption/decryption happens in the browser.
import { DurableObject } from 'cloudflare:workers';

const KEEP_VERSIONS = 30;
const CHUNK = 512 * 1024;
const MAX_BLOB = 20 * 1024 * 1024;
const FAIL_WINDOW_MS = 60 * 60 * 1000;
const FAIL_PER_IP = 10;
const FAIL_GLOBAL = 50;
const QUOTE_TTL_MS = 15 * 60 * 1000;

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cache-Control': 'no-store',
};

function withHeaders(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const stub = env.VAULT.get(env.VAULT.idFromName('main'));
      const res = await stub.fetch(request);
      return withHeaders(res);
    }
    return withHeaders(await env.ASSETS.fetch(request));
  },
};

function b64ToBytes(s) { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
function bytesToB64(a) { let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
async function sha256hex(str) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0;
}

export class Vault extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.env = env;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS chunks (ver INTEGER, idx INTEGER, data BLOB, PRIMARY KEY (ver, idx))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS versions (ver INTEGER PRIMARY KEY, at INTEGER, size INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS fails (ip TEXT, at INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS quotes (sym TEXT PRIMARY KEY, price REAL, at INTEGER, src TEXT)`);
  }
  getMeta(k) { const r = this.sql.exec('SELECT v FROM meta WHERE k=?', k).toArray(); return r.length ? r[0].v : null; }
  setMeta(k, v) { this.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, v); }

  failCounts(ip) {
    const since = Date.now() - FAIL_WINDOW_MS;
    this.sql.exec('DELETE FROM fails WHERE at < ?', since);
    const all = this.sql.exec('SELECT COUNT(*) AS c FROM fails').one().c;
    const mine = this.sql.exec('SELECT COUNT(*) AS c FROM fails WHERE ip=?', ip).one().c;
    return { all, mine };
  }

  async checkAuth(request) {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const { all, mine } = this.failCounts(ip);
    if (mine >= FAIL_PER_IP || all >= FAIL_GLOBAL) return json({ error: 'locked', retryMinutes: 60 }, 429);
    const key = request.headers.get('x-auth') || '';
    const stored = this.getMeta('authHash');
    if (!stored) return json({ error: 'not_initialized' }, 409);
    if (!safeEqual(await sha256hex(key), stored)) {
      this.sql.exec('INSERT INTO fails (ip, at) VALUES (?, ?)', ip, Date.now());
      return json({ error: 'bad_password', left: Math.max(0, FAIL_PER_IP - mine - 1) }, 401);
    }
    return null;
  }

  currentVersion() { return Number(this.getMeta('version') || 0); }

  writeBlob(b64) {
    const bytes = b64ToBytes(b64);
    if (bytes.length > MAX_BLOB) throw new Error('too_large');
    const ver = this.currentVersion() + 1;
    for (let i = 0, idx = 0; i < bytes.length; i += CHUNK, idx++) {
      this.sql.exec('INSERT INTO chunks (ver, idx, data) VALUES (?, ?, ?)', ver, idx, bytes.slice(i, i + CHUNK).buffer);
    }
    this.sql.exec('INSERT INTO versions (ver, at, size) VALUES (?, ?, ?)', ver, Date.now(), bytes.length);
    this.setMeta('version', String(ver));
    const old = ver - KEEP_VERSIONS;
    this.sql.exec('DELETE FROM chunks WHERE ver <= ?', old);
    this.sql.exec('DELETE FROM versions WHERE ver <= ?', old);
    return ver;
  }

  readBlob(ver) {
    const parts = this.sql.exec('SELECT data FROM chunks WHERE ver=? ORDER BY idx', ver).toArray();
    if (!parts.length) return null;
    const total = parts.reduce((n, p) => n + p.data.byteLength, 0);
    const out = new Uint8Array(total); let o = 0;
    for (const p of parts) { out.set(new Uint8Array(p.data), o); o += p.data.byteLength; }
    return bytesToB64(out);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === '/api/meta' && method === 'GET') {
        return json({ initialized: !!this.getMeta('authHash'), salt: this.getMeta('salt'), iter: Number(this.getMeta('iter') || 0), needsSetupCode: !!this.env.SETUP_CODE });
      }
      if (path === '/api/init' && method === 'POST') {
        if (this.getMeta('authHash')) return json({ error: 'already_initialized' }, 409);
        const body = await request.json();
        if (this.env.SETUP_CODE && body.setupCode !== this.env.SETUP_CODE) return json({ error: 'bad_setup_code' }, 403);
        if (!/^[0-9a-f]{64}$/.test(body.authHash || '') || !body.salt || !(body.iter >= 100000) || !body.blob) return json({ error: 'bad_request' }, 400);
        this.setMeta('salt', body.salt); this.setMeta('iter', String(body.iter)); this.setMeta('authHash', body.authHash);
        const ver = this.writeBlob(body.blob);
        return json({ version: ver });
      }

      const denied = await this.checkAuth(request);
      if (denied) return denied;

      if (path === '/api/data' && method === 'GET') {
        const want = url.searchParams.get('v');
        const ver = want ? Number(want) : this.currentVersion();
        const blob = this.readBlob(ver);
        if (!blob) return json({ error: 'not_found' }, 404);
        return json({ version: ver, blob });
      }
      if (path === '/api/data' && method === 'PUT') {
        const body = await request.json();
        if (Number(body.baseVersion) !== this.currentVersion()) return json({ error: 'conflict', version: this.currentVersion() }, 409);
        return json({ version: this.writeBlob(body.blob) });
      }
      if (path === '/api/quote' && method === 'GET') {
        // prices for the investments page. Only ticker symbols reach the server (never quantities or amounts).
        const syms = [...new Set((url.searchParams.get('s') || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => /^[A-Z0-9.\-]{1,12}$/.test(x)))].slice(0, 40);
        const force = url.searchParams.get('force') === '1';
        const out = {};
        for (const sym of syms) {
          const row = this.sql.exec('SELECT price, at, src FROM quotes WHERE sym=?', sym).toArray()[0];
          if (row && !force && Date.now() - row.at < QUOTE_TTL_MS) { out[sym] = { price: row.price, at: row.at, src: row.src, cached: true }; continue; }
          if (!this.env.FINNHUB_KEY) { out[sym] = row ? { price: row.price, at: row.at, src: row.src, stale: true, error: 'no_key' } : { error: 'no_key' }; continue; }
          try {
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${this.env.FINNHUB_KEY}`, { cf: { cacheTtl: 0 } });
            if (!r.ok) throw new Error('http_' + r.status);
            const j = await r.json();
            if (!(j && j.c > 0)) throw new Error('no_price');
            const at = j.t ? j.t * 1000 : Date.now();
            this.sql.exec('INSERT OR REPLACE INTO quotes (sym, price, at, src) VALUES (?, ?, ?, ?)', sym, j.c, Date.now(), 'finnhub');
            out[sym] = { price: j.c, at: Date.now(), quoteTime: at, src: 'finnhub' };
          } catch (e) {
            out[sym] = row ? { price: row.price, at: row.at, src: row.src, stale: true, error: String(e.message || e) } : { error: String(e.message || e) };
          }
        }
        return json({ quotes: out, ttlMin: QUOTE_TTL_MS / 60000 });
      }
      if (path === '/api/versions' && method === 'GET') {
        return json({ versions: this.sql.exec('SELECT ver, at, size FROM versions ORDER BY ver DESC').toArray() });
      }
      if (path === '/api/password' && method === 'POST') {
        const body = await request.json();
        if (!/^[0-9a-f]{64}$/.test(body.authHash || '') || !body.salt || !(body.iter >= 100000) || !body.blob) return json({ error: 'bad_request' }, 400);
        if (Number(body.baseVersion) !== this.currentVersion()) return json({ error: 'conflict' }, 409);
        // old versions were encrypted with the old key — drop them so the old password unlocks nothing
        const ver = this.writeBlob(body.blob);
        this.sql.exec('DELETE FROM chunks WHERE ver < ?', ver);
        this.sql.exec('DELETE FROM versions WHERE ver < ?', ver);
        this.setMeta('salt', body.salt); this.setMeta('iter', String(body.iter)); this.setMeta('authHash', body.authHash);
        return json({ version: ver });
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error', detail: String(e.message || e) }, 500);
    }
  }
}
