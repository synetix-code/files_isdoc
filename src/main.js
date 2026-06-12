/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import IsdocView from './views/IsdocView.vue'

if (window.OCA?.Viewer) {
	window.OCA.Viewer.registerHandler({
		id: 'isdoc',
		group: null,
		mimes: [
			'application/isdoc+xml',
			'application/isdocx',
		],
		component: IsdocView,
	})
} else {
	console.error('files_isdoc: OCA.Viewer is not available, cannot register the ISDOC handler')
}
