# Dentrivo tanıtım sitesi

Yatırımcı odaklı, herkese açık tanıtım sitesi. Mevcut klinik ve yönetim panellerinden ayrı bir Next.js uygulamasıdır.

## Yerel çalışma

Depo kökünden:

```sh
npm ci
npm run site:dev
```

Site `http://127.0.0.1:3001` adresinde açılır. Üretim derlemesi için `npm run site:build`, tip denetimi için `npm run site:typecheck` kullanılır. Derlemeden sonra `npm run site:security-check` üretim sunucusunu geçici bir yerel portta açıp güvenlik başlıklarını, CSP nonce değişimini, 404 sayfasını ve yerel varlıkları doğrular.

## Güvenlik sınırı

- Site mevcut hasta/klinik API'sine bağlanmaz; form, oturum, çerez veya kullanıcı verisi toplama akışı içermez.
- Next.js üretim sürümü, istek başına değişen nonce içeren CSP kullanır. Bu nedenle ana sayfa dinamik render edilir ve HTML yanıtı `private, no-store` olarak gönderilir.
- Güvenlik başlıkları çerçeveleme, MIME türü karışıklığı ve kullanılmayan tarayıcı izinlerini sınırlar. Fontlar site üzerinden sunulur; ziyaretçi tarayıcısı Google Fonts'a bağlanmaz.
- HTTPS sertifikası, HTTP'den HTTPS'ye yönlendirme ve alan adı ayarları yayın ortamının ters vekilinde kurulmalıdır. HSTS başlığı yalnızca HTTPS bağlantısında etkili olur.
- Bağımlılık denetimi: `npm audit --omit=dev --workspace @dentpro/site`.
- CI, site derlemesini, güvenlik yanıt testini ve üretim bağımlılığı denetimini her push ve PR'da çalıştırır.

## Yayın öncesi

- İletişim adresi `bartuutar3@gmail.com` olarak tanımlıdır. İletişim bölümündeki bağlantılar ile demo ve yatırımcı CTA'ları konu başlıklı e-posta taslağı açar.
- Gerçek ekip, pilot ve yatırımcı verileri doğrulanmadan eklenmemeli.
- Örnek teklif ekranı konsept arayüz olarak etiketlenmiştir.
- Canlıya alma, alan adı, TLS ve barındırma ayarı bu ilk tasarım sürümünün dışında tutulmuştur.
