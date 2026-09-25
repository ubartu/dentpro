import {
  Text,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Button,
  Empty,
  Heading,
  Loading,
  Notice,
  Screen,
  colors,
  fonts,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import { useSession } from "../../../lib/session";
import { DentalCase, label } from "../../../lib/types";
const art = {
  care: require("../../../../assets/figma/care-illustration.png"),
  relax: require("../../../../assets/figma/relax-illustration.png"),
  banner: require("../../../../assets/figma/banner-pattern.png"),
};
export default function Cases() {
  const { user } = useSession();
  const r = useResource<DentalCase[]>("/cases");
  const { width, fontScale } = useWindowDimensions();
  const narrow = width < 350 || fontScale > 1.3;
  const open = (id: string) =>
    router.push({ pathname: "/case/[id]", params: { id } });
  const active = r.data?.find((c) => c.status !== "archived");
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title={`Hello, ${user?.name.split(" ")[0] || "there"}`}
        subtitle="Let’s make your next step a little clearer."
      />
      <View style={{ flexDirection: narrow ? "column" : "row", gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a new case"
          onPress={() => router.push("/new")}
          style={({ pressed }) => [
            local.action,
            { backgroundColor: colors.blue, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View
            pointerEvents="none"
            style={[local.art, { mixBlendMode: "multiply" }]}
          >
            <Image
              source={art.care}
              contentFit="contain"
              style={StyleSheet.absoluteFill}
              accessible={false}
            />
          </View>
          <View style={local.actionText}>
            <Text style={[styles.heading, { color: "white" }]}>New case</Text>
            <Text style={[local.caption, { color: "#E4EEFF" }]}>
              START WITH AN X-RAY
            </Text>
          </View>
          <View style={[local.pill, { backgroundColor: "white" }]}>
            <Text style={local.pillText}>Get started</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.blue} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View your requests"
          onPress={() => router.push("/appointments")}
          style={({ pressed }) => [
            local.action,
            { backgroundColor: colors.sky, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View
            pointerEvents="none"
            style={[local.art, { mixBlendMode: "multiply" }]}
          >
            <Image
              source={art.relax}
              contentFit="contain"
              style={StyleSheet.absoluteFill}
              accessible={false}
            />
          </View>
          <View style={local.actionText}>
            <Text style={styles.heading}>Your requests</Text>
            <Text style={local.caption}>KEEP IN TOUCH</Text>
          </View>
          <View style={[local.pill, { backgroundColor: colors.ink }]}>
            <Text style={[local.pillText, { color: "white" }]}>View all</Text>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </View>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? `Continue ${active.title}` : "Start your first case"
        }
        onPress={() => (active ? open(active.id) : router.push("/new"))}
        style={local.banner}
      >
        <Image
          source={art.banner}
          style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
          contentFit="cover"
          accessible={false}
        />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.heading, { color: "white", fontSize: 17 }]}>
            {active ? "Pick up where you left off" : "Your care, at your pace"}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.muted, { color: "#E1EEFF", fontSize: 12 }]}
          >
            {active ? active.title : "Upload · Choose clinics · Compare"}
          </Text>
        </View>
        <View style={local.arrow}>
          <Ionicons name="arrow-forward" size={20} color={colors.blue} />
        </View>
      </Pressable>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.heading}>Your cases</Text>
        <Text style={styles.muted}>
          {r.data?.length ?? ""}
          {r.data ? " total" : ""}
        </Text>
      </View>
      <Notice text={r.error} error />
      {r.error && (
        <Button title="Try again" onPress={() => void r.refresh()} secondary />
      )}
      {r.loading && !r.data && <Loading />}
      {r.data?.length === 0 && (
        <Empty
          title="A fresh start"
          detail="Your cases will appear here. Start with an X-ray whenever you’re ready."
        />
      )}
      {r.data?.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${c.title}`}
          onPress={() => open(c.id)}
          style={({ pressed }) => [
            local.case,
            pressed && { backgroundColor: colors.pale },
          ]}
        >
          <View style={local.caseIcon}>
            <Ionicons
              name={
                c.status === "draft"
                  ? "document-outline"
                  : "folder-open-outline"
              }
              size={25}
              color={colors.blue}
            />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text numberOfLines={2} style={[styles.heading, { fontSize: 15 }]}>
              {c.title}
            </Text>
            <Text style={styles.muted}>
              {c.region} · {c.recipients.length} clinics
            </Text>
            <Text style={[styles.badge, { fontSize: 10, paddingVertical: 3 }]}>
              {label(c.status)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ))}
    </Screen>
  );
}
const local = StyleSheet.create({
  action: {
    flex: 1,
    isolation: "isolate",
    minHeight: 218,
    borderRadius: 16,
    overflow: "hidden",
    padding: 16,
    justifyContent: "flex-end",
    gap: 20,
  },
  art: { position: "absolute", right: 0, top: 0, width: 177, height: 210 },
  actionText: { gap: 6, paddingTop: 75 },
  caption: {
    color: "#395776",
    fontFamily: fonts.medium,
    fontSize: 9,
    letterSpacing: 0.7,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  pillText: { fontFamily: fonts.semibold, color: colors.blue, fontSize: 11 },
  banner: {
    backgroundColor: "#235AA8",
    borderRadius: 16,
    padding: 20,
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  arrow: {
    width: 40,
    height: 40,
    backgroundColor: "white",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  case: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  caseIcon: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
});
