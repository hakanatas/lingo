/* Lingo yönetim paneli.
 * İki çalışma biçimi vardır ve panel hangisinin geçerli olduğunu kendisi bulur:
 *   1) Node sunucusu (server.js): api/... uç noktaları ve ADMIN_PASSWORD.
 *   2) Yalnızca GitHub (GitHub Pages): kelimeler.json ve ayarlar.json depoda durur,
 *      değişiklikler GitHub API ile commit atılarak yapılır; yetki için erişim token'ı kullanılır.
 */
(function () {
  'use strict';

  var L = window.LingoLogic;
  var $ = function (id) { return document.getElementById(id); };
  var WORDS_FILE = 'kelimeler.json';
  var SETTINGS_FILE = 'ayarlar.json';

  var mode = null;          // 'server' | 'github'
  var backend = null;
  var store = L.emptyWordStore();
  var settings = Object.assign({}, L.DEFAULT_GAME_SETTINGS);
  var currentLen = 5;
  var canEdit = false;

  /* ---------- Depolama yardımcıları ---------- */
  function sget(key) { try { return sessionStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function sset(key, v) { try { if (v) sessionStorage.setItem(key, v); else sessionStorage.removeItem(key); } catch (e) { /* yok say */ } }
  function lget(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function lset(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* yok say */ } }

  function fetchJson(url, opts) {
    return fetch(url, Object.assign({ cache: 'no-store' }, opts || {})).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) throw new Error((j && j.error) || (r.status + ' ' + r.statusText));
        return j;
      });
    });
  }

  /* ---------- Arka uç 1: Node sunucusu ---------- */
  function ServerBackend() {
    this.name = 'server';
  }
  ServerBackend.prototype.headers = function () {
    var h = { 'Content-Type': 'application/json' };
    var key = sget('lingo.adminKey');
    if (key) h['x-admin-key'] = encodeURIComponent(key);
    return h;
  };
  ServerBackend.prototype.load = function () {
    return Promise.all([fetchJson('api/words'), fetchJson('api/settings')]).then(function (r) {
      return { store: L.sanitizeWordStore(r[0].words), settings: Object.assign({}, L.DEFAULT_GAME_SETTINGS, L.sanitizeSettings(r[1])) };
    });
  };
  ServerBackend.prototype.login = function (password) {
    return fetchJson('api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: password }) })
      .then(function () { sset('lingo.adminKey', password); });
  };
  ServerBackend.prototype.logout = function () { sset('lingo.adminKey', ''); };
  ServerBackend.prototype.isLoggedIn = function () { return !!sget('lingo.adminKey'); };
  ServerBackend.prototype.addWords = function (text) {
    return fetchJson('api/words', { method: 'POST', headers: this.headers(), body: JSON.stringify({ text: text }) });
  };
  ServerBackend.prototype.removeWord = function (w) {
    return fetchJson('api/words/' + encodeURIComponent(w), { method: 'DELETE', headers: this.headers() });
  };
  ServerBackend.prototype.saveSettings = function (patch) {
    return fetchJson('api/settings', { method: 'PUT', headers: this.headers(), body: JSON.stringify(patch) });
  };

  /* ---------- Arka uç 2: GitHub deposu ---------- */
  function GitHubBackend() {
    this.name = 'github';
    var saved = lget('lingo.github', {});
    var guess = guessRepo();
    this.owner = saved.owner || guess.owner;
    this.repo = saved.repo || guess.repo;
    this.branch = saved.branch || 'main';
    this.client = null;
  }
  /** GitHub Pages adresinden (kullanici.github.io/depo/) sahibi ve depoyu tahmin eder. */
  function guessRepo() {
    var host = location.hostname;
    var m = /^([^.]+)\.github\.io$/i.exec(host);
    var seg = location.pathname.split('/').filter(Boolean);
    if (m) return { owner: m[1], repo: seg[0] || m[1] + '.github.io' };
    return { owner: 'hakanatas', repo: 'lingo' };
  }
  GitHubBackend.prototype.load = function () {
    var self = this;
    if (this.client) {
      // Bağlıyken en güncel hâli ve sha'yı doğrudan API'den al.
      return Promise.all([self.client.readJson(WORDS_FILE), self.client.readJson(SETTINGS_FILE)]).then(function (r) {
        return {
          store: L.sanitizeWordStore(r[0].data || window.LINGO_WORDS),
          settings: Object.assign({}, L.DEFAULT_GAME_SETTINGS, L.sanitizeSettings(r[1].data))
        };
      });
    }
    // Bağlı değilken sayfayla aynı yerden (GitHub Pages) oku; birkaç dakika eski olabilir.
    return Promise.all([
      fetchJson(WORDS_FILE).catch(function () { return window.LINGO_WORDS; }),
      fetchJson(SETTINGS_FILE).catch(function () { return {}; })
    ]).then(function (r) {
      return { store: L.sanitizeWordStore(r[0]), settings: Object.assign({}, L.DEFAULT_GAME_SETTINGS, L.sanitizeSettings(r[1])) };
    });
  };
  GitHubBackend.prototype.login = function (token, owner, repo, branch) {
    var self = this;
    this.owner = owner; this.repo = repo; this.branch = branch || 'main';
    var client = new window.GitHubStore({ owner: owner, repo: repo, branch: this.branch, token: token });
    return client.repoInfo().then(function (info) {
      if (!info.permissions || !info.permissions.push) {
        throw new Error('Bu token depoya yazma yetkisi taşımıyor (Contents: Read and write gerekir).');
      }
      self.client = client;
      sset('lingo.githubToken', token);
      lset('lingo.github', { owner: owner, repo: repo, branch: self.branch });
    });
  };
  GitHubBackend.prototype.restore = function () {
    var token = sget('lingo.githubToken');
    if (!token) return Promise.resolve(false);
    return this.login(token, this.owner, this.repo, this.branch).then(function () { return true; }, function () { sset('lingo.githubToken', ''); return false; });
  };
  GitHubBackend.prototype.logout = function () { this.client = null; sset('lingo.githubToken', ''); };
  GitHubBackend.prototype.isLoggedIn = function () { return !!this.client; };
  GitHubBackend.prototype._commitWords = function (mutate, messageFor) {
    var self = this;
    return this.client.readJson(WORDS_FILE).then(function (r) {
      var fresh = L.sanitizeWordStore(r.data || window.LINGO_WORDS);
      var result = mutate(fresh);
      if (!result.changed) return Object.assign(result, { counts: L.wordCounts(fresh) });
      return self.client.writeJson(WORDS_FILE, fresh, messageFor(result)).then(function () {
        return Object.assign(result, { counts: L.wordCounts(fresh) });
      });
    });
  };
  GitHubBackend.prototype.addWords = function (text) {
    return this._commitWords(function (fresh) {
      var r = L.addWordsToStore(fresh, text);
      r.changed = r.added.length > 0;
      return r;
    }, function (r) {
      var list = r.added.slice(0, 6).join(', ') + (r.added.length > 6 ? ' … (+' + (r.added.length - 6) + ')' : '');
      return 'Lingo: kelime eklendi – ' + list;
    });
  };
  GitHubBackend.prototype.removeWord = function (w) {
    return this._commitWords(function (fresh) {
      var removed = L.removeWordFromStore(fresh, w);
      if (!removed) throw new Error('Kelime bulunamadı');
      return { removed: L.normalizeWord(w), changed: true };
    }, function () { return 'Lingo: kelime silindi – ' + L.normalizeWord(w); });
  };
  GitHubBackend.prototype.saveSettings = function (patch) {
    var self = this;
    return this.client.readJson(SETTINGS_FILE).then(function (r) {
      var next = Object.assign({}, L.DEFAULT_GAME_SETTINGS, L.sanitizeSettings(r.data), L.sanitizeSettings(patch));
      return self.client.writeJson(SETTINGS_FILE, next, 'Lingo: oyun ayarları güncellendi').then(function () { return next; });
    });
  };

  /* ---------- Arayüz ---------- */
  function setStatus(html) { $('status').innerHTML = html; }

  function renderMode() {
    $('login-server').classList.toggle('hidden', mode !== 'server');
    $('login-github').classList.toggle('hidden', mode !== 'github');
    canEdit = !!(backend && backend.isLoggedIn());
    $('btn-logout').classList.toggle('hidden', !canEdit);
    $('btn-add').disabled = !canEdit;
    $('cfg-bonus').disabled = !canEdit;
    $('add-hint').textContent = canEdit ? '' : (mode === 'github' ? 'Eklemek için GitHub ile bağlan.' : 'Eklemek için giriş yap.');
    $('pages-note').classList.toggle('hidden', mode !== 'github');

    if (mode === 'server') {
      $('login-form-server').classList.toggle('hidden', canEdit);
      setStatus(canEdit ? 'Giriş yapıldı. <b>Ekleme, silme ve ayarlar açık.</b>' : 'Giriş yapılmadı; yalnızca listeleme.');
    } else if (mode === 'github') {
      $('login-form-github').classList.toggle('hidden', canEdit);
      setStatus(canEdit
        ? 'GitHub\'a bağlı: <b>' + esc(backend.owner + '/' + backend.repo) + '</b> (' + esc(backend.branch) + '). Değişiklikler commit olarak kaydedilir.'
        : 'Bağlı değil; liste depodaki <code>kelimeler.json</code> dosyasından okunuyor.');
    }
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderTabs() {
    var counts = L.wordCounts(store);
    $('tabs').innerHTML = L.WORD_LENGTHS.map(function (n) {
      return '<button data-len="' + n + '" class="' + (n === currentLen ? 'active' : '') + '">' + n + ' harf<small>' + counts[n] + '</small></button>';
    }).join('');
    Array.prototype.forEach.call($('tabs').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { currentLen = Number(b.dataset.len); renderTabs(); renderList(); });
    });
  }

  function renderList() {
    var q = L.toLowerTr($('search').value.trim());
    var list = (store[currentLen] || []).filter(function (w) { return !q || w.indexOf(q) !== -1; });
    $('word-list').innerHTML = list.length
      ? list.map(function (w) {
          return '<span class="chip">' + esc(w) + (canEdit ? '<button title="Sil" data-word="' + esc(w) + '">×</button>' : '') + '</span>';
        }).join('')
      : '<span class="status">Kelime yok.</span>';
    Array.prototype.forEach.call($('word-list').querySelectorAll('button[data-word]'), function (b) {
      b.addEventListener('click', function () { removeWord(b.dataset.word); });
    });
  }

  function renderSettings() { $('cfg-bonus').checked = !!settings.bonusLetter; }

  function reload() {
    return backend.load().then(function (r) {
      store = r.store; settings = r.settings;
      renderTabs(); renderList(); renderSettings();
    }).catch(function (e) { setStatus('<b class="off">Veri yüklenemedi: ' + esc(e.message) + '</b>'); });
  }

  function busy(on) { document.body.style.cursor = on ? 'progress' : ''; }

  function removeWord(w) {
    if (!confirm('"' + L.toUpperTr(w) + '" silinsin mi?')) return;
    busy(true);
    backend.removeWord(w).then(function () {
      L.removeWordFromStore(store, w);
      renderTabs(); renderList();
      if (mode === 'github') note('Silindi ve commit atıldı. GitHub Pages 1–2 dakika içinde güncellenir.');
    }).catch(function (e) { alert(e.message); }).then(function () { busy(false); });
  }

  function note(msg) { $('add-report').innerHTML = '<div class="ok">' + esc(msg) + '</div>'; }

  /* ---------- Olaylar ---------- */
  $('btn-login').addEventListener('click', function () {
    busy(true);
    backend.login($('password').value).then(function () {
      $('password').value = ''; renderMode(); return reload();
    }).catch(function (e) { setStatus('<b class="off">' + esc(e.message) + '</b>'); }).then(function () { busy(false); });
  });
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('btn-login').click(); });

  $('btn-gh-login').addEventListener('click', function () {
    var token = $('gh-token').value.trim();
    var owner = $('gh-owner').value.trim();
    var repo = $('gh-repo').value.trim();
    var branch = $('gh-branch').value.trim() || 'main';
    if (!token || !owner || !repo) { setStatus('<b class="off">Token, kullanıcı adı ve depo adı gerekli.</b>'); return; }
    busy(true);
    backend.login(token, owner, repo, branch).then(function () {
      $('gh-token').value = ''; renderMode(); return reload();
    }).catch(function (e) { setStatus('<b class="off">Bağlanamadı: ' + esc(e.message) + '</b>'); }).then(function () { busy(false); });
  });
  $('gh-token').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('btn-gh-login').click(); });

  $('btn-logout').addEventListener('click', function () { backend.logout(); renderMode(); renderList(); });

  $('btn-add').addEventListener('click', function () {
    var text = $('new-words').value;
    if (!text.trim()) return;
    busy(true);
    backend.addWords(text).then(function (r) {
      var html = '';
      if (r.added.length) html += '<div class="ok">Eklendi (' + r.added.length + '): ' + esc(r.added.join(', ')) + '</div>';
      if (r.skipped.length) html += '<div class="warn">Zaten vardı (' + r.skipped.length + '): ' + esc(r.skipped.join(', ')) + '</div>';
      if (r.rejected.length) html += '<div class="bad">Reddedildi: ' + esc(r.rejected.map(function (x) { return x.word + ' (' + x.reason + ')'; }).join(', ')) + '</div>';
      if (mode === 'github' && r.added.length) html += '<div class="ok">Commit atıldı. GitHub Pages 1–2 dakika içinde güncellenir.</div>';
      $('add-report').innerHTML = html || '<div class="warn">Eklenecek kelime bulunamadı.</div>';
      $('new-words').value = '';
      return reload();
    }).catch(function (e) { $('add-report').innerHTML = '<div class="bad">' + esc(e.message) + '</div>'; }).then(function () { busy(false); });
  });

  $('cfg-bonus').addEventListener('change', function (e) {
    var value = e.target.checked;
    busy(true);
    backend.saveSettings({ bonusLetter: value }).then(function (cfg) {
      settings = Object.assign({}, settings, L.sanitizeSettings(cfg));
      renderSettings();
      $('cfg-status').innerHTML = 'Kaydedildi: bonus harf <b>' + (settings.bonusLetter ? 'açık' : 'kapalı') + '</b>.' +
        (mode === 'github' ? ' Commit atıldı; GitHub Pages 1–2 dakika içinde güncellenir.' : '');
    }).catch(function (err) {
      e.target.checked = !value;
      $('cfg-status').innerHTML = '<b class="off">' + esc(err.message) + '</b>';
    }).then(function () { busy(false); });
  });

  $('search').addEventListener('input', renderList);
  $('btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(store, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = WORDS_FILE; a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------- Başlangıç: ortamı bul ---------- */
  fetchJson('api/health').then(function (h) {
    mode = 'server';
    backend = new ServerBackend();
    if (!h.adminEnabled) {
      $('login-form-server').classList.add('hidden');
      $('server-disabled').classList.remove('hidden');
    }
    if (backend.isLoggedIn()) {
      return backend.login(sget('lingo.adminKey')).catch(function () { backend.logout(); });
    }
  }).catch(function () {
    mode = 'github';
    backend = new GitHubBackend();
    $('gh-owner').value = backend.owner;
    $('gh-repo').value = backend.repo;
    $('gh-branch').value = backend.branch;
    return backend.restore();
  }).then(function () {
    renderMode();
    return reload();
  });
})();
