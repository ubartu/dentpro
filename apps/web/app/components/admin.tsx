"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Download,
  ShieldCheck,
  Building2,
  RefreshCw,
  CheckCircle2,
  FileText,
  Activity,
  AlertCircle,
  BookOpen,
  Settings2,
} from "lucide-react";
import {
  Action,
  Auth,
  Clinic,
  Proposal,
  Workspace,
  Glossary,
  money,
  date,
  datetime,
  label,
  csv,
  matchesSearch,
} from "../types";
import {
  Badge,
  Empty,
  Field,
  Form,
  Heading,
  Stat,
  SearchBox,
  Modal,
  RowLink,
} from "./ui";
import {
  AppointmentsPanel,
  MembersPanel,
  ProfileFields,
  profileData,
  DiscoveryFields,
  discoveryData,
  ProposalDetail,
} from "./forms";
import { CaseTable, ImageViewer, ActivityChart } from "./clinic";
export default function AdminScreen({
  section,
  entityId,
  data,
  auth,
  act,
}: {
  section: string;
  entityId?: string;
  data: Workspace;
  auth: Auth;
  act: Action;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [clinic, setClinic] = useState<Clinic | null>(null),
    [adding, setAdding] = useState(false),
    [billing, setBilling] = useState<Clinic | null>(null),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [glossary, setGlossary] = useState<Glossary | null>(null),
    [caseAction, setCaseAction] = useState<"archive" | "reopen" | null>(null);
  const clinics = data.clinics || [];
  const accounts = data.accounts || [];
  const jobs = data.jobs || [];
  const audit = data.audit || [];
  const glossaries = data.glossary || [];
  const settings = data.settings!;
  const telemetry = data.telemetry!;
  const c = entityId ? data.cases.find((x) => x.id === entityId) : undefined;
  function render() {
    if (section === "overview")
      return (
        <>
          <Heading
            eyebrow="PLATFORM İŞLEMLERİ"
            title="Platformunuza genel bakış."
            description="Klinik katılımını, vaka akışını ve süreç adımlarını izleyin."
          >
            <Link className="primary" href="/admin/clinics">
              Klinikleri yönet
              <ArrowRight size={16} />
            </Link>
          </Heading>
          <div className="stats">
            <Stat
              label="Aktif klinikler"
              value={clinics.filter((c) => c.status === "active").length}
              note={`${clinics.filter((c) => c.status === "pending").length} onay bekliyor`}
              href="/admin/clinics"
            />
            <Stat
              label="Paylaşılan vakalar"
              value={data.cases.filter((c) => c.status === "shared").length}
              note="Katılımcı kliniklerde"
              href="/admin/cases"
            />
            <Stat
              label="İncelenecek teklifler"
              value={
                data.proposals.filter(
                  (p) =>
                    p.moderation === "unreviewed" && p.status === "submitted",
                ).length
              }
              note="Güncel, incelenmemiş gönderimler"
              href="/admin/proposals"
            />
            <Stat
              label="Açıklama kuyruğu"
              value={jobs.filter((j) => j.status === "pending").length}
              note={`${jobs.filter((j) => j.status === "failed").length} başarısız iş`}
              href="/admin/interpreter"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading unpadded">
                <div>
                  <h2>Dikkat gerektirenler</h2>
                  <p>Platform genelinde onay ve kalite işlemleri.</p>
                </div>
                <ShieldCheck size={20} />
              </div>
              <Link className="attention-row" href="/admin/clinics">
                <span className="square-icon">
                  <Building2 size={19} />
                </span>
                <div>
                  <strong>Klinik başvuruları</strong>
                  <small>
                    Vakaları görmelerine izin vermeden önce klinikleri
                    inceleyin.
                  </small>
                </div>
                <b>{clinics.filter((c) => c.status === "pending").length}</b>
                <ArrowRight size={16} />
              </Link>
              <Link className="attention-row" href="/admin/proposals">
                <span className="square-icon">
                  <FileText size={19} />
                </span>
                <div>
                  <strong>İşaretlenen teklifler</strong>
                  <small>
                    Kaynak planları inceleyip kalite sorunlarını giderin.
                  </small>
                </div>
                <b>
                  {
                    data.proposals.filter((p) => p.moderation === "flagged")
                      .length
                  }
                </b>
                <ArrowRight size={16} />
              </Link>
              <Link className="attention-row" href="/admin/glossary">
                <span className="square-icon">
                  <BookOpen size={19} />
                </span>
                <div>
                  <strong>Sözlük incelemesi</strong>
                  <small>Diş hekimi incelemesi kaydedilmemiş girdiler.</small>
                </div>
                <b>{glossaries.filter((g) => !g.reviewed).length}</b>
                <ArrowRight size={16} />
              </Link>
            </section>
            <section className="panel system-card">
              <span className="square-icon">
                <Activity size={23} />
              </span>
              <h2>Açıklama işlemleri</h2>
              <div className="mini-summary">
                <span>İşleyici durumu</span>
                <Badge>
                  {settings.explanations_enabled ? "enabled" : "paused"}
                </Badge>
              </div>
              <div className="mini-summary">
                <span>Sağlayıcı</span>
                <strong>
                  {telemetry.configured
                    ? `OpenAI · ${telemetry.model}`
                    : "Şablon"}
                </strong>
              </div>
              <div className="mini-summary">
                <span>Kayıtlı açıklamalar</span>
                <strong>{telemetry.explanations}</strong>
              </div>
              <div className="mini-summary">
                <span>Sağlayıcı kullanımı</span>
                <strong>
                  {telemetry.input_tokens} giriş / {telemetry.output_tokens}{" "}
                  çıkış tokeni
                </strong>
              </div>
              <Link className="secondary" href="/admin/interpreter">
                Kuyruğu incele
                <ArrowRight size={15} />
              </Link>
            </section>
          </div>
          <div className="dashboard-grid equal">
            <section className="panel">
              <h2>Platform teklif etkinliği</h2>
              <p className="muted">Son 7 gündeki gönderimler ve sürümler.</p>
              <ActivityChart proposals={data.proposals} />
            </section>
            <section className="panel">
              <div className="panel-heading unpadded">
                <h2>Son denetim olayları</h2>
                <RowLink href="/admin/audit">Tümünü gör</RowLink>
              </div>
              {audit.slice(0, 5).map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="event-dot" />
                  <div>
                    <strong>{label(a.action)}</strong>
                    <small>
                      {accounts.find((u) => u.id === a.actor)?.name || a.actor}{" "}
                      · {datetime(a.created_at)}
                    </small>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      );
    if (section === "clinics") {
      const rows = clinics.filter(
        (c) =>
          matchesSearch(`${c.name} ${c.region} ${c.district}`, search) &&
          (filter === "all" || c.status === filter),
      );
      return (
        <>
          <Heading
            eyebrow="AĞ YÖNETİMİ"
            title="Klinikler"
            description="Platformdaki klinikleri ekleyin, onaylayın ve yönetin."
          >
            <button className="primary" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Klinik ekle
            </button>
          </Heading>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Klinik veya bölge ara…"
            />
            <select
              aria-label="Klinik durumu"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "pending", "active", "suspended", "rejected"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "Tüm durumlar" : label(s)}
                  </option>
                ),
              )}
            </select>
            <span className="result-count">{rows.length} klinik</span>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Klinik</th>
                    <th>Konum</th>
                    <th>Hesap durumu</th>
                    <th>Abonelik</th>
                    <th>Vakalar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>{c.email}</small>
                      </td>
                      <td>
                        {c.district}
                        <small>{label(c.region)}</small>
                      </td>
                      <td>
                        <Badge>{c.status}</Badge>
                      </td>
                      <td>
                        <Badge>{c.subscription}</Badge>
                      </td>
                      <td>
                        {
                          data.cases.filter((x) => x.recipients.includes(c.id))
                            .length
                        }
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setClinic(c)}
                        >
                          Kliniği incele
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <Empty
                title="Eşleşen klinik yok"
                description="Filtreleri değiştirin veya klinik ekleyin."
              />
            )}
          </div>
        </>
      );
    }
    if (section === "cases" && entityId) {
      if (!c)
        return (
          <Empty
            title="Vaka bulunamadı"
            description="Bu vaka kullanılamıyor."
          />
        );
      return (
        <>
          <Link className="back-link" href="/admin/cases">
            ← Tüm platform vakaları
          </Link>
          <Heading
            eyebrow={`${c.reference} · PLATFORM OVERSIGHT`}
            title={c.title}
            description={`${date(c.created_at)} tarihinde oluşturuldu · ${label(c.region)}`}
          >
            <button
              className="secondary"
              onClick={() =>
                setCaseAction(c.status === "archived" ? "reopen" : "archive")
              }
            >
              {c.status === "archived" ? "Vakayı yeniden aç" : "Vakayı arşivle"}
            </button>
          </Heading>
          <div className="case-detail-grid">
            <div>
              <ImageViewer c={c} auth={auth} />
              <section className="panel">
                <h2>Klinik teklifleri</h2>
                {data.proposals
                  .filter((p) => p.case_id === c.id)
                  .map((p) => (
                    <div className="activity-row" key={p.id}>
                      <FileText size={19} />
                      <div>
                        <strong>{p.clinic_name}</strong>
                        <small>
                          Sürüm {p.version} ·{" "}
                          {money(p.total_minor, p.plan.currency)}
                        </small>
                      </div>
                      <Badge>{p.status}</Badge>
                      <button
                        className="text-link"
                        onClick={() => setProposal(p)}
                      >
                        İncele
                      </button>
                    </div>
                  ))}
                {!c.proposal_count && (
                  <p className="muted">
                    Bu vaka için henüz teklif gönderilmedi.
                  </p>
                )}
              </section>
            </div>
            <section className="panel fit">
              <h2>Onay ve yönlendirme</h2>
              <div className="mini-summary">
                <span>Vaka durumu</span>
                <Badge>{c.status}</Badge>
              </div>
              <div className="mini-summary">
                <span>Paylaşım onayı</span>
                <Badge>{c.consent_recorded ? "recorded" : "missing"}</Badge>
              </div>
              <h4>Hastanın seçtiği klinikler</h4>
              {c.recipients.map((id) => (
                <div className="recipient" key={id}>
                  <Building2 size={16} />
                  <div>
                    <strong>
                      {clinics.find((x) => x.id === id)?.name || id}
                    </strong>
                    <small>
                      {label(clinics.find((x) => x.id === id)?.status || "")}
                    </small>
                  </div>
                </div>
              ))}
              <Form
                label="Seçilen kliniğe yeniden gönder"
                onSave={(f) =>
                  act(`/admin/cases/${c.id}/redispatch`, {
                    clinic_ids: [f.get("clinic_id")],
                  })
                }
              >
                <Field label="Mevcut alıcı">
                  <select name="clinic_id" required>
                    <option value="">Klinik seç</option>
                    {c.recipients.map((id) => (
                      <option key={id} value={id}>
                        {clinics.find((x) => x.id === id)?.name || id}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="muted">
                  Yeniden gönderme, klinik inceleme durumunu Yeni olarak
                  sıfırlar. Yeni alıcı eklemek için mobil API üzerinden hastanın
                  yeniden onay vermesi gerekir.
                </p>
              </Form>
            </section>
          </div>
        </>
      );
    }
    if (section === "cases") {
      const rows = data.cases.filter(
        (c) =>
          matchesSearch(`${c.title} ${c.reference} ${c.region}`, search) &&
          (filter === "all" || c.status === filter),
      );
      return (
        <>
          <Heading
            eyebrow="VAKA DENETİMİ"
            title="Platform vakaları"
            description="Vaka yönlendirmesini, onayı, klinik yanıtlarını ve arşiv kayıtlarını inceleyin."
          />
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Platform vakalarında ara…"
            />
            <select
              aria-label="Vaka durumu"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "draft", "shared", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Tüm durumlar" : label(s)}
                </option>
              ))}
            </select>
            <span className="result-count">{rows.length} vaka</span>
          </div>
          <section className="panel flush">
            <CaseTable cases={rows} base="/admin" />
          </section>
        </>
      );
    }
    if (section === "proposals") {
      const rows = data.proposals.filter(
        (p) =>
          matchesSearch(`${p.case_title} ${p.clinic_name}`, search) &&
          (filter === "all" || p.moderation === filter),
      );
      return (
        <>
          <Heading
            eyebrow="KALİTE VE KAYNAK İNCELEMESİ"
            title="Teklif denetimi"
            description="Kliniklerin hazırladığı planları ve ayrı açıklamalarını inceleyin. İşaretlenen planlar hasta sonuçlarında gösterilmez."
          />
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Klinik veya vaka ara…"
            />
            <select
              aria-label="Denetim durumu"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "unreviewed", "approved", "flagged"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Tüm inceleme durumları" : label(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Klinik / vaka</th>
                    <th>Sürüm</th>
                    <th>Toplam</th>
                    <th>Yaşam döngüsü</th>
                    <th>İncele</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.clinic_name}</strong>
                        <small>{p.case_title}</small>
                      </td>
                      <td>v{p.version}</td>
                      <td>{money(p.total_minor, p.plan.currency)}</td>
                      <td>
                        <Badge>{p.status}</Badge>
                      </td>
                      <td>
                        <Badge>{p.moderation}</Badge>
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setProposal(p)}
                        >
                          İncele
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <Empty
                title="Eşleşen teklif yok"
                description="Başka bir inceleme filtresi deneyin."
              />
            )}
          </div>
        </>
      );
    }
    if (section === "appointments")
      return (
        <>
          <Heading
            eyebrow="PLATFORM KOORDİNASYONU"
            title="Randevu talepleri"
            description="Tüm kliniklerdeki geri arama ve randevu sürecini izleyin."
          />
          <AppointmentsPanel
            appointments={data.appointments}
            role="admin"
            act={act}
          />
        </>
      );
    if (section === "accounts")
      return (
        <>
          <Heading
            eyebrow="KİMLİK VE ERİŞİM"
            title="Hesaplar"
            description="Hesap oluşturun, erişimi yönetin ve şifre sıfırlama ya da devre dışı bırakmayla oturumları sonlandırın."
          />
          <MembersPanel
            accounts={accounts}
            clinics={clinics}
            role="admin"
            act={act}
            currentId={auth.user.id}
          />
        </>
      );
    if (section === "subscriptions")
      return (
        <>
          <Heading
            eyebrow="KLİNİK HİZMETİ"
            title="Abonelikler"
            description="Klinik abonelik kayıtlarını, ücretlerini ve yenileme tarihlerini yönetin. Ödeme tahsilatı bağlı değildir."
          />
          <div className="stats">
            <Stat
              label="Aktif abonelikler"
              value={clinics.filter((c) => c.subscription === "active").length}
              note="Yönetimsel olarak aktif"
            />
            <Stat
              label="Aylık sözleşme ücretleri"
              value={money(
                clinics
                  .filter((c) => c.subscription === "active")
                  .reduce((s, c) => s + c.monthly_fee_minor, 0),
              )}
              note="Tahsil edilmiş gelir değildir"
            />
            <Stat
              label="Denemedeki klinikler"
              value={clinics.filter((c) => c.subscription === "trial").length}
              note="Şu anda denemede"
            />
            <Stat
              label="Vadesi geçenler"
              value={
                clinics.filter((c) => c.subscription === "past_due").length
              }
              note="Takip gerekli"
            />
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Klinik</th>
                    <th>Abonelik</th>
                    <th>Aylık ücret</th>
                    <th>Yenileme</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>{c.email}</small>
                      </td>
                      <td>
                        <Badge>{c.subscription}</Badge>
                      </td>
                      <td>{money(c.monthly_fee_minor)}</td>
                      <td>
                        {c.renewal_date ? date(c.renewal_date) : "Planlanmadı"}
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setBilling(c)}
                        >
                          Yönet
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      );
    if (section === "interpreter") {
      const rows = jobs.filter(
        (j) =>
          (filter === "all" || j.status === filter) &&
          matchesSearch(`${j.proposal_id} ${j.key}`, search),
      );
      return (
        <>
          <Heading
            eyebrow="AÇIKLAMA İŞLEMLERİ"
            title="Açıklamalar ve işler"
            description="Kalıcı işleri inceleyin, başarısız olanları yeniden deneyin ve güncel sözlük sürümüyle yeniden oluşturun."
          />
          <div className="stats">
            <Stat
              label="Kayıtlı açıklamalar"
              value={telemetry.explanations}
              note="Değiştirilemeyen kayıtlı çıktılar"
            />
            <Stat
              label="Bekliyor"
              value={jobs.filter((j) => j.status === "pending").length}
              note={
                settings.explanations_enabled
                  ? "İşleyici etkin"
                  : "İşleme ayarlardan duraklatıldı"
              }
            />
            <Stat
              label="Başarısız"
              value={jobs.filter((j) => j.status === "failed").length}
              note="Sınırlı deneme sonrasında durduruldu"
            />
            <Stat
              label="Ağ geçidi"
              value={telemetry.configured ? "OpenAI hazır" : "Yalnızca şablon"}
              note={
                telemetry.configured
                  ? telemetry.model
                  : "Yapay zekâyı etkinleştirmek için sunucuda sağlayıcı ve anahtar ayarlayın"
              }
            />
          </div>
          <div className="notice">
            <ShieldCheck size={20} />
            <p>
              Geçerli sağlayıcı:{" "}
              <strong>
                {telemetry.configured
                  ? `OpenAI ${telemetry.model}`
                  : "şablon açıklayıcı"}
              </strong>
              . Ağ geçidi yalnızca yapılandırılmış klinik planı alanlarını ve
              şablon özetini gönderir; röntgenler, hasta kimlikleri, iletişim
              bilgileri ve klinik notlar gönderilmez. Geçersiz veya
              kullanılamayan yapay zekâ çıktısında şablon kullanılır. Kayıtlı
              sürümler sayfa görüntülendiğinde yeniden oluşturulmaz.
            </p>
          </div>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="İş veya teklif kimliği ara…"
            />
            <select
              aria-label="İş durumu"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "pending", "completed", "failed"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Tüm işler" : label(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>İş / teklif</th>
                    <th>Durum</th>
                    <th>Ağ geçidi / çıktı</th>
                    <th>Denemeler</th>
                    <th>Son güncelleme</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => {
                    const p = data.proposals.find(
                      (p) => p.id === j.proposal_id,
                    );
                    return (
                      <tr key={j.key}>
                        <td>
                          <strong>{p?.clinic_name || "Klinik teklifi"}</strong>
                          <small>{p?.case_title || j.proposal_id}</small>
                          <code>{j.key.slice(0, 16)}</code>
                          {j.error && (
                            <small className="danger">{j.error}</small>
                          )}
                        </td>
                        <td>
                          <Badge>{j.status}</Badge>
                        </td>
                        <td>
                          <strong>
                            {j.provider === "openai" ? "OpenAI" : "Şablon"}
                          </strong>
                          <small>{j.model}</small>
                          {j.output_mode && <Badge>{j.output_mode}</Badge>}
                        </td>
                        <td>{j.attempts}</td>
                        <td>{datetime(j.updated_at)}</td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() =>
                              act(
                                `/admin/proposals/${j.proposal_id}/explain`,
                              ).catch(() => {})
                            }
                          >
                            <RefreshCw size={14} />
                            {j.status === "failed"
                              ? "Yeniden dene"
                              : "Sürümü yeniden kontrol et"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <Empty
                title="Eşleşen iş yok"
                description="Yeni teklifler yayımlandıktan sonra kuyruğa alınır."
              />
            )}
          </div>
        </>
      );
    }
    if (section === "glossary")
      return (
        <>
          <Heading
            eyebrow="KAYNAĞA BAĞLI AÇIKLAMALAR"
            title="İşlem sözlüğü"
            description="Şablon açıklamaları yönetin ve diş hekimi incelemesini kaydedin. Değişiklikler sonraki işler için yeni sürüm oluşturur."
          />
          <div className="notice">
            <BookOpen size={21} />
            <p>
              Klinik ifadeler diş hekimi tarafından incelenmelidir. Bir girdiyi
              güncellemek kayıtlı açıklamaları değiştirmez; mevcut teklif için
              yeni sürüm oluşturmak üzere iş denetimlerini kullanın.
            </p>
          </div>
          <div className="glossary-grid">
            {glossaries.map((g) => (
              <section className="panel glossary-card" key={g.code}>
                <div className="spread">
                  <span className="square-icon">
                    <BookOpen size={19} />
                  </span>
                  <Badge>{g.reviewed ? "reviewed" : "draft"}</Badge>
                </div>
                <h2>{g.name}</h2>
                <code>
                  {g.code} · v{g.version}
                </code>
                <p>{g.explanation}</p>
                <div className="spread">
                  <small>
                    {g.reviewer
                      ? `İnceleyen hekim: ${g.reviewer}`
                      : "Diş hekimi incelemesi kaydedilmedi"}
                  </small>
                  <button className="text-link" onClick={() => setGlossary(g)}>
                    Düzenle ve incele
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      );
    if (section === "audit") {
      const rows = audit.filter(
        (a) =>
          matchesSearch(`${a.actor} ${a.action} ${a.entity}`, search) &&
          (filter === "all" || a.action.startsWith(filter + ".")),
      );
      return (
        <>
          <Heading
            eyebrow="ACCOUNTABILITY"
            title="Denetim kaydı"
            description="Klinik ve platform işlemlerindeki erişimleri ve değişiklikleri izleyin. Son 1.000 olay."
          />
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Kullanıcı, işlem veya varlık ara…"
            />
            <select
              aria-label="Denetim kategorisi"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Tüm kategoriler</option>
              {[
                "case",
                "clinic",
                "proposal",
                "appointment",
                "account",
                "session",
                "explanation",
                "glossary",
                "xray",
                "consent",
                "platform",
                "subscription",
              ].map((x) => (
                <option key={x} value={x}>
                  {label(x)}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={() =>
                csv(
                  "dentpro-audit.csv",
                  rows.map((a) => ({
                    timestamp: a.created_at,
                    actor: a.actor,
                    action: a.action,
                    entity: a.entity,
                  })),
                )
              }
            >
              <Download size={15} />
              Filtrelenmiş olayları dışa aktar
            </button>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Zaman damgası</th>
                    <th>İşlemi yapan</th>
                    <th>İşlem</th>
                    <th>Varlık</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>{datetime(a.created_at)}</td>
                      <td>
                        {accounts.find((x) => x.id === a.actor)?.name ||
                          a.actor}
                        <small>{a.actor}</small>
                      </td>
                      <td>{label(a.action)}</td>
                      <td>
                        <code>{a.entity}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <Empty
                title="Eşleşen olay yok"
                description="Filtreyi temizleyin veya başka bir arama deneyin."
              />
            )}
          </div>
        </>
      );
    }
    if (section === "settings")
      return (
        <>
          <Heading
            eyebrow="PLATFORM YAPILANDIRMASI"
            title="İşlem ayarları"
            description="Bu sınırlar API ve açıklama işleyicisi tarafından uygulanır."
          />
          <div className="settings-grid">
            <section className="panel">
              <Form
                onSave={(f) =>
                  act(
                    "/admin/settings",
                    {
                      explanations_enabled: f.get("enabled") === "on",
                      max_recipients: Number(f.get("recipients")),
                      upload_limit_mb: Number(f.get("upload")),
                    },
                    "PUT",
                  )
                }
              >
                <h2>İşleme ve vaka sınırları</h2>
                <label className="toggle-field">
                  <div>
                    <strong>Açıklama işlerini işle</strong>
                    <small>
                      Klinikler teklif göndermeye devam ederken açıklama
                      işlemesini duraklatın.
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={settings.explanations_enabled}
                  />
                </label>
                <Field
                  label="Vaka başına en fazla klinik alıcısı"
                  hint="Yeni mobil API gönderim taleplerine uygulanır; mevcut atamalar korunur."
                >
                  <input
                    type="number"
                    name="recipients"
                    min={1}
                    max={10}
                    defaultValue={settings.max_recipients}
                    required
                  />
                </Field>
                <Field
                  label="En büyük yükleme boyutu (MB)"
                  hint="PNG, JPEG ve PDF dosyaları bu sınıra kadar kabul edilir."
                >
                  <input
                    type="number"
                    name="upload"
                    min={1}
                    max={10}
                    defaultValue={settings.upload_limit_mb}
                    required
                  />
                </Field>
              </Form>
            </section>
            <section className="panel fit">
              <span className="square-icon">
                <Settings2 size={22} />
              </span>
              <h2>Ortam sınırları</h2>
              <dl className="details">
                <div>
                  <dt>Ortam</dt>
                  <dd>Yerel geliştirme</dd>
                </div>
                <div>
                  <dt>Hasta arayüzü</dt>
                  <dd>Yalnızca mobil API</dd>
                </div>
                <div>
                  <dt>Açıklama sistemi</dt>
                  <dd>Sürümlü şablon sözlüğü</dd>
                </div>
                <div>
                  <dt>Dosyalar</dt>
                  <dd>Özel yerel depolama</dd>
                </div>
                <div>
                  <dt>Bildirimler / ödemeler</dt>
                  <dd>Harici sağlayıcılar bağlı değil</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      );
    return (
      <Empty
        title="Sayfa bulunamadı"
        description="Yönetim menüsünden bir sayfa seçin."
      />
    );
  }
  return (
    <>
      {render()}
      {adding && (
        <Modal title="Klinik ekle" close={() => setAdding(false)} wide>
          <Form
            label="İncelenmek üzere klinik oluştur"
            onSave={async (f) => {
              await act("/admin/clinics", {
                ...profileData(f),
                region: f.get("region"),
              });
              setAdding(false);
            }}
          >
            <Field label="Bölge">
              <select name="region">
                <option value="Istanbul">İstanbul</option>
                <option value="Ankara">Ankara</option>
                <option value="Izmir">İzmir</option>
              </select>
            </Field>
            <ProfileFields />
          </Form>
        </Modal>
      )}
      {clinic && (
        <Modal
          title="Klinik doğrulaması ve erişim"
          close={() => setClinic(null)}
        >
          <h3>{clinic.name}</h3>
          <p className="muted">{clinic.address}</p>
          <dl className="details">
            <div>
              <dt>İletişim</dt>
              <dd>
                {clinic.email}
                <br />
                {clinic.phone || "Telefon belirtilmedi"}
              </dd>
            </div>
            <div>
              <dt>Çalışma saatleri</dt>
              <dd>{clinic.hours}</dd>
            </div>
            <div>
              <dt>Açıklama</dt>
              <dd>{clinic.description || "Açıklama eklenmedi"}</dd>
            </div>
          </dl>
          <details className="profile-disclosure">
            <summary>Klinik profilini düzenle</summary>
            <Form
              label="Klinik profilini kaydet"
              onSave={async (f) => {
                await act(
                  `/admin/clinics/${clinic.id}/profile`,
                  { ...profileData(f), region: f.get("region") },
                  "PUT",
                );
                setClinic(null);
              }}
            >
              <Field label="Bölge">
                <select name="region" defaultValue={clinic.region}>
                  <option value="Istanbul">İstanbul</option>
                  <option value="Ankara">Ankara</option>
                  <option value="Izmir">İzmir</option>
                </select>
              </Field>
              <ProfileFields clinic={clinic} />
            </Form>
          </details>
          <details className="profile-disclosure">
            <summary>Google Haritalar ve sosyal medya profilleri</summary>
            <Form
              label="Keşif profilini kaydet"
              onSave={async (f) => {
                await act(
                  `/admin/clinics/${clinic.id}/discovery`,
                  discoveryData(f, true),
                  "PUT",
                );
                setClinic(null);
              }}
            >
              <DiscoveryFields clinic={clinic} includeGoogle />
              <p className="muted">
                Google puanları ve fotoğrafları hasta uygulamasında istek
                üzerine alınır. Google, Places API üzerinden sosyal medya
                bağlantılarını sağlamaz.
              </p>
            </Form>
          </details>
          <Form
            label="Klinik kararını kaydet"
            onSave={async (f) => {
              await act(
                `/admin/clinics/${clinic.id}/review`,
                { status: f.get("status"), review_notes: f.get("notes") },
                "PATCH",
              );
              setClinic(null);
            }}
          >
            <Field label="Hesap durumu">
              <select name="status" defaultValue={clinic.status}>
                {["pending", "active", "suspended", "rejected"].map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Doğrulama / karar notları"
              hint="Kliniği askıya alırken veya reddederken gereklidir."
            >
              <textarea
                name="notes"
                rows={4}
                defaultValue={clinic.review_notes}
                maxLength={2000}
              />
            </Field>
            <p className="muted">
              Kliniği askıya almak veya reddetmek açık oturumlarını kapatır;
              vaka erişimini ve yeni gönderimleri engeller.
            </p>
          </Form>
        </Modal>
      )}
      {billing && (
        <Modal
          title={`Subscription · ${billing.name}`}
          close={() => setBilling(null)}
        >
          <Form
            onSave={async (f) => {
              await act(
                `/admin/clinics/${billing.id}/subscription`,
                {
                  subscription: f.get("subscription"),
                  monthly_fee_minor: Math.round(Number(f.get("fee")) * 100),
                  renewal_date: f.get("renewal"),
                },
                "PUT",
              );
              setBilling(null);
            }}
          >
            <Field label="Abonelik durumu">
              <select name="subscription" defaultValue={billing.subscription}>
                {["trial", "active", "past_due", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Aylık ücret (TRY)">
              <input
                name="fee"
                type="number"
                min={0}
                max={100000}
                step="0.01"
                defaultValue={billing.monthly_fee_minor / 100}
                required
              />
            </Field>
            <Field label="Yenileme tarihi">
              <input
                name="renewal"
                type="date"
                defaultValue={billing.renewal_date}
              />
            </Field>
          </Form>
        </Modal>
      )}
      {proposal && (
        <ProposalDetail
          p={data.proposals.find((p) => p.id === proposal.id) || proposal}
          role="admin"
          act={act}
          close={() => setProposal(null)}
        />
      )}
      {glossary && (
        <Modal
          title={`Glossary · ${glossary.name}`}
          close={() => setGlossary(null)}
        >
          <Form
            label="Yeni sözlük sürümünü kaydet"
            onSave={async (f) => {
              await act(
                `/admin/glossary/${glossary.code}`,
                {
                  explanation: f.get("text"),
                  reviewed: f.get("reviewed") === "on",
                  reviewer: f.get("reviewer"),
                },
                "PUT",
              );
              setGlossary(null);
            }}
          >
            <Field label="Sade dilli açıklama">
              <textarea
                name="text"
                rows={6}
                minLength={20}
                maxLength={700}
                defaultValue={glossary.explanation}
                required
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                name="reviewed"
                defaultChecked={glossary.reviewed}
              />
              Bu ifade bir diş hekimi tarafından incelendi
            </label>
            <Field
              label="İnceleyen diş hekiminin adı"
              hint="İnceleme kaydı için gereklidir."
            >
              <input
                name="reviewer"
                maxLength={100}
                defaultValue={glossary.reviewer}
              />
            </Field>
          </Form>
        </Modal>
      )}
      {caseAction && c && (
        <Modal
          title={
            caseAction === "archive" ? "Vakayı arşivle" : "Vakayı yeniden aç"
          }
          close={() => setCaseAction(null)}
        >
          <p className="muted">
            {caseAction === "archive"
              ? "Arşivleme yeni teklifleri ve hasta taleplerini engeller; kayıtları ve mevcut randevuları korur."
              : "Yeniden açma, vakanın önceki alıcı listesini geri yükler."}
          </p>
          <Form
            label={
              caseAction === "archive" ? "Vakayı arşivle" : "Vakayı yeniden aç"
            }
            onSave={async (f) => {
              await act(
                `/admin/cases/${c.id}`,
                { action: caseAction, reason: f.get("reason") },
                "PATCH",
              );
              setCaseAction(null);
            }}
          >
            <Field label="İşlemin gerekçesi">
              <textarea
                name="reason"
                rows={3}
                minLength={3}
                maxLength={500}
                required
              />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
