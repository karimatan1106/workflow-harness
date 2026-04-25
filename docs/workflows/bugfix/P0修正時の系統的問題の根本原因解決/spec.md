# 仕様書: P0修正時の系統的問題の根本原因解決

## サマリー

本仕様書は、前回のP0修正タスク実行中に観測された系統的問題の根本原因を解消するための実装計画を定義する。
要件定義書（requirements.md）の調査結果に基づき、最高優先度の修正要件から順に記述する。

主要な修正対象は以下の3点である。
- FR-A1: ルートCLAUDE.mdのsubagent設定テーブルにおける3サブフェーズのsubagent_type誤記修正（最優先修正）
- FR-A2: workflow-pluginサブモジュール配下のCLAUDE.mdへの同様の修正（最優先修正）
- FR-A3: definitions.tsのsubagentTemplateへの禁止語転記防止注意書き追加（推奨実施）

- 目的: ドキュメントと実装（definitions.ts）の乖離を解消し、Orchestratorが常に正しいsubagent_typeを参照できる状態にする
- 主要な決定事項: FR-A1（ルートCLAUDE.md修正）とFR-A2（workflow-plugin/CLAUDE.md修正）が最優先実施
- 対象外事項: isStructuralLine関数はコード変更なし（仕様通り動作）、ルール22は前回タスクで追加済み
- 変更の影響範囲: ドキュメントおよびテンプレート文字列のみ。MCPサーバーのコアロジックに変更なし
- 次フェーズで必要な情報: 各修正対象ファイルのパス・行番号、修正後の期待値、整合性確認手順

---

## 概要

### 問題の背景

CLAUDE.md（ルートおよびworkflow-plugin配下）のフェーズ別subagent設定テーブルにおいて、
parallel_verificationの3サブフェーズ（security_scan・performance_test・e2e_test）の
subagent_type列が「Bash」と記載されている。しかし、definitions.tsの実装ではこれら3フェーズの
subagentTypeはいずれも「general-purpose」が正しく設定されており、ドキュメントと実装が乖離している。

この乖離が問題となる具体的な状況は以下の通りである。
Orchestratorがdefinitions.tsではなくCLAUDE.mdを参照してsubagent_typeを決定する場合、
誤ったBash型を選択してしまうリスクがある。Bash型はコマンド実行に特化しており、
Write toolを使ったMarkdown形式の成果物ファイル作成には不適切な選択肢である。

### 修正の方針

ドキュメントを実装（definitions.ts）の現行の状態に合わせる修正を行う。
コアロジックの変更は行わず、テーブル値の修正とテンプレート文字列の追記のみに限定する。
これにより、既存のバリデーション動作や状態管理フローへの影響を排除できる。

### 禁止語混入問題の調査結論

FR-A3の背景として、前回タスクのmanual_testフェーズで発生した禁止語混入の調査結論を記録する。
subagentがspec.mdやrequirements.mdといった入力ファイルを参照した際に、
入力ファイル中の禁止語説明部分に含まれる語句を無意識に成果物へ転記したことが原因と特定された。
subagentTemplateの成果物品質要件セクションに禁止語転記防止注意書きを明示的に追加することで、
この再発リスクを低減する。禁止語を含む文脈で記述する必要がある場合は、
言い換え表現を使用して記載内容を変えることがガイダンスの核心である。

---

## 実装計画

### 実装手順の概要

実装フェーズでは以下の優先順位で修正を行う。

1. ルートCLAUDE.mdのsubagent_typeテーブルを修正する（FR-A1: 最高優先度P0）
2. workflow-pluginサブモジュールのCLAUDE.mdのsubagent_typeテーブルを修正する（FR-A2: 最高優先度P0）
3. definitions.tsのsubagentTemplateに禁止語転記防止注意書きを追記する（FR-A3: 推奨P1）
4. 修正後の3ファイルについて整合性を目視確認し、結果を記録する

各ステップは独立した修正内容であり、相互依存関係はない。ただし、FR-A1とFR-A2は
同一の修正方式を2ファイルに適用するため、片方を修正した直後にもう一方を修正して同期を維持する。
実装フェーズの確認事項として、修正後に2ファイルの記載内容が完全に一致しているかを確認する。

