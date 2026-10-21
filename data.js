const MULGI_SOURCES = {
  notices: "https://mulgivald.ee/wp-json/wp/v2/posts?categories=1&per_page=20&_fields=id,date,link,title,excerpt,content,categories,tags",
  events: "https://www.kultuurikava.ee/widget/af68b005502ca6d738249657707037b20f46dfe0/?do=data&start=0&nocache=1&limit=50&ignoremuuseums=true"
};

const EVENT_CATEGORIES = [
  "Sport",
  "Kino",
  "Meelelahutus",
  "Pere ja lapsed",
  "Kirjandus",
  "Teater",
  "Varia",
  "Mess ja laat"
];

const decodeHtml = (value) => {
  const element = document.createElement("textarea");
  element.innerHTML = value || "";
  return element.value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
};

const noticeType = (post) => {
  const text = `${post.title.rendered} ${post.excerpt.rendered}`.toLowerCase();
  return /(kiire|urgent|hoiatus|liiklus|veeavarii|elektri|sulgema|oht)/.test(text) ? "important" : "general";
};

const formatNoticeDate = (date) => new Intl.DateTimeFormat("et-EE", {
  day: "numeric",
  month: "short"
}).format(new Date(date));

const noticeDateIso = (date) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
};

const formatEventDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return {
    day: new Intl.DateTimeFormat("et-EE", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("et-EE", { month: "short" }).format(date).replace(".", "").toUpperCase(),
    iso: date.toISOString()
  };
};

const formatEventTime = (timestamp) => new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit"
}).format(new Date(timestamp * 1000));

const mapNotice = (post) => ({
  id: `notice-${post.id}`,
  title: decodeHtml(post.title.rendered),
  text: decodeHtml(post.excerpt.rendered),
  content: decodeHtml(post.content?.rendered || post.excerpt.rendered),
  date: formatNoticeDate(post.date),
  dateIso: noticeDateIso(post.date),
  type: noticeType(post),
  sourceUrl: post.link
});

const mapEvent = (event) => {
  const date = formatEventDate(event.time.start);
  const endTimestamp = event.time.end || event.time.start;
  const sourceCategory = event.categories?.find((category) => category.name_nat)?.name_nat;
  const category = sourceCategory === "Pidu ja Klubi" ? "Meelelahutus" : sourceCategory;
  return {
    id: `event-${event.id}`,
    day: date.day,
    month: date.month,
    title: event.name,
    place: event.time.place.name,
    time: formatEventTime(event.time.start),
    description: `${event.name} toimub kohas ${event.time.place.name}.`,
    category: EVENT_CATEGORIES.includes(category) ? category : "Varia",
    sourceUrl: `https://www.kultuurikava.ee${event.internalurl}`,
    date: date.iso,
    endDateIso: new Date(endTimestamp * 1000).toISOString(),
    image: event.image || ""
  };
};

const loadMulgiAppData = async () => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const requestOptions = { signal: controller.signal };
  const [noticeResponse, eventResponse] = await Promise.all([
    fetch(MULGI_SOURCES.notices, requestOptions),
    fetch(`${MULGI_SOURCES.events}&date=${encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString())}&enddate=${encodeURIComponent(new Date(Date.now() + 90 * 86400000).toISOString())}`, requestOptions)
  ]).finally(() => window.clearTimeout(timeout));

  if (!noticeResponse.ok) throw new Error(`Teadete allikas vastas veaga (${noticeResponse.status}).`);
  if (!eventResponse.ok) throw new Error(`Sündmuste allikas vastas veaga (${eventResponse.status}).`);

  const posts = await noticeResponse.json();
  const eventPayload = await eventResponse.json();
  const events = eventPayload?.data?.events?.results;
  if (!Array.isArray(posts) || !Array.isArray(events)) throw new Error("Veebiallikate vastus ei olnud oodatud kujul.");

  return {
    notices: posts.map(mapNotice).sort((a, b) => b.dateIso.localeCompare(a.dateIso)),
    events: events.map(mapEvent).sort((a, b) => a.date.localeCompare(b.date)),
    sources: MULGI_SOURCES
  };
};
