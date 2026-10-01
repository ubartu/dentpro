"use client";
import { useEffect, useRef, useState, FormEvent } from "react";
import ToothSelector from "./tooth-selector";
import {
  Plus,
  Trash2,
  Send,
  Save,
  FileText,
  Sparkles,
  ArrowUpRight,
  CalendarDays,
  Download,
  Users,
} from "lucide-react";
import {
  Action,
  Account,
  Appointment,
  Clinic,
  DentalCase,
  Item,
  Plan,
  Proposal,
  Role,
  money,
  date,
  datetime,
  names,
  urgencies,
  label,
  csv,
  matchesSearch,
} from "../types";
import {
  Badge,
  Empty,
  Field,
  Form,
  Modal,
  SearchBox,
  Confirm,
  RowLink,
} from "./ui";
export function ProposalEditor({
  c,
  revision,
  act,
  close,
}: {
  c: DentalCase;
  revision?: Proposal;
  act: Action;
  close: () => void;
}) {
  const initial = c.draft?.plan || revision?.plan;
  const revisionOf = c.draft?.revision_of || revision?.id || null;
  const [items, setItems] = useState<Item[]>(
    initial?.items || [
      {
        tooth: "16",
        procedure_code: "ROOT_CANAL",
        material: null,
        price_minor: 0,
        sessions: 1,
      },
    ],
  );
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<Plan["currency"]>(
    initial?.currency || "TRY",
  );
  const [activeProcedure, setActiveProcedure] = useState(0);
  const toothSelectorRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const requestClose = () => {
    if (saving.current) return;
    if (
      !dirty ||
      window.confirm(
        "Kaydedilmemiş değişiklikleriniz var. Kaydetmeden kapatmak istiyor musunuz?",
      )
    )
      close();
  };
  const localTime = (s: string | null | undefined) =>
    s
      ? new Date(
          new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  const update = (i: number, patch: Partial<Item>) => {
    if (saving.current) return;
    setItems((current) =>
      current.map((x, j) => (i === j ? { ...x, ...patch } : x)),
    );
    setKey(crypto.randomUUID());
    setSaved("");
    setDirty(true);
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    const f = new FormData(e.currentTarget);
    const intent = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    const plan: Plan = {
      items,
      sessions: Number(f.get("sessions")),
      requires_exam: f.get("exam") === "on",
      first_available_slot: f.get("slot")
        ? new Date(String(f.get("slot"))).toISOString()
        : null,
      notes: String(f.get("notes")),
      currency,
    };
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (intent === "draft") {
        await act(
          `/clinic/cases/${c.id}/draft`,
          { plan, revision_of: revisionOf },
          "PUT",
        );
        setDirty(false);
        setSaved("Taslak kaydedildi. Yalnızca kliniğiniz görebilir.");
      } else {
        await act(`/clinic/cases/${c.id}/publish`, {
          plan,
          revision_of: revisionOf,
          _idempotency: key,
        });
        close();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={revisionOf ? "Tedavi teklifini düzenle" : "Tedavi teklifi oluştur"}
      close={requestClose}
      closeDisabled={busy}
      wide
    >
      <div className="editor-context">
        <FileText size={19} />
        <div>
          <strong>{c.title}</strong>
          <small>
            {c.reference} · {label(c.region)} · Hastanın seçtiği klinik
            incelemesi
          </small>
        </div>
        <Badge>{revisionOf ? "Yeni sürüm" : "Taslak"}</Badge>
      </div>
      <form
        onSubmit={submit}
        onChange={() => {
          setKey(crypto.randomUUID());
          setSaved("");
          setDirty(true);
        }}
      >
        <fieldset
          disabled={busy}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <div className="editor-label">
            <h3>1. Tedavi planı</h3>
            <p>Bu teklifin kaynağı mesleki değerlendirmenizdir.</p>
          </div>
          <Field
            label="Teklif para birimi"
            hint="Para birimini değiştirmek fiyatları dönüştürmez. Yayımlamadan önce tüm tutarları kontrol edin."
          >
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Plan["currency"])}
            >
              <option value="TRY">TRY · Türk lirası</option>
              <option value="USD">USD · ABD doları</option>
              <option value="EUR">EUR · Avro</option>
            </select>
          </Field>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const rank = { urgent: 0, soon: 1, routine: 2 };
              const focused = items[activeProcedure];
              const ordered = [...items].sort(
                (a, b) =>
                  rank[a.urgency || "routine"] - rank[b.urgency || "routine"],
              );
              setItems(ordered);
              setActiveProcedure(ordered.indexOf(focused));
              setKey(crypto.randomUUID());
              setSaved("");
              setDirty(true);
            }}
          >
            Aciliyete göre sırala
          </button>
          <Field label="Diş seçimi için işlem belirleyin">
            <select
              value={activeProcedure}
              onChange={(e) => {
                e.stopPropagation();
                setActiveProcedure(Number(e.target.value));
              }}
            >
              {items.map((item, i) => (
                <option key={i} value={i}>
                  İşlem {i + 1} · {names[item.procedure_code]} · Diş{" "}
                  {item.tooth}
                </option>
              ))}
            </select>
          </Field>
          <div ref={toothSelectorRef}>
            <ToothSelector
              selected={items[activeProcedure].tooth}
              assigned={items.map((item) => item.tooth)}
              procedure={activeProcedure + 1}
              onSelect={(tooth) => update(activeProcedure, { tooth })}
            />
          </div>
          {items.map((item, i) => (
            <div
              className={
                "procedure-editor" +
                (activeProcedure === i ? " active-procedure" : "")
              }
              key={i}
              onFocusCapture={() => setActiveProcedure(i)}
            >
              <div className="spread">
                <strong>İşlem {i + 1}</strong>
                <div className="procedure-actions">
                  <button
                    type="button"
                    className="text-link"
                    aria-label={`${i + 1}. işlem için dişi 3B görünümde seç`}
                    onClick={() => {
                      setActiveProcedure(i);
                      toothSelectorRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    Dişi 3B görünümde seç
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`İşlem ${i + 1} sil`}
                    disabled={items.length === 1}
                    onClick={() => {
                      setItems(items.filter((_, j) => j !== i));
                      setActiveProcedure((current) =>
                        current > i
                          ? current - 1
                          : Math.min(current, items.length - 2),
                      );
                      setKey(crypto.randomUUID());
                      setSaved("");
                      setDirty(true);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="form-grid three">
                <Field label="İşlem">
                  <select
                    value={item.procedure_code}
                    onChange={(e) =>
                      update(i, { procedure_code: e.target.value })
                    }
                  >
                    {Object.entries(names).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Diş · FDI numaralandırması">
                  <input
                    required
                    pattern="([1-4][1-8]|[5-8][1-5]|ALL)"
                    value={item.tooth}
                    onChange={(e) => update(i, { tooth: e.target.value })}
                  />
                </Field>
                <Field label={`Fiyat (${currency})`}>
                  <input
                    required
                    type="number"
                    min={0}
                    max={1000000}
                    step="0.01"
                    value={item.price_minor / 100}
                    onChange={(e) =>
                      update(i, {
                        price_minor: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </Field>
                <Field label="Malzeme / marka">
                  <input
                    maxLength={80}
                    placeholder="Belirtin veya boş bırakın"
                    value={item.material || ""}
                    onChange={(e) =>
                      update(i, { material: e.target.value || null })
                    }
                  />
                </Field>
                <Field label="İşlem seansları">
                  <input
                    required
                    type="number"
                    min={1}
                    max={30}
                    value={item.sessions}
                    onChange={(e) =>
                      update(i, { sessions: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field
                  label="Tedavi aciliyeti"
                  hint="Önceliği tedaviyi uygulayan hekim belirler."
                >
                  <select
                    value={item.urgency || "routine"}
                    onChange={(e) =>
                      update(i, { urgency: e.target.value as Item["urgency"] })
                    }
                  >
                    {Object.entries(urgencies).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={items.length >= 32}
            onClick={() => {
              setItems([
                ...items,
                {
                  tooth: "16",
                  procedure_code: "CROWN",
                  material: null,
                  price_minor: 0,
                  sessions: 1,
                },
              ]);
              setActiveProcedure(items.length);
              setKey(crypto.randomUUID());
              setSaved("");
              setDirty(true);
            }}
          >
            <Plus size={16} />
            İşlem ekle
          </button>
          <div className="editor-label">
            <h3>2. Seanslar ve uygunluk</h3>
            <p>Bir seansta birden fazla işlem yapılabilir.</p>
          </div>
          <div className="form-grid">
            <Field label="Planlanan toplam seans">
              <input
                required
                type="number"
                name="sessions"
                min={1}
                max={60}
                defaultValue={initial?.sessions || 1}
              />
            </Field>
            <Field label="İlk uygun randevu">
              <input
                type="datetime-local"
                name="slot"
                defaultValue={localTime(initial?.first_available_slot)}
              />
            </Field>
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              name="exam"
              defaultChecked={initial?.requires_exam ?? true}
            />
            Bu planı kesinleştirmek için yüz yüze muayene gerekli
          </label>
          <Field label="Klinik notlar ve fiyata dahil olanlar">
            <textarea
              name="notes"
              rows={4}
              maxLength={1000}
              defaultValue={initial?.notes || ""}
              placeholder="Önerilen planı, malzemeleri, dahil olanları ve muayene gerekliliklerini açıklayın."
            />
          </Field>
          <div className="proposal-total">
            <div>
              <span>Tahmini toplam</span>
              <small>Kesin fiyat klinik muayeneye bağlıdır.</small>
            </div>
            <strong>
              {money(
                items.reduce((s, i) => s + i.price_minor, 0),
                currency,
              )}
            </strong>
          </div>
          <div className="notice">
            <Sparkles size={18} />
            <p>
              Yayımdan sonra ayrı bir sade dilli açıklama hazırlanır. Tedavi
              planınız değiştirilmez.
            </p>
          </div>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          {saved && (
            <div role="status" className="success-message">
              {saved}
            </div>
          )}
          {dirty && !busy && (
            <p role="status" className="muted">
              Kaydedilmemiş değişiklikler var.
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary"
              type="submit"
              name="intent"
              value="draft"
              disabled={busy}
            >
              <Save size={16} />
              Taslağı kaydet
            </button>
            <button
              className="primary"
              type="submit"
              name="intent"
              value="publish"
              disabled={busy}
            >
              <Send size={16} />
              {busy
                ? "Kaydediliyor…"
                : revisionOf
                  ? "Yeni sürümü yayımla"
                  : "Teklifi yayımla"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export function ProposalDetail({
  p,
  close,
  role,
  act,
  onRevise,
}: {
  p: Proposal;
  close: () => void;
  role: Role;
  act: Action;
  onRevise?: (p: Proposal) => void;
}) {
  const [inspectedTooth, setInspectedTooth] = useState(p.plan.items[0].tooth);
  return (
    <Modal title={`Teklif · sürüm ${p.version}`} close={close} wide>
      <div className="proposal-detail-header">
        <div>
          <h3>{p.clinic_name}</h3>
          <p>
            {p.case_title} · {date(p.created_at)}
          </p>
        </div>
        <Badge>{p.status}</Badge>
      </div>
      <ToothSelector
        readOnly
        selected={inspectedTooth}
        assigned={p.plan.items.map((item) => item.tooth)}
        onSelect={setInspectedTooth}
        procedure={1}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>İşlem</th>
              <th>Diş</th>
              <th>Malzeme</th>
              <th>Seans</th>
              <th>Aciliyet</th>
              <th>Fiyat</th>
            </tr>
          </thead>
          <tbody>
            {p.plan.items.map((x, i) => (
              <tr key={i}>
                <td>{names[x.procedure_code]}</td>
                <td>{x.tooth}</td>
                <td>{x.material || "Belirtilmedi"}</td>
                <td>{x.sessions}</td>
                <td>
                  <Badge>{x.urgency || "routine"}</Badge>
                </td>
                <td>{money(x.price_minor, p.plan.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="proposal-total">
        <span>
          {p.plan.sessions} toplam seans ·{" "}
          {p.plan.requires_exam
            ? "Muayene gerekli"
            : "Muayene gerekliliği işaretlenmedi"}
        </span>
        <strong>{money(p.total_minor, p.plan.currency)}</strong>
      </div>
      <dl className="details">
        <div>
          <dt>İlk uygun tarih</dt>
          <dd>{datetime(p.plan.first_available_slot)}</dd>
        </div>
        <div>
          <dt>Notlar ve dahil olanlar</dt>
          <dd>{p.plan.notes || "Not eklenmedi."}</dd>
        </div>
      </dl>
      <section className="explanation">
        <div className="spread">
          <h3>
            <Sparkles size={18} />
            Hasta açıklaması
          </h3>
          <Badge>{p.explanation?.mode || p.explanation_status}</Badge>
        </div>
        {p.explanation ? (
          <>
            <p>{p.explanation.plain_summary}</p>
            {p.explanation.procedures.map((x) => (
              <p key={x.source_item_id}>{x.simple_explanation}</p>
            ))}
            {!!p.explanation.missing_information.length && (
              <>
                <h4>Netleştirilecek bilgiler</h4>
                {p.explanation.missing_information.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </>
            )}
            <small>{p.explanation.disclaimer}</small>
            <p className="tiny">
              Sözlük: {label(p.explanation.glossary_status)}
            </p>
          </>
        ) : (
          <p>Açıklama hazırlanıyor. Gönderilen klinik planı kaydedildi.</p>
        )}
      </section>
      {role === "admin" ? (
        <Form
          label="İncelemeyi kaydet"
          onSave={async (f) => {
            await act(
              `/admin/proposals/${p.id}/review`,
              { moderation: f.get("moderation"), review_notes: f.get("notes") },
              "PATCH",
            );
            close();
          }}
        >
          <div className="editor-label">
            <h3>Platform incelemesi</h3>
            <p>
              İşaretlenen teklifler, işaret kaldırılana kadar hasta API
              sonuçlarında gösterilmez.
            </p>
          </div>
          <Field label="İnceleme kararı">
            <select name="moderation" defaultValue={p.moderation}>
              <option value="unreviewed">İncelenmedi</option>
              <option value="approved">Onaylandı</option>
              <option value="flagged">İşaretlendi</option>
            </select>
          </Field>
          <Field label="İnceleme notları">
            <textarea
              name="notes"
              defaultValue={p.review_notes}
              maxLength={2000}
              rows={3}
            />
          </Field>
        </Form>
      ) : (
        <>
          {p.review_notes && (
            <div className="notice">
              <p>Platform incelemesi: {p.review_notes}</p>
            </div>
          )}
          {p.status === "submitted" && (
            <div className="form-actions">
              <button className="primary" onClick={() => onRevise?.(p)}>
                Teklifi düzenle
                <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
export function AppointmentsPanel({
  appointments,
  role,
  act,
}: {
  appointments: Appointment[];
  role: Role;
  act: Action;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState<Appointment | null>(null);
  const rows = appointments.filter(
    (a) =>
      (filter === "all" || a.status === filter) &&
      matchesSearch(`${a.case_title} ${a.clinic_name}`, search),
  );
  return (
    <>
      <div className="toolbar">
        <SearchBox
          value={search}
          set={setSearch}
          placeholder="Taleplerde ara…"
        />
        <select
          aria-label="Talepleri duruma göre filtrele"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tüm durumlar</option>
          {[
            "requested",
            "contacted",
            "confirmed",
            "completed",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          onClick={() =>
            csv(
              "appointment-requests.csv",
              rows.map((a) => ({
                case: a.case_title,
                clinic: a.clinic_name,
                type: a.kind,
                status: a.status,
                scheduled_at: a.scheduled_at,
                notes: a.notes,
              })),
            )
          }
        >
          <Download size={15} />
          Dışa aktar
        </button>
      </div>
      <div className="panel flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vaka / talep</th>
                {role === "admin" && <th>Klinik</th>}
                <th>Talep tarihi</th>
                <th>Planlanan tarih</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.case_title}</strong>
                    <small>
                      {a.kind === "callback"
                        ? "Geri arama talebi"
                        : "Randevu talebi"}
                    </small>
                  </td>
                  {role === "admin" && <td>{a.clinic_name}</td>}
                  <td>{date(a.created_at)}</td>
                  <td>{datetime(a.scheduled_at)}</td>
                  <td>
                    <Badge>{a.status}</Badge>
                  </td>
                  <td>
                    <button className="text-link" onClick={() => setEditing(a)}>
                      Yönet
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
            title="Eşleşen talep yok"
            description="Hasta mobil API'sinden gelen talepler burada görünecek."
          />
        )}
      </div>
      {editing && (
        <Modal title="Randevu talebini yönet" close={() => setEditing(null)}>
          <div className="editor-context">
            <CalendarDays size={21} />
            <div>
              <strong>{editing.case_title}</strong>
              <small>{editing.clinic_name}</small>
              {editing.patient_phone && (
                <p>
                  {editing.patient_name} ·{" "}
                  <a
                    href={`tel:${editing.patient_phone.replace(/[^+\d]/g, "")}`}
                  >
                    {editing.patient_phone}
                  </a>
                </p>
              )}
            </div>
          </div>
          <Form
            onSave={async (f) => {
              await act(
                `/operations/appointments/${editing.id}`,
                {
                  status: f.get("status"),
                  scheduled_at: f.get("scheduled")
                    ? new Date(String(f.get("scheduled"))).toISOString()
                    : null,
                  notes: f.get("notes"),
                },
                "PATCH",
              );
              setEditing(null);
            }}
          >
            <Field label="Talep durumu">
              <select name="status" defaultValue={editing.status}>
                {(
                  {
                    requested: [
                      "requested",
                      "contacted",
                      "confirmed",
                      "cancelled",
                    ],
                    contacted: ["contacted", "confirmed", "cancelled"],
                    confirmed: ["confirmed", "completed", "cancelled"],
                    completed: ["completed"],
                    cancelled: ["cancelled"],
                  }[editing.status] || []
                ).map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Randevu tarihi ve saati"
              hint="Randevuyu onaylarken gereklidir."
            >
              <input
                name="scheduled"
                type="datetime-local"
                defaultValue={
                  editing.scheduled_at
                    ? new Date(
                        new Date(editing.scheduled_at).getTime() -
                          new Date(editing.scheduled_at).getTimezoneOffset() *
                            60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </Field>
            <Field label="İç koordinasyon notları">
              <textarea
                rows={4}
                name="notes"
                defaultValue={editing.notes}
                maxLength={3000}
              />
            </Field>
            <div className="notice">
              <p>
                Değişiklikler talep kaydını günceller. Bu yerel ortamdan
                e-posta, SMS veya arama yapılmaz.
              </p>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function MembersPanel({
  accounts,
  clinics,
  role,
  act,
  currentId,
}: {
  accounts: Account[];
  clinics: Clinic[];
  role: Role;
  act: Action;
  currentId: string;
}) {
  const [search, setSearch] = useState(""),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Account | null>(null);
  const rows = accounts.filter((a) =>
    matchesSearch(`${a.name} ${a.email}`, search),
  );
  return (
    <>
      <div className="toolbar">
        <SearchBox
          value={search}
          set={setSearch}
          placeholder="Hesaplarda ara…"
        />
        <button className="primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          {role === "clinic" ? "Ekip üyesi ekle" : "Hesap ekle"}
        </button>
      </div>
      <div className="panel flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hesap</th>
                <th>Rol</th>
                {role === "admin" && <th>Klinik</th>}
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>
                      {a.name}
                      {a.id === currentId ? " (siz)" : ""}
                    </strong>
                    <small>{a.email}</small>
                  </td>
                  <td>
                    <Badge>{a.role}</Badge>
                  </td>
                  {role === "admin" && (
                    <td>
                      {clinics.find((c) => c.id === a.clinic_id)?.name ||
                        "Platform"}
                    </td>
                  )}
                  <td>
                    <Badge>{a.active ? "active" : "disabled"}</Badge>
                  </td>
                  <td>
                    <button className="text-link" onClick={() => setEditing(a)}>
                      Yönet
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
            title="Eşleşen hesap yok"
            description="Başka bir ad veya e-posta deneyin."
          />
        )}
      </div>
      {adding && (
        <Modal
          title={role === "clinic" ? "Ekip üyesi ekle" : "Hesap oluştur"}
          close={() => setAdding(false)}
        >
          <Form
            label="Hesap oluştur"
            onSave={async (f) => {
              await act("/operations/accounts", {
                name: f.get("name"),
                email: f.get("email"),
                password: f.get("password"),
                role: role === "clinic" ? "clinic" : f.get("role"),
                clinic_id:
                  role === "clinic" ? null : f.get("clinic_id") || null,
              });
              setAdding(false);
            }}
          >
            <Field label="Ad soyad">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="E-posta">
              <input type="email" name="email" required />
            </Field>
            {role === "admin" && (
              <div className="form-grid">
                <Field label="Rol">
                  <select name="role">
                    <option value="clinic">Klinik personeli</option>
                    <option value="admin">Yönetici</option>
                  </select>
                </Field>
                <Field label="Klinik">
                  <select name="clinic_id">
                    <option value="">Yok (yalnızca yöneticiler)</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <Field
              label="İlk şifre"
              hint="En az 10 karakter. Kurumunuzun güvenli yöntemiyle paylaşın."
            >
              <input
                type="password"
                name="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </Field>
          </Form>
        </Modal>
      )}
      {editing && (
        <Modal title="Hesap erişimi" close={() => setEditing(null)}>
          <h3>{editing.name}</h3>
          <p className="muted">{editing.email}</p>
          <Form
            onSave={async (f) => {
              await act(
                `/operations/accounts/${editing.id}`,
                {
                  active:
                    editing.id === currentId ? true : f.get("active") === "on",
                  password: f.get("password") || null,
                },
                "PATCH",
              );
              setEditing(null);
            }}
          >
            <label className="check-field">
              <input
                type="checkbox"
                name="active"
                disabled={editing.id === currentId}
                defaultChecked={editing.active}
              />
              Hesap aktif
            </label>
            <Field
              label="Şifreyi sıfırla"
              hint="Mevcut şifreyi korumak için boş bırakın. Sıfırlama açık oturumları kapatır."
            >
              <input
                type="password"
                name="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
const socialPlatforms = [
  "instagram",
  "facebook",
  "youtube",
  "linkedin",
  "x",
  "tiktok",
];
export function DiscoveryFields({
  clinic,
  includeGoogle = false,
}: {
  clinic: Clinic;
  includeGoogle?: boolean;
}) {
  return (
    <>
      {includeGoogle && (
        <Field
          label="Google Place ID"
          hint="Google kaydının bu kliniğe ait olduğunu doğrulayın. Bağlantıyı kaldırmak için boş bırakın."
        >
          <input
            name="google_place_id"
            maxLength={255}
            pattern="[A-Za-z0-9_-]{10,255}"
            defaultValue={clinic.google_place_id || ""}
          />
        </Field>
      )}
      <p className="muted">
        Sosyal medya profillerini klinik sağlar; Google puan ve fotoğraflarından
        ayrıdır. İzleme parametresi içermeyen tam HTTPS adreslerini kullanın.
      </p>
      <div className="form-grid">
        {socialPlatforms.map((platform) => (
          <Field
            key={platform}
            label={
              platform === "x"
                ? "X profili"
                : `${platform[0].toUpperCase() + platform.slice(1)} profili`
            }
          >
            <input
              name={`social_${platform}`}
              type="url"
              maxLength={500}
              placeholder={`https://${platform}.com/profiliniz`}
              defaultValue={
                clinic.social_links?.find((link) => link.platform === platform)
                  ?.url || ""
              }
            />
          </Field>
        ))}
      </div>
    </>
  );
}
export function discoveryData(f: FormData, includeGoogle = false) {
  const social_links = socialPlatforms.flatMap((platform) => {
    const url = String(f.get(`social_${platform}`) || "").trim();
    return url ? [{ platform, url }] : [];
  });
  return {
    social_links,
    ...(includeGoogle
      ? {
          google_place_id:
            String(f.get("google_place_id") || "").trim() || null,
        }
      : {}),
  };
}
export function ProfileFields({ clinic }: { clinic?: Clinic }) {
  return (
    <>
      <div className="form-grid">
        <Field label="Klinik adı">
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={clinic?.name}
          />
        </Field>
        <Field label="İlçe">
          <input
            name="district"
            required
            minLength={2}
            maxLength={80}
            defaultValue={clinic?.district}
          />
        </Field>
      </div>
      <Field label="Adres">
        <input
          name="address"
          required
          minLength={3}
          maxLength={250}
          defaultValue={clinic?.address}
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Enlem"
          hint="İsteğe bağlıdır. Yakın sonuçlarda görünmesi için iki koordinatı da ekleyin."
        >
          <input
            type="number"
            name="latitude"
            min={-90}
            max={90}
            step="any"
            defaultValue={clinic?.latitude ?? ""}
          />
        </Field>
        <Field label="Boylam">
          <input
            type="number"
            name="longitude"
            min={-180}
            max={180}
            step="any"
            defaultValue={clinic?.longitude ?? ""}
          />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="İletişim e-postası">
          <input
            type="email"
            name="email"
            required
            defaultValue={clinic?.email}
          />
        </Field>
        <Field label="Telefon">
          <input name="phone" maxLength={40} defaultValue={clinic?.phone} />
        </Field>
      </div>
      <Field label="Web sitesi">
        <input
          name="website"
          maxLength={150}
          defaultValue={clinic?.website}
          placeholder="https://"
        />
      </Field>
      <Field label="Çalışma saatleri">
        <input
          name="hours"
          maxLength={500}
          defaultValue={clinic?.hours || "Pazartesi–Cuma, 09.00–18.00"}
        />
      </Field>
      <Field label="Klinik hakkında">
        <textarea
          name="description"
          rows={4}
          maxLength={1500}
          defaultValue={clinic?.description}
        />
      </Field>
    </>
  );
}
export function profileData(f: FormData) {
  return {
    ...Object.fromEntries(
      [
        "name",
        "district",
        "address",
        "email",
        "phone",
        "website",
        "description",
        "hours",
      ].map((k) => [k, String(f.get(k) || "")]),
    ),
    latitude: f.get("latitude") ? Number(f.get("latitude")) : null,
    longitude: f.get("longitude") ? Number(f.get("longitude")) : null,
  };
}
