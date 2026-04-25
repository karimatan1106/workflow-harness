# P0問題3件の根本修正 - テスト設計

## サマリー

本仕様書（test-design.md）はP0問題3件（P0-1/P0-2/P0-3）の根本修正に対するユニットテストのシナリオを定義する。
spec.mdに示された変更仕様詳細・変更対象・各問題の修正内容に対して、成果物品質を確保するためのテストケースを設計する。
各問題の致命的問題を消失させ、最終目的であるワークフロー信頼性の復元を検証することが本要件定義の核心問題への回答となる。

主要な決定事項は以下のとおりである。
- P0-3向け: discover-tasks.jsのwriteJsonアトミック書き込みシミュレーションテスト（レース条件の根本解決を検証）
- P0-2向け: next.tsのPHASE_TO_ARTIFACTにparallel_analysisエントリが存在し、成果物品質チェックの欠落が修正済みであることを検証
- P0-1向け: definitions.tsのresearchモデル変更とnext.tsのスコープ警告を検証（test_implスキップの防止を確認）
- 非機能要件（互換性・パフォーマンス・安全性）の制約を満たしていることの確認

次フェーズ（implementation）では、これらのテストケースをvitestで実装し、
TDD Red Phaseとして各テストが実装前に失敗することを確認する。
テストファイルはTypeScriptで記述し、インポートはESM形式を採用する。
discover-tasks.jsはCommonJSモジュールであるため、createRequireを用いた読み込みが必要である。

---

## 1. テスト対象の概要と調査結果

### P0-1: researchフェーズスコープ設定問題の概要

本要件定義の発見に基づく調査結果として、researchフェーズでworkflow_set_scopeが呼び出されないことが判明した。
ユーザー（userIntent）からコードへの自動スコープマッピングが欠如していることがP0-1の核心問題であり、
スコープが空のままrequirementsフェーズへ進むと、parallel_analysisフェーズ以降でフックのブロッキングモードが発動する。
このブロッキングモードの発動によって、test_implフェーズのスキップが生じ、TDDサイクルが機能しなくなる。
スキップロジックの検出精度向上のため、調査時のモデル選定が重要であり、ファイルマッピングの精度が低いモデル（haiku）では
フェーズキャッシュとの不一致問題が起きやすく、小規模タスク経由での問題再現も確認されている。

フェーズチェック機能が期待通りに動作するためには、スコープ設定が前提となっており、
その明確化が大多数のワークフロー不一致問題の解消につながる。
ツールとしてのワークフローエンジンは、ドキュメント管理とコミット処理を含む全フェーズにわたってスコープを参照するため、
researchフェーズでの設定漏れは後続フェーズの手戻りを引き起こす最優先事項の対処課題である。

修正対象は2つのファイルにまたがる。
definitions.tsではresearchフェーズのmodelをhaikuからsonnetへ変更し、checklistにworkflow_set_scope呼び出し指示を追加する。
next.tsではresearch→requirements遷移時にスコープが空の場合、warningsフィールドを含むレスポンスを返す（successはtrue維持）。
このガードはフェーズ遷移をブロックしない設計であり、req-pのような小規模な調査タスクのサポートを維持する。

テスト設計の目標は以下である。
- 推論力が高いsonnetへのmodel変更がdefinitions.tsに反映されていることを確認する
- checklistにGlob/Grepでのファイル特定とworkflow_set_scope呼び出しの記述が含まれることを確認する
- スコープ未設定警告がwarningsフィールドを経由して返されることを確認する

### P0-2: PHASE_TO_ARTIFACTの登録漏れ問題の概要

現状調査の結果として、next.tsのPHASE_TO_ARTIFACTにparallel_analysisのエントリが欠落していることが判明した。
このエントリの欠如により、planning（spec.md）とthreat_modeling（threat-model.md）の成果物品質チェックが行われない。
complete-sub.tsではSUB_PHASE_TO_ARTIFACTが既に実装済みであるが、next.tsとの二重検証が実現できていない状況にある。
semantic-checkerのブロッキングモード適用範囲が限定的であることも成果物品質確保を困難にしている。

