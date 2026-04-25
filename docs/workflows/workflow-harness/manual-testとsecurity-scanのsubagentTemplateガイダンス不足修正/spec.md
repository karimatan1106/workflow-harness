## サマリー

本仕様書は、`workflow-plugin/mcp-server/src/phases/definitions.ts` の `manual_test` および `security_scan` サブフェーズのsubagentTemplateに対する2つの修正（FR-11・FR-12）と、対応するテストケース（TC-11-1・TC-11-2・TC-12-1）の追加計画を定義する。

- 目的: manual_testの総合評価セクションにガイダンスを追加し（FR-11）、security_scanの行数計算ロジックを定量的に明示する（FR-12）ことで、subagentが初回からバリデーション要件を満たした成果物を安定して生成できるようにする。
- 主要な決定事項: FR-11はperformance_testのFR-9と同一のパターン構造を採用し、5観点ガイダンスをmanual_testに横展開する。FR-12は3セクション×5行＝15行と追加5行の計算式を数値で明示する。
- テスト追加方針: 既存のFR-9・FR-10テストと同様のパターンで、`resolvePhaseGuide('parallel_verification', ...)` 経由でサブフェーズテンプレートを取得して検証する。
- 次フェーズで必要な情報: 修正対象ファイルのパス（`workflow-plugin/mcp-server/src/phases/definitions.ts` と `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`）、挿入位置の正確な文字列マーカー。
- MCPサーバー再起動: definitions.ts修正後は `npm run build` でビルドしてからMCPサーバーを再起動する必要がある。


## 概要

### タスクの背景

parallel_verificationフェーズには4つのサブフェーズ（manual_test・security_scan・performance_test・e2e_test）が存在し、それぞれ過去に個別の問題が報告されたタイミングで修正が積み重ねられてきた。
FR-1からFR-10の修正は問題が発生したフェーズにのみ適用されており、類似フェーズへの予防的な横展開がなされていない状態が続いていた。
今回のFR-11とFR-12は、この非対称性から生じるバリデーション失敗を予防的に解消するための修正である。

### FR-11の問題状況

manual_testのsubagentTemplateには `## テストシナリオ` と `## テスト結果` セクションのガイダンスが記述されているが、`## 総合評価` セクションへのガイダンスが存在しない。
subagentが自己判断でこのセクションを追加した際に、ガイダンスなしでは1段落（実質1行）程度の記述に留まることが多く、minSectionLines（5行）要件を満たせない。
performance_testにはFR-9として同等の総合評価ガイダンスが追加済みであるが、manual_testへの横展開がなされていなかった。

### FR-12の問題状況

security_scanのsubagentTemplateには `minLines: 20` が設定されているが、行数達成のための具体的な計算例が存在しない。
3つの必須セクション（脆弱性スキャン結果・検出された問題・サマリー）にそれぞれ5行ずつ記述すると合計15行となるが、これだけでは目標の20行に届かない。
既存のガイダンスは「内容を充実させて非空行を確保すること」という抽象的な表現のみで、5行のギャップを埋める計算ロジックがsubagentに伝達されていない。

### 修正方針

FR-11は、performance_testのFR-9ガイダンスブロックと同一のフォーマット構造で `## ★ 総合評価セクションの記述指針（FR-11）` ブロックをmanual_testのsubagentTemplate末尾に追加する。
FR-12は、security_scanの既存の「行数カウント仕様と転記防止」セクションに計算ロジックを追記する形で修正する。
テストケースはFR-9・FR-10の実装パターンに準拠し、`resolvePhaseGuide('parallel_verification', ...)` でサブフェーズテンプレートを取得する形式を採用する。


## 実装計画

### FR-11: manual_testフェーズへの総合評価ガイダンス追加

修正対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` である。
修正対象箇所は `manual_test` サブフェーズの `subagentTemplate` 文字列内、末尾の `## 出力\n${docsDir}/manual-test.md` の直前に以下のガイダンスブロックを挿入する。

追加するガイダンスブロックの内容は以下のとおりである。

ガイダンスのセクション見出しは `## ★ 総合評価セクションの記述指針（FR-11）` とし、FR-9と同一のフォーマット（見出し行 + 5観点説明）で記述する。

5観点の内容は以下のとおりに定める。
第1観点は全テストシナリオの合否サマリーとして、実施件数・合格件数・不合格件数を数値とともに評価した1行以上の実質行を記述させる指示である。
第2観点は検出された問題の有無・件数・深刻度概要として、発見した不具合がある場合はその深刻度を含む評価を記述させる指示である。
第3観点は未実施シナリオがある場合の理由と代替措置として、全シナリオを実施できた場合は「全シナリオ実施済み」を明記させる指示である。
第4観点は次フェーズ（security_scan等）への引き継ぎ事項として、後続フェーズで対処が必要な懸念点や確認事項を記述させる指示である。
第5観点は全体的な品質評価として、合格・条件付き合格・不合格の判定と根拠を具体的に記述させる指示である。

ガイダンスブロックの末尾には「各観点について1行以上の実質行を記述し、合計5行以上の実質行を確保すること」という総括指示を含める。

### FR-12: security_scanフェーズへの行数計算ロジック追加

