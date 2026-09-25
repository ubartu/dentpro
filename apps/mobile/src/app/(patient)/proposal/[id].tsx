import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Heading,
  Loading,
  Notice,
  Screen,
  Section,
  colors,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import { useSession } from "../../../lib/session";
import { useAction } from "../../../lib/use-action";
import { request } from "../../../lib/api";
import { Proposal, date, label, money } from "../../../lib/types";
export default function ProposalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const r = useResource<Proposal>(`/proposals/${id}`);
  const action = useAction();
  const p = r.data;
  function book(kind: "callback" | "appointment") {
    Alert.alert(
      kind === "callback" ? "Request a callback?" : "Request an appointment?",
      "Your name and phone number will be shared with this clinic. The clinic must confirm an appointment before it is booked.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Send request",
          onPress: () =>
            void action.run(async () => {
              await request(`/proposals/${id}`, token!);
              await request("/appointments", token!, "POST", {
                proposal_id: id,
                kind,
              });
              router.replace("/appointments");
            }),
        },
      ],
    );
  }
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!p}>
      <Notice text={r.error || action.error} error />
      {r.error && (
        <Button title="Refresh proposal" onPress={() => void r.refresh()} />
      )}
      {r.loading && !p && <Loading />}
      {p && (
        <>
          <Heading
            title={p.clinic_name}
            subtitle={`${p.district} · Version ${p.version} · ${date(p.created_at)}`}
          />
          <Card>
            <Text style={styles.badge}>CLINIC’S PROPOSAL</Text>
            <Text style={styles.title}>{money(p.total_minor)}</Text>
            <Text style={styles.muted}>
              Preliminary total · {p.plan.sessions} visits
            </Text>
            {p.plan.items.map((item, i) => (
              <View
                key={i}
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  paddingTop: 16,
                  gap: 8,
                }}
              >
                <Text style={styles.heading}>{label(item.procedure_code)}</Text>
                <Text style={styles.text}>
                  Tooth {item.tooth} · {money(item.price_minor)}
                </Text>
                <Text style={styles.muted}>
                  Material: {item.material || "Not specified"}
                  {"\n"}Sessions: {item.sessions}
                </Text>
              </View>
            ))}
            <Text style={styles.text}>
              Examination:{" "}
              {p.plan.requires_exam ? "Required" : "Not specified as required"}
            </Text>
            <Text style={styles.muted}>
              First availability: {date(p.plan.first_available_slot)}
            </Text>
            {!!p.plan.notes && (
              <>
                <Text style={styles.heading}>Clinic notes</Text>
                <Text style={styles.text}>{p.plan.notes}</Text>
              </>
            )}
          </Card>
          <Card>
            <Text style={styles.badge}>PLAIN-LANGUAGE EXPLANATION</Text>
            {p.explanation ? (
              <>
                <Text style={styles.muted}>
                  Prepared from the procedure glossary ·{" "}
                  {p.explanation.glossary_status === "dentist_review_recorded"
                    ? "Reviewer attribution recorded"
                    : "Clinical wording review pending"}
                </Text>
                <Text style={styles.text}>{p.explanation.plain_summary}</Text>
                <Section
                  title="Understand each procedure"
                  detail={`${p.explanation.procedures.length} ${p.explanation.procedures.length === 1 ? "item" : "items"} explained`}
                >
                  {p.explanation.procedures.map((e) => (
                    <Text key={e.source_item_id} style={styles.text}>
                      {e.source_item_id}. {e.simple_explanation}
                    </Text>
                  ))}
                </Section>
                {!!p.explanation.missing_information.length && (
                  <Section title="Information to clarify">
                    {p.explanation.missing_information.map((v, i) => (
                      <Text key={i} style={styles.muted}>
                        • {v}
                      </Text>
                    ))}
                  </Section>
                )}
                {!!p.explanation.questions_to_ask_clinic.length && (
                  <Section title="Ask your clinic">
                    {p.explanation.questions_to_ask_clinic.map((v, i) => (
                      <Text key={i} style={styles.muted}>
                        • {v}
                      </Text>
                    ))}
                  </Section>
                )}
                <Notice text={p.explanation.disclaimer} />
              </>
            ) : (
              <Notice
                text={
                  p.explanation_status === "pending"
                    ? "The explanation is being prepared. You can read the clinic’s proposal now."
                    : "The explanation is currently unavailable. You can still review the original clinic proposal. Check back later."
                }
              />
            )}
          </Card>
          <Notice text="This is a preliminary proposal, not a confirmed treatment plan or diagnosis. A clinic examination may change the scope and price." />
          <Button
            title="Request a callback"
            busy={action.busy}
            onPress={() => book("callback")}
          />
          <Button
            title="Request an appointment"
            secondary
            busy={action.busy}
            onPress={() => book("appointment")}
          />
        </>
      )}
    </Screen>
  );
}