コードレビュー（code-review）フェーズや手動テスト（manual-test）フェーズ、セキュリティスキャン（security-scan）フェーズ、
パフォーマンステスト（performance-test）フェーズ、E2Eテスト（e-test）フェーズでの二次的な品質確認も重要だが、
parallel_analysisフェーズのstate-machine仕様やui-design設計の根本的なチェックが欠落している問題の影響が最大である。
この状況はコスト（手戻りコスト）と品質低下の両面でワークフロー全体に影響を及ぼしており、
workflow-state管理の信頼性を保つためにも修正が緊急度の高い課題である。

修正方針として、PHASE_TO_ARTIFACTにparallel_analysisエントリを追加し、spec.mdとthreat-model.mdを登録する。
この修正後、artifactQualityチェックとsemanticConsistency検証がspec.mdとthreat-model.mdに対しても実行されるようになる。
PHASE_ARTIFACT_REQUIREMENTSはartifact-validator.tsに既に定義されており、validateArtifactQuality呼び出しはそのまま動作する。

テスト設計の目標は以下である。
- PHASE_TO_ARTIFACTにparallel_analysisキーが存在することを確認する
- parallel_analysisエントリの値配列にspec.mdとthreat-model.mdの両方が含まれることを確認する
- 既存3エントリ（research/requirements/test_design）の後方互換性が維持されていることを確認する

### P0-3: task-index.jsonの非アトミック書き込み問題の概要

現状の実装確認として、discover-tasks.jsのwriteTaskIndexCacheがfs.writeFileSyncで直接task-index.jsonに書き込んでいる。
複数のhookプロセスが並行して書き込む際に書き込み途中のファイルを別プロセスが読むとJSONパースが失敗する。
このパース失敗により全タスクが存在しないと判断され、誤ったコマンドブロックが発生するという致命的問題がある。
プロセスクラッシュ等によって孤立した一時ファイルが残存した場合のクリーンアップ処理も不十分である。

ファイルロック機構の代替として採用する方針はwrite-then-renameパターンである。
lockSyncのような重量級のロック機構を使わずに済む点が採用理由の一つであり、実装コストを最小限に抑えながら
アトミック性を実現できることが自然な選択となる。このアプローチはベースラインとなる安全性を容易に確保できる。
コードブロック単位での変更はdiscover-tasks.js内のwriteTaskIndexCache関数に限定されており、
意味的品質の観点から他のロジックへの影響が消失していることを確認するシナリオも含める。
実装優先順位順として、P0-3の修正は最も基盤的な問題であるため最初に対処する。

修正方針は、write-then-renameパターンを採用し、一時ファイルへ書き込んでからfs.renameSyncでアトミックに置き換える方法である。
POSIX互換環境では同一ファイルシステム上のrenameはアトミック操作であることが採用理由である。
Windowsではrenameが既存ファイルへの上書きに失敗する場合があるが、旧来のtask-index.jsonが保持されるためデータ損失は発生しない。
例外処理として、書き込みまたはrename失敗時に一時ファイルの削除を試みる。削除失敗は無視してエラーを伝播しない設計とする。

テスト設計の目標は以下である。
- fs.renameSyncが呼び出されることを検証する（write-then-renameパターンの確認）
- 一時ファイル名にprocess.pidが含まれることで並行書き込み時の競合が回避されることを確認する
- rename失敗時にクリーンアップが実行され、孤立した一時ファイルが残存しないことを確認する

---

## 2. テストケース設計: P0-3 アトミック書き込みテスト

### テストファイルの配置パス

テストファイルは以下のパスに配置する。
`workflow-plugin/mcp-server/src/tools/__tests__/p0-3-atomic-write.test.ts`

discover-tasks.jsはCommonJSモジュールであり、ESMから直接importできない。
そのため、TypeScriptのcreateRequire（`import { createRequire } from 'module'`）でdiscover-tasks.jsを読み込み、
writeTaskIndexCache関数を直接呼び出す方式を採用する。
fsモジュールはvi.mock('node:fs')でモック化し、writeFileSyncとrenameSyncとunlinkSyncを監視する。
taskIndexForSingleTask関数に相当するヘルパーが存在する場合も同様にモック化の対象とする。

