<!--
  - SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

## 0.6.2 – 2026-09-22

### Changed

- Raised the maximum supported Nextcloud version to 35. Verified against
  Nextcloud 34.0.2 with Viewer 7 (still Vue 2.7, handler API unchanged);
  Nextcloud 35 is declared ahead of its release.

### Fixed

- The install/update repair step no longer assumes `IMimeTypeLoader::
  updateFilecache()` exists — it was only added to the interface in Nextcloud
  32, while the app declares support from Nextcloud 28.

## 0.6.1 – 2026-06-16

### Changed

- Reworded the app store description (English and Czech).
- Lowered the minimum Nextcloud version from 32 to 28 (the app uses no API
  newer than Nextcloud 21; frontend libraries are bundled).

## 0.6.0 – 2026-06-12

First public release.

### Added

- Readable invoice preview for `.isdoc` and `.isdocx` files in the Nextcloud
  Viewer (header, parties, lines, VAT recapitulation, totals, payment info),
  laid out like common Czech accounting software output.
- Faithful display — amounts are never recalculated or reformatted.
- `.isdocx` ZIP container support including attachments (download, opening
  of safe types, digest verification).
- Document validation: structure check, control sums compared against the
  declared totals, shown as banners and ✓/⚠ marks.
- Cryptographic verification of the enveloped XML signature (document
  integrity) with certificate details; certificate trust is not verified.
- Automatic MIME type registration on install (repair step), removal on
  uninstall.
- Czech and English localisation; dates formatted per the user's locale.
- Unit test suite (vitest) covering the parser, validation, container
  loading and attachment handling.
