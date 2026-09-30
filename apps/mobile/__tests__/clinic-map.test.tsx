import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
import ClinicDetail from "../src/app/(patient)/clinic/[id]";
import { clinicGoogleProfile, clinicMapPage } from "../src/lib/clinic-map";
import { useResource } from "../src/lib/use-resource";
import { Clinic } from "../src/lib/types";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "clinic-1" }),
}));
jest.mock("../src/lib/use-resource", () => ({ useResource: jest.fn() }));
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: unknown) => <View {...(props as object)} /> };
});
const clinic: Clinic = {
  id: "clinic-1",
  name: "Synthetic Clinic",
  region: "Istanbul",
  district: "Kadikoy",
  address: "Synthetic address",
  phone: "123",
  description: "Synthetic clinic",
  hours: "Weekdays",
  latitude: null,
  longitude: null,
  google_linked: true,
  google_place_id: "ChIJSyntheticPlace123",
  social_links: [],
};
const resource = jest.mocked(useResource);
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_MAPS_WEB_URL;
  resource.mockReturnValue({
    data: clinic,
    error: "",
    loading: false,
    refresh: jest.fn(),
    setData: jest.fn(),
  });
});

it("builds only fixed map/profile URLs and rejects an unsafe web origin", () => {
  process.env.EXPO_PUBLIC_MAPS_WEB_URL = "https://dentpro.example";
  expect(clinicMapPage(clinic.google_place_id!)).toBe(
    "https://dentpro.example/clinic-map?place_id=ChIJSyntheticPlace123",
  );
  expect(clinicMapPage("<script>bad</script>")).toBeNull();
  process.env.EXPO_PUBLIC_MAPS_WEB_URL = "javascript:alert(1)";
  expect(clinicMapPage(clinic.google_place_id!)).toBeNull();
  process.env.EXPO_PUBLIC_MAPS_WEB_URL = "https://secret@dentpro.example";
  expect(clinicMapPage(clinic.google_place_id!)).toBeNull();
  expect(clinicGoogleProfile(clinic)).toContain(
    "query_place_id=ChIJSyntheticPlace123",
  );
});

it("shows the clinic map, opens the full profile and recovers from map failure", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  render(<ClinicDetail />);
  expect(resource).toHaveBeenCalledWith("/patient/clinics/clinic-1");
  const map = screen.getByTestId("clinic-embedded-map");
  expect(map.props.source.uri).toContain("/clinic-map?place_id=");
  expect(map.props.source.headers).toBeUndefined();
  expect(
    map.props.onShouldStartLoadWithRequest({
      url: "https://evil.example",
      isTopFrame: true,
    }),
  ).toBe(false);
  fireEvent.press(screen.getByText("Google profilini aç ↗"));
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(clinicGoogleProfile(clinic)),
  );
  fireEvent(map, "httpError");
  expect(screen.queryByTestId("clinic-embedded-map")).toBeNull();
  fireEvent.press(screen.getByText("Haritayı yeniden dene"));
  expect(screen.getByTestId("clinic-embedded-map")).toBeTruthy();
  open.mockRestore();
});

it("keeps clinics without a mapping useful and does not render a false map", () => {
  resource.mockReturnValue({
    data: { ...clinic, google_linked: false, google_place_id: null },
    error: "",
    loading: false,
    refresh: jest.fn(),
    setData: jest.fn(),
  });
  render(<ClinicDetail />);
  expect(screen.queryByTestId("clinic-embedded-map")).toBeNull();
  expect(screen.getByText(/doğrulanmış bir Google kaydı/)).toBeTruthy();
  expect(screen.getByText("Google Haritalar'da ara ↗")).toBeTruthy();
});
