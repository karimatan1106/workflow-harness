#!/usr/bin/env bash
# init.sh — harness-root-cause-fixes
# 実行前提: workflow-harness/mcp-server で npm install 済み
# 用途: RC-1/RC-2/RC-3修正の環境確認と既存テスト実行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "${SCRIPT_DIR}/../../../workflow-harness/mcp-server" && pwd)"

echo "=== harness-root-cause-fixes init.sh ==="
echo "node: $(node --version)"
echo "npx tsc: $(npx tsc --version)"
echo "harness dir: ${HARNESS_DIR}"

cd "${HARNESS_DIR}"

echo ""
echo "=== TypeScript compile check ==="
npx tsc --noEmit && echo "tsc: OK" || echo "tsc: ERRORS"

echo ""
echo "=== Existing tests ==="
npx vitest run --reporter=verbose src/__tests__/hmac.test.ts src/__tests__/dod-tdd.test.ts 2>&1 | tail -30

echo ""
echo "=== Key files for RC-1/RC-2/RC-3 ==="
echo "types-core.ts PhaseConfig lines:"
grep -n "dodExemptions\|dodChecks\|PhaseConfig" src/state/types-core.ts | head -10
echo "dod-l1-l2.ts hardcoded test_impl lines:"
grep -n "test_impl" src/gates/dod-l1-l2.ts
echo "hmac.ts HmacKeys lines:"
grep -n "HmacKeys\|version\|current\|rotatedAt" src/utils/hmac.ts | head -20

echo ""
echo "=== init.sh complete ==="
