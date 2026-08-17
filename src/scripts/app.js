import { getLocale, runtime } from "../i18n/translations.js";
import { calculateNightSky, createMoonIlluminationPath } from "./astronomy.js";

/**
 * Main browser controller for location-dependent application data.
 *
 * Astro owns the semantic markup; this singleton module maps that static DOM,
 * coordinates external/local data, and renders values into it. `initApp()` must
 * run once per page load: repeated calls would duplicate listeners and clocks.
 */

// Deployed compatibility keys. Renaming them requires an explicit migration.
const STORAGE_KEY = "timee.location.v1";
const THEME_KEY = "timee.theme.v1";
const locale = getLocale();
const t = runtime[locale];

// Invariant: timezone, weather and astronomy describe `location`, or are null.
const state = {
  location: null,
  timezone: null,
  weather: null,
  astronomy: null,
  tickId: null,
  locationRequestId: 0,
  locationAbortController: null
};

const ui = {};

// Map UI is a discardable draft. The controller is loaded only after the user
// explicitly opens the dialog and never owns selected-location application state.
let locationMapModulePromise = null;
let locationMapController = null;
let mapDialogGeneration = 0;
let mapDialogOpener = null;
let mapDraft = null;
let mapDraftSource = "empty";
let mapTileFailed = false;

// -----------------------------------------------------------------------------
// Bootstrap and static DOM contract
// -----------------------------------------------------------------------------

export function initApp() {
  mapUi();
  bindEvents();
  restoreTheme();
  startClock();
  restoreLocation();
}

