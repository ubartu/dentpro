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
import { Capabilities, Clinic, DentalCase, label } from "../../../lib/types";
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
          label={clinic.name + (existing ? " — zaten paylaşıldı" : "")}
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
          {clinic.district} · {label(clinic.region)} · {clinic.address}
        </Text>
        {distance !== null && (
          <Text style={styles.badge}>Yaklaşık {distance.toFixed(1)} km uzakta</Text>
        )}
        {!!clinic.description && (
          <Text style={styles.muted}>{clinic.description}</Text>
        )}
        {!!clinic.hours && <Text style={styles.muted}>{clinic.hours}</Text>}
        <ClinicSocialProfiles clinic={clinic} />
        <Button
          title="Klinik bilgilerini gör"
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
        title="Kliniklerinizi seçin"
        subtitle="Vakanız ve röntgeniniz yalnızca seçtiğiniz kliniklere iletilir."
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
            text={`${c.recipients.length} klinik seçildi · Vaka başına en fazla ${cap.data.max_recipients} klinik. Mevcut paylaşımı buradan geri alamazsınız.`}
          />
          {c.status === "archived" && (
            <Notice text="Bu vaka arşivlendi; paylaşılamaz." />
          )}
          <Card>
            <Text style={styles.heading}>Yakınınızdaki klinikler</Text>
            <Text style={styles.muted}>
              30 km içindeki klinikleri görmek için uygulamayı kullanırken konum
              izni verin. Konumunuz yalnızca bu cihazda kullanılır; DENTRIVO sunucusuna
              gönderilmez.
            </Text>
            <Button
              title={position ? "Konumumu güncelle" : "Konumumu kullan"}
              onPress={() => void requestLocation()}
              busy={locationState === "loading"}
              secondary
            />
            {locationState === "denied" && (
              <Notice text="Konum izni verilmedi. Aşağıdaki tüm kliniklerden yine de seçim yapabilirsiniz." />
            )}
            {locationState === "unavailable" && (
              <Notice text="Konumunuz alınamadı. Cihazın konum hizmetlerini kontrol edin veya aşağıdaki tüm kliniklerden seçim yapın." />
            )}
            {position && (
              <Text style={styles.muted}>
                Mesafeler, klinik konumlarına göre yaklaşık kuş uçuşu
                uzaklıklardır.
              </Text>
            )}
          </Card>
          {position && (
            <>
              <Text style={styles.heading}>Yakınınızda · {nearby.length}</Text>
              {nearby.length === 0 && (
                <Notice text="Konumu bilinen katılımcı kliniklerden hiçbiri 30 km içinde değil. Tüm klinikler aşağıda listeleniyor." />
              )}
              {nearby.map(({ clinic, distanceKm }) =>
                clinicCard(clinic, distanceKm, "nearby"),
              )}
            </>
          )}
          <Text style={styles.heading}>
            Tüm katılımcı klinikler · {allClinics.length}
          </Text>
          {clinics.loading && !clinics.data && <Loading />}
          {clinics.data && allClinics.length === 0 && (
            <Empty
              title="Klinik bulunamadı"
              detail="Şu anda vaka kabul eden aktif klinik yok. Daha sonra tekrar deneyin."
            />
          )}
          {allClinics.map(({ clinic, distanceKm }) =>
            clinicCard(clinic, distanceKm, "all"),
          )}
          <Card>
            <Text style={styles.muted}>{cap.data.consent_text}</Text>
            <Check
              label={`Vakamı yeni seçtiğim ${selected.length} klinikle paylaş`}
              checked={confirmed}
              onChange={() => setConfirmed(!confirmed)}
            />
            <Button
              title="Vakayı paylaş"
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
