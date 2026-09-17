/* Lingo giriş tanıtımı: canlı mini örneklerle "nasıl oynanır" adımları.
 * İlk ziyarette otomatik açılır; ana menüden ve kurallar penceresinden yeniden izlenebilir.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var SEEN_KEY = 'lingo.introSeen';
  var timers = [];
  var step = 0;
  var open = false;

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Demo satırı: harfler ve durum sınıfları (null = boş). */
  function makeRow(letters, classes) {
    var row = el('div', 'row');
    row.style.setProperty('--cols', letters.length);
    letters.forEach(function (ch, i) {
      var c = el('div', 'cell' + (classes && classes[i] ? ' ' + classes[i] : ''), ch || '');
      row.appendChild(c);
    });
    return row;
  }

  /** Harfleri sırayla yazar, sonra çevirerek renkleri açar. */
  function typeThenReveal(row, letters, states, startDelay, onDone) {
    var cells = row.querySelectorAll('.cell');
    var t = startDelay || 0;
    for (var i = 1; i < letters.length; i++) {
      (function (i) {
        later(function () {
          cells[i].textContent = letters[i];
          cells[i].classList.add('typed', 'pop');
        }, t);
      })(i);
      t += 260;
    }
    t += 500;
    later(function () { row.classList.remove('active'); }, t);
    for (var j = 0; j < letters.length; j++) {
      (function (j) {
        later(function () {
          cells[j].classList.remove('typed', 'locked');
          cells[j].classList.add('flip');
          later(function () { cells[j].classList.add(states[j]); }, 250);
        }, t + j * 140);
      })(j);
    }
    if (onDone) later(onDone, t + letters.length * 140 + 500);
  }

  function legend() {
    var box = el('div', 'intro-legend');
    [['correct', 'K', 'Doğru harf, doğru yer'], ['present', 'A', 'Doğru harf, yanlış yer'], ['absent', 'Z', 'Kelimede yok']].forEach(function (x) {
      var item = el('div', 'intro-legend-item');
      item.appendChild(makeRow([x[1]], [x[0]]));
      item.appendChild(el('span', '', x[2]));
      box.appendChild(item);
    });
    return box;
  }

  /* ---------- Adımlar ---------- */
  var STEPS = [
    {
      title: 'Aranan kelimenin ilk harfi verilir',
      text: 'Her turda 4–7 harfli gizli bir kelime vardır. Sana yalnızca ilk harfi gösterilir; gerisini sen bulacaksın. Toplam 5 tahmin hakkın var.',
      demo: function (box) {
        var board = el('div', 'board');
        var row = makeRow(['K', '', '', '', ''], ['locked', null, null, null, null]);
        row.classList.add('active');
        board.appendChild(row);
        for (var i = 0; i < 2; i++) board.appendChild(makeRow(['', '', '', '', '']));
        box.appendChild(board);
        var cells = row.querySelectorAll('.cell');
        function blink() {
          cells[1].classList.toggle('cursor');
          later(blink, 600);
        }
        blink();
      }
    },
    {
      title: 'Bir kelime yaz, renkleri oku',
      text: 'Aynı harfle başlayan, aynı uzunlukta bir kelime yazıp ENTER\'a bas. Kırmızı kare: harf doğru yerde. Sarı daire: harf kelimede var ama başka yerde. Gri: kelimede yok.',
      demo: function (box) {
        var board = el('div', 'board');
        var row = makeRow(['K', '', '', '', ''], ['locked', null, null, null, null]);
        row.classList.add('active');
        board.appendChild(row);
        box.appendChild(board);
        box.appendChild(legend());
        var cap = el('div', 'intro-caption', 'Aranan kelime KALEM, tahmin KEMAL');
        box.appendChild(cap);
        // KEMAL → KALEM: K doğru; E, M, A, L kelimede var ama yanlış yerde
        typeThenReveal(row, ['K', 'E', 'M', 'A', 'L'], ['correct', 'present', 'present', 'present', 'present'], 600);
      }
    },
    {
      title: 'Bulduğun harfler bir sonraki satıra taşınır',
      text: 'Doğru yerde bulduğun harfler sonraki satırda ipucu olarak görünür. Kalanları tamamla; hepsi kırmızı olunca kelimeyi buldun demektir.',
      demo: function (box) {
        var board = el('div', 'board');
        var r1 = makeRow(['K', 'A', 'L', 'I', 'N'], ['correct', 'correct', 'correct', 'absent', 'absent']);
        var r2 = makeRow(['K', 'A', 'L', '', ''], ['locked', 'hint', 'hint', null, null]);
        r2.classList.add('active');
        board.appendChild(r1); board.appendChild(r2);
        box.appendChild(board);
        box.appendChild(el('div', 'intro-caption', 'Önceki tahmin KALIN: K, A, L yerinde. Şimdi KALEM yazılıyor…'));
        var cells = r2.querySelectorAll('.cell');
        later(function () { cells[1].classList.remove('hint'); cells[1].classList.add('typed', 'pop'); }, 900);
        later(function () { cells[2].classList.remove('hint'); cells[2].classList.add('typed', 'pop'); }, 1150);
        later(function () { cells[3].textContent = 'E'; cells[3].classList.add('typed', 'pop'); }, 1400);
        later(function () { cells[4].textContent = 'M'; cells[4].classList.add('typed', 'pop'); }, 1650);
        later(function () { r2.classList.remove('active'); }, 2300);
        for (var j = 0; j < 5; j++) {
          (function (j) {
            later(function () {
              cells[j].classList.remove('typed', 'locked');
              cells[j].classList.add('flip');
              later(function () { cells[j].classList.add('correct'); }, 250);
            }, 2300 + j * 140);
          })(j);
        }
        later(function () {
          Array.prototype.forEach.call(cells, function (c, i) { c.classList.remove('flip'); c.style.animationDelay = (i * 80) + 'ms'; c.classList.add('bounce'); });
        }, 3400);
      }
    },
    {
      title: 'Süreye dikkat',
      text: 'Her tahmin için süre sınırı vardır (ana menüden ayarlanır). Sayaç yeşilden sarıya, son saniyelerde kırmızıya döner. Süre dolarsa o tahmin hakkı yanar.',
      demo: function (box) {
        var timer = el('div', 'timer');
        var clock = el('div', 'timer-clock');
        var text = el('span', 'timer-text', '10');
        clock.appendChild(text); clock.appendChild(el('span', 'timer-unit', 'sn'));
        var track = el('div', 'timer-track');
        var bar = el('div', 'timer-bar');
        track.appendChild(bar);
        timer.appendChild(clock); timer.appendChild(track);
        box.appendChild(timer);
        var board = el('div', 'board');
        var row = makeRow(['S', '', '', '', ''], ['locked', null, null, null, null]);
        row.classList.add('active');
        board.appendChild(row);
        box.appendChild(board);
        var total = 10;
        function tick(s) {
          text.textContent = s;
          var pct = (s / total) * 100;
          bar.style.width = pct + '%';
          timer.classList.toggle('danger', s <= 5);
          timer.classList.toggle('warn', s > 5 && pct < 50);
          if (s > 0) later(function () { tick(s - 1); }, 700);
          else {
            var cells = row.querySelectorAll('.cell');
            Array.prototype.forEach.call(cells, function (c, i) { if (i) { c.textContent = '·'; c.classList.add('timeout'); } });
            box.appendChild(el('div', 'intro-caption', 'Süre doldu: bu hak yandı.'));
            later(function () { tick(total); Array.prototype.forEach.call(cells, function (c, i) { if (i) { c.textContent = ''; c.classList.remove('timeout'); } }); box.removeChild(box.lastChild); }, 2200);
          }
        }
        tick(total);
      }
    },
    {
      title: 'Kelimeyi bul, top çek, LINGO yap',
      text: 'Kelimeyi bulunca torbadan 2 top çekersin. Numaralı top kartındaki sayıyı işaretler, yeşil top bir top daha verir, kırmızı top çekilişi bitirir, "?" topu dilediğin sayıyı seçtirir. Yatay, dikey ya da çapraz 5 sayı tamamlanınca LINGO!',
      demo: function (box) {
        var card = el('div', 'lingo-card intro-card');
        var grid = el('div', 'card-grid');
        var nums = [2, 14, 26, 38, 50, 4, 16, 28, 40, 52, 6, 18, 30, 42, 54, 8, 20, 32, 44, 56, 10, 22, 34, 46, 58];
        var marked = { 2: 1, 14: 1, 38: 1, 16: 1, 42: 1, 8: 1, 56: 1, 22: 1 };
        var cells = {};
        nums.forEach(function (n) {
          var c = el('div', 'card-cell' + (marked[n] ? ' marked' : ''), n);
          cells[n] = c; grid.appendChild(c);
        });
        card.appendChild(grid);
        var balls = el('div', 'balls');
        box.appendChild(card); box.appendChild(balls);
        var cap = el('div', 'intro-caption', 'Kelime bulundu! Top çekiliyor…');
        box.appendChild(cap);
        function ball(type, label) { var b = el('span', 'ball ' + type, label); balls.appendChild(b); return b; }
        later(function () { ball('number', '26'); cells[26].classList.add('marked', 'just'); }, 900);
        later(function () { ball('green', '+1'); cap.textContent = 'Yeşil top: bir top daha!'; }, 1900);
        later(function () { ball('number', '50'); cells[50].classList.add('marked', 'just'); cap.textContent = 'İlk satır tamamlandı…'; }, 2900);
        later(function () {
          [2, 14, 26, 38, 50].forEach(function (n) { cells[n].classList.add('lingo'); });
          cap.textContent = 'LINGO! +500 puan ve yeni kart.';
        }, 3700);
      }
    },
    {
      title: 'Hazırsın!',
      text: 'Tek Oyuncu: süreye karşı kelimeleri çöz ve kart doldur. İki Takım: aynı cihazda sırayla oynayın; yanlış tahminde sıra rakibe geçer. Günün Kelimesi: herkes için aynı kelime, günde bir hak, paylaşılabilir sonuç. Fiziksel klavye de çalışır.',
      demo: function (box) {
        var grid = el('div', 'intro-modes');
        [['Mod I', 'Tek Oyuncu'], ['Mod II', 'İki Takım'], ['Mod III', 'Günün Kelimesi']].forEach(function (m, i) {
          var c = el('div', 'intro-mode');
          c.appendChild(el('span', 'mode-fig', m[0]));
          c.appendChild(el('span', 'mode-name', m[1]));
          c.style.animationDelay = (i * 150) + 'ms';
          grid.appendChild(c);
        });
        box.appendChild(grid);
      }
    }
  ];

  /* ---------- Gösterim ---------- */
  function render() {
    clearTimers();
    var s = STEPS[step];
    $('intro-title').textContent = s.title;
    $('intro-text').textContent = s.text;
    $('intro-step-label').textContent = (step + 1) + ' / ' + STEPS.length;
    var demo = $('intro-demo');
    demo.innerHTML = '';
    demo.classList.remove('intro-fade');
    void demo.offsetWidth;
    demo.classList.add('intro-fade');
    s.demo(demo);
    $('intro-prev').disabled = step === 0;
    $('intro-next').textContent = step === STEPS.length - 1 ? 'Oyna' : 'İleri';
    var dots = $('intro-dots');
    dots.innerHTML = '';
    STEPS.forEach(function (_, i) {
      var d = el('button', 'intro-dot' + (i === step ? ' active' : ''));
      d.setAttribute('aria-label', (i + 1) + '. adım');
      d.addEventListener('click', function () { step = i; render(); });
      dots.appendChild(d);
    });
  }

  function show(startStep) {
    step = startStep || 0;
    open = true;
    $('intro').classList.remove('hidden');
    render();
    $('intro-next').focus();
  }

  function hide() {
    clearTimers();
    open = false;
    $('intro').classList.add('hidden');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* yok say */ }
  }

  function next() { if (step < STEPS.length - 1) { step++; render(); } else hide(); }
  function prev() { if (step > 0) { step--; render(); } }

  $('intro-next').addEventListener('click', next);
  $('intro-prev').addEventListener('click', prev);
  $('intro-skip').addEventListener('click', hide);
  $('intro').addEventListener('click', function (e) { if (e.target === $('intro')) hide(); });
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  }, true);

  var btn = $('btn-intro');
  if (btn) btn.addEventListener('click', function () { show(0); });

  window.LingoIntro = { show: show, hide: hide, isOpen: function () { return open; } };

  var seen = false;
  try { seen = !!localStorage.getItem(SEEN_KEY); } catch (e) { seen = false; }
  if (!seen && !/[?&]intro=0/.test(location.search)) show(0);
})();
