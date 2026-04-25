# Planning: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md の Phase Work Descriptions セクションに hearing フェーズの記述を追加する実装計画。既存フェーズと同一形式(見出し + 作業概要 + Output + DoD)で、scope_definition の直前に挿入する。変更対象は1ファイル、追加は3行。

## scope

- 変更対象ファイル: .claude/skills/workflow-harness/workflow-phases.md (1ファイルのみ)
- 変更種別: 既存ファイルへのセクション追加(新規ファイル作成なし)
- 影響範囲: hearingフェーズの定義参照箇所(workflow-delegation.mdは変更不要、既にhearing行が存在)

## implementation-steps

### Step 1: workflow-phases.md の現行内容を確認する

- 対象: .claude/skills/workflow-harness/workflow-phases.md
- 確認事項: L11 が `### Stage 0: scope_definition` であること
- 確認事項: 総行数が78行程度であること(research.mdの調査結果と一致するか)

### Step 2: hearing セクションを L11 に挿入する

- 挿入位置: L11 (現在の `### Stage 0: scope_definition` の直前)
- 挿入内容(3行):

  行1: `### Stage 0: hearing`
  行2: `Clarify user intent before scope_definition via hearing-worker agent. Present structured choices using AskUserQuestion tool. Recommended option always placed first (choice A). Output: hearing.md. DoD: L1 exists, L4 userResponse + decisions present.`
  行3: (空行)

- 結果: scope_definition は L14 に移動する(3行分のシフト)

### Step 3: 追加後の行数を検証する

- 期待値: 81行 (78 + 3)
- 上限: 200行
- 検証方法: wc -l で行数カウント

### Step 4: 記述形式の整合性を確認する

- hearingセクションが他フェーズと同一パターンであること:
  - `### Stage N: phase_name` 見出し形式
  - 作業概要の説明文
  - `Output:` と出力ファイル名
  - `DoD:` と検証条件
- hearing-worker エージェント型への言及が含まれること
- AskUserQuestion ツールへの言及が含まれること

### Step 5: 既存セクションへの影響がないことを確認する

- scope_definition 以降の全セクションが正しくシフトしていること
- 見出し構造(Stage番号)に変更がないこと
- Phase sets 定義行(L7)に変更がないこと

## decisions

- D-001: 挿入内容は2行の実質テキスト(見出し1行 + 説明1行) + 空行1行の計3行とする -- 既存フェーズの記述密度(1見出し + 1段落)に合わせ、最小限の追加で一貫性を確保するため
- D-002: 説明文に hearing-worker agent と AskUserQuestion tool の両方を含める -- AC-2とAC-3を1行で満たし、既存フェーズの記述密度を超えないため
- D-003: DoD条件は "L1 exists, L4 userResponse + decisions present" とする -- requirements.md D-005で定義した条件をそのまま採用し、workflow-delegation.mdのRequired Sectionsと整合させるため
- D-004: "Recommended option always placed first (choice A)" を説明文に含める -- hearing-worker.mdのガイドライン(推奨オプションにRecommended付与)と、指示文の「推奨選択肢は常にAに配置」を反映するため
- D-005: scope_definitionのStage番号は変更しない -- hearingもStage 0として配置し、既存の番号体系を維持するため(research.md D-002に従う)
- D-006: 挿入はL11への単一Edit操作で完了する -- 複数箇所の編集が不要なため、1回の操作でミスを最小化する
- D-007: 推奨選択肢の配置ルール(A=先頭)はhearing固有のルールとして明記する -- 他フェーズにはない制約であり、ここに記載することでhearing-worker.mdとの重複を避けつつ参照可能にするため

## ac-rtm-mapping

- F-001 (hearing フェーズセクション追加):
  - AC-1: Step 2 で `### Stage 0: hearing` 見出しを挿入
  - AC-2: Step 2 の説明文に "hearing-worker agent" を含める
  - AC-3: Step 2 の説明文に "AskUserQuestion tool" を含める
  - AC-4: Step 3 で行数検証(81行、上限200行以内)
  - AC-5: Step 4 で形式整合性を確認(見出し + 概要 + Output + DoD パターン)

## risks

- 挿入位置を間違えるとsection構造が壊れる: Step 1で現行L11の内容を事前確認し、Step 5で事後確認することで回避する
- 説明文が長すぎると既存フェーズとの形式バランスが崩れる: 既存のresearchセクション(2行)を参考に、1段落に収める

## artifacts

- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/planning.md (本ファイル)

## next

phase: implementation
action: workflow-phases.md の L11 に hearing セクション3行を挿入する。Step 1-5 を順に実行し、AC-1 から AC-5 を全て満たすことを確認する。
