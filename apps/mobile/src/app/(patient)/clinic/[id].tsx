import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import {
  Button,
  Card,
  Heading,
  Loading,
  Notice,
  Screen,
  colors,
  styles,
} from "../../../components/ui";
import { ClinicSocialProfiles } from "../../../components/clinic-discovery";
import { useResource } from "../../../lib/use-resource";
import { Clinic } from "../../../lib/types";
import { clinicGoogleProfile, clinicMapPage } from "../../../lib/clinic-map";

export default function ClinicDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useResource<Clinic>(
    `/patient/clinics/${encodeURIComponent(id || "")}`,
  );
  const [mapFailed, setMapFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [linkError, setLinkError] = useState("");
  const clinic = r.data;
  const mapUrl = clinic?.google_place_id
    ? clinicMapPage(clinic.google_place_id)
    : null;
  async function openProfile() {
    if (!clinic) return;
    setLinkError("");
    try {
      await Linking.openURL(clinicGoogleProfile(clinic));
    } catch {
      setLinkError("Could not open Google Maps. Please try again.");
    }
  }
  return (
    <Screen>
      <Notice text={r.error} error />
      {r.error && (
        <Button title="Try again" secondary onPress={() => void r.refresh()} />
      )}
      {!clinic && r.loading && <Loading />}
      {clinic && (
        <>
          <Heading
            title={clinic.name}
            subtitle={`${clinic.district} · ${clinic.region}`}
          />
          <Card>
            <Text style={styles.text}>{clinic.address}</Text>
            {!!clinic.description && (
              <Text style={styles.muted}>{clinic.description}</Text>
            )}
            {!!clinic.phone && <Text style={styles.text}>{clinic.phone}</Text>}
            {!!clinic.hours && <Text style={styles.muted}>{clinic.hours}</Text>}
            <ClinicSocialProfiles clinic={clinic} />
          </Card>
          <View style={{ gap: 12 }}>
            <Text style={styles.heading}>Clinic location</Text>
            {mapUrl && !mapFailed ? (
              <View style={local.map}>
                <WebView
                  key={`${mapUrl}-${retry}`}
                  testID="clinic-embedded-map"
                  accessibilityLabel="Interactive clinic location on Google Maps"
                  source={{ uri: mapUrl }}
                  style={{ flex: 1 }}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={local.loading}>
                      <Loading />
                    </View>
                  )}
                  onError={() => setMapFailed(true)}
                  onHttpError={() => setMapFailed(true)}
                  originWhitelist={[
                    new URL(mapUrl).origin,
                    "https://*.google.com",
                    "https://maps.google.com",
                  ]}
                  onShouldStartLoadWithRequest={(navigation) => {
                    if (
                      navigation.url === mapUrl ||
                      navigation.url === "about:blank"
                    )
                      return true;
                    // iOS reports iframe navigation; allow Google's embedded frame only.
                    if (navigation.isTopFrame === false) {
                      try {
                        const u = new URL(navigation.url);
                        return (
                          u.protocol === "https:" &&
                          (u.hostname === "www.google.com" ||
                            u.hostname.endsWith(".google.com"))
                        );
                      } catch {
                        return false;
                      }
                    }
                    return false;
                  }}
                  onOpenWindow={() => void openProfile()}
                  mixedContentMode="never"
                  sharedCookiesEnabled={false}
                  thirdPartyCookiesEnabled={false}
                  allowsInlineMediaPlayback={false}
                  setSupportMultipleWindows
                />
              </View>
            ) : (
              <Notice
                text={
                  clinic.google_place_id
                    ? "The embedded map is unavailable. You can still open the clinic’s full Google profile."
                    : "This clinic has no verified Google listing linked yet. You can search for it on Google Maps."
                }
              />
            )}
            {mapUrl && mapFailed && (
              <Button
                title="Retry map"
                secondary
                onPress={() => {
                  setMapFailed(false);
                  setRetry((v) => v + 1);
                }}
              />
            )}
            <Text style={styles.muted}>
              The map loads from Google. Open the full Google profile to view
              available ratings, reviews and photos.
            </Text>
            <Button
              title={
                clinic.google_place_id
                  ? "View full Google profile ↗"
                  : "Search on Google Maps ↗"
              }
              secondary
              onPress={() => void openProfile()}
            />
            <Notice text={linkError} error />
          </View>
        </>
      )}
    </Screen>
  );
}
const local = StyleSheet.create({
  map: {
    height: 320,
    minWidth: 200,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.pale,
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
});
