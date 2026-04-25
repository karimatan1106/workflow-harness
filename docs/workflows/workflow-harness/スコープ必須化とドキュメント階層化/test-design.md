# テスト設計書（全面改訂版）: スコープ必須化とドキュメント階層化

## サマリー

本テスト設計書は「スコープ必須化とドキュメント階層化」タスクの TDD Red フェーズを指針とする完全なテスト仕様を定義する。
spec.md が定める変更1〜変更6の6つのコードファイル変更と、機能要件 FR-1/FR-2/FR-3 の全項目について、
テストケース・配置先・リグレッション方針を確定する。

### 目的

本テスト設計書の目的は以下の4点である。
第1に、変更内容ごとの検証観点を spec.md の実装仕様書に記載された関数名・パラメータ・行番号の文脈に基づいて明示することである。
第2に、test_impl フェーズにおいてどのテスト追記対象ファイルに何件のテストを追記するかを事前に確定することである。
第3に、既存897件のテストスイートが regression_test フェーズで継続パスすることを保証する根拠を示すことである。
第4に、非機能要件 NFR-1〜NFR-5 に対応した検証観点と計測方法を明文化することである。

### 主要な決定事項

テストファイルはすべて既存ファイルへの追記方式で対応し、新規テストファイルの作成は最小限に留める。
追記対象となる既存ソースコードファイルは next.test.ts・definitions.test.ts・artifact-validator.test.ts・set-scope.test.ts・semantic-checker.test.ts の5ファイルである。
変更1（types.ts）と変更4（definitions.ts のドキュメント変更部）は TypeScript コンパイラの構造的部分型付けで安全性が担保されるため個別テストを最小化する。
変更6（semantic-checker.ts）の validateLLMSemanticTraceability は Anthropic SDK をモック化して外部API依存を排除したユニットテストとして追記する。
非機能要件 NFR-4（10ms 以内）の計測には vitest の performance.now() を使用し、5回計測の平均値で判定する。

### 次フェーズで必要な情報

test_impl フェーズでは以下の5ファイルへの追記を実施する。
追記対象1は `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts` であり、変更2と NFR-4 のテストを追加する。
追記対象2は `workflow-plugin/mcp-server/src/__tests__/definitions.test.ts` であり、変更4の {moduleDir} プレースホルダーテストを追加する。
追記対象3は `workflow-plugin/mcp-server/src/__tests__/artifact-validator.test.ts` であり、変更5の .mmd スキップテストを追加する。
追記対象4は `workflow-plugin/mcp-server/src/tools/__tests__/set-scope.test.ts` であり、変更3の moduleName 推定テストを追加する。
追記対象5は `workflow-plugin/mcp-server/src/__tests__/semantic-checker.test.ts` であり、変更6の LLM セマンティックチェックテストを追加する。

---

## テスト方針

### TDD サイクルにおける位置づけ

本テスト設計書は TDD の Red→Green→Refactor サイクルの Red フェーズに対応する文書である。
test_impl フェーズでは本書のテストケースに基づいてテストコードを既存ファイルに追記し、この時点では意図的に失敗する状態（Red）を作成する。
implementation フェーズで変更1〜変更6を実装し、全テストがパスする状態（Green）にする。
refactoring フェーズでは Green を維持しつつコード品質を改善する（Refactor）。

phase_edit_rules により test_impl フェーズではソースコードファイル（.ts）の変更が禁止されているため、
テストコードを先に書いてから実装するという TDD の順序が技術的に強制される。
この制約は フェーズスキップ（phaseskips）なしの正規フロー遵守の観点からも重要である。

### テスト対象コンポーネントの全体像

変更対象となる6つのコードファイルと各テスト追記対象の対応を示す。
変更1（state/types.ts）は scope インターフェースへの moduleName オプショナルフィールド追加であり、型チェックで検証する。
変更2（tools/next.ts）は requirements→parallel_analysis 遷移時のスコープ未設定警告追加であり、next.test.ts に4件を追記する。
変更3（tools/set-scope.ts）は affectedDirs からの moduleName 自動推定と保存ロジック追加であり、set-scope.test.ts に5件を追記する。
変更4（phases/definitions.ts）は resolvePhaseGuide への {moduleDir} プレースホルダー対応であり、definitions.test.ts に4件を追記する。
変更5（artifact-validator.ts）は .mmd ファイルの bracketPlaceholders チェックスキップであり、artifact-validator.test.ts に2件を追記する。
変更6（validation/semantic-checker.ts）は validateKeywordTraceability を validateLLMSemanticTraceability に置換する変更であり、semantic-checker.test.ts に3件を追記する。

### ユニットテストの品質基準

各テストケースは単一の振る舞いのみを検証し、複数の assert を重ねてテストを複雑化させない方針とする。
モック設定は既存テストで確立されたパターン（vi.mock によるモジュール差し替え）を踏襲し一貫性を維持する。
テストケースは前提条件・手順・期待結果の3要素を必ず含め、spec.md の実装仕様書との対応を明記する。
テスト追記は既存のテストケースを変更しない形式で行い、既存897件のスイートへの影響を排除する。

