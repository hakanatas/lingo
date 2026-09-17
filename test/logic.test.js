'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');
const WORDS = require('../js/words.js');

test('Türkçe büyük/küçük harf dönüşümü', () => {
  assert.equal(L.toUpperTr('ilik'), 'İLİK');
  assert.equal(L.toUpperTr('ısı'), 'ISI');
  assert.equal(L.toLowerTr('İLİK'), 'ilik');
  assert.equal(L.toLowerTr('ISI'), 'ısı');
});

test('evaluateGuess: tam eşleşme', () => {
  assert.deepEqual(L.evaluateGuess('kalem', 'kalem'), ['correct', 'correct', 'correct', 'correct', 'correct']);
});

test('evaluateGuess: yanlış yerdeki harfler sarı', () => {
  // hedef KALEM, tahmin KEMAL → K doğru; E, M, A, L kelimede var ama yanlış yerde
  assert.deepEqual(L.evaluateGuess('kemal', 'kalem'), ['correct', 'present', 'present', 'present', 'present']);
});

test('evaluateGuess: tekrar eden harfler hedefteki sayıyı aşmaz', () => {
  // hedef KAZAK (K×2, A×2), tahmin KAKAK (K×3, A×2)
  // konumlar: K✓ A✓ K(present, hedefte kalan 1 K var) A✓ K✓ → 3 K hedefte tam olarak K(0) K(4) doğru, 2. K present olamaz
  assert.deepEqual(L.evaluateGuess('kakak', 'kazak'), ['correct', 'correct', 'absent', 'correct', 'correct']);
  // hedef ELMAS, tahmin EMMEK: 3. M doğru yerde, 2. M artık hedefte kalmadığı için absent
  assert.deepEqual(L.evaluateGuess('emmek', 'elmas'), ['correct', 'absent', 'correct', 'absent', 'absent']);
  // hedef KALEM, tahmin KEMEL: 4. E doğru yerde, 2. E hedefte kalmadığı için absent
  assert.deepEqual(L.evaluateGuess('kemel', 'kalem'), ['correct', 'absent', 'present', 'correct', 'present']);
});

test('evaluateGuess: Türkçe özel harfler', () => {
  // ŞEHİR'de tek E var; 4. konumdaki E artık eşleşemez
  assert.deepEqual(L.evaluateGuess('ŞEKER', 'şehir'), ['correct', 'correct', 'absent', 'absent', 'correct']);
  assert.deepEqual(L.evaluateGuess('çiçek', 'çekiç'), ['correct', 'present', 'present', 'present', 'present']);
});

test('knownLetters ilk harfi ve doğru bulunanları taşır', () => {
  assert.deepEqual(L.knownLetters('kalem', []), ['K', null, null, null, null]);
  assert.deepEqual(L.knownLetters('kalem', ['kemal', 'kalın']), ['K', 'A', 'L', null, null]);
});

test('validateGuess kuralları', () => {
  const dict = ['kalem', 'kemal', 'kalın'];
  assert.deepEqual(L.validateGuess('kemal', 'kalem', dict), { ok: true });
  assert.equal(L.validateGuess('kale', 'kalem', dict).reason, 'length');
  assert.equal(L.validateGuess('melek', 'kalem', dict).reason, 'firstLetter');
  assert.equal(L.validateGuess('kxxxx', 'kalem', dict).reason, 'dictionary');
  assert.deepEqual(L.validateGuess('kxxxx', 'kalem', dict, { checkDictionary: false }), { ok: true });
  // Hedef kelime sözlükte olmasa bile kabul edilir.
  assert.deepEqual(L.validateGuess('kalem', 'kalem', []), { ok: true });
});

test('mergeKeyStates daha iyi durumu korur', () => {
  const s = L.mergeKeyStates({}, 'kemal', L.evaluateGuess('kemal', 'kalem'));
  assert.equal(s.K, 'correct');
  assert.equal(s.E, 'present');
  L.mergeKeyStates(s, 'kalem', L.evaluateGuess('kalem', 'kalem'));
  assert.equal(s.E, 'correct');
  L.mergeKeyStates(s, 'kemal', L.evaluateGuess('kemal', 'kalem'));
  assert.equal(s.E, 'correct', 'correct durumu present ile ezilmez');
});

