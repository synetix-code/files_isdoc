/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Consistency checks of an ISDOC invoice, modelled on the validations the
 * official STORMWARE ISDOC Reader presents at the top of the document.
 *
 * The checks only COMPARE the values declared in the document — the
 * displayed values themselves are never replaced by computed ones.
 */

/**
 * Allowed difference when comparing declared and computed amounts.
 * Each summed term may be rounded by up to half a cent, so the tolerance
 * scales with the number of terms entering the computation.
 *
 * @param {number} terms number of summed terms
 * @return {number} maximum accepted difference
 */
function tolerance(terms) {
	return 0.01 + 0.005 * Math.max(terms, 1)
}

/**
 * @param {string|null} value raw decimal string from the document
 * @return {number|null} parsed number, or null when missing/invalid
 */
function num(value) {
	if (value === null || value === undefined || value === '') {
		return null
	}
	const n = Number(value)
	return Number.isFinite(n) ? n : null
}

/**
 * Sum raw decimal strings. Returns null when the list is empty or any
 * value is missing/unparsable (a check without complete data is skipped).
 *
 * @param {Array<string|null>} values raw decimal strings
 * @return {number|null} sum of the values
 */
function sum(values) {
	if (!values.length) {
		return null
	}
	let total = 0
	for (const value of values) {
		const n = num(value)
		if (n === null) {
			return null
		}
		total += n
	}
	return total
}

/**
 * @param {number} n computed amount
 * @return {string} amount rounded for display, e.g. "396.58"
 */
function formatComputed(n) {
	return (Math.round(n * 100) / 100).toFixed(2)
}

/**
 * Mandatory ISDOC header elements and the model fields they map to.
 * Used for the structure check — names are reported as element names.
 */
const MANDATORY = [
	['ID', (inv) => inv.id !== null],
	['DocumentType', (inv) => inv.documentType !== null],
	['IssueDate', (inv) => inv.issueDate !== null],
	['LocalCurrencyCode', (inv) => inv.currency !== null],
	['AccountingSupplierParty', (inv) => inv.supplier !== null],
	['AccountingCustomerParty', (inv) => inv.customer !== null],
	['InvoiceLines', (inv) => inv.lines.length > 0],
	['LegalMonetaryTotal', (inv) => inv.totals.taxInclusiveAmount !== null || inv.totals.payableAmount !== null],
]

/** Namespace of the current ISDOC standard (6.x) */
export const ISDOC_NAMESPACE = 'http://isdoc.cz/namespace/2013'

/** Namespaces of older but well-known ISDOC versions (5.x) */
const ISDOC_LEGACY_NAMESPACES = [
	'http://isdoc.cz/namespace/invoice',
]

/**
 * Structural problems of the document.
 *
 * @param {object} invoice parsed invoice model
 * @return {{unknownNamespace: string|null, isLegacyNamespace: boolean, missingElements: string[]}} found problems
 */
export function checkStructure(invoice) {
	const isCurrent = invoice.namespace === ISDOC_NAMESPACE
	const isLegacy = ISDOC_LEGACY_NAMESPACES.includes(invoice.namespace)
	return {
		unknownNamespace: (isCurrent || isLegacy) ? null : (invoice.namespace ?? ''),
		isLegacyNamespace: isLegacy,
		missingElements: MANDATORY.filter(([, present]) => !present(invoice)).map(([name]) => name),
	}
}

/**
 * Control-sum checks: declared aggregate amounts vs sums computed from the
 * document's own parts. A check is silently skipped when the data it needs
 * is not present in the document.
 *
 * @param {object} invoice parsed invoice model
 * @return {Array<{key: string, declared: string, computed: string, ok: boolean}>} executed checks
 */
export function checkSums(invoice) {
	const checks = []
	const add = (key, declaredRaw, computed, terms) => {
		const declared = num(declaredRaw)
		if (declared === null || computed === null) {
			return
		}
		checks.push({
			key,
			declared: declaredRaw,
			computed: formatComputed(computed),
			ok: Math.abs(declared - computed) <= tolerance(terms),
		})
	}

	const totals = invoice.totals
	const lineCount = invoice.lines.length
	const recapCount = invoice.taxSubTotals.length

	// Sums of invoice lines vs declared document totals
	add('linesNet', totals.taxExclusiveAmount,
		sum(invoice.lines.map((l) => l.lineExtensionAmount)), lineCount)
	add('linesGross', totals.taxInclusiveAmount,
		sum(invoice.lines.map((l) => l.lineExtensionAmountTaxInclusive)), lineCount)

	// VAT recapitulation vs declared document totals
	add('recapBase', totals.taxExclusiveAmount,
		sum(invoice.taxSubTotals.map((s) => s.taxableAmount)), recapCount)
	add('recapGross', totals.taxInclusiveAmount,
		sum(invoice.taxSubTotals.map((s) => s.taxInclusiveAmount)), recapCount)

	// Total tax (after deducting settled advances) vs recapitulation rows.
	// On documents with advances the per-rate difference amounts apply.
	add('recapTax', invoice.taxTotalAmount,
		sum(invoice.taxSubTotals.map((s) => s.differenceTaxAmount ?? s.taxAmount)), recapCount)

	// Amount to pay: gross total (or the remaining difference on documents
	// with already claimed advances) plus rounding and non-taxed deposits.
	const taxInclusive = num(totals.taxInclusiveAmount)
	let payableBase = num(totals.differenceTaxInclusiveAmount)
	if (payableBase === null && taxInclusive !== null) {
		const alreadyClaimed = num(totals.alreadyClaimedTaxInclusiveAmount)
		payableBase = alreadyClaimed !== null ? taxInclusive - alreadyClaimed : taxInclusive
	}
	if (payableBase !== null) {
		add('payable', totals.payableAmount,
			payableBase + (num(totals.payableRoundingAmount) ?? 0) + (num(totals.paidDepositsAmount) ?? 0), 3)
	}

	return checks
}
