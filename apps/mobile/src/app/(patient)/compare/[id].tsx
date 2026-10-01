import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Empty,
  Heading,
  Loading,
  Notice,
  Screen,
  colors,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import {
  Comparison,
  date,
  label,
  money,
  urgencyLabel,
} from "../../../lib/types";
export default function Compare() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useResource<Comparison>(`/cases/${id}/compare`, "POST");
  const rows = r.data?.proposals || [];
  const fields = [
    {
      name: "Tahmini toplam",
      values: rows.map((p) => money(p.total_minor, p.plan.currency)),
    },
    { name: "Para birimi", values: rows.map((p) => p.plan.currency) },
    { name: "Toplam seans", values: rows.map((p) => String(p.plan.sessions)) },
    {
      name: "Muayene gerekliliği",
      values: rows.map((p) =>
        p.plan.requires_exam ? "Evet" : "Gerekliliği belirtilmedi",
      ),
    },
    {
      name: "İlk uygun tarih",
      values: rows.map((p) => date(p.plan.first_available_slot)),
    },
    {
      name: "İşlemler ve malzemeler",
      values: rows.map((p) =>
        p.plan.items
          .map(
            (i) =>
              `Diş ${i.tooth} · ${label(i.procedure_code)}\nÖncelik: ${urgencyLabel(i.urgency)} · Klinik tarafından belirlendi\n${i.material || "Malzeme belirtilmedi"} · ${i.sessions} seans\n${money(i.price_minor, p.plan.currency)}`,
          )
          .join("\n\n"),
      ),
    },
  ];
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title="Seçeneklerinizi karşılaştırın"
        subtitle="Teklifleri puanlama veya sıralama olmadan aynı ölçütlerle karşılaştırın."
      />
      <Notice text={r.error} error />
      {!!r.error && <Button title="Yeniden dene" onPress={() => void r.refresh()} />}
      {r.loading && !r.data && <Loading />}
      {r.data && (
        <>
          <Notice text={r.data.notice} />
          {rows.length < 2 && (
            <Empty
              title="Daha fazla teklif gerekli"
              detail="Anlamlı bir karşılaştırma için en az iki güncel teklif gerekir."
            />
          )}
          <Text style={styles.muted}>Klinikleri görmek için yana kaydırın.</Text>
          <ScrollView
            horizontal
            accessibilityLabel="Teklif karşılaştırması"
            showsHorizontalScrollIndicator
          >
            <View>
              <View style={{ flexDirection: "row" }}>
                {rows.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      width: 220,
                      padding: 14,
                      backgroundColor: colors.pale,
                    }}
                  >
                    <Text style={styles.heading}>{p.clinic_name}</Text>
                    <Text style={styles.muted}>Sürüm {p.version}</Text>
                  </View>
                ))}
              </View>
              {fields.map((field) => (
                <View
                  key={field.name}
                  style={{
                    flexDirection: "row",
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {field.values.map((value, i) => (
                    <View
                      key={rows[i].id}
                      style={{
                        width: 220,
                        padding: 14,
                        gap: 8,
                        backgroundColor: i % 2 ? colors.pale : "#FFF",
                      }}
                    >
                      <Text style={styles.muted}>{field.name}</Text>
                      <Text style={styles.text}>{value}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={{ flexDirection: "row" }}>
                {rows.map((p) => (
                  <View key={p.id} style={{ width: 220, padding: 10 }}>
                    <Button
                      title={`${p.clinic_name} teklifini gör`}
                      onPress={() =>
                        router.push({
                          pathname: "/proposal/[id]",
                          params: { id: p.id },
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <Card>
            <Text style={styles.heading}>
              Farklı planlar farklı bakım anlamına gelebilir.
            </Text>
            <Text style={styles.muted}>
              Yalnızca toplam tutarı değil, nelerin dahil olduğunu da
              karşılaştırın. Karar vermeden önce eksik malzeme veya işlemleri
              kliniğe sorun.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
