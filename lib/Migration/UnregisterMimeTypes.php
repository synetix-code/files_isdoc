<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesIsdoc\Migration;

use OCP\Migration\IOutput;
use OCP\Migration\IRepairStep;

/**
 * Removes the ISDOC entries from config/mimetypemapping.json and
 * config/mimetypealiases.json on app uninstall. Only entries whose value
 * still matches what this app wrote are removed; anything customised by
 * the admin is left untouched. MIME types already stored in the database
 * are kept — they are harmless without the mapping.
 */
class UnregisterMimeTypes implements IRepairStep {
	public function getName(): string {
		return 'Unregister ISDOC MIME types';
	}

	public function run(IOutput $output): void {
		$this->removeJsonConfigEntries('mimetypemapping.json', MimeTypeDefinitions::MAPPING, $output);
		$this->removeJsonConfigEntries('mimetypealiases.json', MimeTypeDefinitions::ALIASES, $output);
	}

	/**
	 * @param array<string, mixed> $entries
	 */
	private function removeJsonConfigEntries(string $filename, array $entries, IOutput $output): void {
		$path = \OC::$configDir . $filename;
		if (!file_exists($path)) {
			return;
		}

		$content = file_get_contents($path);
		$config = $content !== false ? json_decode($content, true) : null;
		if (!is_array($config)) {
			return;
		}

		$changed = false;
		foreach ($entries as $key => $value) {
			if (array_key_exists($key, $config) && $config[$key] === $value) {
				unset($config[$key]);
				$changed = true;
			}
		}

		if (!$changed) {
			return;
		}

		$json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
		if (file_put_contents($path, $json . "\n") === false) {
			$output->warning(sprintf('Could not write %s — remove the ISDOC entries manually', $path));
		}
	}
}
