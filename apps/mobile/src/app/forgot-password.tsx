import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Field,
  Heading,
  Notice,
  Screen,
  styles,
} from "../components/ui";
import { request, errorMessage } from "../lib/api";

export default function ForgotPassword() {
  const [reset, setReset] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit() {
    if (busy) return;
    if (reset && password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await request<{ message: string }>(
        reset ? "/auth/password/reset" : "/auth/password/forgot",
        undefined,
        "POST",
        reset
          ? { token: token.trim(), new_password: password }
          : { email: email.trim() },
      );
      setMessage(result.message);
      setPassword("");
      setConfirm("");
      setToken("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Heading
        title={reset ? "Şifrenizi yenileyin" : "Şifrenizi mi unuttunuz?"}
        subtitle={
          reset
            ? "E-postadaki yenileme kodunu girip yeni şifrenizi belirleyin."
            : "Hesabınız uygunsa size şifre yenileme bağlantısı göndereceğiz."
        }
      />
      {message ? (
        <Notice text={message} />
      ) : reset ? (
        <>
          <Field
            label="Yenileme kodu"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
          <Field
            label="Yeni şifre (en az 10 karakter)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Field
            label="Yeni şifreyi doğrulayın"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </>
      ) : (
        <Field
          label="Hesap e-postası"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      )}
      <Notice text={error} error />
      {!message && (
        <Button
          title={reset ? "Şifreyi güncelle" : "Yenileme e-postası gönder"}
          busy={busy}
          disabled={
            reset
              ? !/^[A-Za-z0-9_-]{43}$/.test(token.trim()) ||
                password.length < 10 ||
                !confirm
              : !email.trim()
          }
          onPress={() => void submit()}
        />
      )}
      <Button
        title={reset ? "Yeni bağlantı iste" : "Yenileme kodunuz var mı?"}
        secondary
        disabled={busy}
        onPress={() => {
          setReset(!reset);
          setMessage("");
          setError("");
          setPassword("");
          setConfirm("");
          setToken("");
        }}
      />
      <Button
        title="Giriş ekranına dön"
        quiet
        disabled={busy}
        onPress={() => router.replace("/sign-in")}
      />
      <Text style={styles.muted}>
        E-postadaki bağlantıyla şifrenizi tarayıcıda da yenileyebilirsiniz.
        Ardından uygulamaya dönüp giriş yapın. Şifre yenilenince açık oturumlar
        kapatılır.
      </Text>
    </Screen>
  );
}
