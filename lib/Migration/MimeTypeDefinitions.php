<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesIsdoc\Migration;

/**
 * Single source of truth for the MIME types handled by this app.
 * Used by the install and uninstall repair steps.
 */
final class MimeTypeDefinitions {
	/** Extension => list of MIME types (format of config/mimetypemapping.json) */
	public const MAPPING = [
		'isdoc' => ['application/isdoc+xml'],
		'isdocx' => ['application/isdocx'],
	];

	/** MIME type => icon alias (format of config/mimetypealiases.json) */
	public const ALIASES = [
		'application/isdoc+xml' => 'x-office-document',
		'application/isdocx' => 'x-office-document',
	];
}
