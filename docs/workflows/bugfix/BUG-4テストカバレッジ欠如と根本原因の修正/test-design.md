## サマリー

本テスト設計書は、BUG-4修正に伴うテストカバレッジ欠如の解消を目的として作成される。
対象は2ファイルであり、`calculatePhaseSkips` 関数の全分岐を網羅する新規ユニットテストファイルの作成と、
`skip-env-removal.test.ts` における `writeTaskState` モック欠如を起因とするリグレッションの修正が主要な作業内容となる。
主要な決定事項として、新規テストファイルは外部依存のモックを使用しない純粋関数テストとして設計し、
`definitions.js` からのnamed importのみで完結させる方針を採用する。
既存テストの修正は `TC-1-2` グループ（行183〜252）と `AC-1-3` テスト（行453〜470）のみに限定し、
他のテストケースへの影響を最小化する。
次フェーズで必要な情報として、`calculatePhaseSkips` の関数シグネチャと早期returnパスの動作仕様、
および vitest での ESM インポート時の `.js` 拡張子要件を引き継ぐ。

---

## テスト方針

テスト対象は2ファイルであり、それぞれ独立した方針でテストを設計する。

新規ファイル `calculate-phase-skips.test.ts` については、`calculatePhaseSkips` 関数が純粋関数であるという特性を活かし、
外部モジュールのモックを一切使用しない方針を採用する。
関数の入力に対して常に一定の出力が保証されるため、入力値と戻り値のみで全分岐を網羅できる。
vitest を使用したユニットテストとして記述し、`describe` 構造はスコープ空パスとスコープ設定済みパスの2グループで構成する。

既存ファイル `skip-env-removal.test.ts` の修正については、最小変更原則を採用する。
変更対象は `TC-1-2` グループの `beforeEach` へのモック追加と `AC-1-3` テストへの個別モック追加の2箇所のみとし、
他の既存テストを破壊しないことを最優先とする。
`vi.clearAllMocks()` が親 `beforeEach` で実行されるため、グループ固有の `beforeEach` でモックを再設定する。

テストの実行コマンドは `workflow-plugin/mcp-server` ディレクトリを基点として `npx vitest run` を使用する。
新規テストのみ個別実行する場合はファイルパスを引数に指定することで確認できる。
テスト完了後はルートディレクトリに一時ファイルが残らないことを確認する。

---

## テストケース

### 新規作成: calculate-phase-skips.test.ts の7テストケース

以下のテストケースはいずれも `calculatePhaseSkips` 関数に対する純粋関数テストとして設計される。
外部依存のモックは不要であり、関数を直接インポートして入力と出力のみで検証する。
インポートパスは ESM 形式の `.js` 拡張子を使用する: `import { calculatePhaseSkips } from '../definitions.js'`

**FR-1-1: スコープ未設定の3フェーズスキップ検証**

テスト名: 「空のオブジェクトを渡した場合、test_impl・implementation・refactoringの3フェーズがスキップ対象になること」
入力パターン1として `calculatePhaseSkips({})` を検証し、戻り値に `test_impl`・`implementation`・`refactoring` の3キーが全て存在することを確認する。
入力パターン2として `calculatePhaseSkips({ files: [] })` を検証し、同様に3キーが存在することを確認する。
スキップ理由の文字列が空でないことも `expect(result.test_impl).toBeTruthy()` 等で検証する。
この検証により、スコープ空状態の早期returnパスが正しく動作することが保証される。

**FR-1-2: テストキーワードによる test_impl スキップ除外**

テスト名: 「userIntentにテストキーワードを含む場合、test_implがスキップ対象から除外されること」
入力 `calculatePhaseSkips({}, 'テストを追加する')` を渡し、`test_impl` キーが存在しないことを確認する。
`implementation` と `refactoring` キーは依然として存在することも検証する。
英語キーワード `'testing'` を含む `calculatePhaseSkips({}, 'testing required')` でも同様の動作を確認する。
これにより userIntent によるスキップ上書き機能が正しく動作することが保証される。

**FR-1-3: 実装キーワードによる implementation・refactoring スキップ除外**

テスト名: 「userIntentに実装キーワードを含む場合、implementationとrefactoringがスキップ対象から除外されること」
入力 `calculatePhaseSkips({}, '実装を行う')` を渡し、`implementation` と `refactoring` キーが存在しないことを確認する。
`test_impl` キーは依然として存在することも検証する。
英語キーワード `'implement'` と `'implementation'` でも同様の動作を追加検証する。

**FR-1-4: テストキーワードと実装キーワードの両方を含む場合**

