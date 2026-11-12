import { expect, test } from "@playwright/test";
import { errors, expectPixelFonts, openOffline, skipWelcome } from "./helpers";
import { mkdirSync } from "node:fs";

mkdirSync("test-results/shots", { recursive: true });

test.beforeEach(async ({ page }) => { await skipWelcome(page); });

test("editor loads the Haunted House template", async ({ page }) => {
  const errs = errors(page);
  await page.goto("/");
  await expect(page.locator(".card-item")).toHaveCount(5);
  await expect(page.locator(".sy-stage.edit .ed-obj").first()).toBeVisible();
  await page.screenshot({ path: "test-results/shots/editor.png" });
  expect(errs).toEqual([]);
});

test("add a button, rename it, undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add button" }).click();
  const label = page.getByLabel("label");
  await label.fill("Open the door");
  await label.blur();
  await expect(page.locator(".sy-stage.edit .sy-btn", { hasText: "Open the door" })).toBeVisible();
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(page.locator(".sy-stage.edit .sy-btn", { hasText: "Open the door" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await page.getByRole("button", { name: "Redo (Ctrl+Shift+Z)" }).click();
  await expect(page.locator(".sy-stage.edit .sy-btn", { hasText: "Button" })).toBeVisible();
});

test("drag an object moves it and undo restores it", async ({ page }) => {
  await page.goto("/");
  const obj = page.locator(".sy-stage.edit .sy-btn").first();
  const before = await obj.boundingBox();
  if (!before) throw new Error("no box");
  await page.mouse.move(before.x + 20, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(before.x + 80, before.y - 40, { steps: 6 });
  await page.mouse.up();
  const after = await page.locator(".sy-stage.edit .sy-btn").first().boundingBox();
  expect(after && after.x).toBeGreaterThan(before.x + 30);
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  const undone = await page.locator(".sy-stage.edit .sy-btn").first().boundingBox();
  expect(undone && Math.round(undone.x)).toBe(Math.round(before.x));
});

test("map shows nodes and play mode wins the escape room", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator("svg .node")).toHaveCount(5);
  await page.screenshot({ path: "test-results/shots/map.png" });
  await page.getByRole("button", { name: "▶ Play" }).click();
  const click = (name: string): Promise<void> => page.locator(".play-host .sy-btn", { hasText: name }).click();
  await click("Step inside"); await click("Cellar door");
  await expect(page.locator(".play-host").getByText("The cellar door is locked.")).toBeVisible();
  await click("Light lamp"); await click("Study"); await click("Open drawer");
  await expect(page.locator(".play-host").getByText("You found a rusty key!")).toBeVisible();
  await page.screenshot({ path: "test-results/shots/play.png" });
  await click("Back to hall"); await click("Cellar door"); await click("Raise the lamp");
  await expect(page.locator(".play-host").getByText("You escaped!")).toBeVisible();
});

test("export works offline over file:// and re-imports", async ({ page, browser }, info) => {
  await page.goto("/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = info.outputPath("haunted.html");
  await download.saveAs(file);

  // Airplane mode: fully offline, any request or console error fails the test.
  const { ctx: offline, page: p, errs, requests } = await openOffline(browser, file, { viewport: { width: 390, height: 780 } });
  const click = (name: string): Promise<void> => p.locator(".sy-btn", { hasText: name }).click();
  await expectPixelFonts(p);
  await expect(p.locator(".sy-stage.sy-haunted")).toBeVisible();
  await click("Step inside"); await click("Light lamp"); await click("Study"); await click("Open drawer");
  await click("Back to hall"); await click("Cellar door"); await click("Raise the lamp");
  await expect(p.getByText("You escaped!")).toBeVisible();
  await p.screenshot({ path: "test-results/shots/phone.png" });
  expect(requests).toEqual([]);
  expect(errs).toEqual([]);
  await offline.close();

  // CSP really blocks injected script.
  const csp = await browser.newContext();
  const q = await csp.newPage();
  await q.goto(`file://${file}`);
  const ran = await q.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__pwned = 1";
    document.body.append(s);
    return (window as unknown as { __pwned?: number }).__pwned === 1;
  });
  expect(ran).toBe(false);
  await csp.close();

  // Re-import the exported file.
  await page.getByRole("button", { name: "Import an exported .html" }).click().catch(() => undefined);
  await page.locator('input[type=file][accept*=".html"]').setInputFiles(file);
  await expect(page.locator(".status")).toContainText("Imported");
});

test("autosave restores after reload", async ({ page }) => {
  await page.goto("/");
  const title = page.getByLabel("Stack title");
  await title.fill("My Spooky Stack");
  await title.blur();
  await expect(page.locator(".status")).toContainText("Saved in this browser");
  await page.reload();
  await expect(page.getByLabel("Stack title")).toHaveValue("My Spooky Stack");
});

test("pixel fonts load in the editor without being installed", async ({ page }) => {
  await page.goto("/");
  await expectPixelFonts(page);
});

test("first run shows a quick start; blank stack gets an empty-state hint", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/");
  const dlg = page.getByRole("dialog", { name: /first card in 30 seconds/i });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Start with a blank stack" }).click();
  await expect(page.locator(".card-item")).toHaveCount(1);
  await expect(page.getByText("This card is empty")).toBeVisible();
  await page.screenshot({ path: "test-results/shots/welcome-blank.png" });
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0); // not shown again
  await ctx.close();
});

test("About shows the MIT license and the inspired-by wording", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /About Stackyard/ }).click();
  const dlg = page.getByRole("dialog", { name: "About Stackyard" });
  await expect(dlg).toContainText("MIT License");
  await expect(dlg).toContainText("SIL Open Font License");
  await expect(dlg).not.toContainText(/hypercard|hypertalk|apple/i);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("haunted skin can be switched in the inspector", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("look").selectOption("plain");
  await expect(page.locator(".sy-stage.edit.sy-haunted")).toHaveCount(0);
  await page.getByLabel("look").selectOption("haunted");
  await expect(page.locator(".sy-stage.edit.sy-haunted")).toHaveCount(1);
});

test("no template card has overlapping or cut-off text in the editor", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const id of ["haunted-house", "ghost-story", "pumpkin-tutorial"]) {
    await page.getByLabel("New from template").selectOption(id);
    const n = await page.locator(".card-item").count();
    for (let i = 0; i < n; i++) {
      await page.locator(".card-item").nth(i).click();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(80); // let the post-font cut-off check run
      expect(await page.locator(".sy-stage.edit .ed-overlap").count(), `${id} card ${i + 1} overlap`).toBe(0);
      expect(await page.locator(".sy-stage.edit .ed-overflow").count(), `${id} card ${i + 1} cut off`).toBe(0);
    }
  }
});

test("the editor warns when two texts overlap, and the warning clears when one is moved", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await page.getByLabel("New from template").selectOption("blank");
  await page.getByRole("button", { name: "Add text" }).click();
  await page.getByRole("button", { name: "Add text" }).click(); // both land on the same spot
  await expect(page.locator(".sy-stage.edit .ed-overlap")).toHaveCount(2);
  await expect(page.locator(".issues")).toContainText("Texts overlap");
  const y = page.getByRole("spinbutton", { name: "y" });
  await y.fill("400");
  await y.blur();
  await expect(page.locator(".sy-stage.edit .ed-overlap")).toHaveCount(0);
});
