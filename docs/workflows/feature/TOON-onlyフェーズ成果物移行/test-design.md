## サマリー

- TD-001: [AC-1][decision] .toonのみ存在するフェーズでL1・L3・L4が全てpassとなることを検証するテストケース群を定義する
- TD-002: [AC-2][decision] npm run buildの終了コード0と型エラーゼロを自動検証するビルドチェックテストを設計する
- TD-003: [AC-3][decision] npm testの全件通過とリグレッションゼロをテスト実行結果で確認するテストケースを定義する
- TD-004: [AC-4][decision] CLAUDE.md Section 13のMarkdown前提記述が全て除去されTOON-only前提に更新されたことを検証するチェックを設計する
- TD-005: [AC-5][decision] defs-stage1〜6.tsの全subagentテンプレートに.md生成指示が残存しないことをgrepベースで検証するテストケースを定義する
- TD-006: [constraint] 全テストケースはdod-l3.ts・dod-l4-delta.ts・dod-l4-requirements.ts・registry.tsの変更後に実行し、変更前の挙動との差分をエビデンスとして記録する
- TD-007: [risk] dod-l4-requirements.tsの4関数がrequirements.toonのacceptanceCriteria[]キーを正しく参照できない場合、L4チェックが偽陰性（false negative）になるリスクを境界値テストでカバーする

## テスト方針

ユニットテスト主体でTOON-only移行後の各DoDバリデーターの挙動を検証する。
L1・L3・L4の各チェック関数は入出力が明確な純粋関数であるため、ユニットテストでの検証が最適である。
ビルドチェック（AC-2）とnpm testによる全件通過確認（AC-3）は自動化済みの実行コマンドで検証する。
CLAUDE.md Section 13の更新確認（AC-4）とsubagentテンプレートのMD指示残存確認（AC-5）は静的ファイル検査でカバーする。
テスト戦略は「型チェック→ユニットテスト→静的ファイル検査」の3層構造とし、各層が独立して失敗を検出できるよう設計する。
境界値テストは最小値（5件）・最小値マイナス1（4件）・ゼロ件の3パターンをdecisions[]配列長検証でカバーする。
エッジケースとして、TOONデコードに失敗する不正ファイル・空ファイル・フィールド欠損ファイルを各テストケースに含める。
手動確認が必要な項目は harness_next コマンドによるDoD実行結果を証拠として記録する。
既存テストとのリグレッション確認は、変更前後のnpm test実行ログを比較することで客観的に証明する。
テスト対象は15ファイルの変更対象全てではなく、DoDバリデーターとの直接接点を持つ7ファイルに絞り込む。

## テストケース

テストケースIDは TC-{AC番号}-{連番} の命名規則で定義する。
各テストケースは前提条件・実行手順・期待結果の3要素で記述する。
全テストケースを実行するにはworkflow-harness/mcp-server配下でnpm testを実行する。

**TC-AC1-01: .toonファイルのみ存在する場合のL1チェック通過確認**
前提: registry.tsのoutputFileが {docsDir}/research.toon に変更済みであること。
実行: docsDir内にresearch.toonを配置し、research.mdが存在しない状態でcheckL1FileExistsを呼び出す。
期待結果: passed=true かつ evidence に research.toon のパスが含まれること。

**TC-AC1-02: .toonファイルのみ存在する場合のL3品質チェック通過確認**
前提: dod-l3.tsのanalyzeArtifactがtoonDecodeベースに再実装済みであること。
実行: 有効なTOONファイル（decisions[6]以上・各フィールドに十分な文字数）を配置してcheckL3Qualityを呼び出す。
期待結果: passed=true かつ sectionDensity が30%以上であること。

**TC-AC1-03: .toonファイルのみ存在する場合のL4 Delta Entryチェック通過確認**
前提: dod-l4-delta.tsのcheckDeltaEntryFormatがdecisions[]配列length検証に置き換え済みであること。
実行: decisions[]配列に5件以上のエントリを持つTOONファイルを配置してcheckDeltaEntryFormatを呼び出す。
期待結果: passed=true かつ evidence に valid entries count が含まれること。

