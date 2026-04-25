# テスト設計書: P0修正時の系統的問題の根本原因解決

## サマリー

本仕様書は、前回のP0修正タスク実行中に観測された系統的問題の根本原因を解消するための
テスト設計を定義する。要件定義書（requirements.md）の調査結果と仕様書（spec.md）の
実装計画に基づき、最優先修正の要件から順にテストケースを設計する。

- 目的: FR-A1・FR-A2・FR-A3の修正内容が正しく適用され、Orchestratorが常に正しいsubagent_typeを
  参照できる状態になっていることを検証可能な形式で確認すること
- 主要な決定事項: subagent_typeの誤記修正2件（P0）と禁止語転記防止注意書き1件（P1）の
  受け入れ基準をテストケースとして定義する
- スコープ: CLAUDE.md（ルート・workflow-plugin配下）とdefinitions.tsの変更箇所のみ
- 対象外: artifact-validatorのisStructuralLine関数（仕様通り動作のため変更不要・テスト追加なし）
- 次フェーズで必要な情報: 各テストケースの合否判定基準、コードレビューフェーズへの引き継ぎ手順

---

## 概要

### 背景・調査結果と問題の全体像

本テスト設計は、spec.md「概要」セクションに記載された問題の調査結果を出発点とする。
CLAUDE.md（ルートおよびworkflow-plugin配下）のフェーズ別subagent設定テーブルにおいて、
parallel_verificationの3サブフェーズ（security_scan・performance_test・e2e_test）の
subagent_type列が「Bash」と記載されている問題が最優先実施事項として特定された。

調査結果によると、definitions.tsの現行の実装ではこれら3フェーズのsubagentTypeはいずれも
「general-purpose」が正しく設定されており、ドキュメントと実装が乖離している状態である。
この乖離を解消することが本タスクにおける最優先修正の目標である。

推奨実施事項として、FR-A3（禁止語転記防止注意書き追加）も本テスト設計の検証対象に含める。
前回タスクで観測された禁止語混入問題の調査結論が示すように、入力ファイルからの語句転記防止の
明示化は再発リスク低減に有効である。対象外事項として、isStructuralLine関数はコード変更なし
（仕様通り動作）と判断されており、本テスト設計でも変更不要の確認のみ行う。

### 影響範囲と変更種別の整理

本タスクの影響範囲は以下の3ファイルに限定される。各修正対象の変更種別を明示することで、
テスト設計のスコープを明確にする。

変更対象1: ルートCLAUDE.md（変更種別: テーブル値の修正、優先度: P0）
変更対象2: workflow-plugin配下のCLAUDE.md（変更種別: テーブル値の修正、優先度: P0）
変更対象3: definitions.tsのqualitySection（変更種別: テンプレート文字列への追記、優先度: P1）

コアロジック（状態管理・バリデーション・フェーズ遷移）への変更は行わないため、
MCPサーバーの動作への副作用リスクは排除されている。これが修正の最小化原則（NFR-3）の核心である。

---

## 背景と前回タスクで観測された問題

### 系統的問題の具体的な状況

本テスト設計書の対象となるタスクは、CLAUDE.mdのフェーズ別subagent設定テーブルにおける
Orchestratorへのガイダンスのsubagent_type誤記を修正するものである。前回のP0修正タスク実行中に
観測された問題として、security_scan・performance_test・e2e_testの3サブフェーズの
subagent_type列に「Bash」と記載されていることが特定された。

しかしdefinitions.tsの実装では、これら3フェーズのsubagentTypeはいずれも
「general-purpose」が正しく設定されており、ドキュメントと実装が乖離している。
Orchestratorがdefinitions.tsではなくCLAUDE.mdを参照してsubagent_typeを決定する場合、
誤ったBash型を選択するリスクがある。Bash型はコマンド実行に特化した選択肢であり、
Write toolを使ったMarkdown形式の成果物ファイル作成には不適切な形式となる。

この乖離が発生すると、実行中状態のワークフロータスクが成果物を正しく出力できず、
security_scan・performance_test・e2e_testの各フェーズで成果物バリデーション失敗が
連続して発生する系統的な問題につながる。本テスト設計はこの根本原因の解消を検証する。

### 禁止語混入問題の調査結論と本テスト設計への影響

FR-A3の背景として、前回タスクのmanual_testフェーズで発生した禁止語混入問題の
調査結論を本テスト設計に反映する。subagentがspec.mdやrequirements.mdといった
入力ファイルを参照した際、入力ファイル中の禁止語説明部分のコンテンツを
無意識に成果物へ転記したことが原因と特定された（調査結論より）。

