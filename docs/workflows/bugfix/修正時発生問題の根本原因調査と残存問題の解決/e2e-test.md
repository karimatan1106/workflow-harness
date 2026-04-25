## サマリー

- 目的: 今回の2件の修正（security_scanテンプレートへのNG/OKガイダンス追記、workflow_statusレスポンスのスリム化）がエンドツーエンドの動作として正しく機能するかを評価する
- 評価スコープ: `workflow-plugin/mcp-server/src/phases/definitions.ts` のsecurity_scanサブフェーズ定義と、`workflow-plugin/mcp-server/src/tools/status.ts` および `next.ts` のレスポンス構築ロジックを対象とした静的評価を実施した
- 主要な決定事項: 実際のMCPサーバー起動環境が存在しないため、ソースコードの静的解析とロジック追跡によってE2Eシナリオの合否を判定する方式を採用した
- 検証状況: 2件のシナリオを設計・評価し、いずれも実装コードが意図した動作を実現していることをコード追跡で確認した
- 次フェーズで必要な情報: MCPサーバーを実際に起動できる環境があれば、実動作での追加確認が可能。現状の静的評価では双方の修正とも設計意図に沿った実装が確認された

## E2Eテストシナリオ

### シナリオ1: security_scan テンプレートのNG/OKガイダンス経由での生成物一意性確保

このシナリオは、security_scanサブフェーズのsubagentTemplateに追記されたNG/OKガイダンスが、
subagentの評価結論フレーズの重複を回避するうえで有効に機能するかを検証する。

**前提条件:** `definitions.ts` のsecurity_scan.subagentTemplateに評価結論フレーズ向けのNG/OK例が追記済みであること。
subagentが当該テンプレートを入力として受け取り、security-scan.mdを生成する状況を想定する。
テンプレートに記載されたNG例（`- 評価結果: リスクなし` を3件繰り返す）とOK例（FR番号・ファイル名・判断根拠を含む形式）の両方が、
subagentの出力に直接的な制約として機能するかを確認の焦点とする。

**操作ステップ概要:**
ステップ1として、definitions.tsのsecurity_scan.subagentTemplateの内容を読み込んで評価結論フレーズに関するガイダンスの存在を確認する。
ステップ2として、追記されたガイダンス文の構文と具体例（OK例・NG例）が明確に区別されて記述されているかを確認する。
ステップ3として、OK例として示された形式（固有識別子＋判断根拠の付記パターン）が、artifact-validatorの重複行検出ルールを回避するうえで技術的に有効かを判断する。

**期待結果:** ガイダンスが明確であれば、subagentが複数の評価対象（BUG-1, BUG-2等）を同一フォーマットで評価した場合でも、
各行に固有の識別子（BUG番号・ファイル名・根拠）が含まれるため、完全一致する行が3件以上連続する状況を防止できる。

**対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（security_scan.subagentTemplateの評価結論フレーズガイダンス部分）

---

### シナリオ2: workflow_status のレスポンスからの大型フィールド除外確認

このシナリオは、workflow_statusが返すレスポンスから subagentTemplate・content・claudeMdSections の3フィールドが
除外されており、一方でworkflow_nextのレスポンスには引き続きこれらのフィールドが含まれることを確認する。

**前提条件:** `status.ts` の `workflowStatus` 関数が、phaseGuideを構築する際にslimGuideとして3フィールドを削除する実装が完成していること。
また `next.ts` の `workflowNext` 関数が、phaseGuideをそのままレスポンスに含める実装になっていることを前提とする。
アクティブなタスクが存在し、idle・completed以外のフェーズにいる状態を想定する。

**操作ステップ概要:**
ステップ1として、status.tsのworkflowStatus関数内でphaseGuideを構築する箇所（行122〜143）を読み込み、
slimGuideオブジェクトから subagentTemplate・content・claudeMdSections を削除するロジックが実装されていることを確認する。
ステップ2として、next.tsのworkflowNext関数内でphaseGuideをレスポンスに設定する箇所（行598〜629）を読み込み、
next.tsではslimGuideによるフィールド削除処理が行われておらず、resolvePhaseGuideの結果がそのまま含まれることを確認する。
ステップ3として、subPhases（並列フェーズ）がある場合にもサブフェーズ内の同3フィールドがstatus.tsで除外されることを確認する。

