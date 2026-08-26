# Okul Panosu / İkinci Ekran Modülü — Yapım Talimatı

*Göbel Şehit Nusret Kula Ortaokulu için — okul-idare-paneli projesine yeni modül olarak eklenecek.*
*Hazırlanma tarihi: 2026-08-26*

---

## 0. Bu prompt'u kim, ne zaman kullanır

Bu dosya, aşağıdaki işi **inşa etmek için** bir Claude Code oturumuna verilecek başlangıç talimatıdır. Ahmet bu talebi, o sırada `index.html` üzerinde aktif çalışan bir başka oturuma (LGS Koçluk modülünü inşa eden) devretmek istediği için bu dosyayı hazırlattı — amaç iki oturumun aynı dosyada çakışmasını önlemek. Oturum bu dosyayı okuduğunda önce mevcut `okul-idare-paneli` kod tabanını (`index.html`, şema, özellikle LGS Koçluk modülünün kurduğu desenler — `is_idareci()`, `current_teacher_id()`, davet kodu RPC deseni) incelemeli, sonra §4'teki sıraya göre inşa etmelidir.

**Önkoşul:** İnşaya başlamadan önce `index.html` üzerinde başka bir aktif değişiklik olmadığından emin ol (git durumu temiz mi, en son deploy ile local dosya eşleşiyor mu kontrol et).

## 1. Bağlam

- **Kim:** Ahmet Mustafa Yanar — Göbel Şehit Nusret Kula Ortaokulu müdürü (Susurluk/Balıkesir). Bkz. memory: `user_professional_background`.
- **Ne:** Okul koridorunda görünür bir yerde duracak **ikinci bir ekran** (TV/monitör) için içerik yönetim sistemi. Bu ekranda duyurular, bilgilendirici metinler/videolar gösterilecek, ama **asıl işlevi pekiştireçleri sergilemek** — "ayın öğrencisi", "en temiz sınıf" gibi tanınma/motivasyon içerikleri.
- **Yönetim:** Sadece müdür ve müdür yardımcısı (idareci) — LGS Koçluk'taki gibi yeni bir rol GEREKMİYOR, mevcut `is_idareci()` deseni yeterli.
- **Kalite çıtası:** `feedback_competition_grade_quality_bar` memory'sindeki genel kural burada da geçerli — "çalışıyor" seviyesi yetmez.
- **Neden yeni bir proje değil, mevcut panelin modülü:** `okul-idare-paneli` zaten multi-tenant auth + `schools`/`profiles` şeması + RLS deseni + deploy hattını çalışır durumda içeriyor.

## 2. Kullanıcının netleştirdiği gereksinimler (birebir)

- "video ve foto da yüklensin link de olur" → **hem dosya yükleme hem harici link (YouTube/Vimeo embed) desteklenmeli**, ikisi de seçenek olarak sunulmalı, biri diğerini elemez.
- "kullanışlı bir paneli olmalı" → yönetim arayüzü CRUD formundan ibaret kalmamalı — tür bazlı filtre, durum rozetleri, önizleme (thumbnail/embed önizlemesi) gibi pratik detaylar olmalı.
- "panel açılıp sekmeden yayınla dendiğinde yayınlamalı ekrandan" → içerik oluşturma ile ekranda görünme **aynı an DEĞİL**. Açık bir **taslak → yayında** durum akışı olmalı; idareci "Yayınla" demeden içerik ekranda görünmemeli.

## 3. Mimari kararlar

### 3.1 Şema (tek, birleşik tablo — rotasyon kuyruğu için pratik)