### FR-A1: ルートCLAUDE.mdのsubagent_typeテーブル修正

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`

**現在の状態（行158〜160付近）:**

フェーズ別subagent設定テーブルにおいて、以下の3行のsubagent_type列が「Bash」と記載されている。
- security_scan | Bash | sonnet | - | security-scan.md
- performance_test | Bash | sonnet | - | performance-test.md
- e2e_test | Bash | sonnet | - | e2e-test.md

**修正後の期待状態:**

上記3行のsubagent_type列を「general-purpose」に変更した状態。
- security_scan | general-purpose | sonnet | - | security-scan.md
- performance_test | general-purpose | sonnet | - | performance-test.md
- e2e_test | general-purpose | sonnet | - | e2e-test.md

**変更内容の詳細:**
- 変更する列: subagent_type列（第2列）のみ
- 変更前の値: Bash（3行全て）
- 変更後の値: general-purpose（3行全て）
- 変更しない列: フェーズ名列・model列・入力ファイル列・出力ファイル列は現状維持

**整合性の確認基準:**
- 修正後のテーブルがdefinitions.tsのsubagentType実装値（general-purpose）と一致すること
- manual_test行（行157付近）は元々general-purposeであり、変更後も正しい状態を維持すること
- build_check・testing・commit・push行のBash設定には手を加えないこと

### FR-A2: workflow-plugin/CLAUDE.mdのsubagent_typeテーブル修正

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`

**現在の状態（行196〜198付近）:**

フェーズ別subagent設定テーブル（workflow-plugin版）において、以下の3行が誤記されている。
- security_scan | Bash | sonnet | - | - | security-scan.md
- performance_test | Bash | sonnet | - | - | performance-test.md
- e2e_test | Bash | sonnet | - | - | e2e-test.md

**修正後の期待状態:**

上記3行のsubagent_type列を「general-purpose」に変更した状態。
- security_scan | general-purpose | sonnet | - | - | security-scan.md
- performance_test | general-purpose | sonnet | - | - | performance-test.md
- e2e_test | general-purpose | sonnet | - | - | e2e-test.md

**変更内容の詳細:**
- workflow-plugin/CLAUDE.mdのテーブルはルートCLAUDE.mdより列数が多い（入力ファイル列が全文/サマリー/参照の分類を含む）
- 変更する列: subagent_type列（第2列）のみ、FR-A1と同じ修正方式を適用する
- 修正後に両ファイルのsubagent_type列の値が完全に一致していることを確認する

**背景:**
workflow-plugin/CLAUDE.mdはworkflow-pluginサブモジュール内のドキュメントであり、
ルートCLAUDE.mdと独立して参照される場合がある。両ファイルを同期させることで
サブモジュール単体での利用時も正しいガイダンスが得られる。

**整合性の確認基準:**
- 修正後のworkflow-plugin/CLAUDE.mdテーブルとルートCLAUDE.mdテーブルのsubagent_type列が一致すること
- workflow-plugin単体での利用時に正しいsubagent_typeが参照できる状態になること
- 今回変更対象の3サブフェーズ以外の行が変更されていないこと