function mapUi() {
  // Keep this list synchronized with AppPage.astro. Most entries are mandatory;
  // the collapsed location summary is the only currently optional target.
  [
    "header-utc", "red-mode-button", "gps-button", "map-location-button", "toggle-manual-button",
    "manual-location", "latitude-input", "longitude-input", "status-message", "location-card-summary",
    "map-location-dialog", "map-location-close", "map-location-stage", "location-map",
    "map-location-coordinates", "map-location-status", "map-location-cancel", "map-location-apply",
    "location-source", "decimal-coordinates", "dms-coordinates", "accuracy-value",
    "elevation-value", "copy-decimal-button", "copy-dms-button", "local-clock",
    "local-date", "utc-clock", "utc-date", "timezone-name", "utc-offset",
    "timezone-abbreviation", "dst-status", "copy-setup-button",
    "weather-card", "weather-status-badge", "weather-summary", "weather-condition",
    "weather-cloud", "weather-cloud-layers", "weather-temperature", "weather-wind",
    "weather-wind-detail", "weather-humidity", "weather-dewpoint", "weather-dew-risk",
    "weather-hourly", "weather-updated", "refresh-weather-button",
    "night-sky-status", "night-sky-summary", "darkness-window", "darkness-duration",
    "sunset-time", "civil-dusk-time", "nautical-dusk-time", "night-start-time",
    "moon-visual", "moon-lit-path", "moon-phase", "moon-illumination", "moonrise-time",
    "moonset-time", "moon-altitude", "moon-altitude-context", "moon-visibility"
  ].forEach((id) => {
    ui[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  ui.redModeButton.addEventListener("click", toggleTheme);
  ui.gpsButton.addEventListener("click", requestGpsLocation);
  ui.mapLocationButton.addEventListener("click", openMapLocationDialog);
  ui.toggleManualButton.addEventListener("click", toggleManualForm);
  ui.manualLocation.addEventListener("submit", applyManualLocation);
  ui.mapLocationClose.addEventListener("click", () => closeMapLocationDialog());
  ui.mapLocationCancel.addEventListener("click", () => closeMapLocationDialog());
  ui.mapLocationApply.addEventListener("click", applyMapLocation);
  ui.mapLocationDialog.addEventListener("cancel", handleMapDialogCancel);
  ui.mapLocationDialog.addEventListener("keydown", handleMapDialogKeydown);
  ui.mapLocationDialog.addEventListener("click", handleMapDialogBackdropClick);
  ui.mapLocationDialog.addEventListener("close", resetMapDialogDraft);
  ui.refreshWeatherButton.addEventListener("click", refreshWeather);
  ui.copyDecimalButton.addEventListener("click", () => copyValue(getDecimalText(), t.copyDecimalSuccess));
  ui.copyDmsButton.addEventListener("click", () => copyValue(getDmsText(), t.copyDmsSuccess));
  ui.copySetupButton.addEventListener("click", () => copyValue(getSetupText(), t.copySetupSuccess));
}

function toCamel(value) {
  // This helper is intentionally limited to kebab-case HTML ids.
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// -----------------------------------------------------------------------------
// Theme and location input
// -----------------------------------------------------------------------------

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

function setMapStatus(message, stateName) {
  // Avoid re-announcing an unchanged status on every keyboard/pointer move;
  // the coordinate output remains the live, per-movement value.
  if (ui.mapLocationStatus.textContent !== message) {
    ui.mapLocationStatus.textContent = message;
  }
  if (stateName) ui.mapLocationStatus.dataset.state = stateName;
  else delete ui.mapLocationStatus.dataset.state;
}

function renderMapDraftStatus() {
  if (mapTileFailed) {
    setMapStatus(t.mapTilesUnavailable, "error");
    return;
  }
  if (mapDraftSource === "outside-range") {
    setMapStatus(t.mapOutsideRange, "error");
    return;
  }
  if (!mapDraft) {
    setMapStatus(t.mapChoose);
    return;
  }
  setMapStatus(mapDraftSource === "current" ? t.mapCurrentSelection : t.mapSelectionReady);
}

function updateMapDraft(coordinate, { source = "user" } = {}) {
  if (!ui.mapLocationDialog.open) return;
  mapDraftSource = source;

  if (!coordinate) {
    mapDraft = null;
    ui.mapLocationCoordinates.textContent = "—";
    ui.mapLocationApply.disabled = true;
    renderMapDraftStatus();
    return;
  }

  mapDraft = {
    latitude: Number(coordinate.latitude),
    longitude: Number(coordinate.longitude)
  };
  ui.mapLocationCoordinates.textContent = formatDecimalCoordinates(mapDraft);
  // Opening on the current site is a preview, not a reason to discard GPS
  // accuracy/altitude metadata by saving the same point as a map selection.
  ui.mapLocationApply.disabled = source === "current";
  renderMapDraftStatus();
}

function handleMapTileState(stateName) {
  if (!ui.mapLocationDialog.open) return;
  if (stateName === "loading") {
    if (ui.mapLocationStage.dataset.ready !== "true") setMapStatus(t.mapLoading, "loading");
    return;
  }
  mapTileFailed = stateName === "error";
  renderMapDraftStatus();
}

function loadLocationMapModule() {
  if (!locationMapModulePromise) {
    locationMapModulePromise = import("./location-map.js").catch((error) => {
      // A failed chunk request may succeed on a later explicit retry.
      locationMapModulePromise = null;
      throw error;
    });
  }
  return locationMapModulePromise;
}

async function openMapLocationDialog() {
  if (ui.mapLocationDialog.open) return;

  const generation = ++mapDialogGeneration;
  mapDialogOpener = ui.mapLocationButton;
  mapDraft = null;
  mapDraftSource = "empty";
  mapTileFailed = false;
  ui.mapLocationStage.dataset.ready = "false";
  ui.mapLocationCoordinates.textContent = "—";
  ui.mapLocationApply.disabled = true;
  setMapStatus(t.mapLoading, "loading");
  ui.mapLocationDialog.showModal();
  requestAnimationFrame(() => ui.mapLocationClose.focus());

  try {
    const { createLocationMap } = await loadLocationMapModule();
    if (generation !== mapDialogGeneration || !ui.mapLocationDialog.open) return;

    locationMapController ||= createLocationMap({
      container: ui.locationMap,
      zoomLabels: { zoomIn: t.mapZoomIn, zoomOut: t.mapZoomOut },
      onSelectionChange: updateMapDraft,
      onTileState: handleMapTileState
    });

    locationMapController.open({
      selectedLocation: state.location,
      defaultCenter: locale === "hu"
        ? { latitude: 47.1625, longitude: 19.5033 }
        : { latitude: 20, longitude: 0 },
      defaultZoom: locale === "hu" ? 6 : 2,
      onReady: () => {
        if (generation !== mapDialogGeneration || !ui.mapLocationDialog.open) return;
        ui.mapLocationStage.dataset.ready = "true";
        renderMapDraftStatus();
      }
    });
  } catch (error) {
    if (generation !== mapDialogGeneration || !ui.mapLocationDialog.open) return;
    ui.mapLocationStage.dataset.ready = "false";
    ui.mapLocationApply.disabled = true;
    setMapStatus(t.mapUnavailable, "error");
    console.error(error);
  }
}

function closeMapLocationDialog(returnValue = "cancel") {
  if (!ui.mapLocationDialog.open) return;
  const focusTarget = mapDialogOpener;
  ui.mapLocationDialog.close(returnValue);
  requestAnimationFrame(() => focusTarget?.focus());
}

function handleMapDialogCancel(event) {
  event.preventDefault();
  closeMapLocationDialog();
}

function handleMapDialogKeydown(event) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeMapLocationDialog();
}

function handleMapDialogBackdropClick(event) {
  if (event.target === ui.mapLocationDialog) closeMapLocationDialog();
}

function resetMapDialogDraft() {
  ++mapDialogGeneration;
  mapDialogOpener = null;
  mapDraft = null;
  mapDraftSource = "empty";
  mapTileFailed = false;
  ui.mapLocationStage.dataset.ready = "false";
}

async function applyMapLocation() {
  if (!mapDraft || ui.mapLocationApply.disabled) return;
  const selected = { ...mapDraft };
  ui.mapLocationApply.disabled = true;

  if (hasSameCoordinates(selected, state.location)) {
    closeMapLocationDialog("unchanged");
    return;
  }

  closeMapLocationDialog("apply");
  await applyCoordinateLocation(selected.latitude, selected.longitude, "Map");
}

function hasSameCoordinates(left, right) {
  if (!left || !right) return false;
  const latitudeDifference = Math.abs(Number(left.latitude) - Number(right.latitude));
  const longitudeDifference = Math.abs(
    ((Number(left.longitude) - Number(right.longitude) + 180) % 360 + 360) % 360 - 180
  );
  return latitudeDifference < 0.000001 && longitudeDifference < 0.000001;
}

async function requestGpsLocation() {
  if (!navigator.geolocation) {
    setStatus(t.geoUnsupported, "error");
    return;
  }

  setStatus(t.locating, "loading");
  ui.gpsButton.disabled = true;

  // Permission is requested only from this explicit user action. The options
  // favour field accuracy while accepting a position cached for up to 5 minutes.
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
      setStatus(t.geoErrors[error.code] || t.geoUnknown, "error");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
  );
}

async function applyManualLocation(event) {
  event.preventDefault();
  // Accept the decimal comma common in Hungarian input as well as a dot.
  const latitude = Number(ui.latitudeInput.value.replace?.(",", ".") ?? ui.latitudeInput.value);
  const longitude = Number(ui.longitudeInput.value.replace?.(",", ".") ?? ui.longitudeInput.value);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    setStatus(t.latitudeInvalid, "error");
    return;
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    setStatus(t.longitudeInvalid, "error");
    return;
  }

  // Legacy value kept for compatibility with locations already saved in localStorage.
  await applyCoordinateLocation(latitude, longitude, "Kézi");
  ui.manualLocation.hidden = true;
  ui.toggleManualButton.setAttribute("aria-expanded", "false");
}

function applyCoordinateLocation(latitude, longitude, source) {
  return setLocation({ latitude, longitude, accuracy: null, gpsAltitude: null, source });
}

/**
 * Replace the selected site as one coherent transaction.
 *
 * Old dependent values are invalidated before waiting for the network. Abort
 * saves work; the monotonically increasing id is the correctness guard when an
 * old response still arrives. Only the current transaction may render or save.
 */
async function setLocation(location, options = {}) {
  const requestId = ++state.locationRequestId;
  state.locationAbortController?.abort();
  state.locationAbortController = new AbortController();

  state.location = location;
  state.timezone = null;
  state.weather = null;
  state.astronomy = null;
  renderLocation();
  resetLocationTimeUi();
  resetWeatherUi(t.forecastLoading, "loading");
  resetAstronomyUi(t.astronomy.loading, "loading");
  setStatus(options.restored ? t.restoredLoading : t.dataLoading, "loading");

  try {
    const locationData = await fetchLocationData(
      location.latitude,
      location.longitude,
      state.locationAbortController.signal
    );
    // Not redundant with abort: transports/intermediaries may still resolve.
    if (requestId !== state.locationRequestId) return;

    state.timezone = locationData.timezone;
    state.weather = locationData.weather;
    state.location.elevation = Number.isFinite(location.gpsAltitude)
      ? location.gpsAltitude
      : locationData.timezone.elevation;
    state.location.elevationSource = Number.isFinite(location.gpsAltitude) ? "GPS" : "Open-Meteo";
    // Astronomy failure is isolated so valid time-zone/weather data remain useful.
    try {
      state.astronomy = calculateNightSky({
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: state.location.elevation,
        timeZone: state.timezone.name
      });
    } catch (astronomyError) {
      state.astronomy = null;
      console.error(astronomyError);
    }

    persistLocation();
    renderAll();
    if (!state.astronomy) resetAstronomyUi(t.astronomy.unavailable, "error");
    setStatus(
      state.astronomy ? t.locationUpdated : t.locationUpdatedWithoutSky,
      state.astronomy ? "success" : "error"
    );
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== state.locationRequestId) return;

    state.timezone = null;
    state.weather = null;
    state.astronomy = null;
    state.location.elevation = Number.isFinite(location.gpsAltitude) ? location.gpsAltitude : null;
    state.location.elevationSource = Number.isFinite(location.gpsAltitude) ? "GPS" : null;
    renderLocation();
    resetLocationTimeUi(t.timezoneUnavailable);
    resetWeatherUi(t.forecastUnavailable, "error");
    resetAstronomyUi(t.astronomy.unavailable, "error");
    setStatus(t.fetchFailed, "error");
    console.error(error);
  }
}

