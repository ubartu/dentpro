"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  FileText,
  ScanLine,
  ShieldCheck,
  ImageOff,
  Download,
  ExternalLink,
  Clock,
  Building2,
  Save,
  Mail,
  Activity,
} from "lucide-react";
import {
  Action,
  Auth,
  DentalCase,
  Proposal,
  Workspace,
  API,
  money,
  date,
  datetime,
  label,
  csv,
} from "../types";
import {
  Badge,
  Empty,
  Field,
  Form,
  Heading,
  Stat,
  SearchBox,
  Confirm,
  RowLink,
} from "./ui";
import {
  AppointmentsPanel,
  MembersPanel,
  ProfileFields,
  profileData,
  DiscoveryFields,
  discoveryData,
  ProposalEditor,
  ProposalDetail,
} from "./forms";
export const caseStatus = (c: DentalCase) =>
  c.status === "archived"
    ? "archived"
    : c.active_proposals
      ? "proposed"
      : c.draft
        ? "draft"
        : c.review_status;
const caseFilters = [
  "all",
  "new",
  "unanswered",
  "reviewing",
  "draft",
  "proposed",
  "declined",
  "archived",
];
const needsResponse = (c: DentalCase) =>
  c.status !== "archived" &&
  !c.active_proposals &&
  c.review_status !== "declined";
const prioritizeCases = (cases: DentalCase[]) =>
  [...cases].sort(
    (a, b) =>
      Number(needsResponse(b)) - Number(needsResponse(a)) ||
      b.created_at.localeCompare(a.created_at),
  );
