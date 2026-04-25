## サマリー

本ドキュメントは、FR-5/FR-6/FR-7実装に必要なCLIインターフェース設計を定義します。
本タスクはGUIを持たないドキュメント修正タスクであるため、ここで設計するインターフェースはEdit/Readツールの呼び出しパターンと引数仕様です。

**目的:**
- FR-5（ルートCLAUDE.md修正）で使用する6回のEdit/Read呼び出しの引数仕様を設計します。
- FR-6（workflow-plugin/CLAUDE.md修正）で使用する6回のEdit/Read呼び出しの引数仕様を設計します。
- FR-7（整合性検証）で使用するRead呼び出しの検証観点と期待値を定義します。

**主要な決定事項:**
- Editツールの`old_string`には前後の行を含む複数行コンテキストを使用し、一意性を確保します。
- ルートCLAUDE.mdの修正は3回のEditツール呼び出し（FR-5-A / FR-5-B / FR-5-C）で完結します。
- workflow-plugin/CLAUDE.mdの修正も3回のEditツール呼び出し（FR-6-A / FR-6-B / FR-6-C）で完結します。
- 各Editツール呼び出しの前後にReadツール呼び出しによる事前確認・事後検証を配置します。

**次フェーズで必要な情報:**
- 各Edit呼び出しのold_string/new_stringの正確な文字列（本ドキュメントのCLIインターフェース設計セクションに記載）
- 事後検証で期待するフェーズ数（25行）と順序（definitions.tsのPHASE_SEQUENCE準拠）
- ファイルパスの絶対パス指定（C:\ツール\Workflow\CLAUDE.md / C:\ツール\Workflow\workflow-plugin\CLAUDE.md）

---

## CLIインターフェース設計

### 設計概要

本タスクで使用するツール呼び出しは、ReadツールとEditツールの2種類に限定されます。
Bashコマンドはreadonlyカテゴリのみ許可されているため、grepによる行数カウントは補助手段として使用できます。
すべての主要操作はファイル読み書きツールを経由し、適切な粒度のold_stringで一意性を担保します。

---

### FR-5用 Read呼び出し仕様（事前確認）

**呼び出し1: ルートCLAUDE.md事前確認**

```
Read({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  offset: 140,
  limit: 25
})
```

- 目的: ui_design行・test_design行・testing行・commit行・push行のold_string確認
- 期待する読み取り範囲: 141行目から165行目付近
- 確認観点: 5列構成のMarkdownテーブルであることと、各行の正確な文字列の一致

---

### FR-5用 Edit呼び出し仕様（FR-5-A: design_review挿入）

**呼び出し2: FR-5-A Edit操作**

```
Edit({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  old_string:
    "| ui_design | general-purpose | sonnet | spec.md | ui-design.md |\n" +
    "| test_design | general-purpose | sonnet | spec.md, *.mmd | test-design.md |",
  new_string:
    "| ui_design | general-purpose | sonnet | spec.md | ui-design.md |\n" +
    "| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | - |\n" +
    "| test_design | general-purpose | sonnet | spec.md, *.mmd | test-design.md |"
})
```

- 挿入位置: ui_design行（テーブル内）直後かつtest_design行直前
- old_stringの行数: 2行（ui_designとtest_designを前後コンテキストとして包含）
- new_stringの行数: 3行（中間にdesign_review行を追加）
- 一意性根拠: ui_designとtest_designが隣接している箇所はテーブル内に1箇所のみ

---

### FR-5用 Edit呼び出し仕様（FR-5-B: regression_test挿入）

**呼び出し3: FR-5-B Edit操作**

```
Edit({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  old_string:
    "| testing | general-purpose | haiku | - | - |\n" +
    "| manual_test | general-purpose | sonnet | - | manual-test.md |",
  new_string:
    "| testing | general-purpose | haiku | - | - |\n" +
    "| regression_test | general-purpose | haiku | テストスイート | - |\n" +
    "| manual_test | general-purpose | sonnet | - | manual-test.md |"
})
```

