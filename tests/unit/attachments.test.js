/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest'

import { formatSize, mergeAttachments, openableMime } from '../../src/services/attachments.js'

describe('mergeAttachments', () => {
	it('matches declared names case-insensitively and across path separators', () => {
		const supplements = [
			{ filename: 'Logo.bmp', isPreview: false },
			{ filename: 'stare doklady\\dalsi.isdoc', isPreview: false },
			{ filename: 'chybejici.pdf', isPreview: false },
		]
		const files = [
			{ name: 'logo.bmp', data: new Uint8Array([1]) },
			{ name: 'stare doklady/dalsi.isdoc', data: new Uint8Array([2]) },
			{ name: 'navic.txt', data: new Uint8Array([3]) },
		]
		const items = mergeAttachments(supplements, files)
		expect(items).toHaveLength(4)
		expect(items[0].data).toEqual(new Uint8Array([1]))
		expect(items[1].displayName).toBe('stare doklady/dalsi.isdoc')
		expect(items[1].data).toEqual(new Uint8Array([2]))
		// declared but missing in the archive
		expect(items[2].data).toBeNull()
		// present but undeclared, appended last
		expect(items[3].displayName).toBe('navic.txt')
		expect(items[3].supplement).toBeNull()
	})
})

describe('openableMime', () => {
	it('allows only safe types', () => {
		expect(openableMime('faktura.PDF')).toBe('application/pdf')
		expect(openableMime('logo.bmp')).toBe('image/bmp')
		expect(openableMime('podminky.doc')).toBeNull()
		expect(openableMime('evil.html')).toBeNull()
	})
})

describe('formatSize', () => {
	it('formats sizes in human-readable units', () => {
		expect(formatSize(500)).toBe('500 B')
		expect(formatSize(2048)).toBe('2.0 kB')
		expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB')
	})
})
