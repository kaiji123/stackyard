// The Midnight Train, played end to end in an exported file, offline, like a player would.
import { expect, test } from "@playwright/test";
import { chooseTemplate, openOffline, skipWelcome } from "./helpers";

test("the Midnight Train can be played to its happy ending from the exported file", async ({ page, browser }, info) => {
  await skipWelcome(page);
  await page.goto("/");
  await chooseTemplate(page, "midnight-train");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /self-contained/ }).click()]);
  const file = info.outputPath("the-midnight-train.html");
  await download.saveAs(file);
  expect(download.suggestedFilename()).toBe("the-midnight-train.html");

  const { ctx, page: p, errs, requests } = await openOffline(browser, file);
  const press = (label: string): Promise<void> => p.locator(".sy-btn", { hasText: label }).click();
  const title = (t: string) => expect(p.locator(".sy-stage")).toHaveAttribute("aria-label", t);

  await press("Watch the light"); await title("The Midnight Train");
  await press("Climb aboard"); await title("Carriage One");
  await press("Conductor"); await press("Show a ticket");
  await expect(p.getByText("You have no ticket. He frowns.")).toBeVisible();
  await press("Ask about the train"); await title("Mortimer");
  await press("Take the lantern"); await expect(p.getByText("He gave you a little lantern.")).toBeVisible();
  await press("Back"); await press("Luggage van");
  await press("Search the trunks"); await expect(p.getByText("Biscuit wags. A music box!")).toBeVisible();
  await press("Back"); await press("Sleeper");
  await press("Give the music box"); await expect(p.getByText("He swaps it for the spectacles!")).toBeVisible();
  await press("Back"); await press("Dining car");
  await press("Give the spectacles"); await expect(p.getByText("She gives you her old ticket!")).toBeVisible();
  await expect(p.locator('[data-id="dining_ticket"]')).toBeVisible();
  await press("Back"); await press("Conductor"); await press("Show a ticket");
  await title("Ticket Punched");
  await press("Say goodbye"); await title("The High Bridge");
  await press("Wave back"); await title("Home");
  await expect(p.getByText(/a ticket punched HOME/)).toBeVisible();

  expect(requests).toEqual([]);
  expect(errs).toEqual([]);
  await ctx.close();
});
