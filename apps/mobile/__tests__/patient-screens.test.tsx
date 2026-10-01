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
  fireEvent.press(screen.getByText("Yeni misiniz? Hesap oluşturun"));
  fireEvent.changeText(screen.getByLabelText("Ad soyad"), "Test Patient");
  fireEvent.changeText(
    screen.getByLabelText("Telefon numarası"),
    "+905550102020",
  );
  fireEvent.changeText(screen.getByLabelText("E-posta"), "patient@example.org");
  fireEvent.changeText(
    screen.getByLabelText("Şifre (en az 10 karakter)"),
    "Patient123!",
  );
  fireEvent.press(screen.getByText("Hesap oluştur"));
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
  fireEvent.changeText(screen.getByLabelText("E-posta"), "patient@example.org");
  fireEvent.changeText(screen.getByLabelText("Şifre"), "Patient123!");
  fireEvent.press(screen.getByText("Giriş yap"));
  expect(screen.getByLabelText("DENTRIVO yükleniyor")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Giriş yap" })).toBeNull();
  await act(async () => {
    rejectLogin(new ApiError(401, "Invalid credentials"));
  });
  expect(screen.getByText("Invalid credentials")).toBeTruthy();
  expect(screen.getByLabelText("E-posta")).toHaveDisplayValue(
    "patient@example.org",
  );
  expect(screen.getByLabelText("Şifre")).toHaveDisplayValue("Patient123!");
  expect(screen.getByRole("button", { name: "Giriş yap" })).toBeEnabled();
  expect(screen.queryByLabelText("DENTRIVO yükleniyor")).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});
