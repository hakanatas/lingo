# Lingo – Türkçe Kelime Oyunu

TRT 1'de yayınlanan **Lingo Türkiye** yarışmasının (ve Hollanda orijinalinin) kurallarıyla tarayıcıda oynanan, bağımlılıksız bir kelime oyunu. İlk harfi verilen kelimeyi 5 tahminde bul, top çek, LINGO yap.

- Saf HTML / CSS / JavaScript – derleme adımı yok, `index.html` açmak yeterli.
- Türkçe harf desteği (İ/ı, Ğ, Ş, Ç, Ö, Ü) ve ekran klavyesi; fiziksel klavye de çalışır.
- Üç mod: **Tek Oyuncu**, **İki Takım** (aynı cihazda sırayla), **Günün Kelimesi** (herkes için aynı kelime, paylaşılabilir sonuç).

## Nasıl oynanır?

1. Kelimenin **ilk harfi** verilir. Aynı uzunlukta, aynı harfle başlayan bir Türkçe kelime yazıp ENTER'a bas.
2. Her tahminden sonra harfler işaretlenir:
   - 🟥 **Kırmızı kare**: harf doğru ve doğru yerde. Bir sonraki satıra ipucu olarak taşınır.
   - 🟡 **Sarı daire**: harf kelimede var ama yanlış yerde.
   - ⬜ Gri: harf kelimede yok.
3. Toplam **5 tahmin** hakkın var. Her tahmin için süre sınırı vardır; süre dolarsa o hak yanar.
4. Kelimeyi bulunca torbadan **2 top** çekersin:
   - Numaralı top → Lingo kartındaki sayıyı işaretler.
   - Yeşil top → bir top daha çekersin.
   - Kırmızı top → çekiliş biter.
   - `?` topu → karttan istediğin sayıyı seçersin.
5. Kartta yatay, dikey veya çapraz 5 sayı tamamlanınca **LINGO!** (+500 puan ve yeni kart).

**Puan:** harf sayısı × 20 × (6 − deneme sırası). 5 harfli kelimeyi ilk denemede bulmak 500, beşinci denemede bulmak 100 puan.

**İki takım modunda** yanlış tahmin, süre aşımı veya geçersiz kelimede sıra rakibe geçer ve rakip bir **bonus harf** kazanır (TV kuralı). Kelimeyi bulan takım puanı alır ve kendi kartı için top çeker. Takımlardan biri çift, diğeri tek sayılı kart kullanır.

## Ayarlar

| Ayar | Nerede | Açıklama |
|------|--------|----------|
| Harf sayısı (4–7) | Ana menü | Yarışmadaki 4/5/6 harfli etaplar ve 7 harfli "Süper Lingo" |
| Tahmin süresi (0–60 sn) | Ana menü | 0 = süresiz |
| Kelime sayısı (3/5/10) | Ana menü | Bir oyundaki kelime sayısı |
| Sözlük kontrolü | ⚙ Ayarlar | Tahminler kelime havuzunda olmalı |
| Geçersiz kelime hak yakar | ⚙ Ayarlar | TV kuralı: sözlükte olmayan kelime bir hak götürür |
| Bonus harf | ⚙ Ayarlar | İki takım modunda sıra geçince rakibe harf açılır |
| Renk teması | ⚙ Ayarlar | TV (kırmızı kare / sarı daire) veya Wordle (yeşil / sarı) |

İstatistikler (oyun, kelime, başarı yüzdesi, deneme dağılımı, LINGO sayısı, günlük seri) tarayıcının `localStorage` alanında tutulur.

## Çalıştırma

```bash
# Doğrudan aç
open index.html

# veya yerel sunucu
npm start          # http://localhost:8080
```

GitHub Pages gibi herhangi bir statik sunucuda olduğu gibi yayınlanabilir.

## Test

```bash
npm test
```

`test/logic.test.js` çekirdek kuralları (harf değerlendirme, tekrar eden harfler, Türkçe büyük/küçük harf, kelime doğrulama, Lingo kartı ve top havuzu, puanlama) ve kelime havuzunun tutarlılığını sınar.

## Proje yapısı

```
index.html        Sayfa iskeleti (başlangıç ekranı, oyun ekranı, modal)
css/style.css     Stil, TV / Wordle temaları, duyarlı düzen
js/words.js       4–7 harfli Türkçe kelime havuzu
js/logic.js       Saf oyun mantığı (DOM'suz; Node testlerinde de kullanılır)
js/game.js        Oyun akışı, süre, sıra geçişi, kart/top çekme, arayüz
test/             Node yerleşik test çalıştırıcısı ile birim testleri
docs/arastirma.md Lingo kuralları ve örnek uygulamalar araştırma notları
```

## Kelime havuzu

`js/words.js` içindeki liste hem cevap kelimesi seçiminde hem de tahmin doğrulamada kullanılır. Yeni kelime eklemek için ilgili uzunluğun dizesine küçük harfle ekleyip `npm test` çalıştırmak yeterlidir (uzunluk ve alfabe denetimi testte yapılır). Tahminlerinizin reddedilmesini istemiyorsanız ⚙ Ayarlar'dan sözlük kontrolünü kapatabilirsiniz.

Araştırma notları ve kaynaklar için: [docs/arastirma.md](docs/arastirma.md)
