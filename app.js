const detailContent = document.querySelector("#detailContent");
let notices = [];
let events = [];
const RECENT_DAYS = 7;
const notificationsStorageKey = "mulgi-app-notifications-enabled";
const localReminderPlugin = window.capacitorLocalNotifications?.LocalNotifications;
const reminderChannelId = "mulgi-event-reminders";

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const splitByAge = (items, compareExactTime = false) => {
  const today = startOfToday();
  const now = compareExactTime ? new Date() : today;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  return {
    active: items.filter((item) => {
      const date = new Date(item.endDateIso || item.dateIso || item.date);
      return !Number.isNaN(date.getTime()) && date >= now;
    }),
    recent: items.filter((item) => {
      const date = new Date(item.endDateIso || item.dateIso || item.date);
      return !Number.isNaN(date.getTime()) && date >= cutoff && date < now;
    })
  };
};

const splitNoticesByAge = (items) => {
  const cutoff = new Date(startOfToday());
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  return {
    active: items.filter((item) => {
      const date = new Date(item.dateIso);
      return !Number.isNaN(date.getTime()) && date >= cutoff;
    }),
    recent: items.filter((item) => {
      const date = new Date(item.dateIso);
      return !Number.isNaN(date.getTime()) && date < cutoff;
    })
  };
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[character]));

const renderState = (container, state, message = "") => {
  container.innerHTML = `<div class="content-state ${state}">${escapeHtml(message)}</div>`;
};

const noticeMarkup = (item) => `
  <button class="feed-item ${escapeHtml(item.type)}" data-detail-type="notice" data-detail-id="${escapeHtml(item.id)}">
    <span class="feed-dot"></span>
    <span class="feed-item-content"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></span>
    <time>${escapeHtml(item.date)}</time>
  </button>`;

const eventMarkup = (event, large = false) => `
  <button class="${large ? "event-item" : "event-card"}" data-detail-type="event" data-detail-id="${escapeHtml(event.id)}">
    <span class="date event-date"><strong>${escapeHtml(event.dateLabel)}</strong></span>
    <span class="event-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.place)} · ${escapeHtml(event.time)}</span></span>
    ${large ? '<span class="event-arrow">›</span>' : ""}
  </button>`;

const renderCollection = (container, items, markup, emptyMessage) => {
  if (items.length === 0) {
    renderState(container, "empty", emptyMessage);
    return;
  }
  container.innerHTML = items.map(markup).join("");
};

const renderFeeds = () => {
  const homeFeed = document.querySelector("#homeFeed");
  const noticeFeed = document.querySelector("#noticeFeed");
  const recentNoticeFeed = document.querySelector("#recentNoticeFeed");
  const homeEvents = document.querySelector("#homeEvents");
  const eventList = document.querySelector("#eventList");
  const recentEventList = document.querySelector("#recentEventList");
  const noticeGroups = splitNoticesByAge(notices);
  const eventGroups = splitByAge(events, true);

  renderCollection(homeFeed, noticeGroups.active.slice(0, 2), noticeMarkup, "Uusi teateid pole.");
  renderCollection(noticeFeed, noticeGroups.active, noticeMarkup, "Aktiivseid teateid pole.");
  renderCollection(recentNoticeFeed, noticeGroups.recent, noticeMarkup, "Vanemaid teateid pole.");
  renderCollection(homeEvents, eventGroups.active.slice(0, 2), (event) => eventMarkup(event), "Tulevasi sündmusi pole.");
  renderCollection(eventList, eventGroups.active, (event) => eventMarkup(event, true), "Tulevasi sündmusi pole.");
  renderCollection(recentEventList, eventGroups.recent, (event) => eventMarkup(event, true), "Viimase 7 päeva jooksul pole möödunud sündmusi.");
  bindDetailLinks();
};

const renderNoticeFilter = (filter) => {
  const filtered = notices.filter((item) => filter === "all" || item.type === filter);
  const groups = splitNoticesByAge(filtered);
  const noticeFeed = document.querySelector("#noticeFeed");
  renderCollection(noticeFeed, groups.active, noticeMarkup, "Selles kategoorias pole aktiivseid teateid.");
  renderCollection(document.querySelector("#recentNoticeFeed"), groups.recent, noticeMarkup, "Selles kategoorias pole vanemaid teateid.");
  bindDetailLinks();
};

const renderEventFilter = (filter) => {
  const filtered = filter === "all"
    ? events
    : events.filter((event) => event.categories.includes(filter));
  const groups = splitByAge(filtered, true);
  renderCollection(document.querySelector("#eventList"), groups.active, (event) => eventMarkup(event, true), "Selles kategoorias pole tulevasi sündmusi.");
  renderCollection(document.querySelector("#recentEventList"), groups.recent, (event) => eventMarkup(event, true), "Selles kategoorias pole viimase 7 päeva möödunud sündmusi.");
  bindDetailLinks();
};

