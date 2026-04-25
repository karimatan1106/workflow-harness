phase: threat_modeling
task: workflow-harness-refactoring-v2
status: complete

## decisions

- TM-1: Area5 approve/advancePhase分離による行動変更リスク。harness_approveが承認のみ実行しadvancePhaseを呼ばなくなるため、呼び出し側が明示的にadvancePhaseを実行しないとフェーズが進まない。対策: 分離後のintegrationテストで「approve後にadvancePhase未呼び出し時フェーズが変わらないこと」と「approve+advancePhase呼び出し時フェーズが進むこと」の両方を検証する。
- TM-2: Area3 importパス変更の波及。mcp-server/src/の4ファイル分割で相対importパスが変わり、9ファイルに影響。対策: TypeScript compilerがimport解決エラーを検出する。tsc --noEmitをCI相当チェックとして分割後に実行。
- TM-3: Area2+3 defs-stage1.tsへの直列依存。serena-query.py削除とmcp-server分割が同じdefs-stage1.tsに依存するため、並列作業でコンフリクトする。対策: Area2(削除)を先に完了しコミット後、Area3(分割)に着手する直列実行順序を強制。
- TM-4: Area1 tool-gate.js分割によるhook enforcement破壊。phase-config.js抽出時にexportシグネチャが変わるとhookが正しくツール制限を判定できなくなる。対策: 分割前に既存hook testを実行しベースライン取得、分割後に同一テストがパスすることを確認。tool-gate.jsのpublic APIは維持し、内部でphase-config.jsをrequireする構造にする。
- TM-5: Area1 hook-utils.jsへのJSON.parse集約で例外ハンドリング差異が発生。各hookが個別にJSON.parseしていた箇所のエラーハンドリングが統一されることで、従来と異なるexit codeを返す可能性。対策: hook-utils.jsのparseJSON関数は呼び出し元のexit code規約を保持するよう、エラー時のexit codeを引数で受け取る設計にする。
- TM-6: Area4 stale references更新漏れ。skills/内の参照先がリネーム後のパスに更新されないと、LLMが古いパスを参照して失敗する。対策: 分割対象ファイルの旧パスでGrep検索し、全参照箇所を洗い出してから更新する。更新後に再度Grepして残存参照ゼロを確認。
- TM-7: Area4 forbidden word list重複削除で定義漏れ。どちらのリストを正とするか判断を誤ると禁止語が欠落する。対策: 削除前に両リストをdiffし、和集合を残す側に反映してから重複側を削除する。

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/threat-model.md, report, 脅威分析と対策

## next

criticalDecisions: TM-1(approve分離は行動変更を伴う最高リスク), TM-3(直列依存の実行順序)
readFiles: workflow-harness/hooks/tool-gate.js, workflow-harness/mcp-server/src/defs-stage1.ts, workflow-harness/skills/
warnings: Area5のapprove分離は既存のオーケストレーター呼び出しパターンに影響するため、分離後の呼び出し規約をスキルファイルに明記すること
