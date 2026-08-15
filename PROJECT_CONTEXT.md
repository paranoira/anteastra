# AnteAstra – Project Context

> Living project memory for humans and coding agents.
>
> Last consolidated: 2026-08-14  
> Current stable baseline at consolidation: **v0.5.0**

## 1. What AnteAstra is

**AnteAstra** is a lightweight, mobile-friendly observing preparation tool for amateur astronomers.

Its core job is simple:

> Put the most useful information an observer needs **before going out under the night sky** in one fast, readable place.

The product is not intended to become a generic weather portal, planetarium replacement, social network, or bloated astronomy suite. Its value is speed, clarity and observing-specific context.

Current public site:

- `https://anteastra.space`
- Hungarian default route: `/`
- English route: `/en`
- Contact: `hello@anteastra.space`
- GitHub repository: `paranoira/anteastra`

The name **AnteAstra** comes from the Latin-inspired combination of *ante* (“before”) and *astra* (“stars”), loosely expressing “before the stars”: the checks and preparation worth doing before an observing session.

## 2. Target users and real-world use case

Primary audience:

- amateur astronomers;
- people preparing a telescope for visual observing or astrophotography;
- users checking conditions quickly from a phone before leaving home or while already at an observing site.

The product originated from a concrete observing workflow where information is often scattered across several apps or websites.

Typical user questions AnteAstra should answer quickly:

- Where exactly am I?
- What are the coordinates of this observing site?
- What is the local time there?
- What is UTC right now?
- Which time zone applies?
- What is the UTC offset?
- Is daylight saving time active?
- What weather matters for observing over the next hours?
- Is the night likely to be usable for observing?
- Later: when does astronomical darkness begin, what is the Moon doing, and what are the seeing/transparency conditions?

Exact coordinates are important not only for display: they can be useful when configuring or aligning telescope equipment.

## 3. Product principles

### 3.1 Less is more

Prefer a small number of useful, well-presented features over a large number of marginal ones.

Do not add complexity merely because a framework, library or API makes it possible.

### 3.2 Observing first

Information should be presented from an astronomer's point of view, not as generic meteorological or technical data.

A feature should answer a practical observing question.

### 3.3 Fast in the field

The interface must remain comfortable on a phone, including outdoors and at night.

Important consequences:

- large enough touch targets;
- little visual noise;
- compact but readable cards;
- no unnecessary navigation hierarchy;
- the most important information should be quickly scannable;
- red observing mode must remain usable.

### 3.4 Progressive enhancement over cleverness

Prefer semantic HTML and straightforward browser APIs.

Avoid unnecessary runtime DOM reconstruction when the structure can live directly in the Astro/HTML markup.

### 3.5 Privacy-conscious by design

Location access should happen only after explicit user action.

The current UI explains that:

- the browser asks for location permission only on request;
- saved location/layout data remain in the browser where applicable;
- coordinates may be sent to external services such as Open-Meteo when needed for weather, elevation or time-zone related data.

Do not claim stronger privacy guarantees than the implementation actually provides.

### 3.6 No fake precision

Astronomical/weather estimates should clearly remain estimates.

Do not imply that model-derived observing conditions are measurements at the user's exact telescope position.

## 4. Current technical baseline

At v0.5.0 the application is:

- Astro-based;
- static output;
- bilingual (HU/EN);
- deployed to `anteastra.space`;
- built with Node/npm;
- designed to work without a backend for the core application.

Current known baseline at consolidation:

- Astro `7.1.4`;
- package name `anteastra`;
- static output;
- `site: "https://anteastra.space"`;
- default locale Hungarian;
- English under `/en`;
- `main` must remain a working/stable branch.

Deployment is currently based on generated static `dist/` content and cPanel hosting. GitHub Actions has been used for build verification/artifacts.

Do not edit production cPanel files manually except for emergency recovery. Build from source instead.

Never commit passwords, API keys, secrets or `.env` files.

## 5. Development history and decisions

### v0.1.0 – core observing data

Initial Astro prototype introduced:

- GPS location;
- manual latitude/longitude entry;
- decimal coordinates;
- DMS coordinates;
- local time;
- UTC;
- IANA time zone;
- UTC offset;
- DST status;
- red observing mode.

### v0.1.1 – location/time correctness

A significant correctness rule was established:

> When location changes, time/time-zone information belonging to the previous location must not remain visible or overwrite the new state later.

Implemented principles included:

- immediately clearing stale local-time data when location changes;
- preventing slower old time-zone requests from overwriting the result of a newer location request;
- not falling back to the device's own time zone in a way that falsely represents the selected location.

This race-condition protection is important and must not be accidentally removed during refactors.

### v0.1.2 – deployment stability

Added/fixed:

- startup recovery;
- versioned client files to reduce stale-cache problems;
- source-controlled `.htaccess`;
- GitHub Actions build checking;
- downloadable `dist` artifact.

### v0.2.0 – observing weather

Added observing-oriented weather for the selected site:

- current summary;
- next 12 hours;
- cloud cover;
- low/mid/high cloud layers;
- wind;
- precipitation probability;
- dew-related information;
- simple observing suitability;
- manual refresh;
- automatic refresh after location change.

