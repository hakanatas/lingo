/* Lingo çekirdek mantığı: saf fonksiyonlar, DOM'a bağımlı değil.
 * Hem tarayıcıda (window.LingoLogic) hem Node testlerinde (module.exports) kullanılır.
 */
(function (root) {
  'use strict';

  var TR_LOCALE = 'tr-TR';

  /** Türkçe kurallarına göre büyük harfe çevirir (i → İ, ı → I). */
  function toUpperTr(s) {
    return String(s).toLocaleUpperCase(TR_LOCALE);
  }

  /** Türkçe kurallarına göre küçük harfe çevirir (İ → i, I → ı). */
  function toLowerTr(s) {
    return String(s).toLocaleLowerCase(TR_LOCALE);
  }

  /** Bir dizeyi Unicode karakter dizisine böler (ğ, ş gibi harfler tek eleman olur). */
  function chars(s) {
    return Array.from(String(s));
  }

  /**
   * Tahmini hedef kelimeye göre değerlendirir.
   * Sonuç: her harf için 'correct' (doğru yerde, kırmızı kare),
   * 'present' (kelimede var ama yanlış yerde, sarı daire) veya 'absent'.
   * Tekrar eden harfler iki geçişle doğru sayılır: önce tam eşleşmeler
   * işaretlenir, sonra kalan harfler hedefte kalan harf sayısı kadar 'present' olur.
   */
  function evaluateGuess(guess, target) {
    var g = chars(toUpperTr(guess));
    var t = chars(toUpperTr(target));
    var n = t.length;
    var result = new Array(n);
    var remaining = {};
    var i;

    for (i = 0; i < n; i++) {
      if (g[i] === t[i]) {
        result[i] = 'correct';
      } else {
        remaining[t[i]] = (remaining[t[i]] || 0) + 1;
      }
    }
    for (i = 0; i < n; i++) {
      if (result[i]) continue;
      if (g[i] !== undefined && remaining[g[i]] > 0) {
        result[i] = 'present';
        remaining[g[i]] -= 1;
      } else {
        result[i] = 'absent';
      }
    }
    return result;
  }

  /**
   * Önceki tahminlerden bilinen (doğru yerdeki) harfleri hesaplar.
   * Sonraki satıra taşınacak ipuçlarını döndürür: bilinmeyen konumlar null.
   */
  function knownLetters(target, guesses) {
    var t = chars(toUpperTr(target));
    var known = t.map(function () { return null; });
    known[0] = t[0]; // İlk harf her zaman verilir.
    guesses.forEach(function (guess) {
      var g = chars(toUpperTr(guess));
      for (var i = 0; i < t.length; i++) {
        if (g[i] === t[i]) known[i] = t[i];
      }
    });
    return known;
  }

  /**
   * Tahminin geçerliliğini denetler.
   * Dönen değer: { ok: true } veya { ok: false, reason: '...' }.
   */
  function validateGuess(guess, target, dictionary, options) {
    options = options || {};
    var g = toUpperTr(guess);
    var t = toUpperTr(target);
    var gl = chars(g);
    var tl = chars(t);

    if (gl.length !== tl.length) {
      return { ok: false, reason: 'length' };
    }
    if (gl[0] !== tl[0]) {
      return { ok: false, reason: 'firstLetter' };
    }
    if (options.checkDictionary !== false && dictionary) {
      var lower = toLowerTr(g);
      if (dictionary.indexOf(lower) === -1 && lower !== toLowerTr(t)) {
        return { ok: false, reason: 'dictionary' };
      }
    }
    return { ok: true };
  }

  /** Klavye tuşlarının durumunu birleştirir: correct > present > absent. */
  function mergeKeyStates(states, guess, evaluation) {
    var rank = { absent: 1, present: 2, correct: 3 };
    var g = chars(toUpperTr(guess));
    g.forEach(function (ch, i) {
      var next = evaluation[i];
      var prev = states[ch];
      if (!prev || rank[next] > rank[prev]) states[ch] = next;
    });
    return states;
  }

  /* ---------- Rastgele sayı üretimi (tohumlanabilir) ---------- */

  /** Mulberry32: küçük, tohumlanabilir PRNG. Günlük kelime için kullanılır. */
  function seededRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** YYYY-MM-DD biçimindeki tarihi sayısal tohuma çevirir. */
  function dateSeed(dateStr) {
    var h = 2166136261;
    for (var i = 0; i < dateStr.length; i++) {
      h ^= dateStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pickWord(list, rng) {
    rng = rng || Math.random;
    return list[Math.floor(rng() * list.length)];
  }

  /* ---------- Lingo kartı ve top havuzu ---------- */

  /**
   * 5x5 Lingo kartı üretir. Kart yalnızca çift ya da tek sayılardan oluşur
   * (TV formatında her takımın kartı farklı paritededir). 25 sayının 8'i
   * baştan işaretli gelir; kalan 17 sayı top havuzuna girer.
   */
  function createCard(parity, rng) {
    rng = rng || Math.random;
    var pool = [];
    for (var n = 1; n <= 70; n++) {
      if ((n % 2 === 0) === (parity === 'even')) pool.push(n);
    }
    shuffle(pool, rng);
    var numbers = pool.slice(0, 25).sort(function (a, b) { return a - b; });
    // Kartı sütun sütun yerleştir: her sütun 5 sayı, bingo kartı gibi artan sırada.
    var cells = new Array(25);
    for (var c = 0; c < 5; c++) {
      var col = numbers.slice(c * 5, c * 5 + 5);
      for (var r = 0; r < 5; r++) cells[r * 5 + c] = { n: col[r], marked: false };
    }
    // 8 rastgele hücre önceden işaretli.
    var idx = [];
    for (var i = 0; i < 25; i++) idx.push(i);
    shuffle(idx, rng);
    idx.slice(0, 8).forEach(function (k) { cells[k].marked = true; });
    return { cells: cells, parity: parity };
  }

  /** Karttaki işaretsiz sayılar + 1 soru işareti + 3 yeşil + 3 kırmızı top. */
  function createHopper(card, rng) {
    rng = rng || Math.random;
    var balls = [];
    card.cells.forEach(function (cell) {
      if (!cell.marked) balls.push({ type: 'number', n: cell.n });
    });
    balls.push({ type: 'wild' });
    for (var i = 0; i < 3; i++) balls.push({ type: 'green' });
    for (var j = 0; j < 3; j++) balls.push({ type: 'red' });
    shuffle(balls, rng);
    return balls;
  }

  /** Havuzdan bir top çeker (havuzu değiştirir). Havuz boşsa null döner. */
  function drawBall(hopper) {
    return hopper.length ? hopper.pop() : null;
  }

  /** Kartta verilen sayıyı işaretler; işaretlendiyse true döner. */
  function markNumber(card, n) {
    for (var i = 0; i < card.cells.length; i++) {
      if (card.cells[i].n === n && !card.cells[i].marked) {
        card.cells[i].marked = true;
        return true;
      }
    }
    return false;
  }

  /** Kartta 5'li sıra (yatay, dikey, çapraz) var mı? Varsa hücre indekslerini döndürür. */
  function findLingo(card) {
    var lines = [];
    var r, c;
    for (r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map(function (k) { return r * 5 + k; }));
    for (c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map(function (k) { return k * 5 + c; }));
    lines.push([0, 6, 12, 18, 24]);
    lines.push([4, 8, 12, 16, 20]);
    for (var i = 0; i < lines.length; i++) {
      var full = lines[i].every(function (k) { return card.cells[k].marked; });
      if (full) return lines[i];
    }
    return null;
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- Puanlama ---------- */

  /**
   * Kelime puanı: uzunluk × 20 × (6 − deneme sırası).
   * 5 harfli kelimeyi 1. denemede bulmak 500, 5. denemede bulmak 100 puan.
   */
  function wordScore(length, attempt) {
    return length * 20 * Math.max(1, 6 - attempt);
  }

  var LINGO_BONUS = 500;

  /* ---------- Kelime deposu (yönetim paneli ve sunucu ortak kullanır) ---------- */

  var WORD_LENGTHS = [4, 5, 6, 7];
  var WORD_ALPHABET = 'abcçdefgğhıijklmnoöprsştuüvyz';

  function emptyWordStore() {
    var store = {};
    WORD_LENGTHS.forEach(function (n) { store[n] = []; });
    return store;
  }

  function collate(a, b) { return a.localeCompare(b, TR_LOCALE); }

  function normalizeWord(w) { return toLowerTr(String(w == null ? '' : w).trim()); }

  function validateWord(w) {
    var c = chars(w);
    if (!c.length) return { ok: false, reason: 'boş' };
    if (WORD_LENGTHS.indexOf(c.length) === -1) return { ok: false, reason: 'uzunluk 4–7 olmalı' };
    for (var i = 0; i < c.length; i++) {
      if (WORD_ALPHABET.indexOf(c[i]) === -1) return { ok: false, reason: 'yalnızca Türk alfabesi harfleri' };
    }
    return { ok: true, length: c.length };
  }

  function parseWordInput(input) {
    if (Array.isArray(input)) return input.map(String);
    return String(input || '').split(/[\s,;]+/);
  }

  /** Depoya kelime ekler (yerinde). Sonuç: { added, skipped, rejected }. */
  function addWordsToStore(store, input) {
    var added = [], skipped = [], rejected = [], seen = {};
    parseWordInput(input).forEach(function (raw) {
      var w = normalizeWord(raw);
      if (!w || seen[w]) return;
      seen[w] = true;
      var v = validateWord(w);
      if (!v.ok) { rejected.push({ word: w, reason: v.reason }); return; }
      if (!store[v.length]) store[v.length] = [];
      if (store[v.length].indexOf(w) !== -1) { skipped.push(w); return; }
      store[v.length].push(w);
      added.push(w);
    });
    if (added.length) WORD_LENGTHS.forEach(function (n) { if (store[n]) store[n].sort(collate); });
    return { added: added, skipped: skipped, rejected: rejected };
  }

  /** Depodan kelime siler (yerinde). Silindiyse true. */
  function removeWordFromStore(store, raw) {
    var w = normalizeWord(raw);
    var v = validateWord(w);
    if (!v.ok || !store[v.length]) return false;
    var i = store[v.length].indexOf(w);
    if (i === -1) return false;
    store[v.length].splice(i, 1);
    return true;
  }

  /** Bilinmeyen anahtarları ve yanlış tipleri atarak deponun kopyasını döndürür. */
  function sanitizeWordStore(raw) {
    var store = emptyWordStore();
    if (!raw || typeof raw !== 'object') return store;
    WORD_LENGTHS.forEach(function (n) {
      if (Array.isArray(raw[n])) {
        var seen = {};
        raw[n].forEach(function (w) {
          var x = normalizeWord(w);
          if (!seen[x] && validateWord(x).ok && chars(x).length === n) { seen[x] = true; store[n].push(x); }
        });
        store[n].sort(collate);
      }
    });
    return store;
  }

  function wordCounts(store) {
    var c = {};
    WORD_LENGTHS.forEach(function (n) { c[n] = (store[n] || []).length; });
    return c;
  }

  /* ---------- Oyun ayarları (sunucu / GitHub dosyası) ---------- */

  var DEFAULT_GAME_SETTINGS = {
    // İki takım modunda sıra rakibe geçince kelimeden rastgele bir harf açılır (TV kuralı).
    bonusLetter: false
  };

  /** Yalnızca bilinen anahtarları ve doğru tipleri kabul eder. */
  function sanitizeSettings(input) {
    var out = {};
    if (!input || typeof input !== 'object') return out;
    Object.keys(DEFAULT_GAME_SETTINGS).forEach(function (key) {
      if (typeof input[key] === typeof DEFAULT_GAME_SETTINGS[key]) out[key] = input[key];
    });
    return out;
  }

  var api = {
    toUpperTr: toUpperTr,
    toLowerTr: toLowerTr,
    chars: chars,
    evaluateGuess: evaluateGuess,
    knownLetters: knownLetters,
    validateGuess: validateGuess,
    mergeKeyStates: mergeKeyStates,
    seededRandom: seededRandom,
    dateSeed: dateSeed,
    pickWord: pickWord,
    createCard: createCard,
    createHopper: createHopper,
    drawBall: drawBall,
    markNumber: markNumber,
    findLingo: findLingo,
    shuffle: shuffle,
    wordScore: wordScore,
    LINGO_BONUS: LINGO_BONUS,
    WORD_LENGTHS: WORD_LENGTHS,
    WORD_ALPHABET: WORD_ALPHABET,
    emptyWordStore: emptyWordStore,
    normalizeWord: normalizeWord,
    validateWord: validateWord,
    parseWordInput: parseWordInput,
    addWordsToStore: addWordsToStore,
    removeWordFromStore: removeWordFromStore,
    sanitizeWordStore: sanitizeWordStore,
    wordCounts: wordCounts,
    DEFAULT_GAME_SETTINGS: DEFAULT_GAME_SETTINGS,
    sanitizeSettings: sanitizeSettings
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.LingoLogic = api;
  }
})(typeof window !== 'undefined' ? window : this);
