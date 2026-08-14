(() => {
  const media = window.matchMedia("(max-width: 760px)");
  const SVG_NS = "http://www.w3.org/2000/svg";

  const weatherIconParts = {
    clear: [
      ["circle", { cx: "12", cy: "12", r: "4" }],
      ["path", { d: "M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" }]
    ],
    partlyCloudy: [
      ["circle", { cx: "8.5", cy: "8.5", r: "3" }],
      ["path", { d: "M8.5 2.5v1.3M3.45 4.55l.92.92M2.5 8.5h1.3M4.55 13.55l.92-.92M13.55 4.55l-.92.92" }],
      ["path", { d: "M7 17h10.2a3.3 3.3 0 0 0 .5-6.56A5 5 0 0 0 8.26 9.1 3.9 3.9 0 0 0 7 17Z" }]
    ],
    cloud: [
      ["path", { d: "M6.5 18h11a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.84 8.6 4.7 4.7 0 0 0 6.5 18Z" }]
    ],
    fog: [
      ["path", { d: "M6.5 14h11a3.5 3.5 0 0 0 .62-6.95A5.5 5.5 0 0 0 7.7 5.75 4.2 4.2 0 0 0 6.5 14Z" }],
      ["path", { d: "M4 18h16M6 21h12" }]
    ],
    drizzle: [
      ["path", { d: "M6.5 14h11a3.5 3.5 0 0 0 .62-6.95A5.5 5.5 0 0 0 7.7 5.75 4.2 4.2 0 0 0 6.5 14Z" }],
      ["path", { d: "M8 18h.01M12 20h.01M16 18h.01" }]
    ],
    rain: [
      ["path", { d: "M6.5 13h11a3.5 3.5 0 0 0 .62-6.95A5.5 5.5 0 0 0 7.7 4.75 4.2 4.2 0 0 0 6.5 13Z" }],
      ["path", { d: "M8 17l-1 3M13 17l-1 3M18 17l-1 3" }]
    ],
    snow: [
      ["path", { d: "M6.5 12.5h11a3.5 3.5 0 0 0 .62-6.95A5.5 5.5 0 0 0 7.7 4.25 4.2 4.2 0 0 0 6.5 12.5Z" }],
      ["path", { d: "M8 16v4M6.3 17l3.4 2M9.7 17l-3.4 2M16 16v4M14.3 17l3.4 2M17.7 17l-3.4 2" }]
    ],
    thunderstorm: [
      ["path", { d: "M6.5 13h11a3.5 3.5 0 0 0 .62-6.95A5.5 5.5 0 0 0 7.7 4.75 4.2 4.2 0 0 0 6.5 13Z" }],
      ["path", { d: "m13 15-3 4h3l-2 3 5-5h-3l2-2Z" }]
    ],
    variable: [
      ["circle", { cx: "8", cy: "8", r: "2.7" }],
      ["path", { d: "M8 3v1M3 8h1M4.5 4.5l.7.7M11.5 4.5l-.7.7" }],
      ["path", { d: "M7 18h10.2a3.3 3.3 0 0 0 .5-6.56A5 5 0 0 0 8.26 10.1 3.9 3.9 0 0 0 7 18Z" }]
    ]
  };

  function placeLayoutSettingsButton() {
    const button = document.getElementById("layout-settings-button");
    const mobileSlot = document.getElementById("mobile-layout-settings-slot");
    const desktopSlot = document.getElementById("desktop-layout-settings-slot");
    const target = media.matches ? mobileSlot : desktopSlot;

    if (!button || !target || button.parentElement === target) return;
    target.append(button);
    mobileSlot?.setAttribute("aria-hidden", media.matches ? "false" : "true");
  }

  function iconKeyFromCondition(value) {
    const text = String(value || "").trim().toLocaleLowerCase();
    if (!text || text === "—") return null;
    if (text.includes("zivatar") || text.includes("thunderstorm")) return "thunderstorm";
    if (text.includes("havaz") || text.includes("snow")) return "snow";
    if (text.includes("szitál") || text.includes("drizzle")) return "drizzle";
    if (text.includes("eső") || text.includes("rain")) return "rain";
    if (text.includes("köd") || text.includes("fog")) return "fog";
    if (text.includes("borult") || text.includes("overcast")) return "cloud";
    if (text.includes("gyengén felhős") || text.includes("partly cloudy")) return "partlyCloudy";
    if (text.includes("derült") || text.includes("clear")) return "clear";
    return "variable";
  }

  function createWeatherIcon(key) {
    const parts = weatherIconParts[key];
    if (!parts) return null;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("weather-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    for (const [tag, attributes] of parts) {
      const element = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
      }
      svg.append(element);
    }

    return svg;
  }

  function addConditionIcon(element) {
    if (!element) return;
    const text = element.textContent?.trim() || "";
    const key = iconKeyFromCondition(text);
    if (!key) return;

    element.classList.add("weather-condition-value");
    element.replaceChildren();
    const icon = createWeatherIcon(key);
    const label = document.createElement("span");
    label.textContent = text;
    if (icon) element.append(icon);
    element.append(label);
  }

  function parseNumbers(value) {
    return [...String(value || "").matchAll(/-?\d+(?:[.,]\d+)?/g)]
      .map((match) => Number(match[0].replace(",", ".")))
      .filter(Number.isFinite);
  }

  function getHourlySuitability(article) {
    const rows = [...article.querySelectorAll(".weather-hour-row")];
    if (rows.length < 4) return "mixed";

    const cloud = parseNumbers(rows[0].textContent)[0] ?? 100;
    const [windSpeed = 100, windGust = 100] = parseNumbers(rows[1].textContent);
    const [precipitationProbability = 100, precipitation = 100] = parseNumbers(rows[2].textContent);
    const dewState = rows[3].dataset.state || "unknown";
    const conditionText = article.querySelector(".weather-hour-heading > span")?.textContent || "";
    const condition = iconKeyFromCondition(conditionText);

    const blockingCondition = ["fog", "drizzle", "rain", "snow", "thunderstorm"].includes(condition);

    if (
      blockingCondition ||
      cloud > 70 ||
      precipitationProbability > 40 ||
      precipitation > 0.1 ||
      windSpeed > 28 ||
      windGust > 45 ||
      dewState === "high"
    ) {
      return "poor";
    }

    if (
      cloud <= 30 &&
      precipitationProbability <= 20 &&
      precipitation <= 0.1 &&
      windSpeed <= 20 &&
      windGust <= 35 &&
      dewState === "low"
    ) {
      return "good";
    }

    return "mixed";
  }

  function suitabilityLabel(state) {
    const english = document.documentElement.lang?.toLowerCase().startsWith("en");
    if (english) {
      return state === "good" ? "Good" : state === "poor" ? "Poor" : "Mixed";
    }
    return state === "good" ? "Jó" : state === "poor" ? "Gyenge" : "Közepes";
  }

  function decorateHourlyCard(article) {
    const condition = article.querySelector(".weather-hour-heading > span:not(.observing-rating)");
    addConditionIcon(condition);

    const state = getHourlySuitability(article);
    article.dataset.observingState = state;

    const heading = article.querySelector(".weather-hour-heading");
    if (!heading) return;

    heading.querySelectorAll(".observing-rating").forEach((element) => element.remove());

    const rating = document.createElement("span");
    rating.className = "observing-rating";
    rating.dataset.state = state;
    rating.textContent = suitabilityLabel(state);
    heading.append(rating);
  }

  function decorateWeather() {
    const weatherCard = document.getElementById("weather-card");
    if (!weatherCard) return;

    const status = document.getElementById("weather-status-badge");
    const overallState = status?.dataset.state;
    if (["good", "mixed", "poor"].includes(overallState)) {
      weatherCard.dataset.observingState = overallState;
    } else {
      delete weatherCard.dataset.observingState;
    }

    addConditionIcon(document.getElementById("weather-condition"));

    weatherCard.querySelectorAll(".weather-hour").forEach((article) => {
      decorateHourlyCard(article);
    });
  }

  let weatherObserver = null;
  let weatherFrame = null;

  function observeWeather() {
    const weatherCard = document.getElementById("weather-card");
    if (!weatherCard) return;

    weatherObserver = new MutationObserver(() => {
      if (weatherFrame !== null) return;
      weatherFrame = window.requestAnimationFrame(() => {
        weatherFrame = null;
        weatherObserver?.disconnect();
        decorateWeather();
        observeWeather();
      });
    });

    weatherObserver.observe(weatherCard, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-state"]
    });
  }

  function init() {
    placeLayoutSettingsButton();
    decorateWeather();
    observeWeather();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", placeLayoutSettingsButton);
  } else {
    media.addListener(placeLayoutSettingsButton);
  }
})();