```sql
CREATE TABLE pano_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  type text not null check (type in ('duyuru', 'medya', 'pekistirec')),
  title text not null,
  body_text text,                          -- duyuru metni / pekiştireç açıklaması / medya altyazısı
  category text,                            -- pekiştireç türü: "Ayın Öğrencisi", "En Temiz Sınıf" vb. (serbest metin)
  subject_name text,                        -- pekiştireçte kişi/sınıf adı (örn. "5-A" ya da "Ahmet Yılmaz")
  period_label text,                        -- örn. "Eylül 2026"
  media_kind text check (media_kind in ('upload_image','upload_video','embed_video')),
  media_path text,                          -- Supabase Storage path (upload ise)
  media_url text,                           -- harici embed linki (YouTube/Vimeo) ise
  status text not null default 'taslak' check (status in ('taslak','yayinda')),
  display_seconds int not null default 15,  -- bu içerik ekranda kaç saniye kalacak
  sort_order int not null default 0,
  starts_on date,                           -- opsiyonel: bu tarihten önce yayında olsa bile gösterilmez
  ends_on date,                             -- opsiyonel: bu tarihten sonra otomatik gizlenir
  created_by uuid references profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);
ALTER TABLE pano_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY pano_items_idareci_all ON pano_items FOR ALL
  USING (school_id = current_school_id() AND is_idareci()) WITH CHECK (school_id = current_school_id() AND is_idareci());
```

`schools` tablosuna görüntüleme token'ı ekle:

```sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS display_token uuid;
```

### 3.2 Kimliksiz (anon) erişim — bu projede İLK KEZ

Koridor ekranı **login yapmayacak**. Şu ana kadarki her RLS deseni `auth.uid()`'e dayanıyordu — bu ekran için çalışmaz. Çözüm: LGS Koçluk'un `join_school_as_teacher(p_code)` RPC deseniyle AYNI yaklaşım — `SECURITY DEFINER` bir fonksiyon, token'ı doğrulayıp SADECE yayındaki pano içeriğini döndürür. **Ham `pano_items` tablosuna anon SELECT politikası AÇMA** — tüm erişim bu fonksiyon üzerinden akmalı, böylece tek bir denetlenebilir nokta olur:

```sql
CREATE OR REPLACE FUNCTION public.get_published_pano(p_token uuid)
RETURNS SETOF pano_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pi.* FROM pano_items pi
  JOIN schools s ON s.id = pi.school_id
  WHERE s.display_token = p_token
    AND pi.status = 'yayinda'
    AND (pi.starts_on IS NULL OR pi.starts_on <= current_date)
    AND (pi.ends_on IS NULL OR pi.ends_on >= current_date)
  ORDER BY pi.sort_order;
$$;
GRANT EXECUTE ON FUNCTION public.get_published_pano(uuid) TO anon;
```

Token'ı ilk kez üretme / yeniden üretme de idareci-only bir RPC ya da doğrudan `UPDATE schools SET display_token = gen_random_uuid() WHERE id = current_school_id()` (idareci RLS'i zaten `schools` üzerinde var, kontrol et).

### 3.3 Dosya depolama (video/foto yükleme)

Supabase Storage'da yeni bir bucket: `pano-media`.
- **Public-read AMA public-list değil** — bucket ayarında "list" kapalı, sadece bilinen path'e GET yapılabilir olmalı (path'ler zaten `pano_items.media_path` üzerinden, `get_published_pano` fonksiyonuyla dolaylı olarak açığa çıkıyor — rastgele tarama ile bulunamaz).
- Upload RLS/policy: sadece `is_idareci()` yazabilir (INSERT/UPDATE/DELETE), okuma genel.
- **Dosya boyutu sınırı koy** (öneri: görsel ≤10MB, video ≤100MB) — Supabase'in ücretsiz plan depolama kotası sınırlı, sınırsız video yüklemeye izin verme. Kullanıcıya yükleme formunda bu sınırı görünür şekilde belirt.

### 3.4 Dosya yapısı — index.html'i büyütme, AYRI bir dosya kullan

