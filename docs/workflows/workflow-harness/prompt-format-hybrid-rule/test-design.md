# Test Design: prompt-format-hybrid-rule

## テスト対象

ファイル: .claude/skills/workflow-harness/workflow-delegation.md
変更内容: Prompt Format Rulesセクション追加(約11行) + Common Constraints追加行(1行)

## テストケース定義

### TC-AC1-01: Prompt Format Rulesセクション存在確認

- 対応AC: AC-1
- 対応F-NNN: F-001
- 手順: grep -c "## Prompt Format Rules" workflow-delegation.md
- 期待値: 1（セクションが1つ存在）
- 追加確認: grep -c "TOON" workflow-delegation.md >= 1 かつ grep -c "Markdown" workflow-delegation.md >= 1
- 判定: セクション見出しが存在し、TOONとMarkdownの両方に言及していること

### TC-AC2-01: Agent委譲形式ルール記載確認

- 対応AC: AC-2
- 対応F-NNN: F-002
- 手順: sed -n '/## Prompt Format Rules/,/^## /p' workflow-delegation.md | grep -c "Top-level keys"
- 期待値: grep -c "Top-level keys" >= 1（Agent委譲のキー・バリュー構造ルールが存在）
- 追加確認: 同セクション内に "Inner content" を含む行が存在
- 判定: Agent委譲プロンプトのトップレベル構造と内部構造の形式ルールが記載されていること

### TC-AC2-02: MCP toolパラメータ形式ルール記載確認

- 対応AC: AC-2
- 対応F-NNN: F-003
- 手順: sed -n '/## Prompt Format Rules/,/^## /p' workflow-delegation.md | grep -ci "MCP"
- 期待値: grep -c "MCP" >= 1（MCPパラメータ形式ルールが存在）
- 追加確認: 同セクション内に短パラメータ(summary/evidence)と長パラメータ(instruction/output)の区別が記載
- 判定: MCP toolパラメータの形式ルールが長短の区別を含めて記載されていること

### TC-AC3-01: 出力形式伝染防止ルール記載確認

- 対応AC: AC-3
- 対応F-NNN: F-004
- 手順: grep -c "contaminate\|伝染\|Format.*output\|output.*format" workflow-delegation.md
- 期待値: grep -c "Format:" >= 1 in Common Constraintsセクション（出力形式伝染防止ルールが存在）
- 追加確認: Common Constraintsセクション内に Format 指定行が存在
- grepパターン: "Format:.*Markdown.*TOON.*output\|Format:.*artifacts.*Markdown"
- 判定: 入力形式(TOON)が成果物の出力形式に伝染することを防止するルールが記載されていること

### TC-AC4-01: 20行閾値ルール記載確認

- 対応AC: AC-4
- 対応F-NNN: F-005
- 手順: grep -c "20.*line\|20.*行" workflow-delegation.md
- 期待値: grep -c "20" >= 1（長文プロンプト閾値ルールが存在）
- 追加確認: "file reference" または "ファイル参照" に関する記述が同一コンテキストに存在
- 判定: 20行超のプロンプトをファイル参照に切り替える閾値ルールが記載されていること

### TC-AC4-02: セクション間空行ルール記載確認

- 対応AC: AC-4
- 対応F-NNN: F-005
- 手順: grep -c "blank line\|separator\|空行" workflow-delegation.md
- 期待値: grep -c "blank line" >= 1 or grep -c "空行" >= 1（セクション区切りルールが存在）
- 追加確認: Prompt Format Rulesセクション内にセクション区切りに関するルールが存在
- 判定: トップレベルキー間の空行区切りルールが記載されていること

### TC-AC5-01: 200行以下維持確認

- 対応AC: AC-5
- 対応F-NNN: F-006
- 手順: wc -l < workflow-delegation.md
- 期待値: 200以下
- 事前見積もり: 現在126行 + 追加11行 = 137行
- 判定: 変更後のファイル総行数が200行以下であること

## acTcMapping

- AC-1: TC-AC1-01 (セクション存在+TOON/Markdown言及)
- AC-2: TC-AC2-01 (Agent委譲形式), TC-AC2-02 (MCPパラメータ形式)
- AC-3: TC-AC3-01 (出力形式伝染防止)
- AC-4: TC-AC4-01 (長文閾値), TC-AC4-02 (空行ルール)
- AC-5: TC-AC5-01 (200行以下)

## decisions

- テスト粒度: ACごとに最低1TC、AC-2とAC-4は2TCに分割 -- AC-2はAgent委譲とMCPが異なる対象であり、AC-4は閾値と空行が異なるルールであるため個別検証が必要
- 検証手段: grep/sed/wc -lのCLIコマンドで検証 -- ファイル内容の静的検査であり、実行テストは不要。L1-L4決定的チェックで完結する
- grepパターンの粒度: キーワード存在確認に留める -- 文面の完全一致は実装の自由度を不当に制約するため、意図が表現されていることの確認に限定
- 英語キーワード優先: grepパターンは英語キーワードを主とする -- planningで記述言語は英語と決定済み(planning decisions参照)であり、日本語フォールバックは補助的に含める
- セクション範囲の限定: TC-AC2, TC-AC4ではPrompt Format Rulesセクション内に限定して検索 -- 他セクションの既存記述との誤マッチを防止する
- TC-AC3の二重確認: grepパターンとCommon Constraints内の位置確認を併用 -- 伝染防止ルールがCommon Constraints内に配置されることがplanningで規定済み(F-004)
- TC総数7件: 5ACに対して7TC -- 小規模変更(11行追加)に対して過剰でなく、全ACをカバーする最小限のテストセット

## artifacts

| # | ファイルパス | 用途 |
|---|-------------|------|
| 1 | docs/workflows/prompt-format-hybrid-rule/test-design.md | テスト設計書(本ファイル) |

## next

- design_reviewフェーズでAC→TC→F-NNNの追跡性を検証
- implementフェーズでworkflow-delegation.mdを編集
- testフェーズで本TC定義に基づきgrep/wc -lで検証実行
