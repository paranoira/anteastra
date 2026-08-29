import { runtime } from "../i18n/translations.js";
import { calculateNightSky, createMoonIlluminationPath } from "./astronomy.js";
import * as SunCalc from "suncalc";

const STORAGE_KEY = "timee.location.v1";
const DEFAULT_LOCATION = Object.freeze({
  latitude: 47.29923,
  longitude: 18.57879,
  accuracy: null,
  gpsAltitude: null,
  source: "Kézi",
  name: "MCSE Csillagtanya"
});

const copy = {
  hu: {
    forecast: "12 órás előrejelzés",
    cloudCover: "Felhőzet",
    quality: { good: "Jó", mixed: "Változó", poor: "Gyenge" },
    sky: { day: "nappali ég", night: "éjszakai ég", moon: "Hold a horizont felett", stars: "tiszta éjszakai ég" },
    skyCaption: { moon: "Hold", stars: "Csillagok" },
    defaultLocation: "Csillagtanya",
    myLocation: "Saját helyzet",
    gpsName: "Saját helyzet",
    latitude: "Földrajzi szélesség",
    longitude: "Földrajzi hosszúság",
    apply: "Koordináták alkalmazása",
    chooseLocation: "Helyszín módosítása",
    closeLocation: "Helyválasztó bezárása",
    loading: "Adatok betöltése…",
    loadError: "Az adatok most nem érhetők el.",
    gpsUnsupported: "A helymeghatározás nem támogatott.",
    gpsLoading: "Helyzet meghatározása…",
    gpsError: "A helyzet nem határozható meg. Az iframe engedélyében az allow=\"geolocation\" beállításra is szükség lehet.",
    invalidCoordinates: "Érvénytelen koordináták.",
    moon: "Hold",
    moonrise: "Holdkelte",
    moonset: "Holdnyugta",
    moonDial: "A Hold horizont feletti időszaka 24 órás számlapon",
    noEvent: "—",
    fullSite: "Részletes előrejelzés",
    updated: "Frissítve",
    cloud: "felhő"
  },
  en: {
    forecast: "12-hour forecast",
    cloudCover: "Cloud cover",
    quality: { good: "Good", mixed: "Variable", poor: "Poor" },
    sky: { day: "daylight", night: "night sky", moon: "Moon above the horizon", stars: "clear night sky" },
    skyCaption: { moon: "Moon", stars: "Stars" },
    defaultLocation: "Csillagtanya",
    myLocation: "My location",
    gpsName: "My location",
    latitude: "Latitude",
    longitude: "Longitude",
    apply: "Use coordinates",
    chooseLocation: "Change location",
    closeLocation: "Close location picker",
    loading: "Loading data…",
    loadError: "Data is currently unavailable.",
    gpsUnsupported: "Geolocation is not supported.",
    gpsLoading: "Finding location…",
    gpsError: "Location is unavailable. The embedding iframe may also need allow=\"geolocation\".",
    invalidCoordinates: "Invalid coordinates.",
    moon: "Moon",
    moonrise: "Moonrise",
    moonset: "Moonset",
    moonDial: "Moon-above-horizon period on a 24-hour dial",
    noEvent: "—",
    fullSite: "Detailed forecast",
    updated: "Updated",
    cloud: "cloud"
  }
};

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
  cloud: [["path", { d: "M6.5 18h11a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.84 8.6 4.7 4.7 0 0 0 6.5 18Z" }]],
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
  ]
};

const state = {
  locale: "hu",
  location: null,
  timeZone: null,
  requestId: 0,
  gpsRequestId: 0,
  abortController: null
};

const ui = {};
const SVG_NS = "http://www.w3.org/2000/svg";

export function initWidget() {
  state.locale = getWidgetLocale();
  document.documentElement.lang = state.locale;
  mapUi();
  applyCopy();
  bindEvents();
  loadLocation(getSavedLocation() || { ...DEFAULT_LOCATION });
}