subagentTemplateの成果物品質要件セクションに禁止語転記防止注意書きを明示的に追加することで、
この再発リスクを低減する。禁止語を含む文脈で記述する必要がある場合は、
言い換え表現を使用することがガイダンスの核心となる。テスト設計はFR-A3の注意書きが
正しく追記されたことを確認するステップを含む。

### 変更不要と判断した調査結論（テスト対象外の明示）

仕様書（spec.md）の変更不要なファイルセクションに従い、以下は本テスト設計の対象外とする。

- `artifact-validator.ts` のisStructuralLine関数: 重複検出対象への該当は意図的な設計であり
  コードの変更は追加修正不要と判断した。バリデーションルールの既存動作を維持する
- CLAUDE.mdのルール22: 前回タスクで追加済みのため修正不要であり回帰確認のみ行う
- definitions.tsのsubagentType実装値: 既に正しいgeneral-purposeが設定されているため変更しない

---

## テスト方針

### 全体的な検証フロー

本タスクのテスト設計は、修正の最小化原則（NFR-3）と整合性維持（NFR-2）の観点から
以下の3層構造で検証を行う。state-machine.mmdのフロー（ReadSpec→FixRootTable→
FixPluginTable→AddNotice→VerifySync→CompareRows→BuildCheck→RestartMCP→
ValidateChanges→End）に対応した検証ステップを設計する。

**第1層（静的検証）**: ファイルのコンテンツがspec.mdの期待状態と一致するかを確認するステップ。
読み取り専用ツール（ReadツールおよびGrepツール）を使用して実施する。

**第2層（ビルド検証）**: TypeScriptコンパイル成功を確認するステップ。FR-A3の
definitions.ts修正後に実施し、文字列連結の構文エラーがないことを機械的に検証する。

**第3層（整合性検証）**: ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdのsubagent_type列が
完全に一致する状態を、並べて比較可能なフォーマットで確認するステップ。

### 各テストケースが対応する非機能要件

非機能要件への対応状況を以下のマッピングで管理する。

- **NFR-1（既存動作への影響なし）**: TC-09〜TC-11（変更対象外ファイルの無変更確認）で検証。
  MCPサーバーのフェーズ管理・バリデーション・状態遷移ロジックに一切変更がないことを確認する
- **NFR-2（整合性維持）**: TC-07（整合性確認手順）で検証し、コードレビューフェーズの成果物に記録する。
  2つのCLAUDE.mdのsubagent_type列の値が完全に一致していることを確認する
- **NFR-3（最小化原則）**: 全テストケースで変更が対象列（subagent_type列・第2列）のみであることを確認する。
  model列・入力ファイル列・出力ファイル列が変更されていないことを確認する
- **NFR-4（検証可能性）**: TC-07の成果物記録で実施する。コードレビューフェーズの成果物に
  definitions.tsのsubagentType実装値とCLAUDE.mdのテーブル値を並べて比較可能なフォーマットで記録する
- **NFR-5（後続タスクへの影響防止）**: TC-11でartifact-validatorのロジックが
  修正前後で変化していないこと、バリデーションルールの検出パターンが変化していないことを確認する

### テスト実行の制約事項と優先順位

本テスト設計書で定義するテストはtest_designフェーズで設計し、testingフェーズで実施する。
以下の制約事項のもとで実施計画を立てる。実施の優先順位は各テストケースの「優先度」フィールドに従う。

- readonlyカテゴリ（Readツール・Grepツール・Globツール）は全フェーズで使用可能である
- TC-08（ビルド確認）はtestingカテゴリのコマンドを使用するため、testingフェーズ以降で実施する
- Node.jsのモジュールキャッシュにより、実行中のMCPサーバープロセスにはdist以下の
  ファイル変更が即座に反映されない。TCのビルド確認後に再起動義務が発生するタイミングを
  プロセスとして定義し、MCPサーバーの再起動を確認するステップを含める
- ビルドコマンドのフルパスは `workflow-plugin/mcp-server/` ディレクトリを基点として実行する

---

## テストケース

