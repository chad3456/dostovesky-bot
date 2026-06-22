import { test, expect, type Page } from "@playwright/test";
import { createEpub } from "../fixtures/make-epub";

let epubBuffer: Buffer;

test.beforeAll(async () => {
  epubBuffer = await createEpub({
    title: "The E2E Odyssey",
    author: "Test Runner",
    chapters: [
      {
        title: "Chapter One",
        paragraphs: [
          "Call me Tester. Some years ago, never mind how long precisely.",
          "This paragraph exists so we can select and highlight it.",
        ],
      },
      {
        title: "Chapter Two",
        paragraphs: ["The voyage continued across the sea of assertions."],
      },
    ],
  });
});

function uniqueEmail() {
  return `reader_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/library", { timeout: 30_000 });
}

async function uploadBook(page: Page) {
  await page.setInputFiles('[data-testid="file-input"]', {
    name: "the-e2e-odyssey.epub",
    mimeType: "application/epub+zip",
    buffer: epubBuffer,
  });
  await expect(page.getByText("The E2E Odyssey").first()).toBeVisible({
    timeout: 30_000,
  });
}

function readerFrame(page: Page) {
  return page.frameLocator('[data-testid="epub-viewport"] iframe');
}

test("landing page invites sign in", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Everywhere/i }),
  ).toBeVisible();
});

test("a reader can sign in, upload, and read a book", async ({ page }) => {
  await login(page, uniqueEmail());

  await expect(page.getByText("Your library is empty")).toBeVisible();

  await uploadBook(page);

  await page.getByText("The E2E Odyssey").first().click();
  await page.waitForURL("**/read/**");

  // Book content renders inside the epub iframe.
  await expect(readerFrame(page).getByText("Chapter One")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    readerFrame(page).getByText(/Call me Tester/),
  ).toBeVisible();
});

test("reading preferences persist across reloads", async ({ page }) => {
  await login(page, uniqueEmail());
  await uploadBook(page);
  await page.getByText("The E2E Odyssey").first().click();
  await page.waitForURL("**/read/**");
  await expect(readerFrame(page).getByText("Chapter One")).toBeVisible({
    timeout: 30_000,
  });

  // Open settings and pick the Sepia theme + bump font size.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Sepia" }).click();
  await page.getByLabel("Increase Font size").click();
  await page.getByRole("button", { name: "Close panel" }).click();

  // Reload — preferences come back from the server.
  await page.reload();
  await expect(readerFrame(page).getByText("Chapter One")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Settings" }).click();
  // The Sepia swatch should still be the selected one.
  await expect(page.getByRole("button", { name: "Sepia" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a highlight can be created and is listed", async ({ page }) => {
  await login(page, uniqueEmail());
  await uploadBook(page);
  await page.getByText("The E2E Odyssey").first().click();
  await page.waitForURL("**/read/**");
  const frame = readerFrame(page);
  await expect(frame.getByText("Chapter One")).toBeVisible({ timeout: 30_000 });

  // Programmatically select a paragraph and notify epub.js.
  await frame.locator("p").first().evaluate((el: Element) => {
    const doc = el.ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents(el);
    const sel = doc.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    doc.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  // The selection action bar appears; pick a highlight color.
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Highlight yellow" }).click();

  // It shows up in the highlights panel...
  await page.getByRole("button", { name: "Highlights" }).click();
  await expect(page.getByText(/Highlights \(1\)/)).toBeVisible();

  // ...and survives a reload (server-synced).
  await page.reload();
  await expect(frame.getByText("Chapter One")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Highlights" }).click();
  await expect(page.getByText(/Highlights \(1\)/)).toBeVisible();
});

test("a shared link opens the book read-only without signing in", async ({
  page,
  browser,
}) => {
  await login(page, uniqueEmail());
  await uploadBook(page);

  // Open the share dialog from the book's menu.
  await page.getByLabel("Book options").first().click();
  await page.getByRole("menuitem", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create share link" }).click();

  const shareInput = page.getByLabel("Share link");
  await expect(shareInput).toBeVisible();
  const shareUrl = await shareInput.inputValue();
  expect(shareUrl).toContain("/shared/");

  // Visit the link in a brand-new, signed-out context.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(shareUrl);
  await expect(
    guest.frameLocator('[data-testid="epub-viewport"] iframe').getByText("Chapter One"),
  ).toBeVisible({ timeout: 30_000 });
  await guestContext.close();
});
