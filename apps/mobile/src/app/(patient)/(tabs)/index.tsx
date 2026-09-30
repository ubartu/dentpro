import {
  Text,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Alert,
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
import { useAction } from "../../../lib/use-action";
import { request } from "../../../lib/api";
import { DentalCase, label } from "../../../lib/types";
const art = {
  care: require("../../../../assets/figma/care-illustration.png"),
  relax: require("../../../../assets/figma/relax-illustration.png"),
  banner: require("../../../../assets/figma/banner-pattern.png"),
};
export default function Cases() {
  const { user, token } = useSession();
  const r = useResource<DentalCase[]>("/cases");
  const action = useAction();
  function confirmDelete(c: DentalCase) {
    Alert.alert(
      "Taslak silinsin mi?",
      `“${c.title}” ve yüklenen röntgen kalıcı olarak silinecek.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Taslağı sil",
          style: "destructive",
          onPress: () =>
            void action.run(async () => {
              await request(`/cases/${c.id}`, token!, "DELETE");
              r.setData(
                (current) => current?.filter((item) => item.id !== c.id) || [],
              );
              await r.refresh();
            }),
        },
      ],
      { cancelable: true },
    );
  }
  const { width, fontScale } = useWindowDimensions();
  const narrow = width < 350 || fontScale > 1.3;
  const open = (id: string) =>
    router.push({ pathname: "/case/[id]", params: { id } });
  const active = r.data?.find((c) => c.status !== "archived");
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title={`Merhaba, ${user?.name.split(" ")[0] || "hoş geldiniz"}`}
        subtitle="Bir sonraki adımınızı birlikte netleştirelim."
      />
      <View style={{ flexDirection: narrow ? "column" : "row", gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeni vaka oluştur"
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
            <Text style={[styles.heading, { color: "white" }]}>Yeni vaka</Text>
            <Text style={[local.caption, { color: "#E4EEFF" }]}>
              RÖNTGENLE BAŞLAYIN
            </Text>
          </View>
          <View style={[local.pill, { backgroundColor: "white" }]}>
            <Text style={local.pillText}>Başlayın</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.blue} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Taleplerinizi görüntüleyin"
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
            <Text style={styles.heading}>Talepleriniz</Text>
            <Text style={local.caption}>İLETİŞİMDE KALIN</Text>
          </View>
          <View style={[local.pill, { backgroundColor: colors.ink }]}>
            <Text style={[local.pillText, { color: "white" }]}>Tümünü gör</Text>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </View>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          active ? `${active.title} vakasına devam et` : "İlk vakanızı oluşturun"
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
            {active ? "Kaldığınız yerden devam edin" : "Bakımınız, sizin hızınızda"}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.muted, { color: "#E1EEFF", fontSize: 12 }]}
          >
            {active ? active.title : "Yükleyin · Klinik seçin · Karşılaştırın"}
          </Text>
        </View>
        <View style={local.arrow}>
          <Ionicons name="arrow-forward" size={20} color={colors.blue} />
        </View>
      </Pressable>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.heading}>Vakalarınız</Text>
        <Text style={styles.muted}>
          {r.data?.length ?? ""}
          {r.data ? " toplam" : ""}
        </Text>
      </View>
      <Notice text={r.error} error />
      <Notice text={action.error} error />
      {!!r.error && (
        <Button title="Yeniden dene" onPress={() => void r.refresh()} secondary />
      )}
      {r.loading && !r.data && <Loading />}
      {r.data?.length === 0 && (
        <Empty
          title="Yeni bir başlangıç"
          detail="Vakalarınız burada görünecek. Hazır olduğunuzda bir röntgenle başlayın."
        />
      )}
      {r.data?.map((c) => (
        <View key={c.id} style={local.case}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${c.title} vakasını aç`}
            onPress={() => open(c.id)}
            style={({ pressed }) => [
              local.caseBody,
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
              <Text
                numberOfLines={2}
                style={[styles.heading, { fontSize: 15 }]}
              >
                {c.title}
              </Text>
              <Text style={styles.muted}>
                {label(c.region)} · {c.recipients.length} klinik
              </Text>
              <Text
                style={[styles.badge, { fontSize: 10, paddingVertical: 3 }]}
              >
                {label(c.status)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
          {c.status === "draft" && c.recipients.length === 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${c.title} taslağını sil`}
              accessibilityState={{ disabled: action.busy }}
              disabled={action.busy}
              onPress={() => confirmDelete(c)}
              style={[local.deleteDraft, action.busy && { opacity: 0.5 }]}
            >
              <Ionicons name="trash-outline" size={17} color="#A33232" />
              <Text style={local.deleteText}>Taslağı sil</Text>
            </Pressable>
          )}
        </View>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  caseBody: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  deleteDraft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteText: { fontFamily: fonts.medium, fontSize: 12, color: "#A33232" },
  caseIcon: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
});
