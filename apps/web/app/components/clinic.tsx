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
            <th>Case</th>
            <th>Region</th>
            <th>Received</th>
            <th>Status</th>
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
                    Needs response
                  </span>
                )}
              </td>
              <td>{c.region}</td>
              <td>{date(c.created_at)}</td>
              <td>
                <Badge>{base === "/admin" ? c.status : caseStatus(c)}</Badge>
              </td>
              <td>
                <RowLink href={`${base}/cases/${c.id}`}>Open case</RowLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!cases.length && (
        <Empty
          title={filtered ? "No matching cases" : "No cases to show"}
          description={
            filtered
              ? "Try another status or clear your search to see more cases."
              : "Cases shared with this clinic will appear in the inbox."
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
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: proposals.filter(
        (p) => new Date(p.created_at).toDateString() === d.toDateString(),
      ).length,
    };
  });
  const max = Math.max(1, ...bars.map((x) => x.count));
  return (
    <div
      className="chart"
      aria-label="Proposals submitted over the last seven days"
    >
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
              "Image access failed. Refresh your session and try again.",
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
          Case imaging
        </h3>
        {url && (
          <div className="row">
            <a className="text-link" href={url} download={c.asset?.name}>
              <Download size={14} />
              Download
            </a>
            {c.asset?.type !== "application/pdf" && (
              <button className="text-link" onClick={() => setZoom(!zoom)}>
                {zoom ? "Fit image" : "Zoom"}
              </button>
            )}
          </div>
        )}
      </div>
      {url ? (
        <div className={"image-view " + (zoom ? "zoom" : "")}>
          {c.asset?.type === "application/pdf" ? (
            <iframe
              title="Uploaded case PDF"
              src={url}
              sandbox="allow-same-origin"
            />
          ) : (
            <img src={url} alt="Patient-uploaded case image" />
          )}
        </div>
      ) : (
        <div className="image-empty">
          <ImageOff size={38} />
          <strong>
            {error ||
              (!c.asset?.available
                ? "No reviewable image attached"
                : "Loading case image…")}
          </strong>
          <p>
            {c.asset && !c.asset.available
              ? "This synthetic example contains no clinical X-ray."
              : "Review only the materials supplied with this case."}
          </p>
        </div>
      )}
      <div className="image-footer">
        <ShieldCheck size={14} />
        Authorized access is recorded in the audit trail.
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
            eyebrow="CLINIC OVERVIEW"
            title={`Good to see you, ${auth.user.name.replace(/^Dr\.?\s*/, "").split(" ")[0]}.`}
            description={`Here’s what needs your attention at ${clinic.name}.`}
          >
            <Link className="primary" href="/clinic/cases">
              Open case inbox
              <ArrowRight size={16} />
            </Link>
          </Heading>
          <div className="stats">
            <Stat
              label="Awaiting review"
              value={actionable.length}
              note={
                actionable.length
                  ? "New cases · Review now"
                  : "No new cases awaiting review"
              }
              href="/clinic/cases?status=new"
              attention={actionable.length > 0}
            />
            <Stat
              label="Saved drafts"
              value={data.cases.filter((c) => c.draft).length}
              note="Ready to continue"
              href="/clinic/proposals"
            />
            <Stat
              label="Active proposals"
              value={submitted.length}
              note="Submitted to patients"
              href="/clinic/proposals"
            />
            <Stat
              label="New requests"
              value={requests.length}
              note="Callbacks & appointments"
              href="/clinic/appointments"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel flush">
              <div className="panel-heading">
                <div>
                  <h2>Your case inbox</h2>
                  <p>Unanswered cases first, newest first within each group.</p>
                </div>
                <RowLink href="/clinic/cases">View all</RowLink>
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
              <h2>Make the next step clear.</h2>
              <p>
                {requests.length
                  ? `${requests.length} patient request(s) are waiting for your team. Review the proposal, coordinate a time, and update the request.`
                  : "Your incoming appointment requests are up to date. New patient requests will appear here."}
              </p>
              <Link className="primary" href="/clinic/appointments">
                Manage requests
                <ArrowRight size={16} />
              </Link>
              <div className="mini-summary">
                <span>Clinic account</span>
                <Badge>{clinic.status}</Badge>
              </div>
              <div className="mini-summary">
                <span>Subscription</span>
                <Badge>{clinic.subscription}</Badge>
              </div>
            </section>
          </div>
          <div className="dashboard-grid equal">
            <section className="panel">
              <div className="panel-heading unpadded">
                <div>
                  <h2>Proposal activity</h2>
                  <p>Submissions over the last 7 days</p>
                </div>
                <Activity size={18} />
              </div>
              <ActivityChart proposals={data.proposals} />
            </section>
            <section className="panel">
              <div className="panel-heading unpadded">
                <div>
                  <h2>Upcoming appointments</h2>
                  <p>Confirmed visits coordinated by your team.</p>
                </div>
                <RowLink href="/clinic/appointments">View all</RowLink>
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
                  title="No confirmed visits yet"
                  description="Confirm a date from appointment requests to see it here."
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
            title="Case not found"
            description="This case may no longer be assigned to your clinic."
          />
        );
      const plans = data.proposals.filter((p) => p.case_id === c.id);
      const current = plans.find((p) => p.status === "submitted");
      return (
        <>
          <Link className="back-link" href="/clinic/cases">
            ← Back to case inbox
          </Link>
          <Heading
            eyebrow={`${c.reference} · ${c.region}`}
            title={c.title}
            description={`Received ${date(c.created_at)} · Patient identity is protected in case review.`}
          >
            {c.status !== "archived" && (
              <button
                className="primary"
                onClick={() => setEditor({ c, revision: current })}
              >
                <FileText size={16} />
                {c.draft
                  ? "Continue draft"
                  : current
                    ? "Revise proposal"
                    : "Create proposal"}
              </button>
            )}
          </Heading>
          <div className="case-detail-grid">
            <div>
              <ImageViewer c={c} auth={auth} />
              <section className="panel">
                <div className="panel-heading unpadded">
                  <h2>Proposal history</h2>
                  <Badge>{plans.length} versions</Badge>
                </div>
                {plans.map((p) => (
                  <div className="activity-row" key={p.id}>
                    <FileText size={19} />
                    <div>
                      <strong>
                        Version {p.version} ·{" "}
                        {money(p.total_minor, p.plan.currency)}
                      </strong>
                      <small>
                        {date(p.created_at)} · {p.plan.items.length} procedures
                        · {p.plan.sessions} visits
                      </small>
                    </div>
                    <Badge>{p.status}</Badge>
                    <button className="text-link" onClick={() => setDetail(p)}>
                      View
                    </button>
                  </div>
                ))}
                {!plans.length && (
                  <p className="muted">
                    No proposal has been published for this case.
                  </p>
                )}
                {c.draft && (
                  <div className="draft-note">
                    <Save size={18} />
                    <div>
                      <strong>Saved draft</strong>
                      <small>Updated {datetime(c.draft.updated_at)}</small>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setEditor({ c, revision: current })}
                    >
                      Continue
                    </button>
                    <button
                      className="text-link danger"
                      onClick={() => setDiscard(c)}
                    >
                      Discard
                    </button>
                  </div>
                )}
              </section>
            </div>
            <aside>
              <section className="panel">
                <h2>Case review</h2>
                <div className="mini-summary">
                  <span>Case status</span>
                  <Badge>{caseStatus(c)}</Badge>
                </div>
                <div className="mini-summary">
                  <span>Sharing consent</span>
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
                  <Field label="Your review status">
                    <select
                      name="status"
                      defaultValue={c.review_status}
                      disabled={c.status === "archived"}
                    >
                      <option value="new">New</option>
                      <option value="reviewing">In review</option>
                      <option value="declined">Declined</option>
                    </select>
                  </Field>
                  <Field
                    label="Internal clinic notes"
                    hint="Visible only to your clinic team."
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
                    <p className="muted">
                      The platform has archived this case.
                    </p>
                  )}
                </Form>
              </section>
              <div className="notice">
                <ShieldCheck size={20} />
                <p>
                  The clinic creates the treatment plan. DENTRIVO’s interpreter
                  explains it separately and does not assess the X-ray.
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
            eyebrow="CLINICAL WORKFLOW"
            title="Case inbox"
            description="Review shared cases, inspect imaging, and prepare your professional response."
          />
          {unanswered.length > 0 && (
            <div className="case-attention-summary">
              <Clock size={22} aria-hidden="true" />
              <div>
                <strong>
                  {unanswered.length}{" "}
                  {unanswered.length === 1 ? "case needs" : "cases need"} a
                  response
                </strong>
                <p>
                  New, in-review and draft cases without an active proposal.
                  Declined and archived cases are excluded.
                </p>
              </div>
            </div>
          )}
          <nav className="case-quick-filters" aria-label="Case inbox filters">
            {[
              ["all", "All cases", data.cases.length],
              ["new", "Awaiting review", actionable.length],
              ["unanswered", "Unanswered", unanswered.length],
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
              placeholder="Search cases or references…"
            />
            <select
              aria-label="Case status"
              value={caseFilter}
              onChange={(e) =>
                router.push(caseFilterHref(e.target.value), { scroll: false })
              }
            >
              {caseFilters.map((s) => (
                <option key={s} value={s}>
                  {s === "all"
                    ? "All statuses"
                    : s === "new"
                      ? "New · awaiting review"
                      : s === "unanswered"
                        ? "Unanswered"
                        : s}
                </option>
              ))}
            </select>
            <span className="result-count" role="status">
              {rows.length} {rows.length === 1 ? "case" : "cases"}
            </span>
            {search && (
              <button className="text-link" onClick={() => setSearch("")}>
                Clear search
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
            eyebrow="TREATMENT PLANS"
            title="Proposals & drafts"
            description="Manage saved drafts, published plans, revisions, and withdrawn proposals."
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
                    <p>Saved {datetime(c.draft?.updated_at)}</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setEditor({ c })}
                  >
                    Continue
                    <ArrowRight size={15} />
                  </button>
                </div>
              ))}
          </div>
          <div className="toolbar">
            <SearchBox
              value={search}
              set={setSearch}
              placeholder="Search proposals…"
            />
            <select
              aria-label="Proposal status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {["all", "submitted", "superseded", "withdrawn"].map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
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
              Export
            </button>
          </div>
          <section className="panel flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Case / proposal</th>
                    <th>Preliminary total</th>
                    <th>Visits</th>
                    <th>Status</th>
                    <th>Explanation</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.case_title}</strong>
                        <small>
                          Version {p.version} · {date(p.created_at)}
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
                            View
                          </button>
                          {p.status === "submitted" && (
                            <>
                              <button
                                className="text-link"
                                onClick={() => revise(p)}
                              >
                                Revise
                              </button>
                              <button
                                className="text-link danger"
                                onClick={() => setWithdraw(p)}
                              >
                                Withdraw
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
                title="No matching proposals"
                description="Create a proposal from a case in your inbox."
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
            eyebrow="PATIENT COORDINATION"
            title="Appointments & callbacks"
            description="Move requests from first contact to confirmed visits, then track completion."
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
            eyebrow="CLINIC ACCESS"
            title="Your team"
            description="Create staff accounts and control access to your clinic workspace."
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
            eyebrow="CLINIC SETTINGS"
            title="Clinic profile"
            description="Keep the contact details and operating information for your clinic up to date."
          />
          <div className="settings-grid">
            <section className="panel">
              <Form
                onSave={(f) => act("/clinic/profile", profileData(f), "PUT")}
              >
                <ProfileFields clinic={clinic} />
              </Form>
              <h2>Social profiles</h2>
              <Form
                label="Save social profiles"
                onSave={(f) =>
                  act("/clinic/discovery", discoveryData(f), "PUT")
                }
              >
                <DiscoveryFields clinic={clinic} />
                <p className="muted">
                  The administrator verifies and links your Google Place ID.
                </p>
              </Form>
            </section>
            <section className="panel fit">
              <span className="square-icon">
                <Building2 size={24} />
              </span>
              <h2>{clinic.name}</h2>
              <p className="muted">
                {clinic.region} · {clinic.district}
              </p>
              <div className="mini-summary">
                <span>Platform status</span>
                <Badge>{clinic.status}</Badge>
              </div>
              <p className="muted">
                Approval and region changes are managed by the platform
                administrator.
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
            eyebrow="CLINIC SUBSCRIPTION"
            title="Plan & subscription"
            description="Your clinic’s platform access and subscription record."
          />
          <div className="settings-grid">
            <section className="panel subscription-card">
              <span className="eyebrow">DENTRIVO CLINIC</span>
              <h2>Clinic workspace</h2>
              <Badge>{clinic.subscription}</Badge>
              <div className="subscription-price">
                {money(clinic.monthly_fee_minor)}
                <small>/ month</small>
              </div>
              <p>
                Renewal date:{" "}
                <strong>
                  {clinic.renewal_date
                    ? date(clinic.renewal_date)
                    : "Not scheduled"}
                </strong>
              </p>
              <ul>
                <li>Shared case inbox and image review</li>
                <li>Structured proposals and version history</li>
                <li>Team access and appointment coordination</li>
              </ul>
            </section>
            <section className="panel fit">
              <h2>Subscription administration</h2>
              <p className="muted">
                Your platform administrator manages this record. Payment
                collection and invoices are not connected in this environment.
              </p>
              <div className="mini-summary">
                <span>Account status</span>
                <Badge>{clinic.status}</Badge>
              </div>
              <p className="muted">
                Contact your platform administrator to change the plan or
                billing details.
              </p>
            </section>
          </div>
        </>
      );
    if (section === "analytics")
      return (
        <>
          <Heading
            eyebrow="CLINIC PERFORMANCE"
            title="Activity & response"
            description="Operational counts from your actual case, proposal, and appointment records."
          />
          <div className="stats">
            <Stat
              label="Assigned cases"
              value={data.cases.length}
              note="All case assignments"
            />
            <Stat
              label="Cases with a proposal"
              value={data.cases.filter((c) => c.active_proposals > 0).length}
              note="Current submitted plans"
            />
            <Stat
              label="Confirmed visits"
              value={
                data.appointments.filter((a) => a.status === "confirmed").length
              }
              note="Scheduled appointments"
            />
            <Stat
              label="Completed visits"
              value={
                data.appointments.filter((a) => a.status === "completed").length
              }
              note="Marked completed by your team"
            />
          </div>
          <div className="dashboard-grid equal">
            <section className="panel">
              <h2>Proposal submissions</h2>
              <p className="muted">Last 7 days · revisions included</p>
              <ActivityChart proposals={data.proposals} />
            </section>
            <section className="panel">
              <h2>Case response breakdown</h2>
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
        title="Page not found"
        description="Choose a page from the clinic navigation."
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
          title="Withdraw this proposal?"
          description="It will no longer be available for new patient requests. Existing appointment records and version history will be retained."
          close={() => setWithdraw(null)}
          onConfirm={() => act(`/clinic/proposals/${withdraw.id}/withdraw`)}
        />
      )}
      {discard && (
        <Confirm
          title="Discard saved draft?"
          description="The saved draft will be removed. Published proposals will remain unchanged."
          close={() => setDiscard(null)}
          onConfirm={() =>
            act(`/clinic/cases/${discard.id}/draft`, undefined, "DELETE")
          }
        />
      )}
    </>
  );
}
