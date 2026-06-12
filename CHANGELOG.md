<!--
  - SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

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