### リグレッション防止の基本方針

既存897件のユニットテストスイートが regression_test フェーズで継続パスすることをリグレッションの合格基準とする。
リグレッションリスクが最も高いコンポーネントは definitions.ts であり、resolvePhaseGuide 関数が全フェーズ処理で呼び出されるためである。
definitions.ts のリグレッション対策として、既存の {docsDir} 置換動作が変更後も同一であることを明示的に検証するテストケース（TC-4-4）を設ける。
next.ts のスコープ警告追加は success フラグに影響しない設計のため、既存の遷移テストへのリグレッションリスクは限定的である。

---

## 変更1: types.ts のテスト設計

### 変更内容の概要

変更対象は `workflow-plugin/mcp-server/src/state/types.ts` のソースコードファイルである。
変更内容は scope インターフェースの行222-229付近に `moduleName?: string` オプショナルフィールドを2行追加することである。
この変更は後方互換性確保（NFR-5）の観点から、既存の affectedFiles・affectedDirs・preExistingChanges フィールドを一切変更しない最小限の追加である。
TypeScript の構造的部分型付けにより、オプショナルフィールドの追加は既存の型チェックを破壊しない設計方針を採用している。

### TC-1-1: moduleName を省略した scope オブジェクトが TypeScript 型チェックを通ること

テスト対象の関数またはモジュールは `state/types.ts` の scope インターフェース定義である。
前提条件は変更後の types.ts が存在する状態でコンパイルを実行することである。
テスト手順は affectedFiles・affectedDirs・preExistingChanges のみを持ち moduleName を省略した scope オブジェクトを生成することである。
期待結果は TypeScript コンパイルエラーが発生せず型チェックが正常に通過することであり、既存コードの後方互換性が保証される。
検証方法は `tsc --noEmit` またはテスト実行時のコンパイルエラーの有無確認である。
この確認により moduleName オプショナルフィールド追加が既存の TaskState 型との互換性を維持することを証明する。
関連する変更番号は変更1であり、対応する非機能要件は NFR-5（後方互換性確保）である。

### TC-1-2: moduleName を含む scope オブジェクトが型チェックを通ること

テスト対象は変更後の types.ts に定義された moduleName フィールドへのアクセスである。
前提条件は変更後の types.ts が存在し moduleName が string 型として定義されている状態を用意することである。
テスト手順は `{ affectedFiles: [], affectedDirs: ['src/'], preExistingChanges: [], moduleName: 'src' }` のオブジェクトを生成することである。
期待結果は TypeScript コンパイルエラーが発生せず moduleName フィールドへのアクセスが型安全に実行できることである。
検証方法は既存テストと新規テストが全件エラーなしで実行できることの確認である。
参照時の null 安全（optional chaining）パターンとして `taskState.scope?.moduleName` が文法エラーなく使用できることも確認する。
関連する変更番号は変更1であり、対応する非機能要件は NFR-1（897テスト継続パス）と NFR-5 である。

### TC-1-3: 変更後の types.ts で既存の scope 参照パターンがコンパイルを通ること

テスト対象は既存コードにある scope フィールドへの参照パターン全体である。
前提条件は変更後の types.ts が存在し全ソースファイルのコンパイルが通る状態を確認することである。
テスト手順は `taskState.scope?.affectedFiles?.length` というチェーン参照パターンを含む既存コードを全てコンパイルすることである。
期待結果はすべての既存参照パターンでコンパイルエラーが発生しないことであり、変更によって破壊的変更が起きていないことを示す。
検証方法は `npm run build` または `tsc --noEmit` を実行してエラーゼロを確認することである。
フェーズスキップ（phaseskips）判定に使われる `taskState.scope?.affectedFiles?.length` パターンも変更されないことをこのテストで担保する。
関連する変更番号は変更1、対応する非機能要件は NFR-1・NFR-5 である。

---

## 変更2: next.ts のテスト設計

### 変更内容の概要

変更対象は `workflow-plugin/mcp-server/src/tools/next.ts` のソースコードファイルであり、変更箇所は行182-188の承認チェック直後である。
変更内容は requirements フェーズからの遷移処理に対して、スコープ未設定時の日本語警告メッセージを scopeWarnings 配列に push するブロックを10行程度追加することである。
この変更はエラーメッセージの日本語表現として spec.md 「スコープが未設定です。parallel_analysisフェーズでブロックされます。workflow_set_scopeで影響範囲を設定してください。」という推奨表現の文言確認を必要とする。
遷移結果（success フィールド）が true であること（ブロックしない）を保証する設計方針は、NFR-5 の後方互換性確保の観点から採用されている。

### TC-2-1: スコープ未設定で requirements→parallel_analysis 遷移すると warnings に日本語メッセージが含まれること

