# Tasarım ve işlevsellik incelemesi

Tarih: 1 Ekim 2026. Branch: `codex/design-functionality-review`.
Başlangıç: `codex/turkish-ui` üzerindeki `fed4879` commit'i.

## Yapılan iyileştirmeler

| Alan | Bulgu | Yeni davranış |
| --- | --- | --- |
| Mobil veri yükleme | 15 saniyelik otomatik yenileme, 20 saniyelik istek zaman aşımını sürekli geçersiz kılıyordu. Yavaş bağlantıda yükleme hiç bitmeyebiliyordu. | Otomatik yenilemeler devam eden isteği bekler. İşlem sonrası yenileme sıraya alınır; eski yanıt yeni veriyi ezmez. |
| Mobil bağlantı hataları | Geçici yenileme hatası, ekrandaki mevcut verileri siliyordu. | Aynı oturuma ait görünür veriler korunur ve hata gösterilir. Hesap veya kaynak değiştiğinde eski veriler gizlenir; erişim reddedildiğinde temizlenir. Bu, kalıcı çevrimdışı depolama değildir. |
| Mobil ana sayfa | Büyük tekrar eden kısayollar vaka listesini aşağı itiyordu. Arşivler aktif işlerle karışıktı. | Daha kısa bir yeni vaka alanı, taslağı önceliklendiren sonraki adım kartı, başlık araması ve Aktif / Taslak / Arşiv filtreleri eklendi. Aktif bölümü taslakları da içerir. |
| Mobil talepler | Tamamlanan ve iptal edilen talepler, mevcut taleplerle aynı listede ve benzer görünüyordu. | Aktif talepler / Geçmiş sekmeleri, durum renkleri ve belirgin randevu bilgisi eklendi. İptal onayı korunur. |
| Mobil profil | Değişiklik yapılmadan veya geçersiz bilgilerle kayıt denenebiliyor; önceki başarı mesajı yeni düzenlemelerden sonra kalıyordu. | Değişiklik ve alan doğrulaması eklendi. Yeni düzenlemeler başarı mesajını temizler; başarısız kayıtta girilen bilgiler korunur. |
| Klinik seçimi | Silinen vaka veya başarısız ilk yüklemede sürekli yükleniyor göstergesi vardı. | Yükleme, hata ve bulunamayan vaka ayrı gösterilir. Yeniden deneme ve vakalara dönüş eklendi. |
| Mobil giriş | Tekrarlanan büyük logo formu ve şifre yenileme bağlantısını aşağı itiyordu. | Başlık ve boşluklar kısaltıldı; şifre yenileme bağlantısı şifre alanının yanına taşındı. |
| Web oturumu | Geçici `/auth/me` hatası geçerli oturumu siliyordu. | Geçici bağlantı/sunucu hatasında oturum korunur ve yeniden deneme sunulur. Süresi dolan veya reddedilen oturum girişe yönlendirilir. |
| Web mobil menüsü | Kapalı menünün bağlantıları klavyeyle odaklanabiliyordu. Açık menüde odak ve kapatma davranışı eksikti. | Kapalı menü odak sırasından çıkarıldı. Açık menü odağı içinde tutar; Escape, kapatma düğmesi, odak iadesi ve kaydırma kilidi desteklenir. |
| Teklif editörü | Kapatma, arka plana tıklama veya Escape kaydedilmemiş tedavi planını kaybettirebiliyordu. | Kaydedilmemiş değişiklikler için uyarı ve sayfa yenileme uyarısı eklendi. Kayıt sırasında düzenleme ve kapatma engellenir; klavye odağı editörde kalır. |
| Arşivlenmiş vakalar | Devre dışı alanların yanında işlevsiz bir kaydet düğmesi kalıyordu. | İnceleme ve klinik içi notlar salt okunur gösterilir. |
| Web araması | Türkçe görünen isimler ile eski ASCII kayıtlar eşleşmiyordu. | `İstanbul` / `Istanbul`, `ş` / `s` ve benzeri yazımlar ile baştaki/sondaki boşluklar aramada normalleştirilir. Kayıtların kendisi değişmez. |

## Doğrulama

- Mobil: 10 test paketi, 48 test geçti. Son giriş düzenlemesinden sonra ilgili giriş/kayıt testleri ayrıca geçti.
- Mobil TypeScript ve ESLint kontrolleri geçti.
- iOS ve Android için JavaScript paketleri dışa aktarıldı.
- `node tests/e2e/panels.cjs`: klinik/yönetim akışları, taslak kaydetme, kapatma uyarısı, kayıt sırasında odak, teklif yayımlama/sürümleme, randevular ve duyarlı yerleşimler geçti.
- `node tests/e2e/workspace-usability.cjs`: geçici oturum hatası/yeniden deneme, süresi dolan oturum, Türkçe arama, mobil menü klavye davranışı ve arşivlenmiş vaka kontrolleri geçti. API yanıtları bu testte taklit edilir.
- Web TypeScript kontrolü ve üretim derlemesi geçti.
- Android emülatöründe sentetik hesapla giriş, ana sayfa, talepler, profil ve sabit alt menü görsel olarak kontrol edildi.

Gerçek veri kullanan tarayıcı akışları ve Android incelemesi ayrı bir yerel test veritabanında yürütüldü. Sonrasında standart geliştirme veritabanına dönüldü.

## Sınırlar

Bu çalışma iOS cihazında çalışma zamanı doğrulaması, App Store/Play Store dağıtımı veya canlı e-posta, Google Maps ve AI servislerinin uçtan uca doğrulaması değildir. iOS JavaScript çıktısı üretildi; imzalı yerel derleme ve gerçek cihaz davranışı ayrıca doğrulanmalıdır.
