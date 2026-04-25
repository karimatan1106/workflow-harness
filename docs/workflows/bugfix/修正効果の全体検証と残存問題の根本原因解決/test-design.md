## サマリー

- 目的: FR-1（MEMORY.md更新）・FR-2（next.tsスリム化）・FR-3（definitions.tsテンプレート追記）の3修正に対するテスト設計を定義し、実装フェーズで作成するテストの骨格を明示する。
- 主要な決定事項: FR-1はドキュメントテキストレビューのみで自動テスト不要。FR-2は既存の next.test.ts に並列フェーズ遷移時のサブフェーズスリム化検証テストを追加する。FR-3は既存の definitions.test.ts に parallel_verification の各サブフェーズテンプレート内の必須ガイダンスセクション存在チェックを追加する。
- 次フェーズで必要な情報: テストファイルのパスは `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts` および `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts` の2ファイル。FR-1のドキュメント変更確認はReadツールで実施する。

---

## テスト方針

今回の変更対象は TypeScript ソースコード 2 ファイルと Markdown ドキュメント 1 ファイルである。それぞれの性質に応じて以下の方針を採用する。

FR-1（MEMORY.md）はランタイムに影響しないドキュメント変更のため、自動テストを作成しない。
実装フェーズでReadツールを用いて変更箇所（80行目と94〜96行目）のテキスト内容を確認し、「workflow_status」という文字列が「正しい取得経路」の説明文に残っていないことをレビューする。
確認基準は、80行目に「workflow_next」が取得源として明記されており、かつ「workflow_status は subagentTemplate を含まない」旨が95〜97行目に追記されていることである。

FR-2（next.ts）は workflow_next ツールの振る舞い変更であり、既存の next.test.ts に新規テストブロックを追加することで検証する。
並列フェーズ（parallel_verificationを代表例として使用）への遷移時にworkflow_nextが返すレスポンスを検査し、トップレベルのphaseGuide.subagentTemplateは存在するが、phaseGuide.subPhases配下の各サブフェーズにはsubagentTemplate・content・claudeMdSectionsフィールドが含まれないことを確認する。
レスポンス全体の文字数が15,000文字以下に収まることも確認する。

FR-3（definitions.ts）は subagentTemplate 文字列への追記であり、既存の definitions.test.ts に新規テストブロックを追加することで検証する。
PHASE_GUIDES から parallel_verification のサブフェーズ（manual_test・performance_test・e2e_test）のsubagentTemplateを取得し、「評価結論フレーズの重複回避（特化ガイダンス）」というセクション文字列が含まれることを確認する。
また追記テキストに禁止語（英語4語・日本語8語の計12語）が含まれないことを文字列検索で確認する。

---

## テストケース

### TC-FR1-01: MEMORY.md 80行目の取得経路が限定されていること

**分類:** ドキュメントレビュー（手動確認）

**前提条件:** FR-1 の実装が完了しており、MEMORY.md が保存されている。

**操作手順:**
Readツールで `C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` の 78 行目から 85 行目を読み込む。
80 行目の文字列を確認する。

**期待結果（合格基準）:**
80 行目に「workflow_next」が取得源として記載されている。
80 行目または直後の行に「workflow_status は Fix 2 以降 subagentTemplate を返さない」旨が注釈として追加されている。
80 行目に「workflow_next または workflow_status」という両方を取得源として並列列挙した記述が存在しない。

**失敗となる条件:**
80 行目が実装前のままであり、「`workflow_next` または `workflow_status` のレスポンスから」という文字列が変更されていない場合。

---

### TC-FR1-02: MEMORY.md 94〜97行目の「テンプレートが取得できない場合」の記述が更新されていること

**分類:** ドキュメントレビュー（手動確認）

**前提条件:** FR-1 の実装が完了しており、MEMORY.md が保存されている。

**操作手順:**
Readツールで MEMORY.md の 92 行目から 100 行目を読み込む。
「テンプレートが取得できない場合」セクションの本文を確認する。