テスト対象の関数は next.ts のランタイムバリデーション処理（requirements フェーズ分岐）である。
前提条件として stateManager.getTaskById が `phase: 'requirements'`・`approvals: { requirements: true }`・scope が空（affectedFiles と affectedDirs がともに空配列）の TaskState を返すようモック設定する。
テスト手順として currentPhase が requirements のモックで workflow_next を呼び出す。
期待結果はレスポンスに warnings フィールドまたは message フィールドが存在し、日本語の警告メッセージが含まれることである。
検証方法として `result.content[0].text` を JSON パースし warnings 配列の要素数が1以上であることをアサートする。
変更番号は変更2、対応する機能要件は FR-1-2 であり、非機能要件は NFR-4（10ms 以内）と NFR-5 に関連する。

### TC-2-2: スコープ未設定でも遷移が success: true で完了すること（ブロックしないこと）

テスト対象は next.ts における scopeWarnings 配列と遷移フラグ（success）の独立性である。
前提条件として TC-2-1 と同一のスコープ未設定モック設定を使用する。
テスト手順として currentPhase が requirements のモックで workflow_next を呼び出す。
期待結果はレスポンスの `success` フィールドが `true` であることであり、警告が出力されても遷移がブロックされないことを確認する。
検証方法として `response.success === true` を直接アサートする。
spec.md の設計方針として scopeWarnings は遷移フラグ（success）とは独立した配列であるため、警告追加が遷移結果に影響しない設計の検証がこのテストの目的である。
変更番号は変更2、対応する機能要件は FR-1-2、非機能要件は NFR-5 である。

### TC-2-3: 警告メッセージに workflow_set_scope の文字列が含まれること

テスト対象は next.ts が生成する警告メッセージの文言内容であり、受け入れ基準 AC-3 の充足確認である。
前提条件として TC-2-1 と同一のスコープ未設定モック設定を使用する。
テスト手順として requirements フェーズからの遷移レスポンスを取得し、メッセージ文字列を検査する。
期待結果は警告メッセージ文字列に `'workflow_set_scope'` という文字列が含まれることである。
検証方法として取得した警告メッセージに対して `message.includes('workflow_set_scope')` が true であることを確認する。
subagent（サブエージェント）がこの警告を読んで次のアクションを理解できるよう、コマンド名を警告文言に含める要件をこのテストで検証する。
変更番号は変更2、対応する機能要件は FR-1-2 である。

### TC-2-4: スコープ設定済みの場合 warnings にスコープ関連メッセージが含まれないこと

テスト対象は next.ts のスコープ設定済みブランチの処理であり、余分な警告が出力されないことを確認する。
前提条件として affectedDirs に `['workflow-plugin/mcp-server/src/']` を含む TaskState をモックで用意する。
テスト手順として currentPhase が requirements のモックで workflow_next を呼び出す。
期待結果はレスポンスの warnings にスコープ関連メッセージが含まれないか warnings が空であることである。
検証方法として各 warnings 要素に `'workflow_set_scope'` が含まれないことを確認する。
スコープが既設定の場合にユーザーに不要な警告を表示しない設計方針をこのテストで担保する。
変更番号は変更2、対応する機能要件は FR-1-2、非機能要件は NFR-5 である。

### TC-2-5: 現状維持の既存ブロックロジックへの影響がないこと（parallel_analysis→parallel_design ブロック）

テスト対象は next.ts の parallel_analysis→parallel_design 遷移時の既存ブロックロジックであり、変更2の追加がこのロジックに影響を与えないことを確認する。
前提条件として phase が parallel_analysis でスコープ未設定の TaskState をモックで用意する。
テスト手順として currentPhase が parallel_analysis のモックで workflow_next を呼び出す。
期待結果はレスポンスの success が false であり、既存のブロック動作が維持されることを確認する。
検証方法として `response.success === false` をアサートし、エラーメッセージに並列設計フェーズへの進行不可を示す日本語が含まれることを確認する。
この確認により、変更2が追加しても現状維持の既存ブロックロジックが壊れていないことを証明する。
変更番号は変更2、対応する機能要件は FR-1-3 である。

---

## 変更3: set-scope.ts のテスト設計

### 変更内容の概要

変更対象は `workflow-plugin/mcp-server/src/tools/set-scope.ts` のソースコードファイルであり、変更箇所は safeExecute ブロック内の scope 保存処理（行316-343付近）である。
変更内容は dirs パラメータからの moduleName 自動推定ロジック（10行程度）を追加することであり、affectedDirs の先頭要素からトレイリングスラッシュ除去後の basename を取得して scope.moduleName に保存する。
大量スコープ設定時の O(1) パフォーマンス確保のため、推定処理は配列の先頭要素のみを参照する設計方針を採用している。
dirs 配列が空の場合の既存 moduleName 保持は三項演算子の `taskState.scope?.moduleName ?? undefined` によって実現される。

### TC-3-1: dirs に有効なパスを渡すと scope.moduleName に末尾要素が保存されること

