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
      setError("Passwords do not match.");
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
        title={reset ? "Reset your password" : "Forgot your password?"}
        subtitle={
          reset
            ? "Paste the token from your reset email. Choose a new password."
            : "We will email a reset link if your account is eligible."
        }
      />
      {message ? (
        <Notice text={message} />
      ) : reset ? (
        <>
          <Field
            label="Reset token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
          <Field
            label="New password (at least 10 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </>
      ) : (
        <Field
          label="Account email"
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
          title={reset ? "Update password" : "Send reset email"}
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
        title={reset ? "Request a new reset email" : "Have a reset token?"}
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
        title="Back to sign in"
        quiet
        disabled={busy}
        onPress={() => router.replace("/sign-in")}
      />
      <Text style={styles.muted}>
        The email link can also reset your password in your browser. Then return
        to this app to sign in. Existing sessions are signed out after a reset.
      </Text>
    </Screen>
  );
}
