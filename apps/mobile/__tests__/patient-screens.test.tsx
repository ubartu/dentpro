import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import SignIn from "../src/app/sign-in";
import NewCase from "../src/app/(patient)/new";
import ProposalDetail from "../src/app/(patient)/proposal/[id]";
import Appointments from "../src/app/(patient)/(tabs)/appointments";
import Compare from "../src/app/(patient)/compare/[id]";
import { ApiError, request } from "../src/lib/api";
import { useResource } from "../src/lib/use-resource";
const mockAccept = jest.fn();
const mockExpire = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
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
  expect(screen.getByLabelText("DENTpro loading")).toBeTruthy();
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
  expect(screen.queryByLabelText("DENTpro loading")).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});
it("requires consent and reuses the same case payload/key after an uncertain failure", async () => {
  data({
    regions: ["Istanbul"],
    consent_version: "v1",
    consent_text: "Sharing terms",
  });
  api
    .mockRejectedValueOnce(new ApiError(0, "Connection lost"))
    .mockResolvedValueOnce({ id: "new-case" });
  render(<NewCase />);
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
});
it("keeps the original proposal readable when its explanation failed", () => {
  data(proposal);
  render(<ProposalDetail />);
  expect(screen.getByText("Source note")).toBeTruthy();
  expect(screen.getByText(/explanation is currently unavailable/)).toBeTruthy();
  expect(screen.queryByText(/being prepared/)).toBeNull();
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
