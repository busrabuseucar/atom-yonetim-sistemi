# İşletim ve sürüm doğrulama — Supabase destekli proje önerisi ve revizyon

Son inceleme: **16 Ekim 2026**. Bu belge kurulum, veri akışı, sürüm kapıları, geri dönüş ve doğrulama kapsamını birlikte kaydeder. Bir yayın adresinin açılması, tüm üretim koşullarının tamamlandığı anlamına gelmez.

## Sürüm kanıtı

- Denetlenen uygulama commit’i: `f0e3bf828a4461623ae7c1bf7f9d99f903d6dc56`.
- [Bu commit için başarılı CI kaydı](https://github.com/busrabuseucar/atom-yonetim-sistemi/actions/runs/38903708979).
- Doğrulanan otomatik kapsam: 8 SQL/RLS + 2 tarayıcı testi.
- Testlerin gerçek servis, veri veya donanım yerine taklit kullandığı noktalar aşağıda açıkça ayrılmıştır.

## Kurulum ve çalışma

Depo kökünde, README’deki çalışma zamanı sürümüyle:

```sh
npm ci
npm test
npm run build
```

Veri akışı: React istemci → Supabase Auth → çalışma alanı RLS → sürümlü durum geçişleri.

Yapılandırma: İstemcide yalnızca publishable anahtar; service_role asla VITE_ içine konmaz. İlk üyelik güvenilir yönetici tarafından gerçek Auth UUID ile atanır.

## Yayın ve geri dönüş

1. Temiz checkout ve kilitli bağımlılıklarla yukarıdaki kontrolleri çalıştır. İlgili CI başarısını commit SHA ile eşleştir.
2. Yayın paketine yalnızca çalışma zamanı dosyalarını koy. Secret, ham kullanıcı verisi, yerel veritabanı ve kişisel hazırlık notları pakete girmemeli.
3. Hedef proje, kaynak commit, ortam ve yayın sürümünü kaydet. Önceki çalışan sürüm kimliğini geri dönüş için koru.
4. Yayından sonra ana kullanıcı akışını, hata durumunu ve varsa kalıcılığı doğrula. Sunucu hatası/yanlış sonuçta yeni yazmaları durdur; önceki doğrulanmış yayını geri al.
5. Şema değiştiyse yalnızca kodu geri almak yeterli değildir. Yedekten ayrı ortamda doğrulama yapmadan canlı veri üzerine yazma.

## Veri saklama ve kurtarma

PostgreSQL/Supabase yedeği ve Auth üyelikleri birlikte planlanmalı. İleri migration tercih edilir; canlı migration geçmişi değiştirilmez. Geri yükleme tatbikatı ayrı test projesinde yapılmalı.

## Gerçek servis, model ve cihaz doğrulaması

Gerçek PostgreSQL rol/geçiş zinciri rollback edilen işlemde doğrulandı. Gerçek kullanıcı Auth arayüz testi ve frontend hedefi bu yayım turunda doğrulanmadı. Sızdırılmış parola koruması için önceki advisor uyarısı açık; ücretli plan veya yapılandırma gereksinimi kontrol edilmeli.

## Yayın sonrası gözlem

Önce küçük ve sentetik girdilerle temel akışı kontrol et. Beklenmeyen hata, boş ekran, yanlış hesap, yetkisiz erişim veya veri kaybında tarih, uygulama commit’i, ortam ve yeniden üretme adımlarını kaydet; kişisel veri ve secret ekleme. Statik araçlarda tarayıcı konsolu/ağ hatalarını; backend bulunan projelerde durum kodu, gecikme ve hata oranını incele. Bu belgede sürekli izleme veya otomatik geri dönüş kurulmuş olduğu iddia edilmez.

## Kabul kaydı

Her yeni sürümün kaydı; test komutu/sonucu, kaynak SHA, yayın sürümü, gerçek servis/model sürümü, cihaz/işletim sistemi, veri kümesi özeti ve geri dönüş denemesini içermeli. Erişim veya fiziksel donanım yoksa ilgili satır **çalıştırılmadı** olarak tutulur; otomatik test başarısı yerine geçirilmez.