- 挿入位置: testing行直後かつmanual_test行直前
- old_stringの行数: 2行（testingとmanual_testを前後コンテキストとして包含）
- new_stringの行数: 3行（中間にregression_test行を追加）
- 一意性根拠: testingとmanual_testが隣接している箇所はテーブル内に1箇所のみ

---

### FR-5用 Edit呼び出し仕様（FR-5-C: ci_verificationとdeploy挿入）

**呼び出し4: FR-5-C Edit操作**

```
Edit({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  old_string:
    "| commit | general-purpose | haiku | - | - |\n" +
    "| push | general-purpose | haiku | - | - |\n" +
    "\n" +
    "### フェーズ別Bashコマンド許可カテゴリ",
  new_string:
    "| commit | general-purpose | haiku | - | - |\n" +
    "| push | general-purpose | haiku | - | - |\n" +
    "| ci_verification | general-purpose | haiku | CI/CD結果 | - |\n" +
    "| deploy | general-purpose | haiku | デプロイ設定 | - |\n" +
    "\n" +
    "### フェーズ別Bashコマンド許可カテゴリ"
})
```

- 挿入位置: push行直後かつ次セクションヘッダー直前
- old_stringの行数: 4行（commit・push・空行・次セクションヘッダーを包含）
- new_stringの行数: 6行（push行直後にci_verificationとdeployの2行を追加）
- 一意性根拠: 「push行 + 空行 + 次セクションヘッダー」の組み合わせは全ファイル内で1箇所のみ

---

### FR-5用 Read呼び出し仕様（事後検証）

**呼び出し5: ルートCLAUDE.md事後確認**

```
Read({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  offset: 140,
  limit: 32
})
```

- 目的: テーブルがヘッダー除く25行になったことを視覚的に確認します。
- 確認観点1: design_review行がui_design行とtest_design行の間に挿入されていること
- 確認観点2: regression_test行がtesting行とmanual_test行の間に挿入されていること
- 確認観点3: ci_verification行とdeploy行がpush行直後に存在すること
- 期待するフェーズ順序: research→requirements→threat_modeling→planning→state_machine→flowchart→ui_design→design_review→test_design→test_impl→implementation→refactoring→build_check→code_review→testing→regression_test→manual_test→security_scan→performance_test→e2e_test→docs_update→commit→push→ci_verification→deploy（計25フェーズ）

---

### FR-6用 Read呼び出し仕様（事前確認）

**呼び出し6: workflow-plugin/CLAUDE.md事前確認**

```
Read({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  offset: 178,
  limit: 30
})
```

- 目的: ui_design行・test_design行・testing行・commit行・push行のold_string確認
- 期待する読み取り範囲: 179行目から208行目付近
- 確認観点: 6列構成のMarkdownテーブルであることと、「入力ファイル重要度」列の存在確認
- 6列構成の確認方法: テーブルヘッダー行に「フェーズ | subagent_type | model | 入力ファイル | 入力ファイル重要度 | 出力ファイル」の6列が含まれることを確認

---

### FR-6用 Edit呼び出し仕様（FR-6-A: design_review挿入）

**呼び出し7: FR-6-A Edit操作**

```
Edit({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  old_string:
    "| ui_design | general-purpose | sonnet | spec.md | 全文 | ui-design.md |\n" +
    "| test_design | general-purpose | sonnet | spec.md (全文), *.mmd (全文) | 全文 | test-design.md |",
  new_string:
    "| ui_design | general-purpose | sonnet | spec.md | 全文 | ui-design.md |\n" +
    "| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | 高 | - |\n" +
    "| test_design | general-purpose | sonnet | spec.md (全文), *.mmd (全文) | 全文 | test-design.md |"
})
```

- 挿入位置: workflow-plugin/CLAUDE.mdのui_design行直後かつtest_design行直前
- 入力ファイル重要度値: 「高」（設計レビューは後続フェーズ全体の方向性を決定するため全文読み込みが必須）
- new_stringの列数: 6列構成（FR-6固有の「入力ファイル重要度」列を含む。FR-5との差異点）
- 一意性根拠: workflow-plugin/CLAUDE.md内でui_designとtest_designが隣接する箇所は1箇所のみ

