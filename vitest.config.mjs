/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'jsdom',
		include: ['tests/unit/**/*.test.js'],
	},
})
