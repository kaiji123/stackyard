// Phone checks (emulated iPhone 13 and Pixel 7). Real-device runs are listed in docs/TESTING.md.
import { expect, test } from "@playwright/test";
import { errors, openOffline, skipWelcome } from "./helpers";

test("editor is usable on a phone: select, edit and export without a side panel", async ({ page }, info) => {
  await skipWelcome(page);
  const errs = errors(page);
  await page.goto("/");
  await expect(page.locator(".sy-stage.edit .sy-obj").first()).toBeVisible();
  // No sideways page scroll.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/shots/mobile-editor-${info.project.name}.png` });

  // Tap a button on the card: the inspector tab opens and its fields are reachable.
  await page.locator(".sy-stage.edit .sy-btn").first().tap();
  const label = page.getByLabel("label");
  await expect(label).toBeVisible();
  await label.fill("Come in");
  await label.blur();
  await expect(page.locator(".sy-stage.edit .sy-btn", { hasText: "Come in" })).toBeVisible();
  // The no-code action editor is usable by touch too.
  await expect(page.getByLabel("Add action")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/mobile-inspector-${info.project.name}.png` });

  // Switch back to the card strip with the tab.
  await page.getByRole("button", { name: "Cards", exact: true }).tap();
  await expect(page.locator(".card-item").first()).toBeVisible();
  expect(errs).toEqual([]);
});

test("play mode fills the phone screen and the escape room can be won by tapping", async ({ page }) => {
  await skipWelcome(page);
  await page.goto("/");
  await page.getByRole("button", { name: "▶ Play" }).tap();
  const stage = page.locator(".play-host .sy-stage");
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  const vw = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= -1 && box.x + box.width <= vw + 1).toBe(true);
  const tap = (n: string): Promise<void> => page.locator(".play-host .sy-btn", { hasText: n }).tap();
  await tap("Step inside"); await tap("Light lamp"); await tap("Study"); await tap("Open drawer");
  await tap("Back to hall"); await tap("Cellar door"); await tap("Raise the lamp");
  await expect(page.locator(".play-host").getByText("You escaped!")).toBeVisible();
});

test("exported file works offline on a phone in portrait and landscape", async ({ page, browser }, info) => {
  await skipWelcome(page);
  await page.goto("/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).tap()]);
  const file = info.outputPath("phone.html");
  await download.saveAs(file);

  for (const viewport of [{ width: 390, height: 780 }, { width: 780, height: 390 }]) {
    const { ctx, page: p, errs, requests } = await openOffline(browser, file, { viewport, hasTouch: true, isMobile: true });
    const stage = p.locator(".sy-stage");
    await expect(stage).toBeVisible();
    const b = await stage.boundingBox();
    expect(b && b.x >= -1 && b.y >= -1 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1).toBe(true);
    const tap = (n: string): Promise<void> => p.locator(".sy-btn", { hasText: n }).tap();
    await tap("Step inside"); await tap("Light lamp"); await tap("Study"); await tap("Open drawer");
    await tap("Back to hall"); await tap("Cellar door"); await tap("Raise the lamp");
    await expect(p.getByText("You escaped!")).toBeVisible();
    await p.screenshot({ path: `test-results/shots/mobile-export-${info.project.name}-${viewport.width}.png` });
    expect(requests).toEqual([]);
    expect(errs).toEqual([]);
    await ctx.close();
  }
});