---

### FR-6用 Edit呼び出し仕様（FR-6-B: regression_test挿入）

**呼び出し8: FR-6-B Edit操作**

```
Edit({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  old_string:
    "| testing | general-purpose | haiku | test-design.md (全文), implementation成果物 (全文), spec.md (サマリー), requirements.md (参照) | 全文/サマリー/参照 | - |\n" +
    "| manual_test | general-purpose | sonnet | - | - | manual-test.md |",
  new_string:
    "| testing | general-purpose | haiku | test-design.md (全文), implementation成果物 (全文), spec.md (サマリー), requirements.md (参照) | 全文/サマリー/参照 | - |\n" +
    "| regression_test | general-purpose | haiku | テストスイート (サマリー) | 中 | - |\n" +
    "| manual_test | general-purpose | sonnet | - | - | manual-test.md |"
})
```

- 挿入位置: workflow-plugin/CLAUDE.mdのtesting行直後かつmanual_test行直前
- 入力ファイル重要度値: 「中」（ベースライン差分比較が主目的のため全文読み込み不要）
- new_stringの列数: 6列構成（「入力ファイル重要度」列に「中」を設定。FR-5では存在しない列）
- 一意性根拠: testing行のold_stringは入力ファイル列が長い一意の文字列を含むため、誤マッチは発生しない

---

### FR-6用 Edit呼び出し仕様（FR-6-C: ci_verificationとdeploy挿入）

**呼び出し9: FR-6-C Edit操作**

```
Edit({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  old_string:
    "| commit | general-purpose | haiku | - | - | - |\n" +
    "| push | general-purpose | haiku | - | - | - |\n" +
    "\n" +
    "### subagent起動テンプレート",
  new_string:
    "| commit | general-purpose | haiku | - | - | - |\n" +
    "| push | general-purpose | haiku | - | - | - |\n" +
    "| ci_verification | general-purpose | haiku | CI/CD結果 | 低 | - |\n" +
    "| deploy | general-purpose | haiku | デプロイ設定 | 低 | - |\n" +
    "\n" +
    "### subagent起動テンプレート"
})
```

- 挿入位置: workflow-plugin/CLAUDE.mdのpush行直後かつsubagent起動テンプレートセクション直前
- ci_verificationの入力ファイル重要度値: 「低」（CI結果確認が主目的のため詳細参照は不要）
- deployの入力ファイル重要度値: 「低」（デプロイ実行が主目的のため詳細参照は不要）
- new_stringの列数: 6列構成（FR-5-Cの4列目に列がないのと異なり、FR-6-Cでは重要度列「低」を明示）
- 一意性根拠: 「push行 + 空行 + subagent起動テンプレートヘッダー」の組み合わせは全ファイル内で1箇所のみ

---

### FR-6用 Read呼び出し仕様（事後検証）

**呼び出し10: workflow-plugin/CLAUDE.md事後確認**

```
Read({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  offset: 178,
  limit: 35
})
```

- 目的: テーブルがヘッダー除く25行になり、全行が6列構成であることを確認します。
- 確認観点1: design_review行の「入力ファイル重要度」列値が「高」であること
- 確認観点2: regression_test行の「入力ファイル重要度」列値が「中」であること
- 確認観点3: ci_verification行とdeploy行の「入力ファイル重要度」列値がいずれも「低」であること

---

## エラーメッセージ設計

### エラーパターン1: old_stringが見つからない場合

**Editツールのエラーメッセージ:**
```
Error: old_string not found in file
```

**原因と対処方針:**
- ファイルがReadツールで事前読み込みされていない場合に発生する可能性があります。
  この場合は、まずReadツールでファイルを読み込んでから再度Editツールを呼び出します。
- old_stringの改行コードがファイルの実際の改行コードと異なる場合にも発生します。
  WindowsのCRLF環境では、old_string内の改行が\nのみで指定されていても、Editツールは内部で正規化するため通常は問題になりません。
