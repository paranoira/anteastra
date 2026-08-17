# AnteAstra

Gyors hely-, idő-, időjárás- és égállapot-segéd amatőr csillagászoknak.

Éles oldal: https://anteastra.space

## Fő funkciók

- GPS-szel, kézi koordinátával vagy opcionális térképes kijelöléssel megadott észlelőhely.
- Pontos koordináták, helyi idő, UTC és időzónaadatok.
- Észlelésközpontú időjárási összefoglaló és 12 órás előrejelzés.
- Csillagászati sötétség, szürkületi időpontok és Holdállás egy közös kártyán.
- Kétfüles beállításdialogban átrendezhető és elrejthető, a főoldalon összecsukható kártyák helyi mentéssel.
- Magyar és angol felület, mobilos használat és vörös észlelési mód.

## Fejlesztői környezet

Szükséges:

- Node.js 22.12 vagy újabb támogatott páros verzió
- npm

Friss klónban:

```bash
npm ci
npm run dev
```

Az Astro fejlesztői szervere ezután kiírja a helyi címet.

Az architektúrát, az adatfolyamokat, a bővítési recepteket és a teljes ellenőrzési mátrixot a [fejlesztői kézikönyv](DEVELOPMENT.md) tartalmazza.

A böngészőbe csomagolt külső könyvtárak licenceit a [`public/THIRD_PARTY_NOTICES.txt`](public/THIRD_PARTY_NOTICES.txt) fájl tartalmazza.

## Éles build

```bash
npm run build
```

A publikálható oldal a `dist/` könyvtárba kerül. A `dist/` nincs Gitben,
mert minden kiadáskor újragenerálható.

## Telepítés cPanelre

Az ajánlott éles deploy a GitHub Actions `Deploy AnteAstra` workflowja:

1. A GitHubon nyisd meg az **Actions → Deploy AnteAstra** workflowt.
2. A **Run workflow** menüben válaszd ki a deployolni kívánt branchet vagy taget.
3. A workflow `npm ci` és `npm run build` után FTPS-en feltölti a `dist/` tartalmát a cPanel tárhelyre.
4. Sikeres futás után ellenőrizd a `https://anteastra.space` oldalt és a `https://anteastra.space/VERSION.txt` címet.

Normál kiadásnál a `main` branch deployolandó. Feature branch csak tudatos production előnézethez választható, mert ugyanazt az éles tárhelyet frissíti.

Manuális tartalékfolyamat:

1. Futtasd az `npm run build` parancsot, vagy töltsd le a GitHub Actions
   által készített `anteastra-dist` artifactot.
2. A `dist/` tartalmát töltsd fel a `public_html/` gyökerébe.
3. Az `index.html` közvetlenül a `public_html/` alatt legyen.
4. Frissítés után ellenőrizd az éles oldalt és a `VERSION.txt` fájlt.

## Domain

- Elsődleges domain: `anteastra.space`
- A `timee.hu` és az `anteastra.hu` címek 301-es átirányítással az `anteastra.space` megfelelő útvonalára mutatnak.
- A `www` változatok szintén az elsődleges `https://anteastra.space` címre irányítanak.

## Munkafolyamat

- A `main` ág mindig működő állapotot tartalmazzon.
- Új funkció külön ágon készüljön, például `feature/location-name`.
- Hibajavítás külön ágon készüljön, például `fix/timezone-refresh`.
- A cPanel fájljait ne szerkeszd kézzel, kivéve sürgős helyreállításkor.
- Jelszót, API-kulcsot és `.env` fájlt soha ne commitolj.
- Nem triviális módosítás előtt olvasd el az `AGENTS.md`, `PROJECT_CONTEXT.md`, `DEVELOPMENT.md` és `CHANGELOG.md` releváns részeit.
