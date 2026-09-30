/* Run against a local synthetic environment. Creates its own case and evaluation records. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.WEB_URL || "http://127.0.0.1:3000";
const api = process.env.API_URL || "http://127.0.0.1:8000";
const suffix = Date.now();
(async () => {
  fs.mkdirSync("tmp/panel-qa", { recursive: true });
  const executablePath =
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    (fs.existsSync(".data/e2e-browser.json")
      ? JSON.parse(fs.readFileSync(".data/e2e-browser.json")).executablePath
      : undefined);
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function call(path, body, token, method = "POST") {
    const r = await page.request.fetch(api + path, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      ...(body === undefined ? {} : { data: body }),
    });
    assert(r.ok(), `${path}: ${r.status()} ${await r.text()}`);
    return r.json();
  }
  if (process.argv.includes("--visual-only")) {
    for (const role of ["clinic", "admin"]) {
      await page.goto(base + "/login");
      await page
        .getByRole("button", {
          name: role === "clinic" ? "Klinik portalı" : "Yönetim portalı",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: `${role === "clinic" ? "Klinik" : "Yönetim"} demo bilgilerini doldur` })
        .click();
      await page.getByRole("button", { name: "Çalışma alanına giriş yap" }).click();
      await page
        .getByRole("heading", {
          name: role === "clinic" ? /Tekrar hoş geldiniz/ : /Platformunuza genel bakış/,
        })
        .waitFor();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: `tmp/panel-qa/${role}-overview.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `tmp/panel-qa/${role}-mobile.png`,
        fullPage: true,
        animations: "disabled",
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.getByRole("button", { name: "Gezinmeyi aç" }).click();
      await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
      await page
        .getByRole("heading", { name: "Kliniğinize giriş yapın" })
        .waitFor();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: rendered desktop/mobile panels, responsive navigation and no horizontal overflow.",
    );
    await browser.close();
    return;
  }
  const patient = (await call("/demo/session/patient")).token;
  const title = `Panel QA case ${suffix}`;
  const c = await call(
    "/cases",
    { title, region: "Istanbul", consent: true },
    patient,
  );
  const upload = await page.request.post(api + `/cases/${c.id}/xray`, {
    headers: { Authorization: `Bearer ${patient}` },
    multipart: {
      file: {
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  assert(upload.ok());
  await call(`/cases/${c.id}/dispatch`, { clinic_ids: ["clinic-1"] }, patient);
  await page.goto(base + "/clinic");
  await page.getByRole("heading", { name: "Kliniğinize giriş yapın" }).waitFor();
  await page
    .getByRole("button", { name: "Klinik demo bilgilerini doldur" })
    .click();
  await page.getByRole("button", { name: "Çalışma alanına giriş yap" }).click();
  await page.getByRole("heading", { name: /Tekrar hoş geldiniz/ }).waitFor();
  assert.equal(
    await page.getByRole("combobox", { name: "Demo çalışma alanı" }).count(),
    0,
  );
  await page.screenshot({
    path: "tmp/panel-qa/clinic-overview.png",
    fullPage: true,
    animations: "disabled",
  });
  const nav = async (name) => {
    const link = page.locator("nav").getByRole("link", { name, exact: true });
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForURL(base + href);
    await page
      .locator(`nav a[aria-current="page"][aria-label="${name}"]`)
      .waitFor();
    await page.locator("h1").waitFor();
  };
  const awaitingReview = page
    .locator(".stat")
    .filter({ hasText: "İnceleme bekliyor" });
  const newCount = Number(await awaitingReview.locator("strong").innerText());
  assert(newCount > 0);
  assert.match(await awaitingReview.getAttribute("class"), /stat-attention/);
  await awaitingReview.click();
  await page.waitForURL(base + "/clinic/cases?status=new");
  await page.getByLabel("Vaka durumu", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Vaka durumu", { exact: true }).inputValue(),
    "new",
  );
  assert.equal(await page.locator("tbody tr").count(), newCount);
  assert.equal(await page.locator("tbody .badge.new").count(), newCount);
  await page.getByRole("link", { name: title, exact: true }).waitFor();
  await page
    .getByRole("navigation", { name: "Vaka gelen kutusu filtreleri" })
    .getByRole("link", { name: /Yanıtsız/ })
    .click();
  await page.waitForURL(base + "/clinic/cases?status=unanswered");
  await page.goBack();
  await page.waitForURL(base + "/clinic/cases?status=new");
  await page.reload();
  await page.getByLabel("Vaka durumu", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Vaka durumu", { exact: true }).inputValue(),
    "new",
  );
  assert.equal(await page.locator("tbody tr").count(), newCount);
  await page.screenshot({
    path: "tmp/panel-qa/clinic-awaiting-review.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "tmp/panel-qa/clinic-inbox-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  async function checkCaseFilter(status, present, badge) {
    await page.goto(base + `/clinic/cases?status=${status}`);
    await page.getByLabel("Vaka durumu", { exact: true }).waitFor();
    await page.getByPlaceholder("Vaka veya referans ara…").fill(title);
    if (present) {
      await page.getByRole("link", { name: title, exact: true }).waitFor();
      assert.equal(
        await page.locator("tbody tr.case-needs-response").count(),
        1,
      );
      assert.equal(
        (await page.locator("tbody .badge").innerText()).toLocaleLowerCase("tr-TR"),
        badge,
      );
    } else {
      await page.getByRole("heading", { name: "Eşleşen vaka yok" }).waitFor();
      assert.equal(await page.locator("tbody tr").count(), 0);
    }
  }
  await nav("Vaka gelen kutusu");
  await page.getByPlaceholder("Vaka veya referans ara…").fill(title);
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await page.getByLabel("İnceleme durumunuz").selectOption("reviewing");
  await page
    .getByLabel(/Klinik içi notlar/)
    .fill("Review in progress. Synthetic browser verification.");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" }).waitFor();
  await page.reload();
  await page.getByLabel(/Klinik içi notlar/).waitFor();
  assert.match(
    await page.getByLabel(/Klinik içi notlar/).inputValue(),
    /Review in progress/,
  );
  await checkCaseFilter("new", false);
  await checkCaseFilter("unanswered", true, "inceleniyor");
  await page.getByRole("link", { name: title, exact: true }).click();
  await page
    .getByRole("button", { name: "Teklif oluştur", exact: true })
    .click();
  await page.getByLabel("Fiyat (TRY)", { exact: true }).fill("6700");
  await page.getByLabel("Planlanan toplam seans", { exact: true }).fill("2");
  await page
    .getByLabel("Klinik notlar ve fiyata dahil olanlar")
    .fill("Synthetic proposal for evaluation. Examination required.");
  await page.locator('.tooth-canvas[data-render-state="ready"]').waitFor();
  // The upper-left first molar in the default adult camera view.
  const toothCanvas = page.locator(".tooth-canvas canvas");
  const canvasBounds = await toothCanvas.boundingBox();
  await toothCanvas.click({
    position: { x: canvasBounds.width * 0.66, y: canvasBounds.height * 0.29 },
  });
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").inputValue(),
    "26",
  );
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width / 2,
    canvasBounds.y + canvasBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBounds.x + canvasBounds.width * 0.65,
    canvasBounds.y + canvasBounds.height * 0.4,
    { steps: 8 },
  );
  await page.mouse.up();
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").inputValue(),
    "26",
    "Rotating must not reassign a tooth",
  );
  await page.getByRole("button", { name: "Görünümü sıfırla", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: /^Diş \d+:/ }).count(),
    32,
  );
  await page
    .getByRole("button", { name: "Çocuk · 20 diş", exact: true })
    .click();
  await page
    .getByText("Bu diş yetişkin görünümüne ait.", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /^Diş \d+:/ }).count(),
    20,
  );
  await page.getByRole("button", { name: /^Diş 55:/ }).click();
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").inputValue(),
    "55",
  );
  await page
    .getByRole("button", { name: "İşlem ekle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "2. işlem için dişi 3B görünümde seç" })
    .click();
  assert.equal(
    await page.getByLabel("Diş seçimi için işlem belirleyin").inputValue(),
    "1",
  );
  await page.getByRole("button", { name: /^Diş 36:/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Fiyat (TRY)", { exact: true }).nth(1).fill("2100");
  await page
    .getByRole("button", { name: "Tüm ağız · HEPSİ", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").nth(1).inputValue(),
    "ALL",
  );
  await page.getByRole("button", { name: /^Diş 36:/ }).click();
  await page
    .getByRole("button", { name: "İşlem ekle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "İşlem 3 sil", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Diş seçimi için işlem belirleyin").inputValue(),
    "1",
  );
  await page
    .getByLabel("Diş seçimi için işlem belirleyin")
    .selectOption("0");
  await page
    .getByRole("button", {
      name: "Çocuk · 20 diş",
      exact: true,
      pressed: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Çocuk · 20 diş", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").nth(0).inputValue(),
    "55",
  );
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").nth(1).inputValue(),
    "36",
  );
  await page
    .getByLabel("Teklif para birimi", { exact: true })
    .selectOption("USD");
  assert.equal(
    await page.getByLabel("Fiyat (USD)", { exact: true }).first().inputValue(),
    "6700",
  );
  await page
    .getByLabel("İşlem", { exact: true })
    .first()
    .selectOption("ROOT_CANAL_DOUBLE");
  await page
    .getByLabel("Tedavi aciliyeti", { exact: true })
    .nth(0)
    .selectOption("soon");
  await page
    .getByLabel("Tedavi aciliyeti", { exact: true })
    .nth(1)
    .selectOption("urgent");
  await page
    .getByRole("button", { name: "Aciliyete göre sırala", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").nth(0).inputValue(),
    "36",
  );
  assert.equal(
    await page
      .getByLabel("Tedavi aciliyeti", { exact: true })
      .nth(0)
      .inputValue(),
    "urgent",
  );
  await page.getByRole("button", { name: "Taslağı kaydet", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Taslak kaydedildi" }).waitFor();
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  await checkCaseFilter("unanswered", true, "taslak");
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.waitForURL(base + `/clinic/cases/${c.id}`);
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Taslağa devam et", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Fiyat (USD)", { exact: true }).first().inputValue(),
    "2100",
  );
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").nth(0).inputValue(),
    "36",
  );
  assert.equal(
    await page.getByLabel("Diş · FDI numaralandırması").nth(1).inputValue(),
    "55",
  );
  await page
    .getByRole("button", { name: "Teklifi yayımla", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await checkCaseFilter("unanswered", false);
  await nav("Teklifler ve taslaklar");
  await page.getByPlaceholder("Tekliflerde ara…").fill(title);
  await page.getByRole("button", { name: "Görüntüle", exact: true }).click();
  const treatmentView = page.getByRole("region", {
    name: "Tedavi önerilen dişler",
  });
  await treatmentView
    .locator('.tooth-canvas[data-render-state="ready"]')
    .waitFor();
  assert.equal(
    await treatmentView
      .getByRole("button", { name: /^Diş 36:/ })
      .getAttribute("class"),
    "assigned",
  );
  await treatmentView
    .getByRole("button", { name: "Çocuk · 20 diş", exact: true })
    .click();
  assert.equal(
    await treatmentView
      .getByRole("button", { name: /^Diş 55:/ })
      .getAttribute("class"),
    "assigned",
  );
  await treatmentView.getByRole("button", { name: /^Diş 54:/ }).click();
  await treatmentView
    .getByText("Bu teklife dahil değil", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "tmp/panel-qa/active-proposal-teeth.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  assert.equal(
    await page.getByLabel("Teklif para birimi", { exact: true }).inputValue(),
    "USD",
  );
  assert.equal(
    await page
      .getByLabel("Tedavi aciliyeti", { exact: true })
      .nth(0)
      .inputValue(),
    "urgent",
  );
  await page.getByLabel("Planlanan toplam seans", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Yeni sürümü yayımla", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  let clinicAuth = JSON.parse(
    await page.evaluate(() => sessionStorage.getItem("dentpro-auth")),
  );
  let plans = await call(`/cases/${c.id}/proposals`, undefined, patient, "GET");
  assert.equal(plans.length, 1);
  assert.equal(plans[0].version, 2);
  assert.deepEqual(
    plans[0].plan.items.map((item) => item.tooth),
    ["36", "55"],
  );
  assert.equal(plans[0].plan.currency, "USD");
  assert.deepEqual(
    plans[0].plan.items.map((item) => item.urgency),
    ["urgent", "soon"],
  );
  assert.equal(plans[0].plan.items[1].procedure_code, "ROOT_CANAL_DOUBLE");
  await call("/appointments", { proposal_id: plans[0].id }, patient);
  await nav("Randevular");
  await page.getByPlaceholder("Taleplerde ara…").fill(title);
  await page.getByRole("button", { name: "Yönet", exact: true }).click();
  await page
    .getByLabel("Talep durumu", { exact: true })
    .selectOption("contacted");
  await page
    .getByLabel("İç koordinasyon notları")
    .fill("Contacted and coordinated a synthetic appointment.");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Yönet", exact: true }).click();
  await page
    .getByLabel("Talep durumu", { exact: true })
    .selectOption("confirmed");
  await page.getByLabel(/Randevu tarihi ve saati/).fill("2027-01-15T10:00");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Ekip üyeleri");
  await page.getByRole("button", { name: "Ekip üyesi ekle" }).click();
  await page.getByLabel("Ad soyad").fill("QA Coordinator");
  await page
    .getByLabel("E-posta", { exact: true })
    .fill(`qa-${suffix}@example.org`);
  await page.getByLabel(/İlk şifre/).fill("Local-QA-password-123!");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByPlaceholder("Hesaplarda ara…").fill(`qa-${suffix}`);
  await page.getByRole("button", { name: "Yönet", exact: true }).click();
  await page.getByLabel("Hesap aktif").uncheck();
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  for (const name of [
    "Klinik profili",
    "Abonelik",
    "Etkinlik ve yanıtlar",
  ]) {
    await nav(name);
    await page.locator("h1").waitFor();
    assert.equal(await page.locator(".alert.error").count(), 0);
  }
  const fallbackContext = await browser.newContext();
  const fallbackAuth = await page.evaluate(() =>
    sessionStorage.getItem("dentpro-auth"),
  );
  await fallbackContext.addInitScript((auth) => {
    sessionStorage.setItem("dentpro-auth", auth);
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return getContext.call(this, type, ...args);
    };
  }, fallbackAuth);
  const fallbackPage = await fallbackContext.newPage();
  fallbackPage.on("pageerror", (e) => errors.push(e.message));
  await fallbackPage.goto(base + `/clinic/cases/${c.id}`);
  await fallbackPage
    .getByRole("button", { name: "Teklifi düzenle", exact: true })
    .click();
  await fallbackPage
    .getByText("3B görünüm kullanılamıyor. Aşağıdan numaralı bir diş seçin.", {
      exact: true,
    })
    .waitFor();
  await fallbackPage
    .getByRole("button", { name: "Çocuk · 20 diş", exact: true })
    .click();
  await fallbackPage.getByRole("button", { name: /^Diş 75:/ }).click();
  assert.equal(
    await fallbackPage.getByLabel("Diş · FDI numaralandırması").first().inputValue(),
    "75",
  );
  await fallbackContext.close(); // Unsaved fallback interaction must not change the published plan.
  await nav("Genel bakış");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "tmp/panel-qa/clinic-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await page.getByRole("button", { name: "Yönetim portalı", exact: true }).click();
  await page
    .getByRole("button", { name: "Yönetim demo bilgilerini doldur" })
    .click();
  await page.getByRole("button", { name: "Çalışma alanına giriş yap" }).click();
  await page
    .getByRole("heading", { name: "Platformunuza genel bakış." })
    .waitFor();
  await page.screenshot({
    path: "tmp/panel-qa/admin-overview.png",
    fullPage: true,
    animations: "disabled",
  });
  await nav("Klinikler");
  await page.getByRole("button", { name: "Klinik ekle", exact: true }).click();
  await page
    .getByLabel("Klinik adı", { exact: true })
    .fill(`QA Dental ${suffix}`);
  await page.getByLabel("İlçe", { exact: true }).fill("Kadıköy");
  await page
    .getByLabel("Adres", { exact: true })
    .fill("Synthetic clinic address");
  await page
    .getByLabel("İletişim e-postası", { exact: true })
    .fill(`qa-clinic-${suffix}@example.org`);
  await page.getByRole("button", { name: "İncelenmek üzere klinik oluştur" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByPlaceholder("Klinik veya bölge ara…")
    .fill(`QA Dental ${suffix}`);
  await page.getByRole("button", { name: "Kliniği incele" }).click();
  await page
    .getByLabel("Hesap durumu", { exact: true })
    .selectOption("active");
  await page
    .getByLabel(/Doğrulama \/ karar notları/)
    .fill("Synthetic evaluation approval");
  await page.getByRole("button", { name: "Klinik kararını kaydet" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Kliniği incele" }).click();
  await page
    .getByText("Google Haritalar ve sosyal medya profilleri", { exact: true })
    .click();
  await page
    .getByLabel("Google Place ID", { exact: true })
    .fill(`ChIJSyntheticQA${suffix}`);
  await page
    .getByLabel("Instagram profili", { exact: true })
    .fill("https://www.instagram.com/dentpro_synthetic_qa/");
  await page.getByRole("button", { name: "Keşif profilini kaydet" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Teklif denetimi");
  await page.getByPlaceholder("Klinik veya vaka ara…").fill(title);
  await page
    .getByRole("button", { name: "İncele", exact: true })
    .first()
    .click();
  await page.getByLabel("İnceleme kararı").selectOption("approved");
  await page
    .getByLabel("İnceleme notları", { exact: true })
    .fill("Source and explanation reviewed for synthetic QA.");
  await page.getByRole("button", { name: "İncelemeyi kaydet" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Abonelikler");
  const billingRow = page
    .getByRole("row")
    .filter({ hasText: `QA Dental ${suffix}` });
  await billingRow.getByRole("button", { name: "Yönet", exact: true }).click();
  await page.getByLabel("Abonelik durumu").selectOption("active");
  await page.getByLabel("Aylık ücret (TRY)").fill("1900");
  await page.getByLabel("Yenileme tarihi").fill("2027-01-01");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("İşlem sözlüğü");
  await page.getByRole("button", { name: "Düzenle ve incele" }).first().click();
  assert(
    (await page.getByLabel("Sade dilli açıklama").inputValue()).length >
      20,
  );
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  await nav("Açıklama işleri");
  await page
    .getByRole("heading", { name: "Açıklamalar ve işler", exact: true })
    .waitFor();
  await nav("Ayarlar");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Değişiklikler kaydedildi" }).waitFor();
  await nav("Denetim kaydı");
  await page
    .getByPlaceholder("Kullanıcı, işlem veya varlık ara…")
    .fill("subscription.updated");
  assert(
    (await page
      .getByRole("cell", { name: "Abonelik güncellendi", exact: true })
      .count()) > 0,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Filtrelenmiş olayları dışa aktar" }).click();
  assert.match((await download).suggestedFilename(), /audit.csv/);
  for (const name of ["Platform vakaları", "Randevular", "Hesaplar ve erişim"]) {
    await nav(name);
    await page.locator("h1").waitFor();
    assert.equal(await page.locator(".alert.error").count(), 0);
  }
  const adminAuth = JSON.parse(
    await page.evaluate(() => sessionStorage.getItem("dentpro-auth")),
  );
  const adminData = await call(
    "/admin/workspace",
    undefined,
    adminAuth.token,
    "GET",
  );
  const testClinic = adminData.clinics.find(
    (x) => x.name === `QA Dental ${suffix}`,
  );
  assert.equal(testClinic.status, "active");
  assert.equal(testClinic.monthly_fee_minor, 190000);
  assert.equal(testClinic.google_place_id, `ChIJSyntheticQA${suffix}`);
  assert.deepEqual(testClinic.social_links, [
    {
      platform: "instagram",
      url: "https://www.instagram.com/dentpro_synthetic_qa/",
    },
  ]);
  assert.equal(
    adminData.accounts.find((a) => a.email === `qa-${suffix}@example.org`)
      .active,
    false,
  );
  assert.equal(
    adminData.appointments.find((a) => a.proposal_id === plans[0].id).status,
    "confirmed",
  );
  const denied = await page.request.get(api + "/admin/workspace", {
    headers: { Authorization: `Bearer ${clinicAuth.token}` },
  });
  assert.equal(denied.status(), 401); // logout revoked the clinic session
  await nav("Genel bakış");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "tmp/panel-qa/admin-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: distinct portals; persistent case notes; draft reload; publish/revise; appointments; team access; clinic approval; proposal moderation; subscription changes; audit CSV; every navigation page; desktop/mobile overflow; no browser errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
