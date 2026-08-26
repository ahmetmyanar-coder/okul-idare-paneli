# LGS Koçluk & Takip Modülü — Yapım Talimatı

*Göbel Şehit Nusret Kula Ortaokulu, 8. sınıflar için — okul-idare-paneli projesine yeni modül olarak eklenecek.*
*Hazırlanma tarihi: 2026-08-25*

---

## 0. Bu prompt'u kim, ne zaman kullanır

Bu dosya, aşağıdaki işi **inşa etmek için** bir Claude Code oturumuna verilecek başlangıç talimatıdır. Ahmet henüz "başla" demedi — bu, işe girişmeden önce kapsamı netleştirmek için hazırlanan spesifikasyon. Oturum bu dosyayı okuduğunda önce mevcut `okul-idare-paneli` kod tabanını (`index.html`, şema) incelemeli, sonra §5'teki sıraya göre inşa etmelidir.

## 1. Bağlam

- **Kim:** Ahmet Mustafa Yanar — 2026-08-25 itibarıyla **Göbel Şehit Nusret Kula Ortaokulu müdürü** (Susurluk/Balıkesir). Bkz. memory: `user_professional_background`, `user_manager_assignment_plans`.
- **Ne:** Okulun 8. sınıflarına yönelik LGS koçluk sürecini dijital olarak takip eden bir sistem.
- **Kalite çıtası:** `feedback_competition_grade_quality_bar` memory'sindeki genel kural burada da geçerli — "çalışıyor" seviyesi yetmez, alanın en iyi bilinen tekniklerine göre kurulmalı (özellikle §6'daki analiz algoritmalarında).
- **Neden yeni bir proje değil, mevcut panelin modülü:** `okul-idare-paneli` (Supabase proje `kwowxdunvwsxwghbdmdk`, Vercel `okul-idare-paneli.vercel.app`) zaten çok-kiracılı (multi-tenant) auth + `schools`/`profiles` şeması + RLS deseni + deploy hattını (`npx vercel deploy --prod --yes`) çalışır durumda içeriyor. Bunu tekrar kurmak zaman kaybı. Ayrıca projenin kendi yol haritasında (`kapsam.html`, Faz 3) zaten "öğretmen araçları" var — bu modül o faza doğal olarak oturuyor. **Bu bir öneridir, tartışılabilir** — ama aksi bir sebep yoksa bu yönde ilerle.

## 2. Piyasa araştırmasından süzülen özellikler

2026-08-25'te yapılan LGS koçluk platformları taramasından (bkz. daha önceki oturumdaki artifact: "Kurumsal LGS Platformları") süzülen, gerçekten değer katan kalıplar:

| Kaynak | Alınacak fikir | Alınmayacak kısım |
|---|---|---|
| **Kunduz Etki Programı** | Kurum/şube/öğrenci bazlı performans paneli; WhatsApp üzerinden veliye otomatik bildirim | Soru bankası/video içeriği — telif riski, **yapılmayacak** |
| **CampX** | Koç onay iş akışı, toplu ödev atama, eksik konu otomatik tespiti, rozet/sertifika ile motivasyon | Kelime kutusu (İngilizce flashcard) — kapsam dışı |
| **YZ Takip** | Deneme sonucunu toplu/hızlı girip anında sınıf raporu üretme fikri | Optik form OCR — Faz 2'ye bırakılabilir, MVP'de manuel/CSV yeterli |
| **EBA** | Zaten okul çapında hazır kullanıcı tabanı fikri (herkesin hesabı var) | Doğrudan entegrasyon yok — ilham amaçlı |

