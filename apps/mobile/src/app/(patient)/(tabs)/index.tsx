import { useState } from "react";
import { Text, View, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Button,
  Empty,
  Field,
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

type CaseFilter = "active" | "draft" | "archived";
const filters = [
  { value: "active", title: "Aktif" },
  { value: "draft", title: "Taslak" },
  { value: "archived", title: "Arşiv" },
] as const;
const matchesFilter = (c: DentalCase, filter: CaseFilter) =>
  filter === "active" ? c.status !== "archived" : c.status === filter;

export default function Cases() {
  const { user, token } = useSession();
  const r = useResource<DentalCase[]>("/cases");
  const action = useAction();
  const [filter, setFilter] = useState<CaseFilter>("active");
  const [search, setSearch] = useState("");
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
  const open = (id: string) =>
    router.push({ pathname: "/case/[id]", params: { id } });
  const cases = r.data || [];
  const next =
    cases.find((c) => c.status === "draft") ||
    cases.find((c) => c.status !== "archived");
  const nextStep =
    next?.status === "draft"
      ? next.asset
        ? "Kliniklerinizi seçin"
        : "Röntgeninizi ekleyin"
      : "Klinik tekliflerini inceleyin";
  const query = search.trim().toLocaleLowerCase("tr-TR");
  const visible = cases.filter(
    (c) =>
      matchesFilter(c, filter) &&
      (!query || c.title.toLocaleLowerCase("tr-TR").includes(query)),
  );
  return (
    <Screen refresh={() => void r.refresh()} refreshing={r.loading && !!r.data}>
      <Heading
        title={`Merhaba, ${user?.name.split(" ")[0] || "hoş geldiniz"}`}
        subtitle="Vakalarınızı ve bir sonraki adımınızı takip edin."
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Yeni vaka oluştur"
        onPress={() => router.push("/new")}
        style={({ pressed }) => [local.create, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={local.createIcon}>
          <Ionicons name="add" size={25} color="white" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.heading, { color: "white" }]}>
            Yeni vaka oluştur
          </Text>
          <Text style={[styles.muted, { color: "#E4EEFF" }]}>
            Röntgen ekleyin, kliniklerle paylaşın.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="white" />
      </Pressable>
      {next && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${next.title} vakasına devam et: ${nextStep}`}
          onPress={() => open(next.id)}
          style={({ pressed }) => [local.next, pressed && { opacity: 0.75 }]}
        >
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={local.eyebrow}>SONRAKİ ADIMINIZ</Text>
            <Text style={[styles.heading, { fontSize: 17 }]}>{nextStep}</Text>
            <Text numberOfLines={1} style={styles.muted}>
              {next.title}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.blue} />
        </Pressable>
      )}
      <View style={{ gap: 12 }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={styles.heading}>Vakalarınız</Text>
          {r.data && <Text style={styles.muted}>{cases.length} toplam</Text>}
        </View>
        {cases.length > 0 && (
          <>
            <View style={local.filters}>
              {filters.map((item) => {
                const selected = filter === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="tab"
                    accessibilityLabel={`${item.title} vakalar`}
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item.value)}
                    style={[local.filter, selected && local.filterSelected]}
                  >
                    <Text
                      style={[
                        local.filterText,
                        selected && { color: colors.blue },
                      ]}
                    >
                      {item.title} ·{" "}
                      {cases.filter((c) => matchesFilter(c, item.value)).length}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Vaka ara"
              placeholder="Vaka başlığına göre ara"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
          </>
        )}
      </View>
      <Notice text={r.error} error />
      <Notice text={action.error} error />
      {!!r.error && (
        <Button
          title="Yeniden dene"
          onPress={() => void r.refresh()}
          secondary
        />
      )}
      {r.loading && !r.data && <Loading />}
      {r.data?.length === 0 && (
        <Empty
          title="İlk vakanızla başlayın"
          detail="Yeni vaka oluşturun, röntgeninizi ekleyin ve teklif almak istediğiniz klinikleri seçin."
        />
      )}
      {cases.length > 0 && visible.length === 0 && (
        <View style={{ gap: 12 }}>
          <Empty
            title={
              query ? "Aramanızla eşleşen vaka yok" : "Bu bölümde vaka yok"
            }
            detail={
              query
                ? "Başka bir başlık arayın veya diğer vaka bölümlerine bakın."
                : filter === "draft"
                  ? "Tamamlanmayı bekleyen taslağınız bulunmuyor."
                  : filter === "archived"
                    ? "Arşivlenen vakalarınız burada görünecek."
                    : "Yeni bir vaka oluşturarak başlayabilirsiniz."
            }
          />
          {!!query && (
            <Button
              title="Aramayı temizle"
              secondary
              onPress={() => setSearch("")}
            />
          )}
        </View>
      )}
      {visible.map((c) => (
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
                style={[styles.badge, c.status === "draft" && local.draftBadge]}
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
              <Ionicons name="trash-outline" size={17} color={colors.danger} />
              <Text style={local.deleteText}>Taslağı sil</Text>
            </Pressable>
          )}
        </View>
      ))}
    </Screen>
  );
}
const local = StyleSheet.create({
  create: {
    backgroundColor: colors.blue,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  createIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#4784EE",
    alignItems: "center",
    justifyContent: "center",
  },
  next: {
    backgroundColor: colors.pale,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  eyebrow: {
    color: colors.blue,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: {
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterSelected: { borderColor: colors.blue, backgroundColor: colors.pale },
  filterText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 13 },
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
  deleteText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
  caseIcon: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  draftBadge: { backgroundColor: "#FFF5DF", color: colors.amber },
});
