# Változásnapló

## 0.2.1 – 2026-08-07

- A fő kártyák összecsukhatók.
- A kártyák sorrendje átrendezhető és a böngésző megjegyzi.
- Asztali gépen húzással, mobilon fel/le gombokkal rendezhető.
- Alaphelyzet gomb az eredeti elrendezés visszaállításához.
- Javítva a kártyák DOM-áthelyezésének sorrendje.
- Javítva a helyszínválasztó összecsukása.

## 0.2.0 – 2026-08-06

- Aktuális időjárási összefoglaló a kiválasztott helyhez.
- 12 órás felhőzet-, szél-, csapadék- és harmat-előrejelzés.
- Alacsony, középszintű és magas felhőzet külön megjelenítése.
- Egyszerű, átlátható észlelési minősítés.
- Kézi frissítés és automatikus frissítés helyszínváltáskor.

## 0.1.2 – 2026-08-05

- Helyreállítva az alkalmazás indítása.
- Verziózott kliensfájlokkal megszüntetve a gyorsítótár miatti hibák.
- A teljes működő oldalhoz szükséges `.htaccess` bekerült a forrásba.
- GitHub Actions build-ellenőrzés és letölthető `dist` artifact.

## 0.1.1 – 2026-08-05

- Helyszínváltáskor a régi helyi idő azonnal törlődik.
- A lassabban visszatérő régi időzóna-kérés nem írhatja felül az új helyet.
- Sikertelen lekérésnél nem jelenik meg tévesen a készülék saját időzónája.

## 0.1.0 – 2026-08-05

- Első Astro-prototípus.
- GPS és kézi koordináták.
- Decimális és DMS-formátum.
- Helyi idő, UTC, időzóna, UTC-eltérés és DST.
- Vörös észlelési mód.
