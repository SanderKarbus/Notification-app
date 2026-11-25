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

const formatEventRange = (startTimestamp, endTimestamp) => {
  const start = new Date(startTimestamp * 1000);
  const end = new Date(endTimestamp * 1000);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const dayCount = Math.round((endDay - startDay) / 86400000) + 1;
  const longMonth = new Intl.DateTimeFormat("et-EE", { month: "long" }).format(start);
  const startMonth = new Intl.DateTimeFormat("et-EE", { month: "short" }).format(start).replace(".", "");
  const endMonth = new Intl.DateTimeFormat("et-EE", { month: "short" }).format(end).replace(".", "");
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  if (dayCount === 1) {
    return { type: "Ühepäevane", label: `${start.getDate()}. ${longMonth}` };
  }
  if (dayCount > 7) {
    return {
      type: "Pikaajaline",
      label: `${start.getDate()}. ${startMonth} - ${end.getDate()}. ${endMonth}`
    };
  }
  return {
    type: "Mitmepäevane",
    label: sameMonth
      ? `${start.getDate()}.-${end.getDate()}. ${longMonth}`
      : `${start.getDate()}. ${startMonth} - ${end.getDate()}. ${endMonth}`
  };
};

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
  const dateRange = formatEventRange(event.time.start, endTimestamp);
  const categories = [...new Set((Array.isArray(event.categories) ? event.categories : [])
    .map((category) => category?.name_nat)
    .filter(Boolean)
    .map((category) => category === "Pidu ja Klubi" ? "Meelelahutus" : category)
    .filter((category) => EVENT_CATEGORIES.includes(category)))];
  if (categories.length === 0) categories.push("Varia");
  return {
    id: `event-${event.id}`,
    day: date.day,
    month: date.month,
    dateLabel: dateRange.label,
    eventType: dateRange.type,
    title: event.name,
    place: event.time.place.name,
    time: formatEventTime(event.time.start),
    description: `${event.name} toimub kohas ${event.time.place.name}.`,
    category: categories[0],
    categories,
    sourceUrl: `https://www.kultuurikava.ee${event.internalurl}`,
    date: date.iso,
    endDateIso: new Date(endTimestamp * 1000).toISOString(),
    image: event.image || ""
  };
};

const eventRequestUrl = (date) => `${MULGI_SOURCES.events}&date=${encodeURIComponent(date.toISOString())}&enddate=${encodeURIComponent(new Date(Date.now() + 90 * 86400000).toISOString())}`;

const eventQueryOffsets = [-21, -7, 0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84];

const mergeEvents = (eventLists) => {
  const merged = new Map();
  eventLists.flat().forEach((event) => {
    const existing = merged.get(event.id);
    if (!existing) {
      merged.set(event.id, event);
      return;
    }
    if (event.time.start < existing.time.start) existing.time.start = event.time.start;
    if (event.time.end > existing.time.end) existing.time.end = event.time.end;
  });
  return [...merged.values()];
};

const loadMulgiAppData = async () => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const requestOptions = { signal: controller.signal };
  const eventDates = eventQueryOffsets.map((offset) => new Date(Date.now() + offset * 86400000));
  const [noticeResponse, ...eventResponses] = await Promise.all([
    fetch(MULGI_SOURCES.notices, requestOptions),
    ...eventDates.map((date) => fetch(eventRequestUrl(date), requestOptions))
  ]).finally(() => window.clearTimeout(timeout));

  if (!noticeResponse.ok) throw new Error(`Teadete allikas vastas veaga (${noticeResponse.status}).`);
  const failedEventResponse = eventResponses.find((response) => !response.ok);
  if (failedEventResponse) throw new Error(`Sündmuste allikas vastas veaga (${failedEventResponse.status}).`);

  const posts = await noticeResponse.json();
  const eventPayloads = await Promise.all(eventResponses.map((response) => response.json()));
  const eventLists = eventPayloads.map((payload) => payload?.data?.events?.results);
  if (!Array.isArray(posts) || eventLists.some((events) => !Array.isArray(events))) {
    throw new Error("Veebiallikate vastus ei olnud oodatud kujul.");
  }

  return {
    notices: posts.map(mapNotice).sort((a, b) => b.dateIso.localeCompare(a.dateIso)),
    events: mergeEvents(eventLists).map(mapEvent).sort((a, b) => a.date.localeCompare(b.date)),
    sources: MULGI_SOURCES
  };
};
