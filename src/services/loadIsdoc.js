/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { translate as t } from '@nextcloud/l10n'
import { unzipSync } from 'fflate'

/**
 * Turn raw file bytes into an ISDOC XML string.
 *
 * Handles both plain `.isdoc` XML files and `.isdocx` ZIP containers.
 * The container format is detected by the ZIP magic bytes, not by the MIME
 * type, so mis-detected files still work. Inside a container the main
 * document is located via `manifest.xml` (`maindocument/@filename`,
 * namespace http://isdoc.cz/namespace/2013/manifest) with a fallback to the
 * first `*.isdoc` entry, as required by the ISDOC specification.
 */

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] // "PK\x03\x04"

/**
 * @param {Uint8Array} bytes raw file content
 * @return {boolean} whether the content is a ZIP archive
 */
function isZip(bytes) {
	return bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b)
}

/**
 * Decode XML bytes honouring the encoding declared in the XML prolog.
 * Some Czech ERP systems emit windows-1250 instead of UTF-8.
 *
 * @param {Uint8Array} bytes raw XML bytes
 * @return {string} decoded XML string
 */
function decodeXml(bytes) {
	const prolog = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
	const match = prolog.match(/encoding=["']([^"']+)["']/)
	if (match) {
		try {
			return new TextDecoder(match[1].toLowerCase()).decode(bytes)
		} catch (e) {
			// Unknown encoding label — fall through to UTF-8
		}
	}
	return new TextDecoder('utf-8').decode(bytes)
}

/**
 * Find the main document filename declared in the container's manifest.xml.
 *
 * @param {Record<string, Uint8Array>} entries unzipped archive entries
 * @return {string|null} declared filename, or null when there is no manifest
 */
function mainDocumentFromManifest(entries) {
	const manifestBytes = entries['manifest.xml']
	if (!manifestBytes) {
		return null
	}
	const doc = new DOMParser().parseFromString(decodeXml(manifestBytes), 'application/xml')
	if (doc.querySelector('parsererror')) {
		return null
	}
	for (const node of doc.documentElement.children) {
		if ((node.localName ?? '').split(':').pop() === 'maindocument') {
			return node.getAttribute('filename')
		}
	}
	return null
}

/**
 * Load an ISDOC document and its attachments from raw file bytes.
 *
 * @param {Uint8Array} bytes raw content of a .isdoc or .isdocx file
 * @return {{xml: string, attachments: Array<{name: string, data: Uint8Array}>}}
 *         the ISDOC XML document and any other files shipped in the container
 * @throws {Error} when a container holds no ISDOC document
 */
export function loadIsdoc(bytes) {
	if (!isZip(bytes)) {
		return { xml: decodeXml(bytes), attachments: [] }
	}

	const entries = unzipSync(bytes)

	let mainName = mainDocumentFromManifest(entries)
	if (!mainName || !entries[mainName]) {
		// Fallback per spec: first *.isdoc file in the archive root
		mainName = Object.keys(entries).find((name) => /^[^/]+\.isdoc$/i.test(name))
	}
	if (!mainName) {
		throw new Error(t('files_isdoc', 'No ISDOC document found in the archive'))
	}

	const attachments = Object.entries(entries)
		.filter(([name]) => name !== mainName
			&& name.toLowerCase() !== 'manifest.xml'
			&& !name.endsWith('/'))
		.map(([name, data]) => ({ name, data }))

	return { xml: decodeXml(entries[mainName]), attachments }
}