**期待結果（合格基準）:**
該当箇所に「workflow_status は subagentTemplate を含まないため、テンプレートの取得源として使用できない」という趣旨の文言が追加されている。
「workflow_status を呼び直して phaseGuide を再取得する」という手順が残っていない、または「テンプレートは取得できない」という意味の否定文に書き換えられている。

**失敗となる条件:**
94〜96 行目が実装前のままであり、workflow_status でのテンプレート再取得が有効な手順として記述されたままの場合。

---

### TC-FR2-01: parallel_verification遷移時にサブフェーズのsubagentTemplateが除外されること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next.test.ts`

**前提条件:**
stateManager.getTaskById のモックが parallel_verification フェーズに到達できるタスク状態を返すように設定されている。
workflowNext 関数がインポート済みである。

**操作手順:**
regression_test フェーズのモックタスクを用意し、workflowNext を呼び出して parallel_verification への遷移を発生させる。
返り値の phaseGuide.subPhases を取得する。
subPhases の各サブフェーズ（manual_test・security_scan・performance_test・e2e_test）のキーを列挙し、subagentTemplate フィールドの存在を確認する。

**期待結果（合格基準）:**
phaseGuide.subPhases が定義されている。
phaseGuide.subPhases.manual_test に subagentTemplate プロパティが存在しない（undefined または キー自体が削除済み）。
phaseGuide.subPhases.security_scan に subagentTemplate プロパティが存在しない。
phaseGuide.subPhases.performance_test に subagentTemplate プロパティが存在しない。
phaseGuide.subPhases.e2e_test に subagentTemplate プロパティが存在しない。

**失敗となる条件:**
いずれかのサブフェーズに subagentTemplate が文字列として残っている場合。

---

### TC-FR2-02: parallel_verification遷移時にサブフェーズのcontentが除外されること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next.test.ts`

**前提条件:** TC-FR2-01 と同様のモック設定。

**操作手順:**
TC-FR2-01 と同じ手順でworkflowNextを呼び出す。
返り値の phaseGuide.subPhases 各サブフェーズの content フィールドの存在を確認する。

**期待結果（合格基準）:**
phaseGuide.subPhases 配下の全サブフェーズに content プロパティが存在しない。
phaseGuide.subPhases 配下の全サブフェーズに claudeMdSections プロパティが存在しない。

**失敗となる条件:**
いずれかのサブフェーズに content または claudeMdSections が残っている場合。

---

### TC-FR2-03: トップレベルphaseGuide.subagentTemplateは保持されること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next.test.ts`

**前提条件:** TC-FR2-01 と同様のモック設定。definitions.ts の PHASE_GUIDES が parallel_verification の subagentTemplate を持つこと。

**操作手順:**
TC-FR2-01 と同じ手順でworkflowNextを呼び出す。
返り値の phaseGuide.subagentTemplate（トップレベル）の存在を確認する。

**期待結果（合格基準）:**
phaseGuide.subagentTemplate が文字列として存在する。
phaseGuide.subagentTemplate の長さが 50 文字以上である（空文字列でない）。

**失敗となる条件:**
phaseGuide.subagentTemplate が undefined になっている場合。
subPhases の除去処理がトップレベルの subagentTemplate を誤って削除した場合。

---

### TC-FR2-04: 単一フェーズへの遷移時にサブフェーズスリム化が適用されないこと

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next.test.ts`

**前提条件:**
stateManager.getTaskById のモックが research フェーズのタスク状態を返すように設定されている。

**操作手順:**
research フェーズのモックタスクを用意し、workflowNext を呼び出して requirements への遷移を発生させる。
返り値の phaseGuide に subPhases が存在しないことを確認する。

**期待結果（合格基準）:**
phaseGuide.subPhases が undefined または空オブジェクトである（requirements は単一フェーズのため）。
スリム化処理がエラーなく完了している（TypeError などが発生しない）。

**失敗となる条件:**
単一フェーズへの遷移時にスリム化処理が TypeError を発生させた場合。

---

### TC-FR2-05: parallel_qualityへの遷移時にサブフェーズがスリム化されること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next.test.ts`

**前提条件:**
stateManager.getTaskById のモックが refactoring フェーズのタスク状態を返すように設定されている。
parallel_quality のサブフェーズ（build_check・code_review）が定義されている。

