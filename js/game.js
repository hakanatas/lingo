/* Lingo – oyun akışı ve arayüz. Çekirdek kurallar js/logic.js içindedir. */
(function () {
  'use strict';

  var L = window.LingoLogic;
  var WORDS = window.LINGO_WORDS;   // Sunucu varsa api/words ile değiştirilir.
  var serverAvailable = false;
  // Sunucu tarafında (admin.html) ayarlanan oyun kuralları. Sunucu yoksa varsayılanlar geçerlidir.
  var serverConfig = { bonusLetter: false };
  var $ = function (id) { return document.getElementById(id); };

  var MAX_ATTEMPTS = 5;
  var DRAWS_PER_WORD = 2;
  var TEAM_COLORS = ['#e0242b', '#2f6fd6'];
  var KEY_ROWS = [
    ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['ENTER', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'SİL']
  ];
  var ALPHABET = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

  var DEFAULT_SETTINGS = {
    length: 5,
    timer: 20,
    wordsPerGame: 5,
    theme: 'tv'
  };
  var DEFAULT_STATS = {
    gamesPlayed: 0, wordsPlayed: 0, wordsSolved: 0,
    attempts: [0, 0, 0, 0, 0], lingos: 0, bestScore: 0,
    dailyPlayed: 0, dailySolved: 0, dailyStreak: 0, lastDaily: null
  };

  var settings = load('lingo.settings', DEFAULT_SETTINGS);
  var stats = load('lingo.stats', DEFAULT_STATS);
  var state = null;
  var toastTimer = null;

  /* ---------- Depolama ---------- */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      var obj = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(fallback)), obj);
    } catch (e) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* özel pencere vb. */ }
  }

  function todayKey() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /* ---------- Başlangıç ekranı ---------- */
  function initStartScreen() {
    document.body.setAttribute('data-theme', settings.theme);

    var lenSeg = $('opt-length');
    Array.prototype.forEach.call(lenSeg.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', Number(b.dataset.len) === settings.length);
      b.addEventListener('click', function () {
        settings.length = Number(b.dataset.len);
        save('lingo.settings', settings);
        Array.prototype.forEach.call(lenSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
      });
    });

    var timerInput = $('opt-timer');
    timerInput.value = settings.timer;
    updateTimerLabel();
    timerInput.addEventListener('input', function () {
      settings.timer = Number(timerInput.value);
      save('lingo.settings', settings);
      updateTimerLabel();
    });

    var wordsSeg = $('opt-words');
    Array.prototype.forEach.call(wordsSeg.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', Number(b.dataset.words) === settings.wordsPerGame);
      b.addEventListener('click', function () {
        settings.wordsPerGame = Number(b.dataset.words);
        save('lingo.settings', settings);
        Array.prototype.forEach.call(wordsSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.mode-card'), function (card) {
      card.addEventListener('mouseenter', function () {
        $('opt-names').classList.toggle('hidden', card.dataset.mode !== 'duo');
      });
      card.addEventListener('focus', function () {
        $('opt-names').classList.toggle('hidden', card.dataset.mode !== 'duo');
      });
      card.addEventListener('click', function () {
        if (card.dataset.mode === 'duo' && $('opt-names').classList.contains('hidden')) {
          // Dokunmatik cihazlarda önce takım adlarını göster, ikinci dokunuşta başlat.
          $('opt-names').classList.remove('hidden');
          toast('Takım adlarını yazıp tekrar dokunun');
          return;
        }
        startGame(card.dataset.mode);
      });
    });
  }

  function updateTimerLabel() {
    $('opt-timer-val').textContent = settings.timer === 0 ? 'Süresiz' : settings.timer + ' sn';
  }

  /* ---------- Oyun kurulumu ---------- */
  function startGame(mode) {
    var length = mode === 'daily' ? 5 : settings.length;
    var teams;

    if (mode === 'duo') {
      teams = [
        makeTeam($('team-a').value.trim() || 'Kırmızı Takım', 'even'),
        makeTeam($('team-b').value.trim() || 'Mavi Takım', 'odd')
      ];
    } else {
      teams = [makeTeam('Sen', 'even')];
    }

    state = {
      mode: mode,
      length: length,
      totalWords: mode === 'daily' ? 1 : settings.wordsPerGame,
      wordIndex: -1,
      teams: teams,
      current: 0,
      starter: 0,
      phase: 'between',
      timerHandle: null,
      timerRemaining: 0,
      timerTotal: 0,
      usedWords: []
    };

    if (mode === 'daily') {
      var saved = load('lingo.daily', {});
      if (saved.date === todayKey() && saved.done) {
        $('screen-start').classList.add('hidden');
        $('screen-game').classList.remove('hidden');
        state.wordIndex = 0;
        restoreDaily(saved);
        return;
      }
    }

    $('screen-start').classList.add('hidden');
    $('screen-game').classList.remove('hidden');

    if (mode === 'daily' && serverAvailable) {
      // Herkes aynı kelimeyi alsın diye günün kelimesini sunucu belirler.
      var started = state;
      fetch('api/daily').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (state !== started) return;
        if (d && d.word && d.date === todayKey()) state.dailyWord = d.word;
        nextWord();
      }).catch(function () { if (state === started) nextWord(); });
      return;
    }
    nextWord();
  }

  function makeTeam(name, parity) {
    var card = L.createCard(parity);
    return { name: name, score: 0, lingos: 0, card: card, hopper: L.createHopper(card), solved: 0 };
  }

  function chooseWord() {
    var list = WORDS[state.length];
    if (state.mode === 'daily') {
      if (state.dailyWord) return state.dailyWord;
      var rng = L.seededRandom(L.dateSeed(todayKey()));
      return L.pickWord(list, rng);
    }
    var w;
    var guard = 0;
    do {
      w = L.pickWord(list);
      guard++;
    } while (state.usedWords.indexOf(w) !== -1 && guard < 50);
    state.usedWords.push(w);
    return w;
  }

  function nextWord() {
    state.wordIndex += 1;
    if (state.wordIndex >= state.totalWords) { endGame(); return; }

    state.target = L.toUpperTr(chooseWord());
    state.rows = [];          // { letters:[], eval:[], status:'ok'|'timeout'|'invalid' }
    state.attempt = 0;
    state.known = L.knownLetters(state.target, []);
    state.input = [];
    state.keyStates = {};
    state.phase = 'guess';
    state.drawsLeft = 0;
    state.drawn = [];
    state.solvedBy = null;

    if (state.mode === 'duo') {
      state.starter = state.wordIndex % 2;
      state.current = state.starter;
    }

    $('draw-panel').classList.add('hidden');
    renderAll();
    startTimer();
  }

  /* ---------- Süre ---------- */
  function timerEnabled() {
    return state.mode !== 'daily' && settings.timer > 0;
  }

  function startTimer() {
    stopTimer();
    var timerEl = $('timer');
    if (!timerEnabled()) { timerEl.style.visibility = 'hidden'; return; }
    timerEl.style.visibility = 'visible';
    state.timerTotal = settings.timer * 1000;
    state.timerRemaining = state.timerTotal;
    var last = Date.now();
    renderTimer();
    state.timerHandle = setInterval(function () {
      var now = Date.now();
      state.timerRemaining -= now - last;
      last = now;
      if (state.timerRemaining <= 0) {
        state.timerRemaining = 0;
        renderTimer();
        stopTimer();
        onTimeout();
        return;
      }
      renderTimer();
    }, 100);
  }

  function stopTimer() {
    if (state && state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
  }

  function renderTimer() {
    var timerEl = $('timer');
    var pct = state.timerTotal ? (state.timerRemaining / state.timerTotal) * 100 : 100;
    var seconds = Math.ceil(state.timerRemaining / 1000);
    $('timer-bar').style.width = pct + '%';
    // Son 5 saniye her zaman kırmızı; aksi halde kalan yüzdeye göre renk.
    var danger = seconds <= 5 || pct < 25;
    timerEl.classList.toggle('danger', danger);
    timerEl.classList.toggle('warn', !danger && pct < 50);
    $('timer-text').textContent = seconds;
  }

  function onTimeout() {
    if (state.phase !== 'guess') return;
    toast('Süre doldu!');
    consumeRow('timeout');
  }

  /* ---------- Giriş ---------- */
  function handleKey(key) {
    if (!state || state.phase !== 'guess') return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'SİL' || key === 'BACKSPACE') {
      if (state.input.length) { state.input.pop(); renderBoard(); }
      return;
    }
    if (ALPHABET.indexOf(key) === -1) return;
    if (state.input.length >= state.length - 1) return;
    state.input.push(key);
    renderBoard(true);
  }

  function currentGuessLetters() {
    var letters = [state.target[0]];
    for (var i = 1; i < state.length; i++) {
      var typed = state.input[i - 1];
      letters.push(typed || state.known[i] || null);
    }
    return letters;
  }

  function submitGuess() {
    var letters = currentGuessLetters();
    if (letters.some(function (c) { return !c; })) {
      toast('Eksik harf');
      shakeRow();
      return;
    }
    var guess = letters.join('');
    // Sözlük kontrolü yapılmaz: ilk harf ve uzunluk uyan her tahmin kabul edilir.
    var check = L.validateGuess(guess, state.target, null, { checkDictionary: false });
    if (!check.ok) {
      toast('Geçersiz tahmin');
      shakeRow();
      return;
    }
    stopTimer();
    var evaluation = L.evaluateGuess(guess, state.target);
    state.rows.push({ letters: letters, eval: evaluation, status: 'ok', team: state.current });
    state.attempt += 1;
    L.mergeKeyStates(state.keyStates, guess, evaluation);
    state.known = L.knownLetters(state.target, state.rows.filter(function (r) { return r.status === 'ok'; }).map(function (r) { return r.letters.join(''); }));
    state.input = [];
    state.phase = 'reveal';
    renderBoard();
    renderKeyboard();

    var solved = evaluation.every(function (s) { return s === 'correct'; });
    var delay = state.length * 120 + 350;
    setTimeout(function () {
      if (solved) onWordSolved();
      else afterFailedAttempt();
    }, delay);
  }

  /** Süre dolması bir hakkı yakar. */
  function consumeRow(status, letters) {
    stopTimer();
    state.rows.push({ letters: letters || null, eval: null, status: status, team: state.current });
    state.attempt += 1;
    state.input = [];
    state.phase = 'reveal';
    renderBoard();
    setTimeout(afterFailedAttempt, 500);
  }

  function afterFailedAttempt() {
    if (state.attempt >= MAX_ATTEMPTS) { onWordFailed(); return; }
    if (state.mode === 'duo') passTurn();
    state.phase = 'guess';
    renderAll();
    startTimer();
  }

  function passTurn() {
    state.current = 1 - state.current;
    var name = state.teams[state.current].name;
    if (serverConfig.bonusLetter) {
      // Bonus harf (yönetim panelinden açılır): rakibe bilinmeyen bir konum açılır.
      var unknown = [];
      for (var i = 1; i < state.length; i++) if (!state.known[i]) unknown.push(i);
      if (unknown.length > 1) {
        var pos = unknown[Math.floor(Math.random() * unknown.length)];
        state.known[pos] = state.target[pos];
        toast('Sıra: ' + name + ' · bonus harf: ' + state.target[pos]);
        return;
      }
    }
    toast('Sıra: ' + name);
  }

  /* ---------- Kelime sonucu ---------- */
  function onWordSolved() {
    var team = state.teams[state.current];
    var points = L.wordScore(state.length, state.attempt);
    team.score += points;
    team.solved += 1;
    state.solvedBy = state.current;
    state.lastPoints = points;

    stats.wordsPlayed += 1;
    stats.wordsSolved += 1;
    stats.attempts[state.attempt - 1] += 1;
    save('lingo.stats', stats);

    bounceRow(state.rows.length - 1);
    renderScoreboard();

    if (state.mode === 'daily') {
      finishDaily(true);
      return;
    }
    toast(state.target + ' · +' + points + ' puan');
    setTimeout(startDraw, 700);
  }

  function onWordFailed() {
    stats.wordsPlayed += 1;
    save('lingo.stats', stats);
    state.phase = 'between';
    renderAll();
    if (state.mode === 'daily') { finishDaily(false); return; }
    showModal(
      '<h2>Bulunamadı</h2>' +
      '<p>Aranan kelime:</p><div class="result-word">' + state.target + '</div>' +
      '<p>Bu kelime için puan yok.</p>' +
      '<div class="btn-row"><button class="btn" id="modal-next">' + (state.wordIndex + 1 >= state.totalWords ? 'Sonucu gör' : 'Sonraki kelime') + '</button></div>'
    );
    $('modal-next').addEventListener('click', function () { closeModal(); nextWord(); });
  }

  /* ---------- Lingo kartı ve top çekme ---------- */
  function startDraw() {
    state.phase = 'draw';
    state.drawsLeft = DRAWS_PER_WORD;
    state.drawn = [];
    renderDrawPanel();
    renderCards();
  }

  function drawOne() {
    if (state.phase !== 'draw' || state.drawsLeft <= 0) return;
    var team = state.teams[state.solvedBy];
    if (!team.hopper.length) { team.hopper = L.createHopper(team.card); }
    var ball = L.drawBall(team.hopper);
    state.drawsLeft -= 1;
    state.drawn.push(ball);
    state.lastMarked = null;

    if (ball.type === 'number') {
      L.markNumber(team.card, ball.n);
      state.lastMarked = ball.n;
      checkLingo(team);
    } else if (ball.type === 'green') {
      state.drawsLeft += 1;
      toast('Yeşil top! Bir top daha çek');
    } else if (ball.type === 'red') {
      state.drawsLeft = 0;
      toast('Kırmızı top! Çekiliş bitti');
    } else if (ball.type === 'wild') {
      state.phase = 'wild';
      toast('Joker! Karttan bir sayı seç');
    }
    renderDrawPanel();
    renderCards();
  }

  function pickWild(index) {
    if (state.phase !== 'wild') return;
    var team = state.teams[state.solvedBy];
    var cell = team.card.cells[index];
    if (cell.marked) return;
    cell.marked = true;
    state.lastMarked = cell.n;
    state.phase = 'draw';
    checkLingo(team);
    renderDrawPanel();
    renderCards();
  }

  function checkLingo(team) {
    var line = L.findLingo(team.card);
    if (!line) return;
    team.score += L.LINGO_BONUS;
    team.lingos += 1;
    stats.lingos += 1;
    save('lingo.stats', stats);
    state.lingoLine = line;
    state.drawsLeft = 0;
    state.lingoJustNow = true;
    toast('LINGO! +' + L.LINGO_BONUS + ' puan');
    renderScoreboard();
  }

  function endDraw() {
    var team = state.teams[state.solvedBy];
    if (state.lingoJustNow) {
      team.card = L.createCard(team.card.parity);
      team.hopper = L.createHopper(team.card);
      state.lingoJustNow = false;
      state.lingoLine = null;
    }
    state.phase = 'between';
    $('draw-panel').classList.add('hidden');
    nextWord();
  }

  /* ---------- Günün kelimesi ---------- */
  function finishDaily(solved) {
    state.phase = 'between';
    var record = {
      date: todayKey(), done: true, solved: solved, attempt: solved ? state.attempt : null,
      rows: state.rows, target: state.target
    };
    save('lingo.daily', record);

    stats.dailyPlayed += 1;
    if (solved) stats.dailySolved += 1;
    var yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    var yKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    stats.dailyStreak = solved ? ((stats.lastDaily === yKey) ? stats.dailyStreak + 1 : 1) : 0;
    stats.lastDaily = todayKey();
    save('lingo.stats', stats);

    setTimeout(function () { showDailyResult(record); }, 600);
  }

  function restoreDaily(saved) {
    state.target = saved.target;
    state.rows = saved.rows;
    state.attempt = saved.rows.length;
    state.known = L.knownLetters(state.target, []);
    state.input = [];
    state.keyStates = {};
    saved.rows.forEach(function (r) { if (r.status === 'ok') L.mergeKeyStates(state.keyStates, r.letters.join(''), r.eval); });
    state.phase = 'between';
    renderAll();
    $('timer').style.visibility = 'hidden';
    showDailyResult(saved);
  }

  function shareText(record) {
    var lines = record.rows.map(function (r) {
      if (r.status !== 'ok') return '⬛'.repeat(state.length);
      return r.eval.map(function (s) { return s === 'correct' ? '🟥' : s === 'present' ? '🟡' : '⬜'; }).join('');
    });
    var head = 'Lingo ' + record.date + ' · ' + (record.solved ? record.attempt + '/' + MAX_ATTEMPTS : 'X/' + MAX_ATTEMPTS);
    return head + '\n' + lines.join('\n');
  }

  function showDailyResult(record) {
    var text = shareText(record);
    showModal(
      '<h2>' + (record.solved ? 'Tebrikler!' : 'Bugünlük bu kadar') + '</h2>' +
      '<p>Günün kelimesi:</p><div class="result-word">' + record.target + '</div>' +
      '<p>' + (record.solved ? record.attempt + '. denemede buldun.' : 'Yarın yeni bir kelimeyle tekrar dene.') + ' Seri: <b>' + stats.dailyStreak + '</b> gün</p>' +
      '<div class="share-box">' + text + '</div>' +
      '<div class="btn-row" style="margin-top:12px"><button class="btn" id="btn-share">Sonucu kopyala</button><button class="btn secondary" id="btn-menu">Ana menü</button></div>'
    );
    $('btn-share').addEventListener('click', function () {
      copyText(text).then(function () { toast('Panoya kopyalandı'); });
    });
    $('btn-menu').addEventListener('click', function () { closeModal(); goHome(); });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* yok say */ }
      document.body.removeChild(ta); resolve();
    });
  }

  /* ---------- Oyun sonu ---------- */
  function endGame() {
    stopTimer();
    state.phase = 'over';
    stats.gamesPlayed += 1;
    var best = Math.max.apply(null, state.teams.map(function (t) { return t.score; }));
    if (state.mode === 'solo' && best > stats.bestScore) stats.bestScore = best;
    save('lingo.stats', stats);

    var html = '<h2>Oyun bitti</h2>';
    if (state.mode === 'duo') {
      var a = state.teams[0], b = state.teams[1];
      var title = a.score === b.score ? 'Berabere!' : (a.score > b.score ? a.name : b.name) + ' kazandı!';
      html += '<p class="winner" style="font-size:20px;font-weight:800">' + title + '</p>';
    }
    html += '<div class="stat-grid">';
    state.teams.forEach(function (t) {
      html += '<div class="stat"><b>' + t.score + '</b><span>' + t.name + '</span></div>';
      html += '<div class="stat"><b>' + t.solved + '/' + state.totalWords + '</b><span>kelime</span></div>';
      html += '<div class="stat"><b>' + t.lingos + '</b><span>LINGO</span></div>';
    });
    html += '</div>';
    if (state.mode === 'solo') html += '<p>En iyi skorun: <b>' + stats.bestScore + '</b></p>';
    html += '<div class="btn-row"><button class="btn" id="btn-again">Tekrar oyna</button><button class="btn secondary" id="btn-menu">Ana menü</button></div>';
    showModal(html);
    var mode = state.mode;
    $('btn-again').addEventListener('click', function () { closeModal(); startGame(mode); });
    $('btn-menu').addEventListener('click', function () { closeModal(); goHome(); });
  }

  function goHome() {
    stopTimer();
    state = null;
    $('screen-game').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
  }

  /* ---------- Çizim ---------- */
  function renderAll() {
    renderStatus();
    renderBoard();
    renderKeyboard();
    renderScoreboard();
    renderCards();
  }

  function renderStatus() {
    var turn = $('turn-label');
    if (state.mode === 'duo') {
      var t = state.teams[state.current];
      turn.innerHTML = '<span class="team-dot" style="background:' + TEAM_COLORS[state.current] + '"></span>' + escapeHtml(t.name) + ' tahmin ediyor';
    } else if (state.mode === 'daily') {
      turn.textContent = 'Günün kelimesi · ' + todayKey();
    } else {
      turn.textContent = state.length + ' harfli kelime';
    }
    $('round-label').textContent = state.mode === 'daily' ? '' : 'Kelime ' + (state.wordIndex + 1) + ' / ' + state.totalWords;
  }

  function renderBoard(popLast) {
    var board = $('board');
    board.innerHTML = '';
    board.style.setProperty('--cols', state.length);
    var n = state.length;

    for (var r = 0; r < MAX_ATTEMPTS; r++) {
      var row = document.createElement('div');
      row.className = 'row';
      row.style.setProperty('--cols', n);
      var rec = state.rows[r];
      var isActive = (r === state.rows.length) && state.phase === 'guess';
      if (isActive) row.classList.add('active');
      var justRevealed = rec && r === state.rows.length - 1 && state.phase === 'reveal';

      for (var c = 0; c < n; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        if (rec) {
          if (rec.status === 'ok') {
            cell.textContent = rec.letters[c];
            if (justRevealed) {
              cell.classList.add('flip');
              cell.style.animationDelay = (c * 120) + 'ms';
              (function (cellEl, stateName, idx) {
                setTimeout(function () { cellEl.classList.add(stateName); }, idx * 120 + 250);
              })(cell, rec.eval[c], c);
            } else {
              cell.classList.add(rec.eval[c]);
            }
          } else {
            cell.textContent = rec.letters ? rec.letters[c] : (c === 0 ? state.target[0] : '·');
            cell.classList.add('timeout');
            cell.title = 'Süre doldu';
          }
        } else if (isActive) {
          if (c === 0) {
            cell.textContent = state.target[0];
            cell.classList.add('locked');
          } else {
            var typed = state.input[c - 1];
            if (typed) {
              cell.textContent = typed;
              cell.classList.add('typed');
              if (popLast && c - 1 === state.input.length - 1) cell.classList.add('pop');
            } else if (state.known[c]) {
              cell.textContent = state.known[c];
              cell.classList.add('hint');
            }
            if (c - 1 === state.input.length) cell.classList.add('cursor');
          }
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
  }

  function shakeRow() {
    var rows = $('board').querySelectorAll('.row');
    var row = rows[state.rows.length];
    if (!row) return;
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  function bounceRow(index) {
    var rows = $('board').querySelectorAll('.row');
    var row = rows[index];
    if (!row) return;
    Array.prototype.forEach.call(row.querySelectorAll('.cell'), function (cell, i) {
      cell.classList.remove('flip');
      cell.style.animationDelay = (i * 80) + 'ms';
      cell.classList.add('bounce');
    });
  }

  function renderKeyboard() {
    var kb = $('keyboard');
    kb.innerHTML = '';
    KEY_ROWS.forEach(function (keys) {
      var rowEl = document.createElement('div');
      rowEl.className = 'key-row';
      keys.forEach(function (k) {
        var btn = document.createElement('button');
        btn.className = 'key';
        btn.textContent = k;
        btn.dataset.key = k;
        if (k === 'ENTER' || k === 'SİL') btn.classList.add('wide');
        else if (state.keyStates[k]) btn.classList.add(state.keyStates[k]);
        btn.addEventListener('click', function () { handleKey(k); });
        rowEl.appendChild(btn);
      });
      kb.appendChild(rowEl);
    });
  }

  function renderScoreboard() {
    var sb = $('scoreboard');
    if (state.mode === 'daily') { sb.innerHTML = ''; return; }
    sb.innerHTML = state.teams.map(function (t, i) {
      var active = state.mode === 'duo' ? i === state.current : true;
      return '<div class="team' + (active ? ' active' : '') + '">' +
        '<span class="team-name"><span class="team-dot" style="background:' + TEAM_COLORS[i] + '"></span>' + escapeHtml(t.name) +
        '<span class="team-lingos">' + t.lingos + ' LINGO</span></span>' +
        '<span class="team-score">' + t.score + '</span></div>';
    }).join('');
  }

  function renderCards() {
    var panel = $('card-panel');
    if (state.mode === 'daily') { panel.innerHTML = ''; return; }
    panel.innerHTML = '';
    state.teams.forEach(function (t, ti) {
      var box = document.createElement('div');
      box.className = 'lingo-card';
      var pickable = state.phase === 'wild' && ti === state.solvedBy;
      var title = state.mode === 'duo' ? escapeHtml(t.name) : 'Lingo kartı';
      box.innerHTML = '<h3><span>' + title + '</span><span>' + (t.card.parity === 'even' ? 'çift' : 'tek') + ' sayılar</span></h3>';
      var grid = document.createElement('div');
      grid.className = 'card-grid';
      t.card.cells.forEach(function (cell, idx) {
        var el = document.createElement('div');
        el.className = 'card-cell';
        el.textContent = cell.n;
        if (cell.marked) el.classList.add('marked');
        if (state.lingoLine && ti === state.solvedBy && state.lingoLine.indexOf(idx) !== -1) el.classList.add('lingo');
        if (ti === state.solvedBy && state.lastMarked === cell.n) el.classList.add('just');
        if (pickable && !cell.marked) {
          el.classList.add('pickable');
          el.addEventListener('click', function () { pickWild(idx); });
        }
        grid.appendChild(el);
      });
      box.appendChild(grid);
      panel.appendChild(box);
    });
  }

  function renderDrawPanel() {
    var panel = $('draw-panel');
    panel.classList.remove('hidden');
    var team = state.teams[state.solvedBy];
    var html = '<h3>' + (state.mode === 'duo' ? escapeHtml(team.name) + ' top çekiyor' : 'Top çekme') + '</h3>';
    if (state.phase === 'wild') {
      html += '<p>Joker top! Kartta işaretlenecek bir sayı seç.</p>';
    } else if (state.drawsLeft > 0) {
      html += '<p>Kalan çekiliş: <b>' + state.drawsLeft + '</b>. Numaralı top kartını işaretler, yeşil top ek hak verir, kırmızı top çekilişi bitirir.</p>';
    } else if (state.lingoJustNow) {
      html += '<p><b>LINGO!</b> Yeni kart alacaksın.</p>';
    } else {
      html += '<p>Çekiliş tamamlandı.</p>';
    }
    html += '<div class="balls">' + state.drawn.map(function (b) {
      var cls = 'ball ' + b.type;
      var label = b.type === 'number' ? b.n : b.type === 'wild' ? '?' : b.type === 'green' ? '+1' : '✕';
      return '<span class="' + cls + '">' + label + '</span>';
    }).join('') + '</div>';
    html += '<div class="btn-row">';
    if (state.phase === 'draw' && state.drawsLeft > 0) {
      html += '<button class="btn" id="btn-draw">Top çek</button>';
    } else if (state.phase === 'draw') {
      html += '<button class="btn" id="btn-continue">' + (state.wordIndex + 1 >= state.totalWords ? 'Sonucu gör' : 'Sonraki kelime') + '</button>';
    }
    html += '</div>';
    panel.innerHTML = html;
    var d = $('btn-draw'); if (d) d.addEventListener('click', drawOne);
    var c = $('btn-continue'); if (c) c.addEventListener('click', endDraw);
  }

  /* ---------- Modal ---------- */
  function showModal(html) {
    $('modal-content').innerHTML = html;
    $('modal').classList.remove('hidden');
  }
  function closeModal() { $('modal').classList.add('hidden'); }
  function modalOpen() { return !$('modal').classList.contains('hidden'); }

  function showHelp() {
    showModal(
      '<h2>Nasıl oynanır?</h2>' +
      '<p>Aranan kelimenin <b>ilk harfi</b> verilir. Aynı uzunlukta, aynı harfle başlayan bir kelime yazıp ENTER\'a bas. Sözlük kontrolü yoktur; toplam <b>5 tahmin</b> hakkın var.</p>' +
      '<div class="legend">' +
      '<div class="legend-row"><div class="cell correct">K</div><span>Harf doğru ve <b>doğru yerde</b> (kırmızı kare). Sonraki satıra taşınır.</span></div>' +
      '<div class="legend-row"><div class="cell present">A</div><span>Harf kelimede var ama <b>yanlış yerde</b> (sarı daire).</span></div>' +
      '<div class="legend-row"><div class="cell absent">Z</div><span>Harf kelimede yok.</span></div>' +
      '</div>' +
      '<h3>Örnek</h3><p>Aranan kelime <b>KALEM</b>, tahmin <b>KEMAL</b>:</p>' +
      '<div class="demo-row"><div class="cell correct">K</div><div class="cell present">E</div><div class="cell present">M</div><div class="cell present">A</div><div class="cell present">L</div></div>' +
      '<h3>Süre ve puan</h3>' +
      '<ul><li>Her tahmin için süre sınırı vardır; süre dolarsa o hak yanar.</li>' +
      '<li>Puan = harf sayısı × 20 × (6 − deneme sırası). 5 harfli kelimeyi ilk denemede bulmak 500 puan.</li></ul>' +
      '<h3>Lingo kartı</h3>' +
      '<ul><li>Kelimeyi bulunca torbadan <b>2 top</b> çekersin. Numaralı top kartındaki sayıyı işaretler.</li>' +
      '<li><b>Yeşil top</b> ek çekiliş hakkı verir, <b>kırmızı top</b> çekilişi bitirir, <b>?</b> topu dilediğin sayıyı seçtirir.</li>' +
      '<li>Yatay, dikey veya çapraz 5 sayı tamamlanınca <b>LINGO!</b> +' + L.LINGO_BONUS + ' puan ve yeni kart.</li></ul>' +
      '<h3>İki takım</h3>' +
      '<ul><li>Yanlış tahmin veya süre aşımında sıra rakibe geçer' + (serverConfig.bonusLetter ? '; rakip bir <b>bonus harf</b> kazanır' : '') + '.</li>' +
      '<li>Kelimeyi bulan takım puanı alır ve kendi kartı için top çeker.</li></ul>' +
      '<h3>Klavye</h3><p>Fiziksel klavye de çalışır: harfler, ENTER ve Backspace. Türkçe Q düzeni ekranda hazırdır.</p>'
    );
  }

  function showStats() {
    var solvedPct = stats.wordsPlayed ? Math.round(100 * stats.wordsSolved / stats.wordsPlayed) : 0;
    var max = Math.max.apply(null, stats.attempts.concat([1]));
    var dist = stats.attempts.map(function (n, i) {
      var w = Math.max(8, Math.round(100 * n / max));
      return '<div class="dist-row"><span>' + (i + 1) + '</span><div class="dist-bar' + (n === max && n > 0 ? ' best' : '') + '" style="width:' + w + '%">' + n + '</div></div>';
    }).join('');
    showModal(
      '<h2>İstatistikler</h2>' +
      '<div class="stat-grid">' +
      '<div class="stat"><b>' + stats.gamesPlayed + '</b><span>oyun</span></div>' +
      '<div class="stat"><b>' + stats.wordsPlayed + '</b><span>kelime</span></div>' +
      '<div class="stat"><b>%' + solvedPct + '</b><span>başarı</span></div>' +
      '<div class="stat"><b>' + stats.bestScore + '</b><span>en iyi skor</span></div>' +
      '<div class="stat"><b>' + stats.lingos + '</b><span>LINGO</span></div>' +
      '<div class="stat"><b>' + stats.dailyStreak + '</b><span>günlük seri</span></div>' +
      '</div>' +
      '<h3>Deneme dağılımı</h3><div class="dist">' + dist + '</div>' +
      '<div class="btn-row" style="margin-top:16px"><button class="btn ghost" id="btn-reset-stats">İstatistikleri sıfırla</button></div>'
    );
    $('btn-reset-stats').addEventListener('click', function () {
      if (!confirm('Tüm istatistikler silinsin mi?')) return;
      stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
      save('lingo.stats', stats);
      showStats();
    });
  }

  function showSettings() {
    showModal(
      '<h2>Ayarlar</h2>' +
      '<div class="setting"><label>Renk teması<small>TV: kırmızı kare / sarı daire · Wordle: yeşil / sarı</small></label><select id="set-theme"><option value="tv"' + (settings.theme === 'tv' ? ' selected' : '') + '>TV (Lingo)</option><option value="wordle"' + (settings.theme === 'wordle' ? ' selected' : '') + '>Wordle</option></select></div>' +
      '<p style="margin-top:14px;color:var(--muted);font-size:13px">Harf sayısı, süre ve kelime sayısı ana menüden seçilir.</p>'
    );
    $('set-theme').addEventListener('change', function (e) {
      settings.theme = e.target.value; save('lingo.settings', settings);
      document.body.setAttribute('data-theme', settings.theme);
    });
  }

  /* ---------- Yardımcılar ---------- */
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Olaylar ---------- */
  document.addEventListener('keydown', function (e) {
    if (modalOpen()) { if (e.key === 'Escape') closeModal(); return; }
    if (!state) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); handleKey('ENTER'); return; }
    if (e.key === 'Backspace') { e.preventDefault(); handleKey('BACKSPACE'); return; }
    if (e.key.length === 1) {
      var k = L.toUpperTr(e.key);
      if (ALPHABET.indexOf(k) !== -1) { e.preventDefault(); handleKey(k); }
    }
  });

  $('btn-help').addEventListener('click', showHelp);
  $('btn-stats').addEventListener('click', showStats);
  $('btn-settings').addEventListener('click', showSettings);
  $('btn-home').addEventListener('click', function () {
    if (state && state.phase !== 'over' && state.mode !== 'daily') {
      if (!confirm('Oyundan çıkılsın mı? İlerleme kaybolur.')) return;
    }
    closeModal();
    goHome();
  });
  $('modal-close').addEventListener('click', function () {
    // Sonuç pencereleri kapatılınca akış devam etsin.
    var next = $('modal-next');
    var cont = $('btn-continue');
    closeModal();
    if (next) nextWord();
    else if (state && state.phase === 'over') goHome();
    else if (cont) { /* çekiliş paneli görünür kalır */ }
  });
  $('modal').addEventListener('click', function (e) {
    if (e.target === $('modal')) $('modal-close').click();
  });

  initStartScreen();
  loadServerWords();
  loadServerConfig();

  /** Kuralları önce sunucudan (api/settings), yoksa depodaki ayarlar.txt dosyasından okur. */
  function loadServerConfig() {
    if (location.protocol === 'file:' || typeof fetch !== 'function') return;
    fetchFirst([
      { url: 'api/settings', parse: function (t) { return L.sanitizeSettings(JSON.parse(t)); } },
      { url: 'ayarlar.txt', parse: L.parseSettingsText }
    ]).then(function (cfg) {
      if (cfg) serverConfig = Object.assign({}, serverConfig, cfg);
    });
  }

  /**
   * Kelime havuzunu sırasıyla sunucudan (api/words), depodaki kelimeler.txt dosyasından
   * (GitHub Pages) alır; ikisi de yoksa gömülü js/words.js listesi kullanılır.
   */
  function loadServerWords() {
    if (location.protocol === 'file:' || typeof fetch !== 'function') return;
    fetchFirst([
      { url: 'api/words', parse: function (t) { var d = JSON.parse(t); return { store: L.sanitizeWordStore(d.words), server: true }; } },
      { url: 'kelimeler.txt', parse: function (t) { return { store: L.parseWordsText(t), server: false }; } }
    ]).then(function (data) {
      if (!data) return;
      var store = data.store;
      var ok = [4, 5, 6, 7].every(function (n) { return store[n].length > 0; });
      if (!ok) return;
      WORDS = store;
      serverAvailable = data.server;
      var link = $('admin-link');
      if (link) {
        var total = [4, 5, 6, 7].reduce(function (a, n) { return a + store[n].length; }, 0);
        link.textContent = 'Kelime yönetimi (' + total + ' kelime)';
        link.classList.remove('hidden');
      }
    });
  }

  /** Verilen kaynaklardan ilk başarıyla okunup ayrıştırılanı döndürür; hiçbiri yoksa null. */
  function fetchFirst(sources) {
    var i = 0;
    function next() {
      if (i >= sources.length) return Promise.resolve(null);
      var src = sources[i++];
      return fetch(src.url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) return next();
        return r.text().then(function (t) {
          try { return src.parse(t); } catch (e) { return next(); }
        });
      }).catch(next);
    }
    return next();
  }

  // Otomatik testler için: yalnızca ?debug=1 ile açıldığında hedef kelimeye erişim verir.
  if (/[?&]debug=1/.test(location.search)) {
    window.__lingoDebug = {
      getState: function () { return state; },
      getSettings: function () { return settings; },
      getServerConfig: function () { return serverConfig; }
    };
  }
})();
