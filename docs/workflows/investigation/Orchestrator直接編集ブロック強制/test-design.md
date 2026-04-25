## サマリー

- [TD-001][scope] phase-edit-guard.jsへのdocs/workflows/パスブロックロジック追加に対するテスト設計。
- [TD-002][strategy] ユニットレベルの手動検証（コードレビュー）とシェル実行検証の組み合わせ戦略を採用する。
- [TD-003][ac-coverage] AC-1〜AC-5の全受入基準に対してTCを定義し、追跡マトリクスで網羅性を保証する。
- [TD-004][boundary] パス正規化（バックスラッシュ→スラッシュ）と境界値（パス末尾スラッシュ有無）のエッジケースを含める。
- [TD-005][constraint] phase-edit-guard.jsは200行制限対象ファイルであるため、変更後の行数検証をテスト項目として含める。
- [TD-006][mirror] workflow.mdとSKILL.mdの差分一致確認をAC-3のテストとして定義し、ミラー状態を定量検証する。

## テスト方針

テスト対象は3ファイルの変更であり、実行可能なユニットテストフレームワークを導入するよりも、コードレビュー形式の確認とシェルコマンドによる検証が適切である。
spec.mdの「変更対象外: ユニットテストファイル」制約に従い、.test.tsや.spec.tsファイルは作成しない。
各ACに対してコードレビュー観点のテストケース（TC）を定義し、実施者が確認手順を明確に実行できるよう記述する。
パス検出ロジック（AC-1）については、Nodeスクリプトをシェルで直接呼び出す形式の実行確認を採用する。
JSON形式のstderr出力（AC-5）は、実際にguardスクリプトを起動してstderrキャプチャすることで検証する。
行数制限（AC-4）はwcコマンドで定量確認する。
ミラー一致（AC-3）はdiffコマンドによる0差分確認で検証する。
境界値テストは、正常系（ブロック対象パス）・正常系（通過対象パス）・エッジケース（Windows形式パス）の3区分で設計する。

## テストケース

**TC-AC1-01: docs/workflows/配下パスのブロック確認**
対象AC: AC-1
前提条件: phase-edit-guard.jsに追加実装が完了していること。
入力: tool_name="Edit", file_path="docs/workflows/SomeTask/planning.md" を含むJSONをstdinに渡す。
実行手順: `echo '{"tool_name":"Edit","tool_input":{"file_path":"docs/workflows/SomeTask/planning.md"}}' | node workflow-harness/hooks/phase-edit-guard.js`
期待結果: プロセスがexit code 2で終了する。
合否判定: `echo $?` の出力が `2` であること。

**TC-AC1-02: ブロックロジックのコード存在確認**
対象AC: AC-1
前提条件: phase-edit-guard.jsへの実装が完了していること。
実行手順: phase-edit-guard.jsのソースコードを読み、行59直後にdocs/workflows/を検出するif文が存在することを目視確認する。
期待結果: `filePath`を正規化してから`includes('docs/workflows/')`で検出するif文が行59〜67の範囲に存在する。
合否判定: 該当コードブロックが視認できること。

**TC-AC1-03: 通過対象パス（非docs/workflows/）の確認**
対象AC: AC-1
前提条件: phase-edit-guard.jsに追加実装が完了していること。
入力: tool_name="Edit", file_path="src/components/App.tsx" を含むJSONをstdinに渡す。
実行手順: `echo '{"tool_name":"Edit","tool_input":{"file_path":"src/components/App.tsx"}}' | node workflow-harness/hooks/phase-edit-guard.js`
期待結果: プロセスがexit code 2以外で終了する（通常は0または拡張子チェックによる2）。
合否判定: docs/workflows/ブロックが意図しないパスを遮断していないこと。

**TC-AC1-04: Windowsバックスラッシュ形式パスのブロック確認**
対象AC: AC-1
前提条件: phase-edit-guard.jsに追加実装が完了し、パス正規化ロジックが含まれていること。
入力: tool_name="Edit", file_path="docs\\workflows\\SomeTask\\planning.md" を含むJSONをstdinに渡す。
実行手順: `echo '{"tool_name":"Edit","tool_input":{"file_path":"docs\\\\workflows\\\\SomeTask\\\\planning.md"}}' | node workflow-harness/hooks/phase-edit-guard.js`
期待結果: プロセスがexit code 2で終了する。
合否判定: `echo $?` の出力が `2` であること。

**TC-AC1-05: パス末尾スラッシュなし・パス先頭にC:/を含む絶対パスのブロック確認**
対象AC: AC-1
前提条件: phase-edit-guard.jsに追加実装が完了していること。
入力: tool_name="Write", file_path="C:/ツール/Workflow/docs/workflows/TaskX/spec.md" を含むJSONをstdinに渡す。
実行手順: `echo '{"tool_name":"Write","tool_input":{"file_path":"C:/ツール/Workflow/docs/workflows/TaskX/spec.md"}}' | node workflow-harness/hooks/phase-edit-guard.js`
期待結果: プロセスがexit code 2で終了する。
合否判定: `echo $?` の出力が `2` であること。

**TC-AC2-01: SKILL.mdのOrchestratorパターン節への違反例追加確認**
対象AC: AC-2
前提条件: SKILL.mdへの追記実装が完了していること。
実行手順: `.claude/skills/harness/SKILL.md` を読み、Orchestratorが直接Editする違反例のコードブロックが存在することを確認する。
期待結果: Orchestratorがdocs/workflows/配下を直接Editする誤ったパターンと、サブエージェントを再起動する正しいパターンの両方が記述されている。
合否判定: 違反例と正しいパターンの両方のセクションが目視確認できること。