function getWidgetLocale() {
  const requested = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
  if (requested === "en" || requested === "hu") return requested;
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "hu";
}

function mapUi() {
  [
    "widget-date", "location-toggle", "location-controls", "location-name",
    "default-location-button", "gps-location-button", "coordinate-form", "latitude-input",
    "longitude-input", "latitude-label", "longitude-label", "coordinate-submit", "widget-status",
    "forecast-title", "forecast-list", "cloud-key-label", "quality-good-label",
    "quality-mixed-label", "quality-poor-label", "moon-visual", "moon-lit-path", "moon-title",
    "moon-phase", "moon-illumination", "moonrise-label", "moonset-label", "moonrise-time",
    "moonset-time", "moon-horizon-dial", "moon-above-circle", "moon-above-arc",
    "moonrise-marker", "moonset-marker", "full-site-link"
  ].forEach((id) => {
    ui[toCamel(id)] = document.getElementById(id);
  });
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function applyCopy() {
  const text = copy[state.locale];
  ui.locationToggle.setAttribute("aria-label", text.chooseLocation);
  ui.defaultLocationButton.textContent = text.defaultLocation;
  ui.gpsLocationButton.textContent = text.myLocation;
  ui.latitudeLabel.textContent = text.latitude;
  ui.longitudeLabel.textContent = text.longitude;
  ui.latitudeInput.placeholder = "47.29923";
  ui.latitudeInput.setAttribute("aria-label", text.latitude);
  ui.longitudeInput.placeholder = "18.57879";
  ui.longitudeInput.setAttribute("aria-label", text.longitude);
  ui.coordinateSubmit.setAttribute("aria-label", text.apply);
  ui.forecastTitle.textContent = text.forecast;
  ui.cloudKeyLabel.textContent = text.cloudCover;
  ui.qualityGoodLabel.textContent = text.quality.good;
  ui.qualityMixedLabel.textContent = text.quality.mixed;
  ui.qualityPoorLabel.textContent = text.quality.poor;
  ui.moonTitle.textContent = text.moon;
  ui.moonriseLabel.textContent = text.moonrise;
  ui.moonsetLabel.textContent = text.moonset;
  ui.fullSiteLink.textContent = `${text.fullSite} →`;
  ui.fullSiteLink.href = state.locale === "en" ? "/en" : "/";
}

function bindEvents() {
  ui.locationToggle.addEventListener("click", toggleLocationControls);
  ui.defaultLocationButton.addEventListener("click", () => loadLocation({ ...DEFAULT_LOCATION }));
  ui.gpsLocationButton.addEventListener("click", requestGpsLocation);
  ui.coordinateForm.addEventListener("submit", applyCoordinates);
}

function toggleLocationControls() {
  const opening = ui.locationControls.hidden;
  ui.locationControls.hidden = !opening;
  ui.locationToggle.setAttribute("aria-expanded", String(opening));
  ui.locationToggle.setAttribute("aria-label", opening ? copy[state.locale].closeLocation : copy[state.locale].chooseLocation);
  if (opening && state.location) {
    ui.latitudeInput.value = state.location.latitude.toFixed(5);
    ui.longitudeInput.value = state.location.longitude.toFixed(5);
  }
  reportHeight();
}

function closeLocationControls() {
  ui.locationControls.hidden = true;
  ui.locationToggle.setAttribute("aria-expanded", "false");
  ui.locationToggle.setAttribute("aria-label", copy[state.locale].chooseLocation);
  reportHeight();
}

function getSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isValidLocation(saved?.location) ? { ...saved.location } : null;
  } catch {
    return null;
  }
}

function persistLocation(location, timeZone, elevation) {
  try {
    const storedLocation = { ...location, elevation, elevationSource: "Open-Meteo" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      location: storedLocation,
      timezone: { name: timeZone, elevation, fallback: false }
    }));
  } catch {
    // Third-party iframe storage may be unavailable; the widget still works.
  }
}

