import { Platform } from "react-native";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000")
).replace(/\/$/, "");
if (!__DEV__ && !API_URL.startsWith("https://"))
  throw new Error("Release builds require an HTTPS EXPO_PUBLIC_API_URL.");
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
function detail(body: { detail?: unknown }) {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail))
    return body.detail
      .map((v) => `${v.loc?.slice(1).join(" ")}: ${v.msg}`)
      .join("\n");
  return "The request could not be completed. Please refresh and try again.";
}
export async function request<T>(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API_URL + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, detail(json));
    return json as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      "Cannot reach DENTRIVO. Check your connection and try again. Your request may have reached the server; refresh before submitting again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export function upload(
  path: string,
  token: string,
  file: { uri: string; name: string; mimeType?: string },
  progress: (value: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL + path);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 90000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = xhr.ontimeout = () =>
      reject(
        new ApiError(
          0,
          "Upload interrupted. Refresh the case to check whether it arrived, then retry if needed.",
        ),
      );
    xhr.onload = () => {
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new ApiError(xhr.status, detail(body)));
    };
    const data = new FormData();
    data.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as unknown as Blob);
    xhr.send(data);
  });
}