async function refreshWeather() {
  if (!state.location) return;
  // Refresh the complete snapshot so time zone, elevation, weather and sky data
  // cannot drift into results from different update generations.
  await setLocation({ ...state.location }, { restored: true });
}

/**
 * Fetch time zone, terrain elevation and weather in one keyless Open-Meteo call.
 * `timezone=auto` makes hourly timestamps selected-site wall-clock strings, and
 * two forecast days keep a twelve-hour window available around local midnight.
 */
async function fetchLocationData(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    current: [
      "temperature_2m", "relative_humidity_2m", "dew_point_2m", "precipitation",
      "weather_code", "cloud_cover", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"
    ].join(","),
    hourly: [
      "temperature_2m", "relative_humidity_2m", "dew_point_2m", "precipitation_probability",
      "precipitation", "weather_code", "cloud_cover", "cloud_cover_low", "cloud_cover_mid",
      "cloud_cover_high", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"
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
  if (!response.ok) throw new Error(t.apiError(response.status));

  const data = await response.json();
  if (!data.timezone) throw new Error(t.missingTimezone);

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
  // Do not parse these zone-less local strings with `new Date()`: that would
  // silently apply the device time zone. Open-Meteo arrays align by index.
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
  // Called only after a successful current-site fetch, so a failed replacement
  // does not overwrite the last known-good saved location.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ location: state.location, timezone: state.timezone }));
  } catch (error) {
    console.warn(t.saveWarning, error);
  }
}

function restoreLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.location) return;
    // Stored timezone is legacy/compatibility data; always fetch a fresh coherent
    // snapshot instead of trusting cached dependent values after a reload.
    setLocation(saved.location, { restored: true });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderAll() {
  // This is reached only after the request-generation check in setLocation().
  renderLocation();
  renderTimezone();
  renderClocks();
  renderWeather();
  renderAstronomy();
}

function resetLocationTimeUi(message = t.timezoneLoading) {
  ui.localClock.textContent = "--:--:--";
  ui.localDate.textContent = message;
  ui.timezoneName.textContent = "—";
  ui.utcOffset.textContent = "—";
  ui.timezoneAbbreviation.textContent = "—";
  ui.dstStatus.textContent = "—";
  ui.copySetupButton.disabled = true;
}

function resetWeatherUi(message = t.chooseLocation, stateName = "idle") {
  ui.weatherStatusBadge.textContent = stateName === "loading" ? t.loading : stateName === "error" ? t.error : t.noData;
  ui.weatherStatusBadge.dataset.state = stateName;
  ui.weatherSummary.textContent = message;
  ui.weatherCondition.textContent = "—";
  ui.weatherCloud.textContent = "—";
  ui.weatherCloudLayers.textContent = t.cloudLayersEmpty;
  ui.weatherTemperature.textContent = "—";
  ui.weatherWind.textContent = "—";
  ui.weatherWindDetail.textContent = t.gustEmpty;
  ui.weatherHumidity.textContent = "—";
  ui.weatherDewpoint.textContent = t.dewPointEmpty;
  ui.weatherDewRisk.textContent = "—";
  ui.weatherHourly.replaceChildren(createEmptyHourlyMessage(message));
  ui.weatherUpdated.textContent = "—";
  ui.refreshWeatherButton.disabled = !state.location || stateName === "loading";
}

