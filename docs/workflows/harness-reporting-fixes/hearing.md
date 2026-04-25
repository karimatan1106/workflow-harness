# Hearing: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: hearing
date: 2026-03-29

## userResponse
userResponse: Q1=A(scopeFiles .md/.mmd only → tdd_red_evidence免除), Q2=A(成果物生成フェーズ全てにユニーク制約注入)

Q1: tdd_red_evidence免除の条件をどう定義しますか？
A1: scopeFilesが全て.md/.mmdのみ — scopeFilesの拡張子を判定し、コード(.ts/.js等)が1つもなければtest_implのtdd_red_evidenceを免除する

Q2: テンプレートへの全行ユニーク制約注入はどの範囲に適用しますか？
A2: 成果物生成フェーズ全て — output_fileが.mdのフェーズ全て(約20フェーズ)にユニーク制約注意書きを注入する

## decisions

- D-001: tdd_red_evidence免除はscopeFilesの拡張子判定で自動化する（手動dodExemptions登録ではなく）
- D-002: 免除対象の拡張子は.mdと.mmdのみ。.ts/.js/.tsx/.jsx/.json等が1つでも含まれれば免除しない
- D-003: 全行ユニーク制約はparallel_verificationだけでなく成果物生成フェーズ全てに適用する
- D-004: テンプレート共通ヘッダに1回注入する方式ではなく、各フェーズテンプレートに個別注入する（テンプレート構造の一貫性維持）
- D-005: Why行削除は前回コミット(1833234)で完了済みのため本タスクのスコープ外とする

## artifacts

- hearing.md (本ファイル)

## next

- scope_definition フェーズで影響ファイルの特定とスコープ設定
