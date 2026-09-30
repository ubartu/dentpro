import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, Check, CircleHelp, Clock3, FileText, Layers3, LockKeyhole, ScanLine, ShieldCheck, Sparkles, Stethoscope, Waypoints } from "lucide-react";
import { connection } from "next/server";
import { Reveal } from "./components/reveal";
import { SiteHeader } from "./components/site-header";

const steps = [
  { number: "01", title: "Vakanı oluştur", body: "Röntgenini ve temel bilgileri tek bir dijital akışta paylaş.", icon: ScanLine },
  { number: "02", title: "Kliniklerini seç", body: "Vakanın hangi kliniklere iletileceğini sen belirlersin.", icon: Waypoints },
  { number: "03", title: "Gerçek teklifleri al", body: "Tedavi planı ve fiyat, doğrudan klinik tarafından hazırlanır.", icon: FileText },
  { number: "04", title: "Farkları anla", body: "Planları ortak bir yapıda gör; teknik açıklamaları daha kolay oku.", icon: Sparkles },
  { number: "05", title: "Kararını ver", body: "Kapsamı karşılaştır, uygun kliniği seç ve randevu sürecine geç.", icon: BadgeCheck },
];

function Orbit() {
  return <div className="orbit-art" aria-hidden="true">
    <div className="orbit-core" />
    <div className="orbit-ring orbit-ring-one" />
    <div className="orbit-ring orbit-ring-two" />
    <div className="orbit-ring orbit-ring-three" />
    <div className="orbit-dots" />
  </div>;
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow"><span className="eyebrow-line" />{children}</div>;
}