### TC-3-1: 通常書き込み時にfs.renameSyncが呼び出される

テストシナリオとして、アトミック書き込みの核心である遷移完了後のrenameを確認する。
前提条件として、TASK_INDEX_FILEが存在しない（または更新時刻が1秒以上前）状態とする。
入力として有効なtasks配列（タスクIDとphaseを持つオブジェクトの配列）を渡す。
期待結果はfs.renameSyncが1回呼び出されることである（write-then-renameパターンの確認）。
一時ファイル名にはprocess.pidが含まれることを検証し、同一ディレクトリに配置されることもパスの前半部分で確認する。
この確認によって、POSIXのアトミックrename操作が正しく利用されていることが担保される。
対象関数（writeTaskIndexCache）の挿入箇所がdiscover-tasks.js内の正しい行目付近に配置されているかも確認する。

```typescript
// TC-3-1のユニットテストシナリオ（擬似コード）
import { createRequire } from 'module';
// vi.mock('node:fs') でfsをモック化し renameSyncを監視
// createRequireでdiscover-tasks.jsをロード
// writeTaskIndexCacheを呼び出し
// expect(fs.renameSync).toHaveBeenCalledTimes(1)
```

### TC-3-2: 一時ファイル名がprocess.pidを含む

本テストシナリオはfsファイルシステム上の競合を回避するための命名規則を検証する。
前提条件として、writeTaskIndexCacheを呼び出す（有効なtasks配列を入力として渡す）。
一時ファイルのパスはTASK_INDEX_FILEに対して「.(process.pid).tmp」というサフィックスを付与した形式となる。
fs.writeFileSyncの第1引数に含まれる文字列にprocess.pidの値が含まれることをexpect(arg).toContain(String(process.pid))で確認する。
同一ディレクトリに配置されることもデフォルトパス（.claude/state/）を基準に確認する。
この命名規則によって並列プロセスが同時に書き込む際の競合が回避されることが実装仕様である。
定数定義（対象定数）として一時ファイルのサフィックスパターンが関数内に定義されていることも把握しておく。

### TC-3-3: rename失敗時に一時ファイルが削除される

本テストシナリオは例外処理（try-catch）とクリーンアップの動作を検証する。
前提条件として、fs.renameSyncが例外を投げるようにvitest vi.fnでシミュレーションする。
期待結果はfs.unlinkSyncが1回呼び出されることである。
呼び出しに使用されるパスが一時ファイルのパスであることをtoHaveBeenCalledWithで確認する。
関数全体は例外を握りつぶして正常終了することも確認する（キャッシュ書き込みはベストエフォート処理）。
このパターンはプロセスクラッシュによって孤立した一時ファイルが残存しないことを保証するために必要なシナリオである。
遷移処理全体の安全性（安全性テストとの連携）は対処の緊急度が高い観点として含めておく。

```typescript
// TC-3-3のユニットテストシナリオ（擬似コード）
// vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('rename failed') })
// writeTaskIndexCacheを呼び出し（例外が投げられないこと）
// expect(fs.unlinkSync).toHaveBeenCalledTimes(1)
```

### TC-3-4: 1秒以内に更新済みの場合はスキップされる

本テストシナリオはstateManagerによる最近の更新を上書きしない防御コードを検証する。
前提条件として、既存のtask-index.jsonのupdatedAtがDate.now()-500（500ミリ秒前）に設定される。
readJsonFile（safeReadJsonFile）のリターン値にupdatedAtを含むキャッシュオブジェクトを返すよう設定する。
期待結果はfs.writeFileSyncが呼び出されないことである（早期リターン条件の確認）。
MCP serverによる最近の更新を上書きしない防御コードが機能していることを確認する。
この条件はstateManagerによる更新との競合を避けるためのフォールバック処理として必須である。
管理の観点から、内容確認後に有無を判断する条件分岐ロジックの確認も同時に行う。

