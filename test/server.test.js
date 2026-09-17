'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Sunucuyu geçici veri klasörü ve bilinen şifreyle yükle.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-test-'));
process.env.ADMIN_PASSWORD = 'test-şifre';
const { createServer, validateWord, normalizeWord, addWords, emptyStore, sanitizeSettings } = require('../server.js');

let server; let base;
test.before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

const admin = { 'x-admin-key': encodeURIComponent('test-şifre'), 'Content-Type': 'application/json' };

test('validateWord ve normalizeWord', () => {
  assert.equal(normalizeWord('  KALEM '), 'kalem');
  assert.equal(normalizeWord('İLİK'), 'ilik');
  assert.deepEqual(validateWord('kalem'), { ok: true, length: 5 });
  assert.equal(validateWord('abc').ok, false);
  assert.equal(validateWord('kalemlik').ok, false);
  assert.equal(validateWord('kal3m').ok, false);
  assert.equal(validateWord('wolf').ok, false, 'w Türk alfabesinde yok');
});

test('addWords: ekleme, tekrar, red', () => {
  const store = emptyStore();
  const r = addWords(store, 'Kalem, defter\nkalem  pencere abc x1yz');
  assert.deepEqual(r.added, ['kalem', 'defter', 'pencere']);
  assert.deepEqual(r.skipped, []);
  assert.equal(r.rejected.length, 2);
  const r2 = addWords(store, ['KALEM']);
  assert.deepEqual(r2.skipped, ['kalem']);
});

test('GET /api/health ve /api/words', async () => {
  const h = await (await fetch(base + '/api/health')).json();
  assert.equal(h.ok, true);
  assert.equal(h.adminEnabled, true);
  const w = await (await fetch(base + '/api/words')).json();
  assert.ok(w.words[5].length > 100, 'gömülü listeyle tohumlandı');
  assert.ok(w.words[5].includes('kalem'));
  const five = await (await fetch(base + '/api/words?len=5')).json();
  assert.equal(five.length, 5);
  assert.equal((await fetch(base + '/api/words?len=9')).status, 400);
});

test('POST /api/words yetki gerektirir', async () => {
  const r = await fetch(base + '/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'zzzzz' }) });
  assert.equal(r.status, 401);
  const r2 = await fetch(base + '/api/words', { method: 'POST', headers: { 'x-admin-key': encodeURIComponent('yanlış'), 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r2.status, 401);
});

test('POST /api/auth', async () => {
  const ok = await fetch(base + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-şifre' }) });
  assert.equal(ok.status, 200);
  const bad = await fetch(base + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'x' }) });
  assert.equal(bad.status, 401);
});

test('kelime ekle, kalıcı olsun, sil', async () => {
  const add = await (await fetch(base + '/api/words', { method: 'POST', headers: admin, body: JSON.stringify({ text: 'ZÜMRÜT, kalem, abc' }) })).json();
  assert.deepEqual(add.added, ['zümrüt']);
  assert.deepEqual(add.skipped, ['kalem']);
  assert.equal(add.rejected[0].word, 'abc');

  const onDisk = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'words.json'), 'utf8'));
  assert.ok(onDisk[6].includes('zümrüt'), 'diske yazıldı');

  const del = await fetch(base + '/api/words/' + encodeURIComponent('zümrüt'), { method: 'DELETE', headers: admin });
  assert.equal(del.status, 200);
  const again = await fetch(base + '/api/words/' + encodeURIComponent('zümrüt'), { method: 'DELETE', headers: admin });
  assert.equal(again.status, 404);
  const w = await (await fetch(base + '/api/words?len=6')).json();
  assert.ok(!w.words.includes('zümrüt'));
});

test('GET /api/daily aynı gün aynı kelime', async () => {
  const a = await (await fetch(base + '/api/daily')).json();
  const b = await (await fetch(base + '/api/daily')).json();
  assert.equal(a.word, b.word);
  assert.equal(a.word.length, 5);
  assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('statik dosyalar ve güvenlik', async () => {
  const idx = await fetch(base + '/');
  assert.equal(idx.status, 200);
  assert.match(idx.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(base + '/admin.html')).status, 200);
  assert.equal((await fetch(base + '/js/logic.js')).status, 200);
  assert.equal((await fetch(base + '/server.js')).status, 404, 'sunucu kodu sunulmaz');
  assert.equal((await fetch(base + '/.gitignore')).status, 404);
  assert.equal((await fetch(base + '/olmayan.html')).status, 404);
  assert.equal((await fetch(base + '/api/olmayan')).status, 404);
  const bad = await fetch(base + '/api/words', { method: 'POST', headers: admin, body: '{bozuk' });
  assert.equal(bad.status, 400);
});

test('sanitizeSettings yalnızca bilinen anahtar ve tipleri alır', () => {
  assert.deepEqual(sanitizeSettings({ bonusLetter: true, foo: 1 }), { bonusLetter: true });
  assert.deepEqual(sanitizeSettings({ bonusLetter: 'evet' }), {});
  assert.deepEqual(sanitizeSettings(null), {});
});

test('GET/PUT /api/settings: varsayılan kapalı, yetkiyle değişir, diske yazılır', async () => {
  const def = await (await fetch(base + '/api/settings')).json();
  assert.equal(def.bonusLetter, false);

  const noAuth = await fetch(base + '/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bonusLetter: true }) });
  assert.equal(noAuth.status, 401);

  const bad = await fetch(base + '/api/settings', { method: 'PUT', headers: admin, body: JSON.stringify({ foo: true }) });
  assert.equal(bad.status, 400);

  const ok = await (await fetch(base + '/api/settings', { method: 'PUT', headers: admin, body: JSON.stringify({ bonusLetter: true }) })).json();
  assert.equal(ok.bonusLetter, true);
  const again = await (await fetch(base + '/api/settings')).json();
  assert.equal(again.bonusLetter, true);
  const onDisk = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'settings.json'), 'utf8'));
  assert.equal(onDisk.bonusLetter, true);

  await fetch(base + '/api/settings', { method: 'PUT', headers: admin, body: JSON.stringify({ bonusLetter: false }) });
});