function resetAstronomyUi(message = t.astronomy.chooseLocation, stateName = "idle") {
  ui.nightSkyStatus.textContent = stateName === "loading" ? t.loading : stateName === "error" ? t.error : t.noData;
  ui.nightSkyStatus.dataset.state = stateName;
  ui.nightSkySummary.textContent = message;
  ui.darknessWindow.textContent = "—";
  ui.darknessDuration.textContent = "—";
  [ui.sunsetTime, ui.civilDuskTime, ui.nauticalDuskTime, ui.nightStartTime, ui.moonriseTime, ui.moonsetTime]
    .forEach((element) => setEventTime(element, null));
  ui.moonPhase.textContent = "—";
  ui.moonIllumination.textContent = "—";
  ui.moonAltitude.textContent = "—";
  ui.moonAltitudeContext.textContent = t.astronomy.altitudeContextDarkness;
  ui.moonVisibility.textContent = "—";
  ui.moonLitPath.setAttribute("d", "");
  ui.moonLitPath.removeAttribute("transform");
  ui.moonVisual.setAttribute("aria-label", t.noData);
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

  ui.locationSource.textContent = location.source === "GPS"
    ? t.gpsLocation
    : location.source === "Map"
      ? t.mapLocation
      : t.manualLocation;
  if (ui.locationCardSummary) ui.locationCardSummary.textContent = getShortLocationText(location);
  ui.decimalCoordinates.textContent = getDecimalText();
  ui.dmsCoordinates.textContent = getDmsText();
  ui.accuracyValue.textContent = Number.isFinite(location.accuracy)
    ? `±${Math.round(location.accuracy)} m`
    : location.source === "Map"
      ? t.mapCoordinate
      : t.manualCoordinate;

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
  ui.dstStatus.textContent = dst.observes ? (dst.active ? t.dstActive : t.dstInactive) : t.dstNone;
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
  ui.weatherCloudLayers.textContent = t.cloudLayers(
    formatPercent(current.cloudLow),
    formatPercent(current.cloudMid),
    formatPercent(current.cloudHigh)
  );
  ui.weatherTemperature.textContent = formatTemperature(current.temperature);
  ui.weatherWind.textContent = `${formatSpeed(current.windSpeed)} ${windDirectionText(current.windDirection)}`.trim();
  ui.weatherWindDetail.textContent = t.gust(formatSpeed(current.windGusts));
  ui.weatherHumidity.textContent = formatPercent(current.humidity);
  ui.weatherDewpoint.textContent = t.dewPoint(formatTemperature(current.dewPoint));
  ui.weatherDewRisk.textContent = dew.text;
  ui.weatherDewRisk.dataset.state = dew.state;
  ui.weatherHourly.replaceChildren(...buildHourlyCards(weather.hours));
  ui.weatherUpdated.textContent = t.updated(formatDateTime(new Date(weather.fetchedAt), state.timezone?.name || "UTC"));
  ui.refreshWeatherButton.disabled = false;
}

