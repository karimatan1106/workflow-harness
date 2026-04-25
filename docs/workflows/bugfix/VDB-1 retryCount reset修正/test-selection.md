## サマリー
- [TS-001][decision] ユニットテスト主体の自動テストを選択する。manager.ts の resetTask と goBack の修正は manager-lifecycle.test.ts で検証する。
- [TS-002][decision] TC-AC1-01、TC-AC1-02、TC-AC2-01、TC-AC2-02 の4件を自動テストとして実装する。
- [TS-003][decision] TC-AC3-01（npm run build）と TC-AC4-01（npm test 全件）は CI レベルの確認とする。

## テスト選択結果
test-design.md で定義した6件のテストケースのうち、TC-AC1-01/02 と TC-AC2-01/02 の4件を自動テストとして実装する。
TC-AC3-01 と TC-AC4-01 はビルドとテスト実行コマンドの終了コード確認で検証するため実装コードは不要である。
StateManager の resetTask と goBack は createMgr ヘルパー関数で初期化した manager インスタンスを使用してテストできる。
テストファイルは workflow-harness/mcp-server/src/__tests__/manager-lifecycle.test.ts に追加する。
