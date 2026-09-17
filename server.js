/* Lingo arka ucu: statik dosyaları sunar, kelime havuzunu JSON dosyasında tutar
 * ve şifre korumalı bir yönetim API'si sağlar. Dış bağımlılık yoktur.
 *
 *   ADMIN_PASSWORD=gizli node server.js
 *
 * Ortam değişkenleri:
 *   PORT            dinlenecek port (varsayılan 8080)
 *   ADMIN_PASSWORD  yönetim şifresi; boşsa kelime ekleme/silme kapalıdır
 *   DATA_DIR        words.json ve daily.json'un tutulacağı klasör (varsayılan ./data)
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const L = require('./js/logic.js');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const WORDS_FILE = path.join(DATA_DIR, 'words.json');
const DAILY_FILE = path.join(DATA_DIR, 'daily.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PORT = Number(process.env.PORT) || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LENGTHS = [4, 5, 6, 7];
const ALPHA = 'abcçdefgğhıijklmnoöprsştuüvyz';
const MAX_BODY = 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

/* ---------- Kelime deposu ---------- */

function emptyStore() {
  const store = {};
  LENGTHS.forEach((n) => { store[n] = []; });
  return store;
}

function loadWords() {
  if (fs.existsSync(WORDS_FILE)) {
    const raw = JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8'));
    const store = emptyStore();
    LENGTHS.forEach((n) => { store[n] = Array.isArray(raw[n]) ? raw[n].slice().sort(collate) : []; });
    return store;
  }
  // İlk çalıştırma: gömülü listeyle tohumla.
  const seed = require('./js/words.js');
  const store = emptyStore();
  LENGTHS.forEach((n) => { store[n] = (seed[n] || []).slice().sort(collate); });
  saveWords(store);
  return store;
}

function saveWords(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = WORDS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 1));
  fs.renameSync(tmp, WORDS_FILE);
}

function collate(a, b) { return a.localeCompare(b, 'tr-TR'); }

function normalizeWord(w) {
  return L.toLowerTr(String(w).trim());
}

function validateWord(w) {
  const chars = L.chars(w);
  if (!chars.length) return { ok: false, reason: 'boş' };
  if (LENGTHS.indexOf(chars.length) === -1) return { ok: false, reason: 'uzunluk 4–7 olmalı' };
  if (!chars.every((c) => ALPHA.includes(c))) return { ok: false, reason: 'yalnızca Türk alfabesi harfleri' };
  return { ok: true, length: chars.length };
}

function parseWordInput(input) {
  if (Array.isArray(input)) return input.map(String);
  return String(input || '').split(/[\s,;]+/);
}

function addWords(store, input) {
  const added = [];
  const skipped = [];
  const rejected = [];
  const seen = new Set();
  parseWordInput(input).forEach((raw) => {
    const w = normalizeWord(raw);
    if (!w) return;
    if (seen.has(w)) return;
    seen.add(w);
    const v = validateWord(w);
    if (!v.ok) { rejected.push({ word: w, reason: v.reason }); return; }
    if (store[v.length].includes(w)) { skipped.push(w); return; }
    store[v.length].push(w);
    added.push(w);
  });
  if (added.length) {
    LENGTHS.forEach((n) => store[n].sort(collate));
    saveWords(store);
  }
  return { added, skipped, rejected };
}

function removeWord(store, raw) {
  const w = normalizeWord(raw);
  const v = validateWord(w);
  if (!v.ok) return false;
  const list = store[v.length];
  const i = list.indexOf(w);
  if (i === -1) return false;
  list.splice(i, 1);
  saveWords(store);
  return true;
}

function counts(store) {
  const c = {};
  LENGTHS.forEach((n) => { c[n] = store[n].length; });
  return c;
}

/* ---------- Oyun ayarları (yönetim panelinden değiştirilir) ---------- */

const DEFAULT_GAME_SETTINGS = {
  // İki takım modunda sıra rakibe geçince kelimeden rastgele bir harf açılır (TV kuralı).
  bonusLetter: false
};

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return Object.assign({}, DEFAULT_GAME_SETTINGS, sanitizeSettings(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_GAME_SETTINGS);
  }
}

function saveSettings(settings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 1));
}

/** Yalnızca bilinen anahtarları ve doğru tipleri kabul eder. */
function sanitizeSettings(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  Object.keys(DEFAULT_GAME_SETTINGS).forEach((key) => {
    if (typeof input[key] === typeof DEFAULT_GAME_SETTINGS[key]) out[key] = input[key];
  });
  return out;
}

/* ---------- Günün kelimesi ---------- */

