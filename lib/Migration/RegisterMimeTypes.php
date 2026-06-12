<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\FilesIsdoc\Migration;

use OCP\Files\IMimeTypeLoader;
use OCP\Migration\IOutput;
use OCP\Migration\IRepairStep;

/**
 * Registers the ISDOC MIME types on app install/update.
 *
 * Persists the extension mapping and icon aliases into the instance's
 * config/mimetypemapping.json and config/mimetypealiases.json (merging with
 * existing entries, never overwriting foreign ones) and updates the file
 * cache so that already uploaded *.isdoc / *.isdocx files get the new
 * MIME type immediately.
 */
class RegisterMimeTypes implements IRepairStep {
	public function __construct(
		private IMimeTypeLoader $mimeTypeLoader,
	) {
	}

	public function getName(): string {
		return 'Register ISDOC MIME types';
	}

	public function run(IOutput $output): void {
		$this->mergeJsonConfigFile('mimetypemapping.json', MimeTypeDefinitions::MAPPING, $output);
		$this->mergeJsonConfigFile('mimetypealiases.json', MimeTypeDefinitions::ALIASES, $output);

		// Make sure the MIME types exist in the database and remap files
		// that were uploaded before this app was installed.
		foreach (MimeTypeDefinitions::MAPPING as $extension => $mimeTypes) {
			$mimeTypeId = $this->mimeTypeLoader->getId($mimeTypes[0]);
			$updated = $this->mimeTypeLoader->updateFilecache($extension, $mimeTypeId);
			if ($updated > 0) {
				$output->info(sprintf('Updated MIME type of %d existing *.%s file(s)', $updated, $extension));
			}
		}
		$this->mimeTypeLoader->reset();

		$output->info('ISDOC MIME types registered. Run "occ maintenance:mimetype:update-js" to refresh file type icons.');
	}

	/**
	 * Merge entries into a JSON config file, keeping any existing entries.
	 *
	 * @param array<string, mixed> $entries
	 */
	private function mergeJsonConfigFile(string $filename, array $entries, IOutput $output): void {
		$path = \OC::$configDir . $filename;

		$config = [];
		if (file_exists($path)) {
			$content = file_get_contents($path);
			$config = $content !== false ? json_decode($content, true) : null;
			if (!is_array($config)) {
				$output->warning(sprintf('Could not parse %s, skipping MIME type persistence', $path));
				return;
			}
		}

		$changed = false;
		foreach ($entries as $key => $value) {
			if (!array_key_exists($key, $config)) {
				$config[$key] = $value;
				$changed = true;
			}
		}

		if (!$changed) {
			return;
		}

		$json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
		if (file_put_contents($path, $json . "\n") === false) {
			$output->warning(sprintf('Could not write %s — add the ISDOC entries manually (see README)', $path));
		}
	}
}
