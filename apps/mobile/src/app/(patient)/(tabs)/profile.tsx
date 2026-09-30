import { useState } from "react";
import { Text } from "react-native";
import {
  Button,
  Card,
  Field,
  Heading,
  Notice,
  Screen,
  Section,
  styles,
} from "../../../components/ui";
import { useSession } from "../../../lib/session";
import { useAction } from "../../../lib/use-action";
import { request } from "../../../lib/api";
import type { Patient } from "../../../lib/types";
export default function Profile() {
  const { user, token, setUser, signOut, expire } = useSession();
  const action = useAction();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const save = () =>
    action.run(async () => {
      const updated = await request<Patient>("/patient/me", token!, "PUT", {
        name,
        email,
        phone,
      });
      setUser(updated);
      setNotice("Profil kaydedildi.");
    });
  const change = () =>
    action.run(async () => {
      await request("/patient/password", token!, "PUT", {
        current_password: current,
        new_password: password,
      });
      await expire();
    });
  return (
    <Screen>
      <Heading
        title="Profiliniz"
        subtitle="Kliniklerin size ulaşabilmesi için iletişim bilgilerinizi güncel tutun."
      />
      <Notice text={action.error} error />
      <Notice text={notice} />
      <Card>
        <Field label="Ad soyad" value={name} onChangeText={setName} />
        <Field
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Telefon numarası"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Button
          title="Profili kaydet"
          onPress={() => void save()}
          busy={action.busy}
        />
      </Card>
      <Section title="Şifre değiştir" detail="Hesap güvenliğinizi yönetin">
        <Field
          label="Mevcut şifre"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <Field
          label="Yeni şifre (en az 10 karakter)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.muted}>
          Şifrenizi değiştirdiğinizde tüm cihazlardaki oturumlar kapatılır.
        </Text>
        <Button
          title="Şifreyi güncelle"
          secondary
          onPress={() => void change()}
          disabled={!current || password.length < 10}
          busy={action.busy}
        />
      </Section>
      <Button
        title="Çıkış yap"
        quiet
        onPress={() => void action.run(signOut)}
        busy={action.busy}
      />
      <Notice text="Vakanız ve röntgeniniz yalnızca seçtiğiniz kliniklerle paylaşılır. Adınız ve telefonunuz, iletişim istediğinizde kliniğe iletilir. Açıklamalar klinik teklifini sadeleştirir; uzman görüşünün yerini almaz." />
    </Screen>
  );
}
