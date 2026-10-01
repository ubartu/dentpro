import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
import { ClinicDiscovery } from "../src/components/clinic-discovery";
import { Clinic, GooglePlaceProfile } from "../src/lib/types";

const clinic: Clinic = {
  id: "clinic-1",
  name: "Synthetic Clinic",
  region: "Istanbul",
  district: "Kadikoy",
  address: "Synthetic address",
  phone: "",
  description: "",
  hours: "",
  latitude: null,
  longitude: null,
  google_linked: true,
  social_links: [
    {
      platform: "instagram",
      url: "https://www.instagram.com/synthetic_clinic/",
    },
  ],
};
const profile: GooglePlaceProfile = {
  status: "ready",
  rating: 4.7,
  review_count: 120,
  google_maps_url: "https://maps.google.com/synthetic-place",
  photo: {
    uri: "https://lh3.googleusercontent.com/synthetic-photo",
    google_maps_url: "https://maps.google.com/synthetic-photo",
    authors: [
      {
        name: "Synthetic Photographer",
        profile_url: "https://maps.google.com/synthetic-author",
      },
    ],
  },
};

it("loads Google content on request and keeps clinic socials separate", () => {
  const load = jest.fn();
  render(<ClinicDiscovery clinic={clinic} loading={false} load={load} />);
  expect(load).not.toHaveBeenCalled();
  expect(screen.getByText("Klinik tarafından eklenen sosyal medya hesapları")).toBeTruthy();
  fireEvent.press(screen.getByText("Google puanını ve fotoğrafını göster"));
  expect(load).toHaveBeenCalledTimes(1);
});

it("shows source-labelled rating, photographer and direct Maps photo link", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  render(
    <ClinicDiscovery
      clinic={clinic}
      profile={profile}
      loading={false}
      load={jest.fn()}
    />,
  );
  expect(screen.getByText(/4.7 \/ 5.*120 yorum/)).toBeTruthy();
  expect(screen.getByText(/klinik kalite değerlendirmesi değildir/)).toBeTruthy();
  expect(screen.getByText(/Fotoğraf: Synthetic Photographer/)).toBeTruthy();
  fireEvent.press(screen.getByText(/Kaynak fotoğrafı Google Haritalar'da gör/));
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(
      "https://maps.google.com/synthetic-photo",
    ),
  );
  open.mockRestore();
});

it("keeps unavailable Google data distinct from a real rating", () => {
  render(
    <ClinicDiscovery
      clinic={clinic}
      profile={{ status: "unavailable" }}
      loading={false}
      load={jest.fn()}
    />,
  );
  expect(screen.getByText(/Bu kliniği yine de seçebilirsiniz/)).toBeTruthy();
  expect(screen.queryByText(/★/)).toBeNull();
});
