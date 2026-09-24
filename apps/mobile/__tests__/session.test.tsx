import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Button, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { SessionProvider, useSession } from "../src/lib/session";
import { ApiError, request } from "../src/lib/api";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "local",
}));
jest.mock("../src/lib/api", () => ({
  ...jest.requireActual("../src/lib/api"),
  request: jest.fn(),
}));
const api = jest.mocked(request);
function Probe() {
  const s = useSession();
  return (
    <View>
      <Text>{s.loading ? "Loading" : s.user?.name || "Signed out"}</Text>
      <Text>{s.error}</Text>
      <Button title="Retry" onPress={() => void s.restore()} />
      <Button title="Logout" onPress={() => void s.signOut()} />
    </View>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-token");
});
it("restores a native session and clears storage when the patient signs out", async () => {
  api.mockResolvedValue({
    id: "patient-1",
    role: "patient",
    name: "Restored Patient",
    email: "test@example.org",
    phone: "123456789",
  });
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByText("Restored Patient");
  expect(api).toHaveBeenCalledWith("/patient/me", "stored-token");
  fireEvent.press(screen.getByText("Logout"));
  await screen.findByText("Signed out");
  expect(api).toHaveBeenCalledWith("/auth/logout", "stored-token", "POST");
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});
it("clears an expired token instead of restoring protected screens", async () => {
  api.mockRejectedValue(new ApiError(401, "Expired"));
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByText("Signed out");
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});
it("keeps the saved token on network failure and restores after reconnecting", async () => {
  api
    .mockRejectedValueOnce(new ApiError(0, "Offline"))
    .mockResolvedValueOnce({
      id: "patient-1",
      role: "patient",
      name: "Reconnected Patient",
    });
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await screen.findByText("Offline");
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Retry"));
  await waitFor(() =>
    expect(screen.getByText("Reconnected Patient")).toBeTruthy(),
  );
});
