/* Lingo Türkçe kelime havuzu.
 * Kelimeler küçük harfle yazılır; oyun bunları Türkçe (tr-TR) büyük harfe çevirir.
 * Havuz hem cevap kelimesi seçiminde hem de tahmin doğrulamasında kullanılır.
 * Kaynak: yaygın, özel isim olmayan, TDK yazımına uygun günlük Türkçe kelimeler.
 */
(function (root) {
  'use strict';

  var RAW = {
    4: 'abla acil adam adet adım adaş adil ağaç ağır ağız ahır aile akıl akın akış alan alay alet alev alın altı amaç amca anne arka arsa asıl asır aşçı aşık atak ateş atkı atlı avcı ayak ayar ayaz ayna ayrı azık azim bacı balo bant bela bere bina biri boru boya buğu burç burs büro cadı cami ceza cilt cins civa cuma çaba çakı çalı çare çark çatı çene çift dana dans dava dede defa deri ders dert deve dize dizi doğa doğu dolu dost ebat edat ekin ekip ekol eksi elma elçi emek emir erik esir eşik eşya evli ezan ezgi fare fark fıçı film fuar gaga gazi gece gemi genç gezi gıda gibi gişe hain halı halk hane harf hava hoca huni ışık ışın iade ibre içki ilaç ilan ilgi ilik ilim imza inat inci inek ipek işçi izci izin kaba kafa kalp kale kamp kapı kare karı kart kasa kaya kaza kedi keçi kent kese kısa kilo kira kişi koku kola koli konu koyu köşe öğüt örtü kule kupa kurt kuru kutu kuzu küme küre küpe lale lira lise maaş mama mana masa maşa mavi maya mayo mert meşe mide mini moda mola nane nine nota ocak odun okul olay omuz onay orak oran ordu orta otel oyun ölçü ölüm ömür örgü öykü özel özet ödül öğle para park peri pide pire plan plaj raki renk rüya saat semt sene sepi sera sıra soba soru spor süre şair şaka şans şart şiir şube taht takı tane tank tapu tava taze toka tren ucuz uçak uçuş ufuk ulus umut usta uyku uzak uzay uzun ülke ünlü ürün üzüm vade vadi vali vana vazo vefa vida yaka yalı yara yarı yasa yazı yurt zarf zeka etek eşek kuyu avlu aynı kötü ',
    5: 'abide acele açlık adres ahşap akşam alarm albüm alkış altın ambar anket araba arazi armut asker aşama aşure atlas ayran ayrık badem bahar bahçe bakan bakır balık balta bamya banka banyo baraj barış basın basit baskı başak bavul bayan bayat bayır bebek bedel belge belki beste beton beyaz beyin bıçak bilet bilgi bilim birey birim biber bitki boğaz bordo boyun bölge bölüm börek bugün bulut burun buzul bütçe bütün cadde cesur cevap ceviz cimri cümle çadır çalgı çamur çanak çanta çarşı çatal çekiç çelik çeşit çeşme çevre çıkış çiçek çilek çimen çizgi çoban çocuk çorap çorba çukur çuval dalga damar damla davet davul dayak defne değer delik demir deniz deney derin dilek dilim direk dolap dolgu domuz dosya duman durak durum duvar düğme düğün dünya dürüm düşük düzen ekmek ekran elmas emlak enkaz erkek eşarp etkin evrak evren eylem eylül ezber fakir fayda fener fırça fırın fidan fikir filiz fiyat gelin gelir genel giriş gitar giyim göbek gölge görev görüş güneş güven güzel haber hafız hafta hakem halat hamam hamur hasat hasta havuç havuz hayal hayat hayır hazır hedef helva hesap hızlı hisse hoşaf hukuk huzur ibrik iddia ihale iklim ilkel iplik irade jeton kabak kablo kaçak kadeh kadın kadro kağıt kahve kalem kalın kanal kanat kanun kapak karar karga karne kasap kasım kaşık katır kavak kavga kavun kayak kayık kayıp kazak kazan kebap kemer kemik kenar kepçe kılıç kimya kiraz kirpi kitap komşu konak konum koyun köfte köpek köprü kulak kulüp kumaş kumru kural kutup kuzey küçük lamba lehçe limon liste lokma lokum maden makas manav mantı masal mayıs mekan melek memur merak mesaj metal meyve mezar mısır midye miras misal model motor mutlu müdür mühür müzik nabız nakit nazik nefes nehir nesil nisan nokta nüfus oğlan olgun orman ortam ölçek ölçüm örnek özgür özlem paket palto pamuk parça pasta pazar pembe perde petek pilav pilot plaka polis posta radyo rakam rakip resim roman sabah sabun sahil sahne sakal sakız salça salon sanat saray satır savaş sayfa sebze seçim sefer sepet serçe sergi sevgi seyir sınav sınıf sınır silgi sivri sofra soğan soğuk sokak sorgu sorun sucuk sürgü sütun şafak şahin şapka şarap şarkı şehir şeker şerit tabak taban tabur tahta takım takip tanık tarak tarım tarih tarla tatil tavan tavuk temel tepsi terzi tokat torba torun toplu tören turşu tüfek tünel üzgün vagon vapur vatan vergi vişne yakıt yalan yanak yarış yasak yaşam yatak yavru yayın yazar yazık yemek yeşil yudum yumak yürek yüzük zaman zarar zemin şubat zurna nöbet diyet bekçi beşik bıyık akrep sinek böcek yunus marul nohut havuç taksi metro ceket yelek mimar savcı hakim korku sabır yılan geyik tilki aslan horoz hindi ördek martı tavus söğüt çınar kolye ',
    6: 'adalet akıllı atölye avukat balkon bardak bellek benzin bilgin bodrum bornoz boyacı cetvel cömert cüzdan çeyrek çıkrık çiftçi çömlek dantel defter deprem destek doktor dolmuş dükkan düşman eczane elbise emekli enerji fincan gazete göçmen gömlek halter harita hatıra hediye heykel hırsız iskele işaret kalkan kamyon kaplan kaptan kardeş karpuz kasaba kelime kibrit koltuk komedi konser kurşun kültür lastik leylek lezzet mağaza makine mantar mendil mektup meslek meydan muhtar mutfak numara oduncu otobüs pahalı patika peynir piknik pusula rüzgar sanayi sandık sigara sinema soygun sözlük şimşek şirket takvim tebrik tırnak toprak trafik turist vitrin yangın yastık yıldız yorgun zengin zeytin zincir temmuz aralık sincap zürafa leopar maymun tavşan kartal balina lahana pırasa bulgur pirinç yoğurt klavye kamera kanepe terlik kravat berber ressam oyuncu sunucu sporcu mevsim yağmur sessiz sevinç üzüntü sağlık rehber gözlük zambak orkide nergis sümbül leylak fındık fıstık timsah yengeç baykuş ceylan bakkal ',
    7: 'anahtar armağan asansör bilezik bulmaca çamaşır çekmece çerçeve domates eğlence eldiven eşofman fabrika fırtına gökyüzü ıspanak ihtiyar karınca kereste kestane kırmızı kumbara misafir öğrenci örümcek oyuncak papağan patates pencere şeftali şemsiye tebeşir tiyatro uçurtma yumurta ziyaret dilenci ağustos haziran kelebek fasulye makarna tarhana hastane telefon tramvay seyahat mahalle koridor hemşire madenci itfaiye kasırga güneşli bulutlu başkent gürültü heyecan cesaret emniyet papatya menekşe yasemin palmiye kurbağa ahtapot karides penguen kanarya öğretim '
  };

  function split(s) {
    return s.trim().split(/\s+/).filter(Boolean);
  }

  var WORDS = {};
  Object.keys(RAW).forEach(function (len) {
    var seen = {};
    WORDS[len] = split(RAW[len]).filter(function (w) {
      if (seen[w]) return false;
      seen[w] = true;
      return true;
    });
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WORDS;
  } else {
    root.LINGO_WORDS = WORDS;
  }
})(typeof window !== 'undefined' ? window : this);
