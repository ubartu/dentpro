import { useState } from "react";
import { Text, View } from "react-native";
import {
  Button,
  Card,
  Field,
  Heading,
  Notice,
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
    <Screen>
      <View style={{ paddingVertical: 16, gap: 14 }}>
        <Text style={styles.badge}>YOUR DENTAL CARE, EXPLAINED</Text>
        <Heading
          title={register ? "A clearer path to care." : "Welcome to DENTpro."}
          subtitle="Share one X-ray. Hear from clinics. Understand your options."
        />
      </View>
      <Card>
        <Text style={styles.heading}>
          {register ? "Create your patient account" : "Sign in to your account"}
        </Text>
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
          secondary
          onPress={() => {
            setRegister(!register);
            setError("");
          }}
        />
      </Card>
      {__DEV__ && (
        <Notice text="Development environment — use synthetic data only." />
      )}
      <Text style={styles.muted}>
        DENTpro explains proposals written by clinics. It does not diagnose
        conditions or prescribe treatment.
      </Text>
    </Screen>
  );
}
