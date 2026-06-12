<!--
  - SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# ISDOC Viewer pro Nextcloud (`files_isdoc`)

Náhled českých e-faktur ve formátu **ISDOC** (`.isdoc`, `.isdocx`) přímo v Nextcloud Vieweru. Po kliknutí na soubor se faktura zobrazí jako čitelný doklad (hlavička, dodavatel/odběratel, položky, rekapitulace DPH, součty, platební údaje) namísto syrového XML.

*Preview of Czech ISDOC e-invoices (`.isdoc`, `.isdocx`) directly in the Nextcloud Viewer. The invoice is rendered as a readable document instead of raw XML.*

## Vlastnosti

- Podpora formátu **ISDOC 6.x** (tolerantní parser zvládne i starší dokumenty 5.x).
- Podpora kontejneru **`.isdocx`** (ZIP) — hlavní dokument se hledá podle `manifest.xml`, s fallbackem na první `*.isdoc` v archivu.
- **Věrné zobrazení**: žádné částky se nedopočítávají ani nepřeformátovávají, zobrazují se přesně hodnoty z dokladu.
- **Validace dokladu** (po vzoru oficiálního ISDOC Readeru): kontrola struktury (namespace, povinné elementy) a **kontrolní součty** — součet položek a rekapitulace DPH se porovnají s deklarovanými součty dokladu. Výsledek se zobrazí v pruzích nad dokladem a jako ✓/⚠ u součtových řádků; zobrazené hodnoty zůstávají vždy ty z dokladu. U podepsaných dokumentů se zobrazí informace o přítomnosti elektronického podpisu (podpis se neověřuje).
- Automatická registrace MIME typů při instalaci (repair step) — bez ručních zásahů do konfigurace.
- Česká a anglická lokalizace.

## Požadavky

- Nextcloud 32–33
- Povolená aplikace **Viewer** (součást standardní instalace)

## Instalace

### Z App Store (až bude publikováno)

1. V administraci Nextcloudu otevřete **Aplikace** a vyhledejte „ISDOC Viewer".
2. Klikněte na **Stáhnout a povolit**.

### Ručně ze zdrojových kódů

```bash
cd /path/to/nextcloud/apps
git clone https://github.com/synetix-code/files_isdoc.git
cd files_isdoc
npm ci
npm run build            # vytvoří js/files_isdoc-main.mjs

# jako uživatel webserveru, z kořene instalace Nextcloudu:
php occ app:enable files_isdoc
```

## MIME typy a occ kroky

Aplikace při povolení (`occ app:enable files_isdoc`) sama spustí instalační repair step, který:

1. přidá do `config/mimetypemapping.json` mapování:

   ```json
   {
       "isdoc": ["application/isdoc+xml"],
       "isdocx": ["application/isdocx"]
   }
   ```

2. přidá do `config/mimetypealiases.json` aliasy ikon (`x-office-document`),
3. zaregistruje MIME typy v databázi a **přemapuje už nahrané** soubory `*.isdoc` / `*.isdocx` (z `application/octet-stream` na správný typ).

Existující záznamy v konfiguračních souborech se nikdy nepřepisují; při odinstalaci se naše záznamy zase odeberou.

Po instalaci je vhodné obnovit vygenerovaný seznam MIME typů pro ikony souborů:

```bash
php occ maintenance:mimetype:update-js
```

Pokud by repair step nemohl zapsat do `config/` (např. kvůli právům), vypíše varování — pak přidejte výše uvedené záznamy ručně a spusťte:

```bash
php occ maintenance:mimetype:update-db --repair-filecache
php occ maintenance:mimetype:update-js
```

> **Pozor na pořadí:** dokud nejsou MIME typy zaregistrované, jsou soubory `.isdoc` detekované jako `application/octet-stream` a kliknutí na ně vyvolá stažení místo náhledu.

## Vývoj

```bash
npm ci
npm run watch            # průběžný development build
make appstore            # release tarball do build/files_isdoc.tar.gz
```

Frontend: Vue 2.7 + Vite (`@nextcloud/vite-config` v1.x — musí zůstat na řadě v1, Viewer běží na Vue 2.7). Backend: PHP, integrace přes event `OCA\Viewer\Event\LoadViewer`.

Testovací faktury jsou v `tests/fixtures/` (oficiální vzorky z [isdoc/isdoc2ubl](https://github.com/isdoc/isdoc2ubl), Apache-2.0).

### Publikace do App Store

Release je potřeba podepsat certifikátem získaným při [registraci aplikace](https://apps.nextcloud.com/developer/apps/releases/new) na apps.nextcloud.com (vygenerování CSR → vydání certifikátu → podpis tarballu, viz výstup `make appstore`). Postup popisuje [dokumentace App Store](https://nextcloudappstore.readthedocs.io/en/latest/developer.html).

## Zdroje / Resources

- Specifikace ISDOC: https://isdoc.cz (aktuálně [6.0.2](https://isdoc.cz/6.0.2/doc/isdoc.html))
- Oficiální GitHub organizace ISDOC: https://github.com/isdoc
  - [isdoc/schema](https://github.com/isdoc/schema) — zdrojová XSD schémata standardu
  - [isdoc/isdoc2ubl](https://github.com/isdoc/isdoc2ubl) — konverze do UBL (EN 16931) + vzorové faktury
  - [isdoc/isdoc.pdf](https://github.com/isdoc/isdoc.pdf) — související formát ISDOC.PDF (PDF s vloženým XML; tato aplikace jej zatím nepodporuje)
- Nextcloud Viewer API: https://github.com/nextcloud/viewer

## Licence

[AGPL-3.0-or-later](LICENSES/AGPL-3.0-or-later.txt)
