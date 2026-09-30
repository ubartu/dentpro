import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "dentrivo-site",
    entrypoint: "vinext/server/fetch-handler",
    // Match the existing Worker settings in Cloudflare to avoid overwriting
    // dashboard-managed configuration during deployment.
    compatibilityDate: "2026-09-30",
    compatibilityFlags: ["nodejs_compat"],
    previewUrls: false,
    observability: {
      logs: { enabled: true },
    },
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
