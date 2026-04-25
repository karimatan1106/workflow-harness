# フローチャート説明書 - 修正時発生問題の根本原因調査と残存問題解決

## サマリー

本フローチャートは、前回のparallel_verificationフェーズで発生した2件の修正対象問題に対する解決処理フローを表現している。
- **目的**: definitions.tsのsecurity_scanテンプレート改善とstatus.tsのレスポンス削減に関する実装処理を可視化する。
- **評価スコープ**: workflow-plugin/mcp-server/src/phases/definitions.ts、workflow-plugin/mcp-server/src/tools/status.tsの2ファイルに対する変更処理。
- **主要な決定事項**: テンプレート追記によるsecurity_scanの重複行回避強化、destructuring/delete演算子によるphaseGuideフィールド削減、MCPサーバー再起動の必須化。
- **検証状況**: specification.mdの実装計画に基づいた修正内容の確認とコンパイル・再起動手順の明示化。
- **次フェーズで必要な情報**: 修正後のコンパイル結果、MCPサーバー再起動の成功確認、workflow_status/workflow_nextのレスポンス構造変化の検証。

---

## フローチャートの構造

本フローチャートは以下の3つの主要な処理フローで構成されている。

### フロー1: 修正1 - definitions.tsのセキュリティスキャンテンプレート改善

**目的**: security_scanフェーズのsubagentテンプレートに評価結論フレーズのNG/OK例を追記し、重複行エラーの予防を強化する。

**処理ステップ**:

1. **仕様確認段階** — specification.mdから修正1の詳細仕様を確認する。
   - 現在のテンプレートに不足している内容（評価結論フレーズの重複回避例）を理解する。
   - 追記する位置（「重複行回避の注意事項」セクション末尾）を確認する。

2. **セクション特定段階** — 918行目のsecurity_scan.subagentTemplateフィールド内の「重複行回避の注意事項」セクション末尾を特定する。
   - 現在のNG/OK例の構造（FR番号・ファイル名による一意化例）を抽出する。
   - 評価結論フレーズの重複パターン（「問題なし」「リスクなし」の3件繰り返し）が記載されていないことを確認する。

3. **テキスト作成段階** — 追記するテンプレート文字列を準備する。
   - BUG-A・BUG-B・BUG-Cパターンの評価結論行のNGパターンを定義する。
   - 「BUG-1（definitions.ts importantSection追記）の評価: リスクなし、テンプレート文字列のみの変更でロジック非変更のため」のような具体的なOKパターンを作成する。
   - テンプレート文字列内での改行（`\n`）やエスケープ処理が適切に記述されていることを確認する。

4. **実装段階** — definitions.tsの918行目テンプレート文字列にテキストを追記する。
   - テンプレート文字列内のコンテキストに合わせて、フォーマットと改行を調整する。
   - 追記後のテンプレート文字列全体が有効なJavaScript文字列として保存されることを確認する。

**期待される効果**: security_scanフェーズのsubagentが、複数の修正点に対して同一の評価結論フレーズを繰り返すパターンと、その回避方法を明示的に理解できるようになる。

### フロー2: 修正2 - status.tsのphaseGuideレスポンス削減

**目的**: workflow_statusのレスポンスから重量フィールド（subagentTemplate・content・claudeMdSections）を除外し、レスポンスサイズを削減する。

**処理ステップ**:

1. **仕様確認段階** — specification.mdから修正2の詳細仕様を確認する。
   - 問題の現状（parallel_verificationフェーズで40000文字超のレスポンス）を理解する。
   - 解決方法（status.tsでのみ削減、next.tsは変更しない）を確認する。

2. **現状分析段階** — status.tsの121〜127行目のphaseGuide設定ロジックを分析する。
   - resolvePhaseGuideが返すオブジェクトの全フィールドがそのままresult.phaseGuideにセットされていることを理解する。
   - subagentTemplate・contentの文字数（5000〜10000文字/フィールド）と合計サイズを評価する。
   - 4サブフェーズ分で合計40000文字超が含まれる状態を認識する。

3. **実装方法選択段階** — destructuring記法 vs delete演算子の実装方法を選択する。
   - TypeScriptのstrict modeの設定を確認する。
   - strict=trueの場合、delete演算子ベースの代替実装を採用する。
   - strict=falseの場合、destructuring記法で実装する。

4. **コード作成段階** — 選択した実装方法でコードを準備する。
   - destructuring版: `const { subagentTemplate: _st, content: _c, claudeMdSections: _cms, ...slimGuide } = phaseGuide;`
   - delete版: `delete slimGuide['subagentTemplate']; delete slimGuide['content']; delete slimGuide['claudeMdSections'];`
   - subPhases内の各サブフェーズからも同3フィールドを削除するロジックを含める。

5. **null-safe設計段階** — 削除ロジックがnull-safe構造で実装されていることを確認する。
   - subPhasesがnull/undefinedの場合の処理を確認する。
   - 各subPhaseの型チェックを確認する。

6. **実装段階** — status.tsの121〜127行目をロジック変更で置き換える。
   - 既存コードを新しい削減ロジックに置き換える。
   - next.tsは変更しない方針を確認する。

**期待される効果**: workflow_statusのレスポンスサイズが大幅に削減され、メタ情報（phaseName、description、requiredSections等）のみが含まれるようになる。workflow_nextはsubagentTemplateを引き続き含むため、Orchestratorの動作は変わらない。