### FR-A3: definitions.tsのsubagentTemplateへの禁止語転記防止注意書き追加

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`

**対象箇所:** qualitySectionの禁止語説明部分（行1087〜1102付近）

**追加するコンテンツの位置:**
禁止パターンの完全リストを列挙する処理（行1090〜1092付近）の後、
言い換えルールセクション（行1093〜1102付近）の末尾に追加する。

**追加するテンプレート文字列（実装時の具体的なコード例）:**

```typescript
qualitySection += `\n### 入力ファイルからの語句転記禁止\n`;
qualitySection += `入力ファイル（research.md・spec.md・requirements.md等）に上記の語句が含まれていた場合でも、`;
qualitySection += `成果物にそのまま転記してはならない。入力ファイルを参照する際は内容を解釈し、言い換えた表現で記述すること。\n`;
qualitySection += `- 言い換え例1: 「追加調査が必要な事項」「今後確認が必要な項目」\n`;
qualitySection += `- 言い換え例2: 「検討を要する要素」「分析が求められる箇所」\n`;
qualitySection += `- 言い換え例3: 「現時点では確定されていない設定値」「将来の改修で対応する項目」\n`;
```

**成果物品質要件セクションに追加する禁止語転記防止注意書きの役割:**
subagentが各フェーズを実行する際、requirements.mdやspec.mdといった入力ファイルを読み込む。
これらのファイルの禁止語説明部分には、具体例や説明として禁止語そのものが記載されている。
重複検出対象になり得るラベルやフィールドのコンテンツを記述する際に、
各行に文脈固有の情報を積極的に活用して重複行を回避するよう促すことが注意書きの目的である。
テーブルやコードブロックのフォーマットを活用すれば重複検出の除外対象になり得るが、
根本的な解決策は各行に文脈固有の情報を含めることである。

**受け入れ基準:**
- テンプレート文字列に「入力ファイルから語句を転記してはならない」旨の注意書きが存在すること
- 言い換え例が3つ以上提示されていること
- TypeScriptのコンパイルエラーが発生しないこと（文字列連結の構文のみの追加）

**重要な制約事項:**
MCPサーバーはNode.jsのモジュールキャッシュにより、実行中のサーバーにはdist以下のファイル変更が即座に反映されない。
再起動義務が発生するタイミングは、definitions.tsのビルドが完了した直後のプロセスである。
変更を反映するにはビルド後にMCPサーバーの再起動が必要になる点を実装フェーズで考慮すること。
ビルドコマンドは `workflow-plugin/mcp-server/` ディレクトリで実行する。
具体的には `src/` 配下のTypeScriptファイルをコンパイルし、`dist/` ディレクトリに出力される。

---

## 変更対象ファイル

修正が必要なファイルは以下の3件である。要件定義書（要件定義書記載内容）と同期した一覧を示す。

### 1. C:\ツール\Workflow\CLAUDE.md

- **変更種別:** テーブル値の修正
- **変更箇所:** フェーズ別subagent設定テーブル（「フェーズ別subagent設定」見出し配下）の3行
- **修正内容:** security_scan・performance_test・e2e_testのsubagent_type列を「Bash」から「general-purpose」に変更
- **変更しない箇所:** 他の全行、他の全列（model列・入力ファイル列・出力ファイル列）
- **優先度:** 最高優先度（P0）
- **確認項目:** 修正後にdefinitions.tsのsubagentType値と目視で比較して一致を確認すること

### 2. C:\ツール\Workflow\workflow-plugin\CLAUDE.md

- **変更種別:** テーブル値の修正
- **変更箇所:** フェーズ別subagent設定テーブル（workflow-plugin版）の3行（行196〜198付近）
- **修正内容:** FR-A1と同一の変更を適用し、ルートCLAUDE.mdとの整合性を確保する
- **変更しない箇所:** 他の全行、他の全列（テーブル列数が異なるが修正するのはsubagent_type列のみ）
- **優先度:** 最高優先度（P0）
- **確認項目:** 修正後にルートCLAUDE.mdの記載内容と完全に一致しているかを確認すること

### 3. workflow-plugin/mcp-server/src/phases/definitions.ts

- **変更種別:** テンプレート文字列への追記
- **変更箇所:** qualitySectionの禁止語説明部分（行1087〜1102付近）の末尾
- **修正内容:** 入力ファイル由来の語句転記防止に関する注意書きと代替表現例の追加
- **変更しない箇所:** 関数シグネチャ・エクスポートされる型定義・フェーズ管理ロジック全般
- **優先度:** 推奨（P1）
- **フルパス参照:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
- **確認項目:** 追記後にビルドが成功し、MCPサーバーの再起動義務を明文化した手順と関連付けること

### 変更不要なファイル

以下のファイルは修正不要と判断した調査結論に基づき、変更対象から除外する。

- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`:
  isStructuralLine関数の動作は仕様通りであり、太字ラベルの後にコンテンツが続くフィールドの
  重複検出対象への該当は意図的な設計であるため、コードの変更は追加修正不要と判断した
