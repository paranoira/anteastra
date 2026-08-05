const STORAGE_KEY = "timee.location.v1";
const THEME_KEY = "timee.theme.v1";

const state = {
  location: null,
  timezone: null,
  tickId: null
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
    "manual-location", "latitude-input", "longitude-input", "status-message",
    "location-source", "decimal-coordinates", "dms-coordinates", "accuracy-value",
    "elevation-value", "copy-decimal-button", "copy-dms-button", "local-clock",
    "local-date", "utc-clock", "utc-date", "timezone-name", "utc-offset",
    "timezone-abbreviation", "dst-status", "copy-setup-button"
  ].forEach((id) => {
    ui[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  ui.redModeButton.addEventListener("click", toggleTheme);
  ui.gpsButton.addEventListener("click", requestGpsLocation);
  ui.toggleManualButton.addEventListener("click", toggleManualForm);
  ui.manualLocation.addEventListener("submit", applyManualLocation);
  ui.copyDecimalButton.addEventListener("click", () => copyValue(getDecimalText(), "A decimális koordinátát kimásoltam."));
  ui.copyDmsButton.addEventListener("click", () => copyValue(getDmsText(), "A DMS-koordinátát kimásoltam."));
  ui.copySetupButton.addEventListener("click", () => copyValue(getSetupText(), "A teljes távcső-beállítást kimásoltam."));
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved === "red" ? "red" : "default";
  applyTheme(theme);
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

async function setLocation(location) {
  state.location = location;
  state.timezone = null;
  renderLocation();
  setStatus("Időzóna és magasság lekérése…", "loading");

  try {
    const timezoneInfo = await fetchTimezoneInfo(location.latitude, location.longitude);
    state.timezone = timezoneInfo;
    state.location.elevation = Number.isFinite(location.gpsAltitude)
      ? location.gpsAltitude
      : timezoneInfo.elevation;
    state.location.elevationSource = Number.isFinite(location.gpsAltitude) ? "GPS" : "Open-Meteo";
    persistLocation();
    renderAll();
    setStatus("A helyszín készen áll a távcső beállításához.", "success");
  } catch (error) {
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    state.timezone = {
      name: deviceTimezone,
      abbreviation: getTimezoneAbbreviation(new Date(), deviceTimezone),
      offsetSeconds: getOffsetMinutes(new Date(), deviceTimezone) * 60,
      dst: getDstInfo(new Date(), deviceTimezone),
      fallback: true
    };
    state.location.elevation = location.gpsAltitude;
    state.location.elevationSource = Number.isFinite(location.gpsAltitude) ? "GPS" : null;
    persistLocation();
    renderAll();
    setStatus("Az online időzóna-lekérés nem sikerült; átmenetileg a készülék időzónáját használjuk.", "error");
    console.error(error);
  }
}

async function fetchTimezoneInfo(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    current: "temperature_2m",
    timezone: "auto",
    forecast_days: "1"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Open-Meteo hiba: ${response.status}`);
  const data = await response.json();
  if (!data.timezone) throw new Error("Hiányzó időzónaadat.");

  return {
    name: data.timezone,
    abbreviation: data.timezone_abbreviation || getTimezoneAbbreviation(new Date(), data.timezone),
    offsetSeconds: Number(data.utc_offset_seconds),
    elevation: Number.isFinite(Number(data.elevation)) ? Number(data.elevation) : null,
    dst: getDstInfo(new Date(), data.timezone),
    fallback: false
  };
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
    if (!saved?.location || !saved?.timezone) return;
    state.location = saved.location;
    state.timezone = saved.timezone;
    renderAll();
    setStatus("A korábban mentett helyszínt használjuk.", "success");
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderAll() {
  renderLocation();
  renderTimezone();
  renderClocks();
}

function renderLocation() {
  const location = state.location;
  if (!location) return;

  ui.locationSource.textContent = location.source === "GPS" ? "GPS-helyzet" : "Kézi helyszín";
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
