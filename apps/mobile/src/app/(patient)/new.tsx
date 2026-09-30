import { useRef, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Check,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
  styles,
} from "../../components/ui";
import { useResource } from "../../lib/use-resource";
import { useSession } from "../../lib/session";
import { useAction } from "../../lib/use-action";
import { ApiError, request } from "../../lib/api";
import { Capabilities, DentalCase } from "../../lib/types";
export default function NewCase() {
  const { token } = useSession();
  const r = useResource<Capabilities>("/patient/capabilities");
  const action = useAction();
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  // Freeze submitted payload/key on uncertain failure. Retry resumes the same server submission.
  const pending = useRef<{ key: string; body: object } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const create = () =>
    action.run(async () => {
      if (!r.data || !token) return;
      if (!pending.current)
        pending.current = {
          key: Crypto.randomUUID(),
          body: {
            title: title.trim(),
            consent: true,
            consent_version: r.data.consent_version,
          },
        };
      setSubmitted(true);
      try {
        const c = await request<DentalCase>(
          "/cases",
          token,
          "POST",
          pending.current.body,
          pending.current.key,
        );
        router.replace({ pathname: "/case/[id]", params: { id: c.id } });
      } catch (error) {
        if (error instanceof ApiError && [400, 422].includes(error.status)) {
          pending.current = null;
          setSubmitted(false);
        }
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          error.message.includes("Onay koşulları")
        ) {
          pending.current = null;
          setSubmitted(false);
          setConsent(false);
          await r.refresh();
        }
        throw error;
      }
    });
  return (
    <Screen>
      <Heading
        title="Vakanızı oluşturun"
        subtitle="Vakanızı açın, röntgen ekleyin ve alıcı klinikleri seçin."
      />
      <Notice text={r.error || action.error} error />
      {r.loading && !r.data && <Loading />}
      {!!r.error && <Button title="Yeniden dene" onPress={() => void r.refresh()} />}
      <Card>
        <Field
          label="Vaka başlığı"
          placeholder="Örneğin: Üst azı dişi danışması"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          editable={!submitted}
        />
        <Text style={styles.muted}>
          Röntgeninizi ekledikten sonra platformdaki kliniklerden seçim yapın.
          Yakınınızdaki klinikleri önce görmek için konumunuzu kullanabilirsiniz.
        </Text>
      </Card>
      {r.data && (
        <Card>
          <Text style={styles.heading}>Bilgileriniz, sizin kararınız</Text>
          <Text style={styles.muted}>{r.data.consent_text}</Text>
          <Check
            label="Bu paylaşım onayını okudum ve kabul ediyorum"
            checked={consent}
            disabled={submitted}
            onChange={() => setConsent(!consent)}
          />
          <Button
            title={
              submitted ? "Gönderimi yeniden dene" : "Vaka oluştur ve röntgen ekle"
            }
            onPress={() => void create()}
            busy={action.busy}
            disabled={!consent || title.trim().length < 3}
          />
        </Card>
      )}
      {submitted && !!action.error && (
        <Notice text="Aynı gönderim güvenle yeniden denenecek. Kaydedilip kaydedilmediğini görmek için Vakalarınız ekranına da dönebilirsiniz." />
      )}
    </Screen>
  );
}
