"use client";
import { useRef, useState, FormEvent } from "react";
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
  csv,
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
  const [activeProcedure, setActiveProcedure] = useState(0);
  const toothSelectorRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const localTime = (s: string | null | undefined) =>
    s
      ? new Date(
          new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  const update = (i: number, patch: Partial<Item>) => {
    setItems((current) =>
      current.map((x, j) => (i === j ? { ...x, ...patch } : x)),
    );
    setKey(crypto.randomUUID());
    setSaved("");
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      currency: "TRY",
    };
    setBusy(true);
    setError("");
    try {
      if (intent === "draft") {
        await act(
          `/clinic/cases/${c.id}/draft`,
          { plan, revision_of: revisionOf },
          "PUT",
        );
        setSaved("Draft saved. It is visible only to your clinic.");
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
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        revisionOf ? "Revise treatment proposal" : "Create treatment proposal"
      }
      close={close}
      wide
    >
      <div className="editor-context">
        <FileText size={19} />
        <div>
          <strong>{c.title}</strong>
          <small>
            {c.reference} · {c.region} · Patient-selected clinic review
          </small>
        </div>
        <Badge>{revisionOf ? "New version" : "Draft"}</Badge>
      </div>
      <form
        onSubmit={submit}
        onChange={() => {
          setKey(crypto.randomUUID());
          setSaved("");
        }}
      >
        <div className="editor-label">
          <h3>1. Treatment plan</h3>
          <p>Your professional assessment is the source of this proposal.</p>
        </div>
        <Field label="Choose procedure for tooth selection">
          <select
            value={activeProcedure}
            onChange={(e) => {
              e.stopPropagation();
              setActiveProcedure(Number(e.target.value));
            }}
          >
            {items.map((item, i) => (
              <option key={i} value={i}>
                Procedure {i + 1} · {names[item.procedure_code]} · Tooth{" "}
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
              <strong>Procedure {i + 1}</strong>
              <div className="procedure-actions">
                <button
                  type="button"
                  className="text-link"
                  aria-label={`Choose tooth for procedure ${i + 1} in 3D`}
                  onClick={() => {
                    setActiveProcedure(i);
                    toothSelectorRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                >
                  Choose tooth in 3D
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`Remove procedure ${i + 1}`}
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
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="form-grid three">
              <Field label="Procedure">
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
              <Field label="Tooth · FDI notation">
                <input
                  required
                  pattern="([1-4][1-8]|[5-8][1-5]|ALL)"
                  value={item.tooth}
                  onChange={(e) => update(i, { tooth: e.target.value })}
                />
              </Field>
              <Field label="Price (TRY)">
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
              <Field label="Material / brand">
                <input
                  maxLength={80}
                  placeholder="Specify or leave blank"
                  value={item.material || ""}
                  onChange={(e) =>
                    update(i, { material: e.target.value || null })
                  }
                />
              </Field>
              <Field label="Procedure sessions">
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
          }}
        >
          <Plus size={16} />
          Add procedure
        </button>
        <div className="editor-label">
          <h3>2. Visits & availability</h3>
          <p>Overall visits may combine more than one procedure.</p>
        </div>
        <div className="form-grid">
          <Field label="Total planned visits">
            <input
              required
              type="number"
              name="sessions"
              min={1}
              max={60}
              defaultValue={initial?.sessions || 1}
            />
          </Field>
          <Field label="First available appointment">
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
          In-person examination required to finalize this plan
        </label>
        <Field label="Clinical notes & price inclusions">
          <textarea
            name="notes"
            rows={4}
            maxLength={1000}
            defaultValue={initial?.notes || ""}
            placeholder="Clarify the proposed plan, materials, inclusions and examination requirements."
          />
        </Field>
        <div className="proposal-total">
          <div>
            <span>Preliminary total</span>
            <small>Final pricing is subject to clinical examination.</small>
          </div>
          <strong>{money(items.reduce((s, i) => s + i.price_minor, 0))}</strong>
        </div>
        <div className="notice">
          <Sparkles size={18} />
          <p>
            A separate plain-language explanation is queued after publishing. It
            will not alter your treatment plan.
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
        <div className="form-actions">
          <button
            className="secondary"
            type="submit"
            name="intent"
            value="draft"
            disabled={busy}
          >
            <Save size={16} />
            Save draft
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
              ? "Saving…"
              : revisionOf
                ? "Publish revision"
                : "Publish proposal"}
          </button>
        </div>
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
  return (
    <Modal title={`Proposal · version ${p.version}`} close={close} wide>
      <div className="proposal-detail-header">
        <div>
          <h3>{p.clinic_name}</h3>
          <p>
            {p.case_title} · {date(p.created_at)}
          </p>
        </div>
        <Badge>{p.status}</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Procedure</th>
              <th>Tooth</th>
              <th>Material</th>
              <th>Sessions</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {p.plan.items.map((x, i) => (
              <tr key={i}>
                <td>{names[x.procedure_code]}</td>
                <td>{x.tooth}</td>
                <td>{x.material || "Not specified"}</td>
                <td>{x.sessions}</td>
                <td>{money(x.price_minor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="proposal-total">
        <span>
          {p.plan.sessions} total visits ·{" "}
          {p.plan.requires_exam
            ? "Examination required"
            : "No examination requirement marked"}
        </span>
        <strong>{money(p.total_minor)}</strong>
      </div>
      <dl className="details">
        <div>
          <dt>First availability</dt>
          <dd>{datetime(p.plan.first_available_slot)}</dd>
        </div>
        <div>
          <dt>Notes & inclusions</dt>
          <dd>{p.plan.notes || "No notes supplied."}</dd>
        </div>
      </dl>
      <section className="explanation">
        <div className="spread">
          <h3>
            <Sparkles size={18} />
            Patient explanation
          </h3>
          <Badge>{p.explanation?.mode?.replaceAll("_", " ") || p.explanation_status}</Badge>
        </div>
        {p.explanation ? (
          <>
            <p>{p.explanation.plain_summary}</p>
            {p.explanation.procedures.map((x) => (
              <p key={x.source_item_id}>{x.simple_explanation}</p>
            ))}
            {!!p.explanation.missing_information.length && (
              <>
                <h4>Information to clarify</h4>
                {p.explanation.missing_information.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </>
            )}
            <small>{p.explanation.disclaimer}</small>
            <p className="tiny">
              Glossary: {p.explanation.glossary_status.replaceAll("_", " ")}
            </p>
          </>
        ) : (
          <p>
            The interpreter is preparing this explanation. The submitted clinic
            plan is saved.
          </p>
        )}
      </section>
      {role === "admin" ? (
        <Form
          label="Save review"
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
            <h3>Platform review</h3>
            <p>
              Flagged proposals are hidden from patient-facing API results until
              cleared.
            </p>
          </div>
          <Field label="Review decision">
            <select name="moderation" defaultValue={p.moderation}>
              <option value="unreviewed">Unreviewed</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
            </select>
          </Field>
          <Field label="Review notes">
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
              <p>Platform review: {p.review_notes}</p>
            </div>
          )}
          {p.status === "submitted" && (
            <div className="form-actions">
              <button className="primary" onClick={() => onRevise?.(p)}>
                Revise proposal
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
      `${a.case_title} ${a.clinic_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <SearchBox
          value={search}
          set={setSearch}
          placeholder="Search requests…"
        />
        <select
          aria-label="Filter requests by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {[
            "requested",
            "contacted",
            "confirmed",
            "completed",
            "cancelled",
          ].map((s) => (
            <option key={s}>{s}</option>
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
          Export
        </button>
      </div>
      <div className="panel flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Case / request</th>
                {role === "admin" && <th>Clinic</th>}
                <th>Requested</th>
                <th>Scheduled for</th>
                <th>Status</th>
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
                        ? "Callback request"
                        : "Appointment request"}
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
                      Manage
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
            title="No matching requests"
            description="Requests from the patient mobile API will appear here."
          />
        )}
      </div>
      {editing && (
        <Modal
          title="Manage appointment request"
          close={() => setEditing(null)}
        >
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
            <Field label="Request status">
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
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Appointment date & time"
              hint="Required when confirming an appointment."
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
            <Field label="Internal coordination notes">
              <textarea
                rows={4}
                name="notes"
                defaultValue={editing.notes}
                maxLength={3000}
              />
            </Field>
            <div className="notice">
              <p>
                Changes update the request record. No email, SMS, or phone call
                is sent from this local environment.
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
    `${a.name} ${a.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <SearchBox
          value={search}
          set={setSearch}
          placeholder="Search accounts…"
        />
        <button className="primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          Add {role === "clinic" ? "team member" : "account"}
        </button>
      </div>
      <div className="panel flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                {role === "admin" && <th>Clinic</th>}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>
                      {a.name}
                      {a.id === currentId ? " (you)" : ""}
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
                      Manage
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
            title="No matching accounts"
            description="Try another name or email."
          />
        )}
      </div>
      {adding && (
        <Modal
          title={role === "clinic" ? "Add team member" : "Create account"}
          close={() => setAdding(false)}
        >
          <Form
            label="Create account"
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
            <Field label="Full name">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Email">
              <input type="email" name="email" required />
            </Field>
            {role === "admin" && (
              <div className="form-grid">
                <Field label="Role">
                  <select name="role">
                    <option value="clinic">Clinic staff</option>
                    <option value="admin">Administrator</option>
                  </select>
                </Field>
                <Field label="Clinic">
                  <select name="clinic_id">
                    <option value="">None (administrators only)</option>
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
              label="Initial password"
              hint="At least 10 characters. Share through your organization’s secure process."
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
        <Modal title="Account access" close={() => setEditing(null)}>
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
              Account is active
            </label>
            <Field
              label="Reset password"
              hint="Leave blank to keep the current password. A reset revokes active sessions."
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
export function ProfileFields({ clinic }: { clinic?: Clinic }) {
  return (
    <>
      <div className="form-grid">
        <Field label="Clinic name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={clinic?.name}
          />
        </Field>
        <Field label="District">
          <input
            name="district"
            required
            minLength={2}
            maxLength={80}
            defaultValue={clinic?.district}
          />
        </Field>
      </div>
      <Field label="Address">
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
          label="Latitude"
          hint="Optional. Add both coordinates to include this clinic in nearby results."
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
        <Field label="Longitude">
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
        <Field label="Contact email">
          <input
            type="email"
            name="email"
            required
            defaultValue={clinic?.email}
          />
        </Field>
        <Field label="Phone">
          <input name="phone" maxLength={40} defaultValue={clinic?.phone} />
        </Field>
      </div>
      <Field label="Website">
        <input
          name="website"
          maxLength={150}
          defaultValue={clinic?.website}
          placeholder="https://"
        />
      </Field>
      <Field label="Opening hours">
        <input
          name="hours"
          maxLength={500}
          defaultValue={clinic?.hours || "Monday–Friday, 09:00–18:00"}
        />
      </Field>
      <Field label="About the clinic">
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
