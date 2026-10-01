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
  urgency?: "urgent" | "soon" | "routine";
};
export type Plan = {
  items: Item[];
  sessions: number;
  requires_exam: boolean;
  first_available_slot: string | null;
  notes: string;
  currency: "TRY" | "USD" | "EUR";
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
  ROOT_CANAL: "Kanal tedavisi",
  ROOT_CANAL_SINGLE: "Kanal tedavisi — 1 kanallı",
  ROOT_CANAL_DOUBLE: "Kanal tedavisi — 2 kanallı",
  ROOT_CANAL_MULTI: "Kanal tedavisi — çok kanallı",
  EXTRACTION: "Diş çekimi",
  IMPLANT: "Diş implantı",
  CROWN: "Diş kaplaması",
  FILLING: "Diş dolgusu",
  CLEANING: "Diş temizliği",
};
export const urgencies = { urgent: "Acil", soon: "Yakında", routine: "Rutin" };
export const money = (v: number, currency = "TRY") =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v / 100);
export const date = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Belirtilmedi";
export const datetime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("tr-TR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Planlanmadı";
export const label = (value: string) =>
  (
    ({
      new: "Yeni",
      reviewing: "İnceleniyor",
      declined: "Reddedildi",
      draft: "Taslak",
      submitted: "Gönderildi",
      withdrawn: "Geri çekildi",
      proposed: "Teklif verildi",
      unanswered: "Yanıtsız",
      superseded: "Yeni sürümle değiştirildi",
      archived: "Arşivlendi",
      shared: "Paylaşıldı",
      active: "Aktif",
      pending: "Bekliyor",
      suspended: "Askıya alındı",
      rejected: "Reddedildi",
      requested: "Talep edildi",
      contacted: "İletişime geçildi",
      confirmed: "Onaylandı",
      completed: "Tamamlandı",
      cancelled: "İptal edildi",
      unreviewed: "İncelenmedi",
      approved: "Onaylandı",
      flagged: "İşaretlendi",
      failed: "Başarısız",
      paused: "Duraklatıldı",
      ready: "Hazır",
      enabled: "Etkin",
      urgent: "Acil",
      soon: "Yakında",
      routine: "Rutin",
      trial: "Deneme",
      past_due: "Vadesi geçti",
      callback: "Geri arama",
      appointment: "Randevu",
      clinic: "Klinik",
      admin: "Yönetici",
      disabled: "Devre dışı",
      recorded: "Kaydedildi",
      missing: "Eksik",
      reviewed: "İncelendi",
      retrying: "Yeniden deneniyor",
      running: "Çalışıyor",
      succeeded: "Başarılı",
      template: "Şablon",
      template_fallback: "Şablon yedeği",
      draft_requires_dentist_review: "Diş hekimi incelemesi gerekli",
      dentist_review_recorded: "Diş hekimi incelemesi kaydedildi",
      ai: "Yapay zekâ",
      case: "Vaka",
      proposal: "Teklif",
      account: "Hesap",
      explanation: "Açıklama",
      glossary: "Sözlük",
      xray: "Röntgen",
      consent: "Onay",
      platform: "Platform",
      subscription: "Abonelik",
      "account.created": "Hesap oluşturuldu",
      "account.updated": "Hesap güncellendi",
      "appointment.cancelled": "Randevu iptal edildi",
      "appointment.requested": "Randevu talep edildi",
      "case.created": "Vaka oluşturuldu",
      "case.dispatched": "Vaka paylaşıldı",
      "case.draft_deleted": "Vaka taslağı silindi",
      "case.redispatched": "Vaka yeniden paylaşıldı",
      "case.review_updated": "Vaka incelemesi güncellendi",
      "clinic.created": "Klinik oluşturuldu",
      "clinic.discovery_updated": "Klinik keşif bilgisi güncellendi",
      "clinic.profile_updated": "Klinik profili güncellendi",
      "clinic.social_links_updated": "Sosyal medya bağlantıları güncellendi",
      "consent.recorded": "Onay kaydedildi",
      "explanation.created": "Açıklama oluşturuldu",
      "explanation.queued": "Açıklama sıraya alındı",
      "glossary.updated": "Sözlük güncellendi",
      "platform.settings_updated": "Platform ayarları güncellendi",
      "proposal.draft_discarded": "Teklif taslağı silindi",
      "proposal.draft_saved": "Teklif taslağı kaydedildi",
      "proposal.reviewed": "Teklif incelendi",
      "proposal.revised": "Teklif yenilendi",
      "proposal.withdrawn": "Teklif geri çekildi",
      "session.signed_in": "Oturum açıldı",
      "session.signed_out": "Oturum kapatıldı",
      "subscription.updated": "Abonelik güncellendi",
      "xray.accessed": "Röntgen görüntülendi",
      "xray.uploaded": "Röntgen yüklendi",
      Istanbul: "İstanbul",
      Izmir: "İzmir",
      Ankara: "Ankara",
      "All regions": "Tüm bölgeler",
    }) as Record<string, string>
  )[value] || value.replaceAll("_", " ");
export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
// Search should match Turkish display names and older ASCII records alike.
export function matchesSearch(value: string, query: string) {
  const normalize = (text: string) =>
    text
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/ı/g, "i");
  return normalize(value).includes(normalize(query));
}
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