- old_stringが古いバージョンのファイル内容に基づいている場合、事前確認時の読み取り結果と実際のファイルを照合します。
  具体的には、Read呼び出しの結果と仕様書記載のold_stringを行単位で比較します。

---

### エラーパターン2: old_stringが複数箇所で一致する場合

**Editツールのエラーメッセージ:**
```
Error: old_string is not unique in file
```

**原因と対処方針:**
- 単一行のold_stringのみを指定した場合に、テーブル内で同一の行が複数存在すると発生します。
  たとえば `| - | - | - |` のような汎用的な行パターンは複数箇所に存在しえます。
- 本設計では、old_stringに前後の行（コンテキスト行）を包含することで一意性を確保しています。
  FR-5-C、FR-6-Cではさらに次セクションヘッダー行をold_stringに含めることで完全な一意性を担保します。
- 万が一エラーが発生した場合は、old_stringに追加行（さらに前後の行）を加えて一意性を高めます。

---

### エラーパターン3: ファイルが予期せず変更されている場合

**Write/Editツールのエラーメッセージ:**
```
Error: File has been unexpectedly modified
```

**原因と対処方針:**
- task-index.jsonの書き換え競合や、バックグラウンドプロセスによるファイル変更が原因となります。
  CLAUDE.mdやworkflow-plugin/CLAUDE.mdは通常こうした競合は発生しませんが、念のため対処方針を記載します。
- エラー発生時は、Readツールで最新のファイル内容を再確認します。
  最新内容を確認した上で、old_stringを現在のファイル内容に合わせて更新し、Editツールを再実行します。
- FR-5-A→FR-5-B→FR-5-Cの順序でEditを実行する場合、FR-5-A完了後のファイルを読み込まずにFR-5-Bを実行すると、FR-5-Bのold_stringが最新状態に合わなくなることがあります。
  各Editツール呼び出し後には、次のEdit実行前に読み込みキャッシュが最新であることをReadツールで確認することを推奨します。

---

## APIレスポンス設計

### workflow_complete_sub の成功時レスポンス

parallel_verificationフェーズの各サブフェーズが完了した場合、workflow_complete_subは以下の形式のレスポンスを返します。

```json
{
  "success": true,
  "taskId": "<タスクID>",
  "subPhase": "<完了したサブフェーズ名>",
  "message": "サブフェーズ '<サブフェーズ名>' が完了しました",
  "allSubPhasesComplete": false
}
```

- `allSubPhasesComplete`がtrueになった時点で、全サブフェーズが完了したことを示します。
- この場合はworkflow_nextを呼び出して次のフェーズに進むことができます。
- サブフェーズ名は「threat_modeling」「planning」「state_machine」「flowchart」「ui_design」等のキャメルケース/スネークケースの文字列です。

---

### workflow_complete_sub の失敗時レスポンス

成果物バリデーションが失敗した場合、workflow_complete_subは以下の形式のレスポンスを返します。

```json
{
  "success": false,
  "taskId": "<タスクID>",
  "subPhase": "<サブフェーズ名>",
  "validationErrors": [
    "必須セクション '## テストシナリオ' が見つかりません",
    "行数が不足しています: 現在32行、必要50行以上"
  ],
  "message": "成果物のバリデーションに失敗しました"
}
```

- `validationErrors`配列に具体的なエラー内容が格納されます。
- Orchestratorはこのエラーを受け取った場合、成果物をEdit/Writeで直接修正せずにsubagentを再起動します。
- リトライ時のプロンプトには、validationErrorsの内容を「前回のバリデーション失敗理由」として引用します。

---

### workflow_next の成功時レスポンス

フェーズ移行が成功した場合、workflow_nextは以下の形式のレスポンスを返します。

```json
{
  "success": true,
  "taskId": "<タスクID>",
  "previousPhase": "<前のフェーズ名>",
  "currentPhase": "<新しいフェーズ名>",
  "message": "フェーズが '<前フェーズ>' から '<現フェーズ>' に移行しました"
}
```

