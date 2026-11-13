// Pictures: upload policy (keep small PNG/GIF, PNG fallback), crisp pixels, text tones, template art.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importStack } from "../../src/export/import";
import { chooseTemplate, skipWelcome } from "./helpers";

const IMAGE_INPUT = 'input[type=file][accept="image/*"]';

async function blankStack(page: Page): Promise<void> {
  await page.goto("/");
  await chooseTemplate(page, "blank");
}

/** Export the current stack and parse it back, so assertions see exactly what a user would ship. */
async function exported(page: Page, path: string) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  await download.saveAs(path);
  const r = importStack(readFileSync(path, "utf8"));
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.stack;
}

test.beforeEach(async ({ page }) => { await skipWelcome(page); });

test("an animated GIF is stored byte-for-byte and keeps animating", async ({ page }, info) => {
  await blankStack(page);
  const file = "media/gifs/ghost-float.gif";
  await page.locator(IMAGE_INPUT).setInputFiles(file);
  await expect(page.locator(".sy-stage.edit img.sy-obj")).toHaveCount(1);

  const s = await exported(page, info.outputPath("gif.html"));
  const asset = Object.values(s.assets)[0];
  expect(asset?.mime).toBe("image/gif");
  expect(asset?.data).toBe(readFileSync(file).toString("base64")); // identical bytes: every frame survives
  const img = s.cards[0]?.objects[0];
  expect(img?.kind === "image" && img.crisp).toBe(true);          // small PNG/GIF are assumed to be pixel art
});

test("a small PNG with transparency is kept exactly, and drawn with hard pixel edges", async ({ page }) => {
  await blankStack(page);
  await page.locator(IMAGE_INPUT).setInputFiles("media/sprites/skull.png");
  const img = page.locator(".sy-stage.edit img.sy-obj");
  await expect(img).toHaveCount(1);
  await expect(img).toHaveClass(/sy-crisp/);
  expect(await img.evaluate((el) => getComputedStyle(el).imageRendering)).toMatch(/pixelated|crisp-edges/);

  // The toggle in the inspector turns it off (for photos) and back on.
  const crisp = page.getByLabel(/crisp pixels/);
  await expect(crisp).toBeChecked();
  await crisp.uncheck();
  await expect(page.locator(".sy-stage.edit img.sy-obj")).not.toHaveClass(/sy-crisp/);
  expect(await page.locator(".sy-stage.edit img.sy-obj").evaluate((el) => getComputedStyle(el).imageRendering)).toBe("auto");
});

test("a big picture is re-encoded to WebP or PNG (never JPEG) and keeps its transparency", async ({ page }, info) => {
  await blankStack(page);
  // 900x900 noise PNG (> 256 KB) with a fully transparent corner.
  const b64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 900;
    const g = c.getContext("2d")!;
    const d = g.createImageData(900, 900);
    let seed = 123456789;
    const rnd = (): number => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) & 255; }; // xorshift
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = rnd(); d.data[i + 1] = rnd(); d.data[i + 2] = rnd(); d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    g.clearRect(0, 0, 60, 60);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return await new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result).split(",")[1] ?? "");
      fr.readAsDataURL(blob);
    });
  });
  const buffer = Buffer.from(b64, "base64");
  expect(buffer.length).toBeGreaterThan(256 * 1024);
  await page.locator(IMAGE_INPUT).setInputFiles({ name: "noise.png", mimeType: "image/png", buffer });
  await expect(page.locator(".sy-stage.edit img.sy-obj")).toHaveCount(1);

  const s = await exported(page, info.outputPath("big.html"));
  const asset = Object.values(s.assets)[0]!;
  expect(["image/webp", "image/png"]).toContain(asset.mime);
  expect(asset.mime).not.toBe("image/jpeg");
  // WebKit cannot write WebP, so it takes the PNG fallback; Chromium/Firefox write WebP. Either way not JPEG.
  const img = s.cards[0]?.objects[0];
  expect(img?.kind === "image" && img.crisp).toBe(false); // photos stay smooth by default

  // Transparent corner survives the re-encode (JPEG would have made it black).
  const alpha = await page.evaluate(async ({ mime, data }) => {
    const im = new Image();
    im.src = `data:${mime};base64,${data}`;
    await im.decode();
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    return g.getImageData(5, 5, 1, 1).data[3];
  }, asset);
  expect(alpha).toBe(0);
});

test("text tones: light gets a shadow, panel gets a dark panel", async ({ page }) => {
  await blankStack(page);
  await page.getByRole("button", { name: "Add text" }).click();
  const text = (): ReturnType<Page["locator"]> => page.locator(".sy-stage.edit .sy-text");
  const style = (prop: string): Promise<string> => text().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

  expect(await style("background-color")).toBe("rgba(0, 0, 0, 0)");           // dark ink: no panel
  await page.getByLabel("text style").selectOption("light");
  expect(await style("text-shadow")).not.toBe("none");
  expect(await style("color")).toBe("rgb(241, 233, 255)");
  await page.getByLabel("text style").selectOption("panel");
  expect(await style("background-color")).toBe("rgba(13, 8, 20, 0.84)");
  expect(await style("color")).toBe("rgb(241, 233, 255)");
});

test("the doctor hints when dark text sits on a picture", async ({ page }) => {
  await blankStack(page);
  await page.locator(IMAGE_INPUT).setInputFiles("media/backgrounds/bg-gate.png");
  await expect(page.locator(".sy-stage.edit img.sy-obj")).toHaveCount(1);
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.locator(".issues")).toContainText("may be hard to read");
  await page.getByLabel("text style").selectOption("panel");
  await expect(page.locator(".inspect")).not.toContainText("may be hard to read");
});

