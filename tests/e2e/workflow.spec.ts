import { test, expect } from "@playwright/test";

test.describe("Aruga Full Clinical Workflow Journey", () => {
  test("complete end-to-end therapist to client workflow", async ({ page }) => {
    // 1. Visit landing page
    await page.goto("/");
    await expect(page.locator("text=Aruga").first()).toBeVisible();
    await expect(page.locator("text=Launch Portal").first()).toBeVisible();

    // 2. Click Launch Portal to navigate to Login / Portal selector
    await page.locator("text=Launch Portal").first().click();
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator("text=Therapist Portal")).toBeVisible();
    await expect(page.locator("text=Client Portal")).toBeVisible();

    // 3. Sign in as Therapist
    await page.click("text=Therapist Portal");
    await expect(page).toHaveURL(/.*\/therapist\/clients/);
    await expect(page.locator("text=Clients")).toBeVisible();
    await expect(page.locator("text=Marcus Vance")).toBeVisible();

    // 3. Open Marcus Vance client detail
    await page.click("text=Marcus Vance");
    await expect(page).toHaveURL(/.*\/therapist\/clients\/.*/);
    await expect(page.locator("text=Tabletop Grasp & Precision Release Routine")).toBeVisible();

    // 4. Open Submission Review
    await page.click("text=Review Submission");
    await expect(page).toHaveURL(/.*\/therapist\/submissions\/.*/);
    await expect(page.locator("text=Meta Review Assistant")).toBeVisible();

    // 5. Review step observations and therapist notes
    await expect(page.locator("text=Cylindrical Cup Lift and Transfer")).toBeVisible();
    await expect(page.locator("text=Forearm Supination with Washcloth")).toBeVisible();
    await expect(page.locator("text=Overall Session Feedback")).toBeVisible();

    // 6. Navigate to Therapist Messages
    await page.goto("/therapist/messages");
    await expect(page.locator("text=Care Thread: Marcus Vance")).toBeVisible();
    await expect(page.locator("text=Messaging is not monitored continuously")).toBeVisible();

    // 7. Client Portal flow
    await page.goto("/client");
    await expect(page.locator("text=Welcome back, Marcus")).toBeVisible();
    await expect(page.locator("text=Dr. Elena Ramos, OTR/L")).toBeVisible();

    // 8. Open Program Runner
    await page.click("text=Continue Routine");
    await expect(page).toHaveURL(/.*\/client\/programs\/.*/);
    await expect(page.locator("text=Step 1 of 3")).toBeVisible();
    await expect(page.locator("text=Start Recording")).toBeVisible();

    // 9. Client History
    await page.goto("/client/history");
    await expect(page.locator("text=Program History & Clinician Reviews")).toBeVisible();
    await expect(page.locator("text=Feedback Published")).toBeVisible();

    // 10. Client Messages
    await page.goto("/client/messages");
    await expect(page.locator("text=Care Thread: Dr. Elena Ramos")).toBeVisible();
  });
});