- `currentPhase`が次に実行すべきフェーズを示します。
- 並列フェーズ（parallel_analysis等）の場合は、currentPhaseに並列フェーズ名が設定されます。
- Orchestratorはcurrentフェーズに対応するsubagentをTask toolで起動します。

---

### workflow_next のバリデーション失敗時レスポンス

成果物バリデーション失敗によりフェーズ移行がブロックされた場合のレスポンスです。

```json
{
  "success": false,
  "taskId": "<タスクID>",
  "currentPhase": "<現在のフェーズ名>",
  "validationErrors": [
    "成果物ファイルが見つかりません: docs/workflows/<タスク名>/ui-design.md",
    "禁止語が検出されました: 該当パターン (行23)"
  ],
  "message": "フェーズ移行が成果物バリデーション失敗によりブロックされました"
}
```

- この場合もOrchestratorはsubagentを再起動してリトライします。
- validationErrorsに禁止語・行数不足・必須セクション欠落等の情報が含まれます。
- Orchestratorが連続して同じエラーを受け取る場合は、成果物を読み込んで問題箇所を特定し、行番号レベルの修正指示をリトライプロンプトに含めます。

---

## 設定ファイル設計

### ルートCLAUDE.mdの修正前テーブル構造（5列、21行）

修正前のフェーズ別subagent設定テーブルのヘッダー行は5列で構成されています。
このテーブルにはdesign_review・regression_test・ci_verification・deployの4フェーズが欠落した不完全な状態です。

```
| フェーズ | subagent_type | model | 入力ファイル | 出力ファイル |
|---------|---------------|-------|-------------|-------------|
| research | Explore | haiku | - | research.md |
| requirements | general-purpose | sonnet | research.md | requirements.md |
| threat_modeling | general-purpose | sonnet | requirements.md | threat-model.md |
| planning | general-purpose | sonnet | requirements.md | spec.md |
| state_machine | general-purpose | haiku | spec.md | state-machine.mmd |
| flowchart | general-purpose | haiku | spec.md | flowchart.mmd |
| ui_design | general-purpose | sonnet | spec.md | ui-design.md |
（design_review が欠落している）
| test_design | general-purpose | sonnet | spec.md, *.mmd | test-design.md |
| test_impl | general-purpose | sonnet | test-design.md | *.test.ts |
| implementation | general-purpose | sonnet | *.test.ts | *.ts |
| refactoring | general-purpose | haiku | *.ts | *.ts |
| build_check | Bash | haiku | - | - |
| code_review | general-purpose | sonnet | *.ts | code-review.md |
| testing | general-purpose | haiku | - | - |
（regression_test が欠落している）
| manual_test | general-purpose | haiku | - | manual-test.md |
| security_scan | Bash | haiku | - | security-scan.md |
| performance_test | Bash | haiku | - | performance-test.md |
| e2e_test | Bash | haiku | - | e2e-test.md |
| docs_update | general-purpose | haiku | 全成果物 | ドキュメント |
| commit | Bash | haiku | - | - |
| push | Bash | haiku | - | - |
（ci_verification と deploy が欠落している）
```

データ行総数は21行であり、4フェーズが欠落した不完全な状態です。
欠落フェーズはdesign_review・regression_test・ci_verification・deployの4フェーズです。

---

### ルートCLAUDE.mdの修正後テーブル構造（5列、25行）

FR-5適用後のテーブルは以下の25行（ヘッダー除く）となります。
ルートCLAUDE.mdは5列構成であり、workflow-plugin/CLAUDE.mdとは列数が異なる点が重要です。