function isValidLocation(location) {
  return Number.isFinite(Number(location?.latitude)) &&
    Number(location.latitude) >= -90 && Number(location.latitude) <= 90 &&
    Number.isFinite(Number(location?.longitude)) &&
    Number(location.longitude) >= -180 && Number(location.longitude) <= 180;
}

function applyCoordinates(event) {
  event.preventDefault();
  const latitude = parseCoordinate(ui.latitudeInput.value);
  const longitude = parseCoordinate(ui.longitudeInput.value);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    setStatus(copy[state.locale].invalidCoordinates, "error");
    return;
  }
  loadLocation({ latitude, longitude, accuracy: null, gpsAltitude: null, source: "Kézi" });
}

function parseCoordinate(value) {
  return Number(String(value).trim().replace(",", "."));
}

function requestGpsLocation() {
  if (!navigator.geolocation) {
    setStatus(copy[state.locale].gpsUnsupported, "error");
    return;
  }
  setStatus(copy[state.locale].gpsLoading, "loading");
  ui.gpsLocationButton.disabled = true;
  const gpsRequestId = ++state.gpsRequestId;
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      ui.gpsLocationButton.disabled = false;
      if (gpsRequestId !== state.gpsRequestId) return;
      loadLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        gpsAltitude: Number.isFinite(coords.altitude) ? coords.altitude : null,
        source: "GPS",
        name: copy[state.locale].gpsName
      });
    },
    () => {
      ui.gpsLocationButton.disabled = false;
      if (gpsRequestId !== state.gpsRequestId) return;
      setStatus(copy[state.locale].gpsError, "error");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
  );
}

async function loadLocation(location) {
  if (!isValidLocation(location)) return;
  // Any explicit location choice invalidates an older, non-abortable GPS callback.
  state.gpsRequestId += 1;
  const requestId = ++state.requestId;
  state.abortController?.abort();
  state.abortController = new AbortController();
  state.location = {
    ...location,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude)
  };
  state.timeZone = null;
  renderLocation();
  renderLoading();
  setStatus(copy[state.locale].loading, "loading");
  closeLocationControls();

  try {
    const snapshot = await fetchSnapshot(state.location, state.abortController.signal);
    if (requestId !== state.requestId) return;
    state.timeZone = snapshot.timeZone;
    renderDate();
    renderForecast(snapshot.hours);
    renderMoon(snapshot.elevation);
    persistLocation(state.location, snapshot.timeZone, snapshot.elevation);
    setStatus("");
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== state.requestId) return;
    state.timeZone = null;
    renderUnavailable();
    setStatus(copy[state.locale].loadError, "error");
    console.error(error);
  } finally {
    reportHeight();
  }
}

async function fetchSnapshot(location, signal) {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(6),
    longitude: location.longitude.toFixed(6),
    current: "weather_code,cloud_cover",
    hourly: [
      "temperature_2m", "relative_humidity_2m", "dew_point_2m",
      "precipitation_probability", "precipitation", "weather_code", "cloud_cover",
      "wind_speed_10m", "wind_gusts_10m"
    ].join(","),
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "2",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);
  const data = await response.json();
  if (!data.timezone) throw new Error("Missing time zone");

  const times = Array.isArray(data.hourly?.time) ? data.hourly.time : [];
  const currentTime = Number(data.current?.time);
  let startIndex = Number.isFinite(currentTime)
    ? times.findIndex((time) => Number(time) >= currentTime)
    : 0;
  if (startIndex < 0) startIndex = 0;
  const hours = times.slice(startIndex, startIndex + 12).map((time, localIndex) => {
    const index = startIndex + localIndex;
    return {
      time: new Date(Number(time) * 1000),
      temperature: numberOrNull(data.hourly?.temperature_2m?.[index]),
      humidity: numberOrNull(data.hourly?.relative_humidity_2m?.[index]),
      dewPoint: numberOrNull(data.hourly?.dew_point_2m?.[index]),
      precipitationProbability: numberOrNull(data.hourly?.precipitation_probability?.[index]),
      precipitation: numberOrNull(data.hourly?.precipitation?.[index]),
      weatherCode: numberOrNull(data.hourly?.weather_code?.[index]),
      cloudCover: numberOrNull(data.hourly?.cloud_cover?.[index]),
      windSpeed: numberOrNull(data.hourly?.wind_speed_10m?.[index]),
      windGusts: numberOrNull(data.hourly?.wind_gusts_10m?.[index])
    };
  });

  return {
    timeZone: data.timezone,
    elevation: Number.isFinite(Number(data.elevation)) ? Number(data.elevation) : 0,
    hours
  };
}

