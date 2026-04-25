## サマリー

- 目的: コミット e90ce40 で実施した Fix 1（security_scan テンプレート拡充）および Fix 2（workflow_status レスポンス最適化）の効果確認と、修正に伴う副作用・残存問題の特定を行った。
- 主要な決定事項: 両修正はソースおよび dist ファイルに正しく反映されており、ビルドも正常に完了している。ただし Fix 2 の副作用として MEMORY.md の記述との齟齬が生じており、Orchestrator が workflow_status から subagentTemplate を取得しようとした場合に取得できなくなっている。
- 次フェーズで必要な情報: 副作用として判明した「workflow_status から subagentTemplate が取得不可になった問題」への対処方針の確定、および manual_test・performance_test・e2e_test テンプレートに対する同様の重複行ガイダンス追加の要否検討が必要。

---

## 調査結果

### Fix 1（definitions.ts security_scan テンプレート拡充）の確認

ソースファイル `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts` の security_scan.subagentTemplate に、評価結論フレーズ重複回避の NG/OK ガイダンスが追加されていることを確認した。

追加された内容の要点は以下のとおりである。
- 「評価結論フレーズに特化した注意事項」として新セクションが挿入された。
- 具体的な NG 例として「評価結果: リスクなし」を BUG-1・BUG-2・BUG-3 の 3 件で繰り返す場合を示している。
- OK 例として BUG-1・BUG-2 それぞれに固有の識別子とロジック説明を付記した形式が示されている。
- この修正は従来の重複行ガイダンス（FR-A・FR-B・FR-C を対象にした記述）に対して追記する形式で実施されており、既存のガイダンスを破壊していない。

dist ファイル `C:\ツール\Workflow\workflow-plugin\mcp-server\dist\phases\definitions.js` のタイムスタンプは 2026-02-23 11:53 であり、ソースファイルのタイムスタンプ 11:46 の後にビルドが実施されていることを確認した。dist ファイルには「評価結論フレーズ」という文字列が含まれており、修正が正しくトランスパイルされている。

### Fix 2（status.ts workflow_status レスポンス最適化）の確認

ソースファイル `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\status.ts` の 127〜141 行に、phaseGuide から subagentTemplate、content、claudeMdSections を削除する処理が追加されていることを確認した。

具体的には以下の処理が実装されている。
- `const slimGuide = { ...phaseGuide }` でシャローコピーを作成した後、`delete slimGuide['subagentTemplate']` および `delete slimGuide['content']`、`delete slimGuide['claudeMdSections']` を実行してサイズの大きなフィールドを除去する。
- subPhases オブジェクト内の各サブフェーズに対しても同様に subagentTemplate・content・claudeMdSections を削除する処理が実装されている。

dist ファイル `C:\ツール\Workflow\workflow-plugin\mcp-server\dist\tools\status.js` の 111〜125 行にも同等の処理が出力されており、修正が正しく反映されていることを確認した。

### ビルド状態の確認

全 dist ファイルのタイムスタンプが 2026-02-23 11:53 であり、一斉ビルドが完了していることを確認した。source ファイルのタイムスタンプ（11:46）より後に dist が生成されているため、ビルドの最新性は保証されている。

---

## 既存実装の分析

### Fix 2 の副作用：subagentTemplate 取得経路の非対称性

Fix 2 により `workflow_status` と `workflow_next` の phaseGuide レスポンスに非対称性が生じた。具体的な違いは以下のとおりである。

`workflow_next` のレスポンスには引き続き subagentTemplate が含まれる。next.ts の 597〜614 行では `resolvePhaseGuide` で取得した phaseGuide に対してプレースホルダー解決（taskName・taskId の置換）を行い、そのまま返している。削除処理は行われていない。

`workflow_status` のレスポンスでは status.ts の 127〜141 行でスリム化が行われるため、phaseGuide に subagentTemplate が含まれない状態で返される。

MEMORY.md の 80 行目には「`workflow_next` または `workflow_status` のレスポンスから `phaseGuide.subagentTemplate` を取得する」という記述がある。Fix 2 以降は `workflow_status` からは subagentTemplate が取得できないため、この記述は実態と乖離している。Orchestrator が MEMORY.md の記述に従って `workflow_status` から subagentTemplate を取得しようとした場合、取得に失敗してプロンプトを自力で構築するリスクがある。

### parallel_verification 他サブフェーズの重複行ガイダンス状況

parallel_verification の 4 サブフェーズを調査した結果、以下の状況が確認された。

security_scan テンプレートには Fix 1 で「評価結論フレーズに特化した注意事項」が追加されており、BUG-1・BUG-2 を識別子とした NG/OK 例が明示されている。複数の修正箇所を同一フォーマットで評価した場合の重複行エラーへの対策が施されている。

manual_test テンプレートには「重複行回避の注意事項」セクションが存在するが、内容はシナリオ番号付与による一意化を指示するものに留まっている。複数修正箇所の評価結論行が 3 件以上繰り返される問題に特化したガイダンスは含まれていない。

performance_test テンプレートには重複行回避に特化したセクションが存在しない。5 項目の記述を要求するガイダンスは充実しているが、複数修正箇所への評価結論フレーズ重複に対する警告が欠けている。

e2e_test テンプレートには「重複行回避の注意事項」セクションが存在し、シナリオ名を行に含めて一意化する NG/OK 例が示されている。ただし security_scan の Fix 1 で追加された評価結論フレーズ特化のガイダンスは含まれていない。

### buildRetryPrompt 関数の対処能力確認

`buildRetryPrompt` 関数（definitions.ts 1391〜1424 行）は 11 種類のエラーパターンを認識する設計になっている。確認した主要パターンは以下のとおりである。

同一行エラーパターン（「同一行」「Duplicate line」）を検出した場合、対処法 A（ラベルにシナリオ識別子を付加）と対処法 B（文章形式への変換）の 2 種類の改善指示を生成する。角括弧エラーと禁止パターンエラーについては retryCount が 2 以上の場合に `suggestModelEscalation: true` を返す設計になっている。

同一行エラーについては `shouldEscalateModel` 関数内で改善指示の配列長が 3 以上の場合にモデルエスカレーションを行うが、同一行パターンの改善指示は 4 件生成されるため retryCount が 2 以上でエスカレーション対象となる。

### workflow_next レスポンスサイズの残存問題

Fix 2 は `workflow_status` のみをスリム化したが、`workflow_next` は依然として subagentTemplate を含む全フィールドを返す。parallel_verification フェーズへ遷移する際に `workflow_next` が返す phaseGuide には 4 サブフェーズ分の subagentTemplate が全て含まれるため、レスポンスサイズが大きいまま残っている。

コミットメッセージには「parallel_verification 時のレスポンスサイズを約 62K 文字→約 10K 文字へ削減」と記載されているが、この削減は `workflow_status` を呼んだ場合の話であり、`workflow_next` のレスポンスサイズは削減されていない。Orchestrator が parallel_verification へ遷移する際に `workflow_next` を呼んだ場合、依然として大きなレスポンスを受け取ることになる。

### 影響ファイルの特定

今回の調査で特定した修正対象候補ファイルは以下のとおりである。
- `workflow-plugin/mcp-server/src/phases/definitions.ts` — manual_test・performance_test・e2e_test の subagentTemplate への NG/OK ガイダンス追加の必要性が確認された。
- `workflow-plugin/mcp-server/src/tools/next.ts` — workflow_next のレスポンスでも subagentTemplate のスリム化が必要かどうかの検討が必要な対象である。
- `C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md` — Fix 2 の副作用として subagentTemplate 取得手順の記述更新が必要な対象である。