テスト名: 「userIntentにテストキーワードと実装キーワードの両方を含む場合、3フェーズ全てがスキップ対象から除外されること」
入力 `calculatePhaseSkips({}, 'テストと実装を両方行う')` を渡し、戻り値が空オブジェクトになることを確認する。
`expect(Object.keys(result)).toHaveLength(0)` を使用して空オブジェクトを検証する。
これにより両キーワードが同時に存在する場合の組み合わせ動作が保証される。

**FR-1-5: コードファイルとテストファイルが両方含まれる場合**

テスト名: 「コードファイルとテストファイルの両方がスコープに含まれる場合、全フェーズがスキップ対象にならないこと」
入力 `calculatePhaseSkips({ files: ['src/foo.ts', 'src/foo.test.ts'] })` を渡す。
コードファイル（`.ts` 拡張子でテストパターン非該当）とテストファイル（`.test.ts` パターン該当）が両方存在するため、
`hasCodeFiles` と `hasTestFiles` がいずれも true となり、スキップ対象が空マップになることを確認する。
戻り値のキー数が0であることを検証する。

**FR-1-6: テストファイルのみスコープに含まれる場合**

テスト名: 「テストファイルのみスコープに含まれる場合、implementationとrefactoringがスキップ対象になること」
入力 `calculatePhaseSkips({ files: ['src/foo.test.ts'] })` を渡す。
`hasCodeFiles` が false、`hasTestFiles` が true となるため、`implementation` と `refactoring` がスキップ対象になることを確認する。
`test_impl` はスキップ対象にならないこと（キーが存在しないこと）も合わせて検証する。

**FR-1-7: コードファイルのみスコープに含まれる場合**

テスト名: 「コードファイルのみスコープに含まれる場合、test_implがスキップ対象になること」
入力 `calculatePhaseSkips({ files: ['src/foo.ts'] })` を渡す。
`hasCodeFiles` が true、`hasTestFiles` が false となるため、`test_impl` がスキップ対象になることを確認する。
`implementation` と `refactoring` はスキップ対象にならないこと（キーが存在しないこと）も合わせて検証する。

### 既存テストの修正: skip-env-removal.test.ts の2箇所

**TC-1-2 グループの修正（行183〜252）**

修正概要: `describe('TC-1-2: SKIP_DESIGN_VALIDATIONが無効化されること（next.ts）', () => {` の開始直後に
ネストした `beforeEach` ブロックを追加し、`vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` を設定する。
この修正が必要な理由は、`mockTaskState('test_impl')` を使用するテストではスコープが空のため BUG-4 早期returnパスが発動し、
`stateManager.writeTaskState` が呼び出されるが、当該テストではこのメソッドがモック化されていないためである。
`vi.clearAllMocks()` が親の `beforeEach` で呼ばれるため、グループ固有の `beforeEach` でモックを再設定することが必須となる。

修正の適用対象テスト:
- 行184「SKIP_DESIGN_VALIDATION=trueを設定しても設計検証が実行されること」
- 行229「test_implフェーズでもSKIP_DESIGN_VALIDATIONが無視され設計検証が実行されること」

**AC-1-3 テストの修正（行453〜470）**

修正概要: 行457の `vi.spyOn(stateManager, 'getTaskById').mockReturnValue(taskState)` の直後に
`vi.spyOn(stateManager, 'writeTaskState').mockImplementation(() => {})` を追加する。
この修正が必要な理由は、`mockTaskState('test_impl')` でスコープが未設定のため BUG-4 早期returnパスが発動するが、
`writeTaskState` のモックが欠如しているためである。
修正対象テスト: 行453「AC-1-3: SKIP_DESIGN_VALIDATION=trueを設定しても設計検証が実行されること」

### テスト実行手順と期待結果

テスト実行前の確認事項として、`workflow-plugin/mcp-server` ディレクトリに移動することが必要である。
ルートディレクトリでの実行は禁止されており、テスト生成物がルートに配置されることを防ぐ。

全テスト実行時の期待結果:
- 新規ファイル `calculate-phase-skips.test.ts` の7テストケースが全てパスすること
- `skip-env-removal.test.ts` で修正前に失敗していた15件のリグレッションが解消されること
- 既存テスト（TC-1-1, TC-1-3, TC-1-4, AC-1-1, AC-1-2, AC-1-4）が引き続きパスすること
- テスト全体のスイートが正常終了し、失敗件数が0になること

失敗時の確認項目:
- ESM インポートパスに `.js` 拡張子が含まれているか
- `vi.clearAllMocks()` の後にモックが再設定されているか
- `calculatePhaseSkips` の関数シグネチャ（`scope.affectedFiles` または `scope.files`）を正しく使用しているか