function renderAstronomy() {
  const astronomy = state.astronomy;
  if (!astronomy?.moon) {
    resetAstronomyUi(state.location ? t.astronomy.unavailable : t.astronomy.chooseLocation, state.location ? "error" : "idle");
    return;
  }

  const phaseName = t.astronomy.phaseNames[astronomy.moon.phaseIndex] || t.noData;
  const illumination = Math.round(astronomy.moon.fraction * 100);
  const duration = formatDuration(astronomy.darkness.durationMinutes);
  const darknessStart = formatShortTime(astronomy.darkness.start, state.timezone.name);
  const darknessEnd = formatShortTime(astronomy.darkness.end, state.timezone.name);

  if (astronomy.state === "darkness") {
    ui.nightSkyStatus.textContent = t.astronomy.darknessBadge(duration);
    ui.nightSkyStatus.dataset.state = "darkness";
    ui.nightSkySummary.textContent = t.astronomy.darknessSummary(
      darknessStart,
      darknessEnd,
      duration,
      phaseName,
      illumination
    );
    ui.darknessWindow.textContent = t.astronomy.darknessWindow(darknessStart, darknessEnd);
    ui.darknessDuration.textContent = duration;
  } else {
    const content = astronomy.state === "polarDay"
      ? { badge: t.astronomy.polarDayBadge, summary: t.astronomy.polarDaySummary(phaseName, illumination) }
      : astronomy.state === "sunBelowHorizon"
        ? { badge: t.astronomy.sunBelowBadge, summary: t.astronomy.sunBelowSummary(phaseName, illumination) }
        : { badge: t.astronomy.noDarknessBadge, summary: t.astronomy.noDarknessSummary(phaseName, illumination) };
    ui.nightSkyStatus.textContent = content.badge;
    ui.nightSkyStatus.dataset.state = "limited";
    ui.nightSkySummary.textContent = content.summary;
    ui.darknessWindow.textContent = "—";
    ui.darknessDuration.textContent = content.badge;
  }

  setEventTime(ui.sunsetTime, astronomy.timeline.sunset, state.timezone.name);
  setEventTime(ui.civilDuskTime, astronomy.timeline.civilDusk, state.timezone.name);
  setEventTime(ui.nauticalDuskTime, astronomy.timeline.nauticalDusk, state.timezone.name);
  setEventTime(ui.nightStartTime, astronomy.timeline.night, state.timezone.name);

  ui.moonPhase.textContent = phaseName;
  ui.moonIllumination.textContent = `${illumination}%`;
  // Altitude and disc orientation represent mid-darkness, or local midnight
  // when that night has no astronomical-darkness window; they are not "now".
  ui.moonAltitude.textContent = formatAngle(astronomy.moon.altitude);
  ui.moonAltitudeContext.textContent = astronomy.state === "darkness"
    ? t.astronomy.altitudeContextDarkness
    : t.astronomy.altitudeContextMidnight;
  ui.moonVisibility.textContent = t.astronomy.visibility[astronomy.moon.visibility] || "—";
  setEventTime(ui.moonriseTime, astronomy.moon.rise, state.timezone.name);
  setEventTime(ui.moonsetTime, astronomy.moon.set, state.timezone.name);

  ui.moonLitPath.setAttribute(
    "d",
    createMoonIlluminationPath(astronomy.moon.fraction, astronomy.moon.waxing)
  );
  ui.moonLitPath.setAttribute("transform", `rotate(${astronomy.moon.rotation.toFixed(2)} 50 50)`);
  ui.moonVisual.setAttribute("aria-label", t.astronomy.moonAria(phaseName, illumination));
}

