## サマリー

- 目的: Fix 1（security_scan テンプレート拡充）および Fix 2（workflow_status レスポンス最適化）の副作用として判明した 3 つの問題を解消する要件を定義する。
- 主要な決定事項: 問題 A は MEMORY.md の記述を実態に合わせて更新することで解消する。問題 B は workflow_next のレスポンスからもサブフェーズ subagentTemplate を除外し、Orchestrator が必要な時点で workflow_status から個別取得できる設計に変更することで解消する。問題 C は manual_test・performance_test・e2e_test の各テンプレートに security_scan と同様の評価結論フレーズ重複回避ガイダンスを追加することで解消する。
- 次フェーズで必要な情報: 3 問題それぞれの修正対象ファイル（MEMORY.md、next.ts、definitions.ts）と修正方針を本要件定義書から引き継ぐ。

---

## 機能要件

### FR-1: MEMORY.md の subagentTemplate 取得手順の更新（問題 A への対応）

Fix 2 の実施により、workflow_status のレスポンスからは subagentTemplate が除外されるようになった。
しかし MEMORY.md には「workflow_next または workflow_status のレスポンスから subagentTemplate を取得する」という記述が残っており、実態と乖離している。
Orchestrator がこの記述を信頼して workflow_status から subagentTemplate を取得しようとすると、取得に失敗してプロンプトを独自に構築するリスクが生じる。

修正内容は以下のとおりである。
- MEMORY.md の該当箇所（「workflow_next または workflow_status のレスポンスから」という記述）を「workflow_next のレスポンスから」に限定した表現に書き換える。
- workflow_status から取得できる情報はスリムガイド（フェーズ名・必須セクション・最低行数等）のみであることを注釈として明記する。
- Orchestrator がフェーズ遷移後に最初に呼ぶべきは workflow_next であり、そのレスポンスから subagentTemplate を取得する手順を明確化する。

### FR-2: workflow_next レスポンスのサブフェーズ subagentTemplate スリム化（問題 B への対応）

Fix 2 は workflow_status に対してのみスリム化処理を行ったため、workflow_next のレスポンスサイズは削減されていない。
parallel_verification フェーズへの遷移時に workflow_next を呼ぶと、4 サブフェーズ分の subagentTemplate が全て含まれた状態で返されるため、依然として約 61K 文字程度のレスポンスになる。

修正内容は以下のとおりである。
- next.ts の phaseGuide 構築処理において、subPhases 内の各サブフェーズから subagentTemplate・content・claudeMdSections を除外するスリム化処理を追加する。
- ただしトップレベルの phaseGuide（現フェーズ自身）の subagentTemplate は除外しない。Orchestrator は遷移後のフェーズの subagentTemplate を workflow_next から取得する必要があるためである。
- この変更により、parallel_verification 遷移時の workflow_next レスポンスサイズを大幅に削減できる。サブフェーズ個別の subagentTemplate が必要な場合は workflow_status を呼ぶことで取得可能にする設計とする。
- 変更の後方互換性を維持するため、削除するのはサブフェーズレベルの subagentTemplate のみとし、現フェーズの subagentTemplate は削除しない。

### FR-3: manual_test / performance_test テンプレートへの評価結論フレーズ重複回避ガイダンス追加（問題 C への対応）

security_scan テンプレートには Fix 1 で評価結論フレーズ重複回避の NG/OK 例が追加されているが、manual_test および performance_test には同等のガイダンスが存在しない。
複数のテストシナリオや修正箇所に対して同一フォーマットで結論を記述した場合、バリデーターの重複行検出によりエラーが発生するリスクが残存している。

修正内容は以下のとおりである。
- definitions.ts の manual_test subagentTemplate に、security_scan と同様の「評価結論フレーズに特化した注意事項」セクションを追加する。シナリオ番号と操作名を行に含めて一意化する NG/OK 例を明示する。
- definitions.ts の performance_test subagentTemplate に、計測結果行が複数の計測対象で同一フォーマットになる場合の重複回避ガイダンスを追加する。計測対象名や条件名を行に含めて一意化する NG/OK 例を明示する。
- e2e_test テンプレートには既存の重複行回避セクションが存在するが、security_scan の Fix 1 と同様の評価結論フレーズ特化のガイダンスが不足している。同様の補強を行う。

---

## 非機能要件

### NFR-1: 後方互換性の維持

workflow_next が返す現フェーズの subagentTemplate は引き続き提供する。
Orchestrator の標準フローは「workflow_next でフェーズ遷移 → レスポンスの subagentTemplate を Task プロンプトに使用」であり、このフローは変更しない。
スリム化の対象は parallel_*フェーズ遷移時に不要となるサブフェーズ側の subagentTemplate のみとする。
既存の Orchestrator コードがフェーズ遷移直後に subagentTemplate を参照するパターンは引き続き動作する。

### NFR-2: ビルド・再起動の必須化

definitions.ts および next.ts はコアモジュールに該当するため、修正後は必ず npm run build を実施してトランスパイルを完了させる。
MCP サーバーのプロセスを再起動しないと変更がキャッシュに反映されない仕組みになっているため、ビルド後に必ず再起動を行う。
MEMORY.md の修正はランタイムに影響しないためビルドは不要だが、Orchestrator が次回以降の会話で正しい手順を参照できるよう修正を確実に保存する。

### NFR-3: レスポンスサイズ削減の定量目標

workflow_next のレスポンスサイズについて、parallel_verification 遷移時に 15K 文字以下を目標とする。
Fix 2 によって workflow_status は約 10K 文字に削減されており、workflow_next も同程度の規模に抑えることが望ましい。
サブフェーズが 4 件存在する parallel_verification が最もサイズが大きくなるフェーズであるため、このフェーズを基準に削減効果を評価する。

### NFR-4: バリデーション要件の整合性維持

テンプレートへのガイダンス追加は既存のバリデーターの検出ロジックを変更しない。
追加するガイダンスは成果物の書き方に関する指示であり、バリデーションルール自体は artifact-validator.ts の定義に従う。
ガイダンス追加後も既存の重複行検出ルール（3 回以上同一行でエラー）は変更されないことを確認する。
