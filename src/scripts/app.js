const STORAGE_KEY = "timee.location.v1";
const THEME_KEY = "timee.theme.v1";

const state = {
  location: null,
  timezone: null,
  weather: null,
  tickId: null,
  locationRequestId: 0,
  locationAbortController: null
};

const ui = {};

export function initApp() {
  mapUi();
  bindEvents();
  restoreTheme();
  startClock();
  restoreLocation();
}

function mapUi() {
  [
    "header-utc", "red-mode-button", "gps-button", "toggle-manual-button",
    "manual-location", "latitude-input", "longitude-input", "status-message", "location-card-summary",
    "location-source", "decimal-coordinates", "dms-coordinates", "accuracy-value",
    "elevation-value", "copy-decimal-button", "copy-dms-button", "local-clock",
    "local-date", "utc-clock", "utc-date", "timezone-name", "utc-offset",
    "timezone-abbreviation", "dst-status", "copy-setup-button",
    "weather-card", "weather-status-badge", "weather-summary", "weather-condition",
    "weather-cloud", "weather-cloud-layers", "weather-temperature", "weather-wind",
    "weather-wind-detail", "weather-humidity", "weather-dewpoint", "weather-dew-risk",
    "weather-hourly", "weather-updated", "refresh-weather-button"
  ].forEach((id) => {
    ui[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  ui.redModeButton.addEventListener("click", toggleTheme);
  ui.gpsButton.addEventListener("click", requestGpsLocation);
  ui.toggleManualButton.addEventListener("click", toggleManualForm);
  ui.manualLocation.addEventListener("submit", applyManualLocation);
  ui.refreshWeatherButton.addEventListener("click", refreshWeather);
  ui.copyDecimalButton.addEventListener("click", () => copyValue(getDecimalText(), "A decimális koordinátát kimásoltam."));
  ui.copyDmsButton.addEventListener("click", () => copyValue(getDmsText(), "A DMS-koordinátát kimásoltam."));
  ui.copySetupButton.addEventListener("click", () => copyValue(getSetupText(), "A teljes távcső-beállítást kimásoltam."));
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "red" ? "red" : "default");
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "red" ? "red" : "default";
  applyTheme(current === "red" ? "default" : "red");
}

function applyTheme(theme) {
  if (theme === "red") {
    document.documentElement.dataset.theme = "red";
    ui.redModeButton.setAttribute("aria-pressed", "true");
    localStorage.setItem(THEME_KEY, "red");
  } else {
    delete document.documentElement.dataset.theme;
    ui.redModeButton.setAttribute("aria-pressed", "false");
    localStorage.setItem(THEME_KEY, "default");
  }
}

function toggleManualForm() {
  const willOpen = ui.manualLocation.hidden;
  ui.manualLocation.hidden = !willOpen;
  ui.toggleManualButton.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) ui.latitudeInput.focus();
}

async function requestGpsLocation() {
  if (!navigator.geolocation) {
    setStatus("Ez a böngésző nem támogatja a helymeghatározást.", "error");
    return;
  }

  setStatus("Helyzet meghatározása…", "loading");
  ui.gpsButton.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      await setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        gpsAltitude: Number.isFinite(coords.altitude) ? coords.altitude : null,
        source: "GPS"
      });
      ui.gpsButton.disabled = false;
    },
    (error) => {
      ui.gpsButton.disabled = false;
      const messages = {
        1: "A helyhozzáférést nem engedélyezted. Add meg kézzel a koordinátát, vagy engedélyezd a böngésző beállításaiban.",
        2: "A készülék most nem tudta meghatározni a helyzetet.",
        3: "A helymeghatározás túl sokáig tartott. Próbáld újra szabad ég alatt."
      };
      setStatus(messages[error.code] || "Ismeretlen helymeghatározási hiba történt.", "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    }
  );
}

async function applyManualLocation(event) {
  event.preventDefault();
  const latitude = Number(ui.latitudeInput.value.replace?.(",", ".") ?? ui.latitudeInput.value);
  const longitude = Number(ui.longitudeInput.value.replace?.(",", ".") ?? ui.longitudeInput.value);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    setStatus("A szélességnek −90 és +90 fok közé kell esnie.", "error");
    return;
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    setStatus("A hosszúságnak −180 és +180 fok közé kell esnie.", "error");
    return;
  }

  await setLocation({ latitude, longitude, accuracy: null, gpsAltitude: null, source: "Kézi" });
  ui.manualLocation.hidden = true;
  ui.toggleManualButton.setAttribute("aria-expanded", "false");
}