function buildHourlyCards(hours) {
  // State retains all 12 hours for the summary; the compact UI samples every
  // second hour and renders at most six cards.
  const selected = hours.filter((_, index) => index % 2 === 0).slice(0, 6);
  if (!selected.length) return [createEmptyHourlyMessage(t.hourlyEmpty)];

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

    const cloudRow = createHourlyRow(t.rowCloud, formatPercent(hour.cloudCover));
    const meter = document.createElement("div");
    meter.className = "cloud-meter";
    const meterFill = document.createElement("span");
    meterFill.style.width = `${clamp(hour.cloudCover ?? 0, 0, 100)}%`;
    meter.append(meterFill);

    const windRow = createHourlyRow(t.rowWind, `${formatSpeed(hour.windSpeed)} / ${formatSpeed(hour.windGusts)}`);
    const precipitationRow = createHourlyRow(
      t.rowPrecipitation,
      `${formatPercent(hour.precipitationProbability)} · ${formatMillimetres(hour.precipitation)}`
    );
    const dew = getDewRisk(hour.temperature, hour.dewPoint, hour.humidity);
    const dewRow = createHourlyRow(t.rowDew, dew.short);
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
  if (!hours.length) return { state: "idle", label: t.noData, text: t.summaryNoData };

  // Product heuristic, not a measured guarantee. Missing inputs default to 100
  // so incomplete forecasts can never be promoted to a favourable result.
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
    return { state: "good", label: t.summaryGoodLabel, text: t.summaryGood(favorable.length) };
  }
  if (usable.length >= 3) {
    return { state: "mixed", label: t.summaryMixedLabel, text: t.summaryMixed(usable.length) };
  }
  return { state: "poor", label: t.summaryPoorLabel, text: t.summaryPoor };
}

function getDewRisk(temperature, dewPoint, humidity) {
  // Simple field-risk heuristic, not a local dew sensor. Temperature/dew-point
  // gap remains usable when relative humidity itself is missing.
  if (!Number.isFinite(temperature) || !Number.isFinite(dewPoint)) {
    return { state: "unknown", text: t.dewUnknown, short: "—" };
  }

  const gap = Math.max(0, temperature - dewPoint);
  const gapText = gap.toFixed(1);
  const humid = Number.isFinite(humidity) ? humidity : 0;

  if (gap <= 1.5 || humid >= 92) {
    return { state: "high", text: t.dewHigh(gapText), short: t.dewShortHigh };
  }
  if (gap <= 3.5 || humid >= 82) {
    return { state: "medium", text: t.dewMedium(gapText), short: t.dewShortMedium };
  }
  return { state: "low", text: t.dewLow(gapText), short: t.dewShortLow };
}

function weatherCodeText(code) {
  if (!Number.isFinite(code)) return t.noData;
  if (code === 0) return t.weather.clear;
  if ([1, 2].includes(code)) return t.weather.partlyCloudy;
  if (code === 3) return t.weather.overcast;
  if ([45, 48].includes(code)) return t.weather.fog;
  if ([51, 53, 55, 56, 57].includes(code)) return t.weather.drizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return t.weather.rain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return t.weather.snow;
  if ([95, 96, 99].includes(code)) return t.weather.thunderstorm;
  return t.weather.variable;
}

function windDirectionText(degrees) {
  if (!Number.isFinite(degrees)) return "";
  return t.directions[Math.round(degrees / 45) % 8];
}

function formatHourlyLabel(localIso, includeDay) {
  if (!localIso) return "—";
  // `localIso` is already selected-site wall-clock time from Open-Meteo.
  const time = localIso.slice(11, 16);
  if (!includeDay) return time;
  const todayKey = getLocalDateKey(new Date(), state.timezone?.name || "UTC");
  const dayKey = localIso.slice(0, 10);
  return dayKey === todayKey ? `${t.now} · ${time}` : `${t.tomorrow} · ${time}`;
}

function getLocalDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function setEventTime(element, date, timeZone = "UTC") {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    element.textContent = t.astronomy.noEvent;
    element.removeAttribute("datetime");
    return;
  }

  element.textContent = formatShortTime(date, timeZone);
  element.dateTime = date.toISOString();
}

function formatShortTime(date, timeZone) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return t.astronomy.noEvent;
  return new Intl.DateTimeFormat(t.dateLocale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatDuration(totalMinutes) {
  const minutes = Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes)) : 0;
  return t.astronomy.duration(Math.floor(minutes / 60), minutes % 60);
}

function formatAngle(value) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded)}°`;
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
  ui.utcDate.textContent = `${formatDate(now, "UTC")} · UTC`;

  // Never substitute the device zone for the selected observing site's zone.
  if (!state.timezone?.name) return;
  ui.localClock.textContent = formatTime(now, state.timezone.name);
  ui.localDate.textContent = formatDate(now, state.timezone.name);
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat(t.dateLocale, {
    timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
}
function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat(t.dateLocale, {
    timeZone, year: "numeric", month: "long", day: "numeric", weekday: "long"
  }).format(date);
}
function formatDateTime(date, timeZone) {
  return new Intl.DateTimeFormat(t.dateLocale, {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(date);
}

function getShortLocationText(location) {
  const named = typeof location?.name === "string" ? location.name.trim() : "";
  if (named) return named;

  const lat = location?.latitude;
  const lon = location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return t.noLocation;

  const source = location.source === "GPS" ? "GPS" : location.source === "Map" ? t.mapShort : t.manualShort;
  const latitude = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
  return `${source} · ${latitude}, ${longitude}`;
}

function getDecimalText() {
  if (!state.location) return "";
  return formatDecimalCoordinates(state.location);
}

function formatDecimalCoordinates(location) {
  const { latitude: lat, longitude: lon } = location;
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
    : t.noValue;
  const dstText = dst.observes ? (dst.active ? t.dstActiveLower : t.dstInactiveLower) : t.dstNoneLower;

  return [
    t.setupHeader,
    `${t.setupCoordinates}: ${getDecimalText()}`,
    `DMS: ${getDmsText()}`,
    `${t.setupElevation}: ${elevation}`,
    `${t.setupLocalDate}: ${formatDate(now, state.timezone.name)}`,
    `${t.setupLocalTime}: ${formatTime(now, state.timezone.name)}`,
    `UTC: ${formatDate(now, "UTC")} ${formatTime(now, "UTC")}`,
    `${t.setupTimezone}: ${state.timezone.name}`,
    `${t.setupOffset}: ${formatOffset(offsetSeconds)}`,
    `${t.setupDst}: ${dstText}`
  ].join("\n");
}

async function copyValue(text, successMessage) {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Compatibility fallback for browsers without the asynchronous Clipboard API.
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
    setStatus(t.copyFailed, "error");
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
    timeZone, timeZoneName: "short"
  }).formatToParts(date).find((item) => item.type === "timeZoneName");
  return part?.value || "—";
}

function getDstInfo(date, timeZone) {
  try {
    // Monthly sampling treats the year's minimum UTC offset as standard time.
    // This is display-oriented and may not model extraordinary legal rule changes.
    const year = date.getUTCFullYear();
    const offsets = Array.from({ length: 12 }, (_, month) =>
      getOffsetMinutes(new Date(Date.UTC(year, month, 1, 12, 0, 0)), timeZone)
    );
    const min = Math.min(...offsets);
    const max = Math.max(...offsets);
    const current = getOffsetMinutes(date, timeZone);
    return { observes: min !== max, active: min !== max && current > min, currentMinutes: current };
  } catch {
    return { observes: false, active: false, currentMinutes: 0 };
  }
}

function getOffsetMinutes(date, timeZone) {
  // Reinterpret wall-clock parts from the explicit IANA zone as UTC to derive
  // the offset without consulting the device's local time zone.
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
