const futureNoticeDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const recentNoticeDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const oldNoticeDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const futureEventStart = Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000);
const recentEventStart = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);
const oldEventStart = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

const notice = (id, title, date, category = "general") => ({
  id,
  date,
  link: `https://mulgivald.ee/teade/${id}`,
  title: { rendered: title },
  excerpt: { rendered: `${title} lühikirjeldus.` },
  content: { rendered: `${title} pikem sisu.` },
  categories: category === "important" ? [1] : []
});

const event = (id, name, start, category = "Sport") => ({
  id,
  name,
  time: {
    start,
    end: start + 60 * 60,
    place: { name: "Karksi-Nuia kultuurikeskus" }
  },
  categories: [{ name_nat: category }],
  internalurl: `/sundmus/${id}`,
  image: ""
});

const rangedEvent = (id, name, start, end, category = "Varia") => ({
  ...event(id, name, start, category),
  time: {
    ...event(id, name, start, category).time,
    end
  }
});

const appData = {
  notices: [
    notice(101, "Oluline veeavarii teade", futureNoticeDate, "important"),
    notice(102, "Valla uudis", recentNoticeDate),
    notice(103, "Vana teade", oldNoticeDate)
  ],
  events: [
    event(201, "Tulevane spordipäev", futureEventStart, "Sport"),
    event(202, "Möödunud kinoseanss", recentEventStart, "Kino"),
    event(203, "Vana sündmus", oldEventStart, "Teater")
  ]
};

const toWordPressNotices = () => appData.notices;
const toEventPayload = () => ({ data: { events: { results: appData.events } } });
const toRangedEventPayload = () => ({
  data: {
    events: {
      results: [
        event(204, "Teatrietendus", futureEventStart, "Teater"),
        rangedEvent(205, "Festival", futureEventStart, futureEventStart + 2 * 86400, "Meelelahutus"),
        rangedEvent(206, "Sammuvõistlus", futureEventStart, futureEventStart + 30 * 86400, "Sport")
      ]
    }
  }
});

const toCategorizedEventPayload = () => ({
  data: {
    events: {
      results: [
        {
          ...event(207, "Mitme kategooriaga festival", futureEventStart),
          categories: [{ name_nat: "Sport" }, { name_nat: "Mess ja laat" }]
        },
        {
          ...event(208, "Kategooriata sündmus", futureEventStart),
          categories: []
        }
      ]
    }
  }
});

module.exports = {
  appData,
  toWordPressNotices,
  toEventPayload,
  toRangedEventPayload,
  toCategorizedEventPayload
};
