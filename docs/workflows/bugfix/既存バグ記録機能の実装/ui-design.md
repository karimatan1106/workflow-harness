# UI設計

## 概要

本機能はMCPツールとして実装されるため、GUIは存在しない。
CLIインターフェースはMCPプロトコル経由で提供される。

## MCPツールインターフェース

### workflow_record_known_bug

**入力例**:
```json
{
  "taskId": "20260206_000240",
  "testName": "should handle edge case",
  "description": "エッジケースでnullポインタ参照",
  "severity": "medium",
  "targetPhase": "next_sprint"
}
```

**出力例**:
```json
{
  "success": true,
  "bugId": "BUG-001",
  "message": "既知バグを記録しました: BUG-001"
}
```

### workflow_get_known_bugs

**入力例**:
```json
{
  "taskId": "20260206_000240"
}
```

**出力例**:
```json
{
  "success": true,
  "knownBugs": [
    {
      "bugId": "BUG-001",
      "testName": "should handle edge case",
      "description": "エッジケースでnullポインタ参照",
      "severity": "medium",
      "targetPhase": "next_sprint",
      "recordedAt": "2026-02-06T00:10:00.000Z"
    }
  ],
  "count": 1
}
```
