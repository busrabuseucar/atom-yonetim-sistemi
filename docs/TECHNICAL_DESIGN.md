# Teknik tasarım

## Yetkilendirme

Supabase Auth kullanıcı kimliğini sağlar. Yetki, kullanıcı tarafından düzenlenebilen metadata'dan değil PostgreSQL `memberships` tablosundan okunur. Tüm uygulama tablolarında RLS açıktır. Kimliği doğrulanmış olmak tek başına çalışma alanına erişim sağlamaz. Kullanıcı yalnızca kendi üyeliklerini ve bu alanların kuruluş/proje kayıtlarını görebilir.

INSERT/UPDATE sütun izinleri kimlik, kuruluş, kayıt zamanı ve sürüm alanlarının istemciden yazılmasını sınırlar. `validate_project_review` SECURITY INVOKER olarak çalışır; ayrıcalık yükseltmez. Yeni içerik sütunları bütün authenticated rolüne açık olduğundan, tetikleyici her geçişte rolü, sahipliği ve hangi alanların değiştiğini yeniden denetler. Yalnızca arayüz düğmelerini gizlemek yetkilendirme sayılmaz.

## Durum ve eşzamanlılık

| Eski durum | Yeni durum | Koşul |
|---|---|---|
| Yeni kayıt | submitted | Aynı alanda admin/officer; oluşturucu auth.uid |
| submitted | revision / active | Aynı alanda admin/research; boş olmayan gerekçe; öneri metni değişmez |
| revision | submitted | Aynı alanda admin veya önerinin officer sahibi; içerikte değişiklik; geri bildirim korunur |
| active | — | Bu sürümde başka geçiş yok |

Her başarılı güncellemede tetikleyici version değerini bir artırır ve updated_at üretir. Arayüz yazmaları `id` ve okunan `version` ile filtreler; sıfır etkilenen satır başarı sayılmaz. Sürüm koşulu kullanmayan harici istemci için bu bir zorunlu API protokolü değildir; erişim ve durum denetimleri yine veritabanında uygulanır. Tam değişiklik/değerlendirme geçmişi saklanmaz.

## Arayüz yaşam döngüsü

Oturum bildirimleri aynı kullanıcıda veri alanını gereksiz temizlemez. Hesap değişiminde veri ve formlar temizlenir. Üyelikler yeni erişim belirtecinde yeniden yüklenir. Proje okumalarında istek sayacı, önceki çalışma alanına ait geç yanıtların yeni ekranı doldurmasını engeller. Yazma sırasında çalışma alanı değişimi ve yinelenen işlem engellenir; hesap/alan değişmişse eski yazmanın başarı bildirimi yeni ekrana taşınmaz.

Proje listesi en yeni 200 kaydı gösterir. İstatistikler listelenen sonuçlarla sınırlıdır; kuruluşun toplam kayıt sayısı diye sunulmaz. Gerçek zamanlı senkronizasyon, çevrimdışı yazma ve kayıt silme yoktur. Supabase istemcisi oturumu tarayıcıda saklar; proje verisi için localStorage kullanılmaz.

## Doğrulama sınırı

PGlite gerçek PostgreSQL SQL/RLS davranışını, Chromium ise taklit HTTP yanıtlarıyla arayüz akışını sınar. Bunlar gerçek Auth servisi uçtan uca testi değildir. Canlı SQL testi geçici kullanıcı/alan/proje kayıtlarını tek işlemde kurar, rol değiştirerek zinciri yürütür ve ROLLBACK ile temizler. Gerçek kullanıcılara e-posta göndermez.

Canlı PostgreSQL sürümü 17.11 olarak gözlendi. Mevcut şema ltree, btree_gist, eski pgcrypto şifreleme yöntemleri veya özel operatör kullanmaz. Güncel Supabase RLS dokümanındaki USING/WITH CHECK ve sütun yetkisi gereksinimleri dikkate alınmıştır.

Kaynak: https://supabase.com/docs/guides/database/postgres/row-level-security