async function setLocation(location, options = {}) {
  const requestId = ++state.locationRequestId;
  state.locationAbortController?.abort();
  state.locationAbortController = new AbortController();

  state.location = location;
  state.timezone = null;
  state.weather = null;
  renderLocation();
  resetLocationTimeUi();
  resetWeatherUi("Az előrejelzés betöltése…", "loading");
  setStatus(options.restored ? "A mentett helyszín adatainak frissítése…" : "Időzóna, magasság és időjárás lekérése…", "loading");

  try {
    const locationData = await fetchLocationData(
      location.latitude,
      location.longitude,
      state.locationAbortController.signal
    );

    if (requestId !== state.locationRequestId) return;

    state.timezone = locationData.timezone;
    state.weather = locationData.weather;
    state.location.elevation = Number.isFinite(location.gpsAltitude)
      ? location.gpsAltitude
      : locationData.timezone.elevation;
    state.location.elevationSource = Number.isFinite(location.gpsAltitude) ? "GPS" : "Open-Meteo";

    persistLocation();
    renderAll();
    setStatus("A helyszín, a helyi idő és az előrejelzés frissült.", "success");
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== state.locationRequestId) return;

    state.timezone = null;
    state.weather = null;
    state.location.elevation = Number.isFinite(location.gpsAltitude) ? location.gpsAltitude : null;
    state.location.elevationSource = Number.isFinite(location.gpsAltitude) ? "GPS" : null;
    renderLocation();
    resetLocationTimeUi("Az időzóna nem tölthető be");
    resetWeatherUi("Az előrejelzés most nem érhető el.", "error");
    setStatus("Az adatlekérés nem sikerült. Próbáld újra; nem mutatunk helyette régi vagy téves adatot.", "error");
    console.error(error);
  }
}

async function refreshWeather() {
  if (!state.location) return;
  await setLocation({ ...state.location }, { restored: true });
}

async function fetchLocationData(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "dew_point_2m",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m"
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "dew_point_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m"
    ].join(","),
    timezone: "auto",
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

  if (!response.ok) throw new Error(`Open-Meteo hiba: ${response.status}`);
  const data = await response.json();
  if (!data.timezone) throw new Error("Hiányzó időzónaadat.");

  return {
    timezone: {
      name: data.timezone,
      abbreviation: data.timezone_abbreviation || getTimezoneAbbreviation(new Date(), data.timezone),
      offsetSeconds: Number(data.utc_offset_seconds),
      elevation: Number.isFinite(Number(data.elevation)) ? Number(data.elevation) : null,
      dst: getDstInfo(new Date(), data.timezone),
      fallback: false
    },
    weather: normalizeWeather(data)
  };
}