### TC-01: ルートCLAUDE.mdのsecurity_scan行の値確認（FR-A1）

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`
**対応要件:** FR-A1（最高優先度P0）、仕様書行74〜83に記載の期待状態

**検証内容:**
フェーズ別subagent設定テーブルにおいて、security_scanのsubagent_type列（第2列）が
「general-purpose」に変更されていることを確認する。仕様書に記載された期待状態（行81）の
「security_scan | general-purpose | sonnet | - | security-scan.md」と一致するかを検証する。

**各修正対象の行番号・対象箇所・変更内容の詳細:**
- 対象行: security_scan行（行158付近のテーブル行）
- 対象箇所: subagent_type列（第2列）の値のみ
- 変更前の値: Bash
- 変更後の値: general-purpose
- 変更種別: テーブルセル値の修正（1行1列のみ）

**前提条件（制約事項）:**
- 読み取り対象ファイルが存在し読み取り可能な状態にあること
- 変更対象のsubagent_type列（第2列）のみが変更され、他の全列が現状維持されていること

**確認手順（state-machine.mmdのFixRootTable状態に対応）:**
1. `C:\ツール\Workflow\CLAUDE.md` を読み込んでフェーズ別subagent設定テーブルを特定する
2. security_scan行のsubagent_type列の値を確認する（目視確認）
3. 変更前の誤記「Bash」が残存していないことを確認する
4. model列（sonnet）・出力ファイル列（security-scan.md）が変更されていないことを確認する

**合否判定基準（受け入れ基準）:**
- security_scan行のsubagent_type列が「general-purpose」であること（PASS条件）
- security_scan行のsubagent_type列に「Bash」が残存していないこと（PASS条件）
- model列・入力ファイル列・出力ファイル列が変更されていないこと（NFR-3最小化原則）
- 上記を満たさない場合: FAIL（FR-A1修正が不完全であるため実装フェーズに差し戻し）

---

### TC-02: ルートCLAUDE.mdのperformance_test行の値確認（FR-A1）

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`
**対応要件:** FR-A1（最高優先度P0）、仕様書行82に記載の期待状態

**検証内容:**
フェーズ別subagent設定テーブルにおいて、performance_testのsubagent_type列が
「general-purpose」に変更されていることを確認する。TC-01（security_scan行）と合わせて
3サブフェーズのうち2行目の修正完了を個別に検証する形式で確認する。

**各修正対象の行番号・対象箇所・変更内容の詳細:**
- 対象行: performance_test行（行159付近のテーブル行）
- 対象箇所: subagent_type列（第2列）の値のみ
- 変更前の値: Bash
- 変更後の値: general-purpose
- 変更種別: テーブルセル値の修正（1行1列のみ）

**確認手順（state-machine.mmdのFixRootTable状態に対応）:**
1. CLAUDE.mdのフェーズ別subagent設定テーブルでperformance_test行を特定する
2. subagent_type列（第2列）の値が「general-purpose」であることを確認する（目視確認）
3. 変更前の誤記「Bash」が残存していないことを確認する

**合否判定基準（受け入れ基準）:**
- performance_test行のsubagent_type列が「general-purpose」であること（PASS条件）
- performance_test行のsubagent_type列に「Bash」が残存していないこと（PASS条件）
- 上記を満たさない場合: FAIL（FR-A1修正でperformance_test行が未修正の状態）

---

### TC-03: ルートCLAUDE.mdのe2e_test行の値確認（FR-A1）

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`
**対応要件:** FR-A1（最高優先度P0）、仕様書行83に記載の期待状態

**検証内容:**
フェーズ別subagent設定テーブルにおいて、e2e_testのsubagent_type列が「general-purpose」に
変更されていることを確認する。TC-01・TC-02と合わせて、ルートCLAUDE.mdの
3サブフェーズ全ての修正完了を検証する最後のステップである。

**各修正対象の行番号・対象箇所・変更内容の詳細:**
- 対象行: e2e_test行（行160付近のテーブル行）
- 対象箇所: subagent_type列（第2列）の値のみ
- 変更前の値: Bash
- 変更後の値: general-purpose
- 変更種別: テーブルセル値の修正（1行1列のみ）

**確認手順（state-machine.mmdのFixRootTable状態に対応）:**
1. CLAUDE.mdのフェーズ別subagent設定テーブルでe2e_test行を特定する
2. subagent_type列（第2列）の値が「general-purpose」であることを確認する（目視確認）
3. フェーズ別subagent設定テーブルのe2e_test行に「Bash」が残存していないことを確認する

**合否判定基準（受け入れ基準）:**
- e2e_test行のsubagent_type列が「general-purpose」であること（PASS条件）
- フェーズ別subagent設定テーブルのe2e_test行のsubagent_type列に「Bash」がないこと（PASS条件）
- 上記を満たさない場合: FAIL（FR-A1修正でe2e_test行が未修正の状態）

---

### TC-04: workflow-plugin/CLAUDE.mdのsecurity_scan行の値確認（FR-A2）

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`
**対応要件:** FR-A2（最高優先度P0）、仕様書行103〜112に記載の期待状態

