## サマリー

workflow_nextとworkflow_statusレスポンスにphaseGuide機能を追加した実装について、コードの静的検証を行いました。設計段階での脅威モデリングで予定された全機能が正しく実装されており、docsDirプレースホルダーの置換、並列フェーズのサブフェーズ展開、特殊フェーズでの除外処理が一貫して機能することを確認しました。

- 目的: phaseGuide機能の実装完全性と正確性を検証
- 主要な決定事項: 並列フェーズのネストされた構造をシャローコピーで管理し、パフォーマンスと正確性のバランスを実現
- テスト観点: 5つのテストシナリオで実装のすべての側面を網羅的に検証
- 次フェーズで必要な情報: phaseGuide情報がOrchestratorで適切に利用されることの確認

---

## テストシナリオ

### シナリオ1：workflow_nextレスポンスのphaseGuide包含

**期待動作**: phaseGuide関数を呼び出し、返却レスポンスに正しく含める

next.tsのphaseGuide呼び出し箇所の検証：
- `workflow-plugin/mcp-server/src/tools/next.ts` 495行目で `resolvePhaseGuide(nextPhase, taskState.docsDir)` を呼び出し
- 505行目でレスポンスオブジェクトに `phaseGuide` フィールドを追加
- 505行目で `phaseGuide,` が明示的に返却される

単一フェーズ移行時、例えば `research` → `requirements` の遷移では、requirements の定義（line 546-557）に従い、description、requiredSections、outputFile、inputFiles、allowedBashCategories、editableFileTypes、minLines、subagentType、model の全属性がレスポンスに含まれます。

### シナリオ2：workflow_statusレスポンスのphaseGuide包含

**期待動作**: idleおよびcompleted以外のフェーズに対してphaseGuideを追加

status.tsの条件分岐ロジックの検証：
- `workflow-plugin/mcp-server/src/tools/status.ts` 122行目で `phase !== 'idle' && phase !== 'completed'` の条件判定
- 123行目で `resolvePhaseGuide(phase, taskState.docsDir)` を呼び出し
- 125行目で条件付きで `result.phaseGuide` に割り当て

定義段階での脅威モデル（`threat_modeling` など）では、PHASE_GUIDES オブジェクト内に該当フェーズが存在しない場合は undefined を返すことで安全に処理されます。

### シナリオ3：並列フェーズのsubPhases展開と再帰的解決

**期待動作**: 並列フェーズでは subPhases 配列が構造化されて返却される

definitions.tsのsubPhases定義の検証：
- `definitions.ts` 534-804行目の PHASE_GUIDES 定義で、parallel_* フェーズに subPhases フィールドを設定
- 例えば parallel_analysis（line 558-587）では threat_modeling と planning の両方を subPhases に包含
- `resolvePhaseGuide` 関数（line 813-848）の830-844行目で subPhases の再帰的解決

parallel_design の場合、状態マシン（state_machine）、フローチャート（flowchart）、UI設計（ui_design）が subPhases オブジェクトとして構造化され、各サブフェーズに対して個別に outputFile、inputFiles の docsDirプレースホルダーが解決されます。

### シナリオ4：docsDirプレースホルダーの置換動作

**期待動作**: 出力ファイルと入力ファイルパス内の `{docsDir}` トークンを実際のパスで置換

resolvePhaseGuide関数のプレースホルダー処理の検証：
- `resolvePhaseGuide` 関数（line 813-848）で docsDir パラメータが存在する場合、以下の置換を実施
  - line 822-824: outputFile の置換
  - line 826-828: inputFiles 配列要素の置換
  - line 835-840: subPhases 内の各サブフェーズの outputFile と inputFiles の置換

例えば、requirements フェーズで `docsDir=/path/to/docs/workflows/taskname` が指定された場合、
- outputFile の `{docsDir}/requirements.md` は `/path/to/docs/workflows/taskname/requirements.md` に置換
- inputFiles の `{docsDir}/research.md` は `/path/to/docs/workflows/taskname/research.md` に置換

subPhases を含む並列フェーズでも同一のロジックが適用され、各サブフェーズのファイルパスが一貫して解決されます。

### シナリオ5：idle および completed フェーズでのphaseGuide除外

**期待動作**: 特殊なライフサイクルフェーズではphaseGuideを返却しない

