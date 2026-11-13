// Phone checks (emulated iPhone 13 and Pixel 7). Real-device runs are listed in docs/TESTING.md.
import { expect, test } from "@playwright/test";
import { errors, ESCAPE_LABELS, openOffline, skipWelcome } from "./helpers";

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
  for (const label of ESCAPE_LABELS) await tap(label);
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
    for (const label of ESCAPE_LABELS) await tap(label);
    await expect(p.getByText("You escaped!")).toBeVisible();
    await p.screenshot({ path: `test-results/shots/mobile-export-${info.project.name}-${viewport.width}.png` });
    expect(requests).toEqual([]);
    expect(errs).toEqual([]);
    await ctx.close();
  }
});

test("on a phone the example gallery fits and a stack plays by tapping", async ({ page }) => {
  await skipWelcome(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play an example stack" }).tap();
  const dlg = page.getByRole("dialog", { name: "Play a stack" });
  await expect(dlg.locator(".tile[data-template]")).toHaveCount(5);
  // On a phone the search box is there but does not grab focus (that would open the keyboard over the list).
  await expect(dlg.getByRole("searchbox", { name: "Search stacks" })).toBeVisible();
  await expect(dlg.getByRole("searchbox", { name: "Search stacks" })).not.toBeFocused();
  const vw = page.viewportSize()?.width ?? 0;
  for (const tile of await dlg.locator(".tile[data-template]").all()) {
    const b = (await tile.boundingBox())!;
    expect(b.x >= 0 && b.x + b.width <= vw + 1).toBe(true); // no sideways scrolling
  }
  await dlg.getByRole("button", { name: "Play Tutorial: How to Carve a Pumpkin" }).tap();
  await expect(page.locator(".play-overlay .sy-btn", { hasText: "Next" })).toBeVisible();
  await page.getByRole("button", { name: "Exit play mode" }).tap();
  await expect(page.locator(".play-overlay")).toHaveCount(0);
});

test("draw with a finger on a phone", async ({ page }) => {
  await skipWelcome(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Draw a picture or background" }).tap();
  const dlg = page.getByRole("dialog", { name: "Draw" });
  const canvas = dlg.locator("canvas.paint-canvas");
  const box = (await canvas.boundingBox())!;
  const vw = page.viewportSize()?.width ?? 0;
  expect(box.x >= 0 && box.x + box.width <= vw).toBe(true);                // fits the phone
  await canvas.tap({ position: { x: box.width / 2, y: box.height / 2 } });
  await dlg.getByRole("button", { name: "Add to card" }).tap();
  await expect(dlg).toHaveCount(0);
  await expect(page.locator(".sy-stage.edit img.sy-crisp").last()).toBeVisible();
});