```
| フェーズ | subagent_type | model | 入力ファイル | 出力ファイル |
|---------|---------------|-------|-------------|-------------|
| research | Explore | haiku | - | research.md |
| requirements | general-purpose | sonnet | research.md | requirements.md |
| threat_modeling | general-purpose | sonnet | requirements.md | threat-model.md |
| planning | general-purpose | sonnet | requirements.md | spec.md |
| state_machine | general-purpose | haiku | spec.md | state-machine.mmd |
| flowchart | general-purpose | haiku | spec.md | flowchart.mmd |
| ui_design | general-purpose | sonnet | spec.md | ui-design.md |
| design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | - |
| test_design | general-purpose | sonnet | spec.md, *.mmd | test-design.md |
| test_impl | general-purpose | sonnet | test-design.md | *.test.ts |
| implementation | general-purpose | sonnet | *.test.ts | *.ts |
| refactoring | general-purpose | haiku | *.ts | *.ts |
| build_check | Bash | haiku | - | - |
| code_review | general-purpose | sonnet | *.ts | code-review.md |
| testing | general-purpose | haiku | - | - |
| regression_test | general-purpose | haiku | テストスイート | - |
| manual_test | general-purpose | haiku | - | manual-test.md |
| security_scan | Bash | haiku | - | security-scan.md |
| performance_test | Bash | haiku | - | performance-test.md |
| e2e_test | Bash | haiku | - | e2e-test.md |
| docs_update | general-purpose | haiku | 全成果物 | ドキュメント |
| commit | Bash | haiku | - | - |
| push | Bash | haiku | - | - |
| ci_verification | general-purpose | haiku | CI/CD結果 | - |
| deploy | general-purpose | haiku | デプロイ設定 | - |
```

データ行総数は25行であり、definitions.tsのPHASE_GUIDESと完全に一致します。
修正は行8（design_review挿入）・行16（regression_test挿入）・行24〜25（ci_verification・deploy挿入）の3箇所です。

---

### workflow-plugin/CLAUDE.mdの修正前テーブル構造（6列、21行）

ルートCLAUDE.mdとの最大の差異は「入力ファイル重要度」列の追加（6列構成）です。
この6列目はsubagentに対して各フェーズでの入力ファイル読み込み粒度を示す、ルートCLAUDE.mdにはない固有の列です。

```
| フェーズ | subagent_type | model | 入力ファイル | 入力ファイル重要度 | 出力ファイル |
|---------|---------------|-------|-------------|-----------------|-------------|
（21フェーズのデータ行）
（design_review・regression_test・ci_verification・deployが欠落）
```

6列構成のため、追記行はすべてパイプ区切り7セグメントで記述する必要があります。
5列のテーブル行を誤って追記するとMarkdownパーサーが正常に解釈できないため、列数の一致確認が必須です。
修正前の状態では21行のデータ行に対して4フェーズが欠落しており、NFR-3の整合性要件を満たしていません。

---

### workflow-plugin/CLAUDE.mdの修正後テーブル構造（6列、25行）

FR-6適用後のテーブルは以下の25行（ヘッダー除く）となります。
全行が6列構成を維持し、ルートCLAUDE.mdの修正後テーブルとフェーズ数・順序が一致します。

```
| フェーズ | subagent_type | model | 入力ファイル | 入力ファイル重要度 | 出力ファイル |
|---------|---------------|-------|-------------|-----------------|-------------|
（既存21行はそのまま維持）
（行8: design_review | general-purpose | sonnet | state-machine.mmd, flowchart.mmd, ui-design.md | 高 | - |）
（行16: regression_test | general-purpose | haiku | テストスイート (サマリー) | 中 | - |）
（行24: ci_verification | general-purpose | haiku | CI/CD結果 | 低 | - |）
（行25: deploy | general-purpose | haiku | デプロイ設定 | 低 | - |）
```

各追記行の「入力ファイル重要度」列の値は、フェーズの性質から論理的に導出されています。
design_reviewは後続フェーズ全体への影響が大きいため「高」とし、regression_testはベースライン差分確認が主目的のため「中」とします。
ci_verificationとdeployはいずれも参照ではなく実行が主目的のため「低」とし、詳細読み込みを不要と判断します。
修正後の25行はルートCLAUDE.mdの修正後テーブルとフェーズ数・フェーズ順序が完全に一致し、NFR-3の整合性要件を満たします。