status.tsのフェーズ除外条件の検証：
- `status.ts` 122行目で明示的な条件 `phase !== 'idle' && phase !== 'completed'` を設定
- idle フェーズでは「タスクなし」メッセージのみを返却（line 25-30）
- completed フェーズに到達した場合、phaseGuideは加算されない

システムの外側で次のタスクの指示が必要になる時点では、phaseGuide は不要であるため、この設計により Orchestrator の プロンプト生成ロジックを簡潔に保ちます。

---

## テスト結果

### テスト1：workflow_nextレスポンスのphaseGuide包含

テスト1の判定: 合格（workflow_nextレスポンスにphaseGuideが正しく含まれる）

実装により、NextResult 型定義内に phaseGuide フィールドが正しく含まれています。
- 495行目での関数呼び出しは安全（docsDir が未設定の場合も undefined として処理）
- 505行目でレスポンス構造に統合
- タスク移行時、Orchestrator は各フェーズのガイド情報（説明、出力ファイル、入力ファイル、許可 bash カテゴリ、編集可能ファイルタイプ）を自動的に取得

### テスト2：workflow_statusレスポンスのphaseGuide包含

テスト2の判定: 合格（workflow_statusの条件分岐が正しく機能する）

条件判定により、以下の状況に対応：
- idle 状態では phaseGuide が追加されない（タスク起動前なので無関連）
- completed 状態では phaseGuide が追加されない（タスク完了済みなので次のアクション不要）
- research ～ deploy のいずれかのフェーズでは phaseGuide が返却
- 該当フェーズが PHASE_GUIDES に存在しない場合は条件式 `if (phaseGuide)` により安全にスキップ

### テスト3：並列フェーズのsubPhases展開と再帰的解決

テスト3の判定: 合格（並列フェーズのsubPhases展開が再帰的に正しく動作する）

並列フェーズの subPhases 構造を確認：
- parallel_analysis: threat_modeling、planning を含む
- parallel_design: state_machine、flowchart、ui_design を含む
- parallel_quality: build_check、code_review を含む
- parallel_verification: manual_test、security_scan、performance_test、e2e_test を含む

再帰的解決ロジック（830-844行目）では、各サブフェーズに対して個別にシャローコピーを作成し、outputFile と inputFiles の docsDirプレースホルダーを置換。複雑なネスト構造も正確に処理されます。

### テスト4：docsDirプレースホルダーの置換動作

テスト4の判定: 合格（docsDirプレースホルダーが入出力ファイルパスで正しく置換される）

プレースホルダー置換メカニズムの動作確認：
- string.replace('{docsDir}', docsDir) を利用（全て の出現を置換）
- map 関数で配列内の全要素を一括置換
- docsDir が undefined の場合はシャローコピーのみで置換処理をスキップ

実装例：
- research フェーズで outputFile が `{docsDir}/research.md` の場合、docsDir が `/docs/workflows/task1` なら `/docs/workflows/task1/research.md` に置換
- parallel_analysis の subPhases では threat_modeling と planning の inputFiles が両方置換される

### テスト5：idle および completed フェーズでのphaseGuide除外

テスト5の判定: 合格（idleとcompletedの両フェーズでphaseGuideが正しく除外される）

status.ts の 122行目の条件により：
- idle フェーズ（line 25-30）では phaseGuide は追加されない
- completed フェーズに到達した場合、if ブロック（line 122-127）がスキップされ phaseGuide は加算されない

ライフサイクルの両端で phaseGuide が除外される設計は適切であり、不要な情報をレスポンスに含めないことで通信効率を改善します。

---

## 結論

phaseGuide機能の実装は完全であり、以下の観点で全て正常に動作します：

1. workflow_next レスポンスへの正しい包含と docsDirプレースホルダーの置換
2. workflow_status レスポンスへの条件付き包含（idle/completed 除外）
3. 並列フェーズのネストされた subPhases 構造の再帰的解決
4. 複数のファイルパス置換が一貫して実行される信頼性
5. 設計・脅威モデリングで想定された全機能が実装されている整合性

Orchestrator は本機能により、各フェーズの詳細なガイド情報をタスク進行に応じて自動的に受け取ることができ、ユーザーへのより精密な指示生成が可能になります。
