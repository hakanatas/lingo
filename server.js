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

const STATIC_WORDS_FILE = path.join(ROOT, 'kelimeler.json');   // GitHub Pages modunun dosyası; ilk tohum
const STATIC_SETTINGS_FILE = path.join(ROOT, 'ayarlar.json');

function emptyStore() { return L.emptyWordStore(); }

function loadWords() {
  if (fs.existsSync(WORDS_FILE)) {
    return L.sanitizeWordStore(JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8')));
  }
  // İlk çalıştırma: kelimeler.json, yoksa gömülü liste ile tohumla.
  let seed;
  if (fs.existsSync(STATIC_WORDS_FILE)) seed = JSON.parse(fs.readFileSync(STATIC_WORDS_FILE, 'utf8'));
  else seed = require('./js/words.js');
  const store = L.sanitizeWordStore(seed);
  saveWords(store);
  return store;
}

function saveWords(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = WORDS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 1));
  fs.renameSync(tmp, WORDS_FILE);
}

const normalizeWord = L.normalizeWord;
const validateWord = L.validateWord;

function addWords(store, input) {
  const result = L.addWordsToStore(store, input);
  if (result.added.length) saveWords(store);
  return result;
}

function removeWord(store, raw) {
  const removed = L.removeWordFromStore(store, raw);
  if (removed) saveWords(store);
  return removed;
}

function counts(store) { return L.wordCounts(store); }

/* ---------- Oyun ayarları (yönetim panelinden değiştirilir) ---------- */

const DEFAULT_GAME_SETTINGS = L.DEFAULT_GAME_SETTINGS;
const sanitizeSettings = L.sanitizeSettings;

function loadSettings() {
  for (const file of [SETTINGS_FILE, STATIC_SETTINGS_FILE]) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Object.assign({}, DEFAULT_GAME_SETTINGS, sanitizeSettings(raw));
    } catch (e) { /* sıradaki dosya */ }
  }
  return Object.assign({}, DEFAULT_GAME_SETTINGS);
}

function saveSettings(settings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 1));
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
