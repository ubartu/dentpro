import { useState } from "react";
import { Text, View } from "react-native";
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
import { LogoMark } from "../components/logo-mark";
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
    <Screen topInset contentStyle={{ flexGrow: 1, paddingTop: 28, gap: 32 }}>
      <View style={{ gap: 36 }}>
        <Brand />
        <View style={{ alignItems: "center" }}>
          <LogoMark size={112} />
        </View>
        <Heading
          title={
            register
              ? "Create your account"
              : "Sign in to your\nDENTpro account"
          }
          subtitle={
            register
              ? "A little about you. A clearer path to dental care."
              : "Welcome back. Your care, all in one place."
          }
        />
      </View>
      {busy ? (
        <LoadingBrand
          title={register ? "Creating your account" : "Signing you in"}
          detail="Connecting to your care space…"
        />
      ) : (
        <View style={{ gap: 20 }}>
          {register && (
            <>
              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Text style={styles.muted}>
                Shared with a clinic only after you request contact.
              </Text>
            </>
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label={register ? "Password (at least 10 characters)" : "Password"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={register ? "new-password" : "current-password"}
          />
          <Notice text={error} error />
          <Button
            title={register ? "Create account" : "Sign in"}
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
                ? "Already registered? Sign in"
                : "New here? Create an account"
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
          Your information. Your choice.
        </Text>
      </View>
      <Text
        style={[
          styles.muted,
          { textAlign: "center", fontSize: 11, lineHeight: 17 },
        ]}
      >
        DENTpro explains proposals written by clinics. It does not diagnose
        conditions or prescribe treatment.
      </Text>
    </Screen>
  );
}
