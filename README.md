# Lingo – Türkçe Kelime Oyunu

TRT 1'de yayınlanan **Lingo Türkiye** yarışmasının (ve Hollanda orijinalinin) kurallarıyla tarayıcıda oynanan, bağımlılıksız bir kelime oyunu. İlk harfi verilen kelimeyi 5 tahminde bul, top çek, LINGO yap.

- Saf HTML / CSS / JavaScript – derleme adımı yok, `index.html` açmak yeterli.
- Türkçe harf desteği (İ/ı, Ğ, Ş, Ç, Ö, Ü) ve ekran klavyesi; fiziksel klavye de çalışır.
- Üç mod: **Tek Oyuncu**, **İki Takım** (aynı cihazda sırayla), **Günün Kelimesi** (herkes için aynı kelime, paylaşılabilir sonuç).

## Nasıl oynanır?

1. Kelimenin **ilk harfi** verilir. Aynı uzunlukta, aynı harfle başlayan bir kelime yazıp ENTER'a bas. Sözlük kontrolü yapılmaz; her harf dizisi tahmin olarak kabul edilir.
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

**İki takım modunda** yanlış tahmin veya süre aşımında sıra rakibe geçer ve rakip bir **bonus harf** kazanır (TV kuralı). Kelimeyi bulan takım puanı alır ve kendi kartı için top çeker. Takımlardan biri çift, diğeri tek sayılı kart kullanır.

## Ayarlar

| Ayar | Nerede | Açıklama |
|------|--------|----------|
| Harf sayısı (4–7) | Ana menü | Yarışmadaki 4/5/6 harfli etaplar ve 7 harfli "Süper Lingo" |
| Tahmin süresi (0–60 sn) | Ana menü | 0 = süresiz |
| Kelime sayısı (3/5/10) | Ana menü | Bir oyundaki kelime sayısı |
| Bonus harf | ⚙ Ayarlar | İki takım modunda sıra geçince rakibe harf açılır |
| Renk teması | ⚙ Ayarlar | TV (kırmızı kare / sarı daire) veya Wordle (yeşil / sarı) |

İstatistikler (oyun, kelime, başarı yüzdesi, deneme dağılımı, LINGO sayısı, günlük seri) tarayıcının `localStorage` alanında tutulur.

## Çalıştırma

İki şekilde çalışır:

**1. Statik (arka uçsuz).** `index.html` dosyasını açmak ya da GitHub Pages gibi bir statik sunucuya koymak yeterlidir. Kelime havuzu `js/words.js` içindeki gömülü listeden gelir.

```bash
open index.html
# veya
npm run static     # http://localhost:8080
```

**2. Arka uçla (kelime yönetimi).** Bağımlılıksız Node.js sunucusu (`server.js`) statik dosyaları sunar, kelime havuzunu `data/words.json` dosyasında tutar ve şifre korumalı bir yönetim paneli sağlar. Oyun açılışta `api/words` uç noktasını bulursa havuzu sunucudan alır; günün kelimesini de herkes için aynı olacak şekilde sunucu belirler.

```bash
ADMIN_PASSWORD='gizli-şifre' npm start     # http://localhost:8080
# Yönetim paneli: http://localhost:8080/admin.html
```

| Ortam değişkeni | Varsayılan | Açıklama |
|-----------------|------------|----------|
| `PORT` | `8080` | Dinlenecek port |
| `ADMIN_PASSWORD` | boş | Yönetim şifresi. Boşsa panel yalnızca listeler; ekleme/silme kapalıdır. |
| `DATA_DIR` | `./data` | `words.json` ve `daily.json` klasörü. İlk çalıştırmada gömülü listeyle doldurulur. |

### Yönetim paneli (`admin.html`)

- Şifreyle giriş yapıp kelime ekleyebilir (tek tek ya da toplu yapıştırarak), silebilir, arayabilir ve havuzu JSON olarak indirebilirsiniz.
- Kelimeler otomatik olarak Türkçe küçük harfe çevrilir; 4–7 harf ve Türk alfabesi dışındakiler nedeniyle birlikte reddedilir, tekrarlar atlanır.
- Değişiklikler anında `data/words.json` dosyasına yazılır ve oyunun bir sonraki açılışında geçerli olur.

### API

| Yöntem | Yol | Yetki | Açıklama |
|--------|-----|-------|----------|
| GET | `/api/health` | – | Durum, kelime sayıları, yönetimin açık olup olmadığı |
| GET | `/api/words` | – | Tüm havuz (`?len=5` ile tek uzunluk) |
| GET | `/api/daily` | – | Günün 5 harfli kelimesi (gün boyunca sabit) |
| POST | `/api/auth` | – | `{ "password": "…" }` ile şifre doğrulama |
| POST | `/api/words` | şifre | `{ "text": "kalem, defter" }` veya `{ "words": ["kalem"] }` ile ekleme; `added / skipped / rejected` döner |
| DELETE | `/api/words/:kelime` | şifre | Kelime silme |

Yetki gerektiren isteklerde şifre `x-admin-key` başlığında (URI kodlanmış) ya da `Authorization: Bearer …` olarak gönderilir.

```bash
curl -X POST http://localhost:8080/api/words \
  -H "x-admin-key: gizli-%C5%9Fifre" -H "Content-Type: application/json" \
  -d '{"text":"zümrüt, denizci"}'
```

## Test

```bash
npm test
```

`test/logic.test.js` çekirdek kuralları (harf değerlendirme, tekrar eden harfler, Türkçe büyük/küçük harf, kelime doğrulama, Lingo kartı ve top havuzu, puanlama) ve kelime havuzunun tutarlılığını sınar. `test/server.test.js` arka ucu geçici bir veri klasörüyle ayağa kaldırıp API'yi (yetki, ekleme, silme, kalıcılık, günün kelimesi, statik dosya güvenliği) sınar.

## Proje yapısı

```
index.html        Sayfa iskeleti (başlangıç ekranı, oyun ekranı, modal)
admin.html        Kelime yönetim paneli (yalnızca server.js ile çalışır)
server.js         Bağımlılıksız Node.js arka ucu: statik dosyalar + kelime API'si
css/style.css     Stil, TV / Wordle temaları, duyarlı düzen
js/words.js       Gömülü 4–7 harfli Türkçe kelime havuzu (statik kullanım ve ilk tohumlama)
js/logic.js       Saf oyun mantığı (DOM'suz; sunucu ve Node testleri de kullanır)
js/game.js        Oyun akışı, süre, sıra geçişi, kart/top çekme, arayüz
data/             Sunucunun yazdığı words.json / daily.json (git dışı)
test/             Node yerleşik test çalıştırıcısı ile birim ve API testleri
docs/arastirma.md Lingo kuralları ve örnek uygulamalar araştırma notları
```

## Kelime havuzu

Havuz yalnızca cevap kelimesi seçiminde kullanılır; tahminler sözlükle karşılaştırılmaz. Kelime eklemenin iki yolu vardır:

- **Arka uçla:** `admin.html` panelinden ya da API ile; değişiklik `data/words.json` dosyasına yazılır.
- **Statik kullanımda:** `js/words.js` içindeki ilgili uzunluğun dizesine küçük harfle ekleyip `npm test` çalıştırın (uzunluk ve alfabe denetimi testte yapılır).


Araştırma notları ve kaynaklar için: [docs/arastirma.md](docs/arastirma.md)