テスト対象の関数は set-scope.ts の safeExecute ブロック内の moduleName 自動推定ロジック（FR-2-2）である。
前提条件として stateManager.getTaskById が既存の空 scope を返すよう設定し、updateTaskState をモック化する。
テスト手順として `dirs: ['workflow-plugin/mcp-server/src/']` を含む set-scope リクエストを実行する。
期待結果として保存後の TaskState の scope.moduleName が `'src'` であることを確認する。
検証方法として updateTaskState に渡される scope オブジェクトの moduleName フィールドを直接アサートする。
このテストはドキュメントパスとサブディレクトリの自動解決が機能することの基本確認であり、{moduleDir} プレースホルダー展開の前提条件となる。
変更番号は変更3、対応する機能要件は FR-2-2 である。

### TC-3-2: トレイリングスラッシュを含む dirs でも正しく basename が抽出されること

テスト対象は set-scope.ts のトレイリングスラッシュ除去処理（`replace(/[/\\]+$/, '')` の適用）である。
前提条件として stateManager.getTaskById が既存の空 scope を返すよう設定する。
テスト手順として `dirs: ['workflow-plugin/mcp-server/src///']` のようにトレイリングスラッシュを複数含むパスで set-scope を呼び出す。
期待結果として scope.moduleName が `'src'` として保存されることを確認する（スラッシュが除去されていること）。
検証方法として `taskState.scope?.moduleName === 'src'` をアサートする。
spec.md のトレイリングスラッシュがある場合は `replace(/[/\\]+$/, '')` で除去してから適用するという実装方針の検証である。
変更番号は変更3、対応する機能要件は FR-2-2 である。

### TC-3-3: dirs が空配列の場合 moduleName が保存されないこと（files のみ指定時）

テスト対象は set-scope.ts の dirs 空配列時の挙動であり、affectedFiles のみが指定されたケースの境界値テストである。
前提条件として stateManager.getTaskById が既存の scope（moduleName なし）を返すよう設定する。
テスト手順として `{ affectedFiles: ['src/a.ts'], affectedDirs: [] }` のリクエストを実行する。
期待結果として保存後の TaskState の scope.moduleName が undefined であることを確認する。
検証方法として updateTaskState に渡された scope に moduleName プロパティが存在しないか undefined であることを確認する。
この境界値テストは affectedFiles のみを渡す既存の使い方がモジュール名推定の影響を受けないことを保証する。
変更番号は変更3、対応する非機能要件は NFR-1（既存動作不変）と NFR-5 である。

### TC-3-4: addMode が true かつ dirs が空の場合 既存 moduleName が引き継がれること

テスト対象は set-scope.ts の addMode 時の moduleName 引き継ぎ処理（三項演算子による保持）である。
前提条件として事前に `scope.moduleName: 'mcp-server'` が設定済みの TaskState を stateManager が返すよう設定する。
テスト手順として `addMode: true` かつ dirs が空配列の set-scope リクエストを実行する。
期待結果として更新後の TaskState の scope.moduleName が引き続き `'mcp-server'` であることを確認する。
検証方法として `taskState.scope?.moduleName` が変更前と同一の値 `'mcp-server'` であることをアサートする。
addMode における既存 moduleName 保持は spec.md の `taskState.scope?.moduleName ?? undefined` による実現方法を検証するテストである。
変更番号は変更3、対応する機能要件は FR-2-2、非機能要件は NFR-5 である。

### TC-3-5: 大量スコープ設定時の moduleName 推定処理が O(1) であること（パフォーマンス）

テスト対象は set-scope.ts の moduleName 推定処理の計算量特性であり、配列の先頭要素のみを参照する設計の確認である。
前提条件として affectedDirs に100件と10000件の2パターンのリクエストを用意する。
テスト手順として件数を変えて2回の set-scope 呼び出しの処理時間を `performance.now()` で計測する。
期待結果として件数差（100倍）に対して処理時間の差が 3ms 以内であることを確認する。
検証方法として2回の計測時間の差が `diff < 3` であることをアサートする。
spec.md の「スコープ件数が増加しても推定処理のコストは O(1) で一定」という大量スコープ設定時の O(1) パフォーマンス設計方針の検証である。
変更番号は変更3、対応する非機能要件は NFR-4（10ms 以内）である。

---

## 変更4: definitions.ts のテスト設計

### 変更内容の概要

