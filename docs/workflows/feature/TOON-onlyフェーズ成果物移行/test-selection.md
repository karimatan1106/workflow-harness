## サマリー

- [TS-001][decision] ユニットテスト主体の自動テストを選択する。dod-l3.ts/dod-l4-delta.ts等のバリデーター変更はnpm testで回帰テストが実施可能である。
- [TS-002][decision] CLAUDE.md更新とsubagentテンプレート変更の確認はコードレビュー形式の目視確認を選択する。
- [TS-003][finding] test-design.mdで定義した19件（TC-AC1-01〜TC-AC5-02 + TC-EDGE-01〜02）を全て実施対象として選択する。

## テスト選択結果

テスト対象はtest-design.mdで定義した19件の検証テストを全件選択する。
TypeScript実装変更（dod-l3.ts等15ファイル）については既存のnpm testスイートが主要な検証手段となる。
npm testが既存テストのリグレッションを検出し、新規TOONバリデーターの動作を確認する。
CLAUDE.md更新とsubagentテンプレート変更は目視確認とGrepコマンドで検証する。
後方互換性フォールバックは実装しないため移行前後の動作比較テストは不要である。
