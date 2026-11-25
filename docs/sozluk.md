# Sözlük ve kelime havuzu

Oyunda iki ayrı liste vardır.

| Dosya | Ne işe yarar | Boyut |
|-------|--------------|-------|
| `kelimeler.txt` | **Cevap havuzu.** Oyunun seçtiği gizli kelimeler. Öğretmen düzenler. | 6.915 kelime |
| `sozluk/4.txt` … `sozluk/7.txt` | **Kabul edilen tahminler.** Oyuncunun yazabileceği kelimeler. | 105.543 kelime |

Bir tahmin şu durumda kabul edilir: sözlükte varsa, cevap havuzunda varsa ya da aranan kelimenin kendisiyse. Sözlükte olmayan kelime **hak yakmaz**; oyuncu yeniden dener. Denetim `ayarlar.txt` içindeki `sözlük kontrolü` satırıyla kapatılabilir.

## Sözlüğün kapsamı

Uzunluğa göre: 4 harf 3.969, 5 harf 14.273, 6 harf 29.925, 7 harf 57.376.

Sözlükte yalnızca sözlük maddeleri değil, **çekimli biçimler** de vardır: `evler`, `geldi`, `kitabı`, `okulda`, `yazdım`, `gidiyor`, `kalemi`, `koştum` gibi. Böylece oyuncu doğal yazdığında reddedilmez. Yaygın özel adlar (`ankara`, `türkiye`) tahmin olarak kabul edilir ama cevap havuzunda yer almaz.

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
