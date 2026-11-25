# Sözlük ve kelime havuzu

Oyunda iki ayrı liste vardır.

| Dosya | Ne işe yarar | Boyut |
|-------|--------------|-------|
| `kelimeler.txt` | **Cevap havuzu.** Oyunun seçtiği gizli kelimeler. Öğretmen düzenler. | 6.915 kelime |
| `sozluk/4.txt` … `sozluk/7.txt` | **Kabul edilen tahminler.** Oyuncunun yazabileceği kelimeler. | 105.673 kelime |

Bir tahmin şu durumda kabul edilir: sözlükte varsa, cevap havuzunda varsa ya da aranan kelimenin kendisiyse. Sözlükte olmayan kelime **hak yakmaz**; oyuncu yeniden dener. Denetim `ayarlar.txt` içindeki `sözlük kontrolü` satırıyla kapatılabilir.

## Sözlüğün kapsamı

Uzunluğa göre: 4 harf 3.986, 5 harf 14.337, 6 harf 29.961, 7 harf 57.389.

Sözlükte yalnızca sözlük maddeleri değil, **çekimli biçimler** de vardır: `evler`, `geldi`, `kitabı`, `okulda`, `yazdım`, `gidiyor`, `kalemi`, `koştum` gibi. Böylece oyuncu doğal yazdığında reddedilmez. Yaygın özel adlar da tahmin olarak kabul edilir, ama cevap havuzunda yer almaz: Türkiye'nin illeri (`ankara`, `izmir`, `trabzon`), sık kullanılan kişi adları (`ahmet`, `ayşe`, `zeynep`) ve dünya yer adlarının Türkçe yazımı (`londra`, `moskova`, `kudüs`).

## Ne kadar yeterli?

Sözlük, OpenSubtitles Türkçe derlemindeki 115 milyon sözcük kullanımının **%92,4'ünü** karşılıyor. Kalan %7,6'nın neredeyse tamamı reddedilmesi gereken şeyler:

| Reddedilen | Örnek | Doğru mu? |
|------------|-------|-----------|
| Yabancı kişi adları | john, michael, charlie | Evet, Türkçe kelime değil |
| Yazım hataları | birşey, herşey, sağol, burda, yanlız | Evet, oyun yazımı da öğretiyor |
| Altyazı bozuklukları | nasıi, iütfen, güçiü | Evet, OCR hatası |
| Ek parçaları | daki, ların, nden | Evet, tek başına kelime değil |
| Engel listesi | — | Evet, bilerek |

En sık reddedilen 880 kelime elle gözden geçirildi; içlerinden yalnızca üç gerçek eksik çıktı (`hükümet`, `altyazı`, `üstad`) ve eklendi.

Sınıfta kullanılacak günlük kelimelerle yapılan sınamada (okul, aile, yiyecek, hayvan, doğa, çekimli fiiller, çoğul ve iyelik ekleri, sıfatlar, gündelik eşyalar, soyut kavramlar) **176 kelimenin 176'sı** kabul edildi.

Dosyalar uzunluğa göre ayrıdır ve oyun yalnızca oynanan uzunluğu indirir: 5 harfli bir oyun 92 KB (sıkıştırılmış 36 KB) yükler. Sözlük arka planda yüklenir; yüklenene kadar ya da dosya bulunamazsa denetim yapılmaz, oyun çalışmaya devam eder.

## Kaynaklar

Liste şu açık kaynaklı derlemelerin birleşimidir; hepsi Türk Dil Kurumu sözlüğü ve Zemberek biçimbilim kütüphanesi türevidir:

- [ncarkaci/TDKDictionaryCrawler](https://github.com/ncarkaci/TDKDictionaryCrawler) — TDK Sözlük listesi ve Zemberek ile birleştirilmiş liste (çekimli biçimlerin ana kaynağı)
- [CanNuhlar/Turkce-Kelime-Listesi](https://github.com/CanNuhlar/Turkce-Kelime-Listesi) — TDK yazım kılavuzu listesi
- [mertemin/turkish-word-list](https://github.com/mertemin/turkish-word-list)
- [bozkus24/trpuzzle5](https://github.com/bozkus24/trpuzzle5) — Türkçe kelime oyunu havuzu

Cevap havuzu seçilirken [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018 Türkçe) sıklık verisi **yalnızca sıralama ölçütü** olarak kullanıldı; o listedeki kelimeler doğrudan kopyalanmadı. Sıklık eşiği altındaki çok nadir maddeler cevap olmaz, ama tahmin olarak sözlükte kabul edilir.

LGPL lisanslı [maidis/mythes-tr](https://github.com/maidis/mythes-tr) incelendi fakat lisans karışıklığı olmasın diye nihai listeye alınmadı.

## Süzgeçler

Her kelime için: Türkçe küçük harfe çevrilir (I→ı, İ→i), 4–7 harf olmalı, yalnızca Türk alfabesi harfleri (`abcçdefgğhıijklmnoöprsştuüvyz`) içermeli, boşluk, tire ve kesme işareti içerenler atılır, tekrarlar birleştirilir.

Sınıf ortamı için küfür, hakaret ve müstehcen sözcükler hem cevap havuzundan hem sözlükten elenmiştir (yaklaşık 100 maddelik tam eşleşmeli engel listesi).

## Kelime eklemek

Cevap havuzuna kelime eklemek için `kelimeler.txt` dosyasını düzenleyin; ayrıntılar README'dedir. Sözlük dosyaları elle düzenlenmek için değildir, ama bir kelime haksız yere reddediliyorsa ilgili `sozluk/<uzunluk>.txt` dosyasına eklemek yeterlidir.
