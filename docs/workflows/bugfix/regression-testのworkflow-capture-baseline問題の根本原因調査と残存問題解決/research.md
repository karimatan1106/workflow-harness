# リサーチフェーズ結果報告書

## サマリー

- 目的: 前タスク（20260224_120405）で実施した FR-13/FR-14 の修正が完全か否かを検証し、残存する問題と根本原因を特定する
- 主要な決定事項: FR-13（禁止ツールリストへの workflow_capture_baseline 追加）と FR-14（ベースライン前提条件セクション追加）は definitions.ts に正しく実装されており、対応するテストケース TC-FIX-1 / TC-FIX-2 も追加済みである
- 前タスクの「修正箇所3（任意）: testing バイパス時の Orchestrator ガイダンス」が未実施であり、今回タスクの中心的な調査対象となる
- 調査で新たに判明した事実: testing フェーズのスキップ時に REQ-4 の自動ベースライン設定が行われないため、特定条件下でベースラインなしのまま regression_test フェーズに遷移する経路が存在する
- 次フェーズで必要な情報: CLAUDE.md ルール20への testing バイパス時ガイダンス追記と、definitions.ts testing テンプレートへの Orchestrator 向けガイダンス追加が優先課題として確定した

## 調査結果

### FR-13/FR-14 の実装確認

definitions.ts の regression_test エントリ（887行目）を確認した。

FR-13 の確認結果として、禁止対象リストの末尾に `workflow_capture_baseline` が追加されており、「workflow_capture_baselineはtestingフェーズでのみMCPサーバーが受け付ける設計であり、regression_testフェーズからの呼び出しはアーキテクチャ上エラーとなる」という禁止理由の説明文が追加されていた。これは前タスクの spec.md が要求した仕様と完全に一致している。

FR-14 の確認結果として、「ベースライン前提条件」セクションが sessionToken セクションの直後・ワークフロー制御ツール禁止セクションの直前に挿入されており、以下の4点が記載されていた。
1点目: ベースラインは testing フェーズで workflow_capture_baseline を呼び出して記録済みであることが前提条件
2点目: regression_test フェーズでは workflow_capture_baseline を再度呼び出す必要はなく、呼び出してもアーキテクチャ上エラーが返る
3点目: ベースライン情報の確認には workflow_get_test_info を使用可能
4点目: ベースラインが未設定の場合は Orchestrator が workflow_back で testing フェーズへ差し戻す必要がある

TC-FIX-1 および TC-FIX-2 のテストケースが `definitions-subagent-template.test.ts` に追加されており、207〜223行目に TC-FIX-1b・TC-FIX-2b・TC-FIX-2c も含めた5つのアサーションが存在する。

### testing フェーズバイパスのメカニズム調査

`calculatePhaseSkips` 関数（definitions.ts 511〜585行目）の分析により、以下の条件でフェーズがスキップされることが判明した。

コードファイルもテストファイルもスコープに含まれない場合（docs変更のみのタスク等）は、testing フェーズと regression_test フェーズが両方スキップされる。この場合、regression_test フェーズが存在しないためベースライン問題は発生しない。

コードファイルはスコープに含まれるが、テストファイルがスコープに含まれない場合（例: .ts ファイルのみをスコープに設定）は、test_impl フェーズのみがスキップされ、testing フェーズはスキップされない。この経路ではベースライン問題は発生しない。

スコープファイルが空（files.length が 0）の場合は test_impl・implementation・refactoring がスキップされ、testing フェーズはスキップされない。この経路でもベースライン問題は発生しない。

つまり `calculatePhaseSkips` の現在の実装では、testing フェーズと regression_test フェーズを「両方スキップしない」か「両方スキップする」かのいずれかであり、testing のみをスキップして regression_test だけ実行するという経路は現時点では存在しない。

### REQ-4 自動ベースライン設定のメカニズム確認

`next.ts` の 342〜358行目に REQ-4 として testing → regression_test 遷移時のベースライン自動設定処理が存在する。この処理は `testResult.passedCount` または `testResult.failedCount` が設定されている場合に `taskState.testBaseline` を自動設定する。

この自動設定は testing フェーズの正常遷移時（workflow_next が testing フェーズから呼ばれた時）のみ実行される。testing フェーズがスキップされた場合は全く実行されない。

ただし前述の通り、testing フェーズがスキップされる場合は regression_test フェーズも同時にスキップされるため、REQ-4 が実行されなくても後続で問題は発生しない。

### CLAUDE.md ルール20 の内容確認

