# Workflow Harness - Project Instructions

Authoritative instruction set. Violations are blocked by hooks.

**ワークフロー強制**: コード変更タスクは `/harness start <タスク名>` で開始。質問・調査は直接回答。

---

## 1. Design Philosophy

- **Phases = context compression.** 各フェーズは成果物を生成し、次フェーズへの完全な引き継ぎコンテキストとなる。
- **scope_definition + impact_analysis** で10M行を必要なN行に絞る。
- **AC-N** (受入基準) がrequirements→acceptance_verificationまでユーザー意図を固定。
- **RTM F-NNN** (要件追跡) がplanning→code_review→verifiedまで各要件を追跡。
- **L1-L4決定的ゲート**のみ使用。**L5(LLM判断)はゲートに使用禁止** — 検証不能=改善不能=禁止(PSC-5)。
- **200行制限**: ハーネスの全ソースファイル≤200行。

---

## 2. Phases (30 + completed)

全タスクは厳密順序でフェーズを辿る。小タスクは一部スキップ(Section 3参照)。

**Stage 1 Discovery**: scope_definition(sonnet) → research(sonnet) → impact_analysis(sonnet)
**Stage 2 Requirements**: requirements(sonnet, gate:requirements)
**Stage 3 Analysis** [parallel_analysis]: threat_modeling(sonnet) | planning(sonnet, depends:threat_modeling)
**Stage 4 Design** [parallel_design]: state_machine(haiku) | flowchart(haiku) | ui_design(sonnet)
**Stage 5 Review**: design_review(sonnet, gate:design)
**Stage 6 Test Planning**: test_design(sonnet, gate:test_design) → test_selection(haiku)
**Stage 7 TDD**: test_impl(sonnet) → implementation(sonnet) → refactoring(haiku)
**Stage 8 Quality** [parallel_quality]: build_check(haiku) | code_review(sonnet, gate:code_review)
**Stage 9 Testing**: testing(haiku) → regression_test(haiku)
**Stage 10 Acceptance**: acceptance_verification(sonnet, gate:acceptance)
**Stage 11 Verification** [parallel_verification]: manual_test | security_scan | performance_test | e2e_test (all sonnet)
**Stage 12-14**: docs_update → commit → push → ci_verification → deploy → health_observation → completed

---

## 3. Task Sizing

| Size | Risk Score | Phases | Use Case |
|------|-----------|--------|----------|
| small | 0-3 | ~12 | 単一ファイル修正 |
| medium | 4-7 | ~22 | 複数ファイル機能 |
| large | 8+ | 30 | アーキテクチャ変更 |

Default: large。`harness_start`時に自動分類。

---

## 4. Forbidden Actions (hooks enforce)

- フェーズスキップ禁止(`harness_next`で遷移)
- research/designフェーズでのコードファイル編集禁止(.toon/.mmd/.mdのみ)
- テスト前の実装禁止(TDD)
- フェーズ外Bashコマンド禁止(hookがブロック)
- バリデーション失敗時のOrchestrator直接編集禁止(サブエージェント再起動)
- 同一ファイル5分間5回以上編集禁止

**禁止語**(コードフェンス外): TODO,TBD,WIP,FIXME,未定,未確定,要検討,検討中,対応予定,サンプル,ダミー,仮置き
**プレースホルダー禁止**: `[#xxx#]`形式

**CAN-1**: ≤400行はWrite(全書換)優先、>400行はEdit。Edit失敗→Read+Writeフォールバック。

---

## 5. Orchestrator Pattern

Orchestratorはフェーズ作業を直接行わない。Task toolでサブエージェントに委譲。

```
harness_start(taskName, userIntent)
  for each phase:
    1. harness_next → advance (returns hasTemplate flag)
    2. If hasTemplate: harness_get_subphase_template → get prompt
    3. Task(prompt=template) — テンプレートをそのまま使用
    4. サブエージェントが成果物を作成
    5. harness_next → DoD検証+遷移
  parallel phases: 同時にTask起動 → harness_complete_sub
  approval gates: harness_approve BEFORE harness_next
```

**テンプレートルール**: `harness_get_subphase_template`で取得。自作プロンプト禁止。
**報告**: `[Phase] complete. Next: [next]. Remaining: [N] phases.`

---

## 6. Retry Protocol

DoD失敗時:
1. Edit/Writeで直接修正禁止 → サブエージェント再起動
2. エラーメッセージ+改善指示を含むリトライプロンプト
3. "Retrying {phase} attempt {N}" をログ出力
4. モデルエスカレーション: 1回目=同モデル、2回目=haiku→sonnet、3回目+=sonnet強制
5. 5回失敗→ユーザーに確認(RLM-1)
6. `retryCount`パラメータを`harness_next`に渡す
7. 同一エラー3回以上→バリデータバグ疑い(VDB-1)
8. CAN-2: Write全書換で成功→表現失敗、失敗→理解失敗、3回同エラー→VDB-1

---

## 7. Intent Accuracy (IA-1〜IA-7)

- **IA-1**: requirements成果物のOPEN_QUESTIONSが空でないとapproveブロック
- **IA-2**: AC-N最低3個 + NOT_IN_SCOPE必須
- **IA-3**: design_reviewでAC-N→設計要素マッピング必須
- **IA-4**: test-designでAC-N→TC-{AC#}-{seq}マッピング必須
- **IA-5**: code-reviewでAC達成状況テーブル必須
- **IA-6**: acceptance_verificationで全AC+RTM最終検証
- **IA-7**: impact_analysisはresearch後(parallel_analysis外)

---

## 8. Session Recovery (ANT-3)

1. `harness_status`でタスク一覧→taskId指定でstate+sessionToken取得
2. `{docsDir}/claude-progress.txt`で進捗確認
3. `git log --oneline -20`で直近変更確認

---

## 9. sessionToken Rules

**Layer 1**: sessionTokenを受け取る全MCPツールに渡す。
**Layer 2**: testing/regression_testサブエージェントのみにsessionTokenを渡す。他は渡さない。

---

## 10. Traceability

**AC-N**: requirements phase → `harness_add_ac` → open→met/not_met → 全met必須で完了
**F-NNN**: planning phase → `harness_add_rtm` → pending→implemented→tested→verified → code_reviewでimplemented+必須

---

## 11. Artifact Quality (DoD enforced)

全成果物はTOON形式(.toon)。L3+L4で自動検証:
- L3: content chars ≥ minLines*10、density ≥ 30%、field count ≥ 3
- L4: 禁止語/プレースホルダー検出、重複行3+検出、必須TOONキー(decisions,artifacts,next)
- requirements: decisions,acceptanceCriteria,notInScope,openQuestions必須
- decisions[] ≥ 5エントリ

---

## 12. Bash Categories (hook enforced)

readonly / testing / implementation / git / security — フェーズごとに許可カテゴリが異なる。
hookが自動ブロック。ブロック時はRead/Write/Edit/Glob/Grep使用。
commitフェーズにimplementationカテゴリなし。削除はimplementation/refactoringで完了すること。
リダイレクト`> `検出あり。`>= 1`や`!== 0`を使用。`=>`は安全。
