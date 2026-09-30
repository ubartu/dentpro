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
    message: "If an eligible account exists, a reset email will be sent.",
  });
  render(<ForgotPassword />);
  fireEvent.changeText(
    screen.getByLabelText("Account email"),
    " person@example.org ",
  );
  fireEvent.press(screen.getByText("Send reset email"));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/auth/password/forgot",
      undefined,
      "POST",
      { email: "person@example.org" },
    ),
  );
  await waitFor(() =>
    expect(screen.getByText(/If an eligible account exists/)).toBeTruthy(),
  );
});
it("requires matching passwords and keeps the token after a network failure", async () => {
  api
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ message: "Your password has been updated." });
  render(<ForgotPassword />);
  fireEvent.press(screen.getByText("Have a reset token?"));
  const token = "A".repeat(43);
  fireEvent.changeText(screen.getByLabelText("Reset token"), token);
  fireEvent.changeText(
    screen.getByLabelText("New password (at least 10 characters)"),
    "RecoveryQA123!",
  );
  fireEvent.changeText(
    screen.getByLabelText("Confirm new password"),
    "DifferentQA123!",
  );
  fireEvent.press(screen.getByText("Update password"));
  expect(screen.getByText("Passwords do not match.")).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
  fireEvent.changeText(
    screen.getByLabelText("Confirm new password"),
    "RecoveryQA123!",
  );
  fireEvent.press(screen.getByText("Update password"));
  await waitFor(() => expect(screen.getByText(/offline/)).toBeTruthy());
  expect(screen.getByLabelText("Reset token").props.value).toBe(token);
  fireEvent.press(screen.getByText("Update password"));
  await waitFor(() =>
    expect(screen.getByText("Your password has been updated.")).toBeTruthy(),
  );
  expect(api).toHaveBeenLastCalledWith(
    "/auth/password/reset",
    undefined,
    "POST",
    { token, new_password: "RecoveryQA123!" },
  );
});