修正対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` である。
修正対象箇所は `security_scan` サブフェーズの `subagentTemplate` 文字列内、末尾の `## 出力\n${docsDir}/security-scan.md` の直前に以下のガイダンスブロックを追加する。

追加するガイダンスブロックの内容は以下のとおりである。

ガイダンスのセクション見出しは `## ★ 行数確保の記述指針（FR-12）` とし、定量的な計算例を含めて記述する。

計算ロジックの明示内容は以下のとおりに定める。
必須セクション3つ（脆弱性スキャン結果・検出された問題・サマリー）にそれぞれ最低5行が必要で合計15行となることを明記する。
全体のminLines（20行）に達するには残り5行以上を別のセクションで確保する必要があることを明記する。
追加セクション（総合評価等）に5行以上記述することで合計20行以上に達することができることを明記する。
この計算根拠を念頭に置いて各セクションの内容量を決定することを指示する。

### テストケース追加

修正対象ファイルは `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` である。
既存のFR-10テストブロックの後に、FR-11とFR-12の2つのテストスイートを追加する。

FR-11テストスイートの記述形式は以下のとおりである。
スイート名は `FR-11: manual_testフェーズのsubagentTemplateに総合評価セクションのガイダンスを追加` とする。
テンプレート取得は `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')` で parentPhaseGuide を取得し、`parentPhaseGuide?.subPhases?.manual_test` から `subagentTemplate` を取得する。
TC-11-1は `template` に `総合評価` が含まれることを `toContain('総合評価')` で検証する。
TC-11-2は `template` に `全テストシナリオ` が含まれることを `toContain('全テストシナリオ')` で検証する。

FR-12テストスイートの記述形式は以下のとおりである。
スイート名は `FR-12: security_scanフェーズのsubagentTemplateに行数確保ガイダンスを追加` とする。
テンプレート取得は `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')` で parentPhaseGuide を取得し、`parentPhaseGuide?.subPhases?.security_scan` から `subagentTemplate` を取得する。
TC-12-1は `template` に `20行` が含まれることを `toContain('20行')` で検証する。

### MCPサーバー再起動手順

definitions.tsへの変更適用後、以下の手順でMCPサーバーを再起動する。
ステップ1: `cd workflow-plugin/mcp-server && npm run build` でTypeScriptをトランスパイルする。
ステップ2: dist/*.jsの更新日時を確認して変更が反映されたことを検証する。
ステップ3: MCPサーバープロセスをClaude Desktopのサーバー再起動機能で再起動する。
ステップ4: 再起動後に `workflow_status` を実行して現在のフェーズを確認してから次の作業を再開する。


## 変更対象ファイル

### 1. definitions.ts（メイン修正ファイル）

- **ファイルパス**: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- **修正内容1（FR-11）**: manual_testサブフェーズのsubagentTemplate末尾（`## 出力\n${docsDir}/manual-test.md` 直前）に `## ★ 総合評価セクションの記述指針（FR-11）` ブロックを挿入する
- **修正内容2（FR-12）**: security_scanサブフェーズのsubagentTemplate末尾（`## 出力\n${docsDir}/security-scan.md` 直前）に `## ★ 行数確保の記述指針（FR-12）` ブロックを挿入する
- **制約事項**: 既存のガイダンス（行数カウント仕様・禁止語転記防止・重複行回避等）は変更しないこと
- **後方互換性**: requiredSectionsの配列は変更しないこと（manual_testは `['## テストシナリオ', '## テスト結果']`、security_scanは `['## 脆弱性スキャン結果', '## 検出された問題']` を維持）

### 2. definitions-subagent-template.test.ts（テスト追加ファイル）

- **ファイルパス**: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`
- **修正内容**: FR-10テストブロック（162行目付近）の後にFR-11（2件）とFR-12（1件）の合計3テストケースを追加する
- **テスト追加後の総件数**: 実装前912件 + 追加3件 = 915件以上

### 3. 修正不要ファイル

以下のファイルは今回の変更対象外である。
- `artifact-validator.ts`: バリデーションロジックの変更は不要（テンプレート文字列の追記のみ）
- `state-manager.ts`: 状態管理の変更は不要
- `status.ts`: レスポンス形式の変更は不要

### 4. 挿入位置の特定方法

FR-11の挿入位置は、manual_testのsubagentTemplate文字列内の `## 出力\\n\${docsDir}/manual-test.md` という文字列の直前である。
FR-12の挿入位置は、security_scanのsubagentTemplate文字列内の `## 出力\\n\${docsDir}/security-scan.md` という文字列の直前である。
どちらも改行文字 `\n` を含む文字列リテラルとして定義されているため、Edit toolの `old_string` には末尾の `\n\n## 出力\n\${docsDir}/manual-test.md` を含める形で一意に特定すること。

### 5. ガイダンスブロックの文字列形式

definitions.tsのsubagentTemplate文字列はシングルクォートで囲まれた改行コード `\n` による文字列結合である。
追加するガイダンスブロックも同じ形式（`\n\n## ★ 総合評価セクションの記述指針（FR-11）\n\n` のような形式）でtemplate文字列の中に埋め込む必要がある。
ブロックの前後には1行の空行（`\n\n`）を挟むことで、Markdown成果物の可読性を確保する。
