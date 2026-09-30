import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import SignIn from "../src/app/sign-in";
import Cases from "../src/app/(patient)/(tabs)/index";
import NewCase from "../src/app/(patient)/new";
import Share from "../src/app/(patient)/share/[id]";
import ProposalDetail from "../src/app/(patient)/proposal/[id]";
import Appointments from "../src/app/(patient)/(tabs)/appointments";
import Compare from "../src/app/(patient)/compare/[id]";
import { ApiError, request } from "../src/lib/api";
import { useResource } from "../src/lib/use-resource";
const mockAccept = jest.fn();
const mockExpire = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockLocationPermission = jest.fn();
const mockCurrentPosition = jest.fn();
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockLocationPermission(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
}));
jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "p1" }),
}));
jest.mock("../src/lib/session", () => ({
  useSession: () => ({
    token: "token",
    accept: mockAccept,
    expire: mockExpire,
  }),
}));
jest.mock("../src/lib/use-resource", () => ({ useResource: jest.fn() }));
jest.mock("../src/lib/api", () => {
  const actual = jest.requireActual("../src/lib/api");
  return { ...actual, request: jest.fn() };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => "unique-request-key" }));
const api = jest.mocked(request);
const resource = jest.mocked(useResource);
const proposal = {
  id: "p1",
  clinic_name: "Harbour Dental",
  district: "Kadikoy",
  version: 2,
  created_at: "2026-09-24T10:00:00Z",
  total_minor: 650050,
  plan: {
    sessions: 2,
    requires_exam: true,
    items: [
      {
        tooth: "16",
        procedure_code: "ROOT_CANAL",
        price_minor: 650050,
        sessions: 2,
        material: null,
      },
    ],
    notes: "Source note",
    first_available_slot: null,
  },
  explanation: null,
  explanation_status: "failed",
};
function data(value: unknown) {
  resource.mockReturnValue({
    data: value,
    error: "",
    loading: false,
    refresh: mockRefresh,
    setData: jest.fn(),
  });
}
beforeEach(() => {
  jest.clearAllMocks();
});
it("registers a patient without offering staff roles", async () => {
  api.mockResolvedValue({ token: "new", user: { role: "patient" } });
  render(<SignIn />);
  fireEvent.press(screen.getByText("New here? Create an account"));
  fireEvent.changeText(screen.getByLabelText("Full name"), "Test Patient");
  fireEvent.changeText(screen.getByLabelText("Phone number"), "+905550102020");
  fireEvent.changeText(screen.getByLabelText("Email"), "patient@example.org");
  fireEvent.changeText(
    screen.getByLabelText("Password (at least 10 characters)"),
    "Patient123!",
  );
  fireEvent.press(screen.getByText("Create account"));
  await waitFor(() => expect(mockAccept).toHaveBeenCalled());
  expect(api).toHaveBeenCalledWith(
    "/patient/register",
    undefined,
    "POST",
    expect.objectContaining({ name: "Test Patient", phone: "+905550102020" }),
  );
  expect(screen.queryByText("Admin")).toBeNull();
});
it("shows loading during sign-in and restores entered details after a failure", async () => {
  let rejectLogin!: (error: Error) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectLogin = reject;
      }),
  );
  render(<SignIn />);
  fireEvent.changeText(screen.getByLabelText("Email"), "patient@example.org");
  fireEvent.changeText(screen.getByLabelText("Password"), "Patient123!");
  fireEvent.press(screen.getByText("Sign in"));
  expect(screen.getByLabelText("DENTRIVO loading")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  await act(async () => {
    rejectLogin(new ApiError(401, "Invalid credentials"));
  });
  expect(screen.getByText("Invalid credentials")).toBeTruthy();
  expect(screen.getByLabelText("Email")).toHaveDisplayValue(
    "patient@example.org",
  );
  expect(screen.getByLabelText("Password")).toHaveDisplayValue("Patient123!");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(screen.queryByLabelText("DENTRIVO loading")).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});