**操作手順:**
refactoring フェーズのモックタスクを用意し、workflowNext を呼び出して parallel_quality への遷移を発生させる。
返り値の phaseGuide.subPhases.build_check および phaseGuide.subPhases.code_review を確認する。

**期待結果（合格基準）:**
build_check サブフェーズに subagentTemplate が存在しない。
code_review サブフェーズに subagentTemplate が存在しない。
phaseGuide.subPhases 自体は存在する（サブフェーズオブジェクト全体が削除されるわけではない）。

**失敗となる条件:**
build_check または code_review に subagentTemplate が文字列として残っている場合。

---

### TC-FR3-01: manual_testテンプレートに評価結論ガイダンスセクションが含まれること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`

**前提条件:**
PHASE_GUIDES が definitions.ts からインポートされている。
parallel_verification フェーズの subPhases に manual_test が定義されている。

**操作手順:**
PHASE_GUIDES.parallel_verification.subPhases.manual_test.subagentTemplate を取得する。
文字列に「評価結論フレーズの重複回避（特化ガイダンス）」が含まれることを確認する。

**期待結果（合格基準）:**
manual_test の subagentTemplate が文字列として存在する。
文字列内に「評価結論フレーズの重複回避（特化ガイダンス）」という見出し文字列が含まれる。
文字列内に「シナリオ番号または操作名」に相当するガイダンス文言が含まれる。

**失敗となる条件:**
subagentTemplate が undefined または空文字列の場合。
「評価結論フレーズの重複回避（特化ガイダンス）」の文字列が見つからない場合。

---

### TC-FR3-02: performance_testテンプレートに評価結論ガイダンスセクションが含まれること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`

**前提条件:**
PHASE_GUIDES が definitions.ts からインポートされている。
parallel_verification フェーズの subPhases に performance_test が定義されている。

**操作手順:**
PHASE_GUIDES.parallel_verification.subPhases.performance_test.subagentTemplate を取得する。
文字列に「評価結論フレーズの重複回避（特化ガイダンス）」が含まれることを確認する。

**期待結果（合格基準）:**
performance_test の subagentTemplate が文字列として存在する。
文字列内に「評価結論フレーズの重複回避（特化ガイダンス）」という見出し文字列が含まれる。
文字列内に「計測対象名」または「修正箇所の識別子」に相当するガイダンス文言が含まれる。

**失敗となる条件:**
subagentTemplate が undefined または空文字列の場合。
ガイダンスセクションの文字列が見つからない場合。

---

### TC-FR3-03: e2e_testテンプレートに評価結論ガイダンスセクションが含まれること

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`

**前提条件:**
PHASE_GUIDES が definitions.ts からインポートされている。
parallel_verification フェーズの subPhases に e2e_test が定義されている。

**操作手順:**
PHASE_GUIDES.parallel_verification.subPhases.e2e_test.subagentTemplate を取得する。
文字列に「評価結論フレーズの重複回避（特化ガイダンス）」が含まれることを確認する。

**期待結果（合格基準）:**
e2e_test の subagentTemplate が文字列として存在する。
文字列内に「評価結論フレーズの重複回避（特化ガイダンス）」という見出し文字列が含まれる。
文字列内に「シナリオ名または操作名」に相当するガイダンス文言が含まれる。

**失敗となる条件:**
subagentTemplate が undefined または空文字列の場合。
ガイダンスセクションの文字列が見つからない場合。

---

### TC-FR3-04: 追記テンプレートに禁止語が含まれないこと

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`

**前提条件:**
PHASE_GUIDES が definitions.ts からインポートされている。
対象の禁止語リスト（英語4語: 4語、日本語8語: 8語）が確認済みである。

**操作手順:**
PHASE_GUIDES.parallel_verification.subPhases.manual_test.subagentTemplate を取得する。
同様に performance_test と e2e_test の subagentTemplate を取得する。
各テンプレート文字列に対して禁止語（英語: 特定4語、日本語: 特定8語）を includes 検索する。

