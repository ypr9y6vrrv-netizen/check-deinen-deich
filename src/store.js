// Kleiner, robuster JSON-Speicher. Für einen Discord-Server mit ein paar hundert Profilen mehr als genug.
// Schreibt atomar (temp-Datei + rename), damit bei Absturz/Stromausfall nichts kaputtgeht.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('base64url');
const newToken = () => crypto.randomBytes(32).toString('base64url');
const validToken = (t) => typeof t === 'string' && t.length >= 20 && t.length <= 100;

function emptyDb() {
  return { version: 1, profiles: {}, discord: {}, sessions: {}, loginTokens: {}, uploads: {}, meta: {} };
}

export class Store {
  /**
   * @param {string} dataDir
   * @param {{ log?: { error: Function } }} [opts]
   */
  constructor(dataDir, { log = console } = {}) {
    this.dir = dataDir;
    this.file = path.join(dataDir, 'db.json');
    this.uploadDir = path.join(dataDir, 'uploads');
    this.log = log;
    fs.mkdirSync(this.uploadDir, { recursive: true });
    this.data = this.#load();
    /** @type {Map<string,string>} slug -> userId */
    this.slugs = new Map();
    for (const p of Object.values(this.data.profiles)) this.slugs.set(p.slug, p.userId);
    this.dirty = false;
    this.timer = null;
  }

  #load() {
    if (!fs.existsSync(this.file)) return emptyDb();
    const raw = fs.readFileSync(this.file, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Die Datenbank ${this.file} ist beschädigt (${err.message}). Bitte Backup einspielen.`);
    }
    const db = emptyDb();
    for (const key of Object.keys(db)) if (parsed[key] && typeof parsed[key] === 'object') db[key] = parsed[key];
    return db;
  }

  #touch() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 250);
    this.timer.unref?.();
  }

  /** Schreibt sofort auf die Platte (falls es Änderungen gibt). */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeSync(fd, JSON.stringify(this.data));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, this.file);
    } catch (err) {
      this.log.error?.(`Speichern fehlgeschlagen: ${err.message} – neuer Versuch in 5 s`);
      this.dirty = true;
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flush();
        }, 5000);
        this.timer.unref?.();
      }
    }
  }

  close() {
    clearTimeout(this.timer);
    this.timer = null;
    this.flush();
  }

  // ------------------------------------------------------------ Profile
  getProfile(userId) {
    return this.data.profiles[userId] ?? null;
  }

  getProfileBySlug(slug) {
    const id = this.slugs.get(String(slug).toLowerCase());
    return id ? this.getProfile(id) : null;
  }

  isSlugTaken(slug, exceptUserId = null) {
    const id = this.slugs.get(slug);
    return Boolean(id && id !== exceptUserId);
  }

  listProfiles() {
    return Object.values(this.data.profiles);
  }

  putProfile(profile) {
    if (this.isSlugTaken(profile.slug, profile.userId)) throw new Error(`Slug "${profile.slug}" ist schon vergeben`);
    const prev = this.data.profiles[profile.userId];
    if (prev && prev.slug !== profile.slug) this.slugs.delete(prev.slug);
    this.data.profiles[profile.userId] = profile;
    this.slugs.set(profile.slug, profile.userId);
    this.#touch();
    return profile;
  }

  /** Löscht Profil, Discord-Daten, Sitzungen & Login-Links. Gibt die Upload-Namen des Nutzers zurück. */
  deleteProfile(userId) {
    const p = this.data.profiles[userId];
    if (p) this.slugs.delete(p.slug);
    delete this.data.profiles[userId];
    delete this.data.discord[userId];
    this.deleteSessionsOf(userId);
    for (const [h, t] of Object.entries(this.data.loginTokens)) if (t.userId === userId) delete this.data.loginTokens[h];
    const uploads = this.uploadsOf(userId).map(([name]) => name);
    for (const name of uploads) delete this.data.uploads[name];
    this.#touch();
    return uploads;
  }

  addView(userId) {
    const p = this.data.profiles[userId];
    if (!p) return;
    p.views = (p.views || 0) + 1;
    this.#touch();
  }

  // ------------------------------------------------------------ Discord-Schnappschüsse
  getDiscord(userId) {
    return this.data.discord[userId] ?? null;
  }

  putDiscord(userId, snapshot) {
    this.data.discord[userId] = snapshot;
    this.#touch();
  }

  // ------------------------------------------------------------ Login-Links (Einmal-Token)
  createLoginToken(userId, ttlMs) {
    for (const [h, t] of Object.entries(this.data.loginTokens)) if (t.userId === userId) delete this.data.loginTokens[h];
    const token = newToken();
    this.data.loginTokens[hashToken(token)] = { userId, expiresAt: Date.now() + ttlMs };
    this.#touch();
    return token;
  }

  peekLoginToken(token) {
    if (!validToken(token)) return null;
    const t = this.data.loginTokens[hashToken(token)];
    if (!t || t.expiresAt < Date.now()) return null;
    return { userId: t.userId, expiresAt: t.expiresAt };
  }

  consumeLoginToken(token) {
    const info = this.peekLoginToken(token);
    if (!info) return null;
    delete this.data.loginTokens[hashToken(token)];
    this.#touch();
    return info.userId;
  }

  // ------------------------------------------------------------ Sitzungen
  createSession(userId, ttlMs) {
    const sid = newToken();
    this.data.sessions[hashToken(sid)] = { userId, createdAt: Date.now(), expiresAt: Date.now() + ttlMs };
    this.#touch();
    return sid;
  }

  getSession(sid) {
    if (!validToken(sid)) return null;
    const key = hashToken(sid);
    const s = this.data.sessions[key];
    if (!s) return null;
    if (s.expiresAt < Date.now()) {
      delete this.data.sessions[key];
      this.#touch();
      return null;
    }
    return s;
  }

  deleteSession(sid) {
    if (!validToken(sid)) return;
    delete this.data.sessions[hashToken(sid)];
    this.#touch();
  }

  deleteSessionsOf(userId) {
    for (const [h, s] of Object.entries(this.data.sessions)) if (s.userId === userId) delete this.data.sessions[h];
    this.#touch();
  }

  /** Räumt abgelaufene Sitzungen & Login-Links weg. */
  purgeExpired(now = Date.now()) {
    let n = 0;
    for (const bucket of [this.data.sessions, this.data.loginTokens]) {
      for (const [h, v] of Object.entries(bucket)) {
        if (v.expiresAt < now) {
          delete bucket[h];
          n++;
        }
      }
    }
    if (n) this.#touch();
    return n;
  }

  // ------------------------------------------------------------ Uploads
  addUpload(name, meta) {
    this.data.uploads[name] = meta;
    this.#touch();
  }

  getUpload(name) {
    return this.data.uploads[name] ?? null;
  }

  removeUpload(name) {
    delete this.data.uploads[name];
    this.#touch();
  }

  /** @returns {[string, object][]} */
  uploadsOf(userId) {
    return Object.entries(this.data.uploads).filter(([, m]) => m.owner === userId);
  }

  allUploads() {
    return Object.entries(this.data.uploads);
  }

  // ------------------------------------------------------------ Sonstiges
  getMeta(key) {
    return this.data.meta[key] ?? null;
  }

  setMeta(key, value) {
    this.data.meta[key] = value;
    this.#touch();
  }
}
