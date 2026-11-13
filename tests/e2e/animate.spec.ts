// Animation: frame-by-frame drawings (saved as animated GIFs) and no-code movement for any object.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseTemplate, expectAnimated, forbidNativeDialogs, skipWelcome } from "./helpers";

async function cellPos(dlg: Locator, cx: number, cy: number): Promise<[number, number]> {
  const box = (await dlg.locator("canvas.paint-canvas").boundingBox())!;
  const [, w, h] = /of (\d+)×(\d+)/.exec((await dlg.getByRole("status").textContent()) ?? "")!.map(Number) as [number, number, number];
  return [box.x + ((cx + 0.5) * box.width) / w, box.y + ((cy + 0.5) * box.height) / h];
}
async function dragBox(page: Page, dlg: Locator, a: [number, number], b: [number, number]): Promise<void> {
  const [x0, y0] = await cellPos(dlg, ...a), [x1, y1] = await cellPos(dlg, ...b);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up();
}
/** The saved picture of the newest image on the card: its mime type and how many frames it has. */
const savedPicture = (page: Page) => page.locator(".sy-stage.edit img.sy-obj").last().evaluate((el) => {
  const src = (el as HTMLImageElement).src, mime = src.slice(5, src.indexOf(";"));
  const bytes = atob(src.slice(src.indexOf(",") + 1));
  let frames = 0;
  for (let i = bytes.indexOf("\x21\xf9\x04"); i >= 0; i = bytes.indexOf("\x21\xf9\x04", i + 1)) frames++;
  return { mime, frames };
});

test.beforeEach(async ({ page }) => { await skipWelcome(page); });

