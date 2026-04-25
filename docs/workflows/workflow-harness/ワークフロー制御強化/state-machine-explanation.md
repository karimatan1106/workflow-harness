# ワークフロー制御強化のステートマシン図

## 概要

このドキュメントは、ワークフロープラグインの2つの主要な制御フロー（Bashコマンド検証とフェーズ別編集制限）のステートマシン図を説明します。

## 対象ファイル

- **block-dangerous-commands.js**: 危険なコマンドをブロック
- **phase-edit-guard.js**: フェーズ別の編集制限を実装

## ステートマシン構成

### 1. Bashコマンド検証フロー

```
CommandReceived
    ↓
CheckSkipFlag (SKIP_PHASE_GUARD チェック)
    ├─ YES → Allowed
    └─ NO → CheckToolName
```

**役割**: 環境変数 `SKIP_PHASE_GUARD=true` による即座のバイパスチェック

### 2. ツール判別フロー

```
CheckToolName
    ├─ Edit/Write/Bash → 対象ツール
    └─ その他 → Allowed (許可)
```

**役割**: チェック対象のツールかどうかを判定

### 3. Bashコマンド分析フロー

```
AnalyzeBashCommand
    ↓
CheckExplicitlyAllowed
    ├─ 常に許可パターン (ls, cat, grep等) → Allowed
    └─ その他 → IsFileModifying

IsFileModifying
    ├─ ファイル修正コマンド (sed -i, tee, echo >等) → ExtractBashFilePath
    └─ ファイル修正なし → CheckReadOnlyPhase
```

**重要な判定パターン**:
- **常に許可**: ls, cat, grep, curl, git status, ps等の読み取り専用コマンド
- **ファイル修正**: sed -i, tee, echo >, cat >, mv, cp, rm等のファイル操作

### 4. ファイルパス検証フロー

```
ExtractFilePath
    ↓
ValidateFilePath
    ├─ ファイルパスなし → Allowed
    └─ ファイルパスあり → CheckAlwaysAllowed

CheckAlwaysAllowed
    ├─ ワークフロー状態ファイル (.claude-*.json等) → Allowed
    └─ 通常ファイル → FindWorkflowState
```

**常に許可されるファイル**:
- `workflow-state.json` (ワークフロー状態)
- `.claude-*.json` (Claude関連状態ファイル)

### 5. ワークフロー状態取得フロー

```
FindWorkflowState
    ├─ ワークフロー開始済み → WorkflowStateFound → DetermineFileType
    └─ ワークフロー未開始 → Allowed
```

**判定条件**:
- `.claude/state/workflows/{taskId}_{taskName}/workflow-state.json` の存在
- `phase !== 'completed'`

### 6. ファイルタイプ判定フロー（優先度順）

```
DetermineFileType
    ↓
    1. IsTestFile (.test., .spec., __tests__, /tests/)
    2. IsDiagramFile (*.mmd)
    3. IsSpecFile (*.md)
    4. IsSourceCode (.ts, .tsx, .js等)
    5. IsConfigFile (package.json, tsconfig等)
    6. IsEnvFile (.env, .env.xxx)
    7. FileTypeOther
```

**ファイルタイプ一覧**:
- `code`: ソースコード (.ts, .tsx, .js, .jsx等)
- `test`: テストコード (.test.ts, .spec.ts等)
- `spec`: 仕様書 (.md)
- `diagram`: 図式ファイル (.mmd)
- `config`: 設定ファイル (package.json, tsconfig等)
- `env`: 環境変数ファイル (.env)
- `other`: その他

### 7. 設定・環境変数の即座許可

```
FileTypeConfig → Allowed (全フェーズで許可)
FileTypeEnv → Allowed (全フェーズで許可)
```

**重要**: 設定ファイルと環境変数ファイルはフェーズ制限の対象外

### 8. フェーズルール取得と検証

```
GetPhaseRule
    ↓
IsParallelPhase
    ├─ 並列フェーズ (parallel_*) → HandleParallelPhase
    └─ 単一フェーズ → GetDirectRule
```

**並列フェーズとは**:
- `parallel_analysis`: threat_modeling, planning
- `parallel_design`: state_machine, flowchart, ui_design
- `parallel_quality`: build_check, code_review
- `parallel_verification`: manual_test, security_scan, performance_test, e2e_test

### 9. 並列フェーズ処理

```
HandleParallelPhase
    ↓
IdentifyActiveSubPhase (subPhaseUpdates/subPhases から判定)
    ├─ アクティブサブフェーズ発見 → ApplySubPhaseRule
    └─ サブフェーズ不明 → CombineSubPhaseRules → ApplySubPhaseRule
```

**優先度**:
1. `subPhaseUpdates` の最後更新サブフェーズ
2. `subPhases` の `in_progress` サブフェーズ

**合算ルール**: 複数サブフェーズのルールを統合し、より寛容なルール(allowed側に倒す)を生成

### 10. フェーズ別編集許可判定

```
CheckEditPermission
    ↓
IsAllowed (allowed配列にファイルタイプが含まれるか?)
    ├─ YES → Allowed
    └─ NO → IsBlocked

IsBlocked (blocked配列にファイルタイプが含まれるか?)
    ├─ YES → Blocked
    └─ NO → Allowed (安全側)
```

**判定ロジック**:
- `allowed` に含まれていれば許可
- `blocked` に含まれていれば禁止
- どちらにも含まれない場合は許可（安全側に倒す）

### 11. implementationフェーズでのスコープ検証