`index.html` zaten ~4000 satır ve halihazırda yoğun kullanılıyor. Görüntüleme sayfası (koridor ekranı) admin panelle **hiçbir kod paylaşmıyor** (auth yok, tamamen farklı bir sayfa) — bu yüzden:
- **Yönetim sekmesi** ("Okul Panosu"): mevcut `index.html` içine, diğer idareci modülleri (Talep Takibi, Planlama İşleri) gibi eklenir.
- **Görüntüleme sayfası**: **YENİ, ayrı bir dosya** — `pano.html` (proje kökünde, `index.html` ile aynı dizinde). Kendi küçük `<script>` bloğu, aynı Supabase client kurulum deseni (`SUPABASE_URL`/`SUPABASE_KEY` sabitleri index.html'den kopyalanabilir, bunlar zaten public anon key). URL: `pano.html?token=<uuid>`.

## 4. Yapım sırası (MVP)

1. Migration: `pano_items` + `schools.display_token` + `get_published_pano` RPC + `pano-media` storage bucket + policy'ler.
2. **Yönetim sekmesi** (index.html içinde, "Okul Panosu" dashboard kartı): tür filtreli liste (Tümü/Taslak/Yayında, ayrıca Duyuru/Medya/Pekiştireç filtresi — Talep Takibi'ndeki subtab+sayaç desenini tekrar kullan), ekleme formu (tür seçilince alanlar değişir: duyuru→başlık+metin; medya→yükleme YA DA embed link seçimi+altyazı; pekiştireç→kategori+isim/sınıf+açıklama+opsiyonel foto+dönem), liste satırlarında thumbnail/durum rozeti + **Yayınla/Geri Al** butonu + Düzenle/Sil.
3. "Görüntüleme Linki" bölümü: mevcut token'ı (yoksa oluştur) göster, kopyala butonu, "Yeniden Oluştur" (eski linki geçersiz kılar, net bir uyarıyla).
4. **`pano.html`** (yeni dosya): `?token=` parametresini oku, `get_published_pano` RPC'sini çağır, tam ekran, sırayla dönen (her öğe kendi `display_seconds` süresi kadar), her ~60 saniyede içerik listesini yeniden çeken (yeni yayınlanan/geri alınan içeriği yakalamak için) bir gösterim döngüsü. Ağır/büyük stil: büyük yazı tipi, tam ekran medya, pekiştireç öğeleri görsel olarak öne çıkarılmalı (örn. tam ekran fotoğraf + büyük başlık).
5. Canlıda uçtan uca test (LGS Koçluk'taki "test disiplini" aynen uygulanmalı — bkz. §6).

## 5. Güvenlik / gizlilik notu

Pekiştireç fotoğrafları (öğrenci fotoğrafı) **herkese açık bir URL** üzerinden erişilebilir olacak (token bilinmeden bulunamaz ama teknik olarak kimlik doğrulaması yok). Bu, KVKK açısından öğrenci fotoğrafı paylaşımı sayılabilir. **Uydurma bir hukuki teşhis yapma** — sadece bunu açıkça Ahmet'e ilet: "veli izni" konusunun okulun kendi sorumluluğunda olduğunu, sistemin bunu teknik olarak engellemediğini belirt. Kod tarafında yapılabilecek tek şey: token'ı tahmin edilemez (uuid) tutmak ve kolay yeniden üretilebilir kılmak — ki zaten §3.2'de var.

## 6. Kapsam dışı (v1'de YAPILMAYACAK)

- Gerçek zamanlı (WebSocket/Realtime) anlık güncelleme — 60 saniyelik periyodik yenileme yeterli, bir koridor ekranı için gecikme sorun değil. Realtime eklemek gereksiz karmaşıklık.
- Video transcoding/sıkıştırma — kullanıcı zaten makul boyutlu dosya yükleyecek, sınır koymak yeterli.
- Zamanlanmış (saat bazlı) otomatik yayınlama — sadece `starts_on`/`ends_on` (gün bazlı) yeterli, saat hassasiyeti gerekmiyor.
- Çoklu ekran/farklı koridor için farklı içerik — tek okulun tek görüntüleme linki yeterli, v1'de.

## 7. Test disiplini (LGS Koçluk'ta kurulan rutin, burada da uygulanmalı)

(1) migration/RLS uygula, (2) UI kodu yaz, (3) `node --check` ile JS sözdizimi doğrula, (4) `npx vercel deploy --prod --yes` ile canlıya al, (5) gerçek/kurgusal test verisiyle canlıda uçtan uca tıkla-test et — **hem yönetim sekmesini hem `pano.html`'i ayrı ayrı test et** (taslak eklenince ekranda GÖRÜNMEMELİ, yayınlanınca görünmeli — bu geçişi canlıda kanıtla), (6) test verisini temizle.

**Not:** RLS-kritik bir parça burada da var (anon erişim) — LGS'deki öğretmen-rolü testinde olduğu gibi, sadece "UI doğru görünüyor" değil, "token'sız/yanlış token ile hiçbir veri dönmüyor" da **doğrudan sorguyla kanıtlanmalı**.