it("requires consent and reuses the same case payload/key after an uncertain failure", async () => {
  data({
    consent_version: "v1",
    consent_text: "Sharing terms",
  });
  api
    .mockRejectedValueOnce(new ApiError(0, "Bağlantı kesildi"))
    .mockResolvedValueOnce({ id: "new-case" });
  render(<NewCase />);
  expect(screen.queryByText("Region")).toBeNull();
  fireEvent.changeText(
    screen.getByLabelText("Vaka başlığı"),
    "Molar consultation",
  );
  expect(
    screen.getByRole("button", { name: "Vaka oluştur ve röntgen ekle" }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole("checkbox"));
  fireEvent.press(screen.getByText("Vaka oluştur ve röntgen ekle"));
  await screen.findByText("Bağlantı kesildi");
  fireEvent.press(screen.getByText("Gönderimi yeniden dene"));
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
  expect(screen.getByText("Tüm katılımcı klinikler · 2")).toBeTruthy();
  expect(screen.getByText("Far clinic")).toBeTruthy();
  fireEvent.press(screen.getByText("Konumumu kullan"));
  await screen.findByText(/Konum izni verilmedi/);
  expect(screen.getByText("Far clinic")).toBeTruthy();
  fireEvent.press(screen.getByText("Konumumu kullan"));
  await screen.findByText("Yakınınızda · 1");
  expect(screen.getAllByText("Near clinic")).toHaveLength(2);
  expect(screen.getByText("Far clinic")).toBeTruthy();
});
it("keeps the original proposal readable when its explanation failed", () => {
  data(proposal);
  render(<ProposalDetail />);
  expect(screen.getByText("Source note")).toBeTruthy();
  expect(screen.getByText(/Açıklama şu anda kullanılamıyor/)).toBeTruthy();
  expect(screen.queryByText(/Açıklama hazırlanıyor/)).toBeNull();
});

it("offers a retry when clinic selection cannot load instead of an endless spinner", () => {
  resource.mockReturnValue({
    data: null,
    error: "Bağlantı kesildi",
    loading: false,
    refresh: mockRefresh,
    setData: jest.fn(),
  });
  render(<Share />);
  expect(screen.getByText("Klinik seçimi yüklenemedi")).toBeTruthy();
  expect(screen.queryByLabelText("Yükleniyor")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(mockRefresh).toHaveBeenCalledTimes(3);
});

it("returns to cases when the shared case no longer exists", () => {
  resource.mockImplementation(((path: string) => ({
    data: path === "/patient/capabilities" ? { max_recipients: 10 } : [],
    error: "",
    loading: false,
    refresh: mockRefresh,
    setData: jest.fn(),
  })) as typeof useResource);
  render(<Share />);
  expect(screen.getByText("Vaka bulunamadı")).toBeTruthy();
  expect(screen.queryByLabelText("Yükleniyor")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Vakalarıma dön" }));
  expect(mockReplace).toHaveBeenCalledWith("/(patient)/(tabs)");
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
  expect(screen.getByText("Kanal tedavisi — 2 kanallı")).toBeTruthy();
  expect(screen.getByText(/Öncelik: Acil/)).toBeTruthy();
  expect(screen.getAllByText(/6\.500,50/).length).toBeGreaterThan(0);
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
  expect(screen.getAllByText(/6\.500,50/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/6\.500,50/).length).toBeGreaterThan(0);
  expect(
    screen.getByText(/Kanal tedavisi — çok kanallı\s+Öncelik: Yakında/),
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
  expect(screen.getByText("YAPAY ZEKÂ DESTEKLİ ÖZET")).toBeTruthy();
  expect(screen.getByText(/ifade klinik olarak incelenmedi/)).toBeTruthy();
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
  expect(
    screen.getByText("ŞABLON ÖZET · YAPAY ZEKÂ KULLANILAMADI"),
  ).toBeTruthy();
  expect(screen.queryByText("YAPAY ZEKÂ DESTEKLİ ÖZET")).toBeNull();
});
it("does not book a proposal that became unavailable on a stale screen", async () => {
  data(proposal);
  api.mockRejectedValue(new ApiError(404, "Teklif kullanılamıyor"));
  const alert = jest.spyOn(Alert, "alert");
  render(<ProposalDetail />);
  fireEvent.press(screen.getByText("Geri arama iste"));
  const confirm = alert.mock.calls[0][2]?.find(
    (b) => b.text === "Talebi gönder",
  );
  await act(async () => {
    confirm?.onPress?.();
  });
  await screen.findByText("Teklif kullanılamıyor");
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
  fireEvent.press(screen.getByRole("tab", { name: "Geçmiş" }));
  expect(screen.getByText("Tamamlandı")).toBeTruthy();
  expect(screen.queryByText("Talebi iptal et")).toBeNull();
  expect(screen.queryByText("Tarih ve saat onaylanmadı")).toBeNull();
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
  expect(screen.getAllByText("Toplam seans")).toHaveLength(2);
  expect(screen.getAllByText(/Malzeme belirtilmedi/)).toHaveLength(2);
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
  expect(screen.queryByLabelText("Shared case taslağını sil")).toBeNull();
  fireEvent.press(screen.getByLabelText("Unshared draft taslağını sil"));
  expect(api).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][2]?.find((b) => b.text === "Vazgeç")).toBeTruthy();
  await act(async () => {
    alert.mock.calls[0][2]?.find((b) => b.text === "Taslağı sil")?.onPress?.();
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
    new ApiError(409, "Yalnızca paylaşılmamış taslak vakalar silinebilir."),
  );
  const alert = jest.spyOn(Alert, "alert");
  render(<Cases />);
  fireEvent.press(screen.getByLabelText("Stale draft taslağını sil"));
  await act(async () => {
    alert.mock.calls[0][2]?.find((b) => b.text === "Taslağı sil")?.onPress?.();
  });
  expect(
    await screen.findByText(
      "Yalnızca paylaşılmamış taslak vakalar silinebilir.",
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText("Stale draft vakasını aç")).toBeTruthy();
  expect(mockRefresh).not.toHaveBeenCalled();
  alert.mockRestore();
});
