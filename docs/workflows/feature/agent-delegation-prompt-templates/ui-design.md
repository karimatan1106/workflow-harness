# UI Design: agent-delegation-prompt-templates

## インターフェース概要

本タスクのUIは従来のGUI/CLIではなく、オーケストレーターがsubagentを呼び出す際のプロンプトインターフェースである。

## プロンプトインターフェース設計

### 入力インターフェース（オーケストレーター→subagent）

4層構造のプロンプトテンプレート:

1. Why層: フェーズの目的と判断の軸
   - ステージ共通Why（workflow-phases.mdから転記）
   - フェーズ固有補足
   - Context（ユーザーの本当の目的、hearingのdeepから）

2. What層: 成果物の定義
   - 出力ファイルパス
   - 必須セクション一覧と各セクションの書き方（Output spec）
   - 満たすべき仕様（AC/RTM参照）

3. How層: 作業手順
   - 番号付きリストで手順を記述
   - 使うツール、読むファイル、書く順序
   - フェーズ固有の正しいAPI呼び出し

4. Constraints層: 制約と品質ルール
   - スコープ（read/write範囲）
   - 禁止事項（forbidden-actions.md参照）
   - 品質ルール（グラウンディング、重複行禁止等）
   - Prior failures（前回リトライ理由、初回は"none"）

### 出力インターフェース（subagent→オーケストレーター）

既存の結果フォーマットを維持:
- 成功: [OK] 1行サマリ
- 失敗: [FAIL] 理由
- edit-preview: [EDIT] file_path + OLD/NEW

### テンプレート種別の選択フロー

1. パラメータ表でフェーズ名からテンプレート種別を参照
2. coordinator型 / worker-write型 / worker-verify型 を選択
3. パラメータ表の必須セクション列・よくある失敗列を読み取り
4. 4層に情報を埋め込みAgent呼び出し

### 状態遷移との対応

- state-machine.mmd: TemplateSelection → ParameterFill → 4層Set → AgentDelegation → DoDCheck
- flowchart.mmd: フェーズ開始 → 委譲判定 → テンプレート種別分岐 → 4層埋め込み → Agent委譲 → DoD検証

## 操作フロー

### 通常フロー（初回成功）
1. オーケストレーターがフェーズを開始
2. パラメータ表を参照してテンプレート種別を特定
3. 4層テンプレートにパラメータを埋め込み
4. Agent(coordinator/worker)に委譲
5. subagentが成果物を作成し[OK]を返す
6. harness_nextでDoD通過
7. 次フェーズへ

### リトライフロー
1. harness_nextでDoD失敗
2. 失敗理由をPrior failuresに追加
3. Constraints層を更新して再委譲
4. subagentが修正済み成果物を作成
5. 再度harness_next

## decisions

- プロンプトをUIとして扱う: テンプレート構造がsubagentへの唯一の情報伝達手段であり、UIと同等の設計が必要 -- 曖昧なプロンプトはsubagentの品質低下に直結
- 出力インターフェースは変更しない: 既存の[OK]/[FAIL]/[EDIT]形式は安定しており、テンプレート導入の影響を受けない
- リトライフローでPrior failuresのみ更新: 4層全体の再構築は不要。失敗情報の追加だけで十分
- テンプレート種別選択はパラメータ表参照: LLMの判断ではなく表の定義に従う決定論的選択
- 4層の順序は固定(Why→What→How→Constraints): LLMの注意バイアスを考慮し、目的(Why)を最初に、制約(Constraints)を最後に配置

## artifacts

| ファイル | 対応 |
|---------|------|
| state-machine.mmd | 状態遷移との整合性確認済み |
| flowchart.mmd | 操作フローとの整合性確認済み |
| planning.md | テンプレート設計との整合性確認済み |

## next

- design_reviewでAC-to-Design mappingを検証
