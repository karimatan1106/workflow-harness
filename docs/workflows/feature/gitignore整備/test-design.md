# Test Design: gitignore整備

## 概要

本タスクはgit操作のみで構成されるため、ユニットテストは存在しない。
検証はすべてgitコマンドの実行結果に基づいて行う。

## AC - TC マッピングテーブル

| AC | TC | 説明 | 検証コマンド | 期待結果 |
|----|------|------|-------------|---------|
| AC-1 | TC-AC1-01 | .gitignore に .claude-phase-guard-log.json が含まれる | `grep .claude-phase-guard-log.json .gitignore` | exit code 0 (マッチあり) |
| AC-1 | TC-AC1-02 | .gitignore に settings.local.json が含まれる | `grep settings.local .gitignore` | exit code 0 (マッチあり) |
| AC-1 | TC-AC1-03 | .gitignore に generated-files.json が含まれる | `grep generated-files .gitignore` | exit code 0 (マッチあり) |
| AC-2 | TC-AC2-01 | mcp-server/dist/ が追跡対象外 | `cd workflow-harness && git ls-files mcp-server/dist/ \| wc -l` | 0 |
| AC-2 | TC-AC2-02 | mcp-server/.claude/state/ が追跡対象外 | `cd workflow-harness && git ls-files mcp-server/.claude/state/ \| wc -l` | 0 |
| AC-3 | TC-AC3-01 | .claude-phase-guard-log.json が追跡対象外 | `git ls-files .claude-phase-guard-log.json \| wc -l` | 0 |
| AC-4 | TC-AC4-01 | git status がクリーン | `git status` | 対象ファイルが tracked/staged に含まれない |

## テストケース詳細

### TC-AC1-01: .gitignore に .claude-phase-guard-log.json エントリが存在すること

- **対象AC**: AC-1 (親リポの .gitignore に3エントリ追加)
- **検証方法**: `grep .claude-phase-guard-log.json .gitignore`
- **成功条件**: exit code が 0 であること (パターンが見つかった)
- **失敗条件**: exit code が 1 であること (パターンが見つからなかった)

### TC-AC1-02: .gitignore に .claude/settings.local.json エントリが存在すること

- **対象AC**: AC-1
- **検証方法**: `grep settings.local .gitignore`
- **成功条件**: exit code が 0 であること
- **失敗条件**: exit code が 1 であること

### TC-AC1-03: .gitignore に .claude/generated-files.json エントリが存在すること

- **対象AC**: AC-1
- **検証方法**: `grep generated-files .gitignore`
- **成功条件**: exit code が 0 であること
- **失敗条件**: exit code が 1 であること

### TC-AC2-01: サブモジュール内 mcp-server/dist/ が追跡対象外であること

- **対象AC**: AC-2 (サブモジュールの追跡済みファイルが git rm -r --cached で除去)
- **検証方法**: `cd workflow-harness && git ls-files mcp-server/dist/ | wc -l`
- **成功条件**: 出力が 0 であること (追跡ファイルなし)
- **失敗条件**: 出力が 1 以上であること (追跡ファイルが残存)
- **備考**: サブモジュールディレクトリ内でコマンドを実行する必要がある

### TC-AC2-02: サブモジュール内 mcp-server/.claude/state/ が追跡対象外であること

- **対象AC**: AC-2
- **検証方法**: `cd workflow-harness && git ls-files mcp-server/.claude/state/ | wc -l`
- **成功条件**: 出力が 0 であること
- **失敗条件**: 出力が 1 以上であること

### TC-AC3-01: 親リポジトリで .claude-phase-guard-log.json が追跡対象外であること

- **対象AC**: AC-3 (親リポの .claude-phase-guard-log.json が git rm --cached で除去)
- **検証方法**: `git ls-files .claude-phase-guard-log.json | wc -l`
- **成功条件**: 出力が 0 であること
- **失敗条件**: 出力が 1 であること (まだ追跡されている)

### TC-AC4-01: git status で対象ファイルが追跡対象として表示されないこと

- **対象AC**: AC-4 (git status で対象ファイルが追跡対象外として正しく表示)
- **検証方法**: `git status` の出力を確認
- **成功条件**: .claude-phase-guard-log.json, dist/, state/ がstaged/trackedセクションに含まれないこと
- **失敗条件**: これらのファイルがmodifiedやnew fileとして表示されること

## 検証実行順序

1. TC-AC1-01, TC-AC1-02, TC-AC1-03 (.gitignore エントリ確認 - 順不同)
2. TC-AC3-01 (親リポ追跡解除確認)
3. TC-AC2-01, TC-AC2-02 (サブモジュール追跡解除確認)
4. TC-AC4-01 (全体ステータス確認 - 最後に実行)
