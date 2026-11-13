// The drawing tool: draw sprites and backgrounds straight onto a card, and redraw existing pictures.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseTemplate, forbidNativeDialogs, pressTab, skipWelcome } from "./helpers";

const openDraw = async (page: Page): Promise<Locator> => {
  await page.getByRole("button", { name: "Draw a picture or background" }).click();
  const dlg = page.getByRole("dialog", { name: "Draw" });
  await expect(dlg.locator("canvas.paint-canvas")).toBeVisible();
  return dlg;
};

/** Screen position of a drawing pixel, from the canvas size and the grid size in the status line. */
async function cellPos(dlg: Locator, cx: number, cy: number): Promise<[number, number]> {
  const box = (await dlg.locator("canvas.paint-canvas").boundingBox())!;
  const [, w, h] = /of (\d+)×(\d+)/.exec((await dlg.getByRole("status").textContent()) ?? "")!.map(Number) as [number, number, number];
  return [box.x + ((cx + 0.5) * box.width) / w, box.y + ((cy + 0.5) * box.height) / h];
}

/** Read the saved picture of an image object back out of the editor: size and a pixel's colour. */
const picture = (page: Page, id: string) => page.locator(`.sy-stage.edit [data-id="${id}"]`).evaluate(async (el, _) => {
  const img = el as HTMLImageElement;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const px = (x: number, y: number): string => {
    const d = g.getImageData(x, y, 1, 1).data;
    return d[3] === 0 ? "transparent" : "#" + [d[0], d[1], d[2]].map((v) => v!.toString(16).padStart(2, "0")).join("");
  };
  return { w: img.naturalWidth, h: img.naturalHeight, mime: img.src.slice(5, img.src.indexOf(";")), px: [px(0, 0), px(10, 10), px(12, 12)] };
}, null);

const selectedId = (page: Page): Promise<string> => page.locator(".ed-sel").evaluate(() => {
  const label = [...document.querySelectorAll<HTMLElement>(".sy-stage.edit .sy-img")].pop();
  return label?.dataset["id"] ?? "";
});

test.beforeEach(async ({ page }) => { await skipWelcome(page); });

test("draw a sprite with the mouse; it lands on the card, crisp, described, and one Undo removes it", async ({ page }) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  await chooseTemplate(page, "blank");
  const dlg = await openDraw(page);
  await expect(dlg.getByRole("button", { name: "Add to card" })).toBeDisabled(); // nothing drawn yet

  await dlg.getByRole("radio", { name: "White", exact: true }).click();
  await dlg.getByRole("button", { name: "Box" }).click();
  const [x0, y0] = await cellPos(dlg, 8, 6), [x1, y1] = await cellPos(dlg, 22, 26);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  await dlg.getByRole("radio", { name: "Ink", exact: true }).click();
  await dlg.getByRole("button", { name: "Pen" }).click();
  const [ex, ey] = await cellPos(dlg, 12, 12);
  await page.mouse.click(ex, ey);
  await dlg.getByRole("textbox", { name: /Describe your picture/ }).fill("a white ghost");
  await dlg.getByRole("button", { name: "Add to card" }).click();
  await expect(dlg).toHaveCount(0);

  const img = page.locator(".sy-stage.edit img.sy-obj");
  await expect(img).toHaveCount(1);
  await expect(img).toHaveClass(/sy-crisp/);
  await expect(img).toHaveAttribute("alt", "a white ghost");
  const pic = await picture(page, await selectedId(page));
  expect([pic.w, pic.h, pic.mime]).toEqual([32, 32, "image/png"]); // stored at drawing size: tiny
  expect(pic.px).toEqual(["transparent", "#f1e9ff", "#0d0814"]);    // corner see-through, box white, the eye ink

  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(page.locator(".sy-stage.edit img.sy-obj")).toHaveCount(0);
  expect(native).toEqual([]);
});

test("draw a background: it fills the card on the bottom layer, under the text", async ({ page }) => {
  await page.goto("/");
  await chooseTemplate(page, "blank");
  await page.getByRole("button", { name: "Add text" }).click();
  const dlg = await openDraw(page);
  await dlg.getByRole("radio", { name: "Background (whole card)" }).click();
  await expect(dlg.getByRole("status")).toContainText("of 200×150");
  await expect(dlg.locator(".paint-onion .sy-text")).toHaveText("New text"); // the card shows through to trace
  await dlg.getByRole("radio", { name: "Navy", exact: true }).click();
  await dlg.getByRole("button", { name: "Fill" }).click();
  const [x, y] = await cellPos(dlg, 50, 50);
  await page.mouse.click(x, y);
  await dlg.getByRole("button", { name: "Add to card" }).click();

  const objs = await page.locator(".sy-stage.edit .sy-obj").evaluateAll((els) => els.map((e) => (e as HTMLElement).className.split(" ")[1]));
  expect(objs).toEqual(["sy-img", "sy-text"]); // picture first = bottom layer
  const bg = page.locator(".sy-stage.edit .sy-img");
  const box = await bg.evaluate((el) => [el.style.left, el.style.top, el.style.width, el.style.height]);
  expect(box).toEqual(["0px", "0px", "800px", "600px"]);
});