function normalizeWeather(data) {
  const hourly = data.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const currentHour = `${String(data.current?.time || "").slice(0, 13)}:00`;
  let startIndex = times.findIndex((time) => time >= currentHour);
  if (startIndex < 0) startIndex = 0;

  const hours = times.slice(startIndex, startIndex + 12).map((time, localIndex) => {
    const index = startIndex + localIndex;
    return {
      time,
      temperature: numberOrNull(hourly.temperature_2m?.[index]),
      humidity: numberOrNull(hourly.relative_humidity_2m?.[index]),
      dewPoint: numberOrNull(hourly.dew_point_2m?.[index]),
      precipitationProbability: numberOrNull(hourly.precipitation_probability?.[index]),
      precipitation: numberOrNull(hourly.precipitation?.[index]),
      weatherCode: numberOrNull(hourly.weather_code?.[index]),
      cloudCover: numberOrNull(hourly.cloud_cover?.[index]),
      cloudLow: numberOrNull(hourly.cloud_cover_low?.[index]),
      cloudMid: numberOrNull(hourly.cloud_cover_mid?.[index]),
      cloudHigh: numberOrNull(hourly.cloud_cover_high?.[index]),
      windSpeed: numberOrNull(hourly.wind_speed_10m?.[index]),
      windDirection: numberOrNull(hourly.wind_direction_10m?.[index]),
      windGusts: numberOrNull(hourly.wind_gusts_10m?.[index])
    };
  });

  const current = data.current || {};
  const matchingHour = hours[0] || {};

  return {
    fetchedAt: new Date().toISOString(),
    current: {
      time: current.time || matchingHour.time || "",
      temperature: numberOrNull(current.temperature_2m) ?? matchingHour.temperature ?? null,
      humidity: numberOrNull(current.relative_humidity_2m) ?? matchingHour.humidity ?? null,
      dewPoint: numberOrNull(current.dew_point_2m) ?? matchingHour.dewPoint ?? null,
      precipitation: numberOrNull(current.precipitation) ?? matchingHour.precipitation ?? null,
      precipitationProbability: matchingHour.precipitationProbability ?? null,
      weatherCode: numberOrNull(current.weather_code) ?? matchingHour.weatherCode ?? null,
      cloudCover: numberOrNull(current.cloud_cover) ?? matchingHour.cloudCover ?? null,
      cloudLow: matchingHour.cloudLow ?? null,
      cloudMid: matchingHour.cloudMid ?? null,
      cloudHigh: matchingHour.cloudHigh ?? null,
      windSpeed: numberOrNull(current.wind_speed_10m) ?? matchingHour.windSpeed ?? null,
      windDirection: numberOrNull(current.wind_direction_10m) ?? matchingHour.windDirection ?? null,
      windGusts: numberOrNull(current.wind_gusts_10m) ?? matchingHour.windGusts ?? null
    },
    hours
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function persistLocation() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ location: state.location, timezone: state.timezone }));
  } catch (error) {
    console.warn("A helyszín mentése nem sikerült.", error);
  }
}

function restoreLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.location) return;
    setLocation(saved.location, { restored: true });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderAll() {
  renderLocation();
  renderTimezone();
  renderClocks();
  renderWeather();
}

function resetLocationTimeUi(message = "Időzóna lekérése…") {
  ui.localClock.textContent = "--:--:--";
  ui.localDate.textContent = message;
  ui.timezoneName.textContent = "—";
  ui.utcOffset.textContent = "—";
  ui.timezoneAbbreviation.textContent = "—";
  ui.dstStatus.textContent = "—";
  ui.copySetupButton.disabled = true;
}

function resetWeatherUi(message = "Válassz helyszínt az előrejelzéshez.", stateName = "idle") {
  ui.weatherStatusBadge.textContent = stateName === "loading" ? "Betöltés" : stateName === "error" ? "Hiba" : "Nincs adat";
  ui.weatherStatusBadge.dataset.state = stateName;
  ui.weatherSummary.textContent = message;
  ui.weatherCondition.textContent = "—";
  ui.weatherCloud.textContent = "—";
  ui.weatherCloudLayers.textContent = "Alacsony / közép / magas: —";
  ui.weatherTemperature.textContent = "—";
  ui.weatherWind.textContent = "—";
  ui.weatherWindDetail.textContent = "Széllökés: —";
  ui.weatherHumidity.textContent = "—";
  ui.weatherDewpoint.textContent = "Harmatpont: —";
  ui.weatherDewRisk.textContent = "—";
  ui.weatherHourly.replaceChildren(createEmptyHourlyMessage(message));
  ui.weatherUpdated.textContent = "—";
  ui.refreshWeatherButton.disabled = !state.location || stateName === "loading";
}

function createEmptyHourlyMessage(message) {
  const paragraph = document.createElement("p");
  paragraph.className = "weather-empty";
  paragraph.textContent = message;
  return paragraph;
}

function renderLocation() {
  const location = state.location;
  if (!location) return;

  ui.locationSource.textContent = location.source === "GPS" ? "GPS-helyzet" : "Kézi helyszín";
  if (ui.locationCardSummary) {
    ui.locationCardSummary.textContent = getShortLocationText(location);
  }
  ui.decimalCoordinates.textContent = getDecimalText();
  ui.dmsCoordinates.textContent = getDmsText();
  ui.accuracyValue.textContent = Number.isFinite(location.accuracy)
    ? `±${Math.round(location.accuracy)} m`
    : "Kézi koordináta";

  if (Number.isFinite(location.elevation)) {
    ui.elevationValue.textContent = `${Math.round(location.elevation)} m (${location.elevationSource})`;
  } else if (Number.isFinite(location.gpsAltitude)) {
    ui.elevationValue.textContent = `${Math.round(location.gpsAltitude)} m (GPS)`;
  } else {
    ui.elevationValue.textContent = "—";
  }

  ui.copyDecimalButton.disabled = false;
  ui.copyDmsButton.disabled = false;
  ui.refreshWeatherButton.disabled = false;
}