**TC-AC1-04: decisions[]が4件の場合のL4 Delta Entryチェック失敗確認（境界値）**
前提: dod-l4-delta.tsのcheckDeltaEntryFormatが置き換え済みであること。
実行: decisions[]配列に4件のエントリを持つTOONファイルを配置してcheckDeltaEntryFormatを呼び出す。
期待結果: passed=false かつ evidence に count < required 5 のメッセージが含まれること。

**TC-AC1-05: decisions[]が0件の場合のL4 Delta Entryチェック失敗確認（境界値ゼロ）**
前提: dod-l4-delta.tsのcheckDeltaEntryFormatが置き換え済みであること。
実行: decisions[]配列が空のTOONファイルを配置してcheckDeltaEntryFormatを呼び出す。
期待結果: passed=false かつ evidence にcount 0 のメッセージが含まれること。

**TC-AC1-06: requirements.toonのacceptanceCriteria[]キーを読むcheckACFormatの通過確認**
前提: dod-l4-requirements.tsのcheckACFormatがrequirements.toonをtoonDecodeで読む実装に変更済みであること。
実行: acceptanceCriteria[]配列に3件以上のエントリを持つrequirements.toonを配置してcheckACFormatを呼び出す。
期待結果: passed=true かつ evidence にAC件数が含まれること。

**TC-AC1-07: requirements.toonのacceptanceCriteria[]が2件の場合のcheckACFormat失敗確認（境界値）**
前提: dod-l4-requirements.tsが変更済みであること。
実行: acceptanceCriteria[]配列に2件のエントリを持つrequirements.toonを配置してcheckACFormatを呼び出す。
期待結果: passed=false かつ evidence に count 2 < required 3 のメッセージが含まれること。

**TC-AC1-08: requirements.toonのnotInScope[]キーが存在する場合のcheckNotInScope通過確認**
前提: dod-l4-requirements.tsのcheckNotInScopeがrequirements.toonをtoonDecodeで読む実装に変更済みであること。
実行: notInScope[]配列に1件以上のエントリを持つrequirements.toonを配置してcheckNotInScopeを呼び出す。
期待結果: passed=true であること。

**TC-AC1-09: TOONデコード失敗ファイルに対するL3チェックの適切なエラー返却確認**
前提: dod-l3.tsがtoonDecodeベースに再実装済みであること。
実行: 不正なTOON構文のファイル（ヘッダー行有り・構文エラー等）を配置してcheckL3Qualityを呼び出す。
期待結果: passed=false かつ evidence にdecode failed のメッセージが含まれること。

**TC-AC2-01: npm run buildの終了コード0確認**
前提: 15ファイル全ての変更が完了していること。
実行: workflow-harness/mcp-server配下でnpm run buildを実行する。
期待結果: 終了コードが0であること、標準エラー出力に型エラーが含まれないこと。

**TC-AC2-02: npm run buildの型エラーゼロ確認**
前提: dod-l3.tsのanalyzeArtifact再実装でtoonDecodeの戻り値型が正しく参照されていること。
実行: TC-AC2-01と同一のビルドコマンドの出力をパースして型エラー件数を確認する。
期待結果: TypeScript compiler error件数が0であること。

**TC-AC3-01: npm testの全件通過確認**
前提: 15ファイル全ての変更が完了し、npm run buildが通過していること。
実行: workflow-harness/mcp-server配下でnpm testを実行する。
期待結果: 終了コードが0であること、全テストがpassedであること。

**TC-AC3-02: 変更前後のテスト件数差異がゼロであることの確認（リグレッション検証）**
前提: 変更前のnpm test実行結果をベースラインとして記録済みであること。
実行: TC-AC3-01の実行後にテスト件数・名称をベースラインと比較する。
期待結果: 新たに失敗したテストがゼロ、削除されたテストがゼロであること。

**TC-AC4-01: CLAUDE.md Section 13にMarkdown見出し参照記述が残存しないことの確認**
前提: CLAUDE.md Section 13が更新済みであること。
実行: CLAUDE.md Section 13の内容をgrepで検索し「## 」形式のMarkdown見出し前提記述の有無を確認する。
期待結果: Markdown見出し前提の記述が存在しないこと。

