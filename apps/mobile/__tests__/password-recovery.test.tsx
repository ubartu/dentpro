import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import ForgotPassword from "../src/app/forgot-password";
import { request } from "../src/lib/api";
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("../src/lib/api", () => ({
  ...jest.requireActual("../src/lib/api"),
  request: jest.fn(),
}));
const api = jest.mocked(request);
beforeEach(() => jest.clearAllMocks());
it("requests recovery without a session and shows the generic confirmation", async () => {
  api.mockResolvedValue({
    message: "Uygun bir hesap varsa şifre yenileme e-postası gönderilecektir.",
  });
  render(<ForgotPassword />);
  fireEvent.changeText(
    screen.getByLabelText("Hesap e-postası"),
    " person@example.org ",
  );
  fireEvent.press(screen.getByText("Yenileme e-postası gönder"));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/auth/password/forgot",
      undefined,
      "POST",
      { email: "person@example.org" },
    ),
  );
  await waitFor(() =>
    expect(screen.getByText(/Uygun bir hesap varsa/)).toBeTruthy(),
  );
});
it("requires matching passwords and keeps the token after a network failure", async () => {
  api
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ message: "Şifreniz güncellendi." });
  render(<ForgotPassword />);
  fireEvent.press(screen.getByText("Yenileme kodunuz var mı?"));
  const token = "A".repeat(43);
  fireEvent.changeText(screen.getByLabelText("Yenileme kodu"), token);
  fireEvent.changeText(
    screen.getByLabelText("Yeni şifre (en az 10 karakter)"),
    "RecoveryQA123!",
  );
  fireEvent.changeText(
    screen.getByLabelText("Yeni şifreyi doğrulayın"),
    "DifferentQA123!",
  );
  fireEvent.press(screen.getByText("Şifreyi güncelle"));
  expect(screen.getByText("Şifreler eşleşmiyor.")).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
  fireEvent.changeText(
    screen.getByLabelText("Yeni şifreyi doğrulayın"),
    "RecoveryQA123!",
  );
  fireEvent.press(screen.getByText("Şifreyi güncelle"));
  await waitFor(() => expect(screen.getByText(/offline/)).toBeTruthy());
  expect(screen.getByLabelText("Yenileme kodu").props.value).toBe(token);
  fireEvent.press(screen.getByText("Şifreyi güncelle"));
  await waitFor(() =>
    expect(screen.getByText("Şifreniz güncellendi.")).toBeTruthy(),
  );
  expect(api).toHaveBeenLastCalledWith(
    "/auth/password/reset",
    undefined,
    "POST",
    { token, new_password: "RecoveryQA123!" },
  );
});
