# Docs Update: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: docs_update

## decisions

- DU-001: CHANGELOG.mdの[Unreleased]セクションにharness-reporting-fixesの変更2件を追記する。理由: 本タスクはハーネスの振る舞いを変更する機能改善であり、変更履歴として記録が必要であるため。
- DU-002: docs/architecture/配下への新規ドキュメント追加は不要と判断。理由: 今回の変更はdod-l1-l2.tsへの条件追加とdefinitions-shared.tsへの文字列追記であり、アーキテクチャレベルの構造変更を伴わないため。
- DU-003: README.mdの更新は不要と判断。理由: README.mdはプロジェクト概要と利用手順を記載するファイルであり、内部DoDチェックロジックの免除条件やテンプレート文言の変更はエンドユーザーに影響しないため。
- DU-004: CHANGELOG.mdへの追記はAddedカテゴリとする。理由: P1(scopeFilesドキュメント免除ロジック)は新規条件分岐の追加、P2(ユニーク制約の明示)はテンプレートへの情報追加であり、既存動作の変更(Changed)ではなく新機能の付与に該当するため。
- DU-005: ADR新規作成は不要と判断。理由: 設計判断は全てrequirements.mdのD-001からD-006に記録済みであり、アーキテクチャ上の重要な方針転換を伴わないため永続ADRへの昇格は不要である。
- DU-006: docs/spec/配下やdocs/security/配下への追記も不要と判断。理由: セキュリティモデルや外部仕様への影響がなく、ハーネス内部のDoD判定ロジックに閉じた変更であるため。

## 更新内容

### CHANGELOG.md

[Unreleased]セクションのAddedカテゴリに以下を追記した:

#### harness-reporting-fixes: DoDチェック改善とテンプレート品質制約強化
- checkTDDRedEvidence関数にscopeFilesドキュメント免除ロジックを追加(dod-l1-l2.ts)。scopeFilesが全て.md/.mmdの場合、test_implフェーズでTDD Red証拠チェックをpassed:trueで免除する。DOC_ONLY_EXTENSIONS定数とpath.extnameによる拡張子判定を使用。
- ARTIFACT_QUALITY_RULESに全行ユニーク制約を明示追記(definitions-shared.ts)。同一内容の行は最大2回まで、3回以上出現でDoD L4失敗となる旨をsubagentテンプレートに伝達。

### 更新不要と判断したファイル

- docs/architecture/: アーキテクチャ構造の変更なし。既存モジュール内の条件分岐追加に留まる。
- README.md: エンドユーザー向け情報に影響なし。ハーネス内部ロジックの変更のみ。
- docs/spec/: 外部仕様への変更なし。
- docs/security/: セキュリティモデルへの影響なし。
- docs/adr/: 新規ADR作成の閾値に達しない。設計判断はworkflow成果物(requirements.md, planning.md)に記録済み。

## artifacts

- docs/workflows/harness-reporting-fixes/docs-update.md: docs: ドキュメント更新記録と判断根拠
- CHANGELOG.md: docs: [Unreleased]セクションにharness-reporting-fixes変更履歴を追記

## next

criticalDecisions: DU-001(CHANGELOG追記判断), DU-004(Addedカテゴリ選択)
readFiles: docs/workflows/harness-reporting-fixes/docs-update.md, CHANGELOG.md
warnings: CHANGELOG.mdへの実際の追記はこのドキュメント作成と同時に実施。追記内容は上記「更新内容」セクションの記載と一致する。
