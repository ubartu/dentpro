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
          name: role === "clinic" ? "Clinic portal" : "Admin portal",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: `Fill ${role} evaluation credentials` })
        .click();
      await page.getByRole("button", { name: "Sign in to workspace" }).click();
      await page
        .getByRole("heading", {
          name: role === "clinic" ? /Good to see you/ : /A clear view/,
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
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page
        .getByRole("heading", { name: "Sign in to your clinic" })
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
  await page.getByRole("heading", { name: "Sign in to your clinic" }).waitFor();
  await page
    .getByRole("button", { name: "Fill clinic evaluation credentials" })
    .click();
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.getByRole("heading", { name: /Good to see you/ }).waitFor();
  assert.equal(
    await page.getByRole("combobox", { name: "Demo workspace" }).count(),
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
  await nav("Case inbox");
  await page.getByPlaceholder("Search cases or references…").fill(title);
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await page.getByLabel("Your review status").selectOption("reviewing");
  await page
    .getByLabel(/Internal clinic notes/)
    .fill("Review in progress. Synthetic browser verification.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  await page.reload();
  await page.getByLabel(/Internal clinic notes/).waitFor();
  assert.match(
    await page.getByLabel(/Internal clinic notes/).inputValue(),
    /Review in progress/,
  );
  await page
    .getByRole("button", { name: "Create proposal", exact: true })
    .click();
  await page.getByLabel("Price (TRY)", { exact: true }).fill("6700");
  await page.getByLabel("Total planned visits", { exact: true }).fill("2");
  await page
    .getByLabel("Clinical notes & price inclusions")
    .fill("Synthetic proposal for evaluation. Examination required.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue draft", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Price (TRY)", { exact: true }).inputValue(),
    "6700",
  );
  await page
    .getByRole("button", { name: "Publish proposal", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Proposals & drafts");
  await page.getByPlaceholder("Search proposals…").fill(title);
  await page.getByRole("button", { name: "Revise", exact: true }).click();
  await page.getByLabel("Total planned visits", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Publish revision", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  let clinicAuth = JSON.parse(
    await page.evaluate(() => sessionStorage.getItem("dentpro-auth")),
  );
  let plans = await call(`/cases/${c.id}/proposals`, undefined, patient, "GET");
  assert.equal(plans.length, 1);
  assert.equal(plans[0].version, 2);
  await call("/appointments", { proposal_id: plans[0].id }, patient);
  await nav("Appointments");
  await page.getByPlaceholder("Search requests…").fill(title);
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByLabel("Request status", { exact: true })
    .selectOption("contacted");
  await page
    .getByLabel("Internal coordination notes")
    .fill("Contacted and coordinated a synthetic appointment.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByLabel("Request status", { exact: true })
    .selectOption("confirmed");
  await page.getByLabel(/Appointment date & time/).fill("2027-01-15T10:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Team members");
  await page.getByRole("button", { name: "Add team member" }).click();
  await page.getByLabel("Full name").fill("QA Coordinator");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`qa-${suffix}@example.org`);
  await page.getByLabel(/Initial password/).fill("Local-QA-password-123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByPlaceholder("Search accounts…").fill(`qa-${suffix}`);
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByLabel("Account is active").uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  for (const name of [
    "Clinic profile",
    "Subscription",
    "Activity & response",
  ]) {
    await nav(name);
    await page.locator("h1").waitFor();
    assert.equal(await page.locator(".alert.error").count(), 0);
  }
  await nav("Overview");
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
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Admin portal", exact: true }).click();
  await page
    .getByRole("button", { name: "Fill admin evaluation credentials" })
    .click();
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page
    .getByRole("heading", { name: "A clear view of your platform." })
    .waitFor();
  await page.screenshot({
    path: "tmp/panel-qa/admin-overview.png",
    fullPage: true,
    animations: "disabled",
  });
  await nav("Clinics");
  await page.getByRole("button", { name: "Add clinic", exact: true }).click();
  await page
    .getByLabel("Clinic name", { exact: true })
    .fill(`QA Dental ${suffix}`);
  await page.getByLabel("District", { exact: true }).fill("Kadıköy");
  await page
    .getByLabel("Address", { exact: true })
    .fill("Synthetic clinic address");
  await page
    .getByLabel("Contact email", { exact: true })
    .fill(`qa-clinic-${suffix}@example.org`);
  await page.getByRole("button", { name: "Create clinic for review" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByPlaceholder("Search clinics or regions…")
    .fill(`QA Dental ${suffix}`);
  await page.getByRole("button", { name: "Review clinic" }).click();
  await page
    .getByLabel("Account status", { exact: true })
    .selectOption("active");
  await page
    .getByLabel(/Verification \/ decision notes/)
    .fill("Synthetic evaluation approval");
  await page.getByRole("button", { name: "Save clinic decision" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Proposal oversight");
  await page.getByPlaceholder("Search clinic or case…").fill(title);
  await page
    .getByRole("button", { name: "Review", exact: true })
    .first()
    .click();
  await page.getByLabel("Review decision").selectOption("approved");
  await page
    .getByLabel("Review notes", { exact: true })
    .fill("Source and explanation reviewed for synthetic QA.");
  await page.getByRole("button", { name: "Save review" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Subscriptions");
  const billingRow = page
    .getByRole("row")
    .filter({ hasText: `QA Dental ${suffix}` });
  await billingRow.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByLabel("Subscription status").selectOption("active");
  await page.getByLabel("Monthly fee (TRY)").fill("1900");
  await page.getByLabel("Renewal date").fill("2027-01-01");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await nav("Procedure glossary");
  await page.getByRole("button", { name: "Edit & review" }).first().click();
  assert(
    (await page.getByLabel("Plain-language explanation").inputValue()).length >
      20,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await nav("Explanation jobs");
  await page
    .getByRole("heading", { name: "Explanations & jobs", exact: true })
    .waitFor();
  await nav("Settings");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  await nav("Audit trail");
  await page
    .getByPlaceholder("Search actor, action, or entity…")
    .fill("subscription.updated");
  assert(
    (await page
      .getByRole("cell", { name: "subscription.updated", exact: true })
      .count()) > 0,
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export filtered events" }).click();
  assert.match((await download).suggestedFilename(), /audit.csv/);
  for (const name of ["Platform cases", "Appointments", "Accounts & access"]) {
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
  await nav("Overview");
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
