import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

export const errors = (page: Page): string[] => {
  const list: string[] = [];
  page.on("pageerror", (e) => list.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") list.push(m.text()); });
  return list;
};

/** Skip the first-run welcome dialog (it has its own test). */
export async function skipWelcome(page: Page): Promise<void> {
  await page.addInitScript(() => { try { localStorage.setItem("stackyard:welcomed", "1"); } catch { /* ignore */ } });
}

/** Open an exported file in an offline context and report requests and console errors. */
export async function openOffline(browser: Browser, file: string, opts: Parameters<Browser["newContext"]>[0] = {}) {
  const ctx = await browser.newContext({ ...opts, offline: true });
  const page = await ctx.newPage();
  const errs = errors(page);
  const requests: string[] = [];
  page.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
  await page.goto(`file://${file}`);
  return { ctx, page, errs, requests };
}

export async function expectPixelFonts(page: Page): Promise<void> {
  // Ask for the faces explicitly: fonts.ready can resolve before lazy font loading has started.
  await page.evaluate(() => Promise.all([document.fonts.load('16px "Silkscreen"'), document.fonts.load('16px "VT323"')]));
  const ok = await page.evaluate(() => document.fonts.check('16px "Silkscreen"') && document.fonts.check('16px "VT323"'));
  expect(ok).toBe(true);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")).sort());
  expect(loaded).toEqual(expect.arrayContaining(["Silkscreen", "VT323"]));
}

/** Pick a template or "blank" in the toolbar and confirm the replace dialog. */
export async function chooseTemplate(page: Page, id: string): Promise<void> {
  await page.getByLabel("New from template").selectOption(id);
  await page.getByRole("dialog", { name: "Replace your current stack?" }).getByRole("button", { name: "Replace", exact: true }).click();
}

/** Fail the test if the page ever opens a native alert/confirm/prompt. */
export function forbidNativeDialogs(page: Page): string[] {
  const seen: string[] = [];
  page.on("dialog", (d) => { seen.push(`${d.type()}: ${d.message()}`); void d.dismiss(); });
  return seen;
}

/**
 * Press Tab like a user. WebKit on macOS (Safari's default) does not Tab onto buttons and links;
 * people there use Option+Tab, so tests do too. This is browser behaviour, not an app setting.
 */
export async function pressTab(page: Page, projectName: string, shift = false): Promise<void> {
  const alt = projectName === "webkit" && process.platform === "darwin";
  await page.keyboard.press(`${alt ? "Alt+" : ""}${shift ? "Shift+" : ""}Tab`);
}

/**
 * Prove a picture really animates on screen: take element screenshots for ~2 s and require more than one
 * distinct image. (Drawing an <img> to a canvas does not work for this: browsers always paint a GIF's first
 * frame there, so a canvas check reports "still" even for a moving GIF.)
 */
export async function expectAnimated(img: Locator): Promise<void> {
  await expect(img).toBeVisible();
  await img.evaluate((el) => (el instanceof HTMLImageElement ? el.decode() : undefined)); // canvases and buttons need no decoding
  const seen = new Set<string>();
  const until = Date.now() + 2500;
  // Shoot the area of the page, not the element: Playwright waits for a moving element to stop before
  // an element screenshot, which a looping CSS animation never does. Pad for movement past the box.
  const box = (await img.boundingBox())!;
  const pad = 16, page = img.page();
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 };
  while (Date.now() < until && seen.size < 3) {
    const shot = await page.screenshot({ animations: "allow", clip, timeout: 1500 }).catch(() => null);
    if (shot) seen.add(shot.toString("base64"));
    await new Promise((r) => setTimeout(r, 90));
  }
  expect(seen.size, "the picture should change between frames").toBeGreaterThan(1);
}

/**
 * The winning route through the Haunted House template, as button labels and as object ids. One place,
 * so the e2e specs stay in step with scripts/make-templates.mjs (tests/templates.test.ts checks the
 * same route against the engine).
 */
export const ESCAPE_ROUTE = [
  ["gate_go", "Step inside"], ["foyer_go", "Find a light"], ["hall_lamp", "Light lamp"], ["hall_study", "Study"],
  ["study_desk", "Open drawer"], ["study_back", "Back to hall"], ["hall_garden", "Garden"], ["garden_dig", "Dig by a grave"],
  ["garden_back", "Back inside"], ["hall_cellar", "Cellar door"], ["cellar_lamp", "Raise the lamp"],
  ["confession_go", "Go through the door"], ["forest_green", "Follow green"], ["clearing_tell", "Tell her he is sorry"],
  ["farewell_go", "Walk into the dawn"],
] as const;
export const ESCAPE_LABELS: readonly string[] = ESCAPE_ROUTE.map(([, label]) => label);
export const ESCAPE_IDS: readonly string[] = ESCAPE_ROUTE.map(([id]) => id);
/** Steps up to and including opening the drawer, where "You found a torn note!" appears. */
export const UNTIL_NOTE = ESCAPE_IDS.indexOf("study_desk") + 1;
/** Steps from the start to standing in the Hall. */
export const UNTIL_HALL = ESCAPE_IDS.indexOf("hall_lamp");

/** Card count of a generated template, read from the file so tests follow the generator. */
export const cardCount = (id: string): number =>
  (JSON.parse(readFileSync(`templates/${id}.json`, "utf8")) as { cards: unknown[] }).cards.length;
export const HAUNTED_CARDS = cardCount("haunted-house");
