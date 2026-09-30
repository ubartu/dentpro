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
            eyebrow="PLATFORM OPERATIONS"
            title="A clear view of your platform."
            description="Monitor clinic participation, case flow, and the quality of every handoff."
          >
            <Link className="primary" href="/admin/clinics">
              Manage clinics
              <ArrowRight size={16} />
            </Link>
          </Heading>
          <div className="stats">
            <Stat
              label="Active clinics"
              value={clinics.filter((c) => c.status === "active").length}
              note={`${clinics.filter((c) => c.status === "pending").length} waiting for approval`}
              href="/admin/clinics"
            />
            <Stat
              label="Shared cases"
              value={data.cases.filter((c) => c.status === "shared").length}
              note="Across participating clinics"
              href="/admin/cases"
            />
            <Stat
              label="Proposals to review"
              value={
                data.proposals.filter(
                  (p) =>
                    p.moderation === "unreviewed" && p.status === "submitted",
                ).length
              }
              note="Current, unreviewed submissions"
              href="/admin/proposals"
            />
            <Stat
              label="Explanation queue"
              value={jobs.filter((j) => j.status === "pending").length}
              note={`${jobs.filter((j) => j.status === "failed").length} failed jobs`}
              href="/admin/interpreter"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading unpadded">
                <div>
                  <h2>Needs your attention</h2>
                  <p>Approval and quality work across the platform.</p>
                </div>
                <ShieldCheck size={20} />
              </div>
              <Link className="attention-row" href="/admin/clinics">
                <span className="square-icon">
                  <Building2 size={19} />
                </span>
                <div>
                  <strong>Clinic applications</strong>
                  <small>Review clinics before they can access cases.</small>
                </div>
                <b>{clinics.filter((c) => c.status === "pending").length}</b>
                <ArrowRight size={16} />
              </Link>
              <Link className="attention-row" href="/admin/proposals">
                <span className="square-icon">
                  <FileText size={19} />
                </span>
                <div>
                  <strong>Flagged proposals</strong>
                  <small>
                    Review source plans and resolve quality concerns.
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
                  <strong>Glossary review</strong>
                  <small>Entries without a recorded dentist review.</small>
                </div>
                <b>{glossaries.filter((g) => !g.reviewed).length}</b>
                <ArrowRight size={16} />
              </Link>
            </section>
            <section className="panel system-card">
              <span className="square-icon">
                <Activity size={23} />
              </span>
              <h2>Interpreter operations</h2>
              <div className="mini-summary">
                <span>Worker processing</span>
                <Badge>
                  {settings.explanations_enabled ? "enabled" : "paused"}
                </Badge>
              </div>
              <div className="mini-summary">
                <span>Provider</span>
                <strong>
                  {telemetry.configured
                    ? `OpenAI · ${telemetry.model}`
                    : "Template"}
                </strong>
              </div>
              <div className="mini-summary">
                <span>Stored explanations</span>
                <strong>{telemetry.explanations}</strong>
              </div>
              <div className="mini-summary">
                <span>Provider usage</span>
                <strong>
                  {telemetry.input_tokens} input / {telemetry.output_tokens}{" "}
                  output tokens
                </strong>
              </div>
              <Link className="secondary" href="/admin/interpreter">
                Inspect queue
                <ArrowRight size={15} />
              </Link>
            </section>
          </div>
          <div className="dashboard-grid equal">
            <section className="panel">
              <h2>Platform proposal activity</h2>
              <p className="muted">
                Submissions and revisions over the last 7 days.
              </p>
              <ActivityChart proposals={data.proposals} />
            </section>
            <section className="panel">
              <div className="panel-heading unpadded">
                <h2>Recent audit events</h2>
                <RowLink href="/admin/audit">View all</RowLink>
              </div>
              {audit.slice(0, 5).map((a) => (
                <div className="activity-row" key={a.id}>
                  <span className="event-dot" />
                  <div>
                    <strong>{a.action}</strong>
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
          `${c.name} ${c.region} ${c.district}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" || c.status === filter),
      );
      return (
        <>
          <Heading
            eyebrow="NETWORK MANAGEMENT"
            title="Clinics"
            description="Onboard, approve, and manage every clinic on the platform."
          >
            <button className="primary" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add clinic
            </button>
          </Heading>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Search clinics or regions…"
            />
            <select
              aria-label="Clinic status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "pending", "active", "suspended", "rejected"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All statuses" : s}
                  </option>
                ),
              )}
            </select>
            <span className="result-count">{rows.length} clinics</span>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Location</th>
                    <th>Account status</th>
                    <th>Subscription</th>
                    <th>Cases</th>
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
                        <small>{c.region}</small>
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
                          Review clinic
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
                title="No matching clinics"
                description="Change your filters or add a clinic."
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
            title="Case not found"
            description="This case is not available."
          />
        );
      return (
        <>
          <Link className="back-link" href="/admin/cases">
            ← All platform cases
          </Link>
          <Heading
            eyebrow={`${c.reference} · PLATFORM OVERSIGHT`}
            title={c.title}
            description={`Created ${date(c.created_at)} · ${c.region}`}
          >
            <button
              className="secondary"
              onClick={() =>
                setCaseAction(c.status === "archived" ? "reopen" : "archive")
              }
            >
              {c.status === "archived" ? "Reopen case" : "Archive case"}
            </button>
          </Heading>
          <div className="case-detail-grid">
            <div>
              <ImageViewer c={c} auth={auth} />
              <section className="panel">
                <h2>Clinic proposals</h2>
                {data.proposals
                  .filter((p) => p.case_id === c.id)
                  .map((p) => (
                    <div className="activity-row" key={p.id}>
                      <FileText size={19} />
                      <div>
                        <strong>{p.clinic_name}</strong>
                        <small>
                          Version {p.version} ·{" "}
                          {money(p.total_minor, p.plan.currency)}
                        </small>
                      </div>
                      <Badge>{p.status}</Badge>
                      <button
                        className="text-link"
                        onClick={() => setProposal(p)}
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                {!c.proposal_count && (
                  <p className="muted">
                    No proposals have been submitted for this case.
                  </p>
                )}
              </section>
            </div>
            <section className="panel fit">
              <h2>Consent & routing</h2>
              <div className="mini-summary">
                <span>Case status</span>
                <Badge>{c.status}</Badge>
              </div>
              <div className="mini-summary">
                <span>Sharing consent</span>
                <Badge>{c.consent_recorded ? "recorded" : "missing"}</Badge>
              </div>
              <h4>Patient-selected clinics</h4>
              {c.recipients.map((id) => (
                <div className="recipient" key={id}>
                  <Building2 size={16} />
                  <div>
                    <strong>
                      {clinics.find((x) => x.id === id)?.name || id}
                    </strong>
                    <small>{clinics.find((x) => x.id === id)?.status}</small>
                  </div>
                </div>
              ))}
              <Form
                label="Redispatch to selected clinic"
                onSave={(f) =>
                  act(`/admin/cases/${c.id}/redispatch`, {
                    clinic_ids: [f.get("clinic_id")],
                  })
                }
              >
                <Field label="Existing recipient">
                  <select name="clinic_id" required>
                    <option value="">Select clinic</option>
                    {c.recipients.map((id) => (
                      <option key={id} value={id}>
                        {clinics.find((x) => x.id === id)?.name || id}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="muted">
                  Redispatch resets the clinic review to New. Adding a new
                  recipient requires fresh patient consent through the mobile
                  API.
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
          `${c.title} ${c.reference} ${c.region}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" || c.status === filter),
      );
      return (
        <>
          <Heading
            eyebrow="CASE OVERSIGHT"
            title="Platform cases"
            description="Inspect case routing, consent, clinic responses, and archived records."
          />
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Search platform cases…"
            />
            <select
              aria-label="Case status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "draft", "shared", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
                </option>
              ))}
            </select>
            <span className="result-count">{rows.length} cases</span>
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
          `${p.case_title} ${p.clinic_name}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" || p.moderation === filter),
      );
      return (
        <>
          <Heading
            eyebrow="QUALITY & SOURCE REVIEW"
            title="Proposal oversight"
            description="Inspect clinic-authored plans and their separate explanations. Flagged plans are withheld from patient results."
          />
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Search clinic or case…"
            />
            <select
              aria-label="Moderation status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "unreviewed", "approved", "flagged"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All review statuses" : s}
                </option>
              ))}
            </select>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Clinic / case</th>
                    <th>Version</th>
                    <th>Total</th>
                    <th>Lifecycle</th>
                    <th>Review</th>
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
                          Review
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
                title="No proposals match"
                description="Try a different review filter."
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
            eyebrow="PLATFORM COORDINATION"
            title="Appointment requests"
            description="Oversee callback and appointment progress across all clinics."
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
            eyebrow="IDENTITY & ACCESS"
            title="Accounts"
            description="Create accounts, control access, and revoke sessions through password resets or deactivation."
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
            eyebrow="CLINIC SAAS"
            title="Subscriptions"
            description="Maintain clinic subscription records, fees, and renewal dates. Payment collection is not connected."
          />
          <div className="stats">
            <Stat
              label="Active subscriptions"
              value={clinics.filter((c) => c.subscription === "active").length}
              note="Administratively active"
            />
            <Stat
              label="Monthly contracted fees"
              value={money(
                clinics
                  .filter((c) => c.subscription === "active")
                  .reduce((s, c) => s + c.monthly_fee_minor, 0),
              )}
              note="Not collected revenue"
            />
            <Stat
              label="Trial clinics"
              value={clinics.filter((c) => c.subscription === "trial").length}
              note="Currently evaluating"
            />
            <Stat
              label="Past due"
              value={
                clinics.filter((c) => c.subscription === "past_due").length
              }
              note="Follow-up required"
            />
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Subscription</th>
                    <th>Monthly fee</th>
                    <th>Renewal</th>
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
                        {c.renewal_date
                          ? date(c.renewal_date)
                          : "Not scheduled"}
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => setBilling(c)}
                        >
                          Manage
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
          `${j.proposal_id} ${j.key}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
      return (
        <>
          <Heading
            eyebrow="INTERPRETER OPERATIONS"
            title="Explanations & jobs"
            description="Inspect durable jobs, retry failures, and regenerate against the current glossary version."
          />
          <div className="stats">
            <Stat
              label="Stored explanations"
              value={telemetry.explanations}
              note="Immutable cached outputs"
            />
            <Stat
              label="Pending"
              value={jobs.filter((j) => j.status === "pending").length}
              note={
                settings.explanations_enabled
                  ? "Worker processing is enabled"
                  : "Processing paused in settings"
              }
            />
            <Stat
              label="Failed"
              value={jobs.filter((j) => j.status === "failed").length}
              note="Stopped after bounded retries"
            />
            <Stat
              label="Gateway"
              value={telemetry.configured ? "OpenAI ready" : "Template only"}
              note={
                telemetry.configured
                  ? telemetry.model
                  : "Set server-side provider and key to enable AI"
              }
            />
          </div>
          <div className="notice">
            <ShieldCheck size={20} />
            <p>
              Current provider:{" "}
              <strong>
                {telemetry.configured
                  ? `OpenAI ${telemetry.model}`
                  : "template interpreter"}
              </strong>
              . The gateway sends only structured clinic plan fields and a
              template summary; X-rays, patient identifiers, contact details,
              and clinical notes stay outside its payload. Invalid or
              unavailable AI output falls back to the template. Cached versions
              are not regenerated on page views.
            </p>
          </div>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Search job or proposal ID…"
            />
            <select
              aria-label="Job status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "pending", "completed", "failed"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All jobs" : s}
                </option>
              ))}
            </select>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Job / proposal</th>
                    <th>Status</th>
                    <th>Gateway / output</th>
                    <th>Attempts</th>
                    <th>Last update</th>
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
                          <strong>{p?.clinic_name || "Clinic proposal"}</strong>
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
                            {j.provider === "openai" ? "OpenAI" : "Template"}
                          </strong>
                          <small>{j.model}</small>
                          {j.output_mode && (
                            <Badge>{j.output_mode.replaceAll("_", " ")}</Badge>
                          )}
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
                              ? "Retry"
                              : "Recheck version"}
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
                title="No matching jobs"
                description="New proposals are queued after publication."
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
            eyebrow="SOURCE-BOUND EXPLANATIONS"
            title="Procedure glossary"
            description="Maintain template explanations and record dentist review. Changes create a new version for future jobs."
          />
          <div className="notice">
            <BookOpen size={21} />
            <p>
              Clinical wording must be reviewed by a dentist. Updating an entry
              does not rewrite stored explanations; use the job controls to
              generate a new version for an existing proposal.
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
                      ? `Review recorded: ${g.reviewer}`
                      : "Dentist review not recorded"}
                  </small>
                  <button className="text-link" onClick={() => setGlossary(g)}>
                    Edit & review
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
          `${a.actor} ${a.action} ${a.entity}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" || a.action.startsWith(filter + ".")),
      );
      return (
        <>
          <Heading
            eyebrow="ACCOUNTABILITY"
            title="Audit trail"
            description="Trace access and changes across clinic and platform operations. Latest 1,000 events."
          />
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Search actor, action, or entity…"
            />
            <select
              aria-label="Audit category"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All categories</option>
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
                <option key={x}>{x}</option>
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
              Export filtered events
            </button>
          </div>
          <div className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
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
                      <td>{a.action}</td>
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
                title="No matching events"
                description="Clear a filter or try another search."
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
            eyebrow="PLATFORM CONFIGURATION"
            title="Operational settings"
            description="These limits are enforced by the API and interpreter worker."
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
                <h2>Processing & case limits</h2>
                <label className="toggle-field">
                  <div>
                    <strong>Process explanation jobs</strong>
                    <small>
                      Pause interpretation while allowing clinics to submit
                      proposals.
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={settings.explanations_enabled}
                  />
                </label>
                <Field
                  label="Maximum clinic recipients per case"
                  hint="Applies to new mobile API dispatch requests; existing assignments are retained."
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
                  label="Maximum upload size (MB)"
                  hint="PNG, JPEG, and PDF files are accepted up to this limit."
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
              <h2>Environment boundaries</h2>
              <dl className="details">
                <div>
                  <dt>Environment</dt>
                  <dd>Local development</dd>
                </div>
                <div>
                  <dt>Patient interface</dt>
                  <dd>Mobile API only</dd>
                </div>
                <div>
                  <dt>Interpreter</dt>
                  <dd>Versioned template glossary</dd>
                </div>
                <div>
                  <dt>Files</dt>
                  <dd>Private local storage</dd>
                </div>
                <div>
                  <dt>Notifications / payments</dt>
                  <dd>External providers not connected</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      );
    return (
      <Empty
        title="Page not found"
        description="Choose an admin page from the navigation."
      />
    );
  }
  return (
    <>
      {render()}
      {adding && (
        <Modal title="Add clinic" close={() => setAdding(false)} wide>
          <Form
            label="Create clinic for review"
            onSave={async (f) => {
              await act("/admin/clinics", {
                ...profileData(f),
                region: f.get("region"),
              });
              setAdding(false);
            }}
          >
            <Field label="Region">
              <select name="region">
                <option>Istanbul</option>
                <option>Ankara</option>
                <option>Izmir</option>
              </select>
            </Field>
            <ProfileFields />
          </Form>
        </Modal>
      )}
      {clinic && (
        <Modal
          title="Clinic verification & access"
          close={() => setClinic(null)}
        >
          <h3>{clinic.name}</h3>
          <p className="muted">{clinic.address}</p>
          <dl className="details">
            <div>
              <dt>Contact</dt>
              <dd>
                {clinic.email}
                <br />
                {clinic.phone || "No phone supplied"}
              </dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd>{clinic.hours}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{clinic.description || "No description supplied"}</dd>
            </div>
          </dl>
          <details className="profile-disclosure">
            <summary>Edit clinic profile</summary>
            <Form
              label="Save clinic profile"
              onSave={async (f) => {
                await act(
                  `/admin/clinics/${clinic.id}/profile`,
                  { ...profileData(f), region: f.get("region") },
                  "PUT",
                );
                setClinic(null);
              }}
            >
              <Field label="Region">
                <select name="region" defaultValue={clinic.region}>
                  <option>Istanbul</option>
                  <option>Ankara</option>
                  <option>Izmir</option>
                </select>
              </Field>
              <ProfileFields clinic={clinic} />
            </Form>
          </details>
          <details className="profile-disclosure">
            <summary>Google Maps & social profiles</summary>
            <Form
              label="Save discovery profile"
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
                Google ratings and photos are fetched on demand in the patient
                app. Google does not provide social profile links through Places
                API.
              </p>
            </Form>
          </details>
          <Form
            label="Save clinic decision"
            onSave={async (f) => {
              await act(
                `/admin/clinics/${clinic.id}/review`,
                { status: f.get("status"), review_notes: f.get("notes") },
                "PATCH",
              );
              setClinic(null);
            }}
          >
            <Field label="Account status">
              <select name="status" defaultValue={clinic.status}>
                {["pending", "active", "suspended", "rejected"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Verification / decision notes"
              hint="Required when suspending or rejecting a clinic."
            >
              <textarea
                name="notes"
                rows={4}
                defaultValue={clinic.review_notes}
                maxLength={2000}
              />
            </Field>
            <p className="muted">
              Suspending or rejecting a clinic revokes its active sessions and
              blocks case access and new dispatches.
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
            <Field label="Subscription status">
              <select name="subscription" defaultValue={billing.subscription}>
                {["trial", "active", "past_due", "cancelled"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Monthly fee (TRY)">
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
            <Field label="Renewal date">
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
            label="Save new glossary version"
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
            <Field label="Plain-language explanation">
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
              A dentist has reviewed this wording
            </label>
            <Field
              label="Dentist reviewer name"
              hint="Required when recording review."
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
          title={caseAction === "archive" ? "Archive case" : "Reopen case"}
          close={() => setCaseAction(null)}
        >
          <p className="muted">
            {caseAction === "archive"
              ? "Archiving blocks new proposals and patient requests while preserving records and existing appointments."
              : "Reopening restores the case to its previous recipient set."}
          </p>
          <Form
            label={caseAction === "archive" ? "Archive case" : "Reopen case"}
            onSave={async (f) => {
              await act(
                `/admin/cases/${c.id}`,
                { action: caseAction, reason: f.get("reason") },
                "PATCH",
              );
              setCaseAction(null);
            }}
          >
            <Field label="Reason for this action">
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