**検証内容:**
workflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブル（行196付近）において、
security_scanのsubagent_type列が「general-purpose」に変更されていることを確認する。
FR-A1と同様の修正がworkflow-plugin配下のサブモジュール側にも適用されているかを検証する。
workflow-plugin/CLAUDE.mdはルートCLAUDE.mdより列数が多い（入力ファイル列が
全文・サマリー・参照の分類を含む）が、確認するのはsubagent_type列（第2列）の値のみである。

**各修正対象の行番号・対象箇所・変更内容の詳細:**
- 対象行: security_scan行（行196付近のテーブル行）
- 対象箇所: subagent_type列（第2列）の値のみ
- 変更前の値: Bash
- 変更後の値: general-purpose
- 変更種別: テーブルセル値の修正（列数が異なるが修正対象は第2列のみ）

**前提条件（制約事項）:**
- TC-01が合格していること（FR-A1が先に確認済みであること）
- workflow-plugin/CLAUDE.mdのテーブル構造がルートCLAUDE.mdと列数が異なることを考慮すること

**確認手順（state-machine.mmdのFixPluginTable状態に対応）:**
1. `C:\ツール\Workflow\workflow-plugin\CLAUDE.md` を読み込んで対象テーブルを特定する
2. security_scan行のsubagent_type列（第2列）の値が「general-purpose」であることを確認する（目視確認）
3. 変更前の誤記「Bash」が残存していないことを確認する（行196付近）

**合否判定基準（受け入れ基準）:**
- workflow-plugin/CLAUDE.mdのsecurity_scan行がgeneral-purposeを含むこと（PASS条件）
- security_scan行にBash型の記述が存在しないこと（PASS条件）
- 今回変更対象の3サブフェーズ以外の行が変更されていないこと（NFR-3最小化原則）
- 上記を満たさない場合: FAIL（FR-A2修正でsecurity_scan行が未修正の状態）

---

