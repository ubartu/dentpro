import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { API_URL } from "../lib/api";
import { Button, Loading, Notice } from "./ui";
export function CaseImage({
  caseId,
  token,
  revision,
}: {
  caseId: string;
  token: string;
  revision: string;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const file = new File(
      Paths.cache,
      `dentpro-preview-${Crypto.randomUUID()}.png`,
    );
    void File.downloadFileAsync(`${API_URL}/cases/${caseId}/xray`, file, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(
      () => {
        if (active) {
          setUri(file.uri);
          setError(false);
        } else if (file.exists) file.delete();
      },
      () => {
        if (active) setError(true);
        if (file.exists) file.delete();
      },
    );
    return () => {
      active = false;
      if (file.exists) file.delete();
    };
  }, [caseId, token, revision, attempt]);
  if (error)
    return (
      <>
        <Notice
          text="Görüntü önizlemesi yüklenemedi. Yeniden deneyebilir veya özgün dosyayı açabilirsiniz."
          error
        />
        <Button
          title="Önizlemeyi yeniden dene"
          secondary
          onPress={() => {
            setError(false);
            setUri(null);
            setAttempt(attempt + 1);
          }}
        />
      </>
    );
  if (!uri) return <Loading />;
  return (
    <Image
      accessibilityLabel="Yüklenen röntgen"
      source={{ uri }}
      onError={() => setError(true)}
      style={{ width: "100%", height: 220, borderRadius: 12 }}
      contentFit="contain"
      cachePolicy="none"
    />
  );
}