it("requires consent and reuses the same case payload/key after an uncertain failure", async () => {
  data({
    consent_version: "v1",
    consent_text: "Sharing terms",
  });
  api
    .mockRejectedValueOnce(new ApiError(0, "Connection lost"))
    .mockResolvedValueOnce({ id: "new-case" });
  render(<NewCase />);
  expect(screen.queryByText("Region")).toBeNull();
  fireEvent.changeText(
    screen.getByLabelText("Case title"),
    "Molar consultation",
  );
  expect(
    screen.getByRole("button", { name: "Create case & add X-ray" }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole("checkbox"));
  fireEvent.press(screen.getByText("Create case & add X-ray"));
  await screen.findByText("Connection lost");
  fireEvent.press(screen.getByText("Retry this submission"));
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/case/[id]",
      params: { id: "new-case" },
    }),
  );
  expect(api.mock.calls[0]).toEqual(api.mock.calls[1]);
  expect(api.mock.calls[0][3]).not.toHaveProperty("region");
});
it("keeps every clinic available without location and highlights nearby clinics after permission", async () => {
  const values: Record<string, unknown> = {
    "/patient/clinics": [
      {
        id: "near",
        name: "Near clinic",
        region: "Istanbul",
        district: "Kadikoy",
        address: "Sample address",
        latitude: 40.991,
        longitude: 29.0277,
      },
      {
        id: "far",
        name: "Far clinic",
        region: "Ankara",
        district: "Cankaya",
        address: "Sample address",
        latitude: 39.9208,
        longitude: 32.8541,
      },
    ],
    "/cases": [{ id: "p1", recipients: [], status: "draft" }],
    "/patient/capabilities": {
      max_recipients: 10,
      consent_text: "Sharing terms",
    },
  };
  resource.mockImplementation(((path: string) => ({
    data: values[path] ?? null,
    error: "",
    loading: false,
    refresh: mockRefresh,
    setData: jest.fn(),
  })) as typeof useResource);
  mockLocationPermission
    .mockResolvedValueOnce({ granted: false })
    .mockResolvedValueOnce({ granted: true });
  mockCurrentPosition.mockResolvedValue({
    coords: { latitude: 40.991, longitude: 29.0277 },
  });
  render(<Share />);
  expect(screen.getByText("All participating clinics · 2")).toBeTruthy();
  expect(screen.getByText("Far clinic")).toBeTruthy();
  fireEvent.press(screen.getByText("Use my location"));
  await screen.findByText(/Location access was not allowed/);
  expect(screen.getByText("Far clinic")).toBeTruthy();
  fireEvent.press(screen.getByText("Use my location"));
  await screen.findByText("Near you · 1");
  expect(screen.getAllByText("Near clinic")).toHaveLength(2);
  expect(screen.getByText("Far clinic")).toBeTruthy();
});
it("keeps the original proposal readable when its explanation failed", () => {
  data(proposal);
  render(<ProposalDetail />);
  expect(screen.getByText("Source note")).toBeTruthy();
  expect(screen.getByText(/explanation is currently unavailable/)).toBeTruthy();
  expect(screen.queryByText(/being prepared/)).toBeNull();
});

it("shows the proposal currency, canal count and clinic-assigned urgency", () => {
  data({
    ...proposal,
    plan: {
      ...proposal.plan,
      currency: "EUR",
      items: [
        {
          ...proposal.plan.items[0],
          procedure_code: "ROOT_CANAL_DOUBLE",
          urgency: "urgent",
        },
      ],
    },
  });
  render(<ProposalDetail />);
  expect(screen.getByText("Root canal — 2 canals")).toBeTruthy();
  expect(screen.getByText(/Priority: Urgent/)).toBeTruthy();
  expect(screen.getAllByText(/€6,500.50/).length).toBeGreaterThan(0);
});