**TC-AC2-02: SKILL.mdのOrchestratorパターン節の位置確認**
対象AC: AC-2
前提条件: SKILL.mdへの追記実装が完了していること。
実行手順: SKILL.mdの行番号付きで内容を確認し、追記箇所がspec.mdで指定された位置（`## 3. Workflow Usage Decision`節の直前）に存在することを確認する。
期待結果: 追加されたブロックが`## 3. Workflow Usage Decision`のすぐ前の行に配置されている。
合否判定: grep等で違反例テキストの行番号を確認し、`## 3.`の行番号より小さいこと。

**TC-AC3-01: workflow.mdとSKILL.mdのミラー一致確認**
対象AC: AC-3
前提条件: workflow.mdとSKILL.mdの両方への変更が完了していること。
実行手順: SKILL.mdとworkflow.mdの違反例セクション部分をdiffで比較する。
具体的には両ファイルの末尾部分（追記箇所）を抽出して内容を照合する。
期待結果: diff出力が0行（差分なし）である。
合否判定: diff結果が空であること。

**TC-AC3-02: workflow.mdに違反例が存在することの独立確認**
対象AC: AC-3
前提条件: workflow-harness/skills/workflow.mdへの変更が完了していること。
実行手順: workflow-harness/skills/workflow.mdを読み、Orchestratorの直接編集に関する違反例テキストが存在することを確認する。
期待結果: SKILL.mdに追加されたものと同一の違反例テキストが存在する。
合否判定: 対応するテキストが目視で確認できること。

**TC-AC4-01: phase-edit-guard.jsの行数が200行以下であることの確認**
対象AC: AC-4
前提条件: phase-edit-guard.jsへの追加実装が完了していること。
実行手順: `wc -l workflow-harness/hooks/phase-edit-guard.js`
期待結果: 行数が200以下（仕様上は94行以下）であること。
合否判定: コマンド出力の行数が200以下であること。

**TC-AC5-01: ブロック時のstderr出力がJSON形式であることの確認**
対象AC: AC-5
前提条件: phase-edit-guard.jsに追加実装が完了していること。
入力: tool_name="Edit", file_path="docs/workflows/TaskX/planning.md" を含むJSONをstdinに渡す。
実行手順: `echo '{"tool_name":"Edit","tool_input":{"file_path":"docs/workflows/TaskX/planning.md"}}' | node workflow-harness/hooks/phase-edit-guard.js 2>&1 1>/dev/null`
期待結果: stderrへの出力が `{"decision":"block","reason":"..."}` 形式のJSONである。
合否判定: 出力をJSON.parseしてdecisionキーが"block"であること。

**TC-AC5-02: stderrのJSONにdecisionとreasonキーが存在することの確認**
対象AC: AC-5
前提条件: phase-edit-guard.jsに追加実装が完了していること。
実行手順: TC-AC5-01と同一の手順でstderrを取得し、出力に`"decision":"block"`と`"reason":`が含まれることをgrepで確認する。
期待結果: `"decision":"block"` と `"reason":` の両方のキーが出力に存在する。
合否判定: grepで両パターンが検出されること。

**TC-AC5-03: stderrのreasonにファイルパスが含まれることの確認**
対象AC: AC-5
前提条件: phase-edit-guard.jsに追加実装が完了していること。
実行手順: TC-AC5-01と同一の手順で入力ファイルパス"docs/workflows/TaskX/planning.md"を使い、stderrのreason内に当該パスが含まれることを確認する。
期待結果: stderrのJSON reason フィールドに入力に使用したファイルパスが含まれる。
合否判定: 出力文字列に"docs/workflows/TaskX/planning.md"が含まれること。

## AC→TCマッピングテーブル

| AC-N | テストケースID | テスト内容 |
|------|------------|---------|
| AC-1 | TC-AC1-01 | docs/workflows/配下パスにexit code 2が返ることをシェル実行で確認 |
| AC-1 | TC-AC1-02 | ブロックロジックのコード存在をソースコード目視で確認 |
| AC-1 | TC-AC1-03 | 通過対象パスが誤ってブロックされないことを確認 |
| AC-1 | TC-AC1-04 | Windowsバックスラッシュ形式パスも正規化してブロックされることを確認 |
| AC-1 | TC-AC1-05 | 絶対パス（C:/...）形式でもdocs/workflows/を含む場合にブロックされることを確認 |
| AC-2 | TC-AC2-01 | SKILL.mdに違反例と正しいパターンの両方が追記されていることを目視確認 |
| AC-2 | TC-AC2-02 | 追記位置が`## 3. Workflow Usage Decision`節の直前であることを行番号で確認 |
| AC-3 | TC-AC3-01 | workflow.mdとSKILL.mdの追記内容がdiffで0差分であることを確認 |
| AC-3 | TC-AC3-02 | workflow.mdに違反例テキストが独立して存在することを目視確認 |
| AC-4 | TC-AC4-01 | wc -lでphase-edit-guard.jsの行数が200以下であることを確認 |
| AC-5 | TC-AC5-01 | stderrがJSON形式であることをJSON.parseで確認 |
| AC-5 | TC-AC5-02 | stderrのJSONにdecisionとreasonの両キーが存在することをgrepで確認 |
| AC-5 | TC-AC5-03 | stderrのreasonに入力ファイルパスが含まれることを確認 |
