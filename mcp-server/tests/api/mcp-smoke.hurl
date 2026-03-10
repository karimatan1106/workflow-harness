# N-34: MCP server smoke test (requires hurl CLI)
# Install: scoop install hurl (Windows) / brew install hurl (macOS)
# Run: hurl --test tests/api/mcp-smoke.hurl
# Prerequisites: Start MCP server in HTTP mode: node dist/index.js --transport http --port 3000

# Test 1: tools/list - Retrieve all available MCP tools
POST http://localhost:3000/mcp
Content-Type: application/json
```
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```
HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.jsonrpc" == "2.0"
jsonpath "$.id" == 1
jsonpath "$.result.tools" exists
jsonpath "$.result.tools" count > 0


# Test 2: harness_status - Check harness status without active task
POST http://localhost:3000/mcp
Content-Type: application/json
```
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "harness_status",
    "arguments": {}
  },
  "id": 2
}
```
HTTP 200
[Asserts]
jsonpath "$.jsonrpc" == "2.0"
jsonpath "$.id" == 2
jsonpath "$.result" exists
