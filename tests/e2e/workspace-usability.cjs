/* Deterministic browser regressions. API routes are mocked; no database records are changed. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.WEB_URL || "http://127.0.0.1:3000";
const archivedCase = {
  id: "qa-archived",
  reference: "QA-ARCHIVED",
  title: "Arşivlenmiş İstanbul incelemesi",
  region: "Istanbul",
  status: "archived",
  created_at: "2026-09-01T12:00:00Z",
  recipients: ["qa-clinic"],
  asset: null,
  review_status: "reviewing",
  internal_notes: "Korunan klinik içi not.",
  proposal_count: 0,
  active_proposals: 0,
  draft: null,
  consent_recorded: true,
};
const workspace = {
  clinic: {
    id: "qa-clinic",
    name: "Test Kliniği",
    status: "active",
    subscription: "active",
  },
  clinics: [],
  cases: [archivedCase],
  proposals: [],
  appointments: [],
  members: [],
};
const responseHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

(async () => {
  const executablePath =
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    (fs.existsSync(".data/e2e-browser.json")
      ? JSON.parse(fs.readFileSync(".data/e2e-browser.json")).executablePath
      : undefined);
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    for (const role of ["clinic", "admin"]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const session = {
        token: "synthetic-workspace-token",
        user: {
          id: "qa-user",
          name: "Deneme Kullanıcı",
          email: "qa@example.test",
          role,
          active: true,
          clinic_id: role === "clinic" ? "qa-clinic" : null,
        },
      };
      await page.addInitScript((auth) => {
        sessionStorage.setItem("dentpro-auth", JSON.stringify(auth));
      }, session);
      let authStatus = 503;
      await page.route("**/auth/me", async (route) => {
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: responseHeaders });
          return;
        }
        await route.fulfill({
          status: authStatus,
          headers: responseHeaders,
          json:
            authStatus === 200
              ? session.user
              : { detail: "Synthetic service outage" },
        });
      });
      await page.route(`**/${role}/workspace`, async (route) => {
        await route.fulfill({
          status: route.request().method() === "OPTIONS" ? 204 : 200,
          headers: responseHeaders,
          ...(route.request().method() === "OPTIONS"
            ? {}
            : { json: workspace }),
        });
      });
      await page.goto(`${base}/${role}/cases`);
      await page
        .getByText(/Sunucuya bağlanılamadı. Oturumunuz korunuyor/)
        .waitFor();
      assert.equal(new URL(page.url()).pathname, `/${role}/cases`);
      assert.equal(
        await page.evaluate(
          () => JSON.parse(sessionStorage.getItem("dentpro-auth")).token,
        ),
        session.token,
      );
      authStatus = 200;
      await page
        .getByRole("button", { name: "Tekrar dene", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: role === "clinic" ? "Vaka gelen kutusu" : "Platform vakaları",
          exact: true,
        })
        .waitFor();
      const search = page.locator(".search input");
      for (const query of ["  ARSIVLENMIS ISTANBUL  ", "İSTANBUL"]) {
        await search.fill(query);
        await page.getByText(archivedCase.title, { exact: true }).waitFor();
      }
      await search.fill("eşleşmeyen örnek");
      assert.equal(
        await page.getByText(archivedCase.title, { exact: true }).count(),
        0,
      );
      await search.fill("");
      assert.equal(
        await page.getByRole("navigation", { name: "Ana gezinme" }).isVisible(),
        true,
      );

      await page.setViewportSize({ width: 390, height: 844 });
      const menu = page.getByRole("button", {
        name: "Gezinmeyi aç",
        exact: true,
      });
      await menu.waitFor();
      assert.equal(await page.locator(".sidebar").isVisible(), false);
      await menu.focus();
      for (let tab = 0; tab < 15; tab++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () => !!document.activeElement?.closest(".sidebar"),
          ),
          false,
        );
      }
      await menu.click();
      const drawer = page.getByRole("dialog", {
        name: "Çalışma alanı gezinmesi",
      });
      await drawer.waitFor();
      const close = drawer.getByRole("button", {
        name: "Gezinmeyi kapat",
        exact: true,
      });
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Gezinmeyi kapat",
      );
      assert.equal(await menu.getAttribute("aria-expanded"), "true");
      assert.equal(
        await page.locator("main").evaluate((node) => node.inert),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.body.style.overflow),
        "hidden",
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Çıkış yap",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await close.evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
      assert.equal(
        await menu.evaluate((node) => node === document.activeElement),
        true,
      );
      assert.equal(
        await page.locator("main").evaluate((node) => node.inert),
        false,
      );
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");

      // Navigating to the current section must still dismiss the drawer.
      await menu.click();
      await drawer
        .getByRole("link", {
          name: role === "clinic" ? "Vaka gelen kutusu" : "Platform vakaları",
          exact: true,
        })
        .click();
      await drawer.waitFor({ state: "hidden" });
      // Enlarging an open drawer must restore the ordinary desktop sidebar.
      await menu.click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForFunction(() => !document.querySelector("main").inert);
      assert.equal(
        await page.getByRole("navigation", { name: "Ana gezinme" }).isVisible(),
        true,
      );

      if (role === "clinic") {
        await page.goto(`${base}/clinic/cases/${archivedCase.id}`);
        await page
          .getByRole("heading", { name: archivedCase.title, exact: true })
          .waitFor();
        const review = page.locator("section").filter({
          has: page.getByRole("heading", {
            name: "Vaka incelemesi",
            exact: true,
          }),
        });
        assert.equal(
          await review.getByLabel("İnceleme durumunuz").inputValue(),
          "İnceleniyor",
        );
        assert.equal(
          await review.getByLabel("Klinik içi notlar").inputValue(),
          archivedCase.internal_notes,
        );
        assert.equal(
          await review.getByLabel("Klinik içi notlar").isEditable(),
          false,
        );
        assert.equal(
          await review
            .getByRole("button", { name: "Değişiklikleri kaydet" })
            .count(),
          0,
        );
      }
      // Expired credentials still trigger the normal login redirect.
      authStatus = 401;
      await page.goto(`${base}/${role}/cases`);
      await page.waitForURL("**/login");
      assert.equal(
        await page.evaluate(() => sessionStorage.getItem("dentpro-auth")),
        null,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(
      "PASS: clinic/admin session recovery, Turkish search, responsive drawer keyboard access, archived case read-only review, and expired session logout.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
