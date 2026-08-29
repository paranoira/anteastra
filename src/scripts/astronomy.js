import * as SunCalc from "suncalc";

/**
 * Pure Sun/Moon calculation layer: no DOM access and no translated prose.
 *
 * The implementation targets the pinned SunCalc 2.0.1 contract. Its emitted
 * Moon angles are degrees and missing polar events are null plus state flags;
 * changing that dependency requires focused regression tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// 00:00–05:59 belongs to the observing night that began the previous evening.
const OBSERVING_DAY_CUTOFF_HOUR = 6;

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function zonedParts(date, timeZone) {
  // Break an absolute instant into wall-clock parts in the selected IANA zone.
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

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function addCalendarDays(parts, amount) {
  // UTC is used only for calendar arithmetic here. This is not a fixed 24-hour
  // shift, so the selected local date remains correct across DST transitions.
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function zonedDate(parts, hour, minute, timeZone) {
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  let result = new Date(targetUtc);

  // Resolve selected-zone wall-clock time to an absolute Date without ever
  // falling back to the device zone. Iteration corrects the zone offset; callers
  // use noon/midnight to minimize ambiguous DST-transition wall times.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(result, timeZone);
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const difference = targetUtc - actualUtc;
    if (difference === 0) break;
    result = new Date(result.getTime() + difference);
  }

  return result;
}

function observingDateParts(date, timeZone) {
  const local = zonedParts(date, timeZone);
  const calendarDate = { year: local.year, month: local.month, day: local.day };
  return local.hour < OBSERVING_DAY_CUTOFF_HOUR ? addCalendarDays(calendarDate, -1) : calendarDate;
}

function midpoint(start, end) {
  return new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
}

function collectMoonEvents(start, end, latitude, longitude) {
  const events = { rises: [], sets: [] };
  // SunCalc searches a UTC calendar day. Expand by one day on both sides, then
  // filter absolute instants back to the selected local observing window.
  const firstUtcDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) - DAY_MS;
  const lastUtcDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) + DAY_MS;

  for (let day = firstUtcDay; day <= lastUtcDay; day += DAY_MS) {
    const times = SunCalc.getMoonTimes(new Date(day), latitude, longitude);
    if (isValidDate(times.rise) && times.rise >= start && times.rise <= end) events.rises.push(times.rise);
    if (isValidDate(times.set) && times.set >= start && times.set <= end) events.sets.push(times.set);
  }

  events.rises.sort((a, b) => a - b);
  events.sets.sort((a, b) => a - b);
  return { rise: events.rises[0] || null, set: events.sets[0] || null };
}

function moonVisibility(events, altitude) {
  // An event inside the window is authoritative. Without one, representative
  // sample altitude distinguishes "throughout above" from "throughout below".
  if (events.rise && events.set) return "changes";
  if (events.rise) return "rises";
  if (events.set) return "sets";
  return altitude >= 0 ? "above" : "below";
}

/**
 * Calculate the observing night containing `date` in the selected site's zone.
 *
 * Evening `night` and following-morning `nightEnd` come from two local calendar
 * days. Moon data is sampled at mid-darkness, or local midnight when no complete
 * darkness exists. Displayed rise/set uses local noon-to-noon so events just
 * outside sunset or sunrise stay paired with the relevant observing night.
 * Returned states explicitly distinguish darkness, polar day, Sun-always-below
 * and ordinary no-darkness cases. Terrain and local horizon are not modeled.
 */