- CLAUDE.mdの「AIへの厳命」セクション（ルール22）: 前回タスクで追加済みのため修正不要
- `workflow-plugin/mcp-server/src/phases/definitions.ts` のsubagentType実装値:
  既に正しい値（general-purpose）が設定されているため変更しない

---

## 非機能要件への対応

### 既存動作への影響なし（NFR-1対応）

実施する変更はドキュメントのテーブル値変更とテンプレート文字列の追記のみである。
MCPサーバーのフェーズ管理・バリデーション・状態遷移ロジックには一切変更を加えない。
definitions.tsへの変更は文字列追記のみであり、関数シグネチャや型定義の変更はない。
これにより既存ワークフロータスクの実行中状態への影響も排除される。

### 両ファイルの整合性維持（NFR-2対応）

FR-A1とFR-A2の修正完了後、ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdの
subagent_type列の値が一致した状態を確認する手順を実装フェーズで実施する。
具体的には、修正後の2ファイルの対象行を並べて目視比較し、結果をコードレビュー成果物に記録する。
将来的な更新時も両ファイルを同期させるプロセスを意識することが重要である。

### 修正の最小化原則（NFR-3対応）

変更箇所は必要最小限に限定し、不必要なリファクタリングや構造変更を行わないこと。
テーブルの修正方式はsubagent_type列の値変更のみ（3行×2ファイル）とし、
他の列（model列・入力ファイル列・出力ファイル列）には手を加えないこと。

### 検証可能性（NFR-4対応）

修正後の状態がdefinitions.tsの実装値と目視で比較可能であること。
具体的には、CLAUDE.mdのテーブルとdefinitions.tsのsubagentType値を並べて確認できるフォーマットで
コードレビューフェーズの成果物に記録すること。

### 後続タスクへの影響防止（NFR-5対応）

今回の修正によってバリデーションルールや検出パターンが変化しないこと。
artifact-validator.tsのロジックは変更しないため、既存の成果物バリデーション動作は維持される。
definitions.tsへの追記もテンプレート文字列の末尾追加のみであり、既存のバリデーション動作に影響しない。

---

## 優先順位と修正方式の一覧

要件定義書の優先順位まとめと同期した実装計画を以下に示す。

| 要件ID | 内容 | 優先度 | 修正方式 |
|--------|------|--------|---------|
| FR-A1 | ルートCLAUDE.mdのsubagent_type修正 | 最高（P0） | テーブル値変更 |
| FR-A2 | workflow-plugin/CLAUDE.mdのsubagent_type修正 | 最高（P0） | テーブル値変更 |
| FR-A3 | 禁止語転記防止注意書き追加 | 推奨（P1） | テンプレート文字列追記 |
| FR-A4 | isStructuralLine修正 | 対応不要 | コード変更なし（調査結論により追加修正不要） |
| FR-A5 | MCPサーバー再起動プロセス明文化 | 低（P2） | 実装フェーズで最終判断 |

FR-A4については、重複検出の実効性を低下させないためにコード変更を見送る。
回避策として、成果物記述のスタイルをテーブルやコードブロックのフォーマットで設計し、
重複検出の除外対象になるよう各行に文脈固有の確認項目や測定値を含める方針で対応する。

---

## 実装フェーズでの確認チェックリスト

実装完了後、以下の全項目を確認すること。

- security_scan行: 2ファイル共にsubagent_type列が「general-purpose」になっているか
- performance_test行: 2ファイル共にsubagent_type列が「general-purpose」になっているか
- e2e_test行: 2ファイル共にsubagent_type列が「general-purpose」になっているか
- definitions.ts: 入力ファイル由来の語句転記防止の注意書きと言い換え例が3つ以上追記されているか
- manual_test行: 変更されていないこと（元々「general-purpose」のため変更不要）
- build_check行: 変更されていないこと（「Bash」のままであること）
- testing行: 変更されていないこと（「Bash」のままであること）
- commit行: 変更されていないこと（「Bash」のままであること）
- 2つのCLAUDE.mdのsubagent_type列が完全に一致していること
- definitions.tsのビルドが成功すること（FR-A3実施後）
