import * as SunCalc from "suncalc";

const DAY_MS = 24 * 60 * 60 * 1000;
const OBSERVING_DAY_CUTOFF_HOUR = 6;

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function zonedParts(date, timeZone) {
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

  // Resolve a local wall-clock time without falling back to the device time zone.
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
  if (events.rise && events.set) return "changes";
  if (events.rise) return "rises";
  if (events.set) return "sets";
  return altitude >= 0 ? "above" : "below";
}

export function calculateNightSky({ date = new Date(), latitude, longitude, elevation = 0, timeZone }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !timeZone) return null;

  const observingDate = observingDateParts(date, timeZone);
  const followingDate = addCalendarDays(observingDate, 1);
  const anchor = zonedDate(observingDate, 12, 0, timeZone);
  const followingAnchor = zonedDate(followingDate, 12, 0, timeZone);
  const height = Number.isFinite(elevation) ? Math.max(0, elevation) : 0;
  const sun = SunCalc.getTimes(anchor, latitude, longitude, height);
  const followingSun = SunCalc.getTimes(followingAnchor, latitude, longitude, height);

  const darknessStart = isValidDate(sun.night) ? sun.night : null;
  const darknessEnd = isValidDate(followingSun.nightEnd) ? followingSun.nightEnd : null;
  const hasDarkness = Boolean(darknessStart && darknessEnd && darknessEnd > darknessStart);

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
  const moonEvents = collectMoonEvents(observingWindowStart, safeWindowEnd, latitude, longitude);
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
      phaseIndex: Math.round((((illumination.phase % 1) + 1) % 1) * 8) % 8,
      waxing: illumination.waxing,
      altitude: position.altitude,
      rotation: illumination.angle - position.parallacticAngle,
      sampleTime,
      rise: moonEvents.rise,
      set: moonEvents.set,
      visibility: moonVisibility(moonEvents, position.altitude)
    }
  };
}

export function createMoonIlluminationPath(fraction, waxing, steps = 56) {
  const illuminated = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (illuminated < 0.001) return "";

  const center = 50;
  const radius = 45;
  const outer = [];
  const terminator = [];

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