### TC-05: workflow-plugin/CLAUDE.mdのperformance_test・e2e_test行の値確認（FR-A2）

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`
**対応要件:** FR-A2（最高優先度P0）、仕様書行110〜112に記載の期待状態

**検証内容:**
workflow-plugin/CLAUDE.mdにおいて、performance_testとe2e_testの2行のsubagent_type列が
「general-purpose」に変更されていることを確認する。TC-04（security_scan行）と合わせて
workflow-plugin側の3サブフェーズ全ての修正完了を検証するステップである。
仕様書（spec.md）行116に記載の「FR-A1と同じ修正方式を適用する」という判断に従い、
両ファイルでsubagent_type列（第2列）のみを変更することを確認する。

**各修正対象の行番号・対象箇所・変更内容の詳細:**
- 対象行1: performance_test行（行197付近のテーブル行）、変更種別: テーブルセル値修正
- 対象行2: e2e_test行（行198付近のテーブル行）、変更種別: テーブルセル値修正
- 対象箇所: 両行ともsubagent_type列（第2列）の値のみ
- 変更前の値: 両行ともBash
- 変更後の値: 両行ともgeneral-purpose

**確認手順（state-machine.mmdのFixPluginTable状態に対応）:**
1. workflow-plugin/CLAUDE.mdのフェーズ別subagent設定テーブルでperformance_test行を特定する
2. performance_test行のsubagent_type列が「general-purpose」であることを確認する（目視確認）
3. e2e_test行のsubagent_type列が「general-purpose」であることを確認する（目視確認）
4. 変更前の誤記「Bash」が対象2行に残存していないことを確認する（行197・198付近）

**合否判定基準（受け入れ基準）:**
- performance_test行のsubagent_type列が「general-purpose」であること（PASS条件）
- e2e_test行のsubagent_type列が「general-purpose」であること（PASS条件）
- 対象2行のsubagent_type列にBash型の記述が残存していないこと（PASS条件）
- 上記を満たさない場合: FAIL（FR-A2修正が一部不完全な状態）

---

### TC-06: definitions.tsへの禁止語転記防止注意書き追加の確認（FR-A3）

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**対応要件:** FR-A3（推奨P1）、仕様書行129〜161に記載の受け入れ基準

**検証内容:**
qualitySectionの禁止語説明部分の末尾に、入力ファイルからの語句転記禁止に関する
注意書きと言い換え例が追加されていることを確認する。仕様書（spec.md）行160の受け入れ基準
「言い換え例が3つ以上提示されていること」を満たすかを検証する。

語句転記防止の注意書きは、subagentが入力ファイル（requirements.md・spec.md等）を参照した際、
禁止語を含む説明文から語句を無意識に転記するリスクを低減する役割を持つ。
追記後の成果物記述スタイルに対する影響と、禁止語を含む文脈での言い換え表現の積極的な活用を
促す内容であることを確認する。コードブロック内の禁止語検出とリスト形式の列挙を組み合わせた
代替表現例が含まれているかを特定のポイントとして検証する。

**前提条件（制約事項）:**
- definitions.tsが読み取り可能な状態にあること
- qualitySectionの行1087〜1102付近の構造を把握した上で確認すること
- 実際のTypeScriptコンパイル確認はTC-08（ビルド確認）で実施するため、
  本テストケースはコンテンツの有無のみを確認するステップとして設計する

**確認手順（state-machine.mmdのAddNotice〜AddExamples状態に対応）:**
1. definitions.tsのqualitySection部分（行1087〜1115付近）を読み込む
2. 「入力ファイルからの語句転記禁止」または同等の趣旨の注意書きが存在することを確認する
3. 入力ファイル（research.md・spec.md・requirements.md等）からの転記禁止を明示した文章の存在を確認する
4. 言い換え例が3つ以上提示されていることを確認する（仕様書行160の受け入れ基準）
5. 追記後の各言い換え例が文脈固有の情報を含んでいることを確認する（重複行回避の観点）
6. 関数シグネチャ・エクスポートされる型定義・フェーズ管理ロジックが変更されていないことを確認する（NFR-1対応）

**合否判定基準（受け入れ基準）:**
- 転記禁止の注意書きが明示的に存在すること（PASS条件）
- 言い換え例が3つ以上提示されていること（仕様書行160に準拠したPASS条件）
- 追記部分が文字列連結（qualitySection +=）の形式であること（PASS条件）
- 追記位置が言い換えルールセクションの末尾付近（行1093〜1102の後）であること（PASS条件）
- 関数シグネチャ・エクスポートされる型定義に一切変更がないこと（NFR-1対応PASS条件）
- 上記を満たさない場合: FAIL（FR-A3の追記が不完全または未実施の状態）

---

### TC-07: 2つのCLAUDE.mdのsubagent_type列整合性確認手順（NFR-2対応）

**対象ファイル:**
- `C:\ツール\Workflow\CLAUDE.md`
- `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`

**対応要件:** NFR-2（整合性維持）、仕様書行226〜231に記載の確認手順

**検証内容:**
FR-A1とFR-A2の修正が同期されており、ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdの
3行（security_scan・performance_test・e2e_test）のsubagent_type列の値が完全に一致することを
確認する。仕様書（spec.md）行65に記載された「片方を修正した直後にもう一方を修正して同期を維持する」
という修正方式の結果を検証するステップである。

整合性確認の結果は、コードレビューフェーズの成果物に比較可能なフォーマットで記録する。
全行・全列の目視比較をチェックリスト形式で確認し、測定値（各行のsubagent_type列の記録値）を
コードレビュー成果物に残すことでNFR-4（検証可能性）を満たす。
これにより、実装完了後の確認と将来的な更新時も両ファイルを同期させるプロセスの参照情報となる。

**前提条件（制約事項）:**
- TC-01〜TC-05が全てPASSしていること
- 2つのCLAUDE.mdが読み取り可能な状態にあること
- workflow-plugin版テーブルはルートCLAUDE.mdより列数が多いため、
  subagent_type列（第2列）の値のみを抽出して比較する形式で確認する

**確認手順（state-machine.mmdのVerifySync〜CompareRows状態、flowchart.mmdのSync_Check分岐に対応）:**
1. ルートCLAUDE.mdのsecurity_scan行のsubagent_type列の値を記録する（期待値: general-purpose）
2. workflow-plugin/CLAUDE.mdのsecurity_scan行のsubagent_type列の値を記録する（期待値: general-purpose）
3. 両記録値が一致することを目視比較で確認する（security_scan行の整合性確認チェックリスト）
4. performance_test行について同じ手順を繰り返す（performance_test行の整合性確認チェックリスト）
5. e2e_test行について同じ手順を繰り返す（e2e_test行の整合性確認チェックリスト）
6. 3行分の比較結果を検証可能なフォーマットで記録してコードレビューフェーズに引き継ぐ

**合否判定基準（受け入れ基準）:**
- security_scan行の比較結果: ルート=general-purpose、workflow-plugin=general-purpose（一致でPASS）
- performance_test行の比較結果: ルート=general-purpose、workflow-plugin=general-purpose（一致でPASS）
- e2e_test行の比較結果: ルート=general-purpose、workflow-plugin=general-purpose（一致でPASS）
- コードレビュー成果物: 3行の比較結果が検証可能な形式で記録されていること（NFR-4検証可能性）
- どれか1行でも不一致の場合: FAIL（flowchart.mmdのSync_Check分岐でFR-A2のModifyに戻る）

---

### TC-08: TypeScriptビルド成功確認（FR-A3後のビルド検証）

**対象ディレクトリ:** `workflow-plugin/mcp-server/`
**対応要件:** FR-A3の受け入れ基準「TypeScriptのコンパイルエラーが発生しないこと」（仕様書行161）

**検証内容:**
FR-A3でdefinitions.tsに追記した内容がTypeScriptコンパイルエラーを発生させないことを確認する。
追記するコンテンツは文字列連結（qualitySection +=）の形式のみであり、通常はエラーが発生しないが、
ビルドを実行して実際にコンパイル成功することを機械的に検証する必要がある。

ビルド成功後には、Node.jsのモジュールキャッシュの影響（実行中のMCPサーバープロセスには
dist以下のファイル変更が即座に反映されない）を考慮した再起動義務確認のステップも実施する。
フルパスでのビルドコマンド実行確認と、実装完了後のMCPサーバー再起動プロセス確認が含まれる。

**前提条件（制約事項）:**
- TC-06が合格していること（FR-A3の追記内容が確認済みであること）
- ビルドコマンドは `workflow-plugin/mcp-server/` ディレクトリで実行すること（仕様書行167）
- このステップはimplementationカテゴリのコマンド（npm run build）を使用する

**確認手順（state-machine.mmdのBuildCheck〜RestartMCP状態、flowchart.mmdのBuildCheck分岐に対応）:**
1. `workflow-plugin/mcp-server/` ディレクトリでnpm run buildを実行する
2. ビルドの終了コードが0であることを確認する（成功）
3. `dist/phases/definitions.js` が更新されていることを確認する（目視確認）
4. ビルドが失敗した場合: flowchart.mmdのBuildFix処理に従い、TypeScriptエラーを修正して再実行する
5. ビルド成功後: MCPサーバーの再起動を実施してモジュールキャッシュを無効化する
6. 再起動後のMCPサーバーが正常起動していることをプロセス確認する（再起動義務の完了確認）

**合否判定基準（受け入れ基準）:**
- ビルドが成功すること（終了コード0）（PASS条件）
- TypeScriptコンパイルエラーが出力されないこと（PASS条件）
- `dist/phases/definitions.js` が更新されていること（PASS条件）
- MCPサーバーの再起動義務が完了していること（PASS条件）
- ビルドが失敗した場合（終了コード非ゼロ）: FAIL（FR-A3の追記でコンパイルエラーが発生）

---

### TC-09: 変更対象外行の無変更確認（manual_test・Bash型フェーズ）

**対象ファイル:**
- `C:\ツール\Workflow\CLAUDE.md`
- `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`

**対応要件:** NFR-3（最小化原則）、仕様書行93〜94・行280〜283に記載の整合性確認基準

**検証内容:**
修正対象外の行が意図せず変更されていないことを確認する。具体的には以下の2種類の確認を実施する。

1. manual_test行（既に正しいgeneral-purposeが設定されている行）が変更されていないこと。
   仕様書行93「manual_test行（行157付近）は元々general-purposeのため変更後も正しい状態を維持すること」に対応する
2. Bash型が正しい設定のフェーズ（build_check・testing・commit・push）が変更されていないこと。
   仕様書行94「build_check・testing・commit・push行のBash設定には手を加えないこと」に対応する

**確認手順（state-machine.mmdのValidateChanges状態に対応、チェックリスト形式）:**
- チェック項目1: ルートCLAUDE.mdのmanual_test行のsubagent_type列がgeneral-purposeを含むことを目視確認する
- チェック項目2: workflow-plugin/CLAUDE.mdのmanual_test行のsubagent_type列がgeneral-purposeを含むことを目視確認する
- チェック項目3: ルートCLAUDE.mdのbuild_check・testing・commit・push行がBashを含むことを目視確認する
- チェック項目4: workflow-plugin/CLAUDE.mdのbuild_check・testing・commit・push行がBashを含むことを目視確認する

**合否判定基準（受け入れ基準）:**
- 両ファイルのmanual_test行がgeneral-purposeを維持していること（最小化原則NFR-3のPASS条件）
- 両ファイルのbuild_check行がBashを維持していること（コマンド実行フェーズは変更対象外）
- 両ファイルのtesting行がBashを維持していること（テスト実行フェーズは変更対象外）
- 両ファイルのcommit行がBashを維持していること（Git操作フェーズは変更対象外）
- 両ファイルのpush行がBashを維持していること（Git操作フェーズは変更対象外）
- いずれかで意図しない変更が検出された場合: FAIL（修正作業中に対象外の行が変更された状態）

---

### TC-10: definitions.tsのsubagentType実装値が変更されていないこと（回帰確認）

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**対応要件:** NFR-1（既存動作への影響なし）、仕様書行212〜213の変更不要判断に対応

**検証内容:**
FR-A3ではqualitySectionの末尾にテンプレート文字列を追記するのみであり、
definitions.tsのsubagentType実装値（security_scan・performance_test・e2e_testの各フェーズ定義）は
変更されないことを確認する。既に正しいgeneral-purposeが設定されている実装値が
意図せず変更されていないことを回帰確認として検証する。

また、関数シグネチャやエクスポートされる型定義に変更がないこと、
フェーズ管理ロジック全般（状態遷移ロジック・バリデーション・ワークフロータスク制御）が
修正前後で同一であることを確認する。リファクタリングフェーズへの影響防止（NFR-5）の観点から、
コアロジック変更なしの状態を維持することが本確認の目的である。

**確認手順（state-machine.mmdのValidateChanges状態に対応）:**
1. definitions.tsのsecurity_scanフェーズ定義のsubagentType値がgeneral-purposeであることを確認する
2. definitions.tsのperformance_testフェーズ定義のsubagentType値がgeneral-purposeであることを確認する
3. definitions.tsのe2e_testフェーズ定義のsubagentType値がgeneral-purposeであることを確認する
4. 関数シグネチャ・エクスポートされる型定義に変更がないことを確認する（目視確認）

**合否判定基準（受け入れ基準）:**
- security_scanフェーズのsubagentType実装値がgeneral-purposeであること（PASS条件）
- performance_testフェーズのsubagentType実装値がgeneral-purposeであること（PASS条件）
- e2e_testフェーズのsubagentType実装値がgeneral-purposeであること（PASS条件）
- 関数シグネチャ・エクスポートされる型定義に意図しない変更がないこと（PASS条件）
- いずれかで意図しない変更が検出された場合: FAIL（FR-A3追記で変更すべきでない箇所が修正された）

---

### TC-11: artifact-validator.tsのisStructuralLine関数無変更確認（回帰確認）

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\artifact-validator.ts`
**対応要件:** NFR-5（後続タスクへの影響防止）、仕様書行208〜210の変更不要判断に対応