test("edit the built-in ghost: it opens at its real 16×16 size, and the change can be undone", async ({ page }) => {
  await page.goto("/");
  await page.locator(".card-item").filter({ has: page.locator(".card-name", { hasText: /^\d+\. The Cellar$/ }) }).click();
  await page.locator('.sy-stage.edit [data-id="cellar_ghost"]').click({ position: { x: 85, y: 85 } });
  const before = await picture(page, "cellar_ghost");
  expect([before.w, before.h]).toEqual([256, 256]);
  await page.getByRole("button", { name: "✎ Edit drawing" }).click();
  const dlg = page.getByRole("dialog", { name: "Edit drawing" });
  await expect(dlg.getByRole("status")).toContainText("of 16×16"); // 16 px blocks found and shrunk back
  await dlg.getByRole("radio", { name: "Mint", exact: true }).click();
  await dlg.getByRole("button", { name: "Fill" }).click();
  const [x, y] = await cellPos(dlg, 8, 4);     // the white of the ghost's head
  await page.mouse.click(x, y);
  await dlg.getByRole("button", { name: "Save drawing" }).click();
  const after = await picture(page, "cellar_ghost");
  expect([after.w, after.h]).toEqual([16, 16]);
  expect(after.px[1]).not.toBe(before.px[1]);
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  expect(await picture(page, "cellar_ghost")).toEqual(before);
});

test("draw with the keyboard: arrows move, Space paints, a line takes two presses", async ({ page }, info) => {
  await page.goto("/");
  await chooseTemplate(page, "blank");
  const dlg = await openDraw(page);
  await dlg.getByRole("radio", { name: "Small sprite 16×16" }).click();
  const canvas = dlg.locator("canvas.paint-canvas");
  await canvas.focus();
  await expect(dlg.getByRole("status")).toContainText("x 9, y 9 of 16×16");
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowUp");
  await expect(dlg.getByRole("status")).toContainText("x 1, y 1");
  await page.keyboard.press("Space");                                  // one pixel at the corner
  await page.keyboard.press("l");                                      // line tool
  for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(dlg.getByRole("status")).toContainText("press Space again");
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(dlg.getByRole("button", { name: "Add to card" })).toBeEnabled();
  await dlg.getByRole("button", { name: "Add to card" }).click();
  const pic = await picture(page, await selectedId(page));
  expect([pic.w, pic.h]).toEqual([16, 16]);
  expect(pic.px[0]).toBe("#ff9d3c");                                   // the corner pixel, default orange
  await pressTab(page, info.project.name);                             // focus is back in the editor, not lost
});

test("unsaved work is protected: Esc asks twice, switching size asks twice", async ({ page }) => {
  const native = forbidNativeDialogs(page);
  await page.goto("/");
  const dlg = await openDraw(page);
  const [x, y] = await cellPos(dlg, 3, 3);
  await page.mouse.click(x, y);
  await dlg.getByRole("radio", { name: "Background (whole card)" }).click();
  await expect(dlg.getByRole("status")).toContainText("again to clear your drawing");
  await expect(dlg.getByRole("status")).not.toContainText("200×150");
  await dlg.locator("canvas.paint-canvas").focus();
  await page.keyboard.press("Escape");
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("status")).toContainText("Press Esc again");
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(page.locator(".sy-stage.edit img.sy-obj[data-id^='o']")).toHaveCount(await page.locator(".sy-stage.edit img.sy-obj[data-id^='o']").count());
  expect(native).toEqual([]);
});

test("the painter tools: undo and redo inside it, mirror, the colour picker", async ({ page }) => {
  await page.goto("/");
  await chooseTemplate(page, "blank");
  const dlg = await openDraw(page);
  await page.getByRole("button", { name: "⇋ Mirror" }).click();
  const [x, y] = await cellPos(dlg, 2, 10);
  await page.mouse.click(x, y);                            // mirrored to x 29 too
  await dlg.getByRole("button", { name: "Pick" }).click();
  const [mx, my] = await cellPos(dlg, 29, 10);
  await page.mouse.click(mx, my);                          // picks the mirrored pixel's colour, back to Pen
  await expect(dlg.getByRole("button", { name: "Pen" })).toHaveAttribute("aria-pressed", "true");
  await expect(dlg.getByRole("radio", { name: "Orange", exact: true })).toHaveAttribute("aria-checked", "true");
  await dlg.getByRole("button", { name: "Undo drawing (Ctrl+Z)" }).click();
  await expect(dlg.getByRole("button", { name: "Add to card" })).toBeDisabled();
  await dlg.getByRole("button", { name: "Redo drawing (Ctrl+Shift+Z)" }).click();
  await expect(dlg.getByRole("button", { name: "Add to card" })).toBeEnabled();
});

test("a drawing survives export, plays offline, and stays pixel-crisp", async ({ page, browser }, info) => {
  await page.goto("/");
  await chooseTemplate(page, "blank");
  const dlg = await openDraw(page);
  const [x, y] = await cellPos(dlg, 16, 16);
  await page.mouse.click(x, y);
  await dlg.getByRole("button", { name: "Add to card" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = info.outputPath("drawn.html");
  await download.saveAs(file);
  const ctx = await browser.newContext({ offline: true });
  const p = await ctx.newPage();
  await p.goto(`file://${file}`);
  const img = p.locator(".sy-stage img");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el) => [(el as HTMLImageElement).naturalWidth, getComputedStyle(el).imageRendering])).toEqual([32, expect.stringMatching(/pixelated|crisp-edges/)]);
  await ctx.close();
});
