# İlk çalışma alanı ve kullanıcı kurulumu

1. Supabase projesinin kimliğini doğrula; tüm SQL migration dosyalarını sürüm sırasıyla uygula. Mevcut bağlı projede bu dosyalar zaten uygulanmıştır. Aynı ilk-kurulum SQL'ini tekrar çalıştırma.
2. Authentication yönetiminden gerçek kullanıcının hesabını oluştur. Kullanıcı UUID'sini buradan al; örnek veya tahminî UUID kullanma. E-posta gönderimi ve parola paylaşımı kurumun sürecine göre yürütülür.
3. Güvenilir SQL yöneticisiyle `organizations` tablosundaki mevcut çalışma alanını seç veya adını vererek yeni alan oluştur. Dönen gerçek `id` değerini kullan.
4. `memberships` tablosuna bu `organization_id`, Auth `user_id` ve `admin`, `research`, `officer`, `viewer` rollerinden uygun olanı ekle. Her kullanıcı/alan çifti benzersizdir. Üyelik yetkisi tarayıcı istemcisine verilmez.
5. Kullanıcı girişinden sonra doğru çalışma alanı ve rolü gördüğünü doğrula. Üyeliksiz hesabın proje göremediğini ve diğer alandaki kayıtların erişilemediğini ayrıca sına.
6. Kurum yalnızca davetli hesap kullanacaksa açık kaydı Auth ayarlarından kapat; kayıt kapatma ile mevcut hesap silmeyi karıştırma. Yayımlanan frontend için Site URL / yönlendirme adreslerini doğrula.

## Mevcut ve yeni kurulumlar

Eski depo sürümündeki iki ilk migration dosyasının zaman damgası canlı geçmişle uyuşmuyordu. Bu depodaki güncel adlar canlı `schema_migrations` kayıtlarına göre düzeltilmiştir. Başka bir veritabanına eski adlarla uygulama yaptıysan önce kendi geçmişini karşılaştır; körlemesine tekrar kurulum veya history repair çalıştırma.

Üyelik iptali yeni veritabanı okumalarını/yazmalarını engeller. Tarayıcıda daha önce okunmuş bilgiler anında uzaktan silinmez. Kullanıcı çıkışı ve ekran yenileme davranışları ayrı güvenlik sınırlarıdır. Bu sürümde gerçek zamanlı üyelik iptali bildirimi yoktur.