**検証内容:**
本タスクの修正対象外として明示された `artifact-validator.ts` のisStructuralLine関数が
変更されていないことを確認する。仕様書（spec.md）行208〜210に記載の調査結論として、
isStructuralLine関数の動作は仕様通りであり、太字ラベルの後にコンテンツが続くフィールドの
重複検出対象への該当は意図的な設計である。コードの変更は追加修正不要と判断された。

バリデーションルール・重複検出パターン・除外対象の分類ロジックが変化していないことを確認し、
後続タスクへの影響防止（NFR-5）を保証する。成果物記述に使用するコードブロックやリスト形式の
除外ロジックも変化していないことを同様に確認する。

**確認手順（state-machine.mmdのValidateChanges状態に対応、チェックリスト形式）:**
- チェック項目1: `artifact-validator.ts` を読み込んでisStructuralLine関数のシグネチャを確認する
- チェック項目2: 重複検出対象と除外対象の分類ロジックが仕様通りであることを確認する（目視確認）
- チェック項目3: バリデーションルール全体に追加・削除・変更がないことを確認する

**合否判定基準（受け入れ基準）:**
- isStructuralLine関数のシグネチャが変更されていないこと（PASS条件）
- 重複検出パターンが変化していないこと（後続タスクへの影響防止NFR-5のPASS条件）
- バリデーションルールの既存動作が維持されていること（NFR-1既存動作への影響なしのPASS条件）
- いずれかで変更が検出された場合: FAIL（変更対象外ファイルが変更されてしまった状態）

