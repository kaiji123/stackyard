import { expect, type Browser, type Page } from "@playwright/test";

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
  await page.evaluate(() => document.fonts.ready);
  const ok = await page.evaluate(() => document.fonts.check('16px "Silkscreen"') && document.fonts.check('16px "VT323"'));
  expect(ok).toBe(true);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")).sort());
  expect(loaded).toEqual(expect.arrayContaining(["Silkscreen", "VT323"]));
}
