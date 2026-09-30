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
      name: "Preliminary total",
      values: rows.map((p) => money(p.total_minor, p.plan.currency)),
    },
    { name: "Currency", values: rows.map((p) => p.plan.currency) },
    { name: "Total visits", values: rows.map((p) => String(p.plan.sessions)) },
    {
      name: "Examination required",
      values: rows.map((p) =>
        p.plan.requires_exam ? "Yes" : "Not specified as required",
      ),
    },
    {
      name: "First availability",
      values: rows.map((p) => date(p.plan.first_available_slot)),
    },
    {
      name: "Procedures & materials",
      values: rows.map((p) =>
        p.plan.items
          .map(
            (i) =>
              `Tooth ${i.tooth} · ${label(i.procedure_code)}\nPriority: ${urgencyLabel(i.urgency)} · Set by the clinic\n${i.material || "Material not specified"} · ${i.sessions} sessions\n${money(i.price_minor, p.plan.currency)}`,
          )
          .join("\n\n"),
      ),
    },
  ];
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title="Compare your options"
        subtitle="Compare the same fields, without scores or rankings."
      />
      <Notice text={r.error} error />
      {r.error && <Button title="Retry" onPress={() => void r.refresh()} />}
      {r.loading && !r.data && <Loading />}
      {r.data && (
        <>
          <Notice text={r.data.notice} />
          {rows.length < 2 && (
            <Empty
              title="More proposals needed"
              detail="At least two current proposals are needed for a useful comparison."
            />
          )}
          <Text style={styles.muted}>Swipe sideways to see each clinic.</Text>
          <ScrollView
            horizontal
            accessibilityLabel="Proposal comparison"
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
                    <Text style={styles.muted}>Version {p.version}</Text>
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
                      title={`View ${p.clinic_name}`}
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
              Different plans can mean different care.
            </Text>
            <Text style={styles.muted}>
              Compare what is included, not just the total. Ask each clinic
              about missing materials or procedures before deciding.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
