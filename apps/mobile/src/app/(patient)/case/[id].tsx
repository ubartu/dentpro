import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { File } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import {
  Button,
  Card,
  Empty,
  Heading,
  Loading,
  Notice,
  Screen,
  Section,
  styles,
} from "../../../components/ui";
import { useResource } from "../../../lib/use-resource";
import { useSession } from "../../../lib/session";
import { useAction } from "../../../lib/use-action";
import { request, upload } from "../../../lib/api";
import {
  Capabilities,
  DentalCase,
  Proposal,
  label,
  money,
} from "../../../lib/types";
import { CaseImage } from "../../../components/case-image";
import { openAsset } from "../../../lib/assets";
export default function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const cases = useResource<DentalCase[]>("/cases");
  const proposals = useResource<Proposal[]>(`/cases/${id}/proposals`);
  const c = cases.data?.find((v) => v.id === id);
  const action = useAction();
  const [previewRevision, setPreviewRevision] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const refresh = async () => {
    await Promise.all([cases.refresh(), proposals.refresh()]);
  };
  const choose = () =>
    action.run(async () => {
      const limits = await request<Capabilities>(
        "/patient/capabilities",
        token!,
      );
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      try {
        if ((file.size || 0) > limits.upload_limit_mb * 1024 * 1024)
          throw new Error(
            `${limits.upload_limit_mb} MB'den küçük bir dosya seçin.`,
          );
        setProgress(0);
        await upload(`/cases/${id}/xray`, token!, file, setProgress);
        setPreviewRevision((v) => v + 1);
        await refresh();
      } finally {
        setProgress(null);
        const copy = new File(file.uri);
        if (copy.exists) copy.delete();
      }
    });
  return (
    <Screen refresh={() => void refresh()} refreshing={cases.loading && !!c}>
      <Notice text={cases.error || proposals.error || action.error} error />
      {!!(cases.error || proposals.error) && (
        <Button title="Yeniden dene" onPress={() => void refresh()} />
      )}
      {!c ? (
        cases.loading ? (
          <Loading />
        ) : (
          <Empty
            title="Vaka kullanılamıyor"
            detail="Vakalarınıza dönün veya sayfayı yenileyip tekrar deneyin."
          />
        )
      ) : (
        <>
          <Heading
            title={c.title}
            subtitle={`${label(c.region)} · ${label(c.status)}`}
          />
          <Section
            title="Röntgeniniz"
            detail={c.asset ? c.asset.name : "Başlamak için bir görüntü ekleyin"}
            initiallyOpen={c.status === "draft"}
          >
            {c.asset ? (
              <>
                {c.asset.type.startsWith("image/") && (
                  <CaseImage
                    caseId={id}
                    token={token!}
                    revision={`${c.asset.name}:${previewRevision}`}
                  />
                )}
                <Button
                  title="Dosyayı aç / paylaş"
                  secondary
                  busy={action.busy}
                  onPress={() =>
                    void action.run(() => openAsset(id, c.asset!, token!))
                  }
                />
              </>
            ) : (
              <Text style={styles.muted}>
                Panoramik röntgeninizi PNG, JPEG veya PDF olarak ekleyin.
              </Text>
            )}
            {c.status === "draft" && (
              <Button
                title={c.asset ? "Röntgeni değiştir" : "Röntgen dosyası seç"}
                busy={action.busy}
                onPress={() => void choose()}
              />
            )}
            {progress !== null && (
              <Text accessibilityLiveRegion="polite" style={styles.muted}>
                Yükleniyor %{progress}
              </Text>
            )}
          </Section>
          {c.status !== "archived" && (
            <Button
              title={
                c.recipients.length
                  ? `${c.recipients.length} klinikle paylaşıldı · yönet`
                  : "Klinik seç ve paylaş"
              }
              secondary={c.recipients.length > 0}
              disabled={!c.asset || action.busy}
              onPress={() =>
                router.push({ pathname: "/share/[id]", params: { id } })
              }
            />
          )}
          <Text style={styles.heading}>Klinik teklifleri</Text>
          {proposals.data?.length === 0 && (
            <Empty
              title="Henüz teklif yok"
              detail={
                c.recipients.length
                  ? "Klinikler vakanızı inceleyecek. Yeni teklifleri görmek için ekranı aşağı çekin."
                  : "Teklif almak için vakanızı kliniklerle paylaşın."
              }
            />
          )}
          {(proposals.data?.length || 0) > 1 && (
            <Button
              title="Teklifleri karşılaştır"
              secondary
              onPress={() =>
                router.push({ pathname: "/compare/[id]", params: { id } })
              }
            />
          )}
          {proposals.data?.map((p) => (
            <Card key={p.id}>
              <Text style={styles.badge}>SÜRÜM {p.version}</Text>
              <Text style={styles.heading}>{p.clinic_name}</Text>
              <Text style={styles.title}>
                {money(p.total_minor, p.plan.currency)}
              </Text>
              <Text style={styles.muted}>
                {p.plan.sessions} seans ·{" "}
                {p.plan.requires_exam
                  ? "Muayene gerekli"
                  : "Muayene gerekliliği belirtilmedi"}
              </Text>
              <Button
                title={`${p.clinic_name} teklifini görüntüle`}
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/proposal/[id]",
                    params: { id: p.id },
                  })
                }
              />
            </Card>
          ))}
          <Notice text="Fiyatlar ön tahmindir. Klinikler farklı tedavi kapsamları önerebilir; fiziksel muayene planı değiştirebilir." />
        </>
      )}
    </Screen>
  );
}
