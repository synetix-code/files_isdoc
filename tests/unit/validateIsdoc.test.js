/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { parseIsdoc } from '../../src/services/parseIsdoc.js'
import { checkStructure, checkSums } from '../../src/services/validateIsdoc.js'

const example1 = fs.readFileSync('tests/fixtures/example1.isdoc', 'utf8')
const signed = fs.readFileSync('tests/fixtures/signed-sample.isdoc', 'utf8')

describe('checkStructure', () => {
	it('accepts a well-formed ISDOC 6.x document', () => {
		const result = checkStructure(parseIsdoc(example1))
		expect(result.unknownNamespace).toBeNull()
		expect(result.isLegacyNamespace).toBe(false)
		expect(result.missingElements).toEqual([])
	})

	it('reports an unknown namespace', () => {
		const xml = example1.replace('http://isdoc.cz/namespace/2013', 'http://example.com/ns')
		expect(checkStructure(parseIsdoc(xml)).unknownNamespace).toBe('http://example.com/ns')
	})
})

describe('checkSums', () => {
	it('passes on a consistent document', () => {
		const checks = checkSums(parseIsdoc(signed))
		expect(checks.length).toBeGreaterThan(0)
		expect(checks.every((check) => check.ok)).toBe(true)
	})

	it('flags the known inconsistencies of the official sample', () => {
		const failed = checkSums(parseIsdoc(example1)).filter((check) => !check.ok).map((check) => check.key)
		expect(failed).toEqual(['linesGross', 'recapTax'])
	})

	it('fails when an amount is tampered with', () => {
		const xml = signed.replace('<PayableAmount>2420.00</PayableAmount>', '<PayableAmount>9999.00</PayableAmount>')
		const failed = checkSums(parseIsdoc(xml)).filter((check) => !check.ok).map((check) => check.key)
		expect(failed).toContain('payable')
	})
})