test('seededRandom deterministik', () => {
  const a = L.seededRandom(L.dateSeed('2026-09-17'));
  const b = L.seededRandom(L.dateSeed('2026-09-17'));
  assert.equal(a(), b());
  assert.notEqual(L.dateSeed('2026-09-17'), L.dateSeed('2026-09-18'));
});

test('createCard: 25 hücre, tek parite, 8 işaretli', () => {
  const rng = L.seededRandom(42);
  const card = L.createCard('even', rng);
  assert.equal(card.cells.length, 25);
  assert.ok(card.cells.every(c => c.n % 2 === 0));
  assert.equal(card.cells.filter(c => c.marked).length, 8);
  const odd = L.createCard('odd', rng);
  assert.ok(odd.cells.every(c => c.n % 2 === 1));
  const nums = new Set(card.cells.map(c => c.n));
  assert.equal(nums.size, 25, 'sayılar benzersiz');
});

test('createHopper: 17 sayı + 1 joker + 3 yeşil + 3 kırmızı', () => {
  const rng = L.seededRandom(7);
  const card = L.createCard('odd', rng);
  const hopper = L.createHopper(card, rng);
  assert.equal(hopper.length, 24);
  const count = t => hopper.filter(b => b.type === t).length;
  assert.equal(count('number'), 17);
  assert.equal(count('wild'), 1);
  assert.equal(count('green'), 3);
  assert.equal(count('red'), 3);
  const ball = L.drawBall(hopper);
  assert.ok(ball);
  assert.equal(hopper.length, 23);
});

test('markNumber ve findLingo', () => {
  const card = L.createCard('even', L.seededRandom(3));
  card.cells.forEach(c => { c.marked = false; });
  assert.equal(L.findLingo(card), null);
  // ilk satırı işaretle
  for (let i = 0; i < 5; i++) assert.equal(L.markNumber(card, card.cells[i].n), true);
  assert.deepEqual(L.findLingo(card), [0, 1, 2, 3, 4]);
  assert.equal(L.markNumber(card, card.cells[0].n), false, 'zaten işaretli');
  // çapraz
  card.cells.forEach(c => { c.marked = false; });
  [0, 6, 12, 18, 24].forEach(k => L.markNumber(card, card.cells[k].n));
  assert.deepEqual(L.findLingo(card), [0, 6, 12, 18, 24]);
});

test('wordScore', () => {
  assert.equal(L.wordScore(5, 1), 500);
  assert.equal(L.wordScore(5, 5), 100);
  assert.equal(L.wordScore(4, 3), 240);
  assert.equal(L.wordScore(7, 1), 700);
});

test('kelime havuzu: doğru uzunluk, benzersiz, Türk alfabesi', () => {
  const alpha = 'abcçdefgğhıijklmnoöprsştuüvyz';
  for (const len of Object.keys(WORDS)) {
    const list = WORDS[len];
    assert.ok(list.length > 50, `${len} harfli liste yeterince büyük`);
    for (const w of list) {
      assert.equal(L.chars(w).length, Number(len), `${w} ${len} harfli olmalı`);
      assert.ok(L.chars(w).every(ch => alpha.includes(ch)), `${w} yalnızca Türk alfabesi`);
    }
    assert.equal(new Set(list).size, list.length, 'tekrar yok');
  }
});

test('kelimeler.txt biçimi: ayrıştırma ve geri yazma', () => {
  const store = L.parseWordsText('# yorum\nKalem, defter\n\n## 5 harf\nkalem\nabc  # kısa\nZümrüt\n');
  assert.deepEqual(store[5], ['kalem']);
  assert.deepEqual(store[6], ['defter', 'zümrüt']);
  const text = L.wordsToText(store);
  assert.match(text, /## 5 harf \(1 kelime\)\nkalem\n/);
  assert.deepEqual(L.parseWordsText(text), store, 'gidiş-dönüş kayıpsız');
});

test('ayarlar.txt biçimi', () => {
  assert.deepEqual(L.parseSettingsText('bonus harf: evet'), { bonusLetter: true });
  assert.deepEqual(L.parseSettingsText('Bonus_Harf = Kapalı # not'), { bonusLetter: false });
  assert.deepEqual(L.parseSettingsText('bonus harf: belki\nbaşka: evet'), {});
  assert.deepEqual(L.parseSettingsText(L.settingsToText({ bonusLetter: true })), { bonusLetter: true });
  assert.match(L.settingsToText({}), /bonus harf: hayır/);
});
