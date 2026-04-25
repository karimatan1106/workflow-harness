userResponse: 会話で全て合意済み。4層テンプレート(Why/What/How/Constraints)を3種(coordinator/worker-write/worker-verify) + パラメータ表で約20フェーズ分定義する。3つのハーネス評価レポートの失敗パターンを全て反映する。コード修正は別タスク。

# Hearing: agent-delegation-prompt-templates

## ユーザー意図の分析

### surface (表面的な要求)
Worker/Coordinator/hearing-workerへの委譲時プロンプトを構造化したい

### deep (本当の目的)
DoDリトライの根本原因である「Workerが何を書くべきか知らない」を解消し、ハーネス実行時間を半減させたい

### unclear (不明点)
なし（会話で全て合意済み）

### assumptions (前提)
- テンプレート設計のみ。コード修正(FB-1 RTM重複、FB-4 承認待ち分離)は別タスク
- 全30フェーズにWhy追加、委譲対象の約20フェーズに4層テンプレート

## 背景情報

### 問題の実証データ（3つのハーネス評価レポート）

レポート1: WebSocket鮮度改善タスク (633daf1d)
- 総時間: 16,359秒、リトライ: 17回
- test_design: 9,371秒(5リトライ) — content_validation(L4)で毎回失敗
- delta_entry_format(L4): decisionsセクション欠落が5フェーズで発生
- artifact_quality(L3): 必須セクション欠落が3フェーズ

レポート2: 別タスクの評価
- test_impl: 3回リトライ — harness_record_proof(tdd_red_evidence)を使ったが、正しくはharness_record_test_result(exitCode=1)
- artifact_drift(ART-1): test_designで3回、code_reviewで1回（承認済み成果物の編集でdrift検出）
- requirementsフェーズ: 516秒(IQR外れ値2.17) — openQuestions未解決、intent_consistency警告

レポート3: article-insights タスク (232ed9ec)
- 総時間: 22,533秒、リトライ: 18回
- FB-1: RTM重複エントリでcode_review 6回リトライ(812秒) — コード修正は別タスク
- FB-2: Worker重複行パターン(scope_definition, manual_test, e2e_testで各1回リトライ)
- FB-3: code-review.mdのTOON vs Markdownフォーマット不整合
- FB-5: userIntentにP7未反映

### 根本原因
全リトライの大半は「Workerが成功基準・必須セクション・正しいAPI・フォーマットを事前に知らなかった」に帰着する

### 外部知見
prompt-master (nidhinjs/prompt-master) の35アンチパターンを分析。ハーネスが構造的に解決済みのパターンが多いが、以下が未カバー:
- #11 ハルシネーション防止のグラウンディング
- #13 過去の失敗の明示
- #27 推論モデルCoT抑制
- #33 サイレントエージェント防止

## 合意済みの設計方針

### 4層テンプレート構造
1. Why: なぜこのフェーズが必要か（判断の軸）
2. What: 何を作るか（成果物、セクション定義、中身の書き方）
3. How: どうやって作るか（手順、ツールの使い方、正しいAPI）
4. Constraints: やってはいけないこと（禁止事項、品質ルール、過去の失敗）

### テンプレート3種（委譲先パターン）
- coordinator型: 分析、分解、ファイル書き出し
- worker-write型: ファイル読み、成果物作成
- worker-verify型: 実行、結果検証

### Whyの共通化
ステージ共通Why(8個) + フェーズ固有補足(各1行)で30フェーズをカバー

## 変更対象ファイル

| 変更 | ファイル | 内容 |
|------|---------|------|
| 編集 | workflow-phases.md | 全30フェーズにWhy追加 |
| 新規 | workflow-delegation.md | 4層テンプレート3種 + 約20フェーズ分パラメータ(Output spec、必須セクション、よくある失敗、正しいAPI) |
| 編集 | coordinator.md | Prompt Contract追記 |
| 編集 | worker.md | Prompt Contract追記 |
| 編集 | hearing-worker.md | Prompt Contract追記 |
| 編集 | tool-delegation.md | テンプレート強制ルール追記 |

## decisions

- テンプレートはフェーズ単位の個別定義ではなく、3種の共通テンプレート+パラメータ表方式を採用 — 20フェーズ分の個別定義は冗長でメンテナンス困難
- Whyはステージ共通化 — フェーズ単位で全て書くと重複が大きい
- コード修正(FB-1 RTM重複、FB-4承認待ち分離)は別タスク — テンプレート設計と混ぜるとスコープ肥大
- prompt-masterのスキル常駐は不採用 — ハーネスが構造的に解決済みのパターンが大半
- Output specにセクション定義と「中身の書き方」まで含める — 「何のセクションが必要」だけでは不十分（test_design 5回リトライの教訓）
- 過去の失敗パターンをConstraintsに焼き込む — リトライ履歴から学習した防止策

## artifacts

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| .claude/skills/workflow-harness/workflow-phases.md | 編集 | 全30フェーズにWhy追加 |
| .claude/skills/workflow-harness/workflow-delegation.md | 新規 | 4層テンプレート3種 + 約20フェーズ分パラメータ表 |
| .claude/agents/coordinator.md | 編集 | Prompt Contract追記 |
| .claude/agents/worker.md | 編集 | Prompt Contract追記 |
| .claude/agents/hearing-worker.md | 編集 | Prompt Contract追記 |
| .claude/rules/tool-delegation.md | 編集 | テンプレート強制ルール追記 |

## next

- scope_definitionフェーズで影響ファイルを確定
- researchフェーズで現在のworkflow-phases.mdの構造を調査
- requirementsフェーズでAC定義（最低3件）