**期待結果（合格基準）:**
manual_test の subagentTemplate に禁止語が1つも含まれない。
performance_test の subagentTemplate に禁止語が1つも含まれない。
e2e_test の subagentTemplate に禁止語が1つも含まれない。

**失敗となる条件:**
いずれかのテンプレートに禁止語が includes 検索で検出される場合。
具体的な禁止語の確認方法: definitions.ts 内の FORBIDDEN_PATTERNS 配列に定義された全12語を順に検索する。

---

### TC-FR3-05: security_scanテンプレートが既存のガイダンスを保持すること（リグレッション確認）

**分類:** ユニットテスト（自動テスト）

**テストファイルパス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`

**前提条件:**
PHASE_GUIDES が definitions.ts からインポートされている。
FR-3 の変更対象外である security_scan テンプレートに既存のガイダンスが存在する。

**操作手順:**
PHASE_GUIDES.parallel_verification.subPhases.security_scan.subagentTemplate を取得する。
Fix 1 で追加されたガイダンスの特徴的な文字列が存在することを確認する。

**期待結果（合格基準）:**
security_scan の subagentTemplate が文字列として存在する。
Fix 1 で追加されたガイダンスに関連する特徴的な文字列（重複回避に関する記述）が含まれる。
FR-3 の変更によって security_scan のテンプレートが改変されていない。

**失敗となる条件:**
security_scan の subagentTemplate が変更前から変わってしまっている場合。

---

## テストファイル構成

### 既存テストファイルへの追記方法

FR-2 のテスト（TC-FR2-01 〜 TC-FR2-05）は以下のファイルに追記する。

対象ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next.test.ts`

追記する describe ブロック名: `'FR-2: parallel_verification遷移時のサブフェーズsubagentTemplateスリム化'`

このファイルにはすでに stateManager・helpers・auditLogger・scopeValidator・design-validator・artifact-validator のモックが設定されており、テスト追加に必要な基盤が整っている。

FR-3 のテスト（TC-FR3-01 〜 TC-FR3-05）は以下のファイルに追記する。

対象ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`

追記する describe ブロック名: `'FR-3: parallel_verificationサブフェーズ評価結論ガイダンス追記'`

このファイルには PHASE_GUIDES が既にインポートされており、resolvePhaseGuide を用いたプレースホルダー解決テストが存在する。追加テストは PHASE_GUIDES の直接アクセスで実装可能である。

### テスト実行コマンド

テストは vitest を使用して以下のコマンドで実行する。

next.test.ts 単体実行:
`cd /c/ツール/Workflow/workflow-plugin/mcp-server && npx vitest run src/tools/__tests__/next.test.ts`

definitions.test.ts 単体実行:
`cd /c/ツール/Workflow/workflow-plugin/mcp-server && npx vitest run src/phases/__tests__/definitions.test.ts`

全テストスイート実行:
`cd /c/ツール/Workflow/workflow-plugin/mcp-server && npx vitest run`

---

## テスト優先度と実施順序

テストの実施順序は修正の依存関係に従う。FR-1 はドキュメント確認のみのため最初に実施し、完了後に FR-2・FR-3 を並行実施可能である。

最優先で実施するテスト群（FR-2 のコア動作確認）:
最初に TC-FR2-01 を実施して subagentTemplate 除外の基本動作を確認する。
次に TC-FR2-02 で content・claudeMdSections の除外を確認する。
続いて TC-FR2-03 でトップレベル subagentTemplate の保持を確認し後方互換性を検証する。
その後 TC-FR2-04 と TC-FR2-05 でエッジケース（単一フェーズ遷移・別の並列フェーズへの遷移）を確認する。

次に実施するテスト群（FR-3 のテンプレート追記確認）:
TC-FR3-01〜TC-FR3-03 で 3 つのサブフェーズのガイダンス存在を確認する。
TC-FR3-04 で禁止語汚染がないことを確認する。
TC-FR3-05 でリグレッション（security_scan への影響なし）を確認する。

最後に実施する確認（FR-1 のドキュメントレビュー）:
TC-FR1-01 と TC-FR1-02 を Readツールで手動確認し、80行目と 94〜96 行目の書き換えが意図通りであることを確認する。