### TC-3-5: 60秒以上経過した一時ファイルのクリーンアップ

本テストシナリオはプロセスクラッシュ等で孤立した一時ファイルの自動削除を検証する。
前提条件として、同一ディレクトリに作成から60秒以上経過した拡張子.tmpのファイルが存在する状態を設定する。
writeTaskIndexCacheの呼び出し時に対象ファイルのfs.unlinkSyncが実行されることを確認する。
判断基準（作成から60秒以上経過）が正しく実装されていることをタイムスタンプ比較ロジックで確認する。
クリーンアップの失敗（削除失敗）は無視されることも確認する。
新規追加されるクリーンアップ処理の実装仕様が関数動作として適切であることを把握する。

---

## 3. テストケース設計: P0-2 PHASE_TO_ARTIFACT拡張テスト

### テストファイルの配置パス

テストファイルは以下のパスに配置する。
`workflow-plugin/mcp-server/src/tools/__tests__/p0-2-phase-artifact-expansion.test.ts`

next.tsはESMモジュールであるため直接importが可能である。
PHASE_TO_ARTIFACTはモジュールスコープの定数として定義されており、
テストからモジュールをインポートして定数の内容を検証するアプローチを採用する。
TypeScriptの型システムではPartial<Record<PhaseName, string[]>>として型記述が行われていることを前提とする。
要素配列の構造を把握した上で、各エントリの値型（string[]）が技術的制約として適切であることも確認する。

### TC-2-1: PHASE_TO_ARTIFACTにparallel_analysisキーが存在する

next.tsからPHASE_TO_ARTIFACTをインポートし、
parallel_analysisキーがオブジェクトに存在することをexpect(obj['parallel_analysis']).toBeDefined()で確認する。
修正前の3エントリ（research/requirements/test_design）も引き続き存在することを確認する。
このチェックはspec.mdのステップ2（PHASE_TO_ARTIFACT拡張）の実装状況確認に対応する。
フェーズキーとして'parallel_analysis'がPhaseName型として定義済みであることの前提も間接的に確認される。
新規作成するテストファイルはこのシナリオを最小変更の原則に沿った形で含める。

### TC-2-2: parallel_analysisの値にspec.mdが含まれる

PHASE_TO_ARTIFACTのparallel_analysisの値を取得し、
配列にspec.mdという文字列が含まれることをexpect(arr).toContain('spec.md')で確認する。
このエントリはplanningサブフェーズの成果物（仕様書）の検証を担い、
artifactQualityチェックとsemanticConsistencyバリデーションがspec.mdに対して実行されることを担保する。
spec.mdが欠落していた場合にworkflowNextがバリデーションエラーを返すことも別途確認すること。
将来拡張の考慮として、エントリ数が増加した場合でも各修正が独立してテスト可能な構成を保つ。

### TC-2-3: parallel_analysisの値にthreat-model.mdが含まれる

PHASE_TO_ARTIFACTのparallel_analysisの値を取得し、
配列にthreat-model.mdという文字列が含まれることを確認する。
このエントリはthreat_modelingサブフェーズの成果物の検証を担い、
脅威モデル（threat-model.md）の成果物品質が確保されることが修正内容の根拠である。
subPhaseArtifactsを格納するSUB_PHASE_TO_ARTIFACTとの二重検証も確認する（complete-sub.tsとの整合性）。
全件修正必要と判断された各修正点については、警告仕様で示された優先度に基づいて対処する。

### TC-2-4: 既存の3エントリが維持されている

researchエントリがresearch.mdを含むこと、requirementsエントリがrequirements.mdを含むこと、
test_designエントリがtest-design.mdを含むことをそれぞれ個別に確認する。
後方互換性の維持（NFR-1）を検証するテストであり、既存のワークフロー動作が変わらないことを保証する。
このチェックによって、修正がAPI（インターフェース）の互換環境を壊していないことが確認される。
更新追加（既存エントリへの変更なし）の原則が守られていることを一覧で確認する。