test("template pictures load in the editor and in exported files, with crisp pixels", async ({ page, browser }, info) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const id of ["haunted-house", "ghost-story", "pumpkin-tutorial", "midnight-train", "bestiary"]) {
    await chooseTemplate(page, id);
    const n = await page.locator(".card-item").count();
    for (let i = 0; i < n; i++) {
      await page.locator(".card-item").nth(i).click();
      const broken = await page.locator(".sy-stage.edit img.sy-obj").evaluateAll((els) =>
        (els as HTMLImageElement[]).filter((im) => !im.complete || im.naturalWidth === 0).length);
      expect(broken, `${id} card ${i + 1}: pictures that failed to load`).toBe(0);
    }
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
    const file = info.outputPath(`${id}.html`);
    await download.saveAs(file);
    const ctx = await browser.newContext({ offline: true });
    const p = await ctx.newPage();
    await p.goto(`file://${file}`);
    const imgs = p.locator(".sy-stage img");
    await expect(imgs.first()).toBeVisible();
    expect(await imgs.evaluateAll((els) => (els as HTMLImageElement[]).filter((im) => !im.complete || im.naturalWidth === 0).length)).toBe(0);
    expect(await imgs.first().evaluate((el) => getComputedStyle(el).imageRendering)).toMatch(/pixelated|crisp-edges/);
    await ctx.close();
  }
});

// ---- Animation: the GIFs must really move, everywhere they are used --------------------------------
import { expectAnimated, openOffline } from "./helpers";

async function exportTemplate(page: Page, id: string, path: string): Promise<string> {
  await page.goto("/");
  await chooseTemplate(page, id);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  await download.saveAs(path);
  return path;
}

test("exported Haunted House: bats circle the moon on the first card", async ({ page, browser }, info) => {
  const file = await exportTemplate(page, "haunted-house", info.outputPath("h.html"));
  const { ctx, page: p } = await openOffline(browser, file);
  await expectAnimated(p.locator('[data-id="gate_bats"]'));
  await ctx.close();
});

test("exported Haunted House: the candle on the Study desk flickers, with no dark box around it", async ({ page, browser }, info) => {
  const file = await exportTemplate(page, "haunted-house", info.outputPath("c.html"));
  const { ctx, page: p } = await openOffline(browser, file);
  for (const label of ["Step inside", "Find a light", "Study"]) await p.locator(".sy-btn", { hasText: label }).click();
  const candle = p.locator('[data-id="study_candle"]');
  await expectAnimated(candle);
  // The GIF's corners are transparent: the Study wall shows through, not the GIF's old dark square.
  const box = (await candle.boundingBox())!;
  await candle.evaluate((el) => { (el as HTMLElement).style.visibility = "hidden"; });
  const wall = await p.screenshot({ clip: { x: box.x + 1, y: box.y + 1, width: 3, height: 3 } });
  await candle.evaluate((el) => { (el as HTMLElement).style.visibility = "visible"; });
  const withCandle = await p.screenshot({ clip: { x: box.x + 1, y: box.y + 1, width: 3, height: 3 } });
  expect(withCandle.equals(wall)).toBe(true);
  await ctx.close();
});

test("exported Ghost Story: bats over the moon on the road", async ({ page, browser }, info) => {
  const file = await exportTemplate(page, "ghost-story", info.outputPath("g.html"));
  const { ctx, page: p } = await openOffline(browser, file);
  await expectAnimated(p.locator('[data-id="road_bats"]'));
  await ctx.close();
});

test("exported pumpkin tutorial: the jack-o-lantern flickers on the last step", async ({ page, browser }, info) => {
  const file = await exportTemplate(page, "pumpkin-tutorial", info.outputPath("p.html"));
  const { ctx, page: p } = await openOffline(browser, file);
  // Walk forward until the "Light it up" step, however many steps come before it.
  for (let i = 0; i < 12 && !(await p.getByText("Light it up").first().isVisible()); i++) {
    await p.locator(".sy-btn", { hasText: "Next" }).click();
  }
  await expect(p.getByText("Light it up").first()).toBeVisible();
  await expectAnimated(p.locator('[data-id="light_img"]'));
  await ctx.close();
});

test("the ghost in the welcome dialog and the candle in an empty card animate", async ({ browser }) => {
  const ctx = await browser.newContext(); // first run: no "welcomed" flag
  const page = await ctx.newPage();
  await page.goto("/");
  const dlg = page.getByRole("dialog", { name: /first card in 30 seconds/i });
  await expectAnimated(dlg.locator("img.mascot.ghost"));
  await dlg.getByRole("button", { name: "Start with a blank stack" }).click();
  await expectAnimated(page.locator(".empty-hint img.mascot.candle"));
  await ctx.close();
});

test("with reduced motion the mascots are still sprites, not animated GIFs", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  const ghost = page.getByRole("dialog").locator("img.mascot.ghost");
  await expect(ghost).toBeVisible();
  expect(await ghost.getAttribute("src")).toMatch(/^data:image\/png/);
  expect(await ghost.getAttribute("alt")).toBe(""); // decorative
  await ctx.close();
});

test("exported Midnight Train: steam rises from the chimney and the view moves past the window", async ({ page, browser }, info) => {
  const file = await exportTemplate(page, "midnight-train", info.outputPath("t.html"));
  const { ctx, page: p, errs, requests } = await openOffline(browser, file);
  await p.locator(".sy-btn", { hasText: "Watch the light" }).click();
  await expectAnimated(p.locator('[data-id="arrival_steam"]'));
  await p.locator(".sy-btn", { hasText: "Climb aboard" }).click();
  await p.locator(".sy-click", { hasText: "Look out of the window" }).click();
  await expectAnimated(p.locator('[data-id="window_view"]'));
  expect(requests).toEqual([]);
  expect(errs).toEqual([]);
  await ctx.close();
});
