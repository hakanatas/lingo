# Lingo araştırma notları

Bu belge, oyunu geliştirmeden önce Lingo'nun TV formatı, mevcut web uygulamaları ve açık kaynak kodlar hakkında yapılan araştırmanın özetidir. Tasarım kararları buradaki bulgulara dayanır.

## 1. Lingo nedir?

Lingo, 1987'de ABD'de başlayan, en uzun soluklu sürümü Hollanda'da (1989–2014, 2019–) yayınlanan bir kelime yarışmasıdır. Türkiye'de **Lingo Türkiye** adıyla TRT 1'de yayınlanmaktadır (sunucu: Kemal Uçar). Wordle'dan yıllar önce "ilk harfi verilen kelimeyi sınırlı tahminle bulma" mekaniğini popülerleştirmiştir.

### Temel kurallar (Hollanda / TV formatı)

- Takıma aranan kelimenin **ilk harfi** verilir; kelimeyi söylemek için kısa bir süre (Hollanda'da 8 sn) tanınır.
- Tahmin, doğru uzunlukta, verilen harfle başlayan, doğru yazılmış gerçek bir kelime olmalıdır; aksi halde hak yanar ve sıra rakibe geçer.
- En fazla **5 tahmin** hakkı vardır.
- Geri bildirim: doğru yerdeki harf **kırmızı** (kare), kelimede olup yanlış yerdeki harf **sarı daire** içinde gösterilir. Doğru bulunan harfler sonraki satıra taşınır.
- Yanlış tahminde sıra rakibe geçer; rakip ayrıca bir **bonus harf** alır.
- Kelime bulununca takım top havuzundan **2 top** çeker. Havuz: 17 mavi numaralı top + 1 "?" jokeri + 3 yeşil + 3 kırmızı (toplam 24).
  - Numaralı top → **Lingo kartındaki** (5×5, 25 sayı, 8'i baştan işaretli; bir takım çift, diğeri tek sayılar) sayıyı işaretler.
  - "?" → istenen sayı işaretlenir.
  - Yeşil top → bir top daha çekilir.
  - Kırmızı top → çekiliş biter, sıra rakibe geçer.
  - Yatay/dikey/çapraz 5 sayı tamamlanınca **LINGO** ve bonus; yeni kart verilir.

### Lingo Türkiye (TRT 1) formatı

- 2'şer kişilik 3 takım. Sunucu ilk harfi verir; takımlar 5 tahmin hakkı içinde kelimeyi bulmaya çalışır. Doğru yerde doğru harf söylenirse harf açılır ve sıra diğer takıma geçer.
- **1. etap:** 4 harfli kelimeler, kasada ödül biriktirilir.
- **2. etap:** 5 harfli kelimeler; en az ödül biriktiren takım elenir.
- **3. etap (düello):** iki takım, 4 ve 5 harfli turlar.
- **Final:** 4, 5 ve 6 harfli kelimelerle kasanın yarısı/tamamı/iki katı; 7 harfli **"Süper Lingo"** kelimesi tek başına büyük ödül (150.000–200.000 TL).

## 2. Mevcut web uygulamaları

| Site | Öne çıkanlar |
|------|--------------|
| kelimeyle.com | Ücretsiz, kayıtsız, mobil uyumlu. İlk harf verilir; yeşil/sarı/gri renkler (Wordle tarzı). Puan = harf sayısı × 15 + 200 / deneme süresi (sn); her denemede puan 1/7 azalır; ipucu puanı yarıya indirir. Modlar: günlük tek hak + liderlik tablosu, süresiz pratik (4–7 harf), arkadaşla aynı kelimede yarışmak için kod. |
| danyelkoca.com/tr/works/lingo | "Türkiye'nin en popüler ücretsiz online Lingo"; puan ve liderlik tablosu; yeşil/turuncu/gri renkler. |
| tpc.net.tr/wordle-tr | Wordle TR / Lingo Türkiye internet sürümü. |
| twowaymedia lingo-tr (mobil) | Süre 1–99 sn, 4–8 harf ayarı, 3–7 harfli kelime, 5 deneme. |
| lingoturkiyeoyunu.xyz | "Kelime düellosu" temalı Türkçe sürüm. |

**Çıkarım:** Web sürümlerinin tamamı Wordle renk dilini kullanıyor; TV'nin kırmızı kare / sarı daire gösterimi ve Lingo kartı çoğunda yok. Bu projede TV gösterimi varsayılan, Wordle renkleri seçenek olarak sunuldu; Lingo kartı ve top çekme uygulandı.

## 3. Açık kaynak kodlar

| Depo | Notlar |
|------|--------|
| ermst4r/Javascript-Lingo | jQuery ile tek dosyalık Lingo; tahta, süre ve harf kontrolü. |
| Arvidvdc/lingo | Vanilla JS/HTML/CSS; akıllı telefonda oynanabilir, 1–2 oyuncu, sayı kartları. |
| gino/lingo-js | JavaScript Lingo. |
| necdetoskay/lingo | Türkçe, mobil öncelikli çok oyunculu Lingo tasarımı (tasarım aşamasında). |
| bozkus24/trpuzzle5 | Günlük 5 harfli Türkçe kelime oyunu; TDK'dan derlenmiş `cevaplar.txt` (2788) ve `kelimehavuzu.txt` (5585) listeleri. |
| caglarorhan/turkcewordle | Türkçe Wordle; çok dilli. |
| CanNuhlar/Turkce-Kelime-Listesi, ncarkaci/TDKDictionaryCrawler | TDK'dan derlenmiş ~76.000 kelimelik listeler (harfe göre dosyalar). |
| fullstack-nick/Wordle, freeCodeCamp Wordle clone | Vanilla JS Wordle klonları: ekran klavyesi + fiziksel klavye, kutu çevirme animasyonu, iki geçişli harf değerlendirme. |
| haf-decent/lingo | Kullanıcının işaret ettiği depo; bu ortamdan erişilemediği için incelenemedi. |

**Kod tarafında ortak desenler:**

- Harf değerlendirmesi **iki geçişle** yapılır: önce tam eşleşmeler, sonra kalan harf sayısına göre "yanlış yerde" işaretleri (tekrar eden harflerin doğru sayılması için).
- Tahta DOM'da satır/hücre olarak üretilir; hücrelere durum sınıfı verilir; açılış animasyonu için satırdaki hücreler gecikmeli çevrilir.
- Klavye durumu "correct > present > absent" öncelik sırasıyla birleştirilir.
- Günlük kelime için tarihten türetilen tohumla deterministik seçim.
- Türkçe için `toLocaleUpperCase('tr-TR')` kullanmak zorunludur (i → İ, ı → I).

## 4. Bu projede alınan kararlar

- **Kurallar:** ilk harf verilir, 5 tahmin, tahmin başına süre, kırmızı kare / sarı daire, bulunan harfler sonraki satıra taşınır, iki takımda sıra geçişi + bonus harf, 24 toplu havuz ve 25 sayılı kart, LINGO bonusu.
- **Kelime havuzu:** Dış listeler ağ kısıtı nedeniyle indirilemediği için 4–7 harfli, özel isim içermeyen, yaygın Türkçe kelimelerden oluşan bir havuz projeye gömüldü. Havuz yalnızca cevap seçiminde kullanılır; tahminlerde sözlük kontrolü yapılmaz.
- **Teknoloji:** Bağımlılık yok; saf HTML/CSS/JS. Çekirdek mantık `js/logic.js` içinde DOM'suz tutuldu ve Node ile test edildi.
- **Puanlama:** TV'deki para ödülü yerine basit, açıklanabilir bir puan: harf sayısı × 20 × (6 − deneme). LINGO +500.

## Kaynaklar

- TRT 1 – Lingo Türkiye program sayfası: https://www.trt1.com.tr/programlar/lingo-turkiye
- TRT 1 – Lingo Türkiye 3. sezon haberi: https://www.trt1.com.tr/haber/programlar/lingo-turkiye-3-sezonuyla-geri-donuyor-27623272
- Lingo Türkiye resmi site: https://www.lingoturkiye.com.tr/
- Ekşi Sözlük – lingo türkiye: https://eksisozluk.com/lingo-turkiye--7738376
- Yeni Birlik – Lingo Türkiye ödülü ve format: https://www.gazetebirlik.com/tv/lingo-turkiye-odulu-ne-kadar-buyuk-odul-para-miktari-sunucusu-ve-basvuru-sartlari-hakkinda-merak-edilenler/931091
- Wikipedia – Lingo (Dutch game show): https://en.wikipedia.org/wiki/Lingo_(Dutch_game_show)
- Wikipedia – Lingo (American game show): https://en.wikipedia.org/wiki/Lingo_(American_game_show)
- Game Shows Wiki – Lingo: https://gameshows.fandom.com/wiki/Lingo
- UK Gameshows Wiki – Lingo: https://ukgameshows.fandom.com/wiki/Lingo
- Kelimeyle – Lingo oyna: https://www.kelimeyle.com/
- Danyel Koca – Lingo: https://www.danyelkoca.com/tr/works/lingo
- Wordle TR – Lingo Türkiye: https://tpc.net.tr/wordle-tr/
- Two Way Media – Lingo TR yardım: http://www.twowaymedia.co.uk/lingo-tr
- Lingo Türkiye Oyunu – Kelime Düellosu: https://lingoturkiyeoyunu.xyz/
- GitHub – ermst4r/Javascript-Lingo: https://github.com/ermst4r/Javascript-Lingo
- GitHub – Arvidvdc/lingo: https://github.com/Arvidvdc/lingo
- GitHub – gino/lingo-js: https://github.com/gino/lingo-js
- GitHub – necdetoskay/lingo: https://github.com/necdetoskay/lingo
- GitHub – bozkus24/trpuzzle5: https://github.com/bozkus24/trpuzzle5
- GitHub – caglarorhan/turkcewordle: https://github.com/caglarorhan/turkcewordle
- GitHub – CanNuhlar/Turkce-Kelime-Listesi: https://github.com/CanNuhlar/Turkce-Kelime-Listesi
- GitHub – ncarkaci/TDKDictionaryCrawler: https://github.com/ncarkaci/TDKDictionaryCrawler
- GitHub – fullstack-nick/Wordle: https://github.com/fullstack-nick/Wordle
- freeCodeCamp – Build a Wordle clone in JavaScript: https://www.freecodecamp.org/news/build-a-wordle-clone-in-javascript/
- GitHub – haf-decent/lingo (erişilemedi): https://github.com/haf-decent/lingo