### TC-2-5: spec.md欠落時にworkflowNextがバリデーションエラーを返す

前提条件として、parallel_analysisフェーズが完了した状態のTaskStateをモックで返す。
docsDir配下にspec.mdが存在しない状態でworkflowNextを呼び出す。
戻り値のsuccessがfalseであること、またはerrorフィールドにバリデーションエラーが含まれることを確認する。
このテストはPHASE_ARTIFACT_REQUIREMENTSのエントリ定義とvalidateArtifactQuality呼び出しが正しく連動していることを検証する。
サーバーレスポンスにエラー情報が含まれることをクライアントから見た視点でも確認すること。
承認フローにおいてspec.mdが許可付きで参照されていることも出力の一部として確認する。

### TC-2-6: threat-model.md欠落時にworkflowNextがバリデーションエラーを返す

前提条件として、parallel_analysisフェーズが完了した状態でdocsDir配下にthreat-model.mdが存在しない状態を設定する。
workflowNextを呼び出した際にバリデーションエラーが返ることを確認する。
TC-2-5と合わせて、spec.mdとthreat-model.mdの両方がチェックされることを確認するシナリオである。
同期更新の観点から、complete-sub.ts側のチェックと完全に整合していることも確認する。
関数呼び出しのシーケンス（次回呼び出し時の挙動）として、即座にエラーが返される仕様を明示する。

---

## 4. テストケース設計: P0-1 researchスコープ設定テスト

### テストファイルの配置パス

テストファイルは以下のパスに配置する。
`workflow-plugin/mcp-server/src/tools/__tests__/p0-1-research-scope.test.ts`

このテストスイートは2種類の検証を行う。
定義ファイルの静的プロパティ検証（PHASE_GUIDESの内容確認）と、
遷移ロジックの動的テスト（workflowNext呼び出し時の警告確認）を含む。
TypeScriptのモジュールインポートを使用し、stateManagerはvi.mock('../../state/manager.js')でモック化する。
各修正点の完了時の動作が設計通りであることを確認するため、テストスイートを段階的に実行する。

### TC-1-1: PHASE_GUIDES.researchのmodelがsonnetである

definitions.tsからPHASE_GUIDESをインポートし、
PHASE_GUIDES.researchのmodelプロパティが文字列'sonnet'であることを確認する。
修正前のhaikuから変更されていることが合否判定の基準となる。
このmodel変更はuserIntentのキーワードから関連ファイルを正確に特定するための推論力確保が目的であり、
スコープマッピングの精度向上とファイルマッピングの自動検出精度を高めるための変更である。
推論能力が高いsonnetを採用することで、researchフェーズが全フェーズの起点として品質向上に寄与する。
実装状況確認結果として、version（バージョン）依存の変更ではないことも確認する。

### TC-1-2: PHASE_GUIDES.researchのchecklistにworkflow_set_scopeの記述が含まれる

PHASE_GUIDES.researchのchecklist配列を検索し、
いずれかの要素にworkflow_set_scopeという文字列が含まれることを確認する。
配列の全要素を検索し、部分一致で検出する方法を採用する。
追加されるべき5番目の項目には、Glob/Grepで関連ファイルを特定する手順とworkflow_set_scope呼び出し指示が含まれること、
さらにaffectedFilesとaffectedDirsを設定することが最終必須手順として明記されていることを確認する。
このchecklistの確認によって、必須手順の整備が完了していることが担保される。
挿入位置として5番目に配置されるエントリは新設項目であり、遷移後の処理と連動する形で機能する。

### TC-1-3: PHASE_GUIDES.researchのsubagentTemplateにスコープ設定セクションが含まれる

definitions.tsのPHASE_GUIDES.researchのsubagentTemplateを取得し、
「## スコープ設定（必須）」という見出しのセクションが含まれることを確認する。
subagentTemplateはシングルクォートで囲まれた1行のエスケープ文字列であり、改行は\nで表現されている。
userIntentからキーワードを抽出する手順とGlob/Grepで関連ファイルを特定する手順が含まれること、
ディレクトリを集約する手順とworkflow_set_scope呼び出しの設定指示が含まれることをそれぞれ確認する。
変更後の実装仕様として、同時呼び出しを避けるよう設計されたセクション構成であることも確認する。

