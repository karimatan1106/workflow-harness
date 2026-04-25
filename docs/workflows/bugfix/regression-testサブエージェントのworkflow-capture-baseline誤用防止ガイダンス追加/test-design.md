# テスト設計: regression_test サブエージェントの workflow_capture_baseline 誤用防止ガイダンス追加

## サマリー

- 目的: FR-13（禁止ツールリストへの workflow_capture_baseline 追記）と FR-14（ベースライン前提条件セクション追加）の両方が definitions.ts の regression_test.subagentTemplate に正しく含まれることをテストで担保する
- 主要な決定事項: 既存のテストファイル `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` に新規 describe ブロックを追加する形で実装する。既存テストスイートの構造（FR-6 から FR-12 まで）と整合したスタイルで記述する
- 変更対象テストファイル: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` に新規テストケースを追加し、`workflow-plugin/mcp-server/src/phases/definitions.ts` に対して変更なし（テスト設計フェーズでは読み取りのみ）
- 次フェーズで必要な情報: test_impl フェーズで追加する describe ブロックの名称は「FR-13: regression_test サブエージェントの禁止ツールリスト検証」と「FR-14: regression_test サブエージェントのベースライン前提条件セクション検証」とする。テストが TDD Red フェーズとして失敗することを確認した後、implementation フェーズで definitions.ts を修正してテストを Green にする

## テスト方針

### 対象となる変更の概要

今回のタスクが対象とするのは `workflow-plugin/mcp-server/src/phases/definitions.ts` の regression_test エントリの `subagentTemplate` フィールドへの2種類のテキスト追記である。
現在の subagentTemplate は「★ワークフロー制御ツール禁止★」セクションの禁止対象リストに `workflow_capture_baseline` を含んでおらず、また「ベースライン前提条件」を説明するセクションが存在しない。
この欠落を補う修正が FR-13 と FR-14 であり、テストはその修正が正しく適用されていることを検証する。

### テストの種別と範囲

ユニットテストとして実装する。テスト対象は `resolvePhaseGuide('regression_test', 'docs/workflows/test')` の戻り値の `subagentTemplate` フィールドであり、特定の文字列が含まれているかを `toContain` マッチャーで検証する形式を採用する。
この形式は既存の FR-6 から FR-12 のテストスイートと統一されており、テストの可読性と保守性を高める。
統合テストや E2E テストは今回の変更に含まれない。変更範囲が definitions.ts の文字列フィールドのみであるため、ユニットテストで十分な検証ができる。

### 既存テストのリグレッション方針

現在のテストスイートは 940 テストケースを含む（spec.md の記述に基づく。ビルド完了後の実際の件数を testing フェーズで確認する）。
今回の変更対象は regression_test.subagentTemplate の文字列フィールドのみであり、既存のテストに使用される resolvePhaseGuide や PHASE_GUIDES の構造には影響しない。
したがって、既存テストが引き続き全件合格することが期待され、リグレッションの発生リスクは低いと評価する。
testing フェーズで既存テストスイートを実行し、全件合格を確認することで明示的にリグレッションの有無を検証する。

### TDD サイクルの適用

test_impl フェーズでは以下の TDD サイクルを実施する。まず definitions.ts を変更する前に新規テストケースを追加して TDD Red 状態（テスト失敗）を確認する。次に implementation フェーズで definitions.ts の regression_test.subagentTemplate に FR-13 と FR-14 の内容を追記してテストを Green にする。

## テストケース

### TC-FIX-1: FR-13 workflow_capture_baseline 禁止リスト追加の検証（正常系）

このテストは regression_test フェーズの subagentTemplate に「workflow_capture_baseline」という文字列が含まれることを検証する。
具体的には、禁止対象リストの行に「workflow_capture_baseline」が追記されていることを確認する。

テスト対象メソッドは `resolvePhaseGuide('regression_test', 'docs/workflows/test')` の戻り値の subagentTemplate フィールドである。
検証方法は `expect(template).toContain('workflow_capture_baseline')` を使用する。

この検証が成立することで、サブエージェントがプロンプトを参照した際に当該ツールが禁止対象として認識できる。
TDD Red 状態（実装前）では template 文字列に「workflow_capture_baseline」が含まれないためテストが失敗する。
実装完了後（TDD Green 状態）では template 文字列に「workflow_capture_baseline」が含まれるためテストが合格する。

### TC-FIX-1b: FR-13 禁止理由の説明文の検証（正常系）

このテストは regression_test フェーズの subagentTemplate に、workflow_capture_baseline の禁止根拠を示す説明文が含まれることを検証する。
spec.md によれば、追加する説明文の趣旨は「testing フェーズでのみ MCP サーバーが受け付ける設計であり、regression_test フェーズからの呼び出しはアーキテクチャ上エラーとなる」というものである。

検証は「testing フェーズ」という文字列が禁止ツールセクション内に存在することを確認する方法で実施する。
具体的には `expect(template).toContain('testingフェーズでのみ')` または類似の文字列で検証する。
実装フェーズで追記する際の実際のテキストに合わせて、検証文字列を調整する必要がある。

### TC-FIX-2: FR-14 ベースライン前提条件セクションの存在検証（正常系）

このテストは regression_test フェーズの subagentTemplate に「ベースライン前提条件」というセクション見出しが含まれることを検証する。
spec.md によれば、このセクションは「sessionTokenの取得方法と使用制限」セクションの直後であり「★ワークフロー制御ツール禁止★」セクションの直前に挿入される。

テスト対象は `resolvePhaseGuide('regression_test', 'docs/workflows/test')` の戻り値の subagentTemplate フィールドである。
検証方法は `expect(template).toContain('ベースライン前提条件')` を使用する。

TDD Red 状態では template 文字列にこのセクション見出しが含まれないためテストが失敗する。
TDD Green 状態では追記済みの template 文字列にセクション見出しが含まれるためテストが合格する。
このテストは FR-14 が適用されたかどうかの最も基本的な確認である。

### TC-FIX-2b: FR-14 workflow_get_test_info 言及の検証（正常系）

このテストは regression_test フェーズの subagentTemplate に「workflow_get_test_info」という文字列が含まれることを検証する。
spec.md によれば、ベースライン前提条件セクションの3点目として「ベースライン情報の確認手段として workflow_get_test_info を使用できる」という案内を記載することが求められている。

テスト対象は subagentTemplate フィールドである。
検証方法は `expect(template).toContain('workflow_get_test_info')` を使用する。
この確認により、サブエージェントがベースライン情報の確認方法を理解できるようになっていることを担保する。

### TC-FIX-2c: FR-14 workflow_back 差し戻し手順の言及検証（正常系）

このテストは regression_test フェーズの subagentTemplate に「workflow_back」というツール名が含まれることを検証する。
spec.md によれば、ベースライン前提条件セクションの4点目として「ベースライン未設定時の差し戻し手順」として Orchestrator が workflow_back を使用して testing フェーズへ差し戻すことが記載される。

検証方法は `expect(template).toContain('workflow_back')` を使用する。
この検証が成立することで、ベースラインが未設定の状況における正しいリカバリー手順がテンプレートに含まれていることを確認できる。

### TC-R-13: regression_test フェーズ名の保持確認（リグレッション防止）

このテストは regression_test フェーズの phaseName フィールドが変更前と同じく「regression_test」であることを確認する。
文字列フィールドへの追記がフェーズのメタデータに影響していないことを保証するためのリグレッション防止テストである。

検証方法は `expect(phaseGuide?.phaseName).toBe('regression_test')` を使用する。

### 境界値・異常系テスト

今回の変更は subagentTemplate フィールドへのテキスト追記のみであり、複雑な条件分岐やロジック変更を含まない。
したがって、境界値テストや異常系テストは本タスクの対象外とする。
入力値の型違いや null チェックは既存の definitions.test.ts でカバーされており、新規追加は不要である。

## テストファイルの配置

### 変更対象テストファイル

変更対象のテストファイルパスは `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions-subagent-template.test.ts` である。
このファイルの末尾（FR-12 の describe ブロックの後）に、FR-13 と FR-14 の2つの describe ブロックを追加する。

### 追加する describe ブロックの構造

FR-13 の describe ブロック名は「FR-13: regression_testフェーズの禁止ツールリスト検証（workflow_capture_baseline）」とする。
その中に TC-FIX-1 と TC-FIX-1b の2つの it ブロックを配置する。

FR-14 の describe ブロック名は「FR-14: regression_testフェーズのベースライン前提条件セクション検証」とする。
その中に TC-FIX-2、TC-FIX-2b、TC-FIX-2c、TC-R-13 の4つの it ブロックを配置する。

### ビルド手順と確認

test_impl フェーズでテストファイルを追加した後、`cd workflow-plugin/mcp-server && npm test` を実行して TDD Red 状態（新規テストが失敗し、既存テストが全件合格）を確認する。
implementation フェーズで definitions.ts を修正した後、再度 `npm test` を実行して TDD Green 状態（全テストが合格）を確認する。
ビルド後は `npm run build` を実行してトランスパイルし、MCP サーバーの再起動を行うことが CLAUDE.md のルール22で求められている。