function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function dailyWord(store) {
  const date = todayKey();
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8')); } catch (e) { cache = {}; }
  if (cache.date === date && store[5].includes(cache.word)) return { date, word: cache.word };
  const list = store[5];
  if (!list.length) return { date, word: null };
  const rng = L.seededRandom(L.dateSeed(date));
  const word = L.pickWord(list, rng);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DAILY_FILE, JSON.stringify({ date, word }));
  return { date, word };
}

/* ---------- HTTP yardımcıları ---------- */

function send(res, status, body, headers) {
  const h = Object.assign({ 'Cache-Control': 'no-store' }, headers || {});
  if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    h['Content-Type'] = 'application/json; charset=utf-8';
  }
  res.writeHead(status, h);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); } catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function isAuthorized(req) {
  if (!ADMIN_PASSWORD) return false;
  // Başlıklar yalnızca Latin-1 taşıyabildiği için istemci şifreyi URI kodlamasıyla gönderir.
  let key = req.headers['x-admin-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { key = decodeURIComponent(key); } catch (e) { /* kodlanmamış değer olduğu gibi kalır */ }
  return safeEqual(key, ADMIN_PASSWORD);
}

function requireAuth(req, res) {
  if (!ADMIN_PASSWORD) { send(res, 403, { error: 'Yönetim kapalı: ADMIN_PASSWORD ayarlanmamış' }); return false; }
  if (!isAuthorized(req)) { send(res, 401, { error: 'Şifre hatalı' }); return false; }
  return true;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || rel.includes('\0')) { send(res, 403, 'Forbidden'); return; }
  const base = path.basename(file);
  if (base.startsWith('.') || file.startsWith(DATA_DIR + path.sep) || file === DATA_DIR || base === 'server.js') {
    send(res, 404, 'Not found'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { send(res, 404, 'Not found'); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- Sunucu ---------- */

function createServer() {
  const store = loadWords();
  let gameSettings = loadSettings();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    try {
      if (p === '/api/health') return send(res, 200, { ok: true, counts: counts(store), adminEnabled: !!ADMIN_PASSWORD });

      if (p === '/api/words' && req.method === 'GET') {
        const len = url.searchParams.get('len');
        if (len) {
          if (!LENGTHS.includes(Number(len))) return send(res, 400, { error: 'len 4–7 olmalı' });
          return send(res, 200, { length: Number(len), words: store[len] });
        }
        return send(res, 200, { words: store, counts: counts(store) });
      }

      if (p === '/api/daily' && req.method === 'GET') return send(res, 200, dailyWord(store));

      if (p === '/api/settings' && req.method === 'GET') return send(res, 200, gameSettings);

      if (p === '/api/settings' && (req.method === 'PUT' || req.method === 'POST')) {
        if (!requireAuth(req, res)) return;
        const body = await readBody(req);
        const patch = sanitizeSettings(body);
        if (!Object.keys(patch).length) return send(res, 400, { error: 'Geçerli ayar yok' });
        gameSettings = Object.assign({}, gameSettings, patch);
        saveSettings(gameSettings);
        return send(res, 200, gameSettings);
      }

      if (p === '/api/auth' && req.method === 'POST') {
        if (!ADMIN_PASSWORD) return send(res, 403, { error: 'Yönetim kapalı: ADMIN_PASSWORD ayarlanmamış' });
        const body = await readBody(req);
        return safeEqual(body.password || '', ADMIN_PASSWORD) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'Şifre hatalı' });
      }

      if (p === '/api/words' && req.method === 'POST') {
        if (!requireAuth(req, res)) return;
        const body = await readBody(req);
        const result = addWords(store, body.words !== undefined ? body.words : body.text);
        return send(res, 200, Object.assign(result, { counts: counts(store) }));
      }

      if (p.startsWith('/api/words/') && req.method === 'DELETE') {
        if (!requireAuth(req, res)) return;
        const word = decodeURIComponent(p.slice('/api/words/'.length));
        const removed = removeWord(store, word);
        return removed ? send(res, 200, { removed: normalizeWord(word), counts: counts(store) }) : send(res, 404, { error: 'Kelime bulunamadı' });
      }

      if (p.startsWith('/api/')) return send(res, 404, { error: 'Bilinmeyen uç nokta' });

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, p);
    } catch (err) {
      const status = /json|large/.test(err.message) ? 400 : 500;
      return send(res, status, { error: err.message });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log('Lingo sunucusu: http://localhost:' + PORT);
    console.log('Kelime dosyası: ' + WORDS_FILE);
    if (!ADMIN_PASSWORD) {
      console.warn('UYARI: ADMIN_PASSWORD ayarlanmadı; /admin.html üzerinden kelime ekleme/silme kapalı.');
    } else {
      console.log('Yönetim paneli: http://localhost:' + PORT + '/admin.html');
    }
  });
}

module.exports = { createServer, addWords, removeWord, validateWord, normalizeWord, emptyStore, sanitizeSettings, DEFAULT_GAME_SETTINGS };
