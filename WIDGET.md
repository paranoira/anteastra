# AnteAstra widget

The compact widget is available at:

```text
https://anteastra.space/widget
```

It is designed for a roughly 280–360 px wide sidebar. Its height is normally
about 330 px and grows while the location controls are open. The widget sends
its current content height to the parent page with an
`anteastra:widget-height` `postMessage` event.

## Suggested embed

```html
<iframe
  id="anteastra-widget"
  title="AnteAstra észlelési előrejelzés"
  src="https://anteastra.space/widget?lang=hu"
  width="100%"
  height="340"
  loading="lazy"
  allow="geolocation"
  style="display:block;max-width:360px;border:0"
></iframe>

<script>
  window.addEventListener("message", (event) => {
    if (event.origin !== "https://anteastra.space") return;
    if (event.data?.type !== "anteastra:widget-height") return;

    const widget = document.getElementById("anteastra-widget");
    if (widget && Number.isFinite(event.data.height)) {
      widget.height = String(Math.max(300, Math.ceil(event.data.height)));
    }
  });
</script>
```

The `allow="geolocation"` attribute is needed only for the optional **Saját
helyzet** action. GPS permission is still requested only after a click.

The `lang` query parameter accepts `hu` or `en`. Without it, the widget chooses
between the two supported languages from the visitor's browser language.

## Location behaviour

- If an AnteAstra location is available in the same browser storage context,
  the widget starts with that location.
- Otherwise it starts at **MCSE Csillagtanya**, using the official published
  coordinates `47.29923, 18.57879`.
- The visitor can restore Csillagtanya, request GPS after an explicit click, or
  enter latitude and longitude manually.
- Successful choices use the existing `timee.location.v1` contract, so they are
  shared with the full AnteAstra site where browser storage policy permits it.
- Browsers may partition or block storage for a cross-site iframe. In that case
  the widget still works but cannot see a location saved during a top-level
  AnteAstra visit.

## Data and future extension

The first version shows the local date, six two-hour samples from the next
twelve hours with a weather pictogram and cloud percentage, plus Moon phase,
illumination, rise and set. Weather and time-zone data come from Open-Meteo;
Moon data is calculated locally with the existing astronomy module.

The planned “top three visible sky events” section is intentionally not part of
the first version. It needs a separately selected ephemeris source and a clear,
testable ranking rule before it can be presented as location-specific advice.
