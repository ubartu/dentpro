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
  const [saved, setSaved] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const values = {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
  };
  const dirty =
    values.name !== saved.name ||
    values.email !== saved.email ||
    values.phone !== saved.phone;
  const validation =
    values.name.length < 2
      ? "Ad soyad en az 2 karakter olmalıdır."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
        ? "Geçerli bir e-posta adresi girin."
        : values.phone.length < 7 || !/^\+?[0-9 ()-]+$/.test(values.phone)
          ? "Geçerli bir telefon numarası girin (en az 7 karakter)."
          : "";
  const save = () =>
    action.run(async () => {
      if (!dirty || validation) return;
      setNotice("");
      const updated = await request<Patient>(
        "/patient/me",
        token!,
        "PUT",
        values,
      );
      setName(updated.name);
      setEmail(updated.email);
      setPhone(updated.phone);
      setSaved({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
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
        <Field
          label="Ad soyad"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNotice("");
          }}
          editable={!action.busy}
          maxLength={100}
          autoComplete="name"
        />
        <Field
          label="E-posta"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setNotice("");
          }}
          editable={!action.busy}
          autoComplete="email"
          maxLength={150}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Telefon numarası"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setNotice("");
          }}
          editable={!action.busy}
          maxLength={40}
          autoComplete="tel"
          keyboardType="phone-pad"
        />
        {dirty && !!validation && <Notice text={validation} error />}
        <Button
          title="Profili kaydet"
          onPress={() => void save()}
          busy={action.busy}
          disabled={!dirty || !!validation}
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