変更対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` のソースコードファイルであり、変更箇所は resolvePhaseGuide 関数のシグネチャ（行1413付近）とプレースホルダー置換処理（行1425-1468付近）である。
変更内容は関数シグネチャに `moduleName?: string` 引数を追加し、プレースホルダーリストに `{moduleDir}` を追加して `{docsDir}/modules/{moduleName}` への展開ロジックを実装する（20行程度）ことである。
PHASES_BY_SIZE・SUB_PHASE_DEPENDENCIES などの定数は一切変更しないという設計方針により、フェーズスキップ（phaseskips）やフェーズリスト（phases_by_size）への影響はない。
引数追加による既定値（undefined）での既存呼び出しとの互換性は TypeScript の既定値機能で担保する。

### TC-4-1: moduleName 設定時に outputFile の {moduleDir} が docsDir/modules/{moduleName} に展開されること

テスト対象の関数は definitions.ts の resolvePhaseGuide（FR-2-1・FR-2-3）である。
前提条件として docsDir に `'docs/workflows/test-task'`、moduleName に `'auth'` を渡す。
テスト手順として outputFile に `'{moduleDir}/spec.md'` を含むフェーズ定義で resolvePhaseGuide を呼び出す。
期待結果として返却された PhaseGuide の outputFile が `'docs/workflows/test-task/modules/auth/spec.md'` に展開されることを確認する。
検証方法として `guide.outputFile === 'docs/workflows/test-task/modules/auth/spec.md'` を直接アサートする。
展開先（resolve結果）のドキュメントパスとサブディレクトリ構造が spec.md の `{docsDir}/modules/{moduleName}` フォーマット仕様と一致することを確認する。
変更番号は変更4、対応する機能要件は FR-2-1・FR-2-3 である。

### TC-4-2: moduleName 未設定時に {moduleDir} が {docsDir} にフォールバックすること

テスト対象は definitions.ts の resolvePhaseGuide のフォールバック動作（後方互換性確保）である。
前提条件として docsDir に `'docs/workflows/test-task'` を渡し moduleName を省略（undefined）する。
テスト手順として outputFile に `'{moduleDir}/spec.md'` を含むフェーズ定義で resolvePhaseGuide を呼び出す。
期待結果として返却された PhaseGuide の outputFile が `'docs/workflows/test-task/spec.md'` に展開されることを確認する。
検証方法として `guide.outputFile === 'docs/workflows/test-task/spec.md'` を直接アサートする。
このフォールバック動作が内部状態管理（docsDir vs workflowDir）の継続性を保証し、moduleName を使用しない既存タスクの動作を変えないことを証明する。
変更番号は変更4、対応する機能要件は FR-2-3、非機能要件は NFR-5 である。

### TC-4-3: inputFiles 内の {moduleDir} が正しく置換されること

テスト対象は definitions.ts の resolvePhaseGuide の inputFiles フィールドへの {moduleDir} 置換適用である。
前提条件として docsDir に `'docs/workflows/test-task'`、moduleName に `'payment'` を渡す。
テスト手順として inputFiles に `['{moduleDir}/research.md']` を含むフェーズ定義で resolvePhaseGuide を呼び出す。
期待結果として返却された PhaseGuide の inputFiles の先頭要素が `'docs/workflows/test-task/modules/payment/research.md'` に展開されることを確認する。
検証方法として `guide.inputFiles[0]` を直接アサートする。
subagent（サブエージェント）へのコンテキスト（context）として inputFiles が正しくモジュールパスに解決されることを確認するテストであり、プロンプトテンプレートへの正確な情報供給の前提となる。
変更番号は変更4、対応する機能要件は FR-2-1・FR-2-3 である。

### TC-4-4: 既存の {docsDir} 置換動作が変更されないこと（リグレッション防止）

テスト対象は definitions.ts の resolvePhaseGuide の既存 {docsDir} プレースホルダー処理である。
前提条件として docsDir に `'docs/workflows/test-task'` を渡し moduleName を省略する。
テスト手順として outputFile に `'{docsDir}/research.md'` を含む既存フェーズ定義で resolvePhaseGuide を呼び出す。
期待結果として返却された PhaseGuide の outputFile が `'docs/workflows/test-task/research.md'` に展開されることを確認する。
検証方法として `guide.outputFile === 'docs/workflows/test-task/research.md'` を確認し既存フェーズガイドが壊れていないことをリグレッション観点で検証する。
サブエージェントへの影響として、プロンプトテンプレート内の {docsDir} 展開が従来通りに機能し、既存のワークフロータスクが引き続き正常に動作することを保証する。
変更番号は変更4、対応する非機能要件は NFR-1（897テスト継続パス）と NFR-5 である。

---

## 変更5: artifact-validator.ts のテスト設計

### 変更内容の概要

変更対象は `workflow-plugin/mcp-server/src/artifact-validator.ts` のソースコードファイルであり、変更箇所は checkBracketPlaceholders 関数の先頭部分である。
変更内容は `.mmd` 拡張子ファイルの角括弧チェックスキップとして1行を追加することであり、具体的には `if (filePath.endsWith('.mmd')) return [];` という早期リターンの実装である。
この変更により stateDiagram-v2 の `[*]` 記法や flowchart の `["text"]` 記法が成果物バリデーション時に誤検出されなくなる。
.mmd 以外への影響がないこと（限定的な変更）は早期リターン方式による設計方針の選択によって保証される。

### TC-5-1: .mmd ファイルを入力すると bracketPlaceholders チェックが空配列を返すこと

テスト対象の関数は artifact-validator.ts の checkBracketPlaceholders 関数（または同等の角括弧チェック処理）である。
前提条件として `'state-machine.mmd'` というファイルパスと `[*] --> Start\n  Start --> End` という角括弧を含む Mermaid 図コンテンツを用意する。
テスト手順として filePath が `.mmd` で終わるコンテンツを渡して bracketPlaceholders チェック関数を呼び出す。
期待結果として戻り値が空配列であることを確認する（Mermaid 記法の正当な角括弧が誤検出されないこと）。
検証方法として `result.length === 0` を直接アサートする。
ステートマシン・フローチャートとの整合性（設計との一致）として、設計フェーズで作成した .mmd ファイルがバリデーションを通過することをこのテストで担保する。
変更番号は変更5であり、対応する成果物（artifacts）バリデーション修正の目的はバグ修正である。

### TC-5-2: .md ファイルを入力すると従来通りの bracketPlaceholders チェックが実行されること

テスト対象は artifact-validator.ts の .md ファイルへの既存チェック継続動作（リグレッション防止）である。
前提条件として `'spec.md'` というファイルパスと本文中に `[placeholder]` のような角括弧プレースホルダーを含むコンテンツを用意する。
テスト手順として filePath が `.md` で終わるコンテンツを渡して bracketPlaceholders チェック関数を呼び出す。
期待結果として戻り値が空配列でなく角括弧が検出された結果が返ることを確認する（既存動作が維持されていること）。
検証方法として `result.length > 0` を確認しリグレッションが発生していないことを担保する。
このテストにより .mmd 以外のソースコードファイルや Markdown 文書への角括弧チェックが引き続き機能することを証明する。
変更番号は変更5、対応する非機能要件は NFR-1（既存897件の継続パス）である。

---

## 変更6: semantic-checker.ts のテスト設計

### 変更内容の概要

変更対象は `workflow-plugin/mcp-server/src/validation/semantic-checker.ts` のソースコードファイルであり、変更内容は30行程度の置換処理である。
変更内容の詳細は validateKeywordTraceability 関数（キーワード頻度方式）を削除し、新規追加関数 validateLLMSemanticTraceability（LLM ベースの意味的継承度評価）に置換することである。
補助関数 extractSummarySection も新規追加し、`## サマリー` 見出し以降の最大200行を抽出するヘルパーとして実装する。
API 成功時のスコア評価とフォールバック動作（非ブロッキング）として、スコア 0.5 未満で `passed: false`、タイムアウトまたは API 失敗時は `passed: true, score: 0.5` を返す設計方針を採用している。

