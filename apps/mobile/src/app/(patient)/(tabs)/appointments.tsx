import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Empty,
  Heading,
  Loading,
  Notice,
  Screen,
  colors,
  fonts,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import { useSession } from "../../../lib/session";
import { useAction } from "../../../lib/use-action";
import { request } from "../../../lib/api";
import { Appointment, date, label } from "../../../lib/types";
const isHistory = (a: Appointment) =>
  ["completed", "cancelled"].includes(a.status);
const statusStyle = {
  requested: { backgroundColor: "#FFF5DF", color: colors.amber },
  contacted: { backgroundColor: colors.pale, color: colors.blue },
  confirmed: { backgroundColor: "#E7F5EF", color: "#21684D" },
  completed: { backgroundColor: "#EDF1F5", color: "#53647B" },
  cancelled: { backgroundColor: "#FCEDEA", color: colors.danger },
};
export default function Appointments() {
  const { token } = useSession();
  const r = useResource<Appointment[]>("/patient/appointments");
  const action = useAction();
  const [history, setHistory] = useState(false);
  const all = r.data || [];
  const activeCount = all.filter((a) => !isHistory(a)).length;
  const visible = all.filter((a) => isHistory(a) === history);
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
      {r.data && (
        <View style={local.filters}>
          {[
            { title: "Aktif talepler", value: false, count: activeCount },
            { title: "Geçmiş", value: true, count: all.length - activeCount },
          ].map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="tab"
              accessibilityLabel={item.title}
              accessibilityState={{ selected: history === item.value }}
              onPress={() => setHistory(item.value)}
              style={[local.filter, history === item.value && local.selected]}
            >
              <Text
                style={[
                  local.filterText,
                  history === item.value && { color: colors.blue },
                ]}
              >
                {item.title} · {item.count}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Notice text={r.error || action.error} error />
      {!!r.error && (
        <Button title="Yeniden dene" onPress={() => void r.refresh()} />
      )}
      {r.loading && !r.data && <Loading />}
      {r.data && visible.length === 0 && (
        <View style={{ gap: 12 }}>
          <Empty
            title={history ? "Geçmiş talebiniz yok" : "Aktif talebiniz yok"}
            detail={
              history
                ? "Tamamlanan ve iptal edilen talepleriniz burada saklanır."
                : "Bir klinik teklifini açarak randevu veya geri arama isteyebilirsiniz."
            }
          />
          {!history && (
            <Button
              title="Vakalarıma git"
              secondary
              onPress={() => router.navigate("/(patient)/(tabs)")}
            />
          )}
        </View>
      )}
      {visible.map((a) => (
        <Card key={a.id}>
          <Text style={[styles.badge, statusStyle[a.status]]}>
            {label(a.status)}
          </Text>
          <Text style={styles.heading}>{a.clinic_name}</Text>
          <Text style={styles.muted}>
            {a.case_title} · {label(a.kind)}
          </Text>
          <View style={local.schedule}>
            <Text style={styles.muted}>
              {a.scheduled_at ? "Randevu tarihi" : "Planlama durumu"}
            </Text>
            <Text style={[styles.text, { fontFamily: fonts.semibold }]}>
              {a.scheduled_at
                ? date(a.scheduled_at)
                : history
                  ? "Randevu tarihi belirlenmedi"
                  : "Tarih ve saat henüz onaylanmadı"}
            </Text>
          </View>
          {a.status === "requested" && (
            <Text style={styles.muted}>
              Klinik yanıtı bekleniyor. Klinik, profilinizdeki telefon
              numarasından size ulaşacak.
            </Text>
          )}
          {a.status === "contacted" && (
            <Text style={styles.muted}>
              Klinik sizinle iletişime geçti. Randevu ayrıntılarını klinikle
              netleştirebilirsiniz.
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
          {!isHistory(a) && (
            <Button
              title="Talebi iptal et"
              quiet
              busy={action.busy}
              onPress={() => cancel(a)}
            />
          )}
        </Card>
      ))}
      {!history && activeCount > 0 && (
        <Notice text="Randevunuz, klinik tarih ve saat belirlediğinde onaylanır. Güncellemeleri görmek için ekranı aşağı çekin." />
      )}
    </Screen>
  );
}
const local = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filter: {
    flexGrow: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  selected: { borderColor: colors.blue, backgroundColor: colors.pale },
  filterText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  schedule: {
    backgroundColor: "#F7F9FC",
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
});
