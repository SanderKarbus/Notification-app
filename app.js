const detailContent = document.querySelector("#detailContent");
let notices = [];
let events = [];
const RECENT_DAYS = 7;

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
    <span class="date">${large ? `<strong>${escapeHtml(event.day)}</strong>` : escapeHtml(event.day)}<small>${escapeHtml(event.month)}</small></span>
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
  const noticeGroups = splitByAge(notices);
  const eventGroups = splitByAge(events, true);

  renderCollection(homeFeed, noticeGroups.active.slice(0, 2), noticeMarkup, "Uusi teateid pole.");
  renderCollection(noticeFeed, noticeGroups.active, noticeMarkup, "Aktiivseid teateid pole.");
  renderCollection(recentNoticeFeed, noticeGroups.recent, noticeMarkup, "Viimase 7 päeva jooksul pole möödunud teateid.");
  renderCollection(homeEvents, eventGroups.active.slice(0, 2), (event) => eventMarkup(event), "Tulevasi sündmusi pole.");
  renderCollection(eventList, eventGroups.active, (event) => eventMarkup(event, true), "Tulevasi sündmusi pole.");
  renderCollection(recentEventList, eventGroups.recent, (event) => eventMarkup(event, true), "Viimase 7 päeva jooksul pole möödunud sündmusi.");
  bindDetailLinks();
};

const renderNoticeFilter = (filter) => {
  const filtered = notices.filter((item) => filter === "all" || item.type === filter);
  const groups = splitByAge(filtered);
  const noticeFeed = document.querySelector("#noticeFeed");
  renderCollection(noticeFeed, groups.active, noticeMarkup, "Selles kategoorias pole aktiivseid teateid.");
  renderCollection(document.querySelector("#recentNoticeFeed"), groups.recent, noticeMarkup, "Selles kategoorias pole viimase 7 päeva möödunud teateid.");
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
      <span class="date"><strong>${escapeHtml(item.day)}</strong><small>${escapeHtml(item.month)}</small></span>
      <p><strong>${escapeHtml(item.place)}</strong><br>${escapeHtml(item.time)}</p>
      <p>${escapeHtml(item.description)}</p>
      ${item.sourceUrl ? `<a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">Vaata sündmust Kultuurikavas</a>` : ""}
      <button class="primary-button reminder-button" type="button">Lisa meeldetuletus</button>
    </div>`;
  document.querySelector(".reminder-button").addEventListener("click", () => showReminderDemo(item));
};

let reminderTimeout;
const showReminderDemo = (event) => {
  window.clearTimeout(reminderTimeout);
  document.querySelector("#demoReminder")?.remove();
  const demo = document.createElement("div");
  demo.id = "demoReminder";
  demo.className = "demo-reminder";
  demo.innerHTML = `
    <div class="demo-reminder-icon">✓</div>
    <div>
      <span class="demo-reminder-label">Demo: meeldetuletus lisatud</span>
      <strong>${escapeHtml(event.title)}</strong>
      <p>Meeldetuletus on valmis. Näidisteavitus saabub hetke pärast.</p>
    </div>
    <button type="button" aria-label="Sulge teavitus">×</button>`;
  document.body.appendChild(demo);
  demo.querySelector("button").addEventListener("click", () => demo.remove());
  reminderTimeout = window.setTimeout(() => {
    demo.classList.add("is-arrived");
    demo.querySelector(".demo-reminder-label").textContent = "Demo: meeldetuletus";
    demo.querySelector("p").textContent = "Sündmus algab peagi.";
  }, 3000);
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

document.querySelectorAll(".toggle").forEach((toggle) => toggle.addEventListener("click", () => toggle.classList.toggle("is-on")));
const darkModeToggle = document.querySelector("#darkModeToggle");
const darkModeStorageKey = "mulgi-app-dark-mode";

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
document.querySelector("#enableNotifications").addEventListener("click", (event) => {
  event.currentTarget.textContent = "Märguanded lubatud";
  event.currentTarget.classList.add("is-enabled");
});
document.querySelector("#notificationButton").addEventListener("click", () => { window.location.hash = "settings"; });
document.querySelector("#detailBack").addEventListener("click", () => { window.location.hash = "home"; });
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-selected", item === button));
  renderNoticeFilter(button.dataset.filter);
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
        : error.message;
    [document.querySelector("#homeFeed"), document.querySelector("#noticeFeed"), document.querySelector("#recentNoticeFeed"), document.querySelector("#homeEvents"), document.querySelector("#eventList"), document.querySelector("#recentEventList")]
      .forEach((container) => renderState(container, "error", message));
  }
};

startApp();
window.addEventListener("hashchange", showScreen);
showScreen();
