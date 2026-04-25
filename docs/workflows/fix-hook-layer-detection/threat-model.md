# Threat Model — fix-hook-layer-detection

## Attack Surface

本修正は Claude Code の PreToolUse hook 配下で実行される `tool-gate.js::detectLayer()` の挙動を変える。hook は信頼境界の内側であり、外部入力 (hookInput JSON) は Claude Code 自身が生成する。

## Threats

### T-1: layer 誤判定による権限昇格

旧実装では全 subagent が `'coordinator'` 扱いになっていた。新実装では `'worker'` 扱いになる。これが新たな権限昇格の経路を開かないかを評価する。
- Severity (T-1): low — worker と coordinator の実効権限は checkWriteEdit での path gate の許可セットと同じで、2 層モデル上の実質差がない
- Mitigation: 既存の checkWriteEdit path gate は変更せず、許可される path セットは従来通り

### T-2: orchestrator として偽装して L1 制限を回避

agent_id を削除することで orchestrator 判定に落とせる可能性。
- Severity (T-2): low — agent_id は Claude Code のみが付与でき、subagent が自力で hookInput を書き換えることはできない
- Mitigation: hookInput の生成は Claude Code 側で制御されており改ざん不可

### T-3: HARNESS_LAYER 環境変数での偽装

HARNESS_LAYER=worker をセットすることで意図しない層判定を誘発する可能性。
- Severity (T-3): low — 環境変数は開発者が明示的に設定する debug 用途のみ。通常運用では未設定であり、本修正で挙動は変わらない
- Mitigation: 運用手順書で本変数の明示指定を要求しない、CI でセットしない

### T-4: hook のロード失敗で gate を無効化

修正後の tool-gate.js に syntax error があれば hook 起動失敗で全 gate が invalidate される可能性。
- Severity (T-4): medium — hook の ロード失敗は fail-close ではなく fail-open に倒れる可能性がある
- Mitigation: 既に smoke test (worker から .agent への Write 成功) で構文問題がないことを確認済み。追加テストを __tests__ 配下に追加し CI で検証

### T-5: 既存タスクの state 汚染

過去に誤った layer 判定で書かれた state ファイルが残存している場合、新判定との不整合が起きる可能性。
- Severity (T-5): informational — state ファイルは layer 情報を保存しない。checkWriteEdit の判定は都度評価のため過去判定は参照されない
- Mitigation: 検証のみ (過去 state の再評価不要)

## decisions

- D-001: T-1 対応として checkWriteEdit の path gate は本修正で変更しない。理由: 許可されるパスセットは従来通りであり、layer 判定の正常化のみが目的だから
- D-002: T-2 対応として hookInput 改ざん防止は Claude Code 側に委ねる。理由: 本修正のスコープは tool-gate.js に閉じており、hook 入力生成層は別責務だから
- D-003: T-4 対応として __tests__ 配下に tool-gate.test.js を追加しロード可能性を CI で検証する。理由: syntax error による fail-open を防ぐ最も確実な手段がユニットテストでの lint + execution だから
- D-004: T-5 対応として過去 state の migration は実施しない。理由: layer 情報は state に保存されず都度評価のため unnecessary
- D-005: HARNESS_LAYER の運用制約 (通常未設定、debug 用途のみ) をドキュメントに記録する。理由: 将来の開発者が誤って CI で設定するリスクを減らすため

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/threat-model.md (本ファイル — 脅威分析と mitigation の記録)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (評価対象、ホットパッチ済み)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (syntax + lint を CI で担保する新規ファイル)
- C:/ツール/Workflow/docs/adr/ADR-030-hook-layer-detection.md (設計判断記録、HARNESS_LAYER 運用制約を記述する)
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md (AC と RTM の参照元)

## next

- design phase: detectLayer の入出力契約と責務境界を図示
- test_design phase: 脅威 T-1〜T-5 に対応する回帰テストケースを列挙
- test_impl phase: tool-gate.test.js を実装
- implementation phase: ホットパッチ済みコードを最終確認
- documentation phase: ADR-030 に threat model の要点を要約として含める
