<!--
  - SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Test fixtures

- `example1.isdoc`, `example2.isdoc` — official ISDOC sample invoices taken from
  the [isdoc/isdoc2ubl](https://github.com/isdoc/isdoc2ubl) repository
  (`test/` directory), licensed under the Apache License 2.0.
- `example1.isdocx` — `example1.isdoc` packed into the ISDOC ZIP container
  format together with a `manifest.xml` pointing to it
  (`maindocument/@filename`), for testing the `.isdocx` code path.