### フロー3: コンパイル・再起動・検証フロー

**目的**: 両修正を反映させたMCPサーバーをコンパイルし、モジュールキャッシュを更新して動作確認する。

**処理ステップ**:

1. **統合確認段階** — 両修正が独立していることを確認する。
   - 修正1と修正2は異なるファイル・異なる処理なので、実装順序は任意であることを確認する。
   - ただし、必ず最後に一度だけビルドと再起動を実施する方針を確認する。

2. **コンパイル計画段階** — `npm run build`の実行計画を立案する。
   - TypeScriptファイルをコンパイルしてdist/以下のJavaScriptファイルを生成する。
   - package.jsonのbuildスクリプトが実行されることを確認する。

3. **後方互換性確認段階** — next.tsは変更しないことで後方互換性を維持する。
   - workflow_nextのレスポンスにはsubagentTemplateが引き続き含まれることを確認する。

4. **再起動準備段階** — MCPサーバー再起動の必須性を説明する。
   - Node.jsモジュールキャッシュ機構により、ディスク上の変更は実行中のプロセスに反映されないことを説明する。
   - Claude Desktopのサーバー再起動ボタンまたはプロセス終了による再起動手順を準備する。

5. **修正1検証段階** — definitions.tsの修正が反映されたことを検証する。
   - workflow_nextを呼び出してレスポンス内のphaseGuide.subPhases.security_scan.subagentTemplateを確認する。
   - BUG番号・評価結論フレーズ・NG/OK例の文字列が追記されていることを目視確認する。

6. **修正2検証段階** — status.tsの修正が反映されたことを検証する。
   - workflow_statusを呼び出してレスポンスJSONを確認する。
   - phaseGuideフィールドにsubagentTemplate・content・claudeMdSectionsが含まれていないことを確認する。

7. **後方互換性検証段階** — workflow_nextの後方互換性が維持されていることを検証する。
   - workflow_nextを呼び出してレスポンスにsubagentTemplateが含まれていることを確認する。
   - status.tsの修正はworkflow_statusにのみ影響し、workflow_nextには影響しないことを検証する。

8. **サマリー作成段階** — 修正内容と検証結果をサマリーにまとめる。
   - 両修正の目的・内容・検証結果を記録する。

---

## フローチャートの処理フロー

```
タスク開始
    ↓
問題分析（修正1・修正2に分岐）
    ├─ 修正1フロー: 仕様確認 → セクション特定 → テキスト作成 → 実装
    └─ 修正2フロー: 仕様確認 → 現状分析 → 方法選択 → コード作成 → null-safe設計 → 実装
    ↓
統合確認（両修正の独立性確認）
    ↓
コンパイル計画 → TypeScriptコンパイル → dist/生成 → 再起動必須確認
    ↓
修正1検証: workflow_nextでテンプレート文字列確認
    ↓
修正2検証: workflow_statusでレスポンスサイズ確認
    ↓
後方互換性検証: workflow_nextでsubagentTemplate確認
    ↓
サマリー作成
    ↓
タスク完了
```

---

## 関連するシステムコンポーネント

### 修正対象ファイル

- **workflow-plugin/mcp-server/src/phases/definitions.ts** (918行目)
  - security_scanのsubagentTemplate文字列リテラル
  - 「重複行回避の注意事項」セクション末尾に追記

- **workflow-plugin/mcp-server/src/tools/status.ts** (121〜127行目)
  - phaseGuide設定ロジック
  - destructuring/delete演算子でsubagentTemplate・content・claudeMdSectionsを除外

### 変更しないファイル

- **workflow-plugin/mcp-server/src/tools/next.ts**
  - レスポンスには全フィールド（subagentTemplateを含む）を返す
  - Orchestratorのsubagentテンプレート取得機構を維持

- **workflow-plugin/mcp-server/src/phases/artifact-validator.ts**
  - バリデーターのロジック変更は不要
  - テンプレート文字列の修正で対応

---

## キーポイント

1. **テンプレート追記は自然言語レベル** — definitions.tsの修正はプログラムロジック変更ではなく、テンプレート文字列内の説明文追記のみである。

2. **レスポンス削減は段階的** — status.tsの修正はworkflow_statusのレスポンスのみに影響し、workflow_nextは変更しない。

3. **モジュールキャッシュの影響が決定的** — ディスク上のファイルを変更しても、MCPサーバープロセスが実行中の場合はキャッシュに保存された古いバイナリが使用され続ける。必ずプロセス再起動が必要。

4. **两修正は独立している** — 修正1と修正2は異なるファイル・異なる処理なので、どちらから着手しても問題ない。ただし、最後に一度だけビルドと再起動を実施する。

5. **後方互換性の維持** — status.tsでレスポンスを削減するが、next.tsは変更しないことで、Orchestratorの動作フロー（subagentテンプレート取得）に影響を与えない。

---

## 検証ポイント

**修正1の検証**:
- workflow_nextでsecurity_scan.subagentTemplateを確認
- BUG番号パターンの評価結論フレーズNG/OK例が含まれているか確認

**修正2の検証**:
- workflow_statusでレスポンスJSON構造を確認
- phaseGuideにsubagentTemplate・content・claudeMdSectionsが含まれていないか確認
- JSONファイルサイズが削減されているか確認

**後方互換性の検証**:
- workflow_nextでsubagentTemplateが引き続き含まれているか確認
- Orchestratorの動作に変化がないか確認