test("draw two frames: onion skin, preview, saved as a looping GIF, and it moves in the exported file", async ({ page, browser }, info) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  await chooseTemplate(page, "blank");
  await page.getByRole("button", { name: "Draw a picture or background" }).click();
  const dlg = page.getByRole("dialog", { name: "Draw" });
  await dlg.getByRole("radio", { name: "Small sprite 16×16" }).click();
  await dlg.getByRole("radio", { name: "Mint", exact: true }).click();
  await dlg.getByRole("button", { name: "Box" }).click();
  await dragBox(page, dlg, [5, 8], [10, 13]);                      // frame 1: low

  await dlg.getByText("Animation: add frames to make it move").click();
  await expect(dlg.getByRole("button", { name: "▶ Preview" })).toBeDisabled();       // nothing to play yet
  await dlg.getByRole("button", { name: "＋ Frame" }).click();
  await expect(dlg.locator(".paint-frames").getByRole("option", { name: "Frame 2" })).toHaveAttribute("aria-selected", "true");
  await expect(dlg.getByRole("status")).toContainText("a copy of frame 1");
  await dlg.getByRole("button", { name: "Clear" }).click();
  await expect(dlg.locator(".paint-frames").getByRole("option", { name: "Frame 2 (empty)" })).toBeVisible();
  await dragBox(page, dlg, [5, 3], [10, 8]);                       // frame 2: high

  // Onion skin shows frame 1 faintly under frame 2: there are pale mint pixels where frame 1 was.
  const faint = await dlg.locator("canvas.paint-canvas").evaluate((el) => {
    const c = el as HTMLCanvasElement, d = c.getContext("2d")!.getImageData(Math.floor(c.width * 0.45), Math.floor(c.height * 0.8), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  expect(faint[1]).toBeGreaterThan(faint[0]!);                     // greenish: frame 1 showing through
  await dlg.getByRole("button", { name: "Onion skin" }).click();
  await expect(dlg.getByRole("button", { name: "Onion skin" })).toHaveAttribute("aria-pressed", "false");

  await dlg.getByRole("button", { name: "▶ Preview" }).click();
  await expect(dlg.getByRole("button", { name: "■ Stop" })).toHaveAttribute("aria-pressed", "true");
  await expectAnimated(dlg.locator("canvas.paint-preview"));
  await dlg.getByLabel("Speed").selectOption("12");
  await dlg.getByRole("button", { name: "Add to card" }).click();

  expect(await savedPicture(page)).toEqual({ mime: "image/gif", frames: 2 });
  await expectAnimated(page.locator(".sy-stage.edit img.sy-obj").last());

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = info.outputPath("anim.html");
  await download.saveAs(file);
  const ctx = await browser.newContext({ offline: true });
  const p = await ctx.newPage();
  await p.goto(`file://${file}`);
  await expectAnimated(p.locator(".sy-stage img"));
  await ctx.close();
  expect(native).toEqual([]);
});

test("frames can be reordered and deleted, and undo covers frame changes too", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Draw a picture or background" }).click();
  const dlg = page.getByRole("dialog", { name: "Draw" });
  const [x, y] = await cellPos(dlg, 2, 2);
  await page.mouse.click(x, y);
  await dlg.getByText("Animation: add frames to make it move").click();
  await dlg.getByRole("button", { name: "＋ Frame" }).click();
  await dlg.getByRole("button", { name: "＋ Frame" }).click();
  await expect(dlg.locator(".paint-frames").getByRole("option")).toHaveCount(3);
  await dlg.getByRole("button", { name: "Move frame earlier" }).click();
  await expect(dlg.getByRole("status")).toContainText("frame 2 of 3");
  await dlg.getByRole("button", { name: "Delete frame" }).click();
  await expect(dlg.locator(".paint-frames").getByRole("option")).toHaveCount(2);
  await dlg.getByRole("button", { name: "Undo drawing (Ctrl+Z)" }).click();
  await expect(dlg.locator(".paint-frames").getByRole("option")).toHaveCount(3);
  // Keyboard: [ and ] step between frames.
  await dlg.locator("canvas.paint-canvas").focus();
  await page.keyboard.press("[");
  await expect(dlg.getByRole("status")).toContainText("frame 1 of 3");
  await page.keyboard.press("]");
  await page.keyboard.press("]");
  await expect(dlg.getByRole("status")).toContainText("frame 3 of 3");
});

test("an existing animation (the template's candle) opens frame by frame, and saves back as an animation", async ({ page }) => {
  await page.goto("/");
  await page.locator(".card-item").filter({ has: page.locator(".card-name", { hasText: /^\d+\. The Study$/ }) }).click();
  await page.locator('.sy-stage.edit [data-id="study_candle"]').click();
  await page.getByRole("button", { name: "✎ Edit drawing" }).click();
  const dlg = page.getByRole("dialog", { name: "Edit drawing" });
  await expect(dlg).toContainText("with 8 frames");
  await expect(dlg.locator(".paint-frames").getByRole("option")).toHaveCount(8);
  await expect(dlg.getByRole("status")).toContainText("of 16×16");   // 240 px, drawn on a 16×16 grid in 15 px blocks
  await dlg.getByRole("button", { name: "Save drawing" }).click();
  const pic = await page.locator('.sy-stage.edit [data-id="study_candle"]').evaluate((el) => (el as HTMLImageElement).src.slice(5, 14));
  expect(pic).toBe("image/gif");
});

test("movement: pick it in the inspector; still while editing, moving when played, off for reduced motion", async ({ page, browser }) => {
  await page.goto("/");
  await chooseTemplate(page, "blank");
  await page.getByRole("button", { name: "Add button" }).click();
  await page.getByLabel("movement").selectOption("pulse");
  const onCard = page.locator(".sy-stage.edit .sy-btn");
  await expect(onCard).toHaveClass(/sy-m-pulse/);
  await expect(onCard).toHaveClass(/ed-moves/);                       // a ↻ badge tells you it moves
  expect(await onCard.evaluate((el) => getComputedStyle(el).animationName)).toBe("none"); // still: easy to drag

  await page.getByRole("button", { name: "▶ Play" }).click();
  const played = page.locator(".play-host .sy-btn");
  expect(await played.evaluate((el) => getComputedStyle(el).animationName)).toBe("sy-pulse");
  await expectAnimated(played);
  await page.keyboard.press("Escape");

  // Undo restores "Still".
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(page.locator(".sy-stage.edit .sy-btn")).not.toHaveClass(/sy-m-/);

  // Reduced motion: nothing moves in an exported file.
  await page.getByRole("button", { name: "Redo (Ctrl+Shift+Z)" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = test.info().outputPath("motion.html");
  await download.saveAs(file);
  for (const [reducedMotion, expected] of [["no-preference", "sy-pulse"], ["reduce", "none"]] as const) {
    const ctx = await browser.newContext({ offline: true, reducedMotion });
    const p = await ctx.newPage();
    await p.goto(`file://${file}`);
    expect(await p.locator(".sy-btn").evaluate((el) => getComputedStyle(el).animationName)).toBe(expected);
    await ctx.close();
  }
});

test("the built-in stacks use movement: the cellar ghost floats when played", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "▶ Play" }).click();
  for (const label of ["Step inside", "Find a light"]) await page.locator(".play-host .sy-btn", { hasText: label }).click();
  // The ghost is in the cellar; check the class from the data instead of walking the whole puzzle.
  await page.keyboard.press("Escape");
  await page.locator(".card-item").filter({ has: page.locator(".card-name", { hasText: /^\d+\. The Cellar$/ }) }).click();
  await expect(page.locator('.sy-stage.edit [data-id="cellar_ghost"]')).toHaveClass(/sy-m-float/);
});
