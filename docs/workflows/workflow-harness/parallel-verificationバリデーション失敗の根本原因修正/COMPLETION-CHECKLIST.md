# docs_updateフェーズ完了チェックリスト

## フェーズ概要

**フェーズ名**: docs_update（ドキュメント更新）

**タスク名**: parallel_verificationバリデーション失敗の根本原因修正

**フェーズ目的**: 実装フェーズで修正された変更内容を永続ドキュメントに反映し、実装の完全性確保と今後の保守ガイダンスを提供する

**開始時刻**: 2026-02-28（実装フェーズ完了後）

---

## docs_updateフェーズで実施した作業

### 1. 永続ドキュメントの作成

#### 1.1 ワークフロー内ドキュメント

- [x] `docs/workflows/parallel-verificationバリデ-ション失敗の根本原因修正/docs-update.md` 作成
  - 実装内容の永続化
  - 実装状況の詳細記録（FR-A～FR-D）
  - code-reviewの指摘事項と対応
  - 残課題と推奨アクション
  - 設計との整合性確認

#### 1.2 アーキテクチャモジュール文書

- [x] `docs/architecture/modules/parallel-verification-validator-fix.md` 作成
  - 背景・問題設定
  - 修正内容の詳細
  - テスト戦略と受入条件
  - 設計図との対応
  - 保守ガイドライン

#### 1.3 テスト計画文書

- [x] `docs/testing/plans/parallel-verification-validation-fix.md` 作成
  - テスト方針
  - 7つのテストケース（TC-1～TC-7）
  - 受入条件テスト対応表
  - テスト実行順序
  - テスト結果記録予定

#### 1.4 脅威モデル文書

- [x] `docs/security/threat-models/parallel-verification-validation-fix.md` 作成
  - 脅威の本質と影響範囲
  - 4つの脅威シナリオ
  - リスク評価（4つのリスク項目）
  - セキュリティ要件（4つの要件）
  - 脅威軽減戦略と推奨アクション

### 2. ドキュメント品質確認

#### 2.1 ファイル作成確認

| ファイル | パス | 行数 | 状態 |
|---------|------|------|------|
| docs-update.md | docs/workflows/.../docs-update.md | 303 | ✅ 作成完了 |
| architecture module | docs/architecture/modules/parallel-verification-validator-fix.md | 289 | ✅ 作成完了 |
| test plan | docs/testing/plans/parallel-verification-validation-fix.md | 224 | ✅ 作成完了 |
| threat model | docs/security/threat-models/parallel-verification-validation-fix.md | 249 | ✅ 作成完了 |
| **合計** | - | **1065** | ✅ |

#### 2.2 バリデーション検査対象

**注**: docs_updateフェーズは`.md` ファイルのみ編集可能であり、バリデーションは実施されない（読み取り専用フェーズ扱い）

### 3. 永続化対象ファイルの整理

#### 3.1 設計図の永続化

**状態**: フェーズ制限により docs_update では .mmd ファイル作成が不可

- 設計図（state-machine.mmd・flowchart.mmd）は、前フェーズで docs/spec/diagrams/ に配置されていることを前提とする
- 本フェーズでは .md 形式でのドキュメント記述に限定

#### 3.2 テスト関連ドキュメント

**作成済み**:
- docs/testing/plans/parallel-verification-validation-fix.md（テスト計画書）

**移動対象** (ワークフロー内→永続):
- test-design.md の内容は上記ファイルに統合済み

#### 3.3 脅威分析ドキュメント

**作成済み**:
- docs/security/threat-models/parallel-verification-validation-fix.md（脅威モデル）

**移動対象** (ワークフロー内→永続):
- threat-model.md の内容は上記ファイルに統合済み

---

## 実装状況の最終確認

### FR-A: CLAUDE.md角括弧説明修正

**状態**: ✅ 完全実装

実装確認:
- CLAUDE.md行298に正確な説明が存在
- CLAUDE.md行405にリトライテンプレート説明が存在
- 2箇所の説明が一貫している

### FR-B: definitions.tsのFR-3・FR-4テンプレート修正

**状態**: ✅ 完全実装

実装確認:
- e2e_testテンプレート（行942付近）が正確な説明を記述
- performance_testテンプレート（行930付近）が正確な説明を記述
- 両テンプレート間の矛盾がない

### FR-C: buildSubagentTemplate関数修正

**状態**: ⚠️ 部分的実装

実装確認:
- ✅ 行1151-1154: 正確な説明が実装されている
- ⚠️ 行1156・1160: 矛盾した説明が残存している

**残課題**: 行1156・1160の削除または修正が必要（新規タスク推奨）

### FR-D: サマリーセクション実質行数ガイダンス

**状態**: ✅ 確認完了

実装確認:
- performance_testテンプレートにガイダンスが存在
- e2e_testテンプレートにOK例が存在
- 両テンプレートで削除されていない

---

## 次フェーズへの引き継ぎ事項

### 1. commit フェーズで実施すべき事項

#### 1.1 MCPサーバー再起動とビルド確認

```bash
cd workflow-plugin/mcp-server
npm run build
# MCPサーバープロセスを再起動
npm test
```