export function calculateNightSky({ date = new Date(), latitude, longitude, elevation = 0, timeZone }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !timeZone) return null;

  const observingDate = observingDateParts(date, timeZone);
  const followingDate = addCalendarDays(observingDate, 1);
  // Local-noon anchors select the intended calendar day without device-zone or
  // midnight-transition ambiguity.
  const anchor = zonedDate(observingDate, 12, 0, timeZone);
  const followingAnchor = zonedDate(followingDate, 12, 0, timeZone);
  const height = Number.isFinite(elevation) ? Math.max(0, elevation) : 0;
  const sun = SunCalc.getTimes(anchor, latitude, longitude, height);
  const followingSun = SunCalc.getTimes(followingAnchor, latitude, longitude, height);

  const darknessStart = isValidDate(sun.night) ? sun.night : null;
  const darknessEnd = isValidDate(followingSun.nightEnd) ? followingSun.nightEnd : null;
  const hasDarkness = Boolean(darknessStart && darknessEnd && darknessEnd > darknessStart);

  // Moon visibility describes the broad evening observing window, not only the
  // narrower astronomical-darkness interval.
  const observingWindowStart = isValidDate(sun.sunset)
    ? sun.sunset
    : zonedDate(observingDate, 18, 0, timeZone);
  const observingWindowEnd = isValidDate(followingSun.sunrise)
    ? followingSun.sunrise
    : zonedDate(followingDate, 6, 0, timeZone);
  const safeWindowEnd = observingWindowEnd > observingWindowStart
    ? observingWindowEnd
    : new Date(observingWindowStart.getTime() + 12 * 60 * 60 * 1000);
  const sampleTime = hasDarkness
    ? midpoint(darknessStart, darknessEnd)
    : zonedDate(followingDate, 0, 0, timeZone);

  const illumination = SunCalc.getMoonIllumination(sampleTime);
  const position = SunCalc.getMoonPosition(sampleTime, latitude, longitude);
  // A near-full Moon can rise just before sunset or set just after sunrise.
  // Use a full local noon-to-noon cycle for the displayed event pair while
  // keeping the visibility summary scoped to the actual observing window.
  const moonHorizonStart = zonedDate(observingDate, 12, 0, timeZone);
  const moonHorizonEnd = zonedDate(followingDate, 12, 0, timeZone);
  const moonEvents = collectMoonEvents(moonHorizonStart, moonHorizonEnd, latitude, longitude);
  const observingMoonEvents = collectMoonEvents(observingWindowStart, safeWindowEnd, latitude, longitude);
  const horizonStartsAbove = SunCalc.getMoonPosition(
    new Date(moonHorizonStart.getTime() + 60000),
    latitude,
    longitude
  ).altitude >= 0;
  const durationMinutes = hasDarkness
    ? Math.max(0, Math.round((darknessEnd - darknessStart) / 60000))
    : 0;

  return {
    observingDate,
    followingDate,
    state: hasDarkness
      ? "darkness"
      : sun.alwaysUp
        ? "polarDay"
        : sun.alwaysDown
          ? "sunBelowHorizon"
          : "noDarkness",
    darkness: {
      start: darknessStart,
      end: darknessEnd,
      durationMinutes
    },
    timeline: {
      sunset: isValidDate(sun.sunset) ? sun.sunset : null,
      civilDusk: isValidDate(sun.dusk) ? sun.dusk : null,
      nauticalDusk: isValidDate(sun.nauticalDusk) ? sun.nauticalDusk : null,
      night: darknessStart
    },
    moon: {
      fraction: Math.min(1, Math.max(0, illumination.fraction)),
      phase: ((illumination.phase % 1) + 1) % 1,
      // Nearest eighth indexes the eight localized phase-name buckets.
      phaseIndex: Math.round((((illumination.phase % 1) + 1) % 1) * 8) % 8,
      waxing: illumination.waxing,
      altitude: position.altitude,
      rotation: illumination.angle - position.parallacticAngle,
      sampleTime,
      rise: moonEvents.rise,
      set: moonEvents.set,
      visibility: moonVisibility(observingMoonEvents, position.altitude),
      horizonStart: moonHorizonStart,
      horizonEnd: moonHorizonEnd,
      horizonStartsAbove
    }
  };
}

/**
 * Build the closed illuminated polygon for a `viewBox="0 0 100 100"` Moon.
 * `steps` trades path smoothness for size; observer-relative rotation is applied
 * later by the renderer, not baked into this geometry.
 */
export function createMoonIlluminationPath(fraction, waxing, steps = 56) {
  const illuminated = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (illuminated < 0.001) return "";

  const center = 50;
  const radius = 45;
  const outer = [];
  const terminator = [];

  // Trace the lit outer limb and return along the terminator. Waxing starts on
  // the right limb, waning on the left.
  for (let index = 0; index <= steps; index += 1) {
    const y = -radius + (2 * radius * index) / steps;
    const halfWidth = Math.sqrt(Math.max(0, radius * radius - y * y));
    const outerX = center + (waxing ? halfWidth : -halfWidth);
    const terminatorFactor = waxing ? 1 - 2 * illuminated : 2 * illuminated - 1;
    const terminatorX = center + terminatorFactor * halfWidth;
    outer.push([outerX, center + y]);
    terminator.unshift([terminatorX, center + y]);
  }

  const points = [...outer, ...terminator];
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + " Z";
}
