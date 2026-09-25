import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
export default function Share() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const action = useAction();
  const clinics = useResource<Clinic[]>("/patient/clinics");
  const cases = useResource<DentalCase[]>("/cases");
  const cap = useResource<Capabilities>("/patient/capabilities");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const c = cases.data?.find((v) => v.id === id);
  const available = clinics.data?.filter((v) => v.region === c?.region) || [];
  const recipientCount = new Set([...(c?.recipients || []), ...selected]).size;
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
          {available.length === 0 && (
            <Empty
              title="No clinics available"
              detail="There are currently no accepting clinics in this region. Try again later."
            />
          )}
          {available.map((clinic) => {
            const existing = c.recipients.includes(clinic.id);
            const checked = selected.includes(clinic.id);
            return (
              <Card key={clinic.id}>
                <Check
                  label={clinic.name + (existing ? " — already shared" : "")}
                  checked={existing || checked}
                  disabled={
                    existing ||
                    action.busy ||
                    (!checked && recipientCount >= cap.data!.max_recipients)
                  }
                  onChange={() => {
                    setConfirmed(false);
                    setSelected(
                      checked
                        ? selected.filter((v) => v !== clinic.id)
                        : [...selected, clinic.id],
                    );
                  }}
                />
                <Text style={styles.muted}>
                  {clinic.district} · {clinic.address}
                </Text>
                {!!clinic.description && (
                  <Text style={styles.muted}>{clinic.description}</Text>
                )}
                {!!clinic.hours && (
                  <Text style={styles.muted}>{clinic.hours}</Text>
                )}
              </Card>
            );
          })}
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
