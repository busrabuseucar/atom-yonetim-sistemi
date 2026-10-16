import { test, expect } from "@playwright/test";

async function fixture(page, role = "officer") {
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "test@example.test",
    aud: "authenticated",
    role: "authenticated",
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".fixture";
  const session = {
    access_token: token,
    refresh_token: "fixture-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  let project = {
    id: "project-1",
    organization_id: "org-1",
    created_by: user.id,
    title: "Pilot",
    summary: "Önceki yöntem",
    benefit: "Toplumsal fayda",
    status: "revision",
    feedback: "Yöntemi netleştir",
    version: 2,
    created_at: new Date().toISOString(),
  };
  const writes = [];
  await page.route("https://test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body;
    if (url.pathname.startsWith("/auth/v1/token")) body = session;
    else if (url.pathname === "/auth/v1/user") body = user;
    else if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204 });
    else if (url.pathname === "/rest/v1/memberships")
      body = [
        {
          organization_id: "org-1",
          role,
          organizations: { name: "Ankara test" },
        },
      ];
    else if (url.pathname === "/rest/v1/projects" && req.method() === "GET")
      body = [project];
    else if (url.pathname === "/rest/v1/projects" && req.method() === "PATCH") {
      writes.push({ url: url.toString(), body: req.postDataJSON() });
      project = {
        ...project,
        ...req.postDataJSON(),
        version: project.version + 1,
      };
      body = [{ id: project.id }];
    } else
      throw new Error(
        "Unexpected request: " + req.method() + " " + url.pathname,
      );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  await page.getByLabel("E-posta", { exact: true }).fill(user.email);
  await page.getByLabel("Şifre", { exact: true }).fill("Example123456!");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Pilot", exact: true }),
  ).toBeVisible();
  return { writes, session };
}
test("owner resubmits revision with version and logout clears the workspace", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { writes, session } = await fixture(page);
  await page.getByRole("button", { name: "İncele", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revizyonu düzenle", exact: true })).toBeVisible();
  await page.locator('textarea[name="summary"]').fill("Düzeltilmiş yöntem");
  await page
    .getByRole("button", { name: "Revizyonu yeniden gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "yeniden değerlendirmeye",
  );
  await expect(
    page.getByRole("cell", { name: "Değerlendirmede", exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].url).toContain("version=eq.2");
  expect(writes[0].body).toEqual({
    title: "Pilot",
    summary: "Düzeltilmiş yöntem",
    benefit: "Toplumsal fayda",
    status: "submitted",
  });
  // Same-user session updates previously cleared memberships without reloading them.
  await page.evaluate(async (session) => {
    const { supabase } = await import("/src/supabase.ts");
    await supabase.auth.setSession(session);
  }, session);
  await expect(
    page.getByRole("cell", { name: "Pilot", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Çalışma alanı yetkisi bulunmuyor")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Giriş yap", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("viewer has no create, review or resubmit controls", async ({ page }) => {
  await fixture(page, "viewer");
  await expect(
    page.getByRole("button", { name: "Yeni proje", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "İncele", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Revizyonu yeniden gönder", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Değerlendirmeyi kaydet", exact: true }),
  ).toHaveCount(0);
});

test.afterEach(async ({page}, testInfo) => { if (testInfo.status !== testInfo.expectedStatus) console.log(await page.locator("body").innerText()); });