```
CheckEditPermission
    ↓
IsImplementationPhase (実装フェーズ?)
    ├─ YES → CheckScope
    └─ NO → 許可

CheckScope
    ├─ docs配下 → Allowed (常に許可)
    ├─ src配下 → CheckAffectedFiles/CheckAffectedDirs
    └─ src外 → Allowed

CheckAffectedFiles
    ├─ affectedFiles に含まれる → Allowed
    └─ NO → CheckAffectedDirs

CheckAffectedDirs
    ├─ affectedDirs にプレフィックスマッチ → Allowed
    └─ NO → ScopeBlocked (スコープ違反)
```

**重要**: REQ-1として、implementationフェーズではスコープ外のファイル編集を禁止

### 12. ブロック状態

```
Blocked
    ↓
BlockMessage (ブロックメッセージ表示)
    - フェーズ名
    - ファイルパス
    - ファイルタイプ
    - 理由
    - 許可されるファイル一覧
    - TDDサイクル情報（該当する場合）
    - 次のステップ（移行先フェーズ）
    ↓
[*] (終了)
```

### 13. 許可状態

```
Allowed
    ↓
LogCheck (チェック結果をログに記録)
    ↓
[*] (終了)
```

## フェーズ別ルール（重要）

### researchフェーズ
- **許可**: spec(仕様書.md), config, env
- **禁止**: code, test, diagram

### requirementsフェーズ
- **許可**: spec, config, env
- **禁止**: code, test, diagram

### test_implフェーズ (TDD Red)
- **許可**: spec, test, config, env
- **禁止**: code, diagram

### implementationフェーズ (TDD Green)
- **許可**: code, spec, config, env
- **禁止**: test, diagram
- **特別チェック**: スコープ検証

### refactoringフェーズ (TDD Refactor)
- **許可**: code, test, spec, diagram, config, env, other
- **禁止**: なし

### 読み取り専用フェーズ
- **許可**: なし（読み取り専用）
- **対象**: build_check, testing, manual_test, security_scan, commit

## 制御フローの活用

### ユースケース1: ソースコード編集

```
Phase: research
Action: src/main.ts を編集
Result: ブロック（researchフェーズではcodeが禁止）
Message: implementationフェーズに進むと編集可能
```

### ユースケース2: テストコード作成

```
Phase: test_impl
Action: src/test.test.ts を作成
Result: 許可（test_implフェーズではtestが許可）
```

### ユースケース3: スコープ違反

```
Phase: implementation
Action: src/unrelated/file.ts を編集（影響範囲に未含）
Result: ブロック（implementationフェーズでのスコープ検証）
Message: 影響範囲外のファイル編集を禁止
```

### ユースケース4: 読み取り専用コマンド

```
Phase: build_check (読み取り専用)
Command: cat src/main.ts
Result: 許可（読み取り専用コマンド）

Command: echo "test" > src/main.ts
Result: ブロック（ファイル修正コマンド）
```

## セキュリティとガイドライン

### 常に許可されるコマンド
- **読み取り専用**: ls, cat, grep, rg, find, head, tail
- **プロセス情報**: ps, top, htop
- **Git読み取り**: git status, git log, git diff, git branch
- **ネットワーク**: curl, wget, ping
- **システム情報**: uname, whoami, env

### 常に禁止されるコマンド（block-dangerous-commands.js）
- **プロセス終了**: kill -9, pkill, taskkill /f
- **システム終了**: shutdown, reboot, halt
- **ファイル破壊**: rm -rf /, format c:
- **フォークボム**: :() { :|: & }

### 安全側への倒し方
- 不明なフェーズは許可
- ファイルタイプが unknown/other の場合は許可
- ワークフロー未開始の場合は許可

## ログ出力と監査

### ログファイル
- `.claude-phase-guard-log.json`: 全チェック結果（許可/ブロック/スキップ）
- `.claude-hook-errors.log`: エラーログ

### ログエントリ例
```json
{
  "timestamp": "2026-02-07T12:00:00.000Z",
  "allowed": true,
  "phase": "implementation",
  "filePath": "src/main.ts",
  "fileType": "code"
}
```

### デバッグモード
```bash
DEBUG_PHASE_GUARD=true node phase-edit-guard.js
```

## 実装上の注意点

### Windows/Unix パス互換性
- バックスラッシュをスラッシュに正規化
- 小文字に統一
- ドライブレターは除去

### パフォーマンス考慮
- タイムアウト: 3秒（stdin読み込み）
- ログローテーション: 最大100エントリ保持
- パターンマッチングは正規表現を採用

### エラーハンドリング
- JSON パースエラー: 安全側に倒す（許可）
- ファイル読み込みエラー: ログ記録して続行
- 予期しないエラー: プロセス終了コード0（許可）

## 関連ドキュメント

- `docs/spec/features/phase-edit-guard.md`: フェーズ編集制限の仕様
- `CLAUDE.md`: ワークフロー強制ルール全体

## まとめ

このステートマシン図は、ワークフロープラグインの以下を実装:

1. **Bashコマンド検証**: 危険なコマンドのブロック
2. **フェーズ別編集制限**: ワークフローフェーズに基づく編集制限
3. **スコープ検証**: implementationフェーズでの影響範囲チェック
4. **並列フェーズ対応**: 複数サブフェーズの同時実行対応
5. **安全側への倒し方**: 不確実性時は許可の方針

これらのメカニズムにより、ワークフロー違反を防ぎ、品質の高い開発プロセスを実現します。
