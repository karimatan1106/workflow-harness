## サマリー

本テスト設計書は、FR-11（manual_testフェーズへの総合評価ガイダンス追加）とFR-12（security_scanフェーズへの行数確保計算ロジック追加）の実装内容を検証するテストケースを定義する。

- 目的: FR-11およびFR-12の修正内容が `definitions.ts` に正しく反映されていることを自動テストで継続的に保証する。
- 主要な決定事項: 既存FR-9・FR-10テストと同一パターン（`resolvePhaseGuide('parallel_verification', ...)`経由でサブフェーズテンプレートを取得）を採用し、テストコードの一貫性を維持する。
- テスト追加後の総件数: 実装前912件 + 追加3件 = 915件以上になることを確認対象とする。
- 次フェーズで必要な情報: テスト追加対象ファイル（`workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`）と実装対象ファイル（`workflow-plugin/mcp-server/src/phases/definitions.ts`）の絶対パスを正確に使用すること。
- TDDサイクル上の位置づけ: test_implフェーズで追加するテストはRed状態（実装前は失敗する）であり、implementationフェーズでdefinitions.tsを修正してGreen状態にする。


## テスト対象コードの特定

### 対象ファイル

テスト対象のソースコードは以下のとおりである。

- 主修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（manual_testとsecurity_scanのsubagentTemplateを含む）
- テスト追加対象ファイル: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts`

### 現状の確認事項（調査結果）

`definitions.ts` の現状（2026-02-24時点）を調査した結果、以下の状態を確認した。

manual_testフェーズ（896〜906行目）のsubagentTemplateには、FR-1で追加されたシナリオ一意化ガイダンス、実行日時行の一意化ガイダンスが存在するが、`総合評価` セクションへのガイダンスは存在しない。
これにより、subagentが `## 総合評価` セクションを自己判断で追加した際に、ガイダンスなしでは実質行5行以上を確保できず、バリデーション失敗が発生するリスクがある。

security_scanフェーズ（908〜918行目）のsubagentTemplateには、行数カウント仕様と転記防止、重複行回避注意事項、各必須セクションのガイダンス、FR-2のサブヘッダー多用時ガイダンスが存在するが、minLines（20行）達成のための計算ロジックが明示されていない。
3必須セクション×5行=15行であり、残り5行をどこで確保するかの指針が欠落している。

### テスト実装で使用するAPI

`resolvePhaseGuide` 関数は `definitions.ts` からエクスポートされており、フェーズ名とdocsDirを引数として受け取りPhaseGuideオブジェクトを返す。
並列フェーズ（parallel_verification）の場合は戻り値のsubPhaseプロパティにサブフェーズのPhaseGuideが格納される。
サブフェーズのsubagentTemplateは `parentPhaseGuide?.subPhases?.{サブフェーズ名}?.subagentTemplate` でアクセスできる。
この取得パターンは既存FR-9・FR-10テスト（127〜161行目）で確立されており、同一パターンを採用することでテスト実装の一貫性を保つ。


## テストケース一覧

### FR-11テストスイート（manual_testフェーズの総合評価ガイダンス確認）

FR-11のテストスイートは `describe('FR-11: manual_testフェーズのsubagentTemplateに総合評価セクションのガイダンスを追加', ...)` として定義する。
テンプレート取得は `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')` でparentPhaseGuideを取得し、`parentPhaseGuide?.subPhases?.manual_test?.subagentTemplate ?? ''` でtemplateを取得する。

| テストケースID | テスト名 | 検証内容 | 期待値 | Red状態の理由 |
|---|---|---|---|---|
| TC-11-1 | manual_testのsubagentTemplateに「総合評価」が含まれること | `expect(template).toContain('総合評価')` | 含まれること | FR-11実装前のtemplateに「総合評価」の文字列が存在しない |
| TC-11-2 | manual_testのsubagentTemplateに「全テストシナリオ」が含まれること | `expect(template).toContain('全テストシナリオ')` | 含まれること | FR-11実装前のtemplateに「全テストシナリオ」の文字列が存在しない |

TC-11-1は、FR-11で追加するガイダンスブロック見出し `## ★ 総合評価セクションの記述指針（FR-11）` の内容に「総合評価」が含まれることを検証する。
TC-11-2は、FR-11で追加する第1観点の説明文「全テストシナリオの合否サマリー」の内容に「全テストシナリオ」が含まれることを検証する。
これらの2件は、ガイダンスブロックが正しく挿入されたことの最小検証として機能する。

### FR-12テストスイート（security_scanフェーズの行数確保ガイダンス確認）

FR-12のテストスイートは `describe('FR-12: security_scanフェーズのsubagentTemplateに行数確保ガイダンスを追加', ...)` として定義する。
テンプレート取得は `resolvePhaseGuide('parallel_verification', 'docs/workflows/test')` でparentPhaseGuideを取得し、`parentPhaseGuide?.subPhases?.security_scan?.subagentTemplate ?? ''` でtemplateを取得する。

