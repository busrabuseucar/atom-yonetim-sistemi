# ATOM Birim Yönetim Sistemi

Genç İHH / ATOM çalışma alanları için proje önerisi, gerekçeli değerlendirme ve revizyon takibi. React + TypeScript + Vite arayüzü, Supabase Auth ve PostgreSQL ile çalışır. Örnek kullanıcı, rol seçme menüsü veya tarayıcıda saklanan sahte proje verisi içermez.

## Çalışan kapsam

- E-posta/parola ile giriş ve çıkış; üyeliği olmayan hesaplara kurum verisi verilmez.
- Çalışma alanı bazlı `admin`, `research`, `officer`, `viewer` yetkileri.
- Proje oluşturma → değerlendirme → gerekçeli revizyon → düzenleme/yeniden gönderim → çalışma aşaması.
- PostgreSQL RLS, sütun yetkileri ve durum geçişi tetikleyicisi ile sunucu tarafında kontrol.
- Kayıt sürümü üzerinden eski ekranlardan yapılan yazmaların tespiti.
- Aynı kullanıcının oturumu yenilendiğinde çalışma alanının korunması; hesap/çalışma alanı değişiminde eski sonuçların temizlenmesi.

Bu sürüm tamamlanmış kurum yönetim ürünü değildir. Görevler, toplantılar, Notion bağlantısı, dosya yükleme, parola kurtarma, uygulama içi üyelik yönetimi ve kurumsal nihai onay iş akışı henüz yoktur.

## Kurulum

Node.js 22.12+ gerekir. CI Node 22 ve 24 üzerinde çalışır.

```bash
git clone https://github.com/busrabuseucar/atom-yonetim-sistemi.git
cd atom-yonetim-sistemi
npm ci
```

`.env.example` dosyasını `.env.local` adıyla kopyala. Örnek dosya mevcut projeye ait istemcide kullanılabilir URL ve **publishable** anahtar içerir. Kendi kurulumunda bunları kendi projenle değiştir. `service_role`/secret anahtarları hiçbir `VITE_` değişkenine yazılmaz. Uygulama yalnızca `sb_publishable_` anahtarını kabul eder; eksik/geçersiz yapılandırmada kurulum ekranını gösterir.

```bash
npm run dev
```

Terminaldeki localhost adresini aç. Bu depodaki kod değişiklikleri mevcut bir yayımlanmış frontend'i otomatik güncellemez.

## Veritabanı ve ilk erişim

`supabase/migrations/` dosyaları sırasıyla uygulanır. Mevcut bağlı proje `qjbdnuhcddqvshmejirs` / `atom-yonetim-sistemi` / `eu-west-1` olarak doğrulandı. 16 Ekim 2026'da yerel dosya sürümleri canlı migration geçmişiyle eşitlendi; revizyon migration'ı bu projeye uygulandı. Otomatik RLS yardımcı fonksiyonu bulunmayan temiz veritabanları da desteklenir; uygulama tablolarının RLS ayarları açıkça tanımlıdır.

Yeni projede önce migration'ları uygula, sonra Supabase Authentication üzerinden yetkili hesabı oluştur. Güvenilir veritabanı yöneticisi gerçek Auth UUID'sine `memberships` kaydı atar. Tarayıcı kendi rolünü veya üyeliğini belirleyemez. İlk üyelik için [kurulum adımlarına](docs/SETUP.md) bak. Açık kayıt, e-posta ve yönlendirme ayarlarını kendi ortamında kontrol et; README eski ayarların güncel kaldığını varsaymaz.

## Yetki tablosu

| İşlem | Yönetici | Ar-Ge | Birim sorumlusu | Görüntüleyici |
|---|---|---|---|---|
| Kendi çalışma alanını okuma | Evet | Evet | Evet | Evet |
| Öneri oluşturma | Evet | Hayır | Evet | Hayır |
| Gönderilmiş öneriyi değerlendirme | Evet | Evet | Hayır | Hayır |
| Revizyonu düzenleyip yeniden gönderme | Alandaki öneriler | Hayır | Yalnızca kendi önerisi | Hayır |
| Üyelik/rol değiştirme | Uygulamada yok | Hayır | Hayır | Hayır |

Değerlendirme öneri metnini değiştiremez; yeniden gönderim önceki geri bildirimi silemez. `active` durumundaki kayıt bu akıştan düzenlenemez. Son değerlendirme metni tutulur; eski değerlendirmelerin tamamını içeren bir denetim arşivi yoktur. Liste en yeni 200 kaydı gösterir; sayaçlar bu listeye aittir.

## Doğrulama

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

- PGlite testleri **bütün migration zincirini**, RLS izolasyonunu, rol yükseltme girişimini, revizyon sahipliğini, geçersiz geçişleri ve sürüm çakışmasını sınar. Testte yalnızca Supabase `auth.uid()` ortamı taklit edilir.
- Chromium testleri sahte Auth/Data API yanıtlarıyla revizyon formu, sürümlü yazma, aynı kullanıcıyla oturum yenileme, çıkış ve görüntüleyici kontrollerini sınar. Test istekleri gerçek Supabase projesine gönderilmez.
- Canlı PostgreSQL'de revizyon → yeniden gönderim → çalışma aşaması zinciri geri alınan işlem içinde doğrulandı; test verisi kalıcı bırakılmadı.
- Gerçek kullanıcıyla Supabase Auth girişinin ve cihazlar arası arayüz akışının uçtan uca doğrulaması bu çalışmada yapılmadı.

16 Ekim 2026 güvenlik advisor kontrolünde **sızdırılmış parola korumasının kapalı olduğu** uyarısı var; “tüm güvenlik kontrolleri temiz” iddiası kullanılmaz. [Supabase parola koruması açıklaması](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

[Teknik tasarım ve sınırlar](docs/TECHNICAL_DESIGN.md)

## İşletim

[İşletim ve sürüm doğrulama](docs/OPERATIONS.md) — kurulum, veri saklama, yayın, geri dönüş ve doğrulama kapsamı.