it("compares mixed currencies using their original units and clinic priorities", () => {
  const first = { ...proposal, plan: { ...proposal.plan, currency: "USD" } };
  const second = {
    ...proposal,
    id: "p2",
    clinic_name: "Second Clinic",
    plan: {
      ...proposal.plan,
      currency: "EUR",
      items: [
        {
          ...proposal.plan.items[0],
          procedure_code: "ROOT_CANAL_MULTI",
          urgency: "soon",
        },
      ],
    },
  };
  data({
    proposals: [first, second],
    currency: null,
    notice: "No exchange-rate conversion has been applied.",
  });
  render(<Compare />);
  expect(
    screen.getByText("No exchange-rate conversion has been applied."),
  ).toBeTruthy();
  expect(screen.getByText("USD")).toBeTruthy();
  expect(screen.getByText("EUR")).toBeTruthy();
  expect(screen.getAllByText(/\$6,500.50/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/€6,500.50/).length).toBeGreaterThan(0);
  expect(
    screen.getByText(/Root canal — multiple canals\s+Priority: Soon/),
  ).toBeTruthy();
});
it("identifies AI wording and its clinical review status on a proposal", () => {
  data({
    ...proposal,
    explanation: {
      plain_summary:
        "The clinic proposes root canal treatment over two visits.",
      procedures: [],
      missing_information: [],
      questions_to_ask_clinic: [],
      disclaimer: "The clinic should confirm the plan after an examination.",
      mode: "ai",
      glossary_status: "draft_requires_dentist_review",
    },
    explanation_status: "ready",
  });
  render(<ProposalDetail />);
  expect(screen.getByText("AI-ASSISTED SUMMARY")).toBeTruthy();
  expect(
    screen.getByText(/wording has not been clinically reviewed/),
  ).toBeTruthy();
  expect(
    screen.getByText(/The clinic proposes root canal treatment/),
  ).toBeTruthy();
});
it("labels a failed AI gateway as a template explanation", () => {
  data({
    ...proposal,
    explanation: {
      plain_summary: "The clinic has proposed a treatment plan.",
      procedures: [],
      missing_information: [],
      questions_to_ask_clinic: [],
      disclaimer: "The clinic should confirm the plan after an examination.",
      mode: "template_fallback",
      glossary_status: "draft_requires_dentist_review",
    },
    explanation_status: "ready",
  });
  render(<ProposalDetail />);
  expect(screen.getByText("TEMPLATE SUMMARY · AI UNAVAILABLE")).toBeTruthy();
  expect(screen.queryByText("AI-ASSISTED SUMMARY")).toBeNull();
});
it("does not book a proposal that became unavailable on a stale screen", async () => {
  data(proposal);
  api.mockRejectedValue(new ApiError(404, "Proposal unavailable"));
  const alert = jest.spyOn(Alert, "alert");
  render(<ProposalDetail />);
  fireEvent.press(screen.getByText("Request a callback"));
  const confirm = alert.mock.calls[0][2]?.find(
    (b) => b.text === "Send request",
  );
  await act(async () => {
    confirm?.onPress?.();
  });
  await screen.findByText("Proposal unavailable");
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith("/proposals/p1", "token");
  expect(mockReplace).not.toHaveBeenCalled();
  alert.mockRestore();
});
it("shows scheduled requests and disables cancellation for completed visits", () => {
  data([
    {
      id: "a1",
      clinic_name: "Harbour Dental",
      case_title: "Molar",
      kind: "appointment",
      status: "completed",
      scheduled_at: "2026-09-25T10:00:00Z",
      clinic_phone: "",
    },
  ]);
  render(<Appointments />);
  expect(screen.getByText("Completed")).toBeTruthy();
  expect(screen.queryByText("Cancel request")).toBeNull();
  expect(screen.queryByText("Date and time not confirmed")).toBeNull();
});
it("compares material, visits and scope without inventing a winner", () => {
  data({
    proposals: [
      proposal,
      {
        ...proposal,
        id: "p2",
        clinic_name: "City Dental",
        total_minor: 700000,
      },
    ],
    notice: "Different scopes of care",
  });
  render(<Compare />);
  expect(screen.getByText("Harbour Dental")).toBeTruthy();
  expect(screen.getByText("City Dental")).toBeTruthy();
  expect(screen.getAllByText("Total visits")).toHaveLength(2);
  expect(screen.getAllByText(/Material not specified/)).toHaveLength(2);
  expect(screen.queryByText(/Best clinic/)).toBeNull();
});

it("confirms draft deletion, then removes the card and refreshes", async () => {
  data([
    {
      id: "draft1",
      title: "Unshared draft",
      status: "draft",
      recipients: [],
      region: "All regions",
    },
    {
      id: "shared1",
      title: "Shared case",
      status: "shared",
      recipients: ["clinic-1"],
      region: "Istanbul",
    },
  ]);
  api.mockResolvedValue({});
  const alert = jest.spyOn(Alert, "alert");
  render(<Cases />);
  expect(screen.queryByLabelText("Delete draft Shared case")).toBeNull();
  fireEvent.press(screen.getByLabelText("Delete draft Unshared draft"));
  expect(api).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][2]?.find((b) => b.text === "Cancel")).toBeTruthy();
  await act(async () => {
    alert.mock.calls[0][2]?.find((b) => b.text === "Delete draft")?.onPress?.();
  });
  expect(api).toHaveBeenCalledWith("/cases/draft1", "token", "DELETE");
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  const update = jest.mocked(useResource).mock.results.at(-1)?.value.setData
    .mock.calls[0][0];
  expect(update([{ id: "draft1" }, { id: "shared1" }])).toEqual([
    { id: "shared1" },
  ]);
  alert.mockRestore();
});

it("retains the draft and shows a server conflict on failed deletion", async () => {
  data([
    {
      id: "draft1",
      title: "Stale draft",
      status: "draft",
      recipients: [],
      region: "All regions",
    },
  ]);
  api.mockRejectedValue(
    new ApiError(409, "Only unshared draft cases can be deleted."),
  );
  const alert = jest.spyOn(Alert, "alert");
  render(<Cases />);
  fireEvent.press(screen.getByLabelText("Delete draft Stale draft"));
  await act(async () => {
    alert.mock.calls[0][2]?.find((b) => b.text === "Delete draft")?.onPress?.();
  });
  expect(
    await screen.findByText("Only unshared draft cases can be deleted."),
  ).toBeTruthy();
  expect(screen.getByLabelText("Open Stale draft")).toBeTruthy();
  expect(mockRefresh).not.toHaveBeenCalled();
  alert.mockRestore();
});