### TC-6-1: extractSummarySection が ## サマリーセクション以降の本文のみを抽出すること

テスト対象の関数は semantic-checker.ts の extractSummarySection であり、`## サマリー` セクション抽出ロジックを検証する。
前提条件として `## サマリー` 見出しを含む複数セクション構成のテキスト（200行以内）を入力として用意する。
テスト手順として extractSummarySection に上記テキストを渡し戻り値を取得する。
期待結果として `## サマリー` 行以降のテキストが返却され、その行数が200行以内に収まることを確認する。
検証方法として `result.startsWith('## サマリー')` が true かつ `result.split('\n').length <= 200` であることをアサートする。
トレーサビリティの観点として、前フェーズ文書のサマリーセクション抽出精度がトレーサビリティ評価の品質に直結するため、このヘルパー関数の動作確認は重要である。
変更番号は変更6であり、本関数は validateLLMSemanticTraceability の補助として使用される。

### TC-6-2: extractSummarySection が ## サマリーなしのテキストで先頭200行を返すこと

テスト対象は extractSummarySection の `## サマリー` 未発見時のフォールバック動作である。
前提条件として `## サマリー` 見出しを含まない200行超のテキストを用意する。
テスト手順として上記テキストを extractSummarySection に渡す。
期待結果として先頭200行が返却されることを確認する。
検証方法として返却テキストの行数が200以内であることをアサートする。
CRLF 統一処理（`\r\n` を `\n` に変換）が関数内で実行されることも確認し、Windows 環境での動作安全性を担保する。
変更番号は変更6であり、フォールバック設計は非ブロッキング方針と一致する。

### TC-6-3: validateLLMSemanticTraceability が API 成功時に score に基づく判定を返すこと

テスト対象の関数は semantic-checker.ts の validateLLMSemanticTraceability であり、API 成功時のスコア評価動作を検証する。
前提条件として Anthropic SDK の `messages.create` をモック化し、スコア 0.7 と reasoning 文字列を含む JSON レスポンスを返すよう設定する。
テスト手順として任意の前フェーズ文書パスと現フェーズ文書パスを渡して validateLLMSemanticTraceability を呼び出す。
期待結果として `{ passed: true, score: 0.7, reasoning: ... }` が返却されることを確認する（スコア 0.5 以上のため passed: true）。
検証方法として `result.passed === true` かつ `result.score === 0.7` をアサートする。
`claude-haiku-4-5-20251001` モデルを使用した LLM セマンティックチェックの基本動作確認であり、意味的情報継承の評価が機能することを示す。
変更番号は変更6、対応する非機能要件は NFR-1（既存テストとの共存）である。