**TC-AC4-02: CLAUDE.md Section 13にTOONキー名（decisions・artifacts・next等）が含まれることの確認**
前提: CLAUDE.md Section 13が更新済みであること。
実行: CLAUDE.md Section 13に「decisions」「artifacts」「next」等のTOONキー名が含まれることをgrepで確認する。
期待結果: 少なくともdecisions・artifactsの2キー名が記述に含まれること。

**TC-AC5-01: defs-stage1.tsのsubagentテンプレートに.md生成指示が存在しないことの確認**
前提: defs-stage1.tsが更新済みであること。
実行: defs-stage1.tsの内容をgrepで検索し「.md に保存してください」または「.md形式」等のMD生成指示の有無を確認する。
期待結果: .md生成指示が存在しないこと。

**TC-AC5-02: defs-stage2〜6.tsの全subagentテンプレートに.md生成指示が存在しないことの確認**
前提: defs-stage2〜6.tsが全て更新済みであること。
実行: defs-stage2.ts〜defs-stage6.tsそれぞれに対してTC-AC5-01と同一のgrepチェックを実行する。
期待結果: 6ファイル全てで.md生成指示が存在しないこと。

**TC-EDGE-01: checkToonCheckpointが廃止後にgates runnerから参照されないことの確認**
前提: dod-l4-toon.tsのcheckToonCheckpointが廃止され、gates runnerの呼び出し箇所が削除済みであること。
実行: dod.tsまたはgates runnerファイルをgrepしcheckToonCheckpointの参照が存在しないことを確認する。
期待結果: checkToonCheckpointの参照が0件であること。

**TC-EDGE-02: 空のdecisions[]配列を持つTOONファイルに対するL3密度チェックの境界値確認**
前提: dod-l3.tsがtoonDecodeベースに再実装済みであること。
実行: decisions[]が空・artifacts[]が空・nextが空のTOONファイルでcheckL3Qualityを呼び出す。
期待結果: sectionDensityが0.0となりpassed=falseであること。

## AC→TCマッピングテーブル

| AC-N | テストケースID | テスト内容 |
|------|--------------|---------|
| AC-1 | TC-AC1-01 | .toonのみの場合のL1チェック通過確認 |
| AC-1 | TC-AC1-02 | .toonのみの場合のL3品質チェック通過確認 |
| AC-1 | TC-AC1-03 | .toonのみの場合のL4 Delta Entryチェック通過確認 |
| AC-1 | TC-AC1-04 | decisions[]4件のL4 Delta Entryチェック失敗確認（境界値） |
| AC-1 | TC-AC1-05 | decisions[]0件のL4 Delta Entryチェック失敗確認（境界値ゼロ） |
| AC-1 | TC-AC1-06 | requirements.toonのacceptanceCriteria[]読み取り通過確認 |
| AC-1 | TC-AC1-07 | acceptanceCriteria[]2件の場合のcheckACFormat失敗確認（境界値） |
| AC-1 | TC-AC1-08 | requirements.toonのnotInScope[]存在確認 |
| AC-1 | TC-AC1-09 | TOONデコード失敗ファイルへの適切エラー返却確認 |
| AC-2 | TC-AC2-01 | npm run buildの終了コード0確認 |
| AC-2 | TC-AC2-02 | npm run buildの型エラーゼロ確認 |
| AC-3 | TC-AC3-01 | npm testの全件通過確認 |
| AC-3 | TC-AC3-02 | 変更前後のテスト件数差異ゼロ確認（リグレッション検証） |
| AC-4 | TC-AC4-01 | CLAUDE.md Section 13にMarkdown見出し記述残存なし確認 |
| AC-4 | TC-AC4-02 | CLAUDE.md Section 13にTOONキー名含まれること確認 |
| AC-5 | TC-AC5-01 | defs-stage1.tsの.md生成指示残存なし確認 |
| AC-5 | TC-AC5-02 | defs-stage2〜6.tsの.md生成指示残存なし確認 |
