import L from "leaflet";
import leafletCss from "leaflet/dist/leaflet.css?inline";
import locationMapCss from "../styles/location-map.css?inline";

/**
 * Lazily loaded Leaflet adapter for the observing-site dialog.
 *
 * This module owns only the temporary map viewport. It never changes AnteAstra
 * application state or calls external forecast APIs; app.js receives a plain
 * coordinate draft and decides whether to commit it through setLocation().
 */

const MERCATOR_MAX_LATITUDE = 85.05112878;
const OSM_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 19
  }
};

/**
 * Keep Leaflet and map-specific CSS behind the same lazy boundary as this
 * module. Astro otherwise emits an eager stylesheet link in the page head even
 * when the JavaScript is reached through a dynamic import.
 */
function ensureLocationMapStyles() {
  const styleId = "anteastra-location-map-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `${leafletCss}\n${locationMapCss}`;
  document.head.append(style);
}

function roundCoordinate(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function normalizeMapCoordinate(value) {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude: roundCoordinate(Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, latitude))),
    longitude: roundCoordinate(normalizeLongitude(longitude))
  };
}

function isMappableLocation(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  return Number.isFinite(latitude) &&
    latitude >= -MERCATOR_MAX_LATITUDE &&
    latitude <= MERCATOR_MAX_LATITUDE &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;
}

/**
 * Create one reusable map for the lifetime of the page.
 *
 * The fixed centre marker means pointer, touch and Leaflet keyboard panning all
 * update the same draft. Programmatic recentering is suppressed so opening the
 * dialog without an existing location cannot accidentally create a selection.
 */
export function createLocationMap({
  container,
  zoomLabels,
  onSelectionChange,
  onTileState
}) {
  if (!container) throw new Error("Missing location-map container");

  ensureLocationMapStyles();

  const map = L.map(container, {
    attributionControl: true,
    keyboard: true,
    minZoom: 2,
    scrollWheelZoom: true,
    worldCopyJump: true,
    zoomControl: false
  });

  map.attributionControl.setPrefix(false);
  L.control.zoom({
    position: "topleft",
    zoomInTitle: zoomLabels.zoomIn,
    zoomOutTitle: zoomLabels.zoomOut
  }).addTo(map);

  let tileCycleFailed = false;
  let lastTileState = "loading";
  const publishTileState = (state) => {
    lastTileState = state;
    onTileState?.(state);
  };
  const tileLayer = L.tileLayer(OSM_TILES.url, OSM_TILES.options);
  tileLayer.on("loading", () => {
    tileCycleFailed = false;
    publishTileState("loading");
  });
  tileLayer.on("tileerror", () => {
    tileCycleFailed = true;
    publishTileState("error");
  });
  tileLayer.on("load", () => publishTileState(tileCycleFailed ? "error" : "ready"));
  tileLayer.addTo(map);

  let suppressMoveSelection = false;
  let programmaticMoveId = 0;

  const publishSelection = (coordinate, source) => {
    onSelectionChange?.(coordinate, { source });
  };

  const moveWithoutSelecting = (coordinate, zoom) => {
    const moveId = ++programmaticMoveId;
    suppressMoveSelection = true;
    map.setView([coordinate.latitude, coordinate.longitude], zoom, { animate: false });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (programmaticMoveId === moveId) suppressMoveSelection = false;
    }));
  };

  map.on("click", ({ latlng }) => {
    const coordinate = normalizeMapCoordinate(latlng);
    if (!coordinate) return;
    moveWithoutSelecting(coordinate, map.getZoom());
    // Read the post-setView centre so the draft always matches the fixed
    // marker, including any projection constraint or internal rounding.
    const centredCoordinate = normalizeMapCoordinate(map.getCenter());
    if (centredCoordinate) publishSelection(centredCoordinate, "user");
  });

  map.on("moveend", () => {
    if (suppressMoveSelection) return;
    const mapCenter = map.getCenter();
    const coordinate = normalizeMapCoordinate(mapCenter);
    if (!coordinate) return;

    // Horizontal world copies are equivalent and normalize cleanly. Latitude
    // cannot wrap, so pull the viewport back from Web Mercator's polar limit.
    if (Math.abs(mapCenter.lat - coordinate.latitude) >= 0.000001) {
      moveWithoutSelecting(coordinate, map.getZoom());
    }
    publishSelection(coordinate, "user");
  });

  return {
    open({ selectedLocation, defaultCenter, defaultZoom, onReady }) {
      const hasSelectedLocation = isMappableLocation(selectedLocation);
      const selectedCoordinate = hasSelectedLocation
        ? normalizeMapCoordinate(selectedLocation)
        : null;
      const selectedViewCoordinate = selectedLocation
        ? normalizeMapCoordinate(selectedLocation)
        : null;
      const viewCoordinate = selectedCoordinate || selectedViewCoordinate || normalizeMapCoordinate(defaultCenter);

      if (!viewCoordinate) throw new Error("Invalid default map centre");

      publishSelection(
        selectedCoordinate,
        selectedLocation && !hasSelectedLocation ? "outside-range" : selectedCoordinate ? "current" : "empty"
      );
      moveWithoutSelecting(viewCoordinate, selectedCoordinate ? 12 : defaultZoom);

      // Re-publish a settled state because a reused layer may emit no events
      // for an unchanged viewport. Failed tiles get one explicit retry.
      publishTileState(lastTileState);
      if (lastTileState === "error") tileLayer.redraw();

      requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
        requestAnimationFrame(() => onReady?.());
      });
    }
  };
}
