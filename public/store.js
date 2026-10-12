/* Client-side encryption + sync. The password never leaves the browser.
   PBKDF2-SHA256(password, salt, iter) -> 512 bits: first half = AES-GCM key, second half = auth key.
   The server stores only SHA-256(auth key) and the AES-GCM ciphertext. */
(function () {
  'use strict';
  const ITER = 600000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = {
    from(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); },
    to(str) { const bin = atob(str); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; },
  };
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  async function deriveKeys(password, saltB64, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64.to(saltB64), iterations: iter }, base, 512));
    const aes = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const auth = hex(bits.slice(32));
    bits.fill(0);
    return { aes, auth };
  }

  async function streamBytes(bytes, transform) {
    const s = new Blob([bytes]).stream().pipeThrough(transform);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  async function encrypt(aes, obj) {
    const plain = await streamBytes(enc.encode(JSON.stringify(obj)), new CompressionStream('gzip'));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, plain));
    const out = new Uint8Array(1 + 12 + ct.length);
    out[0] = 1; out.set(iv, 1); out.set(ct, 13);
    return b64.from(out);
  }

  async function decrypt(aes, blobB64) {
    const all = b64.to(blobB64);
    if (all[0] !== 1) throw new Error('unknown_format');
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(1, 13) }, aes, all.slice(13)));
    return JSON.parse(dec.decode(await streamBytes(plain, new DecompressionStream('gzip'))));
  }

  async function api(path, opts = {}, auth) {
    const headers = { 'content-type': 'application/json' };
    if (auth) headers['x-auth'] = auth;
    const res = await fetch(path, { ...opts, headers, cache: 'no-store' });
    let body = null; try { body = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) { const err = new Error((body && body.error) || ('http_' + res.status)); err.status = res.status; err.body = body; throw err; }
    return body;
  }

  /* Session: survives a page refresh, dies after N idle minutes.
     The AES key is stored as a NON-extractable CryptoKey in IndexedDB (script can use it, nobody can read its bytes);
     the auth key is stored encrypted with that AES key. Locking deletes the record. */
  const Session = {
    db() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('kupa-session', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('s');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    },
    async op(mode, fn) {
      const db = await this.db();
      return new Promise((res, rej) => {
        const tx = db.transaction('s', mode); const st = tx.objectStore('s');
        const req = fn(st); tx.oncomplete = () => { db.close(); res(req && req.result); }; tx.onerror = () => { db.close(); rej(tx.error); };
      });
    },
    async save(keys, minutes) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const authCt = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.aes, enc.encode(keys.auth)));
      await this.op('readwrite', (st) => st.put({ aes: keys.aes, iv, authCt, last: Date.now(), min: minutes }, 'cur'));
    },
    async touch(minutes) {
      await this.op('readwrite', (st) => { const g = st.get('cur'); g.onsuccess = () => { if (g.result) st.put({ ...g.result, last: Date.now(), min: minutes || g.result.min }, 'cur'); }; return g; });
    },
    async load() {
      const rec = await this.op('readonly', (st) => st.get('cur'));
      if (!rec) return null;
      if (Date.now() - rec.last > rec.min * 60000) { await this.clear(); return null; }
      const auth = dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, rec.aes, rec.authCt));
      return { aes: rec.aes, auth };
    },
    async clear() { try { await this.op('readwrite', (st) => st.delete('cur')); } catch (e) { /* ignore */ } },
  };

  const Store = {
    keys: null, version: 0, data: null,
    saving: false, dirty: false, timer: null, listeners: [],

    meta() { return api('/api/meta'); },

    async init(password, setupCode, initialData) {
      const salt = b64.from(crypto.getRandomValues(new Uint8Array(16)));
      const keys = await deriveKeys(password, salt, ITER);
      const blob = await encrypt(keys.aes, initialData);
      const authHash = hex(await crypto.subtle.digest('SHA-256', enc.encode(keys.auth)));
      const r = await api('/api/init', { method: 'POST', body: JSON.stringify({ salt, iter: ITER, authHash, blob, setupCode }) });
      this.keys = keys; this.version = r.version; this.data = initialData;
      try { await Session.save(keys, 3); } catch (e) { /* ignore */ }
    },

    async unlock(password) {
      const m = await this.meta();
      const keys = await deriveKeys(password, m.salt, m.iter);
      const r = await api('/api/data', {}, keys.auth);
      this.data = await decrypt(keys.aes, r.blob);
      this.keys = keys; this.version = r.version;
      try { await Session.save(keys, (this.data.settings && this.data.settings.autoLockMin) || 3); } catch (e) { /* refresh will ask for password */ }
    },

    async resume() { // after a refresh, within the idle window
      let keys = null;
      try { keys = await Session.load(); } catch (e) { keys = null; }
      if (!keys) return false;
      try {
        const r = await api('/api/data', {}, keys.auth);
        this.data = await decrypt(keys.aes, r.blob); this.keys = keys; this.version = r.version;
        return true;
      } catch (e) { await Session.clear(); return false; }
    },
    touch(minutes) { if (this.keys) Session.touch(minutes).catch(() => {}); },

    async reload() {
      const r = await api('/api/data', {}, this.keys.auth);
      this.data = await decrypt(this.keys.aes, r.blob); this.version = r.version; this.dirty = false;
    },

    onStatus(fn) { this.listeners.push(fn); },
    emit(s, extra) { this.listeners.forEach((f) => f(s, extra)); },

    save() { // debounced
      this.dirty = true; this.emit('dirty');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 700);
    },

    async flush() {
      if (!this.dirty || this.saving) return;
      this.saving = true; this.emit('saving');
      try {
        const snapshot = JSON.parse(JSON.stringify(this.data));
        const blob = await encrypt(this.keys.aes, snapshot);
        const r = await api('/api/data', { method: 'PUT', body: JSON.stringify({ baseVersion: this.version, blob }) }, this.keys.auth);
        this.version = r.version; this.dirty = false; this.emit('saved');
      } catch (e) {
        if (e.status === 409) { await this.reload(); this.emit('conflict'); } else { this.emit('error', e); }
      } finally { this.saving = false; }
      if (this.dirty) this.flush();
    },

    async versions() { return (await api('/api/versions', {}, this.keys.auth)).versions; },
    async loadVersion(v) { const r = await api('/api/data?v=' + v, {}, this.keys.auth); return decrypt(this.keys.aes, r.blob); },

    async changePassword(oldPw, newPw) {
      const m = await this.meta();
      const check = await deriveKeys(oldPw, m.salt, m.iter);
      if (check.auth !== this.keys.auth) throw new Error('bad_password');
      await this.flush();
      const salt = b64.from(crypto.getRandomValues(new Uint8Array(16)));
      const keys = await deriveKeys(newPw, salt, ITER);
      const blob = await encrypt(keys.aes, this.data);
      const authHash = hex(await crypto.subtle.digest('SHA-256', enc.encode(keys.auth)));
      const r = await api('/api/password', { method: 'POST', body: JSON.stringify({ salt, iter: ITER, authHash, blob, baseVersion: this.version }) }, this.keys.auth);
      this.keys = keys; this.version = r.version;
      try { await Session.save(keys, (this.data.settings && this.data.settings.autoLockMin) || 3); } catch (e) { /* ignore */ }
    },

    async exportBackup() { // encrypted file, opens only with the password
      const m = await this.meta();
      const blob = await encrypt(this.keys.aes, this.data);
      return JSON.stringify({ app: 'kupa', v: 1, salt: m.salt, iter: m.iter, blob });
    },

    async readBackup(text, password) {
      const f = JSON.parse(text);
      if (f.app !== 'kupa') throw new Error('not_a_backup');
      const keys = await deriveKeys(password, f.salt, f.iter);
      return decrypt(keys.aes, f.blob);
    },

    lock() { this.keys = null; this.data = null; return Session.clear(); },
  };

  window.KupaStore = Store;
})();