### TC-6-4: validateLLMSemanticTraceability が API 失敗時に非ブロッキングフォールバックを返すこと

テスト対象は validateLLMSemanticTraceability の API 呼び出し失敗時のフォールバック動作である。
前提条件として Anthropic SDK の `messages.create` をモック化し、例外（NetworkError など）を送出するよう設定する。
テスト手順として任意の文書パスを渡して validateLLMSemanticTraceability を呼び出す。
期待結果として `{ passed: true, score: 0.5, reasoning: 'フォールバック' }` が返却されることを確認する。
検証方法として `result.passed === true` かつ `result.score === 0.5` をアサートする。
API キーが環境変数 `ANTHROPIC_API_KEY` から未設定の場合も同様のフォールバック動作となることを確認する。
非ブロッキング設計の検証として、セマンティックチェックの失敗がワークフローの進行を妨げないことを保証する重要なテストである。
変更番号は変更6であり、タイムアウト（10秒）も同様のフォールバックを返すことがこのテストの適用範囲に含まれる。

### TC-6-5: next.ts の keywordTraceMapping から test_impl エントリが削除されていること

テスト対象は next.ts における keywordTraceMapping 定数の変更点と llmSemanticCheckPhases 定数の追加確認である。
前提条件として変更後の next.ts が変更6の実装を含む状態を確認する。
テスト手順として next.ts の llmSemanticCheckPhases 定数を読み取り `test_impl` が含まれることを確認する。
期待結果として `llmSemanticCheckPhases` に `'test_impl'` が含まれ、旧来の `keywordTraceMapping` に `test_impl` エントリが存在しないことを確認する。
検証方法として next.ts のソースコードを静的解析するか、test_impl フェーズ移行時の実行パスを確認する形式で検証する。
spec.md の「keywordTraceMapping から test_impl エントリを削除し llmSemanticCheckPhases 定数を追加」という変更方針の実装確認である。
変更番号は変更6、対応する機能要件はセマンティックチェック改善であり、サブエージェントへの影響を適切に管理するための変更である。

---

## 非機能要件テスト

### NFR-1: 既存897件テスト継続パスの検証

非機能要件 NFR-1 は「既存897件のテストが変更後も全件パスすること」を要求する。
変更1（types.ts）のリグレッションリスクは低い。オプショナルフィールドの追加は TypeScript 構造的部分型付けにより既存コードに影響しない。
変更2（next.ts）のリグレッションリスクは中程度である。success フラグや遷移ロジックへの影響はないが、警告文言を参照するテストが存在する場合は文言変更で失敗するリスクがある。
変更3（set-scope.ts）のリグレッションリスクは低い。moduleName 推定は追記形式で affectedFiles・affectedDirs の処理を変更しない。
変更4（definitions.ts）のリグレッションリスクは高い。resolvePhaseGuide は全フェーズ処理で呼び出されるコアコンポーネントである。
変更5（artifact-validator.ts）のリグレッションリスクは低い。.mmd ファイルスキップは早期リターンのみで .md 等の他ファイルへの影響はない。
変更6（semantic-checker.ts）のリグレッションリスクは中程度である。validateKeywordTraceability を参照する既存テストがある場合は削除時に失敗するため、事前に特定と無効化が必要である。

### NFR-4: workflow_next の遷移レスポンス時間 10ms 以内の検証

TC-NFR-4 として、変更2の警告追加後も workflow_next のレスポンス時間が 10ms 以内であることを確認する。
前提条件として TC-2-1 と同一のスコープ未設定モック設定を使用する。
テスト手順として `performance.now()` で開始時刻を記録し workflow_next を呼び出し終了時刻で経過時間を計算する。
期待結果として経過時間が 10ms 未満であることを確認する。計測安定性のため5回計測して平均値を採用する。
スコープチェック処理はメモリアクセスのみで I/O 処理を含まないため、単一プロパティ参照（`taskState.scope?.affectedFiles?.length ?? 0`）と比較演算のコストは1マイクロ秒未満と見積もられる。
実行時間（execute time）の影響確認として、この NFR-4 検証テストは next.test.ts への追記テストの一部として実施する。

### NFR-5: 後方互換性確保の検証

後方互換性確保の検証観点として以下の4点を確認する。
第1の観点は workflow_set_scope を一度も呼び出さない既存タスクが警告のみで遷移継続できることであり、TC-2-2 で検証する。
第2の観点は resolvePhaseGuide の追加引数（moduleName）を省略した既存呼び出しが正常動作することであり、TC-4-2・TC-4-4 で検証する。
第3の観点は scope.moduleName を参照しない既存コードが TypeScript コンパイルエラーを起こさないことであり、TC-1-1 で検証する。
第4の観点は {moduleDir} プレースホルダーを含まない既存フェーズ定義の動作が変わらないことであり、TC-4-4 で検証する。
これらの後方互換テストにより、段階的必須化の設計方針が既存ワークフロータスクへの影響をゼロに保つことを証明する。

