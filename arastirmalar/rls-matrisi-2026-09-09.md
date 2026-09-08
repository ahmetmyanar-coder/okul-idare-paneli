# RLS / Yetki Matrisi — 9 Eylül 2026

Yöntem: Canlı Supabase projesinde üç gerçek deneme hesabı (Okul A müdürü, Okul A'ya davet koduyla katılan öğretmen, Okul B müdürü) ve anonim rol; `SET LOCAL ROLE` + `request.jwt.claims` ile veritabanı içinde taklit edilip 51 işlem denendi. Sonuçlar RLS politikaları, tetikleyiciler ve RPC yetkileriyle veritabanı katmanında doğrulandı (istemci kodu devre dışı). Deneme hesapları ve okulları test sonrası silindi.

## Bu turda kapatılan kritik açık
`profiles_update_own` politikasında WITH CHECK yoktu; herhangi bir kullanıcı kendi profiline `role='mudur'` ve başka bir okulun `school_id`'sini yazarak o okulun tüm verisine idareci olarak erişebilirdi. Düzeltme (migration `rls_yetki_sertlestirme`):
- `profiles_protect_identity` tetikleyicisi (SECURITY INVOKER): istemci rolleri rol/okul bağlantısını yalnızca kendi kurduğu okul için ve ilk bağlanmada değiştirebilir; sonrasında kilitli (`PROFIL_KILITLI`). Davet/kayıt RPC'leri (SECURITY DEFINER) etkilenmez.
- `profiles_update_own` WITH CHECK eklendi.
- `schools_protect_owner` tetikleyicisi: `created_by` ve `invite_code` istemciden değiştirilemez; `schools_update_member` WITH CHECK eklendi.
- Koç (öğretmen) politikalarına okul kapsamı eklendi: `lgs_mock_exam_results`, `lgs_topic_errors`, `lgs_study_tasks`, `lgs_students` yazımlarında `school_id = current_school_id()`.

## Matris (A okulunun verisi üzerinde)
| Aktör | Tablo / RPC | İşlem | Beklenen | Sonuç |
|---|---|---|---|---|
| anon | monthly_tasks, teachers, lgs_students, schools, profiles, schedule_versions | SELECT | erişim yok | RED 42501 (tablo yetkisi yok) |
| anon | monthly_tasks | INSERT | RED | RED 42501 |
| anon | schools | UPDATE | RED | RED 42501 |
| anon | teachers | DELETE | RED | RED 42501 |
| anon | get_pano_meta | RPC | izin | izin |
| anon | activate_lesson_schedule | RPC | RED | RED 42501 |
| Okul A müdürü | monthly_tasks / teachers / lgs_students / schools / profiles | SELECT | 1 / 1 / 2 / 1 / 2 | 1 / 1 / 2 / 1 / 2 |
| Okul A müdürü | monthly_tasks | INSERT | izin | izin (1 satır) |
| Okul A müdürü | schools (ad) | UPDATE | 1 satır | 1 satır |
| Okul A müdürü | profiles (kendi) school_id=B | UPDATE | RED | RED PROFIL_KILITLI |
| Okul A müdürü | schools.created_by | UPDATE | RED (tetikleyici) | RED 42501 |
| Okul A müdürü | schools.enabled_modules | UPDATE | RED (tetikleyici) | RED 42501 |
| Okul A öğretmeni | monthly_tasks | SELECT | 0 | 0 |
| Okul A öğretmeni | teachers | SELECT | 1 (yalnızca kendi) | 1 |
| Okul A öğretmeni | lgs_students | SELECT | 1 (yalnızca koçlu) | 1 |
| Okul A öğretmeni | schools / profiles | SELECT | 1 / 1 (kendi) | 1 / 1 |
| Okul A öğretmeni | monthly_tasks | INSERT | RED | RED 42501 |
| Okul A öğretmeni | schools | UPDATE | 0 satır | 0 satır |
| Okul A öğretmeni | profiles (kendi) role=mudur | UPDATE | RED | RED PROFIL_KILITLI |
| Okul A öğretmeni | profiles (kendi) school_id=B | UPDATE | RED | RED PROFIL_KILITLI |
| Okul A öğretmeni | lgs_mock_exam_results (school_id=B) | INSERT | RED | RED 42501 |
| Okul A öğretmeni | lgs_students (koçlu) school_id=B | UPDATE | RED | RED 42501 |
| Okul A öğretmeni | lgs_students (koçlu) ad | UPDATE | 1 satır | 1 satır |
| Okul B müdürü | monthly_tasks / teachers / lgs_students / schools / profiles / schedule_versions (A) | SELECT | 0 | 0 |
| Okul B müdürü | monthly_tasks (A) | INSERT | RED | RED 42501 |
| Okul B müdürü | schools (A) | UPDATE | 0 satır | 0 satır |
| Okul B müdürü | schools (A).created_by | UPDATE | 0 satır | 0 satır |
| Okul B müdürü | profiles (kendi) school_id=A | UPDATE | RED | RED PROFIL_KILITLI |
| Okul B müdürü | activate_lesson_schedule (kendi okulu) | RPC | izin | izin |

Platform yöneticisi: `is_platform_admin()` sunucu tarafındaki `platform_admins` tablosuna bakar; istemci değişkenine dayanmaz. Bu turda taklit edilmedi (yalnızca gerçek hesapta mevcut).

## Envanter özeti
- 40 tabloda RLS açık; `pano_pin_attempts` ve `platform_admins` politikasız (istemciye kapalı, yalnızca SECURITY DEFINER RPC/tetikleyici yazar).
- 18 SECURITY DEFINER fonksiyonun tamamında `search_path` sabit; anon yalnızca pano RPC'lerini (`get_pano_meta`, `get_pano_school_name`, `get_published_pano`) çalıştırabilir.
- Storage: `pano-media` (herkese açık okuma — koridor ekranı için gerekli), yazma yalnızca okulun idarecisi ve okul klasörü (`okul_id/...`).
- View yok.

## Kalan notlar
- Öğretmenin kendi `teachers` satırında hassas alanlar (gebelik muafiyeti, engellilik) görünür — bölüm 4'te maskeleme/ayrı erişim ele alınacak.
- `schools_insert_own` sınırsız okul oluşturmaya izin verir (platform yöneticisi onayı olmadan); ürünleşme öncesi kayıt akışı davet koduna bağlanmalı.
