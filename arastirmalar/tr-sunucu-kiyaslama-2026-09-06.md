# Türkiye Lokasyonlu Sunucu Kıyaslaması (6 Eylül 2026)

Amaç: KVKK md.9 gereği kişisel verileri yurt içinde tutmak için panelin veritabanı katmanının (Postgres + PostgREST, Docker ile self-host Supabase) taşınabileceği Türkiye veri merkezli sağlayıcıyı seçmek. Hedef kapasite: 2–4 vCPU, 4–8 GB RAM, 80–160 GB NVMe, günlük yedek. Mevcut durum: Supabase eu-central-1 (Frankfurt) → yurt dışı aktarım.

Kural: Her bilgi sağlayıcının kendi sayfasından; görülemeyen bilgi "sayfada yok". Fiyatlar 2026-09-06'da görüldüğü hâliyle.

## Karar özeti
- Yabancı sağlayıcılar (Hostinger, AWS tam bölge, Azure, Google, Hetzner, DigitalOcean) Türkiye'de veri merkezi sunmuyor. Hostinger'ın resmî destek sayfası: yalnızca Avrupa/Asya/ABD/Brezilya.
- İlk 3: **Radore** (CPU-Advance 4 vCPU/4 GB/100 GB NVMe, $17/ay KDV hariç; ISO listesi iddiası), **İsim Kayıt** (Kocaeli veri merkezi, Standart VDS 4 vCPU/4 GB, 295 TL/ay'dan KDV hariç, root+DDoS dâhil), **Bulutistan** (ürün sayfasında açık "KVKK'ya uyumlu" beyanı; fiyat teklifle).
- Ölçek büyürse: Türk Telekom Bulut / Turkcell Bulut (teklif süreci).
- Hiçbir sağlayıcı ürün sayfasında SLA yüzdesi yazmıyor; ISO 27001 ve KVKK belgeleri satıştan yazılı istenmeli.

## Tablo (özet)
| Sağlayıcı | Veri merkezi | Sertifika | KVKK beyanı | Örnek paket / fiyat | Yedek | DDoS | Root/Docker |
|---|---|---|---|---|---|---|---|
| Radore | şehir yok | ISO 27001/9001/22301/PCI-DSS/27017-18 (arama özeti) | yok | 4 vCPU/4 GB/100 GB NVMe · $17/ay KDV hariç | belirtilmemiş | belirtilmemiş | yok |
| İsim Kayıt | Kocaeli | yok | yok | EKO 2/2, Standart VDS 4/4 · 295 TL/ay'dan KDV hariç | belirtilmemiş | dâhil | tam root |
| Bulutistan | yok | yok | "tamamen KVKK'ya uyumlu" | tutar görülmedi | yok | belirtilmemiş | yok |
| Natro (XCloud) | yok | yok | yok | 1 çek./1 GB/20 GB ≈ 347 TL (promo 241) | ücretsiz yedek | dâhil | yok |
| DataTR | Bursa (DGN) | yok | yok | görülmedi | yok | yok | Ubuntu/Debian/Alma/Rocky, VMware |
| Vulut | PenDC (Tier III iddiası) | Tier III iddiası | yok | görülmedi | yok | var (Fortinet/Juniper) | yok |
| Alastyr | "tüm sunucular Türkiye'de" | yok | yok | $7,16–$43,15/ay | yok | yok | yok |
| Turhost | ayrı "VPS TR" ürünü; genel VPS Avrupa | yok | yok | VPS Plus 2/4/40 · $18,99 (promo $9,99); TR fiyatı görülmedi | yok | yok | ECC, izole |
| Veridyen | yok | yok | yok | görülmedi | yok | yok | Ubuntu/Debian/Alma/Rocky, ESXi |
| Hostixo | şehir yok | yok | yok | Managed S120 4/4/80 · $73,15/ay (yönetimli) | yok | yok | yok |
| GüzelHosting (guzel.net.tr) | İstanbul veya Avrupa | yok | yok | görülmedi | haftalık yedek | yok | yok |
| Hosting.com.tr | TR varsayım (doğrulanmadı) | yok | yok | VPS $3,49'dan, VDS $9,99'dan | yok | yok | yok |
| Kriweb | "Türkiye lokasyonlu" | yok | yok | yıllık 7.079 / 13.199 TL, spec belirsiz | yok | yok | yok |
| Vargonen | yok | yok | yok | görülmedi (Nano Cloud) | yok | yok | yok |
| Turkcell Bulut | yok | yok | yok | teklif | yok | yok | yok |
| Türk Telekom Bulut | yok | yok | yok | teklif (444 5 444) | yok | yok | yok |
| Sadecehosting | doğrulanamadı | | | | | | |
| Bulutsunucu.com | doğrulanamadı (DNS) | | | | | | |

## Doğrulanamayan noktalar
- SLA yüzdesi hiçbir ürün sayfasında yok.
- ISO/Tier bilgisi yalnızca Radore ve Vulut için ve arama özetinden; sertifika sayfaları görülmedi.
- Bulutistan dışında ürün sayfalarında KVKK beyanı yok; ayrı KVKK/aydınlatma sayfaları taranmadı.
- Turhost TR ürün içeriği doğrulanamadı; Hosting.com.tr TR lokasyonu varsayım.
- Sadecehosting ve bulutsunucu.com sayfalarına ulaşılamadı.

## Sonraki adım
1. Radore, İsim Kayıt, Bulutistan'dan yazılı iste: ISO 27001, veri merkezi adresi, KVKK veri işleyen sözleşmesi taslağı, yedek/snapshot politikası, SLA, KDV dâhil fiyat.
2. Deneme sunucusu (4 vCPU/8 GB/160 GB) + Docker ile self-host Supabase; Frankfurt verisini taşı; gecikme ölç.
3. Taşınma sonrası md.9 sorusu kapanır; kalan: aydınlatma metni, okullarla veri işleyen sözleşmesi, teknik tedbir belgeleri.

## Kaynaklar
Radore https://radore.com/services/cloud-server · İsim Kayıt https://www.isimkayit.com/bulut-sunucu · Bulutistan https://bulutistan.com/neden-bulutistan/fiyatlama · Natro https://www.natro.com/sunucu-kiralama/vps-cloud-server · DataTR https://www.datatr.com/sunucu/linux-sanal-sunucu · Vulut https://www.vulut.com/sunucu/sanal-sunucu · Alastyr https://www.alastyr.com/bulut-sunucu · Turhost https://www.turhost.com/sunucu/vps-tr-sunucu/ · Veridyen https://www.veridyen.com/sunucu/bulut-sunucu · Hostixo https://www.hostixo.com/sunucu/linux-sunucu/ · GüzelHosting https://www.guzel.net.tr/public-cloud.php · Hosting.com.tr https://www.hosting.com.tr/server/vps-server/ · Kriweb https://kriweb.com/vps-hosting/ · Vargonen https://www.vargonen.com/server/vps-sunucu · Turkcell https://www.turkcell.com.tr/kurumsal/dijital-is-servisleri/bulut-depolama/sanal-veri-merkezi · Türk Telekom https://kurumsal.turktelekom.com.tr/bilisim-teknolojileri/veri-merkezi-ve-bulut/sanallastirma-cozumleri/sanal-sunucu · Hostinger lokasyonlar https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/ · AWS Local Zone İstanbul https://aws.amazon.com/about-aws/whats-new/2026/05/aws-local-zones-istanbul-turkiye/ · Hetzner https://docs.hetzner.com/cloud/general/locations/ · KVKK yurt dışı aktarım https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim · KVKK Rehber 48 https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi
