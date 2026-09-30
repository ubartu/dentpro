import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(content: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><title>Clinic map</title><style>html,body{margin:0;width:100%;height:100%;background:#fff;font:15px system-ui;color:#203454}iframe{border:0;width:100%;height:100%;min-width:200px;min-height:200px}.message{padding:24px;line-height:1.5}</style></head><body>${content}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
      },
    },
  );
}

export async function GET(request: Request) {
  const placeId = new URL(request.url).searchParams.get("place_id") || "";
  if (!/^[A-Za-z0-9_-]{10,255}$/.test(placeId))
    return page(
      '<p class="message">No valid Google place is linked to this clinic.</p>',
      400,
    );
  let key: string | undefined;
  try {
    key = process.env.GOOGLE_MAPS_EMBED_KEY_FILE
      ? (await readFile(process.env.GOOGLE_MAPS_EMBED_KEY_FILE, "utf8")).trim()
      : process.env.GOOGLE_MAPS_EMBED_KEY?.trim();
  } catch {
    return page(
      '<p class="message">The clinic map is temporarily unavailable.</p>',
      503,
    );
  }
  if (!key)
    return page(
      '<p class="message">Google Maps Embed is not configured yet. Use the full Google profile link in the app.</p>',
      503,
    );
  // The restricted browser key is intentionally visible in the iframe URL.
  // No patient data, credentials or Places server key enter this public page.
  const src =
    "https://www.google.com/maps/embed/v1/place?" +
    new URLSearchParams({ key, q: `place_id:${placeId}`, language: "en" });
  const escaped = src
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
  return page(
    `<iframe title="Clinic location on Google Maps" src="${escaped}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
  );
}