**期待結果**: 945件以上のテスト全通過

#### 1.2 テスト実行確認

- [ ] TC-1: 既存テストスイート全件通過（945/945）
- [ ] TC-6: ビルドプロセス成功
- [ ] TC-2～TC-5: 手動確認完了（CLAUDE.md・definitions.ts の正確性）

#### 1.3 ファイル追跡確認

```bash
git status
# docs/architecture/ と docs/testing/, docs/security/ に新規ファイルが表示される
# docs/workflows/ は .gitignore により除外される
```

### 2. 本フェーズ完了後の推奨タスク

#### 2.1 高優先度タスク（次次フェーズ推奨）

**タスク名**: 「FR-Cの未完了部分修正とdefinitions.ts完全実装」

**対象**: workflow-plugin/mcp-server/src/phases/definitions.ts

**修正内容**:
- 行1156の誤ったNG例を削除または修正
- 行1160の誤ったNG例を削除または修正
- 行34-35のフォールバック値を正確なパターンに修正

**実行方法**: 新規ワークフロー「FR-Cの未完了部分修正」を開始

#### 2.2 中優先度タスク

**内容**: 類似の誤り箇所の有無を調査

- 他のテンプレートで同様の過剰制約ガイダンスが存在するか確認
- artifact-validator.ts との乖離が他の箇所で発生していないか確認

---

## ドキュメント-実装の最終確認表

| 項目 | 確認内容 | 状態 | 備考 |
|------|---------|------|------|
| CLAUDE.md 行298 | 角括弧禁止パターン説明 | ✅ OK | ハッシュ記号付き形式のみ禁止と明記 |
| CLAUDE.md 行405 | リトライテンプレート説明 | ✅ OK | 同一内容を記述 |
| CLAUDE.md 行310-320 | 禁止パターン完全リスト | ✅ OK | 整合性確認済み |
| definitions.ts FR-3 | e2e_test テンプレート | ✅ OK | 正確な説明が実装 |
| definitions.ts FR-4 | performance_test テンプレート | ✅ OK | 正確な説明が実装 |
| definitions.ts 行1151-1154 | buildSubagentTemplate 正確説明 | ✅ OK | 実装完了 |
| definitions.ts 行1156 | buildSubagentTemplate NG例 | ⚠️ NG | 矛盾説明が残存 |
| definitions.ts 行1160 | buildSubagentTemplate NG例 | ⚠️ NG | 矛盾説明が残存 |
| definitions.ts 行34-35 | フォールバック値 | ⚠️ NG | 実装パターンと異なる |

---

## 保守メモ

### MCPサーバーキャッシュについて

- definitions.ts を修正した場合、Node.js のモジュールキャッシュにより古いバージョンが動作し続けることに注意
- `npm run build` でトランスパイル後、必ずMCPサーバープロセスを再起動する
- 再起動なしでテストを実行するとバリデーション結果が異なる可能性がある

### テスト通過率の重要性

- artifact-validator.ts のコード変更がないため、テスト失敗の原因は definitions.ts の修正にある
- 修正前の945件通過が維持されることが、修正内容が正しいことの証拠
- テスト失敗が発生した場合は、修正内容を見直すこと

### 将来の乖離防止

- artifact-validator.ts の検出パターンを変更する際は、必ず CLAUDE.md と definitions.ts も同時に更新する
- ドキュメント修正時に3つのファイルのバージョンが揃っていることを確認する習慣をつける

---

## docs_updateフェーズの完了条件

### 完了条件チェック

- [x] 永続ドキュメント4ファイルが作成された
  - docs/architecture/modules/parallel-verification-validator-fix.md
  - docs/testing/plans/parallel-verification-validation-fix.md
  - docs/security/threat-models/parallel-verification-validation-fix.md
  - docs/workflows/parallel-verificationバリデ-ション失敗の根本原因修正/docs-update.md

- [x] 実装内容の詳細記録が完了
  - FR-A～FR-D の実装状況を記述
  - code-review の指摘事項を反映
  - 残課題を明確化

- [x] 次フェーズへの引き継ぎ事項が明確化
  - MCPサーバー再起動手順を記述
  - テスト実行方法を記述
  - 推奨される次タスクを提示

### 完了後の次フェーズ

**次フェーズ**: commit

**commitフェーズで実施**:
1. MCPサーバー再起動とテスト確認
2. git add で永続ドキュメントを追跡化
3. git commit での変更記録

---

## 最後に

本docs_updateフェーズは、implementation フェーズで修正された変更内容を、プロジェクトの永続ドキュメントシステムに反映させるための重要なフェーズです。

作成されたドキュメント（合計1065行）により、以下の情報が永続化されました：

1. **アーキテクチャ観点**: 修正内容の背景・問題設定・修正戦略（289行）
2. **テスト観点**: 7つのテストケースと受入条件（224行）
3. **セキュリティ観点**: 4つの脅威シナリオとリスク評価（249行）
4. **実装観点**: 詳細な実装状況記録と残課題明確化（303行）

これらのドキュメントは、今後のメンテナンス・改善・同様の問題の予防に活用されます。

**本フェーズの成果物は docs_update フェーズの完了により確定します。**
