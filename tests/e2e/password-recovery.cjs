/* Run with the isolated local file-mail QA environment documented in mail-recovery.md. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.WEB_URL || "http://127.0.0.1:3000";
const api = process.env.API_URL || "http://127.0.0.1:8000";
const mailbox = process.env.QA_MAILBOX_DIR || "tmp/recovery-mailbox";
(async () => {
  const executablePath =
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    JSON.parse(fs.readFileSync(".data/e2e-browser.json")).executablePath;
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const email = `web-recovery-${Date.now()}@example.org`;
    const created = await page.request.post(api + "/patient/register", {
      data: {
        name: "Synthetic web recovery QA",
        email,
        phone: "5551234567",
        password: "InitialWebQA123!",
      },
    });
    assert.equal(created.status(), 201);
    const session = (await created.json()).token;
    await page.goto(base + "/login");
    await page.getByRole("link", { name: "Şifrenizi mi unuttunuz?" }).click();
    await page.getByLabel("Hesap e-postası", { exact: true }).fill(email);
    await page
      .getByRole("button", { name: "Yenileme e-postası gönder", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Uygun bir hesap varsa" })
      .waitFor();
    let token;
    // Read only this synthetic account's private local message, never an external inbox.
    const deadline = Date.now() + 15000;
    while (!token && Date.now() < deadline) {
      if (fs.existsSync(mailbox))
        for (const file of fs.readdirSync(mailbox)) {
          const raw = fs.readFileSync(path.join(mailbox, file), "utf8");
          if (!raw.includes(email)) continue;
          const decoded = raw
            .replace(/=\r?\n/g, "")
            .replace(/=([A-F0-9]{2})/g, (_, h) =>
              String.fromCharCode(parseInt(h, 16)),
            );
          token = decoded.match(/#token=([A-Za-z0-9_-]{43})/)?.[1];
          if (token) break;
        }
      if (!token) await new Promise((r) => setTimeout(r, 200));
    }
    assert(token, "Worker must create the synthetic reset email");
    await page.goto(base + "/reset-password#token=" + token);
    await page.getByLabel("Yenileme kodu", { exact: true }).waitFor();
    await page.waitForFunction(() => !location.hash);
    assert.equal(
      await page.getByLabel("Yenileme kodu", { exact: true }).inputValue(),
      token,
    );
    await page
      .getByLabel("Yeni şifre (en az 10 karakter)", { exact: true })
      .fill("NewWebRecoveryQA123!");
    await page
      .getByLabel("Yeni şifreyi doğrulayın", { exact: true })
      .fill("MismatchQA123!");
    await page
      .getByRole("button", { name: "Şifreyi güncelle", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Şifreler eşleşmiyor." })
      .waitFor();
    await page
      .getByLabel("Yeni şifreyi doğrulayın", { exact: true })
      .fill("NewWebRecoveryQA123!");
    await page
      .getByRole("button", { name: "Şifreyi güncelle", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Şifreniz güncellendi" })
      .waitFor();
    assert.equal(
      (
        await page.request.get(api + "/patient/me", {
          headers: { Authorization: "Bearer " + session },
        })
      ).status(),
      401,
    );
    assert.equal(
      (
        await page.request.post(api + "/patient/login", {
          data: { email, password: "NewWebRecoveryQA123!" },
        })
      ).status(),
      200,
    );
    fs.mkdirSync("tmp/recovery-qa", { recursive: true });
    await page.screenshot({
      path: "tmp/recovery-qa/reset-success-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "tmp/recovery-qa/reset-success-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: forgot link, local email worker, fragment removal, password confirmation, reset, old session revocation, new sign-in and responsive UI. No external email sent.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