export function CaseTable({
  cases,
  base = "/clinic",
  limit,
  filtered = false,
}: {
  cases: DentalCase[];
  base?: string;
  limit?: number;
  filtered?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Vaka</th>
            <th>Bölge</th>
            <th>Alınma tarihi</th>
            <th>Durum</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cases.slice(0, limit).map((c) => (
            <tr
              key={c.id}
              className={
                base === "/clinic" && needsResponse(c)
                  ? "case-needs-response"
                  : undefined
              }
            >
              <td>
                <Link className="cell-title" href={`${base}/cases/${c.id}`}>
                  {c.title}
                </Link>
                <small>{c.reference}</small>
                {base === "/clinic" && needsResponse(c) && (
                  <span className="response-label">
                    <Clock size={13} aria-hidden="true" />
                    Yanıt bekliyor
                  </span>
                )}
              </td>
              <td>{label(c.region)}</td>
              <td>{date(c.created_at)}</td>
              <td>
                <Badge>{base === "/admin" ? c.status : caseStatus(c)}</Badge>
              </td>
              <td>
                <RowLink href={`${base}/cases/${c.id}`}>Vakayı aç</RowLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!cases.length && (
        <Empty
          title={filtered ? "Eşleşen vaka yok" : "Gösterilecek vaka yok"}
          description={
            filtered
              ? "Daha fazla vaka görmek için başka bir durum seçin veya aramayı temizleyin."
              : "Bu klinikle paylaşılan vakalar gelen kutusunda görünecek."
          }
        />
      )}
    </div>
  );
}
export function ActivityChart({ proposals }: { proposals: Proposal[] }) {
  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      label: d.toLocaleDateString("tr-TR", { weekday: "short" }),
      count: proposals.filter(
        (p) => new Date(p.created_at).toDateString() === d.toDateString(),
      ).length,
    };
  });
  const max = Math.max(1, ...bars.map((x) => x.count));
  return (
    <div className="chart" aria-label="Son yedi günde gönderilen teklifler">
      {bars.map((b, i) => (
        <div className="chart-column" key={i}>
          <strong>{b.count}</strong>
          <div className="bar-track">
            <div
              style={{
                height: `${b.count ? Math.max(5, (b.count / max) * 100) : 2}%`,
              }}
            />
          </div>
          <span>{b.label}</span>
        </div>
      ))}
    </div>
  );
}
export function ImageViewer({ c, auth }: { c: DentalCase; auth: Auth }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [zoom, setZoom] = useState(false);
  useEffect(() => {
    let alive = true;
    let blob = "";
    setUrl("");
    setError("");
    if (c.asset?.available) {
      fetch(API + `/cases/${c.id}/xray`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
        .then(async (r) => {
          if (!r.ok)
            throw Error(
              "Görüntüye erişilemedi. Oturumu yenileyip yeniden deneyin.",
            );
          return r.blob();
        })
        .then((b) => {
          blob = URL.createObjectURL(b);
          if (alive) setUrl(blob);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }
    return () => {
      alive = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [c.id, c.asset?.available, auth.token]);
  return (
    <section className="panel image-panel">
      <div className="panel-heading">
        <h3>
          <ScanLine size={18} />
          Vaka görüntüsü
        </h3>
        {url && (
          <div className="row">
            <a className="text-link" href={url} download={c.asset?.name}>
              <Download size={14} />
              İndir
            </a>
            {c.asset?.type !== "application/pdf" && (
              <button className="text-link" onClick={() => setZoom(!zoom)}>
                {zoom ? "Görüntüyü sığdır" : "Yakınlaştır"}
              </button>
            )}
          </div>
        )}
      </div>
      {url ? (
        <div className={"image-view " + (zoom ? "zoom" : "")}>
          {c.asset?.type === "application/pdf" ? (
            <iframe
              title="Yüklenen vaka PDF'i"
              src={url}
              sandbox="allow-same-origin"
            />
          ) : (
            <img src={url} alt="Hastanın yüklediği vaka görüntüsü" />
          )}
        </div>
      ) : (
        <div className="image-empty">
          <ImageOff size={38} />
          <strong>
            {error ||
              (!c.asset?.available
                ? "İncelenebilir görüntü eklenmemiş"
                : "Vaka görüntüsü yükleniyor…")}
          </strong>
          <p>
            {c.asset && !c.asset.available
              ? "Bu sentetik örnekte klinik röntgen yok."
              : "Yalnızca bu vakayla gönderilen materyalleri inceleyin."}
          </p>
        </div>
      )}
      <div className="image-footer">
        <ShieldCheck size={14} />
        Yetkili erişim denetim kaydına işlenir.
      </div>
    </section>
  );
}
export default function ClinicScreen({
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("status") || "all";
  const caseFilter = caseFilters.includes(requestedFilter)
    ? requestedFilter
    : "all";
  const caseFilterHref = (status: string) =>
    status === "all" ? "/clinic/cases" : `/clinic/cases?status=${status}`;
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [editor, setEditor] = useState<{
      c: DentalCase;
      revision?: Proposal;
    } | null>(null),
    [detail, setDetail] = useState<Proposal | null>(null),
    [withdraw, setWithdraw] = useState<Proposal | null>(null),
    [discard, setDiscard] = useState<DentalCase | null>(null);
  const clinic = data.clinic!;
  const actionable = data.cases.filter(
    (c) => c.status !== "archived" && caseStatus(c) === "new",
  );
  const unanswered = data.cases.filter(needsResponse);
  const requests = data.appointments.filter((a) => a.status === "requested");
  const submitted = data.proposals.filter((p) => p.status === "submitted");
  const c = entityId ? data.cases.find((c) => c.id === entityId) : undefined;
  const revise = (p: Proposal) => {
    const c = data.cases.find((c) => c.id === p.case_id);
    if (c) {
      setDetail(null);
      setEditor({ c, revision: p });
    }
  };
  function render() {
    if (section === "overview")
      return (
        <>
          <Heading
            eyebrow="KLİNİK GENEL BAKIŞI"
            title={`Tekrar hoş geldiniz, ${auth.user.name.replace(/^Dr\.?\s*/, "").split(" ")[0]}.`}
            description={`${clinic.name} için ilgilenmeniz gerekenler.`}
          >
            <Link className="primary" href="/clinic/cases">
              Vaka gelen kutusunu aç
              <ArrowRight size={16} />
            </Link>
          </Heading>
          <div className="stats">
            <Stat
              label="İnceleme bekliyor"
              value={actionable.length}
              note={
                actionable.length
                  ? "Yeni vakalar · Şimdi incele"
                  : "İnceleme bekleyen yeni vaka yok"
              }
              href="/clinic/cases?status=new"
              attention={actionable.length > 0}
            />
            <Stat
              label="Kayıtlı taslaklar"
              value={data.cases.filter((c) => c.draft).length}
              note="Devam etmeye hazır"
              href="/clinic/proposals"
            />
            <Stat
              label="Aktif teklifler"
              value={submitted.length}
              note="Hastalara gönderildi"
              href="/clinic/proposals"
            />
            <Stat
              label="Yeni talepler"
              value={requests.length}
              note="Geri arama ve randevular"
              href="/clinic/appointments"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel flush">
              <div className="panel-heading">
                <div>
                  <h2>Vaka gelen kutunuz</h2>
                  <p>Yanıtsız vakalar önce; her grupta en yeniler üstte.</p>
                </div>
                <RowLink href="/clinic/cases">Tümünü gör</RowLink>
              </div>
              <CaseTable
                cases={prioritizeCases(
                  data.cases.filter((c) => c.status !== "archived"),
                )}
                limit={5}
              />
            </section>
            <section className="panel attention-panel">
              <span className="square-icon">
                <Clock size={23} />
              </span>
              <h2>Sonraki adımı netleştirin.</h2>
              <p>
                {requests.length
                  ? `${requests.length} hasta talebi ekibinizin yanıtını bekliyor. Teklifi inceleyin, zaman belirleyin ve talebi güncelleyin.`
                  : "Gelen randevu talepleriniz güncel. Yeni hasta talepleri burada görünecek."}
              </p>
              <Link className="primary" href="/clinic/appointments">
                Talepleri yönet
                <ArrowRight size={16} />
              </Link>
              <div className="mini-summary">
                <span>Klinik hesabı</span>
                <Badge>{clinic.status}</Badge>
              </div>
              <div className="mini-summary">
                <span>Abonelik</span>
                <Badge>{clinic.subscription}</Badge>
              </div>
            </section>
          </div>
          <div className="dashboard-grid equal">
            <section className="panel">
              <div className="panel-heading unpadded">
                <div>
                  <h2>Teklif etkinliği</h2>
                  <p>Son 7 gündeki gönderimler</p>
                </div>
                <Activity size={18} />
              </div>
              <ActivityChart proposals={data.proposals} />
            </section>
            <section className="panel">
              <div className="panel-heading unpadded">
                <div>
                  <h2>Yaklaşan randevular</h2>
                  <p>Ekibinizin koordine ettiği onaylı ziyaretler.</p>
                </div>
                <RowLink href="/clinic/appointments">Tümünü gör</RowLink>
              </div>
              {data.appointments.filter((a) => a.status === "confirmed")
                .length ? (
                data.appointments
                  .filter((a) => a.status === "confirmed")
                  .sort((a, b) =>
                    (a.scheduled_at || "").localeCompare(b.scheduled_at || ""),
                  )
                  .slice(0, 3)
                  .map((a) => (
                    <div className="activity-row" key={a.id}>
                      <Clock size={17} />
                      <div>
                        <strong>{a.case_title}</strong>
                        <small>{datetime(a.scheduled_at)}</small>
                      </div>
                      <Badge>{a.status}</Badge>
                    </div>
                  ))
              ) : (
                <Empty
                  title="Henüz onaylı ziyaret yok"
                  description="Burada görünmesi için randevu taleplerinden bir tarih onaylayın."
                />
              )}
            </section>
          </div>
        </>
      );
    if (section === "cases" && entityId) {
      if (!c)
        return (
          <Empty
            title="Vaka bulunamadı"
            description="Bu vaka artık kliniğinize atanmış olmayabilir."
          />
        );
      const plans = data.proposals.filter((p) => p.case_id === c.id);
      const current = plans.find((p) => p.status === "submitted");
      return (
        <>
          <Link className="back-link" href="/clinic/cases">
            ← Vaka gelen kutusuna dön
          </Link>
          <Heading
            eyebrow={`${c.reference} · ${label(c.region)}`}
            title={c.title}
            description={`${date(c.created_at)} tarihinde alındı · İnceleme sırasında hasta kimliği korunur.`}
          >
            {c.status !== "archived" && (
              <button
                className="primary"
                onClick={() => setEditor({ c, revision: current })}
              >
                <FileText size={16} />
                {c.draft
                  ? "Taslağa devam et"
                  : current
                    ? "Teklifi düzenle"
                    : "Teklif oluştur"}
              </button>
            )}
          </Heading>
          <div className="case-detail-grid">
            <div>
              <ImageViewer c={c} auth={auth} />
              <section className="panel">
                <div className="panel-heading unpadded">
                  <h2>Teklif geçmişi</h2>
                  <Badge>{plans.length} sürüm</Badge>
                </div>
                {plans.map((p) => (
                  <div className="activity-row" key={p.id}>
                    <FileText size={19} />
                    <div>
                      <strong>
                        Sürüm {p.version} ·{" "}
                        {money(p.total_minor, p.plan.currency)}
                      </strong>
                      <small>
                        {date(p.created_at)} · {p.plan.items.length} işlem ·{" "}
                        {p.plan.sessions} seans
                      </small>
                    </div>
                    <Badge>{p.status}</Badge>
                    <button className="text-link" onClick={() => setDetail(p)}>
                      Görüntüle
                    </button>
                  </div>
                ))}
                {!plans.length && (
                  <p className="muted">
                    Bu vaka için henüz teklif yayımlanmadı.
                  </p>
                )}
                {c.draft && (
                  <div className="draft-note">
                    <Save size={18} />
                    <div>
                      <strong>Kayıtlı taslak</strong>
                      <small>Güncellendi {datetime(c.draft.updated_at)}</small>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setEditor({ c, revision: current })}
                    >
                      Devam et
                    </button>
                    <button
                      className="text-link danger"
                      onClick={() => setDiscard(c)}
                    >
                      Sil
                    </button>
                  </div>
                )}
              </section>
            </div>
            <aside>
              <section className="panel">
                <h2>Vaka incelemesi</h2>
                <div className="mini-summary">
                  <span>Vaka durumu</span>
                  <Badge>{caseStatus(c)}</Badge>
                </div>
                <div className="mini-summary">
                  <span>Paylaşım onayı</span>
                  <Badge>{c.consent_recorded ? "recorded" : "missing"}</Badge>
                </div>
                <Form
                  onSave={(f) =>
                    act(
                      `/clinic/cases/${c.id}/review`,
                      { status: f.get("status"), notes: f.get("notes") },
                      "PATCH",
                    )
                  }
                >
                  <Field label="İnceleme durumunuz">
                    <select
                      name="status"
                      defaultValue={c.review_status}
                      disabled={c.status === "archived"}
                    >
                      <option value="new">Yeni</option>
                      <option value="reviewing">İnceleniyor</option>
                      <option value="declined">Reddedildi</option>
                    </select>
                  </Field>
                  <Field
                    label="Klinik içi notlar"
                    hint="Yalnızca klinik ekibiniz görebilir."
                  >
                    <textarea
                      name="notes"
                      rows={6}
                      maxLength={3000}
                      defaultValue={c.internal_notes}
                      disabled={c.status === "archived"}
                    />
                  </Field>
                  {c.status === "archived" && (
                    <p className="muted">Platform bu vakayı arşivledi.</p>
                  )}
                </Form>
              </section>
              <div className="notice">
                <ShieldCheck size={20} />
                <p>
                  Tedavi planını klinik oluşturur. DENTRIVO açıklamayı ayrı
                  hazırlar; röntgeni değerlendirmez.
                </p>
              </div>
            </aside>
          </div>
        </>
      );
    }
    if (section === "cases") {
      const rows = prioritizeCases(
        data.cases.filter(
          (c) =>
            `${c.title} ${c.reference}`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (caseFilter === "all" ||
              (caseFilter === "unanswered"
                ? needsResponse(c)
                : caseStatus(c) === caseFilter)),
        ),
      );
      return (
        <>
          <Heading
            eyebrow="KLİNİK İŞ AKIŞI"
            title="Vaka gelen kutusu"
            description="Paylaşılan vakaları ve görüntüleri inceleyip mesleki yanıtınızı hazırlayın."
          />
          {unanswered.length > 0 && (
            <div className="case-attention-summary">
              <Clock size={22} aria-hidden="true" />
              <div>
                <strong>{unanswered.length} vaka yanıt bekliyor</strong>
                <p>
                  Aktif teklifi olmayan yeni, incelemede ve taslak vakalar.
                  Reddedilen ve arşivlenenler dahil değildir.
                </p>
              </div>
            </div>
          )}
          <nav
            className="case-quick-filters"
            aria-label="Vaka gelen kutusu filtreleri"
          >
            {[
              ["all", "Tüm vakalar", data.cases.length],
              ["new", "İnceleme bekliyor", actionable.length],
              ["unanswered", "Yanıtsız", unanswered.length],
            ].map(([value, label, count]) => (
              <Link
                key={value}
                href={caseFilterHref(String(value))}
                aria-current={caseFilter === value ? "page" : undefined}
              >
                {label}
                <span>{count}</span>
              </Link>
            ))}
          </nav>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Vaka veya referans ara…"
            />
            <select
              aria-label="Vaka durumu"
              value={caseFilter}
              onChange={(e) =>
                router.push(caseFilterHref(e.target.value), { scroll: false })
              }
            >
              {caseFilters.map((s) => (
                <option key={s} value={s}>
                  {s === "all"
                    ? "Tüm durumlar"
                    : s === "new"
                      ? "Yeni · inceleme bekliyor"
                      : s === "unanswered"
                        ? "Yanıtsız"
                        : label(s)}
                </option>
              ))}
            </select>
            <span className="result-count" role="status">
              {rows.length} vaka
            </span>
            {search && (
              <button className="text-link" onClick={() => setSearch("")}>
                Aramayı temizle
              </button>
            )}
          </div>
          <section className="panel flush">
            <CaseTable
              cases={rows}
              filtered={caseFilter !== "all" || !!search}
            />
          </section>
        </>
      );
    }
    if (section === "proposals") {
      const rows = data.proposals.filter(
        (p) =>
          `${p.case_title} ${p.id}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" || p.status === filter),
      );
      return (
        <>
          <Heading
            eyebrow="TEDAVİ PLANLARI"
            title="Teklifler ve taslaklar"
            description="Kayıtlı taslakları, yayımlanmış planları, sürümleri ve geri çekilen teklifleri yönetin."
          />
          <div className="drafts-grid">
            {data.cases
              .filter((c) => c.draft)
              .map((c) => (
                <div className="draft-card" key={c.id}>
                  <Save size={20} />
                  <div>
                    <Badge>draft</Badge>
                    <h3>{c.title}</h3>
                    <p>Kaydedilenler {datetime(c.draft?.updated_at)}</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setEditor({ c })}
                  >
                    Devam et
                    <ArrowRight size={15} />
                  </button>
                </div>
              ))}
          </div>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Tekliflerde ara…"
            />
            <select
              aria-label="Teklif durumu"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "submitted", "superseded", "withdrawn"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Tüm durumlar" : label(s)}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={() =>
                csv(
                  "clinic-proposals.csv",
                  rows.map((p) => ({
                    case: p.case_title,
                    version: p.version,
                    status: p.status,
                    total: p.total_minor / 100,
                    currency: p.plan.currency,
                    visits: p.plan.sessions,
                    created: p.created_at,
                  })),
                )
              }
            >
              <Download size={15} />
              Dışa aktar
            </button>
          </div>
          <section className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vaka / teklif</th>
                    <th>Tahmini toplam</th>
                    <th>Seanslar</th>
                    <th>Durum</th>
                    <th>Açıklama</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.case_title}</strong>
                        <small>
                          Sürüm {p.version} · {date(p.created_at)}
                        </small>
                      </td>
                      <td>{money(p.total_minor, p.plan.currency)}</td>
                      <td>{p.plan.sessions}</td>
                      <td>
                        <Badge>{p.status}</Badge>
                        {p.moderation === "flagged" && <Badge>flagged</Badge>}
                      </td>
                      <td>
                        <Badge>{p.explanation_status}</Badge>
                      </td>
                      <td>
                        <div className="row">
                          <button
                            className="text-link"
                            onClick={() => setDetail(p)}
                          >
                            Görüntüle
                          </button>
                          {p.status === "submitted" && (
                            <>
                              <button
                                className="text-link"
                                onClick={() => revise(p)}
                              >
                                Düzenle
                              </button>
                              <button
                                className="text-link danger"
                                onClick={() => setWithdraw(p)}
                              >
                                Geri çek
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <Empty
                title="Eşleşen teklif yok"
                description="Gelen kutunuzdaki bir vakadan teklif oluşturun."
              />
            )}
          </section>
        </>
      );
    }
    if (section === "appointments")
      return (
        <>
          <Heading
            eyebrow="HASTA KOORDİNASYONU"
            title="Randevular ve geri aramalar"
            description="Talepleri ilk iletişimden onaylı ziyarete taşıyıp tamamlanmalarını izleyin."
          />
          <AppointmentsPanel
            appointments={data.appointments}
            role="clinic"
            act={act}
          />
        </>
      );
    if (section === "team")
      return (
        <>
          <Heading
            eyebrow="KLİNİK ERİŞİMİ"
            title="Ekibiniz"
            description="Personel hesapları oluşturun ve klinik çalışma alanına erişimi yönetin."
          />
          <MembersPanel
            accounts={data.members || []}
            clinics={[clinic]}
            role="clinic"
            act={act}
            currentId={auth.user.id}
          />
        </>
      );
    if (section === "profile")
      return (
        <>
          <Heading
            eyebrow="KLİNİK AYARLARI"
            title="Klinik profili"
            description="Kliniğinizin iletişim ve çalışma bilgilerini güncel tutun."
          />
          <div className="settings-grid">
            <section className="panel">
              <Form
                onSave={(f) => act("/clinic/profile", profileData(f), "PUT")}
              >
                <ProfileFields clinic={clinic} />
              </Form>
              <h2>Sosyal medya profilleri</h2>
              <Form
                label="Sosyal medya profillerini kaydet"
                onSave={(f) =>
                  act("/clinic/discovery", discoveryData(f), "PUT")
                }
              >
                <DiscoveryFields clinic={clinic} />
                <p className="muted">
                  Google Place ID bilginizi yönetici doğrular ve bağlar.
                </p>
              </Form>
            </section>
            <section className="panel fit">
              <span className="square-icon">
                <Building2 size={24} />
              </span>
              <h2>{clinic.name}</h2>
              <p className="muted">
                {label(clinic.region)} · {clinic.district}
              </p>
              <div className="mini-summary">
                <span>Platform durumu</span>
                <Badge>{clinic.status}</Badge>
              </div>
              <p className="muted">
                Onay ve bölge değişiklikleri platform yöneticisi tarafından
                yapılır.
              </p>
              {clinic.review_notes && <p>{clinic.review_notes}</p>}
            </section>
          </div>
        </>
      );
    if (section === "subscription")
      return (
        <>
          <Heading
            eyebrow="KLİNİK ABONELİĞİ"
            title="Plan ve abonelik"
            description="Kliniğinizin platform erişimi ve abonelik kaydı."
          />
          <div className="settings-grid">
            <section className="panel subscription-card">
              <span className="eyebrow">DENTRIVO KLİNİK</span>
              <h2>Klinik çalışma alanı</h2>
              <Badge>{clinic.subscription}</Badge>
              <div className="subscription-price">
                {money(clinic.monthly_fee_minor)}
                <small>/ ay</small>
              </div>
              <p>
                Yenileme tarihi:{" "}
                <strong>
                  {clinic.renewal_date
                    ? date(clinic.renewal_date)
                    : "Planlanmadı"}
                </strong>
              </p>
              <ul>
                <li>Paylaşılan vaka gelen kutusu ve görüntü incelemesi</li>
                <li>Yapılandırılmış teklifler ve sürüm geçmişi</li>
                <li>Ekip erişimi ve randevu koordinasyonu</li>
              </ul>
            </section>
            <section className="panel fit">
              <h2>Abonelik yönetimi</h2>
              <p className="muted">
                Bu kaydı platform yöneticiniz yönetir. Bu ortamda ödeme
                tahsilatı ve faturalar bağlı değildir.
              </p>
              <div className="mini-summary">
                <span>Hesap durumu</span>
                <Badge>{clinic.status}</Badge>
              </div>
              <p className="muted">
                Plan veya fatura bilgilerini değiştirmek için platform
                yöneticinizle iletişime geçin.
              </p>
            </section>
          </div>
        </>
      );
    if (section === "analytics")
      return (
        <>
          <Heading
            eyebrow="KLİNİK PERFORMANSI"
            title="Etkinlik ve yanıtlar"
            description="Gerçek vaka, teklif ve randevu kayıtlarınıza dayalı işlem sayıları."
          />
          <div className="stats">
            <Stat
              label="Atanan vakalar"
              value={data.cases.length}
              note="Tüm vaka atamaları"
            />
            <Stat
              label="Teklifi olan vakalar"
              value={data.cases.filter((c) => c.active_proposals > 0).length}
              note="Gönderilmiş güncel planlar"
            />
            <Stat
              label="Onaylı ziyaretler"
              value={
                data.appointments.filter((a) => a.status === "confirmed").length
              }
              note="Planlanan randevular"
            />
            <Stat
              label="Tamamlanan ziyaretler"
              value={
                data.appointments.filter((a) => a.status === "completed").length
              }
              note="Ekibinizce tamamlandı olarak işaretlenenler"
            />
          </div>
          <div className="dashboard-grid equal">
            <section className="panel">
              <h2>Teklif gönderimleri</h2>
              <p className="muted">Son 7 gün · sürümler dahil</p>
              <ActivityChart proposals={data.proposals} />
            </section>
            <section className="panel">
              <h2>Vaka yanıt dağılımı</h2>
              {[
                "new",
                "reviewing",
                "draft",
                "proposed",
                "declined",
                "archived",
              ].map((s) => (
                <div className="mini-summary" key={s}>
                  <Badge>{s}</Badge>
                  <strong>
                    {data.cases.filter((c) => caseStatus(c) === s).length}
                  </strong>
                </div>
              ))}
            </section>
          </div>
        </>
      );
    return (
      <Empty
        title="Sayfa bulunamadı"
        description="Klinik menüsünden bir sayfa seçin."
      />
    );
  }
  return (
    <>
      {render()}
      {editor && (
        <ProposalEditor
          c={editor.c}
          revision={editor.revision}
          act={act}
          close={() => setEditor(null)}
        />
      )}
      {detail && (
        <ProposalDetail
          p={data.proposals.find((p) => p.id === detail.id) || detail}
          role="clinic"
          act={act}
          close={() => setDetail(null)}
          onRevise={revise}
        />
      )}
      {withdraw && (
        <Confirm
          title="Bu teklif geri çekilsin mi?"
          description="Yeni hasta taleplerinde görünmeyecek. Mevcut randevu kayıtları ve sürüm geçmişi korunacak."
          close={() => setWithdraw(null)}
          onConfirm={() => act(`/clinic/proposals/${withdraw.id}/withdraw`)}
        />
      )}
      {discard && (
        <Confirm
          title="Kayıtlı taslak silinsin mi?"
          description="Kayıtlı taslak silinecek. Yayımlanan teklifler değişmeyecek."
          close={() => setDiscard(null)}
          onConfirm={() =>
            act(`/clinic/cases/${discard.id}/draft`, undefined, "DELETE")
          }
        />
      )}
    </>
  );
}
