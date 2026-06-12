/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Inspection and cryptographic verification of the enveloped XML-DSig
 * signature of an ISDOC document.
 *
 * Scope (deliberately honest about its limits):
 * - certificate DETAILS are read from the embedded X509Certificate,
 * - the signature is verified cryptographically with WebCrypto via
 *   xmldsigjs — this proves the document INTEGRITY (it has not been
 *   modified since signing) and that it was signed by the holder of the
 *   embedded certificate's private key,
 * - the TRUSTWORTHINESS of the certificate (chain to a trusted CA,
 *   revocation, qualified status) is NOT verified.
 *
 * The heavy crypto libraries are loaded lazily so that unsigned invoices
 * do not pay their cost.
 */

const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'

/** Common X.500 attribute OIDs found in (Czech) signing certificates */
const OID_LABELS = {
	'2.5.4.3': 'CN',
	'2.5.4.6': 'C',
	'2.5.4.7': 'L',
	'2.5.4.10': 'O',
	'2.5.4.11': 'OU',
	'2.5.4.5': 'SERIALNUMBER',
	'2.5.4.97': 'organizationIdentifier',
	'1.2.840.113549.1.9.1': 'E',
}

/** Digest/signature algorithms considered weak for display purposes */
const WEAK_ALGORITHM_PATTERN = /sha1|md5/i

/**
 * @param {Element} node an element
 * @return {string} localName with any namespace prefix stripped (some DOM
 *                  implementations keep the prefix in localName)
 */
function localName(node) {
	return (node.localName ?? node.tagName ?? '').split(':').pop()
}

/**
 * @param {Element} root element to scan
 * @param {string} name wanted localName
 * @return {Element|null} first descendant (or self) with the localName
 */
function findByLocalName(root, name) {
	if (localName(root) === name) {
		return root
	}
	for (const el of root.querySelectorAll('*')) {
		if (localName(el) === name) {
			return el
		}
	}
	return null
}

/**
 * @param {Document} doc parsed XML document
 * @return {Element|null} the ds:Signature element
 */
function findSignatureElement(doc) {
	for (const el of doc.querySelectorAll('*')) {
		if (localName(el) === 'Signature') {
			return el
		}
	}
	return null
}

/**
 * @param {object} rdnSequence pkijs RelativeDistinguishedNames
 * @return {string} display string like "CN=Jan Novák, O=Firma s.r.o."
 */
function formatName(rdnSequence) {
	return rdnSequence.typesAndValues
		.map((tv) => `${OID_LABELS[tv.type] ?? tv.type}=${tv.value.valueBlock.value}`)
		.join(', ')
}

/**
 * Extract human-readable details of the signature and its certificate.
 *
 * @param {Element} signatureEl the ds:Signature element
 * @return {Promise<object>} signature details
 */
async function extractDetails(signatureEl) {
	const details = {
		subject: null,
		issuer: null,
		validFrom: null,
		validTo: null,
		serialNumber: null,
		signingTime: null,
		signatureAlgorithm: null,
		digestAlgorithm: null,
		weakAlgorithm: false,
	}

	const signatureMethod = findByLocalName(signatureEl, 'SignatureMethod')
	const digestMethod = findByLocalName(signatureEl, 'DigestMethod')
	details.signatureAlgorithm = signatureMethod?.getAttribute('Algorithm') ?? null
	details.digestAlgorithm = digestMethod?.getAttribute('Algorithm') ?? null
	details.weakAlgorithm = WEAK_ALGORITHM_PATTERN.test(
		`${details.signatureAlgorithm} ${details.digestAlgorithm}`)

	// XAdES signing time, when present in qualifying properties
	const signingTime = findByLocalName(signatureEl, 'SigningTime')
	details.signingTime = signingTime?.textContent.trim() ?? null

	// Embedded signing certificate
	const certEl = findByLocalName(signatureEl, 'X509Certificate')
	if (certEl) {
		try {
			const { Certificate } = await import('pkijs')
			const der = Uint8Array.from(atob(certEl.textContent.replace(/\s+/g, '')),
				(c) => c.charCodeAt(0))
			const cert = Certificate.fromBER(der.buffer)
			details.subject = formatName(cert.subject)
			details.issuer = formatName(cert.issuer)
			details.validFrom = cert.notBefore.value.toISOString().slice(0, 10)
			details.validTo = cert.notAfter.value.toISOString().slice(0, 10)
			details.serialNumber = [...new Uint8Array(cert.serialNumber.valueBlock.valueHexView)]
				.map((b) => b.toString(16).padStart(2, '0')).join(':')
		} catch (e) {
			console.warn('files_isdoc: could not parse the signing certificate', e)
		}
	}

	return details
}

/**
 * Cryptographically verify the signature using the embedded certificate.
 *
 * @param {string} xmlString the signed XML document
 * @return {Promise<{status: 'valid'|'invalid'|'error', reason: string|null}>} verification result
 */
async function verifySignature(xmlString) {
	try {
		const { Application, Parse, SignedXml } = await import('xmldsigjs')
		Application.setEngine('WebCrypto', globalThis.crypto)

		const doc = Parse(xmlString)
		const signatureEl = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Signature')[0]
			?? findSignatureElement(doc)
		if (!signatureEl) {
			return { status: 'error', reason: 'Signature element not found' }
		}

		const signedXml = new SignedXml(doc)
		signedXml.LoadXml(signatureEl)
		const valid = await signedXml.Verify()
		return { status: valid ? 'valid' : 'invalid', reason: null }
	} catch (e) {
		console.warn('files_isdoc: signature verification failed', e)
		// xmldsigjs reports a digest mismatch (= modified content) as an
		// exception rather than a false result
		if (/invalid digest/i.test(e.message ?? '')) {
			return { status: 'invalid', reason: null }
		}
		return { status: 'error', reason: e.message ?? String(e) }
	}
}

/**
 * Inspect and verify the signature of an ISDOC document.
 *
 * @param {string} xmlString the ISDOC XML document
 * @return {Promise<object|null>} `{details, verification}`, or null when the
 *                                document carries no signature
 */
export async function inspectSignature(xmlString) {
	const doc = new DOMParser().parseFromString(xmlString, 'application/xml')
	const signatureEl = findSignatureElement(doc)
	if (!signatureEl) {
		return null
	}

	const [details, verification] = await Promise.all([
		extractDetails(signatureEl),
		verifySignature(xmlString),
	])
	return { details, verification }
}