**Kırmızı çizgi:** Üçüncü taraf soru bankası, video veya telifli içerik **hiçbir şekilde** kopyalanmayacak/entegre edilmeyecek. Bu modül sadece **takip, analiz ve koçluk iş akışı** sağlar — içerik üretmez. (Bkz. okul-idare-paneli'ndeki Teftişe Hazırlık modülünde uygulanan "uydurma/kopyalama yok" ilkesiyle aynı disiplin.)

## 3. Kullanıcı rolleri ve arayüz ilkesi

Ahmet'in isteği: **"arayüzü herkesin basit şekilde kullanabileceği"** — bu, dört farklı rolün dördü için de geçerli olmalı:

- **Müdür (Ahmet):** Okul geneli özet — hangi şube/öğrenci risk altında, hedef/gerçekleşen karşılaştırması. Tek bakışta anlaşılır olmalı, detaya inmek istemeyen bir yönetici için.
- **Koç öğretmen(ler):** Kendi öğrenci grubunu yönetir — deneme sonucu girer, haftalık görev atar, öğrenci girişlerini onaylar.
- **Öğrenci:** Kendi karnesini görür, günlük çalışma kaydını girer. **Sürtünme minimum** olmalı — 13-14 yaşındaki bir öğrenci 30 saniyede doldurabilmeli (dropdown/checkbox ağırlıklı, uzun serbest metin yok).
- **Veli:** Salt okunur ilerleme özeti. Ayrı bir hesap/şifre yönetimi külfeti olmadan, mümkünse `wa.me` link deseniyle (okul-idare-paneli'nin nöbet modülündeki WhatsApp bildirim tekniğiyle aynı) ulaşmalı.

Tasarım kuralı: **mobil öncelikli.** Veli ve çoğu öğrenci telefondan bakacak.

## 4. Çekirdek kavram: kazanım bazlı eksik analizi

Bu modülün asıl farkı, düz "kim kaç net yaptı" listesi değil — **hangi öğrencinin hangi konuda gerçekten eksiği var** sorusuna cevap vermesi (CampX'in "eksik konu tespiti" fikrinin kendi versiyonu, ama daha sağlam):

- Ders × konu/kazanım matrisi (MEB LGS kazanım çerçevesine göre — **kazanım listesini uydurma, gerçek MEB kaynağından doğrula**, `user_legislation_research_approach` metodolojisiyle).
- Her deneme sonucu bu matrise işlenir (konu bazlı doğru/yanlış/boş, tam net değil).
- Zayıflık skoru **naif "en düşük net" sıralaması olmamalı** — son N denemenin trendini + konunun LGS'deki ağırlığını (kaç soru geliyor) birlikte hesaba katan bir skor olmalı.
- Çıktı: her öğrenci için "öncelikli çalışılması gereken 3-5 konu" listesi, otomatik üretilir.

## 5. MVP modül sırası (önerilen)

1. **Öğrenci Havuzu & Şube Yönetimi** — 8. sınıf öğrenci listesi, şube, koç ataması.
2. **Deneme Sınavı Takibi** — ders bazlı net girişi (manuel + CSV/toplu yapıştırma), zaman içi trend grafiği, LGS yüzdelik dilim/hedef puan karşılaştırması (gerçek MEB/ÖSYM kaynağına dayalı, uydurulmamış).
3. **Kazanım Bazlı Eksik Analizi** — §4'teki motor.
4. **Haftalık Çalışma Programı & Onay Akışı** — koç atar → öğrenci/veli işaretler → koç onaylar (CampX deseni).
5. **Veli Bilgilendirme** — `wa.me` linkiyle haftalık otomatik özet (nöbet modülündeki `waPhone()`/`waLink()` fonksiyonları yeniden kullanılabilir).
6. **Müdür Özet Paneli** — okul geneli risk haritası, hedef/gerçekleşen.

Her modül, okul-idare-paneli'nin şu ana kadar kanıtlanmış disipliniyle inşa edilmeli: migration → RLS → UI → **canlıda uçtan uca test** → bug varsa düzelt → bir sonrakine geç. Yarım bırakılmış/test edilmemiş modül teslim edilmiş sayılmaz.

## 6. Teknik ve veri gereksinimleri

- Aynı Supabase projesi ve `schools`/`profiles` tablolarını kullan; yeni tablolar `lgs_` önekiyle (ör. `lgs_students`, `lgs_mock_exam_results`, `lgs_topic_mastery`, `lgs_study_tasks`).
- RLS: öğrenci sadece kendi verisini, veli sadece kendi çocuğununkini, koç sadece kendi grubunu, müdür okul genelini görebilmeli — bu, önceki modüllerdeki multi-tenant izolasyon testinin (yeni okulun verisi başka okula sızmadı) aynısı, rol bazına indirgenmiş hali.
- Akademik performans verisi, Personel İşleri modülünün aksine (orada "sunucuya hiç gitmesin" ilkesi vardı) **sunucuda tutulmalı** — çünkü koç/müdürün görebilmesi amacın kendisi. Ama KVKK hassasiyetiyle RLS sıkı olmalı.
- Deploy: mevcut `npx vercel link` + `npx vercel deploy --prod --yes` hattı.

## 7. Kapsam dışı (bilinçli, bu turda yapılmayacak)

- Üçüncü taraf soru bankası/video entegrasyonu (telif riski — bkz. §2).
- Gerçek WhatsApp Business API (maliyetli/onay gerektirir) — `wa.me` link deseni yeterli.
- Optik form OCR ile otomatik okuma — MVP'de manuel/CSV giriş yeterli, istenirse Faz 2.

---

**Sıradaki adım:** Bu dosyayı okuyan oturum, Ahmet'ten "başla" onayı aldıktan sonra önce §5 madde 1-2'yi (Öğrenci Havuzu + Deneme Sınavı Takibi) inşa etsin, canlı test etsin, sonra devam etsin.
