import { Alert, Linking, Text } from "react-native";
import {
  Button,
  Card,
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
import { Appointment, date, label } from "../../../lib/types";
export default function Appointments() {
  const { token } = useSession();
  const r = useResource<Appointment[]>("/patient/appointments");
  const action = useAction();
  function cancel(a: Appointment) {
    Alert.alert(
      "Cancel this request?",
      `${a.clinic_name} will see the cancellation.`,
      [
        { text: "Keep request", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () =>
            void action.run(async () => {
              await request(
                `/patient/appointments/${a.id}/cancel`,
                token!,
                "POST",
              );
              await r.refresh();
            }),
        },
      ],
    );
  }
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title="Your requests"
        subtitle="Callbacks and appointments, in one place."
      />
      <Notice text={r.error || action.error} error />
      {r.error && <Button title="Retry" onPress={() => void r.refresh()} />}
      {r.loading && !r.data && <Loading />}
      {r.data?.length === 0 && (
        <Empty
          title="No requests yet"
          detail="Open a clinic proposal to request an appointment or callback."
        />
      )}
      {r.data?.map((a) => (
        <Card key={a.id}>
          <Text style={styles.badge}>{label(a.status)}</Text>
          <Text style={styles.heading}>{a.clinic_name}</Text>
          <Text style={styles.muted}>
            {a.case_title} · {label(a.kind)}
          </Text>
          <Text style={styles.text}>
            {a.scheduled_at
              ? date(a.scheduled_at)
              : "Date and time not confirmed"}
          </Text>
          {a.status === "requested" && (
            <Text style={styles.muted}>
              The clinic will contact you using the phone number in your
              profile.
            </Text>
          )}
          {!!a.clinic_phone && (
            <Button
              title="Call clinic"
              secondary
              onPress={() =>
                void action.run(async () => {
                  await Linking.openURL(
                    `tel:${a.clinic_phone.replace(/[^+\d]/g, "")}`,
                  );
                })
              }
            />
          )}
          {!["completed", "cancelled"].includes(a.status) && (
            <Button
              title="Cancel request"
              quiet
              busy={action.busy}
              onPress={() => cancel(a)}
            />
          )}
        </Card>
      ))}
      <Notice text="Your appointment is confirmed when the clinic assigns a date and time. Pull down to check for updates." />
    </Screen>
  );
}
