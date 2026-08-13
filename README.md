# AnteAstra

Gyors hely-, idő- és időjárási segéd amatőr csillagászoknak.

Éles oldal: https://timee.hu

## Fejlesztői környezet

Szükséges:

- Node.js 22.12 vagy újabb támogatott páros verzió
- npm

```bash
npm install
npm run dev
```

Az Astro fejlesztői szervere ezután kiírja a helyi címet.

## Éles build

```bash
npm run build
```

A publikálható oldal a `dist/` könyvtárba kerül. A `dist/` nincs Gitben,
mert minden kiadáskor újragenerálható.

## Telepítés cPanelre

1. Futtasd az `npm run build` parancsot, vagy töltsd le a GitHub Actions
   által készített `anteastra-dist` artifactot.
2. A `dist/` tartalmát töltsd fel a `public_html/` gyökerébe.
3. Az `index.html` közvetlenül a `public_html/` alatt legyen.
4. Frissítés után ellenőrizd a `https://timee.hu/VERSION.txt` címet.

## Munkafolyamat

- A `main` ág mindig működő állapotot tartalmazzon.
- Új funkció külön ágon készüljön, például `feature/location-name`.
- Hibajavítás külön ágon készüljön, például `fix/timezone-refresh`.
- A cPanel fájljait ne szerkeszd kézzel, kivéve sürgős helyreállításkor.
- Jelszót, API-kulcsot és `.env` fájlt soha ne commitolj.