export default async function Home() {
  await connection();
  return <main id="ust">
    <SiteHeader />
    <section className="hero">
      <div className="hero-grid" aria-hidden="true" />
      <Orbit />
      <div className="container hero-content">
        <Reveal className="hero-copy">
          <div className="hero-kicker"><span className="status-dot" /> DENTAL KARAR DENEYİMİNİ YENİDEN DÜŞÜNÜYORUZ</div>
          <h1>Tek röntgen.<br /><span>Birden fazla gerçek</span><br />klinik teklifi.</h1>
          <p className="hero-lead">Tedavi planlarını aynı yapıda gör, teknik bilgileri daha kolay anla ve seçeneklerini güvenle karşılaştır. <strong>Karar senin.</strong></p>
          <div className="hero-actions">
            <a className="button button-primary" href="#nasil-calisir">Dentrivo’yu keşfet <ArrowUpRight size={17} /></a>
            <a className="button button-ghost" href="#iletisim">Demo talep et <ArrowRight size={17} /></a>
          </div>
        </Reveal>
        <div className="hero-preview" aria-label="Dentrivo konsept ürün önizlemesi">
          <div className="preview-label">KONSEPT ÜRÜN GÖRÜNÜMÜ <span>01 / 03</span></div>
          <div className="preview-card preview-card-back"><span className="preview-mini-icon"><FileText size={16} /></span><span>Tedavi planı</span><span className="preview-pill">Klinik tarafından</span></div>
          <div className="preview-card preview-card-front">
            <div className="preview-top"><div><small>VAKA KARŞILAŞTIRMA</small><strong>Seçeneklerin, tek bakışta.</strong></div><span className="preview-spark"><Sparkles size={20} /></span></div>
            <div className="preview-row"><span>Kapsam</span><span>Standart görünüm <Check size={15} /></span></div>
            <div className="preview-row"><span>Seans</span><span>Yan yana karşılaştır <Check size={15} /></span></div>
            <div className="preview-row"><span>Materyal</span><span>Farkları kolayca gör <Check size={15} /></span></div>
            <div className="preview-bottom"><span className="mini-avatar">D</span><span>Karar için daha fazla netlik</span><ArrowUpRight size={17} /></div>
          </div>
          <div className="floating-note"><span><Sparkles size={17} /></span><div><strong>AI destekli açıklama</strong><small>Teknik dili sadeleştirir</small></div></div>
        </div>
        <a className="scroll-cue" href="#problem"><span>KEŞFETMEK İÇİN KAYDIR</span><ArrowDown size={16} /></a>
      </div>
    </section>

    <section className="signal-strip" aria-label="Dentrivo kimin için değer üretir">
      <div className="container signal-inner">
        <div><span>01 / HASTALAR İÇİN</span><strong>Karşılaştırılabilir seçenekler</strong></div>
        <div><span>02 / KLİNİKLER İÇİN</span><strong>Yapılandırılmış vaka akışı</strong></div>
        <div><span>03 / PLATFORM İÇİN</span><strong>Ölçeklenebilir SaaS modeli</strong></div>
      </div>
    </section>

    <section className="section problem-section" id="problem">
      <div className="container">
        <Reveal className="section-heading centered"><SectionEyebrow>PROBLEM</SectionEyebrow><h2>Diş tedavisi seçimi<br /><em>gereğinden fazla dağınık.</em></h2><p>Farklı klinikler, farklı terimler ve farklı teklif biçimleri. Hastanın seçenekleri anlamak için harcadığı çaba, kararın önüne geçiyor.</p></Reveal>
        <div className="problem-grid">
          <Reveal className="problem-card" delay={0}><span className="card-index">01</span><div className="problem-icon"><Clock3 size={24} /></div><h3>Tekrar eden ziyaretler</h3><p>İlk değerlendirme ve teklif almak için süreç birden fazla ayrı adıma bölünebiliyor.</p><span className="card-rule" /></Reveal>
          <Reveal className="problem-card featured" delay={100}><span className="card-index">02</span><div className="problem-icon"><Layers3 size={24} /></div><h3>Farklı teklif formatları</h3><p>Kapsam, materyal, seans ve fiyat kalemlerini yan yana okumak zorlaşıyor.</p><span className="card-rule" /></Reveal>
          <Reveal className="problem-card" delay={200}><span className="card-index">03</span><div className="problem-icon"><CircleHelp size={24} /></div><h3>Karar yorgunluğu</h3><p>Teknik terimler ve eksik bağlam, hastanın doğru soruları sormasını güçleştiriyor.</p><span className="card-rule" /></Reveal>
        </div>
      </div>
    </section>

    <section className="section flow-section" id="nasil-calisir">
      <div className="container">
        <Reveal className="section-heading split-heading"><div><SectionEyebrow>NASIL ÇALIŞIR</SectionEyebrow><h2>Tek vaka.<br /><em>Net bir yolculuk.</em></h2></div><p>Dentrivo, kliniklerin profesyonel kararlarını hastanın anlayabileceği ve karşılaştırabileceği bir akışta bir araya getirir.</p></Reveal>
        <div className="steps-grid">{steps.map((step, i) => <Reveal key={step.number} className="step-card" delay={i * 70}><div className="step-top"><span>{step.number}</span><step.icon size={25} strokeWidth={1.5} /></div><h3>{step.title}</h3><p>{step.body}</p>{i < steps.length - 1 && <span className="step-arrow"><ArrowRight size={17} /></span>}</Reveal>)}</div>
      </div>
    </section>

    <section className="section product-section" id="deger">
      <div className="container product-layout">
        <Reveal className="product-copy"><SectionEyebrow>ÜRÜN DENEYİMİ</SectionEyebrow><h2>Teklifleri görmek yetmez.<br /><em>Farkları anlamak gerekir.</em></h2><p>Fiyatın yanında kapsamı, materyali, seans sayısını ve klinik notlarını aynı yapıda incele. AI destekli açıklamalar, klinik planındaki teknik dili sadeleştirmeye yardımcı olur.</p><div className="fine-note"><ShieldCheck size={18} /><span>Tanı ve tedavi kararı kliniklere aittir. Dentrivo seçenekleri açıklar ve karşılaştırmayı kolaylaştırır.</span></div><a className="text-link" href="#guven">Güven yaklaşımımız <ArrowUpRight size={17} /></a></Reveal>
        <Reveal className="compare-window" delay={130}>
          <div className="window-bar"><div className="window-dots"><i /><i /><i /></div><span>TEKLİF KARŞILAŞTIRMA</span><span className="window-tag">KONSEPT ARAYÜZ</span></div>
          <div className="window-body"><div className="compare-head"><div><small>AYNI FORMATTA</small><h3>Seçenekleri karşılaştır</h3></div><div className="compare-filter">Kapsam <span>⌄</span></div></div><div className="compare-columns"><div className="compare-offer"><div className="offer-top"><span className="offer-monogram">A</span><div><strong>Klinik A</strong><small>Örnek teklif</small></div></div><div className="offer-line"><span>Tedavi kapsamı</span><strong>Plan detayları</strong></div><div className="offer-line"><span>Materyal</span><strong>Belirtilmiş</strong></div><div className="offer-line"><span>Seans</span><strong>Belirtilmiş</strong></div></div><div className="compare-offer accent"><div className="offer-top"><span className="offer-monogram">B</span><div><strong>Klinik B</strong><small>Örnek teklif</small></div></div><div className="offer-line"><span>Tedavi kapsamı</span><strong>Plan detayları</strong></div><div className="offer-line"><span>Materyal</span><strong>Belirtilmiş</strong></div><div className="offer-line"><span>Seans</span><strong>Belirtilmiş</strong></div></div></div><div className="insight-bar"><Sparkles size={17} /><span>Teknik planlar, daha anlaşılır açıklamalarla sunulur.</span></div></div>
        </Reveal>
      </div>
    </section>

    <section className="section value-section">
      <div className="container"><Reveal className="section-heading centered"><SectionEyebrow>İKİ TARAFLI DEĞER</SectionEyebrow><h2>Hasta için açıklık.<br /><em>Klinik için verimli akış.</em></h2></Reveal><div className="value-grid"><Reveal className="value-panel patient"><div className="value-overline">01 / HASTALAR</div><div className="value-icon"><ScanLine size={28} /></div><h3>Seçeneklerini anlayarak karar ver.</h3><p>Farklı kliniklerin gerçek planlarını ve fiyat tekliflerini ortak bir yapıda incele. Neyin dahil olduğunu gör, sorularını netleştir ve kendi seçimini yap.</p><div className="value-tags"><span>Şeffaflık</span><span>Karşılaştırma</span><span>Seçim özgürlüğü</span></div></Reveal><Reveal className="value-panel clinic" delay={100}><div className="value-overline">02 / KLİNİKLER</div><div className="value-icon"><Stethoscope size={28} /></div><h3>Nitelikli vakaları tek panelden yönet.</h3><p>Yapılandırılmış teklif hazırlama, vaka takibi ve randevu koordinasyonunu dijital bir çalışma alanında birleştir.</p><div className="value-tags"><span>Teklif yönetimi</span><span>Takip</span><span>Analitik</span></div></Reveal></div></div>
    </section>

    <section className="section investor-section" id="yatirimci"><div className="container investor-grid"><Reveal><SectionEyebrow>YATIRIMCI BAKIŞI</SectionEyebrow><h2>Net problem.<br /><em>İki taraflı değer.</em><br />Sürdürülebilir model.</h2><p>Dentrivo, hasta ve klinik arasındaki teklif, açıklama, karşılaştırma ve randevu katmanını dijitalleştirmeyi hedefler. Hasta deneyimi ücretsiz; klinik tarafındaki ürün yaklaşımı abonelik tabanlı SaaS modelidir.</p><a className="button button-primary" href="#iletisim">Yatırımcı iletişimi <ArrowUpRight size={17} /></a></Reveal><div className="investor-aside"><Reveal className="thesis-card"><span><ChartNoAxesCombined size={22} /></span><div><small>İŞ MODELİ</small><strong>Klinikler için abonelik tabanlı platform</strong><p>Teklif, takip ve operasyon araçları tek çalışma alanında.</p></div></Reveal><Reveal className="thesis-card" delay={90}><span><Layers3 size={22} /></span><div><small>BUGÜNKÜ AŞAMA</small><strong>Çalışan ürün temeli ve demo akışları</strong><p>Hasta uygulaması ile klinik ve yönetim panelleri geliştiriliyor; pilot doğrulaması ayrı bir sonraki adımdır.</p></div></Reveal><Reveal className="thesis-card" delay={180}><span><Waypoints size={22} /></span><div><small>UZUN VADELİ YÖN</small><strong>Dental geçmiş ve karar desteği</strong><p>Gelecek ürün başlıkları mevcut yetenek olarak sunulmaz.</p></div></Reveal></div></div></section>

    <section className="section trust-section" id="guven"><div className="container trust-grid"><Reveal><SectionEyebrow>GÜVEN & SINIRLAR</SectionEyebrow><h2>Sağlıkta güven,<br /><em>net sınırlarla başlar.</em></h2><p>Platformun rolü kliniklerin hazırladığı bilgiyi düzenlemek ve anlaşılır kılmaktır. Tıbbi değerlendirme ve tedavi kararı klinik uzmanlarına aittir.</p></Reveal><div className="trust-list"><Reveal className="trust-item"><span><Stethoscope size={21} /></span><div><h3>Klinik kararına saygı</h3><p>AI açıklaması bir teşhis veya tedavi önerisi olarak sunulmaz.</p></div></Reveal><Reveal className="trust-item" delay={80}><span><LockKeyhole size={21} /></span><div><h3>Veri minimizasyonu</h3><p>Hassas bilgiler için ihtiyaç kadar erişim ve açık onay yaklaşımı.</p></div></Reveal><Reveal className="trust-item" delay={160}><span><ShieldCheck size={21} /></span><div><h3>İzlenebilir süreç</h3><p>Vaka, teklif ve yönetim adımları için kayıtlı iş akışları.</p></div></Reveal></div></div></section>

    <section className="contact-section" id="iletisim"><div className="container"><Reveal className="contact-panel"><div className="contact-glow" /><SectionEyebrow>SONRAKİ ADIM</SectionEyebrow><h2>Daha net bir dental<br /><em>geleceği konuşalım.</em></h2><p>Yatırımcı görüşmesi, ürün demosu veya pilot klinik iş birliği için iletişim kanalı hazırlıyoruz.</p><div className="contact-actions"><span className="contact-chip">Yatırımcı görüşmesi</span><span className="contact-chip">Ürün demosu</span><span className="contact-chip">Pilot klinik</span></div><div className="contact-status"><span className="status-dot" /> İletişim adresi yayından önce eklenecek</div></Reveal></div></section>

    <footer className="site-footer"><div className="container footer-main"><div><a className="brand" href="#ust"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>DENTRIVO</span></a><p>Diş tedavisi kararında daha fazla netlik.</p></div><div className="footer-links"><a href="#nasil-calisir">Nasıl çalışır</a><a href="#deger">Değer</a><a href="#yatirimci">Yatırımcılar</a><a href="#guven">Güven</a></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Dentrivo</span><span>Ürün önizlemeleri konsept amaçlıdır.</span><a href="#ust">Yukarı dön ↑</a></div></footer>
  </main>;
}
