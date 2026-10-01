import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Brand,
  colors,
  fonts,
  Field,
  Heading,
  Notice,
  LoadingBrand,
  Screen,
  styles,
} from "../components/ui";
import { request, errorMessage } from "../lib/api";
import { useSession } from "../lib/session";
import type { Session } from "../lib/types";
export default function SignIn() {
  const { accept } = useSession();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await accept(
        await request<Session>(
          register ? "/patient/register" : "/patient/login",
          undefined,
          "POST",
          {
            email: email.trim(),
            password,
            ...(register ? { name: name.trim(), phone: phone.trim() } : {}),
          },
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen topInset contentStyle={{ flexGrow: 1, paddingTop: 20, gap: 24 }}>
      <View style={{ gap: 24 }}>
        <Brand />
        <Heading
          title={register ? "Hesabınızı oluşturun" : "Hesabınıza giriş yapın"}
          subtitle={
            register
              ? "Sizi tanıyalım, diş sağlığınız için yol haritanızı oluşturalım."
              : "Tekrar hoş geldiniz. Tüm bakım süreciniz tek yerde."
          }
        />
      </View>
      {busy ? (
        <LoadingBrand
          title={register ? "Hesabınız oluşturuluyor" : "Giriş yapılıyor"}
          detail="Hesabınıza bağlanılıyor…"
        />
      ) : (
        <View style={{ gap: 16 }}>
          {register && (
            <>
              <Field
                label="Ad soyad"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
              <Field
                label="Telefon numarası"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Text style={styles.muted}>
                Yalnızca iletişim talep ettiğiniz kliniğe iletilir.
              </Text>
            </>
          )}
          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label={register ? "Şifre (en az 10 karakter)" : "Şifre"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={register ? "new-password" : "current-password"}
          />
          {!register && (
            <Button
              title="Şifrenizi mi unuttunuz?"
              quiet
              onPress={() => router.push("/forgot-password")}
            />
          )}
          <Notice text={error} error />
          <Button
            title={register ? "Hesap oluştur" : "Giriş yap"}
            onPress={() => void submit()}
            busy={busy}
            disabled={
              !email.trim() ||
              !password ||
              (register &&
                (name.trim().length < 2 ||
                  phone.trim().length < 7 ||
                  password.length < 10))
            }
          />
          <Button
            title={
              register
                ? "Hesabınız var mı? Giriş yapın"
                : "Yeni misiniz? Hesap oluşturun"
            }
            quiet
            disabled={busy}
            onPress={() => {
              setRegister(!register);
              setError("");
            }}
          />
        </View>
      )}
      <View style={{ flex: 1, minHeight: 10 }} />
      <View style={{ alignItems: "center", gap: 10 }}>
        <Text
          style={{ color: colors.blue, fontFamily: fonts.medium, fontSize: 12 }}
        >
          Bilgileriniz. Sizin kararınız.
        </Text>
      </View>
      <Text
        style={[
          styles.muted,
          { textAlign: "center", fontSize: 11, lineHeight: 17 },
        ]}
      >
        DENTRIVO, kliniklerin hazırladığı teklifleri açıklar. Tanı koymaz veya
        tedavi önermez.
      </Text>
    </Screen>
  );
}