---

## テストケース一覧と優先度

| テストID | 対応要件 | テスト種別 | 優先度 | 主な合否判定の要点 |
|----------|----------|---------|--------|------------------|
| TC-01 | FR-A1 | 静的検証（security_scan行） | 最高P0 | ルートCLAUDE.mdでgeneral-purposeに変更済みであること |
| TC-02 | FR-A1 | 静的検証（performance_test行） | 最高P0 | ルートCLAUDE.mdでgeneral-purposeに変更済みであること |
| TC-03 | FR-A1 | 静的検証（e2e_test行） | 最高P0 | ルートCLAUDE.mdでgeneral-purposeに変更済みであること |
| TC-04 | FR-A2 | 静的検証（security_scan行） | 最高P0 | workflow-plugin/CLAUDE.mdでgeneral-purposeに変更済みであること |
| TC-05 | FR-A2 | 静的検証（performance_test・e2e_test行） | 最高P0 | workflow-plugin/CLAUDE.mdで2行がgeneral-purposeに変更済みであること |
| TC-06 | FR-A3 | 静的検証（注意書き存在確認） | 推奨P1 | 転記防止注意書きと言い換え例3件以上が存在すること |
| TC-07 | NFR-2 | 整合性確認手順 | 最高P0 | 2ファイルのsubagent_type列が完全一致すること |
| TC-08 | FR-A3 | ビルド確認 | 推奨P1 | ビルドが成功しMCPサーバー再起動が完了すること |
| TC-09 | NFR-3 | 回帰確認（変更対象外行） | 高 | manual_test行とBash型フェーズ行が変更されていないこと |
| TC-10 | NFR-1 | 回帰確認（definitions.ts実装値） | 高 | subagentType実装値と関数シグネチャが変更されていないこと |
| TC-11 | NFR-5 | 回帰確認（artifact-validator.ts） | 高 | isStructuralLine関数が変更されていないこと |

