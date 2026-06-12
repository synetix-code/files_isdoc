/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * ISDOC XML parser.
 *
 * Parses an ISDOC invoice document (https://isdoc.cz) into a plain JS model.
 * Element lookup is namespace-tolerant (matched by localName) so that both
 * the current namespace `http://isdoc.cz/namespace/2013` (ISDOC 6.x) and
 * older 5.x documents are supported.
 *
 * All leaf values are kept as the raw strings from the XML — amounts are
 * never parsed to numbers or recalculated, the document is displayed as-is.
 */

import { translate as t } from '@nextcloud/l10n'

/**
 * @param {Element} node an element
 * @return {string} localName with any namespace prefix stripped (some DOM
 *                  implementations keep the prefix in localName)
 */
function localName(node) {
	return (node.localName ?? node.tagName ?? '').split(':').pop()
}

/**
 * @param {Element|null} el parent element
 * @param {string} name child localName
 * @return {Element|null} first direct child with the given localName
 */
function child(el, name) {
	if (!el) {
		return null
	}
	for (const node of el.children) {
		if (localName(node) === name) {
			return node
		}
	}
	return null
}

/**
 * @param {Element|null} el parent element
 * @param {string} name child localName
 * @return {Element[]} all direct children with the given localName
 */
function children(el, name) {
	if (!el) {
		return []
	}
	return [...el.children].filter((node) => localName(node) === name)
}

/**
 * Descend a path of localNames and return the trimmed text content.
 *
 * @param {Element|null} el starting element
 * @param {...string} path localNames to descend
 * @return {string|null} trimmed text content, or null when the path is missing
 */
function text(el, ...path) {
	let node = el
	for (const name of path) {
		node = child(node, name)
		if (!node) {
			return null
		}
	}
	const value = node.textContent.trim()
	return value === '' ? null : value
}

/**
 * @param {Element|null} partyParent e.g. AccountingSupplierParty element
 * @return {object|null} party model
 */
function parseParty(partyParent) {
	const party = child(partyParent, 'Party')
	if (!party) {
		return null
	}
	const address = child(party, 'PostalAddress')
	const contact = child(party, 'Contact')
	const register = child(party, 'RegisterIdentification')
	return {
		name: text(party, 'PartyName', 'Name'),
		// IČO (company registration number)
		ico: text(party, 'PartyIdentification', 'ID'),
		// DIČ (VAT identifier, with country prefix)
		dic: text(party, 'PartyTaxScheme', 'CompanyID'),
		street: text(address, 'StreetName'),
		buildingNumber: text(address, 'BuildingNumber'),
		city: text(address, 'CityName'),
		postalZone: text(address, 'PostalZone'),
		countryName: text(address, 'Country', 'Name'),
		countryCode: text(address, 'Country', 'IdentificationCode'),
		contactName: text(contact, 'Name'),
		telephone: text(contact, 'Telephone'),
		email: text(contact, 'ElectronicMail'),
		// Commercial register entry, e.g. court and file number
		registerKeptAt: text(register, 'RegisterKeptAt'),
		registerFileRef: text(register, 'RegisterFileRef'),
	}
}

/**
 * @param {Element} line InvoiceLine element
 * @return {object} invoice line model
 */
function parseLine(line) {
	const quantity = child(line, 'InvoicedQuantity')
	return {
		id: text(line, 'ID'),
		description: text(line, 'Item', 'Description') ?? text(line, 'Note'),
		quantity: quantity ? quantity.textContent.trim() : null,
		unitCode: quantity ? quantity.getAttribute('unitCode') : null,
		unitPrice: text(line, 'UnitPrice'),
		unitPriceTaxInclusive: text(line, 'UnitPriceTaxInclusive'),
		lineExtensionAmount: text(line, 'LineExtensionAmount'),
		lineExtensionAmountTaxInclusive: text(line, 'LineExtensionAmountTaxInclusive'),
		lineExtensionTaxAmount: text(line, 'LineExtensionTaxAmount'),
		vatRate: text(line, 'ClassifiedTaxCategory', 'Percent'),
	}
}

/**
 * @param {Element} subTotal TaxSubTotal element
 * @return {object} tax sub-total model
 */
function parseTaxSubTotal(subTotal) {
	return {
		percent: text(subTotal, 'TaxCategory', 'Percent'),
		taxableAmount: text(subTotal, 'TaxableAmount'),
		taxAmount: text(subTotal, 'TaxAmount'),
		taxInclusiveAmount: text(subTotal, 'TaxInclusiveAmount'),
		// Tax remaining after deducting settled advances (advance documents)
		differenceTaxAmount: text(subTotal, 'DifferenceTaxAmount'),
	}
}

/**
 * @param {Element} payment Payment element
 * @return {object} payment model
 */
function parsePayment(payment) {
	const details = child(payment, 'Details')
	return {
		paidAmount: text(payment, 'PaidAmount'),
		paymentMeansCode: text(payment, 'PaymentMeansCode'),
		dueDate: text(details, 'PaymentDueDate'),
		accountNumber: text(details, 'ID'),
		bankCode: text(details, 'BankCode'),
		bankName: text(details, 'Name'),
		iban: text(details, 'IBAN'),
		bic: text(details, 'BIC'),
		variableSymbol: text(details, 'VariableSymbol'),
		constantSymbol: text(details, 'ConstantSymbol'),
		specificSymbol: text(details, 'SpecificSymbol'),
	}
}

/**
 * Parse an ISDOC invoice XML string into a plain JS model.
 *
 * @param {string} xmlString the ISDOC XML document
 * @return {object} invoice model
 * @throws {Error} when the XML is not well-formed or is not an ISDOC invoice
 */
export function parseIsdoc(xmlString) {
	const doc = new DOMParser().parseFromString(xmlString, 'application/xml')
	if (doc.querySelector('parsererror')) {
		throw new Error(t('files_isdoc', 'The file is not a well-formed XML document'))
	}

	const invoice = doc.documentElement
	if (localName(invoice) !== 'Invoice') {
		throw new Error(t('files_isdoc', 'The file is not an ISDOC invoice (missing Invoice root element)'))
	}

	const totals = child(invoice, 'LegalMonetaryTotal')

	return {
		version: invoice.getAttribute('version'),
		// Prefer the declared default namespace; namespaceURI as fallback
		// for documents using a namespace prefix on the root element
		namespace: invoice.getAttribute('xmlns') ?? invoice.namespaceURI,
		// Per spec a signed document carries an enveloped XML-DSig Signature
		// as a direct child of the Invoice root. Detection only — the
		// verification itself lives in the signature service.
		hasSignature: [...invoice.children].some((node) => localName(node) === 'Signature'),
		documentType: text(invoice, 'DocumentType'),
		id: text(invoice, 'ID'),
		uuid: text(invoice, 'UUID'),
		issueDate: text(invoice, 'IssueDate'),
		taxPointDate: text(invoice, 'TaxPointDate'),
		currency: text(invoice, 'LocalCurrencyCode'),
		foreignCurrency: text(invoice, 'ForeignCurrencyCode'),
		currRate: text(invoice, 'CurrRate'),
		refCurrRate: text(invoice, 'RefCurrRate'),
		note: text(invoice, 'Note'),
		orderReferences: children(child(invoice, 'OrderReferences'), 'OrderReference').map((ref) => ({
			salesOrderID: text(ref, 'SalesOrderID'),
			externalOrderID: text(ref, 'ExternalOrderID'),
			issueDate: text(ref, 'IssueDate'),
		})),
		deliveryNoteReferences: children(child(invoice, 'DeliveryNoteReferences'), 'DeliveryNoteReference').map((ref) => ({
			id: text(ref, 'ID'),
			issueDate: text(ref, 'IssueDate'),
		})),
		originalDocumentReferences: children(child(invoice, 'OriginalDocumentReferences'), 'OriginalDocumentReference').map((ref) => ({
			id: text(ref, 'ID'),
			issueDate: text(ref, 'IssueDate'),
		})),
		supplier: parseParty(child(invoice, 'AccountingSupplierParty')),
		customer: parseParty(child(invoice, 'AccountingCustomerParty')),
		lines: children(child(invoice, 'InvoiceLines'), 'InvoiceLine').map(parseLine),
		taxSubTotals: children(child(invoice, 'TaxTotal'), 'TaxSubTotal').map(parseTaxSubTotal),
		// Total tax after deducting settled advances (direct child of TaxTotal)
		taxTotalAmount: text(child(invoice, 'TaxTotal'), 'TaxAmount'),
		totals: {
			taxExclusiveAmount: text(totals, 'TaxExclusiveAmount'),
			taxInclusiveAmount: text(totals, 'TaxInclusiveAmount'),
			alreadyClaimedTaxExclusiveAmount: text(totals, 'AlreadyClaimedTaxExclusiveAmount'),
			alreadyClaimedTaxInclusiveAmount: text(totals, 'AlreadyClaimedTaxInclusiveAmount'),
			differenceTaxExclusiveAmount: text(totals, 'DifferenceTaxExclusiveAmount'),
			differenceTaxInclusiveAmount: text(totals, 'DifferenceTaxInclusiveAmount'),
			paidDepositsAmount: text(totals, 'PaidDepositsAmount'),
			payableRoundingAmount: text(totals, 'PayableRoundingAmount'),
			payableAmount: text(totals, 'PayableAmount'),
		},
		payments: children(child(invoice, 'PaymentMeans'), 'Payment').map(parsePayment),
	}
}
