export type Role = "clinic" | "admin";
export type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  clinic_id: string | null;
  active: boolean;
};
export type Auth = { token: string; user: Account };
export type Clinic = {
  id: string;
  name: string;
  region: string;
  district: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  social_links: { platform: string; url: string }[];
  status: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  hours: string;
  subscription: string;
  monthly_fee_minor: number;
  renewal_date: string;
  review_notes: string;
};
export type Item = {
  tooth: string;
  procedure_code: string;
  material: string | null;
  price_minor: number;
  sessions: number;
};
export type Plan = {
  items: Item[];
  sessions: number;
  requires_exam: boolean;
  first_available_slot: string | null;
  notes: string;
  currency: string;
};
export type DentalCase = {
  id: string;
  reference: string;
  title: string;
  region: string;
  status: string;
  created_at: string;
  recipients: string[];
  asset: { name: string; type: string; available: boolean } | null;
  review_status: string;
  internal_notes: string;
  proposal_count: number;
  active_proposals: number;
  draft: {
    id: string;
    plan: Plan;
    revision_of: string | null;
    updated_at: string;
  } | null;
  consent_recorded: boolean;
};
export type Explanation = {
  plain_summary: string;
  procedures: { source_item_id: string; simple_explanation: string }[];
  missing_information: string[];
  questions_to_ask_clinic: string[];
  disclaimer: string;
  glossary_status: string;
  mode: "template" | "ai" | "template_fallback";
};
export type Proposal = {
  id: string;
  case_id: string;
  case_title: string;
  clinic_id: string;
  clinic_name: string;
  district: string;
  plan: Plan;
  total_minor: number;
  version: number;
  created_at: string;
  explanation: Explanation | null;
  explanation_status: string;
  status: string;
  revision_of: string | null;
  moderation: string;
  review_notes: string;
};
export type Appointment = {
  patient_name: string;
  patient_phone: string;
  id: string;
  proposal_id: string;
  case_id: string;
  case_title: string;
  clinic_id: string;
  clinic_name: string;
  kind: string;
  status: string;
  scheduled_at: string | null;
  notes: string;
  created_at: string;
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  created_at: string;
};
export type Job = {
  key: string;
  proposal_id: string;
  status: string;
  attempts: number;
  error: string;
  created_at: string;
  updated_at: string;
  provider: string;
  model: string;
  output_mode: string | null;
};
export type Glossary = {
  code: string;
  name: string;
  explanation: string;
  reviewed: boolean;
  reviewer: string;
  version: number;
};
export type Settings = {
  explanations_enabled: boolean;
  max_recipients: number;
  upload_limit_mb: number;
};
export type Workspace = {
  clinic?: Clinic;
  clinics?: Clinic[];
  cases: DentalCase[];
  proposals: Proposal[];
  appointments: Appointment[];
  members?: Account[];
  accounts?: Account[];
  jobs?: Job[];
  glossary?: Glossary[];
  settings?: Settings;
  audit?: Audit[];
  telemetry?: {
    explanations: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
    provider: string;
    model: string;
    configured: boolean;
  };
};
export type Action = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<unknown>;
export const names: Record<string, string> = {
  ROOT_CANAL: "Root canal",
  EXTRACTION: "Extraction",
  IMPLANT: "Dental implant",
  CROWN: "Dental crown",
  FILLING: "Filling",
  CLEANING: "Cleaning",
};
export const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(v / 100);
export const date = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";
export const datetime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not scheduled";
export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export function csv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    [
      [
        keys.join(","),
        ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
      ].join("\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
