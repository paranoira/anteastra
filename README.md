# Timee

Gyors hely-, koordináta-, időzóna- és idősegéd amatőr csillagászoknak.

## Követelmények

- Node.js 22.12.0 vagy újabb, páros főverzió
- npm

## Helyi fejlesztés

```bash
npm install
npm run dev
```

Az Astro fejlesztői szervere alapértelmezetten a `http://localhost:4321` címen indul.

## Éles build

```bash
npm run build
```

A feltölthető statikus oldal a `dist/` mappába készül. A `dist/` tartalma kerül a timee.hu `public_html` könyvtárába.

## v0.1.1

A helyszín módosításakor a helyi idő és az időzóna minden esetben az új koordinátához frissül. A régi adatok a lekérés alatt nem maradnak láthatók, és a párhuzamos kérések nem írhatják felül egymást.