function renderLocation() {
  const location = state.location;
  const name = typeof location.name === "string" ? location.name.trim() : "";
  const gpsName = location.source === "GPS" ? copy[state.locale].gpsName : "";
  ui.locationName.textContent = name || gpsName || formatCoordinates(location);
}

function renderDate() {
  if (!state.timeZone) {
    ui.widgetDate.textContent = "—";
    return;
  }
  ui.widgetDate.textContent = new Intl.DateTimeFormat(runtime[state.locale].dateLocale, {
    timeZone: state.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function renderLoading() {
  ui.widgetDate.textContent = "—";
  ui.forecastList.setAttribute("aria-busy", "true");
  ui.forecastList.replaceChildren(...Array.from({ length: 6 }, createForecastPlaceholder));
  ui.moonPhase.textContent = "—";
  ui.moonIllumination.textContent = "—";
  ui.moonriseTime.textContent = "—";
  ui.moonsetTime.textContent = "—";
  ui.moonLitPath.setAttribute("d", "");
  clearMoonDial();
}

function createForecastPlaceholder() {
  const item = document.createElement("li");
  item.className = "forecast-item forecast-placeholder";
  item.setAttribute("aria-hidden", "true");
  item.append(document.createElement("span"), document.createElement("i"), document.createElement("b"));
  return item;
}

function renderUnavailable() {
  ui.widgetDate.textContent = "—";
  ui.forecastList.setAttribute("aria-busy", "false");
  ui.forecastList.replaceChildren();
  ui.moonPhase.textContent = "—";
  ui.moonIllumination.textContent = "—";
  ui.moonriseTime.textContent = "—";
  ui.moonsetTime.textContent = "—";
  ui.moonLitPath.setAttribute("d", "");
  clearMoonDial();
}

function renderForecast(hours) {
  const sampledHours = hours.filter((_, index) => index % 2 === 0).slice(0, 6);
  const items = sampledHours.map((hour) => {
    const condition = getWeatherCondition(hour.weatherCode);
    const quality = getObservingQuality(hour, condition.icon);
    const sky = getSkyContext(hour.time);
    const hasCloud = (hour.cloudCover ?? 0) > 0;
    const cloud = Number.isFinite(hour.cloudCover) ? `${Math.round(hour.cloudCover)}%` : "—";
    const clearNightContext = !hasCloud && sky.type !== "day" ? copy[state.locale].sky[sky.type] : null;
    const item = document.createElement("li");
    item.className = "forecast-item";
    item.dataset.observingState = quality;
    item.setAttribute(
      "aria-label",
      [
        formatHour(hour.time),
        condition.text,
        `${cloud} ${copy[state.locale].cloud}`,
        clearNightContext,
        copy[state.locale].quality[quality]
      ].filter(Boolean).join(", ")
    );

    const time = document.createElement("time");
    time.className = "forecast-time";
    time.dateTime = hour.time.toISOString();
    time.textContent = formatHour(hour.time);
    const qualityBadge = document.createElement("span");
    qualityBadge.className = "quality-badge";
    qualityBadge.dataset.state = quality;
    qualityBadge.textContent = quality === "good" ? "✓" : quality === "poor" ? "!" : "~";
    qualityBadge.setAttribute("aria-hidden", "true");
    const weatherIcon = createWeatherIcon(condition.icon);
    const skyDisplay = document.createElement("span");
    skyDisplay.className = "forecast-sky";

    // Weather keeps its own permanent icon. This secondary slot shows either
    // cloud cover, or a night-sky context only when cloud cover is exactly zero.
    if (hasCloud) {
      skyDisplay.dataset.cloudy = "true";
      const cloudGauge = document.createElement("span");
      cloudGauge.className = "forecast-cloud-gauge";
      cloudGauge.setAttribute("aria-hidden", "true");
      const markerKey = ["fog", "drizzle", "rain", "snow", "thunderstorm"].includes(condition.icon)
        ? condition.icon
        : "cloud";
      const cloudMarker = createCloudMarker(markerKey);
      // The 44 px gauge contains a 20 px marker, leaving 24 px of travel.
      cloudMarker.style.bottom = `${(clamp(hour.cloudCover, 0, 100) / 100) * 24}px`;
      cloudGauge.append(cloudMarker);
      skyDisplay.append(cloudGauge);
    } else if (sky.type !== "day") {
      skyDisplay.dataset.sky = sky.type;
      skyDisplay.append(createCelestialIcon(sky));
      const caption = document.createElement("span");
      caption.className = "celestial-caption";
      caption.textContent = copy[state.locale].skyCaption[sky.type];
      skyDisplay.append(caption);
    }
    const cloudValue = document.createElement("span");
    cloudValue.className = "forecast-cloud";
    cloudValue.textContent = cloud;
    item.append(qualityBadge, time, weatherIcon, skyDisplay, cloudValue);
    return item;
  });
  ui.forecastList.replaceChildren(...items);
  ui.forecastList.setAttribute("aria-busy", "false");
}

function getSkyContext(date) {
  const sun = SunCalc.getPosition(date, state.location.latitude, state.location.longitude);
  // Civil twilight still reads as daylight in this compact two-state display;
  // stars appear once the Sun is more than six degrees below the horizon.
  if (sun.altitude >= -6) return { type: "day" };

  const moonPosition = SunCalc.getMoonPosition(date, state.location.latitude, state.location.longitude);
  if (moonPosition.altitude >= 0) {
    const illumination = SunCalc.getMoonIllumination(date);
    return {
      type: "moon",
      fraction: illumination.fraction,
      waxing: illumination.waxing,
      rotation: illumination.angle - moonPosition.parallacticAngle
    };
  }
  return { type: "stars" };
}

function createCelestialIcon(sky) {
  if (sky.type === "day") {
    const sun = createWeatherIcon("clear");
    sun.classList.add("celestial-icon", "celestial-sun");
    return sun;
  }

  if (sky.type === "moon") {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("celestial-icon", "celestial-moon");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    const shadow = createSvgElement("circle", { class: "moon-shadow", cx: "50", cy: "50", r: "45" });
    const lit = createSvgElement("path", {
      class: "moon-lit",
      d: createMoonIlluminationPath(sky.fraction, sky.waxing, 24),
      transform: `rotate(${sky.rotation.toFixed(2)} 50 50)`
    });
    const outline = createSvgElement("circle", { class: "moon-outline", cx: "50", cy: "50", r: "45" });
    const craters = [
      createSvgElement("circle", { class: "moon-crater", cx: "35", cy: "35", r: "8" }),
      createSvgElement("circle", { class: "moon-crater", cx: "65", cy: "55", r: "6" }),
      createSvgElement("circle", { class: "moon-crater", cx: "42", cy: "72", r: "4" })
    ];
    svg.append(shadow, lit, ...craters, outline);
    return svg;
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("celestial-icon", "celestial-stars");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.append(
    createSvgElement("path", { d: "m10 3 1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5Z" }),
    createSvgElement("path", { d: "m22 12 1.2 3.8L27 17l-3.8 1.2L22 22l-1.2-3.8L17 17l3.8-1.2Z" }),
    createSvgElement("path", { d: "m11 20 .9 2.6 2.6.9-2.6.9L11 27l-.9-2.6-2.6-.9 2.6-.9Z" })
  );
  return svg;
}

function getObservingQuality(hour, condition) {
  // Keep these field-oriented thresholds synchronized with the main page's
  // hourly enhancement. The rating is a forecast heuristic, not a measurement.
  const dewState = getDewState(hour.temperature, hour.dewPoint, hour.humidity);
  const blockingCondition = ["fog", "drizzle", "rain", "snow", "thunderstorm"].includes(condition);

  if (
    blockingCondition ||
    (hour.cloudCover ?? 100) > 70 ||
    (hour.precipitationProbability ?? 100) > 40 ||
    (hour.precipitation ?? 100) > 0.1 ||
    (hour.windSpeed ?? 100) > 28 ||
    (hour.windGusts ?? 100) > 45 ||
    dewState === "high"
  ) {
    return "poor";
  }

  if (
    (hour.cloudCover ?? 100) <= 30 &&
    (hour.precipitationProbability ?? 100) <= 20 &&
    (hour.precipitation ?? 100) <= 0.1 &&
    (hour.windSpeed ?? 100) <= 20 &&
    (hour.windGusts ?? 100) <= 35 &&
    dewState === "low"
  ) {
    return "good";
  }

  return "mixed";
}

function getDewState(temperature, dewPoint, humidity) {
  if (!Number.isFinite(temperature) || !Number.isFinite(dewPoint)) return "unknown";
  const gap = Math.max(0, temperature - dewPoint);
  const humid = Number.isFinite(humidity) ? humidity : 0;
  if (gap <= 1.5 || humid >= 92) return "high";
  if (gap <= 3.5 || humid >= 82) return "medium";
  return "low";
}

function renderMoon(elevation) {
  let astronomy;
  try {
    astronomy = calculateNightSky({
      latitude: state.location.latitude,
      longitude: state.location.longitude,
      elevation,
      timeZone: state.timeZone
    });
  } catch (error) {
    console.error(error);
    astronomy = null;
  }
  if (!astronomy?.moon) return;

  const moon = astronomy.moon;
  const phaseName = runtime[state.locale].astronomy.phaseNames[moon.phaseIndex] || "—";
  const illumination = Math.round(moon.fraction * 100);
  ui.moonPhase.textContent = phaseName;
  ui.moonIllumination.textContent = `${illumination}%`;
  ui.moonriseTime.textContent = formatEventTime(moon.rise);
  ui.moonsetTime.textContent = formatEventTime(moon.set);
  renderMoonDial(moon);
  ui.moonLitPath.setAttribute("d", createMoonIlluminationPath(moon.fraction, moon.waxing, 36));
  ui.moonLitPath.setAttribute("transform", `rotate(${moon.rotation.toFixed(2)} 50 50)`);
  ui.moonVisual.setAttribute("aria-label", runtime[state.locale].astronomy.moonAria(phaseName, illumination));
}

function clearMoonDial() {
  ui.moonAboveArc?.setAttribute("d", "");
  if (ui.moonAboveCircle) ui.moonAboveCircle.hidden = true;
  if (ui.moonriseMarker) ui.moonriseMarker.hidden = true;
  if (ui.moonsetMarker) ui.moonsetMarker.hidden = true;
  ui.moonHorizonDial?.removeAttribute("aria-label");
}

function renderMoonDial(moon) {
  clearMoonDial();
  const riseMinutes = getLocalClockMinutes(moon.rise);
  const setMinutes = getLocalClockMinutes(moon.set);
  const startMinutes = getLocalClockMinutes(moon.horizonStart);
  const endMinutes = getLocalClockMinutes(moon.horizonEnd);

  if (Number.isFinite(riseMinutes) && Number.isFinite(setMinutes)) {
    ui.moonAboveArc.setAttribute("d", describeClockArc(riseMinutes, setMinutes));
  } else if (!moon.rise && !moon.set && moon.horizonStartsAbove) {
    ui.moonAboveCircle.hidden = false;
  } else if (Number.isFinite(riseMinutes) && Number.isFinite(endMinutes)) {
    ui.moonAboveArc.setAttribute("d", describeClockArc(riseMinutes, endMinutes));
  } else if (Number.isFinite(startMinutes) && Number.isFinite(setMinutes)) {
    ui.moonAboveArc.setAttribute("d", describeClockArc(startMinutes, setMinutes));
  }

  positionDialMarker(ui.moonriseMarker, riseMinutes);
  positionDialMarker(ui.moonsetMarker, setMinutes);
  ui.moonHorizonDial.setAttribute(
    "aria-label",
    `${copy[state.locale].moonDial}. ${copy[state.locale].moonrise}: ${formatEventTime(moon.rise)}. ${copy[state.locale].moonset}: ${formatEventTime(moon.set)}.`
  );
}

function getLocalClockMinutes(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !state.timeZone) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: state.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function describeClockArc(startMinutes, endMinutes) {
  const duration = (endMinutes - startMinutes + 1440) % 1440;
  if (duration < 0.5) return "";
  const start = clockPoint(startMinutes);
  const end = clockPoint(endMinutes);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 36 36 0 ${duration > 720 ? 1 : 0} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function positionDialMarker(marker, minutes) {
  if (!marker || !Number.isFinite(minutes)) return;
  const point = clockPoint(minutes);
  marker.setAttribute("cx", point.x.toFixed(2));
  marker.setAttribute("cy", point.y.toFixed(2));
  marker.hidden = false;
}

function clockPoint(minutes) {
  const angle = (minutes / 1440) * Math.PI * 2 - Math.PI / 2;
  return { x: 60 + 36 * Math.cos(angle), y: 60 + 36 * Math.sin(angle) };
}

function getWeatherCondition(code) {
  const weather = runtime[state.locale].weather;
  if (code === 0) return { icon: "clear", text: weather.clear };
  if ([1, 2].includes(code)) return { icon: "partlyCloudy", text: weather.partlyCloudy };
  if (code === 3) return { icon: "cloud", text: weather.overcast };
  if ([45, 48].includes(code)) return { icon: "fog", text: weather.fog };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "drizzle", text: weather.drizzle };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "rain", text: weather.rain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "snow", text: weather.snow };
  if ([95, 96, 99].includes(code)) return { icon: "thunderstorm", text: weather.thunderstorm };
  return { icon: "cloud", text: weather.variable };
}

function createWeatherIcon(key) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("weather-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attributes] of weatherIconParts[key] || weatherIconParts.cloud) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    svg.append(element);
  }
  return svg;
}

function createCloudMarker(key) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("cloud-gauge-marker");
  svg.setAttribute("viewBox", "0 0 24 24");
  for (const [tag, attributes] of weatherIconParts[key] || weatherIconParts.cloud) {
    svg.append(createSvgElement(tag, attributes));
  }
  return svg;
}

function createSvgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function formatHour(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !state.timeZone) return "—";
  return new Intl.DateTimeFormat(runtime[state.locale].dateLocale, {
    timeZone: state.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatEventTime(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || !state.timeZone) {
    return copy[state.locale].noEvent;
  }
  return new Intl.DateTimeFormat(runtime[state.locale].dateLocale, {
    timeZone: state.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatCoordinates(location) {
  const latitude = `${Math.abs(location.latitude).toFixed(3)}°${location.latitude >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(location.longitude).toFixed(3)}°${location.longitude >= 0 ? "E" : "W"}`;
  return `${latitude}, ${longitude}`;
}

function setStatus(message, stateName = "") {
  ui.widgetStatus.textContent = message;
  if (stateName) ui.widgetStatus.dataset.state = stateName;
  else delete ui.widgetStatus.dataset.state;
  reportHeight();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function reportHeight() {
  requestAnimationFrame(() => {
    const widgetHeight = Math.ceil(document.querySelector(".widget")?.getBoundingClientRect().height || 0) + 2;
    window.parent?.postMessage({ type: "anteastra:widget-height", height: widgetHeight }, "*");
  });
}
