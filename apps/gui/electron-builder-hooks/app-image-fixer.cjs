/**
MIT License

Copyright (c) 2025 Fandly Gergo-Zoltan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs/promises');
const path = require('path');

const log = (message, dot = "🔵") => {
	console.log(`  ${dot} ${message}`);
};

const afterPackHook = async params => {
	if (params.electronPlatformName !== 'linux') {
		// this fix is only required on linux
		return;
	}

	log('applying fix for sandboxing on unsupported kernels');

	const executable = path.join(
		params.appOutDir,
		params.packager.executableName
	);

	const loaderScript = `#!/usr/bin/env bash
set -u

UNPRIVILEGED_USERNS_ENABLED=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)
RESTRICT_UNPRIVILEGED_USERNS=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"

!([ "$UNPRIVILEGED_USERNS_ENABLED" != 1 ] || [ "$RESTRICT_UNPRIVILEGED_USERNS" == 1 ])
APPLY_NO_SANDBOX_FLAG=$?

if [ "$SCRIPT_DIR" == "/usr/bin" ]; then
	SCRIPT_DIR="/opt/${params.packager.appInfo.productName}"
fi

if [ "$APPLY_NO_SANDBOX_FLAG" == 1 ]; then
	echo "Note: Running with --no-sandbox since unprivileged_userns_clone is disabled or apparmor_restrict_unprivileged_userns is enabled."
fi

exec "$SCRIPT_DIR/${params.packager.executableName}.bin" "$([ "$APPLY_NO_SANDBOX_FLAG" == 1 ] && echo '--no-sandbox')" "$@"
`;

	try {
		await fs.rename(executable, executable + '.bin');
		await fs.writeFile(executable, loaderScript);
		await fs.chmod(executable, 0o755);
	} catch (e) {
		log('failed to create loder for sandbox fix: ' + e.message, "🔴");
		throw new Error('Failed to create loader for sandbox fix');
	}

	log('sandbox fix successfully applied', "🟢");
};

module.exports = afterPackHook;