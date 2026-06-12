/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Attachments (supplements) of an ISDOC document.
 *
 * The invoice declares its attachments in SupplementsList (filename and a
 * digest); the actual files travel in the .isdocx ZIP container. Declared
 * filenames may use backslash path separators and differ in letter case
 * from the ZIP entry names, so matching is normalised.
 */

/** MIME types safe to open directly in a browser tab */
const OPENABLE_MIMES = {
	pdf: 'application/pdf',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	bmp: 'image/bmp',
	webp: 'image/webp',
}

/** XML-DSig digest algorithm URI fragment => WebCrypto algorithm name */
const DIGEST_ALGORITHMS = {
	sha1: 'SHA-1',
	sha256: 'SHA-256',
	sha384: 'SHA-384',
	sha512: 'SHA-512',
}

/**
 * @param {string} name a filename (possibly with backslash separators)
 * @return {string} normalised key for matching
 */
function normalize(name) {
	return name.replace(/\\/g, '/').toLowerCase()
}

/**
 * Pair the supplements declared in the document with the files found in
 * the container. Files present but undeclared are appended at the end.
 *
 * @param {Array<object>} supplements declared supplements (from parseIsdoc)
 * @param {Array<{name: string, data: Uint8Array}>} files container files
 * @return {Array<object>} display items
 */
export function mergeAttachments(supplements, files) {
	const remaining = new Map(files.map((file) => [normalize(file.name), file]))
	const items = []

	for (const supplement of supplements) {
		if (!supplement.filename) {
			continue
		}
		const key = normalize(supplement.filename)
		const file = remaining.get(key) ?? null
		remaining.delete(key)
		items.push({
			key,
			displayName: supplement.filename.replace(/\\/g, '/'),
			data: file?.data ?? null,
			supplement,
		})
	}

	for (const file of remaining.values()) {
		items.push({
			key: normalize(file.name),
			displayName: file.name,
			data: file.data,
			supplement: null,
		})
	}

	return items
}

/**
 * Verify the declared digest of an attachment.
 *
 * @param {object} item merged attachment item
 * @return {Promise<boolean|null>} true/false on (mis)match, null when the
 *                                 check cannot be performed
 */
export async function verifyAttachmentDigest(item) {
	const supplement = item.supplement
	if (!item.data || !supplement?.digestValue || !supplement.digestAlgorithm) {
		return null
	}
	const match = supplement.digestAlgorithm.match(/sha(1|256|384|512)/i)
	const algorithm = match ? DIGEST_ALGORITHMS[match[0].toLowerCase()] : null
	if (!algorithm) {
		return null
	}
	const digest = await globalThis.crypto.subtle.digest(algorithm, item.data)
	const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
	return computed === supplement.digestValue.replace(/\s+/g, '')
}

/**
 * @param {string} name a filename
 * @return {string|null} MIME type if the file is safe to open in a browser
 *                       tab, null otherwise (download only)
 */
export function openableMime(name) {
	const ext = name.split('.').pop().toLowerCase()
	return OPENABLE_MIMES[ext] ?? null
}

/**
 * @param {number} bytes file size
 * @return {string} human-readable size, e.g. "12.3 kB"
 */
export function formatSize(bytes) {
	if (bytes < 1024) {
		return `${bytes} B`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} kB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
