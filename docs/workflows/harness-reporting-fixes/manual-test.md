# Manual Test: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: manual_test
size: small

## テストシナリオ

### MT-S01: docs-onlyタスク開始時にtest_implでTDD Red免除が発動するか

目的: scopeFilesが.md/.mmdのみの場合にcheckTDDRedEvidenceがpassed:trueで免除されること
前提: dod-l1-l2.tsのcheckTDDRedEvidence関数にscopeFiles拡張子チェックが追加済み
手順:
1. dod-l1-l2.tsの82-88行を確認し、scopeFiles判定ブロックが存在することを目視確認
2. DOC_ONLY_EXTENSIONS定数(108行)に.mdと.mmdが定義されていることを確認
3. 免除時のevidenceに"TDD Red exempt: scopeFiles contain only documentation files"が含まれることを確認(87行)
4. scopeFilesが空配列またはundefinedの場合は免除ブロックに入らないことを論理的に確認(82行のlength > 0条件)
期待結果: scopeFilesが全て.md/.mmdの場合のみpassed:true、それ以外は既存ロジックにフォールスルー
AC対応: AC-1, AC-2

### MT-S02: テンプレートにユニーク制約文言が含まれるか

目的: ARTIFACT_QUALITY_RULESにユニーク行制約が明示されていること
前提: definitions-shared.tsのARTIFACT_QUALITY_RULES定数に制約文言が追記済み
手順:
1. definitions-shared.tsの26-30行を確認し、ARTIFACT_QUALITY_RULES定数の内容を目視確認
2. 28行に「各行の内容をユニークにすること」の文言が存在することを確認
3. 28行に「同一内容の行は最大2回まで」の閾値が記載されていることを確認
4. 28行に「3回以上出現でDoD L4失敗」のペナルティ条件が記載されていることを確認
期待結果: subagentがテンプレート経由でユニーク制約を認識可能な文言が存在する
AC対応: AC-3

### MT-S03: 変更対象ファイルの行数が200行以下であること

目的: プロジェクトの200行制限ポリシーへの準拠
前提: dod-l1-l2.tsとdefinitions-shared.tsに修正が適用済み
手順:
1. dod-l1-l2.tsの総行数を確認(178行、上限200行)
2. definitions-shared.tsの総行数を確認(136行、上限200行)
期待結果: 両ファイルとも200行以下
AC対応: AC-5

### MT-S04: 免除ロジックの境界条件が正しいか

目的: scopeFilesの拡張子判定が.md/.mmd以外の拡張子を免除しないこと
前提: DOC_ONLY_EXTENSIONS配列が['.md', '.mmd']のみであること
手順:
1. DOC_ONLY_EXTENSIONS(108行)の要素数が2であることを確認
2. allDocsOnly判定(83行)がevery()で全ファイルをチェックしていることを確認
3. extname()による拡張子取得がNode.jsのpath.extnameであることを確認(4行のimport)
4. .json, .yaml, .ts等の非ドキュメント拡張子がDOC_ONLY_EXTENSIONSに含まれていないことを確認
期待結果: .md/.mmd以外の拡張子が1つでも含まれればevery()がfalseを返し免除されない
AC対応: AC-2

## テスト結果

### MT-S01結果: docs-onlyタスクのTDD Red免除

結果: pass (MT-S01 scopeFiles免除ロジック検証)
検証内容: dod-l1-l2.tsの82-88行にscopeFiles拡張子チェックブロックが存在する。82行でstate.scopeFiles.length > 0を条件としており、空配列は免除ブロックに入らない。83行でevery()により全ファイルの拡張子がDOC_ONLY_EXTENSIONSに含まれるかを判定する。87行のevidenceに"TDD Red exempt: scopeFiles contain only documentation files (.md/.mmd)"が含まれ、免除理由と対象拡張子が明示される。scopeFilesにコードファイルが混在する場合はevery()がfalseを返し90行以降の既存ロジックにフォールスルーする。

### MT-S02結果: ユニーク制約文言の確認

結果: pass (MT-S02 ARTIFACT_QUALITY_RULES文言確認)
検証内容: definitions-shared.tsの28行にユニーク制約が存在する。具体的な文言は「各行の内容をユニークにすること（同一内容の行は最大2回まで。3回以上出現でDoD L4失敗）」であり、checkDuplicateLinesの閾値(3回以上で検出)と整合している。この文言はARTIFACT_QUALITY_RULES定数内に含まれており、subagentテンプレートに自動注入される。

### MT-S03結果: 行数制限の確認

結果: pass (MT-S03 両ファイル200行以下確認)
検証内容: dod-l1-l2.tsは178行(上限200行まで22行の余裕)。definitions-shared.tsは136行(上限200行まで64行の余裕)。両ファイルとも200行を大幅に下回っている。

### MT-S04結果: 境界条件の確認

結果: pass (MT-S04 拡張子境界条件検証)
検証内容: DOC_ONLY_EXTENSIONS配列は108行で['.md', '.mmd']の2要素のみ定義。Array.prototype.every()による全件チェックのため、scopeFiles内に1つでも非ドキュメント拡張子があれば免除されない。extname()はNode.jsのpath.extnameであり、ファイルパスの最後のドット以降を拡張子として返す標準的な動作。.json, .yaml, .ts等はDOC_ONLY_EXTENSIONSに含まれておらず、includes()がfalseを返す。

## decisions

- MT-001: MT-S01でコード目視確認とロジック追跡による検証を採用。自動テストTC-AC1-01/AC1-02/AC2-01/AC2-02で実行パスは網羅済みのため、手動テストではコード構造の妥当性確認に集中した。
- MT-002: MT-S02で定数の行番号を特定して文言を直接確認する方式を採用。テンプレートレンダリング経由の確認は自動テストTC-AC3-01でカバー済みであり、手動では注入元の正確性を確認した。
- MT-003: MT-S03で総行数のみを確認し、空行やコメント行の除外カウントは行わない方針とした。プロジェクトの200行制限は総行数ベースであり、acceptance-report.mdのTC-AC5-01と同一の計測基準を適用。
- MT-004: MT-S04を境界条件テストとして独立シナリオに分離した。AC-2の「既存ロジック維持」は自動テストで実行パスをカバーしているが、DOC_ONLY_EXTENSIONS配列の内容とevery()のセマンティクスは手動でのコード確認が有効であるため。
- MT-005: 全4シナリオをpassと判定。自動テスト(827テスト全パス)と手動コード確認の両面から、scopeFiles免除ロジックとユニーク制約注入が意図通りに動作していることを確認した。
- MT-006: テスト結果セクションに各シナリオの検証内容を詳細に記載した。抽象的な「確認した」ではなく、行番号と具体的なロジックの動作を記述することで再現性を確保した。

## artifacts

- docs/workflows/harness-reporting-fixes/manual-test.md: report: 手動テスト4シナリオ全pass、scopeFiles免除ロジックとユニーク制約注入の妥当性を確認

## next

- criticalDecisions: MT-001(コード構造確認に集中)、MT-004(境界条件の独立シナリオ化)
- readFiles: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts
- warnings: 行番号は現時点のコードに基づく。リファクタリングにより変動する場合がある。
