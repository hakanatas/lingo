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
            var err = new Error((json && json.message) || ('GitHub ' + r.status));
            err.status = r.status;
            throw err;
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

  /** Dosyayı okur. Yoksa { exists: false, data: null }. */
  GitHubStore.prototype.readJson = function (file) {
    var self = this;
    return this._request('GET', this._contentsPath(file) + '?ref=' + encodeURIComponent(this.branch))
      .then(function (res) {
        self.shas[file] = res.sha;
        var text = base64ToUtf8(res.content || '');
        return { exists: true, data: text ? JSON.parse(text) : null, sha: res.sha };
      }, function (err) {
        if (err.status === 404) { delete self.shas[file]; return { exists: false, data: null, sha: null }; }
        throw err;
      });
  };

  /**
   * Dosyayı commit atarak yazar. Sha eski kalmışsa (409/422) bir kez yeniden okuyup dener.
   */
  GitHubStore.prototype.writeJson = function (file, data, message) {
    var self = this;
    var content = utf8ToBase64(JSON.stringify(data, null, 1) + '\n');
    function attempt(retry) {
      var body = { message: message, content: content, branch: self.branch };
      if (self.shas[file]) body.sha = self.shas[file];
      return self._request('PUT', self._contentsPath(file), body).then(function (res) {
        self.shas[file] = res.content && res.content.sha;
        return res;
      }, function (err) {
        if (retry && (err.status === 409 || err.status === 422)) {
          return self.readJson(file).then(function () { return attempt(false); });
        }
        throw err;
      });
    }
    return attempt(true);
  };

  GitHubStore.utf8ToBase64 = utf8ToBase64;
  GitHubStore.base64ToUtf8 = base64ToUtf8;

  if (typeof module !== 'undefined' && module.exports) module.exports = GitHubStore;
  else root.GitHubStore = GitHubStore;
})(typeof window !== 'undefined' ? window : this);
