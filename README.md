# ATOM Birim Yönetim Sistemi

Gerçek Supabase Auth ve Postgres veri erişimi için React + TypeScript + Vite temeli. Önceki tarayıcı içi demo bu depoya taşınmamıştır. Proje verileri localStorage'da saklanmaz; Supabase istemcisinin oturum saklaması ayrı bir konudur. Rol seçme menüsü ve örnek kayıt yoktur.

## Durum
Derleme başarılı. PostgreSQL uyumlu PGlite ortamında RLS/yetki testleri başarılı. **Canlı Supabase projesi bağlandı (eu-west-1). Migration uygulandı. Canlı SQL üzerinde oluşturma, okuma, değerlendirme ve erişim izolasyonu testleri geri alınan işlem içinde geçti. Anon REST erişimi HTTP 401 ile engellendi. Güvenlik advisor sonucu temiz. Gerçek hesapla giriş, cihazlar arası veri kalıcılığı ve tarayıcı arayüz testi henüz yapılmadı.** Bu depo başlangıç temelidir; üretime hazır veya tamamlanmış kurumsal sistem değildir.

Hazırlananlar:
- E-posta/şifre ile gerçek Supabase Auth giriş ve çıkışı.
- Yetki kaydı olmayan hesapların çalışma alanı verilerine erişememesi.
- Kurum/il çalışma alanları ve yönetici, Ar-Ge, birim sorumlusu, görüntüleyici rolleri.
- Veritabanına proje oluşturma, listeleme ve gerekçeli Ar-Ge değerlendirmesi.
- RLS ile çalışma alanı izolasyonu, sütun bazlı yazma yetkileri ve sürüm kontrolüyle eşzamanlı güncelleme koruması.
- Supabase bağlantısı yoksa açık kurulum durumu; sahte veriyle devam edilmez.

Sıradaki işler: ilk yetkili hesabı ve açık kaydın kapatılması, test hesaplarıyla uçtan uca doğrulama; mevcut kurumsal logo tasarımının taşınması; proje revizyonunu yeniden gönderme, görevler, toplantılar, rapor ve Notion akışları. Kurumsal nihai onay yetkisi ayrıca netleştirilecek.

## Bilgisayarda çalıştırma
Node.js 22.12+ veya desteklenen güncel LTS ve Git gerekir.

```bash
git clone https://github.com/busrabuseucar/atom-yonetim-sistemi.git
cd atom-yonetim-sistemi
npm ci
```
`.env.example` dosyasını `.env.local` adıyla kopyala. Bu projeye ait URL ve tarayıcıda kullanılabilen **publishable** anahtarı örnek dosyada tanımlıdır. Secret veya service_role anahtarını hiçbir VITE değişkenine yazma.

```bash
npm run dev
```
Terminalde gösterilen localhost adresini aç. `npm run build` derleme, `npm test` veritabanı yetki testidir.

## Supabase kurulumu
Kullanıcının Free organizasyonunda atom-yonetim-sistemi oluşturuldu. Proje ref: qjbdnuhcddqvshmejirs. Ücretli plan/eklenti etkinleştirilmedi. Ankara çalışma alanı oluşturuldu; henüz kalıcı kullanıcı ve üyelik yok. Authentication ayarlarında açık kayıt halen etkin; yetkili kullanım için panelden kapatılacak. Üyeliği bulunmayan hesaplar RLS nedeniyle kurum verilerini göremez.

Migration `supabase/migrations/` altındadır. Yeni ve boş Supabase projesine uygulanmadan önce proje kimliği doğrulanır. Hesaplar Supabase Authentication yönetiminden oluşturulur. Public signup kapatılır. Giriş adresi localhost geliştirme adresiyle ayarlanır. Yetkiler, güvenilir yönetici tarafından `memberships` tablosunda atanır; kullanıcı kendi rolünü değiştiremez. Rol için kullanıcı tarafından değiştirilebilen metadata kullanılmaz.

İlk kuruluş/üyelik kaydı gerçek Auth kullanıcı UUID'siyle verilir. Gerçek UUID olmadan örnek INSERT çalıştırılmaz. Tarayıcıya yönetici veritabanı anahtarı verilmez.

## Yetki kapsamı
Aynı çalışma alanındaki yetkili hesaplar o alanın projelerini okuyabilir. `admin` ve `officer` öneri oluşturabilir; `admin` ve `research` değerlendirmeye alınmış öneriyi gerekçeyle `revision` veya `active` durumuna geçirebilir. `viewer` yalnızca okuyabilir. İlk aşamada üyelik yönetimi uygulama içinden yapılmaz. Kişinin başka bir çalışma alanına atanması veya kendi rolünü yükseltmesi engellenir. Revizyon sonrası yeniden gönderim henüz uygulanmadı.

## Doğrulama kapsamı
Testler gerçek SQL/RLS kurallarını PGlite üzerinde uygular; Supabase auth.uid fonksiyonu testte taklit edilir. Anon erişimi, üyeliği olmayan kullanıcı, başka il erişimi, kendine rol atama, yetkisiz değerlendirme, kuruluş değiştirme, boş gerekçe, sürüm çakışması ve üyelik kaldırılması kontrol edilir. Bu testler canlı Supabase Auth/Data API testlerinin yerine geçmez.
