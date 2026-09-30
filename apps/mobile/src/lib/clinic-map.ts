import { Platform } from "react-native";
import { Clinic } from "./types";

export function clinicMapPage(placeId: string): string | null {
  if (!/^[A-Za-z0-9_-]{10,255}$/.test(placeId)) return null;
  const base =
    process.env.EXPO_PUBLIC_MAPS_WEB_URL ||
    (__DEV__
      ? Platform.OS === "android"
        ? "http://10.0.2.2:3000"
        : "http://127.0.0.1:3000"
      : "");
  try {
    const url = new URL(base);
    if (
      url.username ||
      url.password ||
      (!__DEV__ && url.protocol !== "https:") ||
      !["https:", "http:"].includes(url.protocol)
    )
      return null;
    return `${url.origin}/clinic-map?${new URLSearchParams({ place_id: placeId })}`;
  } catch {
    return null;
  }
}

export function clinicGoogleProfile(clinic: Clinic) {
  const query = `${clinic.name}, ${clinic.address}, ${clinic.district}, ${clinic.region}`;
  const params = new URLSearchParams({ api: "1", query });
  if (clinic.google_place_id)
    params.set("query_place_id", clinic.google_place_id);
  return `https://www.google.com/maps/search/?${params}`;
}
