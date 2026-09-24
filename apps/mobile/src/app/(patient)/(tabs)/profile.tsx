import { useState } from "react";
import { Text } from "react-native";
import {
  Button,
  Card,
  Field,
  Heading,
  Notice,
  Screen,
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
      setNotice("Profile saved.");
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
        title="Your profile."
        subtitle="Keep your contact details up to date for clinic responses."
      />
      <Notice text={action.error} error />
      <Notice text={notice} />
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Button
          title="Save profile"
          onPress={() => void save()}
          busy={action.busy}
        />
      </Card>
      <Card>
        <Text style={styles.heading}>Change password</Text>
        <Field
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <Field
          label="New password (at least 10 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.muted}>
          Changing your password signs you out on all devices.
        </Text>
        <Button
          title="Update password"
          secondary
          onPress={() => void change()}
          disabled={!current || password.length < 10}
          busy={action.busy}
        />
      </Card>
      <Button
        title="Sign out"
        secondary
        onPress={() => void action.run(signOut)}
        busy={action.busy}
      />
      <Notice text="Your case and X-ray are shared only with selected clinics. Clinics receive your name and phone when you request contact. Explanations simplify the clinic’s proposal and do not replace a professional consultation." />
    </Screen>
  );
}
