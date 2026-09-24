import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import { API_URL } from "./api";
export async function openAsset(
  id: string,
  asset: { name: string; type: string },
  token: string,
) {
  const ext =
    asset.type === "application/pdf"
      ? "pdf"
      : asset.type === "image/png"
        ? "png"
        : "jpg";
  const file = new File(Paths.cache, `dentpro-${Crypto.randomUUID()}.${ext}`);
  try {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("File sharing is unavailable on this device.");
    await File.downloadFileAsync(`${API_URL}/cases/${id}/xray`, file, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await Sharing.shareAsync(file.uri, {
      mimeType: asset.type,
      dialogTitle: asset.name,
      UTI: ext === "pdf" ? "com.adobe.pdf" : "public.image",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
