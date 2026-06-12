/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

import { parseIsdoc } from '../../src/services/parseIsdoc.js'

const example1 = fs.readFileSync('tests/fixtures/example1.isdoc', 'utf8')
const signed = fs.readFileSync('tests/fixtures/signed-sample.isdoc', 'utf8')

describe('parseIsdoc', () => {
	it('parses the official ISDOC sample faithfully', () => {
		const invoice = parseIsdoc(example1)
		expect(invoice.id).toBe('FV-111999/2011')
		expect(invoice.documentType).toBe('1')
		expect(invoice.version).toBe('6.0.1')
		expect(invoice.namespace).toBe('http://isdoc.cz/namespace/2013')
		expect(invoice.currency).toBe('CZK')
		expect(invoice.supplier.name).toBe('ABRA Software a.s.')
		expect(invoice.supplier.ico).toBe('25097563')
		expect(invoice.customer.dic).toBe('CZ00006947')
		expect(invoice.lines).toHaveLength(3)
		// Raw strings, never numbers — faithful display contract
		expect(invoice.lines[0].unitPrice).toBe('1.0793')
		expect(invoice.totals.payableAmount).toBe('0')
		expect(invoice.taxSubTotals).toHaveLength(3)
		expect(invoice.payments).toHaveLength(3)
		expect(invoice.orderReferences).toHaveLength(2)
		expect(invoice.hasSignature).toBe(false)
	})

	it('detects an enveloped signature', () => {
		expect(parseIsdoc(signed).hasSignature).toBe(true)
	})

	it('rejects non-ISDOC content', () => {
		expect(() => parseIsdoc('<foo/>')).toThrow()
	})
})