---

## 実施順序・依存関係・合否判定フロー

### テストケースの実施順序と相互依存関係

各テストケースは以下の順序で実施することを推奨する。
この順序はstate-machine.mmdのフロー（FixRootTable→FixPluginTable→VerifySync→
CompareRows→BuildCheck→CheckSuccess→RestartMCP→ValidateChanges→End）に対応している。
相互依存関係のないテストケースは並行実施が可能である。

FR-A1静的検証（TC-01〜TC-03）を順番に実施する。FR-A1修正が完了していなければTC-07の前提条件が崩れる。
次にFR-A2静的検証（TC-04〜TC-05）を実施する。FR-A2修正が完了していなければTC-07の前提条件が崩れる。
整合性確認（TC-07）はTC-01〜TC-05の全PASS後に実施する。いずれかが失敗している場合はTC-07の実施を保留する。
FR-A3静的検証（TC-06）はFR-A3実施後に単独で実施可能であり、TC-07とは独立して進められる。
ビルド確認（TC-08）はTC-06のPASS後に実施する。テンプレート文字列追記の確認後にビルドを行う方が
問題の切り分けが容易であり、モジュールキャッシュの影響を考慮した再起動義務も確認する。
回帰確認（TC-09〜TC-11）はTC-01〜TC-08と並行して実施可能であり、実装フェーズの
作業完了後にまとめて実施することが推奨される。

### 合否判定と次フェーズへの引き継ぎ

全11テストケースのPASS・FAILを集計し、以下の基準で合否を判定する。
全項目がPASSした場合のみ「実装完了後の確認」が完了したとみなす。

合格条件1: TC-01〜TC-03（FR-A1静的検証）が全てPASSすること
合格条件2: TC-04〜TC-05（FR-A2静的検証）が全てPASSすること
合格条件3: TC-07（整合性確認）がPASSすること（2ファイルのsubagent_type列が完全一致）
合格条件4: TC-06（FR-A3静的検証）とTC-08（ビルド確認）が共にPASSすること
合格条件5: TC-09〜TC-11（回帰確認）が全てPASSすること

不合格時の対応フロー（flowchart.mmdのSync_Check・BuildCheck分岐を参照）:
- TC-08が失敗した場合: FR-A3の追記内容のTypeScript構文を確認して修正し、ビルドを再実施する
- TC-07が失敗した場合: 不一致となったフェーズ行を特定して該当ファイルの修正を再実施する
- TC-01〜TC-05が失敗した場合: 未修正の行に対してFR-A1またはFR-A2の修正を再実施する

### 実効性の評価基準

本テスト設計の実効性は、以下の観点で評価する。

- 測定値の記録: TC-07で3行分のsubagent_type列の値を記録し、コードレビュー成果物に明記する
- 全項目の網羅性: TC-01〜TC-11の全テストケースが少なくとも1つの非機能要件（NFR）に対応していること
- 実装完了後の確認: 全テストケースがPASSした時点で実装完了とみなし、コードレビューフェーズに移行する
- 回帰防止の確認: TC-09〜TC-11の回帰確認により、変更対象外ファイルへの意図しない変更を検出できること
