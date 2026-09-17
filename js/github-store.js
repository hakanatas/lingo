/* GitHub deposunu veri kaynağı olarak kullanan küçük istemci.
 * Depodaki JSON dosyalarını GitHub Contents API ile okur ve commit atarak yazar.
 * Tarayıcıda (window.GitHubStore) ve Node testlerinde (module.exports) çalışır.
 */
(function (root) {
  'use strict';

  var API = 'https://api.github.com';

  function utf8ToBase64(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    var clean = String(b64).replace(/\s/g, '');
    if (typeof Buffer !== 'undefined') return Buffer.from(clean, 'base64').toString('utf8');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  var WRITE_HELP = 'Token bu depoya yazamıyor. GitHub\'da token ayarlarını açın: ' +
    '"Repository access" altında "Only select repositories" seçip bu depoyu işaretleyin; ' +
    '"Permissions → Repository permissions → Contents" için "Read and write" verin. ' +
    'Kaydettikten sonra token\'ı buraya yeniden yapıştırın.';

  /** GitHub'ın İngilizce hata metnini Türkçe ve çözüm önerili bir mesaja çevirir. */
  function friendlyError(status, raw, method) {
    var msg = String(raw || '');
    if (status === 401) return 'Token geçersiz ya da süresi dolmuş (GitHub: ' + msg + ').';
    if (status === 403 && /not accessible by (personal access|integration)/i.test(msg)) return WRITE_HELP;
    if (status === 403 && /rate limit/i.test(msg)) return 'GitHub istek sınırı aşıldı; birkaç dakika sonra tekrar deneyin.';
    if (status === 403) return 'GitHub izin vermedi: ' + msg + ' ' + WRITE_HELP;
    if (status === 404 && method !== 'GET') return 'Depo ya da dal bulunamadı. Kullanıcı adı, depo adı ve dal alanlarını kontrol edin (GitHub: ' + msg + ').';
    if (status === 404) return 'Bulunamadı: ' + msg;
    if (status === 409 || status === 422) return 'Dosya bu arada değişmiş; tekrar deneyin (GitHub: ' + msg + ').';
    return 'GitHub ' + status + ': ' + msg;
  }

  /**
   * @param {object} opts { owner, repo, branch, token, fetch }
   */
  function GitHubStore(opts) {
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.branch = opts.branch || 'main';
    this.token = opts.token || '';
    this._fetch = opts.fetch || (typeof fetch === 'function' ? fetch.bind(root) : null);
    this.shas = {};   // path → son bilinen sha (çakışma kontrolü için)
  }

  GitHubStore.prototype._request = function (method, path, body) {
    var headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    if (body) headers['Content-Type'] = 'application/json';
    return this._fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.text().then(function (text) {
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
          if (!r.ok) {
            var raw = (json && json.message) || ('GitHub ' + r.status);
            var err = new Error(friendlyError(r.status, raw, method));
            err.status = r.status;
            err.raw = raw;
            throw err;
          }
          if (json && typeof json === 'object' && !Array.isArray(json)) {
            // Klasik token'larda kapsamlar başlıkta gelir; ince ayarlı token'larda başlık yoktur.
            var scopes = r.headers && r.headers.get ? r.headers.get('x-oauth-scopes') : null;
            Object.defineProperty(json, '_scopes', { value: scopes, enumerable: false });
          }
          return json;
        });
      });
  };

  GitHubStore.prototype._contentsPath = function (file) {
    return '/repos/' + encodeURIComponent(this.owner) + '/' + encodeURIComponent(this.repo) +
      '/contents/' + file.split('/').map(encodeURIComponent).join('/');
  };

  /** Depo bilgisini döndürür (bağlantı ve yetki denemesi için). */
  GitHubStore.prototype.repoInfo = function () {
    return this._request('GET', '/repos/' + encodeURIComponent(this.owner) + '/' + encodeURIComponent(this.repo));
  };

  /**
   * Bağlantıyı ve yazma yetkisini elden geldiğince denetler.
   * Kullanıcının depo izni yoksa ya da klasik token'da repo kapsamı eksikse hata verir.
   * İnce ayarlı token'ların izinleri API'den okunamaz; onlarda eksik izin ilk yazmada anlaşılır.
   */
  GitHubStore.prototype.checkAccess = function () {
    return this.repoInfo().then(function (info) {
      if (!info.permissions || !info.permissions.push) {
        throw new Error('Bu hesabın depoya yazma izni yok (' + WRITE_HELP + ')');
      }
      var scopes = info._scopes;
      if (typeof scopes === 'string') {
        var list = scopes.split(',').map(function (x) { return x.trim(); });
        var ok = list.indexOf('repo') !== -1 || (!info.private && list.indexOf('public_repo') !== -1);
        if (!ok) throw new Error('Klasik token\'da "repo" kapsamı yok. ' + WRITE_HELP);
      }
      return info;
    });
  };

  /** Dosyayı metin olarak okur. Yoksa { exists: false, text: null }. */
  GitHubStore.prototype.readText = function (file) {
    var self = this;
    return this._request('GET', this._contentsPath(file) + '?ref=' + encodeURIComponent(this.branch))
      .then(function (res) {
        self.shas[file] = res.sha;
        return { exists: true, text: base64ToUtf8(res.content || ''), sha: res.sha };
      }, function (err) {
        if (err.status === 404) { delete self.shas[file]; return { exists: false, text: null, sha: null }; }
        throw err;
      });
  };

  /** Dosyayı JSON olarak okur. Yoksa { exists: false, data: null }. */
  GitHubStore.prototype.readJson = function (file) {
    return this.readText(file).then(function (r) {
      return { exists: r.exists, data: r.exists && r.text ? JSON.parse(r.text) : null, sha: r.sha };
    });
  };

  /**
   * Metni commit atarak yazar. Sha eski kalmışsa (409/422) bir kez yeniden okuyup dener.
   */
  GitHubStore.prototype.writeText = function (file, text, message) {
    var self = this;
    var content = utf8ToBase64(String(text));
    function attempt(retry) {
      var body = { message: message, content: content, branch: self.branch };
      if (self.shas[file]) body.sha = self.shas[file];
      return self._request('PUT', self._contentsPath(file), body).then(function (res) {
        self.shas[file] = res.content && res.content.sha;
        return res;
      }, function (err) {
        if (retry && (err.status === 409 || err.status === 422)) {
          return self.readText(file).then(function () { return attempt(false); });
        }
        throw err;
      });
    }
    return attempt(true);
  };

  GitHubStore.prototype.writeJson = function (file, data, message) {
    return this.writeText(file, JSON.stringify(data, null, 1) + '\n', message);
  };

  /** Tarayıcıda GitHub'ın dosya düzenleme sayfasının adresi. */
  GitHubStore.editUrl = function (owner, repo, branch, file) {
    return 'https://github.com/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
      '/edit/' + encodeURIComponent(branch) + '/' + file.split('/').map(encodeURIComponent).join('/');
  };

  GitHubStore.utf8ToBase64 = utf8ToBase64;
  GitHubStore.base64ToUtf8 = base64ToUtf8;

  if (typeof module !== 'undefined' && module.exports) module.exports = GitHubStore;
  else root.GitHubStore = GitHubStore;
})(typeof window !== 'undefined' ? window : this);