function renderTimezone() {
  const timezone = state.timezone;
  if (!timezone) return;
  const now = new Date();
  const offsetSeconds = getOffsetMinutes(now, timezone.name) * 60;
  const dst = getDstInfo(now, timezone.name);

  ui.timezoneName.textContent = timezone.name;
  ui.utcOffset.textContent = formatOffset(offsetSeconds);
  ui.timezoneAbbreviation.textContent = getTimezoneAbbreviation(now, timezone.name);
  ui.dstStatus.textContent = dst.observes
    ? (dst.active ? "Aktív" : "Nem aktív")
    : "Nincs óraátállítás";
  ui.copySetupButton.disabled = false;
}

function renderWeather() {
  const weather = state.weather;
  if (!weather?.current) {
    resetWeatherUi();
    return;
  }

  const current = weather.current;
  const summary = getWeatherSummary(weather.hours);
  const dew = getDewRisk(current.temperature, current.dewPoint, current.humidity);

  ui.weatherStatusBadge.textContent = summary.label;
  ui.weatherStatusBadge.dataset.state = summary.state;
  ui.weatherSummary.textContent = summary.text;
  ui.weatherCondition.textContent = weatherCodeText(current.weatherCode);
  ui.weatherCloud.textContent = formatPercent(current.cloudCover);
  ui.weatherCloudLayers.textContent = `Alacsony ${formatPercent(current.cloudLow)} · közép ${formatPercent(current.cloudMid)} · magas ${formatPercent(current.cloudHigh)}`;
  ui.weatherTemperature.textContent = formatTemperature(current.temperature);
  ui.weatherWind.textContent = `${formatSpeed(current.windSpeed)} ${windDirectionText(current.windDirection)}`.trim();
  ui.weatherWindDetail.textContent = `Széllökés: ${formatSpeed(current.windGusts)}`;
  ui.weatherHumidity.textContent = formatPercent(current.humidity);
  ui.weatherDewpoint.textContent = `Harmatpont: ${formatTemperature(current.dewPoint)}`;
  ui.weatherDewRisk.textContent = dew.text;
  ui.weatherDewRisk.dataset.state = dew.state;
  ui.weatherHourly.replaceChildren(...buildHourlyCards(weather.hours));
  ui.weatherUpdated.textContent = `Frissítve: ${formatDateTime(new Date(weather.fetchedAt), state.timezone?.name || "UTC")} · Forrás: Open-Meteo`;
  ui.refreshWeatherButton.disabled = false;
}

function buildHourlyCards(hours) {
  const selected = hours.filter((_, index) => index % 2 === 0).slice(0, 6);
  if (!selected.length) return [createEmptyHourlyMessage("Nincs elérhető órás előrejelzés.")];

  return selected.map((hour, index) => {
    const article = document.createElement("article");
    article.className = "weather-hour";
    article.setAttribute("role", "listitem");

    const heading = document.createElement("div");
    heading.className = "weather-hour-heading";

    const time = document.createElement("time");
    time.dateTime = hour.time;
    time.textContent = formatHourlyLabel(hour.time, index === 0);

    const condition = document.createElement("span");
    condition.textContent = weatherCodeText(hour.weatherCode);

    heading.append(time, condition);

    const cloudRow = createHourlyRow("Felhő", formatPercent(hour.cloudCover));
    const meter = document.createElement("div");
    meter.className = "cloud-meter";
    const meterFill = document.createElement("span");
    meterFill.style.width = `${clamp(hour.cloudCover ?? 0, 0, 100)}%`;
    meter.append(meterFill);

    const windRow = createHourlyRow("Szél", `${formatSpeed(hour.windSpeed)} / ${formatSpeed(hour.windGusts)}`);
    const precipitationRow = createHourlyRow("Csapadék", `${formatPercent(hour.precipitationProbability)} · ${formatMillimetres(hour.precipitation)}`);
    const dew = getDewRisk(hour.temperature, hour.dewPoint, hour.humidity);
    const dewRow = createHourlyRow("Harmat", dew.short);
    dewRow.dataset.state = dew.state;

    article.append(heading, cloudRow, meter, windRow, precipitationRow, dewRow);
    return article;
  });
}

