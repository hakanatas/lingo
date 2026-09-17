'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const GitHubStore = require('../js/github-store.js');
const L = require('../js/logic.js');

/** GitHub Contents API'sini taklit eden sahte fetch: bellekte dosya tutar, sha üretir, çakışmayı kontrol eder. */
function fakeGitHub() {
  const files = {};   // path → { content(base64), sha }
  const calls = [];
  let counter = 0;
  const sha = () => 'sha' + (++counter);
  const res = (status, body, headers) => Promise.resolve({ ok: status < 300, status, headers: { get: (k) => (headers || {})[k.toLowerCase()] || null }, text: () => Promise.resolve(JSON.stringify(body)) });
  const fetch = (url, opts) => {
    calls.push({ url, method: opts.method, auth: opts.headers.Authorization });
    const u = new URL(url);
    if (opts.method === 'GET' && /^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return res(200, { private: false, permissions: { push: true } }, opts.headers.Authorization === 'Bearer classic-readonly' ? { 'x-oauth-scopes': 'read:user' } : null);
    if (opts.method === 'PUT' && opts.headers.Authorization === 'Bearer readonly') return res(403, { message: 'Resource not accessible by personal access token' });
    const m = /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/.exec(u.pathname);
    if (!m) return res(404, { message: 'Not Found' });
    const path = decodeURIComponent(m[1]);
    if (opts.method === 'GET') {
      if (!files[path]) return res(404, { message: 'Not Found' });
      return res(200, { content: files[path].content.replace(/(.{60})/g, '$1\n'), sha: files[path].sha });
    }
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if (files[path] && body.sha !== files[path].sha) return res(409, { message: 'is at ' + files[path].sha + ' but expected ' + body.sha });
      if (!files[path] && body.sha) return res(422, { message: 'sha wasn\'t supplied' });
      files[path] = { content: body.content, sha: sha() };
      return res(files[path] ? 200 : 201, { content: { sha: files[path].sha }, commit: { message: body.message } });
    }
    return res(405, { message: 'nope' });
  };
  return { fetch, files, calls, setRaw: (p, obj) => { files[p] = { content: GitHubStore.utf8ToBase64(JSON.stringify(obj)), sha: sha() }; } };
}

test('base64 ↔ utf8 Türkçe karakterleri korur', () => {
  const s = 'şeftali ÇİĞ ığdır';
  assert.equal(GitHubStore.base64ToUtf8(GitHubStore.utf8ToBase64(s)), s);
  assert.equal(GitHubStore.base64ToUtf8('YWJj\nZGVm'), 'abcdef', 'satır sonlu base64');
});

test('readJson: yok → exists:false; var → veri ve sha', async () => {
  const gh = fakeGitHub();
  const store = new GitHubStore({ owner: 'o', repo: 'r', branch: 'main', token: 't', fetch: gh.fetch });
  assert.deepEqual(await store.readJson('kelimeler.json'), { exists: false, data: null, sha: null });
  gh.setRaw('kelimeler.json', { 5: ['kalem'] });
  const r = await store.readJson('kelimeler.json');
  assert.equal(r.exists, true);
  assert.deepEqual(r.data, { 5: ['kalem'] });
  assert.equal(gh.calls[0].auth, 'Bearer t');
});

test('writeJson: oluşturur, günceller, eski sha ile çakışınca yeniden okuyup dener', async () => {
  const gh = fakeGitHub();
  const a = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetch: gh.fetch });
  await a.writeJson('ayarlar.json', { bonusLetter: true }, 'ilk');
  assert.equal(GitHubStore.base64ToUtf8(gh.files['ayarlar.json'].content).trim(), JSON.stringify({ bonusLetter: true }, null, 1));

  const b = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetch: gh.fetch });
  await b.readJson('ayarlar.json');
  await a.writeJson('ayarlar.json', { bonusLetter: false }, 'a yazdı');   // b'nin sha'sı eskidi
  await b.writeJson('ayarlar.json', { bonusLetter: true }, 'b yazdı');    // 409 → yeniden oku → başarı
  assert.deepEqual(JSON.parse(GitHubStore.base64ToUtf8(gh.files['ayarlar.json'].content)), { bonusLetter: true });
  const puts = gh.calls.filter((c) => c.method === 'PUT');
  assert.equal(puts.length, 4, '3 başarılı + 1 çakışan PUT');
});

test('kelime deposu yardımcıları GitHub akışıyla uyumlu', () => {
  const store = L.sanitizeWordStore({ 5: ['Kalem', 'kalem', 'abc', 'x1yzq'], 9: ['uzunkelime'], 4: ['ışık'] });
  assert.deepEqual(store[5], ['kalem']);
  assert.deepEqual(store[4], ['ışık']);
  assert.equal(store[9], undefined);
  const r = L.addWordsToStore(store, 'ZÜMRÜT, kalem\nabc');
  assert.deepEqual(r.added, ['zümrüt']);
  assert.deepEqual(r.skipped, ['kalem']);
  assert.equal(r.rejected[0].word, 'abc');
  assert.equal(L.removeWordFromStore(store, 'ZÜMRÜT'), true);
  assert.equal(L.removeWordFromStore(store, 'zümrüt'), false);
  assert.deepEqual(L.sanitizeSettings({ bonusLetter: true, x: 1 }), { bonusLetter: true });
});

test('yazma izni olmayan token: anlaşılır Türkçe hata', async () => {
  const gh = fakeGitHub();
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 'readonly', fetch: gh.fetch });
  await store.checkAccess();   // ince ayarlı token: bağlantı geçer, yazma sırasında anlaşılır
  await assert.rejects(store.writeJson('kelimeler.json', { 5: ['kalem'] }, 'x'), (e) => {
    assert.equal(e.status, 403);
    assert.match(e.message, /Read and write/);
    assert.match(e.raw, /not accessible/);
    return true;
  });
});

test('klasik token repo kapsamı yoksa bağlanırken hata', async () => {
  const gh = fakeGitHub();
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 'classic-readonly', fetch: gh.fetch });
  await assert.rejects(store.checkAccess(), /repo/);
  const ok = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetch: gh.fetch });
  await ok.checkAccess();
});

test('readText/writeText ve editUrl', async () => {
  const gh = fakeGitHub();
  const store = new GitHubStore({ owner: 'o', repo: 'r', token: 't', fetch: gh.fetch });
  assert.deepEqual(await store.readText('kelimeler.txt'), { exists: false, text: null, sha: null });
  await store.writeText('kelimeler.txt', 'kalem\nşeftali\n', 'ekle');
  const r = await store.readText('kelimeler.txt');
  assert.equal(r.text, 'kalem\nşeftali\n');
  assert.equal(GitHubStore.editUrl('hakan atas', 'lingo', 'main', 'kelimeler.txt'), 'https://github.com/hakan%20atas/lingo/edit/main/kelimeler.txt');
});