### リグレッションテストの実行計画

regression_test フェーズでは既存897件を全件実行し失敗件数がゼロであることをリグレッションの合格基準とする。
ベースライン設定として testing フェーズ完了後の成功件数を workflow_capture_baseline に記録する。
今回の変更に起因しない既存テストの失敗は workflow_record_known_bug に記録しリグレッション判定から除外する。
今回の変更に起因する失敗は実装フェーズに差し戻して修正する。
変更4（definitions.ts）への注力として、フェーズガイド取得系テストを優先してリグレッション確認を実施する。
具体的には全フェーズに対して resolvePhaseGuide が正常動作することを確認する統合的なリグレッションテストを設ける。
サブフェーズの再帰処理への {moduleDir} 置換追加は、既存のサブフェーズガイド取得テストへの影響を特に精査する必要がある。

---

## テストファイル配置計画

### 追記対象ファイル一覧と配置方針

テストファイルの配置先として、全テストは `workflow-plugin/mcp-server/src/` 配下の既存ファイルに追記する形式を採用する。
ルートディレクトリに新規テストディレクトリを作成することは禁止されており、本方針はその制約と整合している。

追記対象ファイル1は `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts` である。
このファイルに追記するテストは TC-2-1/TC-2-2/TC-2-3/TC-2-4/TC-2-5 の5件（変更2）と TC-NFR-4 の1件であり、合計6件を追記する。
requirements フェーズの遷移テストブロックと同一の describe 配下に追記し、既存のモック設定（stateManager モック）を再利用する。

追記対象ファイル2は `workflow-plugin/mcp-server/src/__tests__/definitions.test.ts` である。
このファイルに追記するテストは TC-4-1/TC-4-2/TC-4-3/TC-4-4 の4件（変更4）である。
resolvePhaseGuide の既存テストブロックに {moduleDir} 専用の describe ブロックを追加する形式で追記する。

追記対象ファイル3は `workflow-plugin/mcp-server/src/__tests__/artifact-validator.test.ts` である。
このファイルに追記するテストは TC-5-1/TC-5-2 の2件（変更5）である。
bracketPlaceholders チェックのテストブロックを新規 describe として追記する形式とする。

追記対象ファイル4は `workflow-plugin/mcp-server/src/tools/__tests__/set-scope.test.ts` である。
このファイルに追記するテストは TC-3-1/TC-3-2/TC-3-3/TC-3-4/TC-3-5 の5件（変更3）と TC-3-5 の O(1) パフォーマンス確認1件であり、合計6件を追記する。
moduleName 自動推定専用の describe ブロックを追記する形式で対応する。

追記対象ファイル5は `workflow-plugin/mcp-server/src/__tests__/semantic-checker.test.ts` である。
このファイルに追記するテストは TC-6-1/TC-6-2/TC-6-3/TC-6-4/TC-6-5 の5件（変更6）である。
validateLLMSemanticTraceability および extractSummarySection 専用の describe ブロックを追記する形式とする。
既存の validateKeywordTraceability および extractKeywordsFromMarkdown に関するテストは変更6の実装後に削除または無効化する（関数そのものが削除されるため）。

TC-1-1/TC-1-2/TC-1-3 は TypeScript の型チェックによる検証であり、既存テストのコンパイル成功をもって確認できるため個別ファイルへの追記は不要とする。

### 追記テスト件数のまとめ

変更ファイルごとの追記テスト件数を整理すると以下の通りである。
変更1（types.ts）に対応する追記件数は0件であり、コンパイル検証で代替する。
変更2（next.ts）に対応する next.test.ts への追記件数は5件であり、NFR-4 テスト1件を加えた合計6件が追記される。
変更3（set-scope.ts）に対応する set-scope.test.ts への追記件数は6件（moduleName 推定5件＋O(1)性能1件）である。
変更4（definitions.ts）に対応する definitions.test.ts への追記件数は4件である。
変更5（artifact-validator.ts）に対応する artifact-validator.test.ts への追記件数は2件である。
変更6（semantic-checker.ts）に対応する semantic-checker.test.ts への追記件数は5件である。
全変更対象ファイル合計の新規追加テスト件数は23件であり、既存897件に加算されて920件以上となる。

### テスト追記時の注意事項

各テスト追記は既存の describe ブロック構造を維持し、新規の describe ブロックを末尾に追加する形式とする。
モック設定は各テストファイルの既存パターンを踏襲し、vi.mock の重複登録によるエラーを防ぐ。
Anthropic SDK のモックは beforeEach でリセットし、API 成功時と失敗時のシナリオを明確に分離する。
テスト実行は `npm test` または `npx vitest` で既存テストと新規テストを一括実行して Red フェーズを確認する。
test_impl フェーズでは phase_edit_rules によりソースコードファイルの変更が禁止されているため、テスト対象のソースコードが存在しない状態で追記テストが失敗することを確認してから implementation フェーズへ進む。
