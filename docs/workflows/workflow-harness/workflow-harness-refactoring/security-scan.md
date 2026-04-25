## decisions

- SS-1: npm audit reports 7 vulnerabilities (3 high, 4 moderate) in mcp-server dependencies. High-severity: @hono/node-server authorization bypass (GHSA-wc8c-qw6v-h7f6), express-rate-limit IPv4-mapped IPv6 bypass (GHSA-46wh-pxpv-q5gq), hono cookie injection + SSE injection + serveStatic file access + prototype pollution (4 CVEs). All fixable via `npm audit fix` (non-breaking) or `npm audit fix --force` (breaking: vitest upgrade). Recommend running `npm audit fix` before merge.
- SS-2: No eval(), new Function(), or dynamic code execution found in production source files. All execSync/child_process usage is limited to: (1) project-root.ts running `git rev-parse` with hardcoded command strings, (2) linter-runner.ts running `npx jscpd` with parameterized threshold (numeric only), (3) lifecycle.ts running `git status --porcelain` with hardcoded string, (4) delegate-coordinator.ts spawning `claude` CLI with shell:false. The test-layer-guard-runner.js uses string interpolation in execSync (`echo '${input}'`) but this file is test-only and input is JSON.stringify output, not user-supplied.
- SS-3: .mcp.json serena entry uses `uvx serena-agent start-mcp-server` with no user-controllable arguments. The harness entry invokes `bash workflow-harness/mcp-server/start.sh` with a fixed STATE_DIR env var. Neither entry accepts external input that could enable command injection. The cwd values are relative paths with no variable substitution.
- SS-4: Hook security layer is intact. block-dangerous-commands.js blocks 15 dangerous patterns including recursive rm, fork bombs, block device writes, mkfs, dd wipes, chmod 777, curl/wget pipe to shell, npm publish, git force push, git reset --hard, git clean -f, git checkout ., git stash drop, git branch -D. tool-gate.js enforces 3-layer permission model (L1/L2/L3) with phase-dependent file extension restrictions and bash command whitelisting. Both hooks use exit code 2 to block and write structured JSON to stderr.
- SS-5: Path traversal mitigation exists in manager-write.ts sanitizeTaskName() which strips `..` sequences, path separators, and HTML tags. project-root.ts resolveProjectPath() normalizes paths and checks isAbsolute() before joining. No user-supplied path strings are passed directly to fs operations without sanitization.
- SS-6: No hardcoded credentials found in production source files. Matches for "token", "secret", "apikey" in source code are limited to: (1) sessionToken parameter names in CLI/state management (runtime values from env vars), (2) test fixture values in test files (e.g., hmac.test.ts uses 'secret-key-value'), (3) scaffold config files referencing env var names (LANGFUSE_SECRET_KEY, LANGSMITH_API_KEY), (4) CI helper templates using GitHub Actions secrets syntax (${{ secrets.* }}). The debug logger in tool-gate.js masks HARNESS_SESSION_TOKEN as '[SET]' before writing to log files.
- SS-7: delegate-coordinator.ts spawns child processes with shell:false, preventing shell injection. The --permission-mode bypassPermissions flag is used for coordinator subprocesses but is mitigated by the hook system (tool-gate.js) which enforces layer-based tool restrictions regardless of permission mode. Environment variables are explicitly constructed, not inherited blindly (childEnv spread is from process.env which is server-controlled).

## artifacts

- Scanned: workflow-harness/mcp-server (npm audit), 7 vulnerabilities found
- Scanned: all .ts/.js files under workflow-harness/ for eval/exec/child_process patterns
- Scanned: .mcp.json for command injection vectors
- Scanned: workflow-harness/hooks/ (8 hook files) for security enforcement integrity
- Scanned: workflow-harness/mcp-server/src/ for path traversal and credential patterns
- Scanned: manager-write.ts sanitizeTaskName, project-root.ts resolveProjectPath for OWASP A01 (Broken Access Control)
- Scanned: delegate-coordinator.ts spawn configuration for OWASP A03 (Injection)

## next

- Run `npm audit fix` in mcp-server to resolve the 7 dependency vulnerabilities before commit phase
- Monitor hono and esbuild upstream releases for the high-severity fixes
- The vitest breaking change upgrade (for esbuild vulnerability) can be deferred to a separate task