const renderDetail = (type, id) => {
  const item = (type === "notice" ? notices : events).find((entry) => entry.id === id);
  if (!item) {
    renderState(detailContent, "error", "Seda sisu ei leitud.");
    return;
  }

  if (type === "notice") {
    detailContent.innerHTML = `
      <div class="detail-heading">
        <p class="eyebrow">${item.type === "important" ? "Oluline teade" : "Teadaanne"}</p>
        <h1>${escapeHtml(item.title)}</h1>
        <time>${escapeHtml(item.date)}</time>
      </div>
      <div class="detail-card"><p>${escapeHtml(item.content)}</p>${item.sourceUrl ? `<a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">Ava algallikas</a>` : ""}</div>`;
    return;
  }

  detailContent.innerHTML = `
    <div class="detail-heading">
      <p class="eyebrow">Sündmus</p>
      <h1>${escapeHtml(item.title)}</h1>
    </div>
    <div class="detail-card event-detail">
      <p class="event-date-type"><strong>${escapeHtml(item.dateLabel)}</strong><br><span>Tüüp: ${escapeHtml(item.eventType)}</span></p>
      <p><strong>${escapeHtml(item.place)}</strong><br>${escapeHtml(item.time)}</p>
      <p>${escapeHtml(item.description)}</p>
      ${item.sourceUrl ? `<a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">Vaata sündmust Kultuurikavas</a>` : ""}
      <label class="reminder-label" for="reminderOffset">Meeldetuletus</label>
      <select class="reminder-select" id="reminderOffset">
        <option value="10">10 minutit enne</option>
        <option value="30">30 minutit enne</option>
        <option value="60" selected>1 tund enne</option>
        <option value="1440">1 päev enne</option>
        <option value="custom">Valin täpse aja</option>
      </select>
      <div class="reminder-custom" id="reminderCustom" hidden>
        <label class="reminder-label" for="reminderCustomTime">Täpset aega</label>
        <input class="reminder-input" id="reminderCustomTime" type="datetime-local" lang="et-EE">
      </div>
      <button class="primary-button reminder-button" type="button">Lisa meeldetuletus</button>
    </div>`;
  const reminderOffset = document.querySelector("#reminderOffset");
  const reminderCustom = document.querySelector("#reminderCustom");
  reminderOffset.addEventListener("change", () => {
    reminderCustom.hidden = reminderOffset.value !== "custom";
  });
  document.querySelector(".reminder-button").addEventListener("click", () => scheduleReminder(item));
};

const reminderNotificationId = (event) => {
  let hash = 0;
  for (const character of event.id) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) || 1;
};

const showReminderMessage = (event, message, label = "Meeldetuletus lisatud") => {
  document.querySelector("#demoReminder")?.remove();
  const demo = document.createElement("div");
  demo.id = "demoReminder";
  demo.className = "demo-reminder";
  demo.innerHTML = `
    <div class="demo-reminder-icon">✓</div>
    <div>
      <span class="demo-reminder-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(event.title)}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
    <button type="button" aria-label="Sulge teavitus">×</button>`;
  document.body.appendChild(demo);
  demo.querySelector("button").addEventListener("click", () => demo.remove());
};

const scheduleReminder = async (event) => {
  const selectedOffset = document.querySelector("#reminderOffset").value;
  const eventTime = new Date(event.date);
  const customTime = document.querySelector("#reminderCustomTime").value;
  const reminderTime = selectedOffset === "custom"
    ? new Date(customTime)
    : new Date(eventTime.getTime() - Number(selectedOffset) * 60 * 1000);
  if (Number.isNaN(eventTime.getTime()) || Number.isNaN(reminderTime.getTime()) || reminderTime <= new Date()) {
    showReminderMessage(event, "Selle sündmuse meeldetuletuse aeg on juba möödunud.", "Meeldetuletust ei lisatud");
    return;
  }
  if (!window.Capacitor?.isNativePlatform?.()) {
    showReminderMessage(event, "Päris teavitus töötab Androidi rakenduses.", "Demo: meeldetuletus lisatud");
    return;
  }
  if (!localReminderPlugin) {
    showReminderMessage(event, "Päris teavitused töötavad Androidi rakenduses pärast build'i.", "Teavitus pole saadaval");
    return;
  }
  try {
    const permission = await localReminderPlugin.requestPermissions();
    if (permission.display !== "granted") {
      showReminderMessage(event, "Luba Androidi seadetes märguanded, et meeldetuletus saaks ilmuda.", "Luba on vajalik");
      return;
    }
    await localReminderPlugin.createChannel({
      id: reminderChannelId,
      name: "Sündmuste meeldetuletused",
      description: "Meeldetuletused kasutaja valitud sündmuste kohta.",
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true
    });
    const notificationId = reminderNotificationId(event);
    await localReminderPlugin.cancel({ notifications: [{ id: notificationId }] });
    await localReminderPlugin.schedule({
      notifications: [{
        id: notificationId,
        title: "Mulgi valla sündmus",
        body: `${event.title} algab ${event.time}.`,
        schedule: { at: reminderTime, allowWhileIdle: true },
        channelId: reminderChannelId,
        extra: { eventId: event.id }
      }]
    });
    showReminderMessage(event, `Teavitus tuleb ${reminderTime.toLocaleString("et-EE")}.`, "Meeldetuletus lisatud");
  } catch (error) {
    console.error("Meeldetuletuse ajastamine ebaõnnestus:", error);
    showReminderMessage(event, "Meeldetuletust ei saanud ajastada. Kontrolli Androidi teavituste luba.", "Teavitus ebaõnnestus");
  }
};

const bindDetailLinks = () => {
  document.querySelectorAll("[data-detail-type]").forEach((item) => item.addEventListener("click", () => {
    window.location.hash = `detail-${item.dataset.detailType}-${item.dataset.detailId}`;
  }));
};

function showScreen() {
  const requested = window.location.hash.slice(1) || "home";
  const detailMatch = requested.match(/^detail-(notice|event)-(.+)$/);
  const screenName = detailMatch ? "detail" : requested;
  const screen = document.querySelector(`[data-screen="${screenName}"]`) || document.querySelector('[data-screen="home"]');
  document.querySelectorAll(".screen").forEach((item) => item.classList.toggle("is-active", item === screen));
  document.querySelectorAll("[data-nav]").forEach((item) => item.classList.toggle("is-active", item.dataset.nav === screen.dataset.screen));
  if (detailMatch) renderDetail(detailMatch[1], detailMatch[2]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".toggle:not(#notificationsToggle)").forEach((toggle) => toggle.addEventListener("click", () => toggle.classList.toggle("is-on")));
const darkModeToggle = document.querySelector("#darkModeToggle");
const darkModeStorageKey = "mulgi-app-dark-mode";
const notificationsToggle = document.querySelector("#notificationsToggle");
const notificationCard = document.querySelector("#notificationCard");

const setDarkMode = (enabled) => {
  document.body.classList.toggle("dark-mode", enabled);
  darkModeToggle.classList.toggle("is-on", enabled);
  darkModeToggle.setAttribute("aria-pressed", String(enabled));
};

setDarkMode(localStorage.getItem(darkModeStorageKey) === "true");
darkModeToggle.addEventListener("click", () => {
  const enabled = !document.body.classList.contains("dark-mode");
  setDarkMode(enabled);
  localStorage.setItem(darkModeStorageKey, String(enabled));
});

const setNotificationsEnabled = (enabled) => {
  notificationsToggle.classList.toggle("is-on", enabled);
  notificationsToggle.setAttribute("aria-pressed", String(enabled));
  notificationCard.hidden = enabled;
  localStorage.setItem(notificationsStorageKey, String(enabled));
};

setNotificationsEnabled(localStorage.getItem(notificationsStorageKey) === "true");
document.querySelector("#enableNotifications").addEventListener("click", () => {
  setNotificationsEnabled(true);
});
notificationsToggle.addEventListener("click", () => {
  setNotificationsEnabled(!notificationsToggle.classList.contains("is-on"));
});
document.querySelector("#detailBack").addEventListener("click", () => { window.location.hash = "home"; });
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-selected", item === button));
  renderNoticeFilter(button.dataset.filter);
}));
document.querySelectorAll("[data-event-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-event-filter]").forEach((item) => item.classList.toggle("is-selected", item === button));
  renderEventFilter(button.dataset.eventFilter);
}));

const startApp = async () => {
  [document.querySelector("#homeFeed"), document.querySelector("#noticeFeed"), document.querySelector("#recentNoticeFeed"), document.querySelector("#homeEvents"), document.querySelector("#eventList"), document.querySelector("#recentEventList")]
    .forEach((container) => renderState(container, "loading", "Laadin Mulgi valla infot..."));
  try {
    const data = await loadMulgiAppData();
    notices = data.notices;
    events = data.events;
    renderFeeds();
  } catch (error) {
    console.error("Mulgi valla andmete laadimine ebaõnnestus:", error);
    const message = window.location.protocol === "file:"
      ? "Ava rakendus failiga „Käivita rakendus.bat”, sest otse index.html avamisel blokeerib brauser väliste andmete laadimise."
      : error.name === "AbortError"
        ? "Mulgi valla info laadimine võttis liiga kaua aega. Kontrolli internetiühendust ja proovi uuesti."
        : error.name === "TypeError" || error.message === "Failed to fetch"
          ? "Internetiühendus puudub või andmete allikas ei ole kättesaadav. Kontrolli ühendust ja proovi uuesti."
        : error.message;
    [document.querySelector("#homeFeed"), document.querySelector("#noticeFeed"), document.querySelector("#recentNoticeFeed"), document.querySelector("#homeEvents"), document.querySelector("#eventList"), document.querySelector("#recentEventList")]
      .forEach((container) => renderState(container, "error", message));
  }
};

startApp();
window.addEventListener("hashchange", showScreen);
showScreen();