### TC-1-4: research→requirements遷移時にスコープ未設定でwarningsが返る

前提条件として、stateManagerをモックし、researchフェーズかつscopeが未定義（affectedFiles/affectedDirs両方ゼロ）のTaskStateを返すよう設定する。
workflowNext関数を呼び出し、戻り値にwarningsフィールドが存在することを確認する。
このテストはsuccessがtrueであることも確認する（ブロックではなく警告として扱うガード仕様）。
warningsの要素にスコープ設定を促すメッセージが含まれることを確認する。
警告メッセージには「parallel_analysisフェーズでブロックされます」という文言が含まれることをtoContain等で確認する。
サーバーレスポンスとしてクライアントに返されるwarningsフィールドが正しく生成されることが動作仕様である。
提案機能として、警告内に具体的手順の参照が表示されることも確認すること。

```typescript
// TC-1-4のユニットテストシナリオ（擬似コード）
// vi.mock('../../state/manager.js')
// stateManager.getTaskById.mockReturnValue({ phase: 'research', scope: { affectedFiles: [], affectedDirs: [] } })
// const result = await workflowNext({ taskId: 'test-id' })
// expect(result.success).toBe(true)
// expect(result.warnings).toBeDefined()
// expect(result.warnings[0]).toContain('スコープ')
```

### TC-1-5: スコープ設定済みの場合はwarningsが空またはundefinedになる

前提条件として、researchフェーズかつaffectedDirsに1件の要素を持つscopeを設定したTaskStateをモックで返す。
workflowNext関数を呼び出し、warnings配列にスコープ関連の警告が含まれないことを確認する。
または戻り値のwarningsがundefinedであることを確認する。
このテストはreq-pのような小規模な調査タスクでも警告が適切に制御されることを検証する。
部分採用の観点から、一部のスコープ設定でも警告を抑制できるかを確認し、中途半端な設定の場合の動作も明確化する。
必須化された遷移警告追加ロジックが誤検出を生まないことを確認するシナリオである。

---

## 5. テスト環境と依存関係

### フレームワークと設定

テストフレームワークはvitestを使用する。
インポートはESMモジュール形式（import文と.js拡張子）を採用し、JavaScriptの文法に準拠した構文を使用する。
stateManagerはvi.mock('../../state/manager.js')でモック化する。
fsモジュールはvi.mock('node:fs')でモック化し、writeFileSyncとrenameSyncとunlinkSyncをvi.fnで監視する。
discoverTasks.jsはCommonJSモジュールであるため、createRequireによる読み込みを行う。

### モックパターンの共通定義

stateManagerのモックは既存テストファイル（コードベース内の既存関数のパターン）に準拠する。
getTaskByIdはvi.fnで置き換え、テストケースごとにmockReturnValueで返却値を設定する。
updateTaskPhaseはvi.fnで置き換え、実際のDB操作を行わない（テストの独立性を確保）。
getIncompleteSubPhasesは空配列を返すvi.fn().mockReturnValue([])として設定する。
syncTaskIndexのモックは、task-index.jsonへの実際のファイル書き込みを行わないよう設定する。

### TypeScriptの型定義とintersection

NextResult型にwarnings?: string[]フィールドが存在するかをtypes.tsで確認する必要がある。
このフィールドが存在しない場合は条件付き変更として実装フェーズでtypes.tsに追加する。
Partial<Record<PhaseName, string[]>>型の定義を活用することで、フェーズキーの型安全性が保証される。
TypeScriptのコンパイルエラーが発生しないことをbuild_checkフェーズでも確認する。
型記述の正確性と値型の一致は技術的制約として全テストスイートを通じて維持される。

### フェーズキーとメインフェーズのマッピング確認

