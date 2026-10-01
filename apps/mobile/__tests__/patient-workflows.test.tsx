import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";
import Cases from "../src/app/(patient)/(tabs)/index";
import Appointments from "../src/app/(patient)/(tabs)/appointments";
import Profile from "../src/app/(patient)/(tabs)/profile";
import { ApiError, request } from "../src/lib/api";
import { useResource } from "../src/lib/use-resource";
const mockRefresh = jest.fn();
const mockSetUser = jest.fn();
const mockUser = {
  id: "u1",
  role: "patient",
  name: "Ayşe Kaya",
  email: "ayse@example.org",
  phone: "+905551234567",
};
// Font loading is outside these workflow tests; native icon rendering is
// checked separately in the device preview.
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
}));
jest.mock("../src/lib/session", () => ({
  useSession: () => ({
    user: mockUser,
    token: "token",
    setUser: mockSetUser,
    expire: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock("../src/lib/use-resource", () => ({ useResource: jest.fn() }));
jest.mock("../src/lib/api", () => ({
  ...jest.requireActual("../src/lib/api"),
  request: jest.fn(),
}));
const api = jest.mocked(request);
const resource = jest.mocked(useResource);
function data(value: unknown) {
  resource.mockReturnValue({
    data: value,
    error: "",
    loading: false,
    refresh: mockRefresh,
    setData: jest.fn(),
  });
}
const cases = [
  {
    id: "shared",
    title: "Kanal görüşmesi",
    status: "shared",
    recipients: ["clinic1"],
    region: "Istanbul",
  },
  {
    id: "draft",
    title: "İmplant kontrolü",
    status: "draft",
    recipients: [],
    region: "All regions",
    asset: null,
  },
  {
    id: "archive",
    title: "Geçen yılki kontrol",
    status: "archived",
    recipients: ["clinic1"],
    region: "Istanbul",
  },
];
beforeEach(() => jest.clearAllMocks());
it("keeps active cases separate from archives and searches Turkish titles within the selected filter", () => {
  data(cases);
  render(<Cases />);
  expect(
    screen.getByRole("tab", { name: "Aktif vakalar", selected: true }),
  ).toBeTruthy();
  expect(screen.getByText("Aktif · 2")).toBeTruthy();
  expect(screen.getByText("Taslak · 1")).toBeTruthy();
  expect(screen.queryByLabelText("Geçen yılki kontrol vakasını aç")).toBeNull();
  fireEvent.press(screen.getByRole("tab", { name: "Taslak vakalar" }));
  expect(screen.getByLabelText("İmplant kontrolü vakasını aç")).toBeTruthy();
  expect(screen.queryByLabelText("Kanal görüşmesi vakasını aç")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("Vaka ara"), "implant");
  expect(screen.getByLabelText("İmplant kontrolü vakasını aç")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Vaka ara"), "kanal");
  expect(screen.getByText("Aramanızla eşleşen vaka yok")).toBeTruthy();
  fireEvent.press(screen.getByText("Aramayı temizle"));
  fireEvent.press(screen.getByRole("tab", { name: "Arşiv vakalar" }));
  expect(screen.getByLabelText("Geçen yılki kontrol vakasını aç")).toBeTruthy();
  expect(
    screen.queryByLabelText("Geçen yılki kontrol taslağını sil"),
  ).toBeNull();
});
it("prioritizes an unfinished draft and gives the next real action", () => {
  data(cases);
  const view = render(<Cases />);
  fireEvent.press(
    screen.getByLabelText(
      "İmplant kontrolü vakasına devam et: Röntgeninizi ekleyin",
    ),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/case/[id]",
    params: { id: "draft" },
  });
  data([cases[0], { ...cases[1], asset: { name: "xray.png" } }]);
  view.rerender(<Cases />);
  expect(screen.getByText("Kliniklerinizi seçin")).toBeTruthy();
});
it("shows active requests first and keeps completed and cancelled requests in history", () => {
  data([
    {
      id: "a1",
      clinic_name: "Aktif Klinik",
      case_title: "Kontrol",
      kind: "appointment",
      status: "confirmed",
      scheduled_at: "2026-10-02T10:00:00Z",
      clinic_phone: "",
    },
    {
      id: "a2",
      clinic_name: "Eski Klinik",
      case_title: "Eski kontrol",
      kind: "appointment",
      status: "completed",
      scheduled_at: "2026-09-01T10:00:00Z",
      clinic_phone: "",
    },
    {
      id: "a3",
      clinic_name: "İptal Klinik",
      case_title: "İptal kontrol",
      kind: "callback",
      status: "cancelled",
      scheduled_at: null,
      clinic_phone: "",
    },
  ]);
  render(<Appointments />);
  expect(screen.getByText("Aktif talepler · 1")).toBeTruthy();
  expect(screen.getByText("Geçmiş · 2")).toBeTruthy();
  expect(screen.getByText("Aktif Klinik")).toBeTruthy();
  expect(screen.queryByText("Eski Klinik")).toBeNull();
  expect(screen.getByText("Talebi iptal et")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "Geçmiş" }));
  expect(screen.getByText("Eski Klinik")).toBeTruthy();
  expect(screen.getByText("İptal Klinik")).toBeTruthy();
  expect(screen.queryByText("Aktif Klinik")).toBeNull();
  expect(screen.queryByText("Talebi iptal et")).toBeNull();
});
it("still requires confirmation before cancelling an active request and refreshes it afterwards", async () => {
  data([
    {
      id: "a1",
      clinic_name: "Klinik",
      case_title: "Kontrol",
      kind: "callback",
      status: "requested",
      scheduled_at: null,
      clinic_phone: "",
    },
  ]);
  api.mockResolvedValue({});
  const alert = jest.spyOn(Alert, "alert");
  render(<Appointments />);
  fireEvent.press(screen.getByText("Talebi iptal et"));
  expect(api).not.toHaveBeenCalled();
  await act(async () => {
    alert.mock.calls[0][2]
      ?.find((button) => button.text === "Talebi iptal et")
      ?.onPress?.();
  });
  expect(api).toHaveBeenCalledWith(
    "/patient/appointments/a1/cancel",
    "token",
    "POST",
  );
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
it("offers a route back to cases when there are no active requests", () => {
  data([]);
  render(<Appointments />);
  fireEvent.press(screen.getByText("Vakalarıma git"));
  expect(router.navigate).toHaveBeenCalledWith("/(patient)/(tabs)");
});
it("does not send invalid or unchanged profile data and clears success when new edits are made", async () => {
  api.mockResolvedValue({ ...mockUser, name: "Ayşe Yılmaz" });
  render(<Profile />);
  expect(screen.getByRole("button", { name: "Profili kaydet" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Ad soyad"), "A");
  expect(screen.getByText("Ad soyad en az 2 karakter olmalıdır.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Profili kaydet" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Ad soyad"), "  Ayşe Yılmaz  ");
  fireEvent.changeText(screen.getByLabelText("E-posta"), "invalid");
  expect(screen.getByRole("button", { name: "Profili kaydet" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("E-posta"), mockUser.email);
  fireEvent.press(screen.getByText("Profili kaydet"));
  await screen.findByText("Profil kaydedildi.");
  expect(api).toHaveBeenCalledWith("/patient/me", "token", "PUT", {
    name: "Ayşe Yılmaz",
    email: mockUser.email,
    phone: mockUser.phone,
  });
  expect(screen.getByRole("button", { name: "Profili kaydet" })).toBeDisabled();
  fireEvent.changeText(
    screen.getByLabelText("Telefon numarası"),
    "+905559999999",
  );
  expect(screen.queryByText("Profil kaydedildi.")).toBeNull();
  expect(screen.getByRole("button", { name: "Profili kaydet" })).toBeEnabled();
  api.mockRejectedValueOnce(new ApiError(409, "Bilgiler kaydedilemedi"));
  fireEvent.press(screen.getByText("Profili kaydet"));
  await screen.findByText("Bilgiler kaydedilemedi");
  expect(screen.queryByText("Profil kaydedildi.")).toBeNull();
  expect(screen.getByLabelText("Telefon numarası")).toHaveDisplayValue(
    "+905559999999",
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Profili kaydet" }),
    ).toBeEnabled(),
  );
});