Weather is intended as a quick observing aid, not a replacement for specialist forecast analysis.

### v0.2.1 – configurable cards

Added:

- collapsible main cards;
- reorderable cards;
- browser persistence;
- drag reorder on desktop;
- up/down controls on mobile;
- reset-to-default layout.

### v0.3.0 – structural UI cleanup

Important design decision:

> Main card headers and content structure should be present directly in HTML/Astro, not rebuilt at runtime by JavaScript.

Also established:

- full-width main cards;
- no awkward empty half-row after reordering;
- cards may be hidden and restored through settings;
- layout controls behind a compact settings control;
- icon-based collapse/expand controls;
- collapsed location card shows a useful summary (short location or coordinates);
- order, collapsed state and visibility persist in the browser.

### v0.4.0 – AnteAstra identity and bilingual UI

Introduced:

- AnteAstra rebrand;
- Hungarian/English UI;
- mobile sticky header;
- mobile layout/settings control;
- shorter main heading;
- “Miért AnteAstra?” / name-origin section.

### v0.4.1 – weather readability

Introduced:

- weather icons;
- hourly observing suitability;
- colour coding in normal mode;
- colour-neutral behaviour in red observing mode.

This distinction matters: red mode must avoid colour cues that defeat night-vision-friendly presentation.

### v0.5.0 – public launch baseline

Public-launch milestone included:

- official `anteastra.space` domain;
- redirects from previous domains (`timee.hu`, `anteastra.hu`);
- HU/EN experience;
- weather icons and hourly suitability;
- mobile/header refinements;
- canonical URLs;
- sitemap;
- robots.txt.

## 6. Current information architecture

The application currently revolves around configurable cards.

### Location

Purpose:

- request browser geolocation;
- allow manual coordinates;
- establish the location used by downstream data.

Important behaviour:

- browser location permission only after user action;
- changing location must invalidate stale dependent data;
- manual coordinates are a first-class option, not merely a fallback.

### Observing weather

Purpose:

- show the next hours in a form useful to an observer.

Current dimensions include:

- conditions;
- total/cloud-layer information;
- temperature;
- wind/gusts;
- humidity;
- dew point / dew risk;
- hourly outlook;
- observing suitability.

### Coordinates

Purpose:

- provide exact observing-site coordinates in useful formats.

Formats:

- decimal degrees;
- degrees/minutes/seconds.

Also includes:

- GPS accuracy where available;
- elevation estimate where available;
- copy actions.

This card is particularly relevant for telescope/equipment setup.

### Time

Purpose:

- show selected-location local time and UTC side by side.

The selected location, not the user's device location, is authoritative for local-time display.

### Time zone

Purpose:

- provide telescope/setup-relevant time settings.

Includes:

- IANA zone;
- UTC offset;
- abbreviation;
- daylight saving time status;
- copyable complete setup.

## 7. Layout and UX rules already agreed

These are intentional decisions, not accidental implementation details.

- Main cards are full-width.
- Cards can be reordered.
- Cards can be collapsed.
- Cards can be hidden.
- User layout choices persist locally in the browser.
- Desktop can use drag-style reordering.
- Mobile needs explicit accessible move controls.
- A reset action restores the original arrangement.
- A completely hidden-card state must still provide a route back to settings.
- Card controls should remain compact.
- Mobile usability has equal importance to desktop.
- The header includes quick utilities such as UTC and language selection.
- Red observing mode is a product feature, not a cosmetic theme.

Do not replace these behaviours with a rigid dashboard without a strong product reason.

## 8. Internationalization

Supported languages:

- Hungarian (`hu`) – default;
- English (`en`) – `/en`.

Rules:

- new user-facing features should normally ship in both languages;
- avoid hard-coded UI text outside the translation structure unless genuinely language-neutral;
- Hungarian and English wording should be natural, not literal machine translations;
- route-specific SEO metadata should remain language-aware.

Current SEO/i18n infrastructure already includes:

- localized page title;
- localized meta description;
- canonical URLs;
- `hreflang="hu"`;
- `hreflang="en"`;
- `hreflang="x-default"`.

## 9. SEO, sharing and contact

SEO should be useful and technically correct, not keyword-stuffed.

Already present by v0.5.0:

- `<title>`;
- meta description;
- canonical;
- hreflang;
- `robots.txt`;
- bilingual `sitemap.xml`.

The next SEO/contact work discussed for `feature/seo-feedback` includes:

- Open Graph metadata;
- Twitter/X card metadata;
- appropriate JSON-LD structured data;
- a discreet contact/feedback area;
- `mailto:hello@anteastra.space`;
- HU/EN copy;
- social-preview image support when a proper asset exists.

Do **not** create a backend contact form unless there is a real product need.

Do **not** add a poor placeholder Open Graph image merely to tick a box.

Contact identity:

- `hello@anteastra.space`

This address is operational and forwards to Gmail.

## 10. Planned / discussed roadmap

The following ideas have been discussed as natural extensions of the observing-preparation workflow. They are not all committed release scope.

### Twilight and Moon

These belong together in one visually scannable observing card. At a glance, it should answer:

- when useful astronomical darkness begins and ends at the selected site;
- what phase the Moon is in and how much of it is illuminated;
- whether the Moon is likely to be above the horizon during that observing window.

The presentation must remain neutral: a new Moon can favour deep-sky observing, while a bright or full Moon may itself be the intended target. Do not reduce lunar conditions to a universal good/bad score.

Useful details include sunset and twilight milestones, astronomical-darkness duration, Moon phase and illumination, Moon rise/set, and altitude context. The value is observing context, not decorative lunar trivia.

### Seeing and transparency

Both have been identified as valuable future observing metrics.

They should not be presented as interchangeable:

- **seeing** relates to atmospheric steadiness;
- **transparency** relates to clarity/extinction.

Any model/source should be clearly identified and limitations respected.

### Saved observing locations

Potentially allow users to save frequently used sites locally.

Principles:

- browser-local storage is preferred unless account/cloud sync becomes a real requirement;
- switching sites must correctly refresh all dependent time/weather/astronomy state.

### Possible broader observing dashboard

AnteAstra may gradually become a complete “pre-observation quick panel”, but the interface should stay focused.

Candidate future information should earn its place by reducing the number of other apps/pages an observer must check.

## 11. Ideas to treat cautiously

### Accounts and backend infrastructure

Not currently needed for the core value proposition.

Do not introduce authentication, databases or user accounts simply to save settings that local storage can handle.

### Contact form backend

Current email feedback can be handled with `mailto:`.

A backend form adds spam protection, data handling and operational burden.

### Dependency growth

Do not add a package for something that clean Astro/HTML/JavaScript can reasonably handle.

### Generic weather overload

Avoid filling the screen with standard forecast metrics simply because the API provides them.

Prioritize information that affects observing.

### Decorative astronomy

Avoid turning AnteAstra into a visual planetarium or astronomy-news site unless product direction explicitly changes.

## 12. Data correctness and state-management rules

Several current features depend on a shared selected location. This creates an important invariant:

> A piece of displayed data must belong to the currently selected observing location.

When location changes:

1. invalidate or clear stale dependent UI promptly;
2. start new requests for the new location;
3. ensure old asynchronous responses cannot overwrite newer state;
4. avoid device-local fallbacks that masquerade as selected-location data.

This applies to:

- time zone;
- local time;
- weather;
- elevation;
- future twilight/Moon/seeing/transparency data.

## 13. Accessibility expectations

Accessibility is part of implementation quality.

Keep:

- semantic sections/headings;
- proper labels;
- accessible button names;
- keyboard-operable controls;
- `aria-expanded` / dialog semantics where applicable;
- status/live-region behaviour where useful;
- skip link;
- understandable control states without relying only on colour.

Red mode and observing suitability must not depend solely on colours.

## 14. Mobile and outdoor-use expectations

Always test mentally and technically for:

- narrow screens;
- touch interaction;
- sticky header behaviour;
- card settings access;
- expanded and collapsed card states;
- bright daytime use;
- dark/red observing mode;
- poor field connectivity.

Avoid interactions that require precise mouse behaviour.

## 15. Visual direction

The current AnteAstra visual identity should be preserved unless deliberately redesigned.

General character:

- dark astronomy-oriented UI;
- clean, restrained;
- modern rather than ornamental;
- compact controls;
- clear hierarchy;
- suitable for field use;
- red observing mode.

Do not turn it into a “space wallpaper” aesthetic at the expense of readability.

## 16. Repository and Git workflow

Repository:

- `paranoira/anteastra`

Stable branch:

- `main`

Rules already documented for the project:

- `main` should always remain working;
- new features use a feature branch;
- fixes use a fix branch;
- build/check before merging;
- deploy generated build output rather than hand-editing production.

Examples:

- `feature/seo-feedback`
- `feature/location-name`
- `fix/timezone-refresh`

A branch should contain one coherent scope where practical.

## 17. Definition of a good AnteAstra feature

Before adding a feature, ask:

1. Does this help an amateur astronomer prepare for observing?
2. Is it faster or clearer here than checking another generic app?
3. Can it be explained at a glance?
4. Does it work on mobile?
5. Does it remain usable in red mode?
6. Does it correctly follow the selected observing location?
7. Can it be implemented without unnecessary backend/dependencies?
8. Does it preserve the project's calm, compact interface?

If several answers are “no”, the feature probably does not belong yet.

## 18. Current product sentence

Hungarian concept:

> Hely, pontos idő és az észleléshez fontos időjárási adatok – gyorsan, egy helyen, mielőtt az éjszakai ég alá indulsz.

English concept:

> Location, precise time and the weather data that matters for observing – quickly, in one place, before you head out under the night sky.

These express the current product better than a generic “astronomy dashboard” label.

## 19. How to maintain this file

Update this document when a decision changes product intent, architecture or UX conventions.

Do not turn it into a duplicate CHANGELOG.

Use:

- `CHANGELOG.md` for what shipped;
- `README.md` for setup/deployment basics;
- `PROJECT_CONTEXT.md` for why the product works the way it does;
- `AGENTS.md` for coding-agent operating rules.
