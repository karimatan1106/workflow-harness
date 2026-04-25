phase: ui_design
task: workflow-harness-refactoring-v2
status: complete

## decisions

- UID-1: harness_approve レスポンスから nextPhase フィールドを削除し nextAction フィールドに置換する。理由: オーケストレーターが nextPhase を直接使ってフェーズ遷移を試みる誤用パターンを排除し、harness_next 呼び出しを唯一の遷移手段として強制するため。
- UID-2: hook 内部分割(tool-gate.js -> phase-config.js 分離、hook-utils.js 統合)は外部インターフェースを変更しない。理由: hook の stdin/stdout 契約は Claude Code 本体が規定しており、変更不可。内部リファクタリングのみ。
- UID-3: MCP ツールのシグネチャ(引数・戻り値型)は一切変更しない。内部 import パスのみ変更し re-export で互換維持。理由: ツール呼び出し側(LLM)はシグネチャのみ認識するため、内部構造変更を露出させない。
- UID-4: indexer/ ツール群を削除する。代替は Serena MCP(既に設定済み)。理由: 重複機能の排除。エージェントは既に Serena 経由でコード探索を行っており、indexer 呼び出しは発生していない。
- UID-5: skills docs のパス参照を更新する。エージェントが読むルールファイルのパスが分割後のファイル構造と一致することを保証する。

## interface-changes

### harness_approve response (Area 5)

変更前:
```
{
  approved: true,
  nextPhase: "implementation",
  message: "Phase planning approved."
}
```

変更後:
```
{
  approved: true,
  nextAction: "call harness_next",
  message: "Phase planning approved."
}
```

影響範囲:
- オーケストレーターは approve 後に必ず harness_next を呼ぶ。これは既に期待されるパターンであり、実運用上の行動変更は不要。
- nextPhase フィールドを参照してフェーズ名を取得していたコードパスがあれば壊れる。ただし正規フローでは harness_next が次フェーズ情報を返すため問題なし。

### hook behavior (Area 1)

tool-gate.js の分割:
- phase-config.js: フェーズごとの許可ツール定義を保持。tool-gate.js から import される。
- hook-utils.js: stdin パース、JSON 出力、エラーハンドリングを統合。全 hook から共有。
- 外部動作: 変更なし。hook の exit code 体系(0=許可, 1=ブロック)は維持。stdin 入力フォーマット、stdout 出力フォーマットともに不変。

### MCP tool interface (Area 3)

変更なし:
- harness_start, harness_next, harness_approve, harness_status 等の全ツールはシグネチャ不変。
- 内部実装ファイルが分割されるが、エントリポイントの re-export により呼び出し側への影響はゼロ。

### deleted functionality (Area 2)

indexer/ ディレクトリ配下のツール群を削除:
- 対象: indexer/index.js, indexer/search.js 等
- 代替: Serena MCP が同等機能を提供(mcp-server 設定済み)
- エージェント影響: indexer ツールは MCP ツールリストから消える。ただし現時点で呼び出し実績がないため実影響なし。

### skills docs path updates (Area 4)

更新対象:
- workflow-phases.md 内のファイルパス参照
- workflow-operations.md 内の import パス例示
- workflow-rules.md 内の hook ファイル参照
- 全て分割後の新ファイル名を指すよう更新。既存の古いパスは残さない。

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/ui-design.md, spec, インターフェース変更仕様

## next

criticalDecisions: UID-1(harness_approve レスポンス変更)が最も影響範囲が広い。implementation フェーズで approve handler の戻り値構造を変更し、既存テストを全て更新すること。
readFiles: workflow-harness/src/tools/approve.ts, workflow-harness/src/hooks/tool-gate.js, workflow-harness/CLAUDE.md
warnings: indexer 削除前に grep で全参照箇所を確認し、残存呼び出しがないことを検証すること。
