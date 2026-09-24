import type { components } from "../../../../packages/contracts/mobile";
type Schemas = components["schemas"];
export type Patient = Schemas["PatientAccount"];
export type Session = Schemas["PatientSession"];
export type DentalCase = Schemas["CaseOutput"];
export type Proposal = Schemas["ProposalOutput"];
export type Clinic = Schemas["PatientClinic"];
export type Appointment = Schemas["PatientAppointment"];
export type Capabilities = Schemas["Capabilities"];
export type Comparison = Schemas["ComparisonOutput"];
export const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "TRY" }).format(
    minor / 100,
  );
export const date = (value?: string | null) =>
  value
    ? new Date(
        value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)
          ? value
          : value + "Z",
      ).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not specified";
export const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