| テストケースID | テスト名 | 検証内容 | 期待値 | Red状態の理由 |
|---|---|---|---|---|
| TC-12-1 | security_scanのsubagentTemplateに「20行」が含まれること | `expect(template).toContain('20行')` | 含まれること | FR-12実装前のtemplateに「20行」という文字列が存在しない |

TC-12-1は、FR-12で追加する計算ロジック説明文にminLines（20行）への具体的な言及が存在することを検証する。
「20行」という文字列は計算ロジックの核心であり、「minLines（20行）に達するには残り5行以上を別のセクションで確保する必要がある」といった文脈で使用される。


## テスト実装方針

### 実装ファイルと挿入位置

テストコードの追加先は `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` であり、既存FR-10テストブロック（161行目）の後に追記する。
追記内容はFR-11スイート（2テストケース）とFR-12スイート（1テストケース）の合計3テストケースであり、ファイル末尾の行数は162行から180行程度に増加することを見込む。

### テストコードの構造

FR-11テストスイートのコード構造は以下のとおりである。

```typescript
// ============================================================================
// FR-11: manual_testフェーズのsubagentTemplateに総合評価セクションのガイダンスを追加
// ============================================================================

describe('FR-11: manual_testフェーズのsubagentTemplateに総合評価セクションのガイダンスを追加', () => {
  const parentPhaseGuide = resolvePhaseGuide('parallel_verification', 'docs/workflows/test');
  const phaseGuide = parentPhaseGuide?.subPhases?.manual_test;
  const template = phaseGuide?.subagentTemplate ?? '';

  it('TC-11-1: manual_testのsubagentTemplateに総合評価への言及が含まれる', () => {
    expect(template).toContain('総合評価');
  });

  it('TC-11-2: manual_testのsubagentTemplateに全テストシナリオへの言及が含まれる', () => {
    expect(template).toContain('全テストシナリオ');
  });
});
```

FR-12テストスイートのコード構造は以下のとおりである。

```typescript
// ============================================================================
// FR-12: security_scanフェーズのsubagentTemplateに行数確保ガイダンスを追加
// ============================================================================

describe('FR-12: security_scanフェーズのsubagentTemplateに行数確保ガイダンスを追加', () => {
  const parentPhaseGuide = resolvePhaseGuide('parallel_verification', 'docs/workflows/test');
  const phaseGuide = parentPhaseGuide?.subPhases?.security_scan;
  const template = phaseGuide?.subagentTemplate ?? '';

  it('TC-12-1: security_scanのsubagentTemplateにminLines数値への言及が含まれる', () => {
    expect(template).toContain('20行');
  });
});
```

### TDDサイクル上の注意事項

test_implフェーズでは、上記テストコードをテストファイルに追記するが、この段階ではFR-11・FR-12のガイダンスがdefinitions.tsにまだ存在しないため、TC-11-1・TC-11-2・TC-12-1の3件はすべて失敗する（Red状態）。
テストを追加してから実行すると `expect(received).toContain(expected)` 形式のエラーで失敗することを確認してからimplementationフェーズに進む。
implementationフェーズでdefinitions.tsにFR-11とFR-12のガイダンスブロックを追記し、3件のテストがすべて通過する（Green状態）になることを確認する。

### 既存テストとの互換性確認

今回追加するテストは既存の912件のテストケースに対してリグレッションを発生させてはならない。
既存のFR-9・FR-10テストで使用するperformance_testのsubagentTemplateへのアクセスは、今回のFR-11・FR-12修正（manual_testとsecurity_scanのテンプレート変更）による影響を受けない。
parallel_verificationの全サブフェーズ定義は独立したオブジェクトとして定義されているため、一方のサブフェーズへの追記が他のサブフェーズに影響することはない。
リグレッション防止の確認として、implementationフェーズ完了後に全912件 + 3件 = 915件以上のテストが通過することを検証する。

### テスト実行コマンド

テスト実行はサブモジュールのmcp-serverディレクトリで行う必要があり、以下のコマンドを使用する。

```bash
cd /c/ツール/Workflow/workflow-plugin/mcp-server && npx vitest run src/phases/__tests__/definitions-subagent-template.test.ts
```

または全テストスイートを実行して912件 + 追加件数のすべてを確認する場合は以下のコマンドを使用する。

```bash
cd /c/ツール/Workflow/workflow-plugin/mcp-server && npx vitest run
```

### MCPサーバー再起動の要否

今回のテスト追加（test_implフェーズ）では `definitions.ts` を変更しないため、MCPサーバーの再起動は不要である。
ただしimplementationフェーズで `definitions.ts` を修正した後は、MCP ToolとしてFR-11・FR-12のガイダンスが反映されるようにMCPサーバーを再起動すること。
再起動手順はspec.mdの「MCPサーバー再起動手順」セクションに記載されている。
