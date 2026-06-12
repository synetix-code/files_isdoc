<!--
  - SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# ISDOC Viewer pro Nextcloud (`files_isdoc`)

Náhled českých e-faktur ve formátu **ISDOC** (`.isdoc`, `.isdocx`) přímo v aplikaci Nextcloud Viewer. Po kliknutí na soubor se faktura zobrazí jako čitelný doklad namísto nezpracovaného XML.

*Preview of Czech ISDOC e-invoices (`.isdoc`, `.isdocx`) directly in the Nextcloud Viewer.*

![Screenshot](screenshots/screenshot.png)

## Vlastnosti

- Podpora **ISDOC 6.x** i starších dokumentů 5.x.
- Podpora kontejneru **`.isdocx`** (ZIP) včetně **příloh** — jejich stažení, otevření bezpečných typů souborů (PDF, obrázky) a ověření otisku vůči dokladu.
- **Validace dokladu**: kontrola struktury a kontrolních součtů (položky a rekapitulace DPH oproti deklarovaným součtům), jejichž výsledek se zobrazuje v pruzích nad dokladem a pomocí symbolů ✓/⚠ u jednotlivých součtů.
- **Elektronický podpis**: kryptografické ověření integrity dokumentu přímo v prohlížeči a zobrazení detailů podepisujícího certifikátu. Důvěryhodnost certifikátu (certifikační řetězec a stav odvolání) se neověřuje.
- Automatická registrace MIME typů při instalaci, česká a anglická lokalizace, datumy dle locale uživatele.

## Požadavky

- Nextcloud 32–33 s povolenou aplikací **Viewer** (součást standardní instalace Nextcloudu).

## Instalace

**Z App Store** (po zveřejnění aplikace): Aplikace → vyhledat „ISDOC Viewer" → Stáhnout a povolit.

**Ručně ze zdrojových kódů:**

```bash
cd /path/to/nextcloud/apps
git clone https://github.com/synetix-code/files_isdoc.git
cd files_isdoc
npm ci && npm run build

# jako uživatel webserveru, z kořene instalace Nextcloudu:
php occ app:enable files_isdoc
php occ maintenance:mimetype:update-js   # obnoví ikony typů souborů
```

## MIME typy

O vše se postará instalační krok při spuštění příkazu `occ app:enable`: přidá mapování `isdoc` → `application/isdoc+xml` a `isdocx` → `application/isdocx` do `config/mimetypemapping.json` (a ikony do `mimetypealiases.json`), zaregistruje typy v databázi a přemapuje i už nahrané soubory. Existující cizí záznamy nikdy nepřepisuje; při odinstalaci své záznamy zase odebere.

Pokud by krok nemohl zapsat do `config/` (práva), vypíše varování — pak přidejte záznamy ručně a spusťte:

```bash
php occ maintenance:mimetype:update-db --repair-filecache
php occ maintenance:mimetype:update-js
```

## Vývoj

```bash
npm ci
npm run watch        # průběžný development build
npm run appstore     # release tarball do build/files_isdoc.tar.gz
```

Frontend: Vue 2.7 + Vite (`@nextcloud/vite-config` v1.x — musí zůstat na řadě v1, Viewer běží na Vue 2.7). Backend: PHP, integrace přes event `OCA\Viewer\Event\LoadViewer`. Testovací faktury jsou umístěny v `tests/fixtures/` (oficiální vzorky z projektu [isdoc/isdoc2ubl](https://github.com/isdoc/isdoc2ubl) pod licencí Apache-2.0).

## Zdroje / Resources

- Specifikace ISDOC: https://isdoc.cz ([6.0.2](https://isdoc.cz/6.0.2/doc/isdoc.html)); správcem formátu je Ministerstvo vnitra ČR
- Oficiální GitHub organizace ISDOC: https://github.com/isdoc — [schema](https://github.com/isdoc/schema) (XSD), [isdoc2ubl](https://github.com/isdoc/isdoc2ubl) (konverze do UBL + vzorové faktury), [isdoc.pdf](https://github.com/isdoc/isdoc.pdf) (PDF s vloženým XML; zatím nepodporováno)
- Nextcloud Viewer API: https://github.com/nextcloud/viewer

Logo ISDOC je ochranná známka Ministerstva vnitra ČR.

## Licence

[AGPL-3.0-or-later](LICENSES/AGPL-3.0-or-later.txt)
