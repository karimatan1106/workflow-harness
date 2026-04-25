#!/usr/bin/env bash
# S1-10: Build/test/setup commands for docs-update-dynamic-categories
cd "$(git rev-parse --show-toplevel)/workflow-harness/mcp-server" || exit 1
npm install
npm run build
npm test
