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
import { Proposal, date, label, money, urgencyLabel } from "../../../lib/types";
export default function ProposalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const r = useResource<Proposal>(`/proposals/${id}`);
  const action = useAction();
  const p = r.data;
  function book(kind: "callback" | "appointment") {
    Alert.alert(
      kind === "callback" ? "Geri arama isteği gönderilsin mi?" : "Randevu isteği gönderilsin mi?",
      "Adınız ve telefon numaranız bu klinikle paylaşılacak. Randevu kesinleşmeden önce klinik tarafından onaylanmalıdır.",
      [
        { text: "Şimdi değil", style: "cancel" },
        {
          text: "Talebi gönder",
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
      {!!r.error && (
        <Button title="Teklifi yenile" onPress={() => void r.refresh()} />
      )}
      {r.loading && !p && <Loading />}
      {p && (
        <>
          <Heading
            title={p.clinic_name}
            subtitle={`${p.district} · Sürüm ${p.version} · ${date(p.created_at)}`}
          />
          <Card>
            <Text style={styles.badge}>KLİNİĞİN TEKLİFİ</Text>
            <Text style={styles.title}>
              {money(p.total_minor, p.plan.currency)}
            </Text>
            <Text style={styles.muted}>
              Tahmini toplam · {p.plan.sessions} seans
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
                  Diş {item.tooth} ·{" "}
                  {money(item.price_minor, p.plan.currency)}
                </Text>
                <Text style={styles.muted}>
                  Öncelik: {urgencyLabel(item.urgency)} · Klinik tarafından belirlendi
                  {"\n"}
                  Malzeme: {item.material || "Belirtilmedi"}
                  {"\n"}Seans: {item.sessions}
                </Text>
              </View>
            ))}
            <Text style={styles.text}>
              Muayene:{" "}
              {p.plan.requires_exam ? "Gerekli" : "Gerekliliği belirtilmedi"}
            </Text>
            <Text style={styles.muted}>
              İlk uygun tarih: {date(p.plan.first_available_slot)}
            </Text>
            {!!p.plan.notes && (
              <>
                <Text style={styles.heading}>Klinik notları</Text>
                <Text style={styles.text}>{p.plan.notes}</Text>
              </>
            )}
          </Card>
          <Card>
            <Text style={styles.badge}>SADE DİLDE AÇIKLAMA</Text>
            {p.explanation ? (
              <>
                <Text style={styles.badge}>
                  {p.explanation.mode === "ai"
                    ? "YAPAY ZEKÂ DESTEKLİ ÖZET"
                    : p.explanation.mode === "template_fallback"
                      ? "ŞABLON ÖZET · YAPAY ZEKÂ KULLANILAMADI"
                      : "ŞABLON ÖZET"}
                </Text>
                <Text style={styles.muted}>
                  {p.explanation.mode === "ai"
                    ? "Yapay zekâ kliniğin yapılandırılmış planını yeniden ifade etti; bu ifade klinik olarak incelenmedi. İşlem açıklamaları sözlükten gelir. "
                    : "İşlem sözlüğünden hazırlandı. "}
                  {p.explanation.glossary_status === "dentist_review_recorded"
                    ? "İnceleyen kişi kaydedildi"
                    : "Klinik ifade incelemesi bekleniyor"}
                </Text>
                <Text style={styles.text}>{p.explanation.plain_summary}</Text>
                <Section
                  title="İşlemleri anlayın"
                  detail={`${p.explanation.procedures.length} işlem açıklandı`}
                >
                  {p.explanation.procedures.map((e) => (
                    <Text key={e.source_item_id} style={styles.text}>
                      {e.source_item_id}. {e.simple_explanation}
                    </Text>
                  ))}
                </Section>
                {!!p.explanation.missing_information.length && (
                  <Section title="Netleştirilmesi gerekenler">
                    {p.explanation.missing_information.map((v, i) => (
                      <Text key={i} style={styles.muted}>
                        • {v}
                      </Text>
                    ))}
                  </Section>
                )}
                {!!p.explanation.questions_to_ask_clinic.length && (
                  <Section title="Kliniğe sorulacaklar">
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
                    ? "Açıklama hazırlanıyor. Bu sırada kliniğin teklifini okuyabilirsiniz."
                    : "Açıklama şu anda kullanılamıyor. Kliniğin özgün teklifini inceleyebilir, daha sonra tekrar bakabilirsiniz."
                }
              />
            )}
          </Card>
          <Notice text="Bu bir ön tekliftir; kesin tedavi planı veya tanı değildir. Klinik muayenesi kapsamı ve fiyatı değiştirebilir." />
          <Button
            title="Geri arama iste"
            busy={action.busy}
            onPress={() => book("callback")}
          />
          <Button
            title="Randevu iste"
            secondary
            busy={action.busy}
            onPress={() => book("appointment")}
          />
        </>
      )}
    </Screen>
  );
}
