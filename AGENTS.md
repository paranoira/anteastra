# AGENTS.md — AnteAstra

This file defines working rules for coding agents operating in the AnteAstra repository.

Read `PROJECT_CONTEXT.md`, `README.md` and `CHANGELOG.md` before making non-trivial product changes.

## Mission

AnteAstra is a fast observing-preparation tool for amateur astronomers.

Optimize for:

1. correctness;
2. field usability;
3. mobile usability;
4. clarity;
5. low complexity.

Do not optimize for feature count.

## Repository

- Repo: `paranoira/anteastra`
- Stable branch: `main`
- Production: `https://anteastra.space`
- Contact: `hello@anteastra.space`
- Current baseline when this file was introduced: v0.5.0
- Stack: Astro, static output, vanilla browser JavaScript/CSS where appropriate

`main` must remain deployable.

Never implement feature work directly on `main` unless explicitly instructed.

Use coherent branches, e.g.:

- `feature/<name>`
- `fix/<name>`
- `chore/<name>`

## Before changing code

1. Run `git status -sb`.
2. Identify the current branch.
3. Do not overwrite unrelated local changes.
4. Inspect the relevant current files instead of assuming structure from previous versions.
5. Read nearby code before editing.
6. For user-facing changes, inspect both HU and EN translations.
7. For location-dependent features, trace stale-request/race-condition handling before refactoring.
8. Prefer the smallest change that fully solves the task.

If the branch is behind `main`, update it safely before feature work unless doing so would overwrite uncommitted work.

## Required checks

At minimum for normal application changes:

```bash
npm install
npm run build
```

Use the existing lockfile and package manager.

Do not upgrade dependencies merely because newer versions exist unless the task is dependency maintenance or the upgrade is required for the feature/fix.

If you add or change JavaScript behaviour, verify that the generated static build succeeds and inspect relevant browser-facing logic for runtime assumptions.

## Architecture principles

### Static-first

Keep the core application deployable as a static Astro site.

Do not introduce a backend unless the requested feature genuinely requires server-side capability.

### Semantic HTML first

Prefer semantic HTML/Astro structure over runtime DOM construction.

Existing main card structure intentionally lives in markup rather than being rebuilt by JavaScript.

Do not regress this without a compelling reason.

### Vanilla solutions before dependencies

Prefer:

- platform/browser APIs;
- Astro primitives;
- small local utility functions.

Avoid new packages for trivial behaviour.

Any new dependency must have a clear maintenance and product benefit.

### Separate concerns

Keep:

- translations in the translation layer;
- presentation in CSS;
- browser state/interaction in appropriate scripts;
- page structure in Astro components/pages.

Do not scatter duplicate strings or configuration across unrelated files.

## Selected-location invariant

The selected observing site is a central piece of application state.

A displayed location-dependent value must belong to the **current selected location**.

When location changes:

- clear/invalidate stale dependent information promptly;
- request new information;
- prevent old async responses from overwriting newer results.

This applies to current and future:

- time zone;
- local time;
- weather;
- elevation;
- twilight;
- Moon data;
- seeing;
- transparency.

Do not reintroduce the historical bug where an older slower request can replace data for a newer location.

Do not display the device's own time zone as if it were the selected observing site's zone after a failed lookup.

## Location behaviour

Support both:

- browser geolocation;
- manual latitude/longitude entry.

Manual coordinates are a supported primary workflow.

Do not force GPS.

Location permission must be requested only after explicit user interaction.

If adding saved locations, default to local/browser storage unless cloud sync is explicitly required.

## UI rules

Preserve the existing configurable-card model.

Main cards are intentionally:

- full width;
- collapsible;
- reorderable;
- hideable;
- locally persisted.

Desktop and mobile controls may differ where appropriate.

Do not remove:

- mobile-accessible reorder controls;
- reset-to-default behaviour;
- a way to reopen settings when all cards are hidden.

Controls should remain compact but accessible.

Do not redesign the dashboard into a rigid grid merely for visual novelty.

## Mobile rules

Every user-facing change must work on narrow touch screens.

Check:

- touch-target size;
- sticky header interactions;
- settings access;
- text wrapping;
- card collapsed state;
- long coordinate/time-zone strings;
- dialogs;
- HU and EN text lengths.

Avoid mouse-only interactions.

## Red observing mode

Red mode is functional astronomy UX, not decoration.

Changes must remain usable in red mode.

Do not encode important state only through colour.

For observing suitability:

- normal mode may use colour cues;
- red mode should remain night-vision-friendly and not depend on multi-colour status encoding.

