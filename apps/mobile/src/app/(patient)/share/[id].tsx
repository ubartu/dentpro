import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import {
  Button,
  Card,
  Check,
  Empty,
  Heading,
  Loading,
  Notice,
  Screen,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import { useSession } from "../../../lib/session";
import { useAction } from "../../../lib/use-action";
import { request } from "../../../lib/api";
import { Capabilities, Clinic, DentalCase } from "../../../lib/types";
import { ClinicSocialProfiles } from "../../../components/clinic-discovery";
import { Coordinates, rankClinics } from "../../../lib/clinic-distance";
export default function Share() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const action = useAction();
  const clinics = useResource<Clinic[]>("/patient/clinics");
  const cases = useResource<DentalCase[]>("/cases");
  const cap = useResource<Capabilities>("/patient/capabilities");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [locationState, setLocationState] = useState<
    "idle" | "loading" | "ready" | "denied" | "unavailable"
  >("idle");
  const c = cases.data?.find((v) => v.id === id);
  const allClinics = rankClinics(clinics.data || [], position);
  const nearby = position
    ? allClinics.filter((v) => v.distanceKm !== null && v.distanceKm <= 30)
    : [];
  const recipientCount = new Set([...(c?.recipients || []), ...selected]).size;
  async function requestLocation() {
    setLocationState("loading");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setPosition(null);
        setLocationState("denied");
        return;
      }
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPosition({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      });
      setLocationState("ready");
    } catch {
      setPosition(null);
      setLocationState("unavailable");
    }
  }
  function clinicCard(
    clinic: Clinic,
    distance: number | null,
    section: string,
  ) {
    const existing = c?.recipients.includes(clinic.id) || false;
    const checked = selected.includes(clinic.id);
    return (
      <Card key={`${section}-${clinic.id}`}>
        <Check
          label={clinic.name + (existing ? " — already shared" : "")}
          checked={existing || checked}
          disabled={
            existing ||
            action.busy ||
            (!checked && recipientCount >= (cap.data?.max_recipients || 0))
          }
          onChange={() => {
            setConfirmed(false);
            setSelected((current) =>
              current.includes(clinic.id)
                ? current.filter((v) => v !== clinic.id)
                : [...current, clinic.id],
            );
          }}
        />
        <Text style={styles.muted}>
          {clinic.district} · {clinic.region} · {clinic.address}
        </Text>
        {distance !== null && (
          <Text style={styles.badge}>About {distance.toFixed(1)} km away</Text>
        )}
        {!!clinic.description && (
          <Text style={styles.muted}>{clinic.description}</Text>
        )}
        {!!clinic.hours && <Text style={styles.muted}>{clinic.hours}</Text>}
        <ClinicSocialProfiles clinic={clinic} />
        <Button
          title="View clinic details"
          secondary
          onPress={() =>
            router.push({ pathname: "/clinic/[id]", params: { id: clinic.id } })
          }
        />
      </Card>
    );
  }
  async function share() {
    await action.run(async () => {
      await request(`/cases/${id}/dispatch`, token!, "POST", {
        clinic_ids: selected,
      });
      router.replace({ pathname: "/case/[id]", params: { id } });
    });
  }
  return (
    <Screen
      refresh={() => {
        void clinics.refresh();
        void cases.refresh();
        void cap.refresh();
      }}
    >
      <Heading
        title="Choose your clinics"
        subtitle="Only your selected clinics receive the case and X-ray."
      />
      <Notice
        text={action.error || clinics.error || cases.error || cap.error}
        error
      />
      {!c || !cap.data ? (
        <Loading />
      ) : (
        <>
          <Notice
            text={`${c.recipients.length} already selected · Up to ${cap.data.max_recipients} clinics per case. Existing sharing cannot be undone here.`}
          />
          {c.status === "archived" && (
            <Notice text="This case is archived. It cannot be shared." />
          )}
          <Card>
            <Text style={styles.heading}>Clinics near you</Text>
            <Text style={styles.muted}>
              Allow location while using the app to find clinics within 30 km.
              Your coordinates are used on this device and are not sent to
              DENTRIVO.
            </Text>
            <Button
              title={position ? "Update my location" : "Use my location"}
              onPress={() => void requestLocation()}
              busy={locationState === "loading"}
              secondary
            />
            {locationState === "denied" && (
              <Notice text="Location access was not allowed. You can still choose from every participating clinic below." />
            )}
            {locationState === "unavailable" && (
              <Notice text="We could not get your location. Check device location services or choose from all clinics below." />
            )}
            {position && (
              <Text style={styles.muted}>
                Distances are approximate straight-line estimates from clinic
                coordinates.
              </Text>
            )}
          </Card>
          {position && (
            <>
              <Text style={styles.heading}>Near you · {nearby.length}</Text>
              {nearby.length === 0 && (
                <Notice text="No participating clinic with a known location is within 30 km. All clinics remain available below." />
              )}
              {nearby.map(({ clinic, distanceKm }) =>
                clinicCard(clinic, distanceKm, "nearby"),
              )}
            </>
          )}
          <Text style={styles.heading}>
            All participating clinics · {allClinics.length}
          </Text>
          {clinics.loading && !clinics.data && <Loading />}
          {clinics.data && allClinics.length === 0 && (
            <Empty
              title="No clinics available"
              detail="There are currently no active clinics accepting cases. Try again later."
            />
          )}
          {allClinics.map(({ clinic, distanceKm }) =>
            clinicCard(clinic, distanceKm, "all"),
          )}
          <Card>
            <Text style={styles.muted}>{cap.data.consent_text}</Text>
            <Check
              label={`Share my case with the ${selected.length} newly selected clinics`}
              checked={confirmed}
              onChange={() => setConfirmed(!confirmed)}
            />
            <Button
              title="Share case"
              busy={action.busy}
              disabled={
                !confirmed ||
                selected.length === 0 ||
                c.status === "archived" ||
                recipientCount > cap.data.max_recipients
              }
              onPress={() => void share()}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