**期待結果:** workflow_statusは小さなレスポンスを返し、subagentTemplateのような大型文字列フィールドが含まれない。
一方のworkflow_nextはsubagentTemplateを含む完全なphaseGuideを返すため、Orchestratorがsubagentを起動するプロンプトを構築できる。
この非対称な設計により、フェーズ遷移後のsubagent起動時の情報取得源としてworkflow_nextが機能することが維持される。

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/status.ts`（行125〜143）および `workflow-plugin/mcp-server/src/tools/next.ts`（行598〜629）

## テスト実行結果

### シナリオ1（security_scanテンプレートのNG/OKガイダンス確認）のテスト実行結果

definitions.tsのsecurity_scan.subagentTemplateを静的に読み込んで内容を確認した。
行918に記載された文字列の中に「評価結論フレーズに特化した注意事項として〜」で始まるセクションが確認でき、
そのセクション内にNG例として「`- 評価結果: リスクなし` をBUG-1・BUG-2・BUG-3で繰り返す」、
OK例として「BUG-1（definitions.ts security_scanテンプレート追記）の評価結果: リスクなし（テンプレート文字列への追記のみでロジック変更なし）」が明記されていた。
このOK例の形式は、artifact-validatorの重複行検出においてトリム後に完全一致する行が3件以上出現するパターンを回避するうえで技術的に有効であると判断した。
識別子（BUG-1等）と括弧内の根拠説明を含むため、異なる修正箇所ごとに行の内容が一意になる。
E2Eシナリオ1（security_scan テンプレート追記によるガイダンス提供）のテスト判定: 合格。NG/OKガイダンスが意図した形式で追記されており、subagentの成果物生成において評価結論フレーズの重複回避に寄与することが確認された。

---

### シナリオ2（workflow_statusのスリム化確認）のテスト実行結果

status.tsの125〜143行を静的に読み込んだ結果、以下の実装が確認された。
まずphaseGuideをresolvePhaseGuideで取得した後、スプレッド構文でslimGuideを作成している（行127）。
その後 `delete slimGuide['subagentTemplate']`、`delete slimGuide['content']`、`delete slimGuide['claudeMdSections']` の3行が順次実行されている（行128〜130）。
さらに、subPhasesが存在する場合は各サブフェーズオブジェクトに対しても同3フィールドを削除する内部ループ（行131〜140）が実装されていた。
next.tsの598〜629行では、resolvePhaseGuideの戻り値がそのままphaseGuideとしてレスポンスオブジェクトに設定されており（行598, 629）、
slimGuide処理は一切行われていないことを確認した。
この非対称な設計により、workflow_statusは大型フィールドを除いた軽量レスポンスを返し、
workflow_nextはsubagentTemplateを含む完全なphaseGuideを返す動作が実装レベルで保証されていることが確認された。
E2Eシナリオ2（workflow_statusスリム化と workflow_next の後方互換性維持）のテスト判定: 合格。3フィールドの除外処理がstatus.tsのみに限定され、next.tsでは引き続き全フィールドが提供されることを静的解析で確認した。

---

### 総合評価

2件のE2Eシナリオはいずれも静的解析により合格と判定した。
今回の修正はロジック変更を伴わないテンプレート文字列への追記とレスポンスフィールドの除外であるため、
副作用や既存フェーズへの影響が生じるリスクは低い。
実動作での追加確認が必要な場合は、MCPサーバーを起動してworkflow_statusとworkflow_nextをそれぞれ呼び出し、
レスポンスのキー一覧を比較することで双方の差分を実測できる。
現時点での静的評価の結論として、2件の修正はいずれも設計意図に沿った実装が確認された。
