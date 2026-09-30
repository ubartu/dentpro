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
      "Bu talep iptal edilsin mi?",
      `${a.clinic_name} iptali görecek.`,
      [
        { text: "Talebi koru", style: "cancel" },
        {
          text: "Talebi iptal et",
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
        title="Talepleriniz"
        subtitle="Geri arama ve randevu talepleriniz tek yerde."
      />
      <Notice text={r.error || action.error} error />
      {!!r.error && <Button title="Yeniden dene" onPress={() => void r.refresh()} />}
      {r.loading && !r.data && <Loading />}
      {r.data?.length === 0 && (
        <Empty
          title="Henüz talebiniz yok"
          detail="Randevu veya geri arama istemek için bir klinik teklifini açın."
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
              : "Tarih ve saat henüz onaylanmadı"}
          </Text>
          {a.status === "requested" && (
            <Text style={styles.muted}>
              Klinik, profilinizdeki telefon numarasından size ulaşacak.
            </Text>
          )}
          {!!a.clinic_phone && (
            <Button
              title="Kliniği ara"
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
              title="Talebi iptal et"
              quiet
              busy={action.busy}
              onPress={() => cancel(a)}
            />
          )}
        </Card>
      ))}
      <Notice text="Randevunuz, klinik tarih ve saat belirlediğinde onaylanır. Güncellemeleri görmek için ekranı aşağı çekin." />
    </Screen>
  );
}