function createHourlyRow(label, value) {
  const row = document.createElement("div");
  row.className = "weather-hour-row";
  const name = document.createElement("span");
  name.textContent = label;
  const data = document.createElement("strong");
  data.textContent = value;
  row.append(name, data);
  return row;
}

function getWeatherSummary(hours) {
  if (!hours.length) {
    return { state: "idle", label: "Nincs adat", text: "Nincs elérhető órás előrejelzés." };
  }

  const favorable = hours.filter((hour) =>
    (hour.cloudCover ?? 100) <= 30 &&
    (hour.precipitationProbability ?? 100) <= 20 &&
    (hour.windSpeed ?? 100) <= 20 &&
    (hour.windGusts ?? 100) <= 35
  );

  const usable = hours.filter((hour) =>
    (hour.cloudCover ?? 100) <= 60 &&
    (hour.precipitationProbability ?? 100) <= 35 &&
    (hour.windSpeed ?? 100) <= 28 &&
    (hour.windGusts ?? 100) <= 45
  );

  if (favorable.length >= 4) {
    return {
      state: "good",
      label: "Ígéretes",
      text: `A következő 12 órából ${favorable.length} óra kedvezőnek látszik felhőzet, csapadékesély és szél alapján.`
    };
  }

  if (usable.length >= 3) {
    return {
      state: "mixed",
      label: "Változó",
      text: `Lehet használható időablak, de a körülmények ingadoznak. ${usable.length} óra fér bele a lazább határértékekbe.`
    };
  }

  return {
    state: "poor",
    label: "Kedvezőtlen",
    text: "A következő 12 órában a felhőzet, a csapadékesély vagy a szél várhatóan akadályozza az észlelést."
  };
}

function getDewRisk(temperature, dewPoint, humidity) {
  if (!Number.isFinite(temperature) || !Number.isFinite(dewPoint)) {
    return { state: "unknown", text: "Nincs adat", short: "—" };
  }

  const gap = Math.max(0, temperature - dewPoint);
  const humid = Number.isFinite(humidity) ? humidity : 0;

  if (gap <= 1.5 || humid >= 92) {
    return { state: "high", text: `Magas · ${gap.toFixed(1)} °C különbség`, short: "magas" };
  }
  if (gap <= 3.5 || humid >= 82) {
    return { state: "medium", text: `Közepes · ${gap.toFixed(1)} °C különbség`, short: "közepes" };
  }
  return { state: "low", text: `Alacsony · ${gap.toFixed(1)} °C különbség`, short: "alacsony" };
}

function weatherCodeText(code) {
  if (!Number.isFinite(code)) return "Nincs adat";
  if (code === 0) return "Derült";
  if ([1, 2].includes(code)) return "Gyengén felhős";
  if (code === 3) return "Borult";
  if ([45, 48].includes(code)) return "Köd";
  if ([51, 53, 55, 56, 57].includes(code)) return "Szitálás";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Eső";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Havazás";
  if ([95, 96, 99].includes(code)) return "Zivatar";
  return "Változó";
}

function windDirectionText(degrees) {
  if (!Number.isFinite(degrees)) return "";
  const directions = ["É", "ÉK", "K", "DK", "D", "DNy", "Ny", "ÉNy"];
  return directions[Math.round(degrees / 45) % 8];
}

function formatHourlyLabel(localIso, includeDay) {
  if (!localIso) return "—";
  const time = localIso.slice(11, 16);
  if (!includeDay) return time;
  const todayKey = getLocalDateKey(new Date(), state.timezone?.name || "UTC");
  const dayKey = localIso.slice(0, 10);
  return dayKey === todayKey ? `Most · ${time}` : `Holnap · ${time}`;
}

function getLocalDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTemperature(value) {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10} °C` : "—";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function formatSpeed(value) {
  return Number.isFinite(value) ? `${Math.round(value)} km/h` : "—";
}

function formatMillimetres(value) {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10} mm` : "—";
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function startClock() {
  renderClocks();
  state.tickId = window.setInterval(renderClocks, 1000);
}

function renderClocks() {
  const now = new Date();
  ui.headerUtc.textContent = formatTime(now, "UTC");
  ui.utcClock.textContent = formatTime(now, "UTC");
  ui.utcDate.textContent = formatDate(now, "UTC") + " · UTC";

  if (!state.timezone?.name) return;
  ui.localClock.textContent = formatTime(now, state.timezone.name);
  ui.localDate.textContent = formatDate(now, state.timezone.name);
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function formatDateTime(date, timeZone) {
  return new Intl.DateTimeFormat("hu-HU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function getShortLocationText(location) {
  const named = typeof location?.name === "string" ? location.name.trim() : "";
  if (named) return named;

  const lat = location?.latitude;
  const lon = location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "Nincs kiválasztott helyszín";

  const source = location.source === "GPS" ? "GPS" : "Kézi";
  const latitude = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
  return `${source} · ${latitude}, ${longitude}`;
}

function getDecimalText() {
  if (!state.location) return "";
  const lat = state.location.latitude;
  const lon = state.location.longitude;
  return `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? "E" : "W"}`;
}

function getDmsText() {
  if (!state.location) return "";
  return `${toDms(state.location.latitude, true)}, ${toDms(state.location.longitude, false)}`;
}

function toDms(value, isLatitude) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minuteFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minuteFloat);
  const seconds = (minuteFloat - minutes) * 60;
  const hemisphere = isLatitude ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  return `${degrees}° ${String(minutes).padStart(2, "0")}′ ${seconds.toFixed(1).padStart(4, "0")}″ ${hemisphere}`;
}

function getSetupText() {
  if (!state.location || !state.timezone) return "";
  const now = new Date();
  const offsetSeconds = getOffsetMinutes(now, state.timezone.name) * 60;
  const dst = getDstInfo(now, state.timezone.name);
  const elevation = Number.isFinite(state.location.elevation)
    ? `${Math.round(state.location.elevation)} m`
    : "nincs adat";

  return [
    "TIMEE – TÁVCSŐ-BEÁLLÍTÁS",
    `Koordináták: ${getDecimalText()}`,
    `DMS: ${getDmsText()}`,
    `Magasság: ${elevation}`,
    `Helyi dátum: ${formatDate(now, state.timezone.name)}`,
    `Helyi idő: ${formatTime(now, state.timezone.name)}`,
    `UTC: ${formatDate(now, "UTC")} ${formatTime(now, "UTC")}`,
    `Időzóna: ${state.timezone.name}`,
    `UTC-eltérés: ${formatOffset(offsetSeconds)}`,
    `Nyári időszámítás: ${dst.observes ? (dst.active ? "aktív" : "nem aktív") : "nincs óraátállítás"}`
  ].join("\n");
}

async function copyValue(text, successMessage) {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setStatus(successMessage, "success");
  } catch {
    setStatus("A másolás nem sikerült. Jelöld ki kézzel az adatot.", "error");
  }
}

function setStatus(message, stateName) {
  ui.statusMessage.textContent = message;
  if (stateName) ui.statusMessage.dataset.state = stateName;
  else delete ui.statusMessage.dataset.state;
}

function formatOffset(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const sign = totalMinutes >= 0 ? "+" : "−";
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getTimezoneAbbreviation(date, timeZone) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short"
  }).formatToParts(date).find((item) => item.type === "timeZoneName");
  return part?.value || "—";
}

function getDstInfo(date, timeZone) {
  try {
    const year = date.getUTCFullYear();
    const offsets = Array.from({ length: 12 }, (_, month) =>
      getOffsetMinutes(new Date(Date.UTC(year, month, 1, 12, 0, 0)), timeZone)
    );
    const min = Math.min(...offsets);
    const max = Math.max(...offsets);
    const current = getOffsetMinutes(date, timeZone);
    return {
      observes: min !== max,
      active: min !== max && current > min,
      currentMinutes: current
    };
  } catch {
    return { observes: false, active: false, currentMinutes: 0 };
  }
}

function getOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}
