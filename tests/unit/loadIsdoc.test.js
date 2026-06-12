/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import fs from 'node:fs'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { loadIsdoc } from '../../src/services/loadIsdoc.js'

const example1 = fs.readFileSync('tests/fixtures/example1.isdoc', 'utf8')
const example1x = new Uint8Array(fs.readFileSync('tests/fixtures/example1.isdocx'))

const MANIFEST = '<?xml version="1.0" encoding="UTF-8"?>'
	+ '<manifest xmlns="http://isdoc.cz/namespace/2013/manifest">'
	+ '<maindocument filename="invoice.isdoc"/></manifest>'

describe('loadIsdoc', () => {
	it('passes plain XML through with no attachments', () => {
		const result = loadIsdoc(new TextEncoder().encode(example1))
		expect(result.xml).toContain('<Invoice')
		expect(result.attachments).toEqual([])
	})

	it('extracts the main document from an .isdocx container', () => {
		const result = loadIsdoc(example1x)
		expect(result.xml).toContain('FV-111999/2011')
		expect(result.attachments).toEqual([])
	})

	it('separates attachments from the main document', () => {
		const zip = zipSync({
			'manifest.xml': strToU8(MANIFEST),
			'invoice.isdoc': strToU8(example1),
			'priloha.pdf': strToU8('%PDF-fake'),
			'podadresar/logo.bmp': strToU8('BMfake'),
		})
		const result = loadIsdoc(zip)
		expect(result.xml).toContain('<Invoice')
		expect(result.attachments.map((a) => a.name).sort())
			.toEqual(['podadresar/logo.bmp', 'priloha.pdf'])
	})

	it('throws on an archive without an ISDOC document', () => {
		const zip = zipSync({ 'readme.txt': strToU8('nothing here') })
		expect(() => loadIsdoc(zip)).toThrow()
	})
})