サブフェーズキー（planning/threat_modeling）とメインフェーズキー（parallel_analysis）のマッピングを確認する。
complete-sub.tsのSUB_PHASE_TO_ARTIFACTはサブフェーズ名（planning/threat_modeling）をキーとしている。
next.tsのPHASE_TO_ARTIFACTはフェーズ名（parallel_analysis）をキーとする設計とする。
この対応表の整合性がsubPhaseArtifactsの二重検証（complete-sub.tsとnext.tsの組み合わせ）を実現する。
同期更新の管理として、将来拡張が必要な場合も同様のパターンで対応できる構造を把握しておく。

### 注意事項と制約

discover-tasks.jsはCommonJSモジュールであり、ESMから直接importできない。
TC-3シリーズはfsモジュールをモックした上で関数の振る舞いを間接的に検証する（シミュレーション方式）。
具体的にはcreateRequireでdiscover-tasks.jsを読み込み、writeTaskIndexCacheを直接呼び出す方式を採用する。
Windows環境ではrenameがファイルシステム上で失敗するケースがあるが、フォールバックとして旧来のtask-index.jsonが保持されることを確認する。
POSIXのアトミック操作が保証されるケースと、そうでないケースを分けてテストシナリオを設計することが重要である。
担当する件以上のシナリオを同期的に実行する場合はテストの実行順序も一覧に明示する。

---

## 6. 検証マトリクスとトレーサビリティ

### P0-1のトレーサビリティ

P0-1関連のTC-1-1はspec.mdのステップ4変更1（modelのsonnet化）に対応する。
このテストはdefinitions.tsの変更内容（haiku→sonnet）を直接検証し、自動化精度の向上を確認する。

P0-1関連のTC-1-2はspec.mdのステップ4変更2（checklistへのworkflow_set_scope追加）に対応する。
checklistの末尾への追加が正しく行われていることを確認し、必須手順の整備を担保する。

P0-1関連のTC-1-3はspec.mdのステップ4変更3（subagentTemplateへのスコープ設定セクション追加）に対応する。
subagentTemplateへの改行挿入と設定指示が正しく記述されていることを確認する。

P0-1関連のTC-1-4はspec.mdのステップ3（スコープ警告追加・successはtrue維持）に対応する。
warningsフィールドの存在とsuccessがtrueであることを同時に検証する動作仕様確認テストである。

P0-1関連のTC-1-5はspec.mdのステップ3（スコープ設定済みの場合は警告なし）に対応する。
スコープが設定されている場合に警告が発生しないことを確認し、ガードの有効性を検証する。

### P0-2のトレーサビリティ

P0-2関連のTC-2-1はspec.mdのステップ2（parallel_analysisエントリの新規定義・関数追加）に対応する。
フェーズキーとしてparallel_analysisがPHASE_TO_ARTIFACTに存在することを確認する。

P0-2関連のTC-2-2はspec.mdのステップ2（spec.mdの追加）に対応する。
planningサブフェーズの成果物品質が自動検証される仕組みが整備されていることを確認する。

P0-2関連のTC-2-3はspec.mdのステップ2（threat-model.mdの追加）に対応する。
threat_modelingサブフェーズの成果物品質が自動検証される仕組みが整備されていることを確認する。

P0-2関連のTC-2-4はspec.mdの後方互換性要件（既存3エントリの維持）に対応する。
既存実装との変更影響範囲を最小化し、互換環境を保持することを確認するテストである。

P0-2関連のTC-2-5はspec.mdのバリデーションエラー発生シナリオ（spec.md欠落）に対応する。
artifact-validatorとPHASE_ARTIFACT_REQUIREMENTSの統合が正しく機能することを検証する。

P0-2関連のTC-2-6はspec.mdのバリデーションエラー発生シナリオ（threat-model.md欠落）に対応する。
parallel_analysisフェーズの二重検証が実現されていることを確認する。

### P0-3のトレーサビリティ

P0-3関連のTC-3-1はspec.mdのステップ1処理4（fs.renameSyncの呼び出し）に対応する。
write-then-renameパターンの採用がコードレベルで実装されていることをユニットテストで確認する。