CLAUDE.md の 695〜699行目にルール20「既存テストのベースライン記録義務」が記載されている。現在の記述は以下の通りである。
- testingフェーズまでに既存テストスイートを実行し、workflow_capture_baseline で結果を記録すること
- research フェーズは testing カテゴリがブロックされるためテスト実行は testing フェーズで行うことを標準とする
- ベースラインが未設定の場合、regression_test フェーズで変更前後の比較ができなくなる
- 既存テストが存在しない新規プロジェクトでは記録不要

「testing バイパス時の Orchestrator 対応方法」に関するガイダンスは一切記載されていない。

### testing フェーズバイパス時のベースライン不設定シナリオの可能性

実際の運用上リスクとなるシナリオを検討する。現在の `calculatePhaseSkips` 実装では testing と regression_test が「セット」でスキップまたは「セット」で実行される。しかし将来の機能拡張で testing をスキップし regression_test を実行する経路が追加される可能性がある。

また、forceTransition: true フラグを使用して regression_test フェーズに強制遷移した場合にもベースライン不設定の問題が発生しうる。next.ts の 362〜370行目では `forceTransition` が true の場合にベースライン存在チェックをスキップする実装が存在するが、regression_test → parallel_verification 遷移時（line 409〜415）は `forceTransition` に関係なくベースラインの存在を必須としている。これは設計上の不整合である可能性があるが、ルール20のガイダンス対象外として今回は情報として記録のみとする。

## 既存実装の分析

### FR-13/FR-14 実装の完全性評価

FR-13 について、禁止ツールリストへの追記と禁止理由の説明文の両方が実装されており、前タスクの spec.md に定義された受入条件を満たしている。TC-FIX-1 と TC-FIX-1b のテストケースがアサーションを通過する状態であることを Grep 調査で確認した（「workflow_capture_baseline」と「アーキテクチャ上エラー」の両文字列が regression_test テンプレートに存在する）。

FR-14 について、「ベースライン前提条件」セクションが正しい位置に挿入されており、4つの必須項目（記録済み前提・再呼び出し不要・workflow_get_test_info の案内・workflow_back による差し戻し）がすべて記述されている。TC-FIX-2・TC-FIX-2b・TC-FIX-2c のテストケースが通過する状態であることを Grep 調査で確認した。

### 前タスクの「修正箇所3（任意）」の状況確認

前タスクの research.md 84〜86行目に「修正箇所3（任意）: testing バイパス時の Orchestrator ガイダンス（優先度: 中）」として記録されていた内容について、以下のことが確認できた。

CLAUDE.md のルール20には testing バイパス時のガイダンスが追加されていない。definitions.ts の testing テンプレートにも「testing がスキップされる場合の Orchestrator 対処方法」は記述されていない。これは前タスクで「任意・優先度: 中」として未実施のまま残された状態である。

### testing テンプレートの現在の内容分析

testing テンプレート（definitions.ts 878行目）には以下のセクションが存在する。
- workflow_record_test_result 呼び出し時の注意
- workflow_capture_baseline 呼び出し（ベースライン記録）の必須化
- sessionToken の取得方法と使用制限
- ワークフロー制御ツール禁止セクション

testing テンプレートは subagent 向けのガイダンスであり、Orchestrator が testing フェーズをスキップした場合の対処方法については記述対象外となる。testing バイパス時の対処は Orchestrator 向けの CLAUDE.md に記述するのが適切な箇所である。

### 残存問題の結論

今回の調査で確認した残存問題は以下の1件である。

CLAUDE.md ルール20「既存テストのベースライン記録義務」に、testing フェーズが calculatePhaseSkips によって自動スキップされる場合の注意事項が記載されていない。

具体的には「testing と regression_test は calculatePhaseSkips によってセットでスキップされる設計であり、testing のみがスキップされる経路は現時点では存在しない」という情報と、「将来的に testing のみがスキップされる経路が追加された場合や forceTransition を使用した場合は、Orchestrator が直接 workflow_capture_baseline を呼び出す必要がある（ただし research フェーズでのみ可能であることに注意が必要）」という補足ガイダンスの追加が、安全な運用のために有益である。

ただし現在の実装（testing と regression_test がセットでスキップされる）では、ルール20の追記なしでも実際のエラーは発生しない。このため、この残存問題は「潜在的リスクへの文書化」という性質であり、優先度は低から中程度に分類される。

FR-13 と FR-14 は完全に実装されており、前タスクの主要修正箇所は全て解決済みである。
