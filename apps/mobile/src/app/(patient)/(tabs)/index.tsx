import { Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Empty,
  Heading,
  Loading,
  Notice,
  Screen,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import { useSession } from "../../../lib/session";
import { DentalCase, date, label } from "../../../lib/types";
export default function Cases() {
  const { user } = useSession();
  const r = useResource<DentalCase[]>("/cases");
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title={`Hello, ${user?.name.split(" ")[0] || "there"}.`}
        subtitle="Your next step toward a confident decision."
      />
      <Card>
        <Text style={styles.badge}>START WITH YOUR X-RAY</Text>
        <Text style={styles.heading}>One case. Multiple perspectives.</Text>
        <Text style={styles.muted}>
          Choose clinics and receive structured treatment proposals, with
          explanations in plain language.
        </Text>
        <Button title="Create a new case" onPress={() => router.push("/new")} />
      </Card>
      <Text style={styles.heading}>Your cases</Text>
      <Notice text={r.error} error />
      {r.error && (
        <Button title="Try again" onPress={() => void r.refresh()} secondary />
      )}
      {r.loading && !r.data && <Loading />}
      {r.data?.length === 0 && (
        <Empty
          title="Your journey starts here"
          detail="Create a case and upload a panoramic X-ray to request proposals."
        />
      )}
      {r.data?.map((c) => (
        <Card key={c.id}>
          <Text style={styles.badge}>{label(c.status)}</Text>
          <Text style={styles.heading}>{c.title}</Text>
          <Text style={styles.muted}>
            {c.region} · {c.recipients.length} clinics · {date(c.created_at)}
          </Text>
          <Button
            title={`Open ${c.title}`}
            secondary
            onPress={() =>
              router.push({ pathname: "/case/[id]", params: { id: c.id } })
            }
          />
        </Card>
      ))}
    </Screen>
  );
}
