# SPDX-FileCopyrightText: 2026 Synetix <jelinek@synetix.cz>
# SPDX-License-Identifier: AGPL-3.0-or-later

app_name := files_isdoc
build_dir := build
appstore_dir := $(build_dir)/appstore
source_dir := $(appstore_dir)/$(app_name)

.PHONY: all build appstore clean

all: build

# Build the frontend bundle into js/
build:
	npm ci
	npm run build

# Build a release tarball for the Nextcloud App Store.
# Contains the compiled js/ bundle but no sources, node_modules or tests.
appstore: build
	rm -rf $(appstore_dir)
	mkdir -p $(source_dir)
	cp -r appinfo img js l10n lib LICENSES README.md CHANGELOG.md $(source_dir)/
	tar -czf $(build_dir)/$(app_name).tar.gz -C $(appstore_dir) $(app_name)
	@echo "Created $(build_dir)/$(app_name).tar.gz"
	@echo "Sign it with: openssl dgst -sha512 -sign ~/.nextcloud/certificates/$(app_name).key $(build_dir)/$(app_name).tar.gz | openssl base64"

clean:
	rm -rf $(build_dir) js node_modules
