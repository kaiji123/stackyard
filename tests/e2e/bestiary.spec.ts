// The Halloween Bestiary, used like a wiki in an exported file, offline.
import { expect, test } from "@playwright/test";
import { chooseTemplate, expectAnimated, openOffline, pressTab, skipWelcome } from "./helpers";

test("read the wiki: chapters, pictures, see-also links, next, A to Z, and back to contents", async ({ page, browser }, info) => {
  await skipWelcome(page);
  await page.goto("/");
  await chooseTemplate(page, "bestiary");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = info.outputPath("bestiary.html");
  await download.saveAs(file);

  const { ctx, page: p, errs, requests } = await openOffline(browser, file);
  const at = (name: string) => expect(p.locator(".sy-stage")).toHaveAttribute("aria-label", name);
  await p.locator(".sy-btn", { hasText: "Open the book" }).click(); await at("Contents");
  await p.locator('[data-id="contents_animals_img"]').click(); await at("Real Animals");    // click a picture
  await p.locator(".sy-click", { hasText: "Bat" }).click(); await at("Bat");                 // or a name
  await expect(p.getByText(/only three kinds out of more than 1,400 drink blood/)).toBeVisible();
  await p.locator(".sy-click", { hasText: "See also: Vampire" }).click(); await at("Vampire");
  await p.locator(".sy-btn", { hasText: "Next: Zombie" }).click(); await at("Zombie");
  await p.locator(".sy-btn", { hasText: "The Undead" }).click(); await at("The Undead");
  await p.locator(".sy-btn", { hasText: "Contents" }).click();
  await p.locator(".sy-btn", { hasText: "A to Z" }).click(); await at("A to Z");
  await p.locator(".sy-click", { hasText: "Will-o'-the-wisp" }).click(); await at("Will-o'-the-wisp");
  await expectAnimated(p.locator('[data-id="wisp_img"]'));

  // Keyboard: a clickable picture is a Tab stop and opens with Enter.
  await p.locator(".sy-btn", { hasText: "Spirits" }).click(); await at("Spirits");
  await p.locator('[data-id="spirits_ghost_img"]').focus();
  await p.keyboard.press("Enter"); await at("Ghost");
  await pressTab(p, info.project.name);

  expect(requests).toEqual([]);
  expect(errs).toEqual([]);
  await ctx.close();
});

test("the gallery finds the wiki by what is inside it", async ({ page }) => {
  await skipWelcome(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play an example stack" }).click();
  const dlg = page.getByRole("dialog", { name: "Play a stack" });
  await dlg.getByRole("searchbox").fill("kitsune");
  await expect(dlg.locator(".tile[data-template]:visible")).toHaveCount(1);
  await expect(dlg.locator('.tile[data-template="bestiary"] .why')).toHaveText("Found on the card “Kitsune”");
  await dlg.getByRole("searchbox").fill("wiki");
  await expect(dlg.locator(".tile[data-template]:visible")).toHaveCount(1);
});
