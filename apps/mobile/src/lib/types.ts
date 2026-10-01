import type { components } from "../../../../packages/contracts/mobile";
type Schemas = components["schemas"];
export type Patient = Schemas["PatientAccount"];
export type Session = Schemas["PatientSession"];
export type DentalCase = Schemas["CaseOutput"];
export type Proposal = Schemas["ProposalOutput"];
export type Clinic = Schemas["PatientClinic"];
export type GooglePlaceProfile = Schemas["GooglePlaceProfile"];
export type Appointment = Schemas["PatientAppointment"];
export type Capabilities = Schemas["Capabilities"];
export type Comparison = Schemas["ComparisonOutput"];
export const money = (minor: number, currency = "TRY") =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(
    minor / 100,
  );
export const date = (value?: string | null) =>
  value
    ? new Date(
        value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)
          ? value
          : value + "Z",
      ).toLocaleString("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Belirtilmedi";
export const urgencyLabel = (value?: string) =>
  ({ urgent: "Acil", soon: "Yakında", routine: "Rutin" })[
    value as "urgent" | "soon" | "routine"
  ] || "Rutin";
const treatmentLabels: Record<string, string> = {
  ROOT_CANAL: "Kanal tedavisi",
  ROOT_CANAL_SINGLE: "Kanal tedavisi — 1 kanallı",
  ROOT_CANAL_DOUBLE: "Kanal tedavisi — 2 kanallı",
  ROOT_CANAL_MULTI: "Kanal tedavisi — çok kanallı",
  EXTRACTION: "Diş çekimi",
  IMPLANT: "Diş implantı",
  CROWN: "Diş kaplaması",
  FILLING: "Diş dolgusu",
  CLEANING: "Diş temizliği",
  draft: "Taslak",
  shared: "Paylaşıldı",
  archived: "Arşivlendi",
  requested: "Talep edildi",
  contacted: "İletişime geçildi",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  callback: "Geri arama",
  appointment: "Randevu",
  Istanbul: "İstanbul",
  Izmir: "İzmir",
  Ankara: "Ankara",
  "All regions": "Tüm bölgeler",
};
export const label = (value: string) =>
  treatmentLabels[value] ||
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
