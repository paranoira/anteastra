# Timee v0.2.0 – időjárási panel

A csomag csak a módosított forrásfájlokat tartalmazza. A GitHub workflow-kat,
a `package-lock.json` fájlt és a deploy beállításokat nem írja felül.

## Frissítés GitHub Desktop használatával

1. Klónozd vagy nyisd meg a `paranoira/timee` repositoryt GitHub Desktopban.
2. Csomagold ki ezt a ZIP-et.
3. A kicsomagolt fájlokat másold a helyi repository gyökerébe, felülírva az azonos fájlokat.
4. GitHub Desktopban ellenőrizd, hogy csak ezek változtak:
   - `src/pages/index.astro`
   - `src/scripts/app.js`
   - `src/styles/global.css`
   - `public/VERSION.txt`
   - `CHANGELOG.md`
   - `README.md`
5. Commit üzenet: `feat: add observing weather panel`
6. Push origin.
7. Ellenőrizd a `Build Timee` workflow zöld futását.
8. Az élesítéshez indítsd el kézzel a `Deploy Timee` workflow-t.

## Funkciók

- Aktuális felhőzet és alacsony/közép/magas felhőréteg.
- Hőmérséklet, páratartalom és harmatpont.
- Szél, szélirány és széllökés.
- 12 órás előrejelzés kétóránkénti, mobilon görgethető kártyákkal.
- Csapadékesély és várható csapadékmennyiség.
- Egyszerű „Ígéretes / Változó / Kedvezőtlen” összegzés.
- Automatikus frissítés helyszínváltáskor, kézi Frissítés gombbal.

## Fontos

Az összegzés nem seeing-előrejelzés. Felhőzet, csapadékesély, szél és széllökés
alapján ad gyors tájékoztatást. A harmatveszély a hőmérséklet és a harmatpont
közelségéből készülő becslés.
