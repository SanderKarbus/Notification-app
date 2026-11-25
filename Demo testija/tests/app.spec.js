const { test, expect } = require("@playwright/test");
const { toWordPressNotices, toEventPayload, toRangedEventPayload, toCategorizedEventPayload } = require("./fixtures");

const noticesUrl = "**/wp-json/wp/v2/posts**";
const eventsUrl = "**/widget/**";

async function mockApi(page, { notices = toWordPressNotices(), events = toEventPayload(), status = 200 } = {}) {
  await page.route(noticesUrl, async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({}) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(notices) });
  });
  await page.route(eventsUrl, async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({}) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(events) });
  });
}

async function openApp(page, options, { expectData = true } = {}) {
  await mockApi(page, options);
  await page.goto("/index.html?notify-test=1#home");
  if (expectData) {
    await expect(page.locator("#homeFeed .feed-item")).toHaveCount(2);
  }
}

test.describe("NotificationAPPi põhivood", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("notification-app-test-started")) {
        localStorage.clear();
        sessionStorage.setItem("notification-app-test-started", "true");
      }
    });
  });

  test("testib avalehe laadimist", async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-screen="home"] h1')).toContainText("Oluline info");
    await expect(page.locator("#homeEvents .event-card")).toHaveCount(1);
  });

  test("testib teadete ja sündmuste laadimist", async ({ page }) => {
    await openApp(page);
    await page.goto("/index.html?notify-test=1#notices");
    await expect(page.locator("#noticeFeed .feed-item")).toHaveCount(2);
    await page.goto("/index.html?notify-test=1#events");
    await expect(page.locator("#eventList .event-item")).toHaveCount(1);
  });

  test("testib teate ja sündmuse detailvaadet", async ({ page }) => {
    await openApp(page);
    await page.locator("#homeFeed .feed-item").first().click();
    await expect(page.locator('[data-screen="detail"].is-active h1')).toHaveText("Oluline veeavarii teade");
    await page.locator("#detailBack").click();
    await page.locator("#homeEvents .event-card").click();
    await expect(page.locator('[data-screen="detail"].is-active')).toContainText("Tulevane spordipäev");
    await expect(page.locator(".reminder-button")).toBeVisible();
  });

  test("testib tühja sisu olekut", async ({ page }) => {
    await openApp(page, { notices: [], events: { data: { events: { results: [] } } } }, { expectData: false });
    await page.goto("/index.html?notify-test=1#notices");
    await expect(page.locator("#noticeFeed")).toContainText("Aktiivseid teateid pole");
    await page.goto("/index.html?notify-test=1#events");
    await expect(page.locator("#eventList")).toContainText("Tulevasi sündmusi pole");
  });

  test("testib API vea olekut", async ({ page }) => {
    await mockApi(page, { status: 503 });
    await page.goto("/index.html?notify-test=1#home");
    await expect(page.locator(".content-state.error").first()).toContainText("503");
  });

  test("testib aegunud sisu eemaldamist aktiivsetest nimekirjadest", async ({ page }) => {
    await openApp(page);
    await page.goto("/index.html?notify-test=1#notices");
    await expect(page.locator("#noticeFeed")).toContainText("Valla uudis");
    await expect(page.locator("#recentNoticeFeed")).toContainText("Vana teade");
    await page.goto("/index.html?notify-test=1#events");
    await expect(page.locator("#eventList")).not.toContainText("Vana sündmus");
    await expect(page.locator("#recentEventList")).toContainText("Möödunud kinoseanss");
  });

  test("testib filtreid ja tumedat kujundust", async ({ page }) => {
    await openApp(page);
    await page.goto("/index.html?notify-test=1#notices");
    await page.locator('[data-filter="important"]').click();
    await expect(page.locator("#noticeFeed .feed-item")).toHaveCount(1);
    await page.locator('[data-nav="settings"]').click();
    await page.locator("#darkModeToggle").click();
    await expect(page.locator("body")).toHaveClass(/dark-mode/);
    await page.reload();
    await expect(page.locator("body")).toHaveClass(/dark-mode/);
  });

  test("kuvab sündmuse tüübi ja kuupäevavahemiku", async ({ page }) => {
    await openApp(page, { events: toRangedEventPayload() });
    await page.goto("/index.html?notify-test=1#events");
    await expect(page.locator("#eventList .event-date").nth(0)).toHaveText(/^\d{1,2}\. [a-zõäöü]+$/i);
    await expect(page.locator("#eventList .event-date").nth(1)).toHaveText(/^\d{1,2}\.-\d{1,2}\. [a-zõäöü]+$/i);
    await expect(page.locator("#eventList .event-date").nth(2)).toHaveText(/^\d{1,2}\. [a-zõäöü]+ - \d{1,2}\. [a-zõäöü]+$/i);
    await page.locator("#eventList .event-item").first().click();
    await expect(page.locator(".event-date-type")).toContainText("Tüüp: Ühepäevane");
  });

  test("Kõik näitab sündmusi sõltumata kategooriatest ja filtrid säilitavad mitu kategooriat", async ({ page }) => {
    await openApp(page, { events: toCategorizedEventPayload() });
    await page.goto("/index.html?notify-test=1#events");
    await expect(page.locator("#eventList .event-item")).toHaveCount(2);
    await expect(page.locator("#eventList")).toContainText("Kategooriata sündmus");
    await page.locator('[data-event-filter="Mess ja laat"]').click();
    await expect(page.locator("#eventList .event-item")).toHaveCount(1);
    await expect(page.locator("#eventList")).toContainText("Mitme kategooriaga festival");
  });

  test("pärib sündmusi ka 31 päeva tagasi ja lokaliseerib meeldetuletuse kalendri eesti keelde", async ({ page }) => {
    const eventQueryDates = [];
    page.on("request", (request) => {
      if (!request.url().includes("/widget/")) return;
      const date = new URL(request.url()).searchParams.get("date");
      if (date) eventQueryDates.push(new Date(date).getTime());
    });
    await openApp(page);
    expect(eventQueryDates.some((date) =>
      Math.abs(Date.now() - date - 31 * 86400000) < 5000
    )).toBe(true);

    await page.locator("#homeEvents .event-card").click();
    await page.locator("#reminderOffset").selectOption("custom");
    await expect(page.locator("#reminderCustomTime")).toHaveAttribute("lang", "et-EE");
  });

  test("testib märguannete lülitamist ja rakenduse uuesti avamist", async ({ page }) => {
    await openApp(page);
    await page.locator("#enableNotifications").click();
    await expect(page.locator("#notificationCard")).toBeHidden();
    await page.reload();
    await expect(page.locator("#notificationCard")).toBeHidden();
    await page.locator('[data-nav="settings"]').click();
    await page.locator("#notificationsToggle").click();
    await page.locator('[data-nav="home"]').click();
    await expect(page.locator("#notificationCard")).toBeVisible();
  });

  test("testib meeldetuletuse demo-teavitust", async ({ page }) => {
    await openApp(page);
    await page.locator("#homeEvents .event-card").click();
    await page.locator(".reminder-button").click();
    await expect(page.locator("#demoReminder")).toContainText("meeldetuletus lisatud");
    await expect(page.locator("#demoReminder")).toContainText("Tulevane spordipäev");
  });
});

test.describe("ühenduse ja laadimise äärejuhtumid", () => {
  test("testib aeglast internetti", async ({ page }) => {
    await page.route(noticesUrl, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(toWordPressNotices()) });
    });
    await page.route(eventsUrl, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(toEventPayload()) });
    });
    await page.goto("/index.html?notify-test=1#home");
    await expect(page.locator(".content-state.loading").first()).toContainText("Laadin");
    await expect(page.locator("#homeFeed .feed-item")).toHaveCount(2);
  });

  test("testib interneti puudumist", async ({ page }) => {
    await page.route(noticesUrl, (route) => route.abort("failed"));
    await page.route(eventsUrl, (route) => route.abort("failed"));
    await page.goto("/index.html?notify-test=1#home");
    await expect(page.locator(".content-state.error").first()).toBeVisible();
  });
});
