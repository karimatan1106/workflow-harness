# 要件定義書: P0修正時の系統的問題の根本原因解決

## サマリー

前回のP0修正タスク実行中に観測された4件の系統的問題について、調査結果に基づき修正要件を定義する。
最高優先度の問題は、CLAUDE.md（ルートおよびworkflow-plugin配下）のsubagent_typeテーブルにおける
security_scan・performance_test・e2e_testの3サブフェーズが「Bash」と誤記されている点である。
実装（definitions.ts）では正しく「general-purpose」が設定されているため、ドキュメントを実装に合わせる修正が必要である。

- 目的: ドキュメントと実装の乖離を解消し、Orchestratorが正しいsubagent_typeを使用できる状態にする
- 主要な決定事項: FR-A1とFR-A2が最優先修正、FR-A3は禁止語転記防止の注意書き追加、FR-A4はコード修正なし
- 次フェーズで必要な情報: 各修正対象ファイルのパス・行番号、および修正後の期待値

---

## 機能要件

### FR-A1: CLAUDE.md（ルート）のsubagent_typeテーブル修正

**優先度:** 最高（P0）

**修正対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`

**修正内容:**
フェーズ別subagent設定テーブルにおいて、parallel_verificationの3サブフェーズの
subagent_type列を現行の「Bash」から正しい値「general-purpose」に変更する。

対象の3行:
- security_scan行: subagent_type列を「Bash」から「general-purpose」に変更する
- performance_test行: subagent_type列を「Bash」から「general-purpose」に変更する
- e2e_test行: subagent_type列を「Bash」から「general-purpose」に変更する

**受け入れ基準:**
- security_scan・performance_test・e2e_testの全3サブフェーズがgeneral-purposeと記載されていること
- 変更後のテーブルがdefinitions.tsのsubagentType実装値と一致していること
- 他の行（manual_testを含む）は変更されていないこと

**背景:**
security_scan・performance_test・e2e_testは、いずれもMarkdown形式の成果物ファイルを作成するため
general-purposeが適切である。Bash型はコマンド実行に特化しており、Write toolを使ったファイル書き込みには不適切である。

---

### FR-A2: workflow-plugin/CLAUDE.mdのsubagent_typeテーブル修正

**優先度:** 最高（P0）

**修正対象ファイル:** `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`

**修正内容:**
ルートCLAUDE.mdと同様に、フェーズ別subagent設定テーブルの3サブフェーズを修正する。
FR-A1と同じ変更を適用し、2ファイル間の整合性を確保する。

対象の3行（FR-A1と同一の修正内容）:
- security_scan行: 「Bash」から「general-purpose」に変更する
- performance_test行: 「Bash」から「general-purpose」に変更する
- e2e_test行: 「Bash」から「general-purpose」に変更する

**受け入れ基準:**
- 3サブフェーズ全てがgeneral-purposeと記載されていること
- ルートCLAUDE.mdの記載内容と完全に一致していること
- workflow-plugin内のOrchestratorが正しいsubagent_typeを参照できること

**背景:**
workflow-plugin/CLAUDE.mdはworkflow-pluginサブモジュール内のドキュメントであり、
ルートCLAUDE.mdと独立して参照される場合がある。両ファイルを同期させることで
サブモジュール単体での利用時も正しいガイダンスが得られる。

---

### FR-A3: subagentTemplateの禁止語転記防止注意書き追加

**優先度:** 推奨（P1）

**修正対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

**修正内容:**
subagentTemplateの成果物品質要件セクション内の禁止語説明部分に、以下の内容を含む注意書きを追加する。

追加する内容:
- 入力ファイル（research.md・spec.md等）に同様の禁止語が含まれていた場合でも、成果物にそのまま転記してはならないことを明示する
- 言い換え例として「追加調査が必要な事項」や「検討を要する要素」といった代替表現を提示する
- 入力ファイルの文脈から禁止語が引き継がれることを防ぐためのガイダンスを追加する

**受け入れ基準:**
- テンプレート内に「入力ファイルから禁止語をそのまま転記してはならない」旨の注意書きが存在すること
- 言い換え例が少なくとも2つ提示されていること
- MCPサーバーの再起動なしに（テンプレート文字列の変更のみで）反映される修正であること

**背景:**
前回タスクのmanual_testフェーズで発生した禁止語混入は、subagentがspec.mdの内容を
参照した際に、入力ファイル中の語句を無意識に転記したことが原因と特定された。
テンプレートへの明示的な注意書き追加により、この再発リスクを低減できる。

---

### FR-A4: isStructuralLine関数の修正対応（対応なし）

**優先度:** 対応不要

**調査結論:**
artifact-validator.tsのisStructuralLine関数は仕様通りに動作しており、コード変更は不要である。
太字ラベルの後にコンテンツが続く行（`**フィールド:** 値`の形式）が重複検出対象になることは
意図的な設計であり、これを変更すると検証の実効性が低下する。

**回避策（実装フェーズへの申し送り事項）:**
成果物の記述スタイルを以下の方針で設計することで、重複行エラーを回避できる。
各行に文脈固有の情報（確認項目の具体的な内容、測定値、結果）を含め、
同一フォーマットの繰り返しを3回以上行わないよう設計する。
テーブル形式またはコードブロック形式を積極的に活用することで、重複検出の対象から除外できる。

---

### FR-A5: MCPサーバー再起動タイミングのプロセス明文化

**優先度:** 低（P2）

**調査結論:**
前回タスクでルール22として「MCPサーバー再起動義務」が追加されている。
CLAUDE.mdの「AIへの厳命」セクションに、implementationフェーズでMCPサーバー関連コードを
変更した後の再起動タイミングが記載されているかを確認した結果、ルール22が該当する記述をカバーしている。

**追加修正の判断:**
ルール22の記載内容が十分であると判断する場合は追加修正不要とする。
記載が一般論のみで「implementationフェーズ直後」という具体的タイミングが不足している場合は、
planning/implementationフェーズに追記することを実装フェーズで判断する。
この要件はplanning段階での確認事項として記録し、実装フェーズで最終判断を行う。

---

## 非機能要件

### NFR-1: 既存動作への影響なし

今回の修正はドキュメントおよびテンプレート文字列の変更のみであり、
MCPサーバーのコアロジック（フェーズ管理・バリデーション・状態遷移）に影響を与えてはならない。
definitions.tsへの変更はテンプレート文字列の追記のみに限定し、関数シグネチャや
エクスポートされる型定義を変更しないこと。

### NFR-2: 両ファイルの整合性維持

FR-A1とFR-A2の修正後、ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdの
subagent_typeテーブルが完全に一致した状態を維持すること。
将来的なテーブル更新時も両ファイルを同期させるプロセスを意識すること。

### NFR-3: 修正の最小化原則

変更箇所を必要最小限に限定し、不必要なリファクタリングや構造変更を行わないこと。
テーブルの修正はsubagent_type列の値変更のみ（3行×2ファイル）とし、
他の列（model列・入力ファイル列・出力ファイル列）には手を加えないこと。

### NFR-4: 検証可能性

修正後の状態がdefinitions.tsの実装値と目視で比較可能であること。
具体的には、CLAUDE.mdのテーブルとdefinitions.tsのsubagentType値を並べて確認できる形式で
実装フェーズの成果物に記録すること。

### NFR-5: 後続タスクへの影響防止

今回の修正によってバリデーションルールや禁止パターンが変化しないこと。
artifact-validator.tsのロジックは変更しないため、既存の成果物バリデーション動作は維持される。
既存ワークフロータスクの実行中状態にも影響を与えないこと。

---

## 修正対象ファイル一覧

修正が必要なファイルは以下の3件である。

1. `C:\ツール\Workflow\CLAUDE.md`
   - 変更箇所: フェーズ別subagent設定テーブルの3行（security_scan・performance_test・e2e_test）
   - 変更内容: subagent_type列の値を「Bash」から「general-purpose」に変更

2. `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`
   - 変更箇所: FR-A1と同一の3行
   - 変更内容: FR-A1と同一の変更を適用

3. `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
   - 変更箇所: subagentTemplateの禁止語説明セクション
   - 変更内容: 入力ファイルからの禁止語転記防止に関する注意書きを追加

修正不要なファイル:
- `artifact-validator.ts`: isStructuralLine関数の動作は仕様通りであり変更不要
- CLAUDE.mdの「AIへの厳命」セクション（ルール22）: 前回タスクで追加済みのため追加修正は実装フェーズで判断

---

## 優先順位まとめ

| 要件ID | 内容 | 優先度 | 修正方式 |
|--------|------|--------|---------|
| FR-A1 | ルートCLAUDE.mdのsubagent_type修正 | 最高（P0） | テーブル値変更 |
| FR-A2 | workflow-plugin/CLAUDE.mdのsubagent_type修正 | 最高（P0） | テーブル値変更 |
| FR-A3 | 禁止語転記防止注意書き追加 | 推奨（P1） | テンプレート文字列追記 |
| FR-A4 | isStructuralLine修正 | 対応不要 | コード変更なし |
| FR-A5 | MCPサーバー再起動プロセス明文化 | 低（P2） | 実装フェーズで判断 |