Do not introduce bright white/blue UI elements that break the observing-mode intent.

## Internationalization

Supported locales:

- `hu` — default `/`
- `en` — `/en`

All normal user-facing features must include both languages.

Do not hard-code translatable prose directly into components/scripts when it belongs in `src/i18n/translations.js` or its future replacement.

Translations should sound natural in each language.

Maintain language-specific:

- title;
- description;
- labels;
- accessibility text;
- SEO/social metadata where appropriate.

## SEO rules

Do not duplicate or break existing SEO infrastructure.

Existing baseline includes:

- page title;
- meta description;
- canonical;
- HU/EN/x-default hreflang;
- robots.txt;
- sitemap.xml.

When editing SEO:

- keep canonical URLs route-correct;
- keep locales aligned;
- use human-readable copy;
- avoid keyword stuffing;
- do not add fake organization/person facts to structured data.

For structured data, choose the schema that truthfully describes the product.

For Open Graph/social cards:

- use a real final image when one exists;
- do not commit a low-quality placeholder merely to populate `og:image`.

## Contact / feedback

Current public contact:

`hello@anteastra.space`

For simple feedback/contact UX, a `mailto:` link is acceptable and preferred over building backend infrastructure.

Do not add a server-side contact form, database or spam-handling stack unless explicitly required.

## Weather rules

Weather must be framed for observing.

Prioritize:

- cloud cover;
- cloud layers;
- wind;
- precipitation;
- humidity/dew;
- observing suitability.

Avoid adding generic forecast metrics simply because the API exposes them.

Clearly treat forecast/model data as estimates.

Do not imply site-level measurement precision.

## Future astronomy features

Likely product-aligned future areas include:

- sunset and twilight;
- astronomical darkness;
- Moon phase/illumination/rise/set;
- seeing;
- transparency;
- saved observing locations.

When implementing them, focus on the observing decision they support.

Example:

Bad product framing:

> Show every solar ephemeris value available.

Better framing:

> Make it obvious when useful astronomical darkness begins at the selected site.

Do not implement roadmap items unless they are in the requested scope.

## Accessibility

Preserve or improve:

- semantic headings/sections;
- labels;
- skip link;
- keyboard operability;
- focus behaviour;
- dialog semantics;
- `aria-expanded`;
- accessible names for icon buttons;
- useful live/status regions.

Do not rely on colour alone.

Icon-only controls require accessible names.

## Privacy

Do not overstate privacy.

Location-related UI should remain clear about when location is requested and where data may be sent.

Do not add analytics, trackers, fingerprinting or third-party embeds without explicit product approval.

Never log or commit sensitive user coordinates as part of development/debugging fixtures unless deliberately anonymized.

## Performance and resilience

AnteAstra is used as a quick tool, potentially in the field.

Prefer:

- small static output;
- minimal client JavaScript;
- graceful loading/error states;
- useful behaviour on slow connections.

Avoid heavy client frameworks or large assets without a demonstrated benefit.

A failed external data request should degrade clearly, not leave stale values that appear current.

## CSS and visual design

Preserve the current restrained astronomy-oriented visual language.

Do not introduce:

- ornamental “space” backgrounds that reduce readability;
- unnecessary animation;
- gratuitous gradients/effects;
- inconsistent component styles.

New UI should look like it already belongs in AnteAstra.

When adding styles, reuse existing variables/patterns where possible.

## Scope discipline

Do not refactor unrelated code while implementing a small feature unless the refactor is required to do the work safely.

Do not silently change product wording, behaviour or layout outside scope.

If a nearby issue is discovered:

- fix it only if tiny, clearly safe and directly related;
- otherwise report it separately.

Keep commits understandable.

## Git and release behaviour

For feature/fix work:

1. work on the requested non-main branch;
2. run build/checks;
3. summarize changed files;
4. commit with a concise meaningful message;
5. push if authenticated and requested/allowed;
6. do not merge to `main` automatically unless explicitly instructed.

Do not create a release or bump the version unless requested.

Do not deploy production manually unless the workflow/task explicitly includes deployment.

## Definition of done

A change is not done merely because it compiles.

For user-facing work, confirm that it:

- works for HU and EN;
- works on mobile and desktop;
- respects red mode where applicable;
- follows the selected-location invariant;
- does not introduce stale async state;
- remains accessible;
- adds no unnecessary dependency;
- builds successfully;
- stays within requested scope.

## Agent response style

After implementation, report concisely:

- branch;
- files changed;
- what changed;
- validation performed;
- commit/push status;
- any real remaining caveat.

Do not pad the report with generic development commentary.