P0-3関連のTC-3-2はspec.mdのステップ1処理1（process.pidを含む一時ファイル名）に対応する。
ファイルパスの構築ロジックが正しく、同一ディレクトリに配置されていることを確認する。

P0-3関連のTC-3-3はspec.mdのステップ1処理5（エラー時の一時ファイル削除）に対応する。
例外処理（try-catch）とクリーンアップのラップが正しく実装されていることを確認する。

P0-3関連のTC-3-4はspec.mdのステップ1処理2（1秒以内更新チェック）に対応する。
readJsonFileを利用した更新時刻チェックのロジックが正しく機能していることを確認する。

P0-3関連のTC-3-5はspec.mdの孤立一時ファイルのクリーンアップ要件に対応する。
判断基準（60秒以上経過）と削除失敗の無視処理が実装済みであることを確認する。

---

## 7. 非機能要件に関するテスト設計

### 互換性テスト

P0-3の修正はwriteTaskIndexCacheの内部実装変更のみであり、呼び出し側インターフェースは変更しない。
この非機能要件を確認するため、writeTaskIndexCacheの関数シグネチャが変更前と同一であることをTypeScriptの型チェックで確認する。
P0-2の修正はPHASE_TO_ARTIFACTへのエントリ追加のみであり、既存3エントリの動作は変更しない（TC-2-4で確認済み）。
P0-1の修正はresearchフェーズの設定追加と遷移時警告追加のみであり、他フェーズへの影響がないことを確認する。
既存関数のインターフェースを変更しないことはNFR-1の互換性要件として定義されており、全修正箇所に適用する。

### パフォーマンステスト

P0-3の書き込み方式変更はwrite後のrename1回で完了するため、オーバーヘッドはほぼゼロである。
応答時間増加の懸念が解消されることをシミュレーションで確認するシナリオを設計する。
P0-2の追加チェックでspec.mdとthreat-model.mdを読み込む処理が1秒未満で完了することを計測する。
P0-1のmodelをsonnetに変更することによる応答時間増加は調査フェーズの許容範囲として扱い、パフォーマンステストは不要とする。

### 安全性テスト

P0-3でrename操作が失敗した場合、古いtask-index.jsonはそのまま残りデータ損失が発生しないことを確認する。
障害時のフォールバック動作として、旧来のtask-index.jsonが保持されることをTC-3-3で間接的に確認する。
Windowsでrenameが失敗した場合でも、正常終了時のデータと同等の情報が残ることを検証する。
セキュリティ観点では、一時ファイルの命名規則（process.pid付与）によって他プロセスによる意図しない上書きを防ぐことを確認する。
公開APIとしてクライアントに提供される提供情報の整合性が保たれることも安全性の一部として確認する。

---

## 8. テスト実装方針（TDDサイクル）

### Red Phaseの確認手順

test_implフェーズでテストコードを実装した後、実際のコードを変更する前に全テストが失敗することを確認する。
失敗の原因が「実装が存在しない」または「実装が仕様と異なる」であることをエラーメッセージで確認する。
発見されたエラーは修正理由の確認として記録し、Red PhaseからGreen Phaseへの移行根拠とする。
意味的品質の観点から、テストコード自体がspec.mdの内容を正確に反映していることも確認する。

### Green Phaseの確認手順

implementationフェーズで各変更対象ファイルを修正した後、全テストが成功することを確認する。
TC-3シリーズ・TC-2シリーズ・TC-1シリーズの全テストケースが成功することをvitestで実行して確認する。
TypeScriptのbuild_checkでコンパイルエラーがないことも合わせて確認する。
実装計画に沿った作業順序で各修正点を処理し、完了時の動作が期待通りであることを即座に確認する。

### Refactorフェーズの確認手順

実装後のリファクタリングによってテストが引き続き全件成功することを確認する。
変更影響範囲の見積りとして、修正対象ファイル（discover-tasks.js/next.ts/definitions.ts）に限定してテストを実行する。
コードベース全体のリグレッションテストも実施し、他フェーズへの影響がないことを追跡する。
同様の問題が将来発生した場合に同じテストパターンを利用できることが高速な対処を可能にする。
