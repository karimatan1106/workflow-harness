## サマリー

- 目的: Fix 1（security_scan テンプレート拡充）・Fix 2（workflow_status レスポンス最適化）の副作用として判明した 3 問題を解消するための実装仕様を定義する。
- 主要な決定事項: FR-1 は MEMORY.md の 80 行目と 95〜96 行目を書き換えることで解消する。FR-2 は next.ts の 606〜614 行にある subPhases ループ内に status.ts と同じスリム化処理を挿入することで解消する。FR-3 は manual_test・performance_test・e2e_test の各 subagentTemplate に security_scan の Fix 1 と同形式のNG/OK例を追加することで解消する。
- 次フェーズで必要な情報: 修正対象は MEMORY.md・next.ts・definitions.ts の 3 ファイル。definitions.ts と next.ts の変更後は必ず `npm run build` を実行してから MCP サーバーを再起動すること。
- 対象ファイル: workflow-plugin/mcp-server/src/tools/next.ts、workflow-plugin/mcp-server/src/phases/definitions.ts、MEMORY.md の 3 ファイルが変更対象となる。
- ビルド要件: definitions.ts と next.ts の変更後は npm run build と MCP サーバー再起動が必須であり、再起動未実施のままフェーズを進めてはならない。

---

## 概要

本タスクは、Fix 1（security_scan テンプレート拡充）と Fix 2（workflow_status レスポンス最適化）を実施した際に発生した 3 つの副作用問題を解消するための実装仕様書である。
対象となる問題はそれぞれ、MEMORY.md の記述と実態の乖離（FR-1）、workflow_next レスポンスのサイズ問題（FR-2）、manual_test・performance_test・e2e_test テンプレートのガイダンス不足（FR-3）の 3 件である。
修正対象ファイルは workflow-plugin/mcp-server/src/tools/next.ts（FR-2）、workflow-plugin/mcp-server/src/phases/definitions.ts（FR-3）、および MEMORY.md（FR-1）の 3 ファイルであり、それぞれ独立して修正可能である。
FR-1 はドキュメント修正のみのため MCP サーバー再起動は不要だが、FR-2 と FR-3 はコアモジュールの変更であるため変更後に npm run build と MCP サーバー再起動が必須となる。
本仕様書は research.md・requirements.md の調査・要件定義に基づき、具体的な変更差分（before/after）を記載した実装可能な仕様を提供する。

---

## 実装仕様

### FR-1: MEMORY.md の subagentTemplate 取得手順の更新

#### 変更対象ファイル

`C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md`

#### 現状の問題

MEMORY.md の 80 行目に以下の記述がある。

```
1. `workflow_next` または `workflow_status` のレスポンスから `phaseGuide.subagentTemplate` を取得する
```

Fix 2（status.ts の変更）により workflow_status のレスポンスから subagentTemplate が除外されたため、この記述は実態と乖離している。また 94〜96 行目の「テンプレートが取得できない場合」の項には以下の記述がある。

```
`workflow_status` を呼び直して phaseGuide を再取得する。それでも取得できない場合のみ、
CLAUDE.md の「subagent起動テンプレート」セクションを使用する。
```

この記述は workflow_status から subagentTemplate が取得できないという現実に反している。

#### 変更内容（before/after）

変更箇所 1: 80 行目

before:
```
1. `workflow_next` または `workflow_status` のレスポンスから `phaseGuide.subagentTemplate` を取得する
```

after:
```
1. `workflow_next` のレスポンスから `phaseGuide.subagentTemplate` を取得する
   （注: `workflow_status` は Fix 2 以降 subagentTemplate を返さない。スリムガイドのみ返す設計）
```

変更箇所 2: 94〜96 行目「テンプレートが取得できない場合」セクション

before:
```
`workflow_status` を呼び直して phaseGuide を再取得する。それでも取得できない場合のみ、
CLAUDE.md の「subagent起動テンプレート」セクションを使用する。
```

after:
```
workflow_next を再度呼ぶか、workflow_status でフェーズ情報を確認した上で、
CLAUDE.md の「subagent起動テンプレート」セクションを使用する。
workflow_status は subagentTemplate を含まないため、テンプレートの取得源として使用できない。
```

#### 変更理由

Orchestrator が MEMORY.md の記述を信頼して workflow_status から subagentTemplate を取得しようとすると、取得に失敗してプロンプトを自力で構築するリスクが生じる。修正により正しい取得経路（workflow_next 経由）を明示する。MEMORY.md の変更は MCP サーバーのランタイムに影響しないためビルド・再起動は不要。

---

### FR-2: next.ts のサブフェーズ subagentTemplate スリム化

#### 変更対象ファイル

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts`

対応するソースコードパス: `workflow-plugin/mcp-server/src/tools/next.ts`

#### 現状の問題

next.ts の 606〜614 行には以下の処理がある。

```typescript
if (phaseGuide?.subPhases) {
  for (const sp of Object.values(phaseGuide.subPhases)) {
    if (sp.subagentTemplate) {
      sp.subagentTemplate = sp.subagentTemplate
        .replace(/\$\{taskName\}/g, taskState.taskName || '')
        .replace(/\$\{taskId\}/g, taskState.taskId || '');
    }
  }
}
```

この処理はサブフェーズの subagentTemplate に対してプレースホルダー解決のみを行い、フィールドの除去は行っていない。並列フェーズへの遷移時（特に parallel_verification: 4 サブフェーズ）に、サブフェーズ 4 件分の subagentTemplate・content・claudeMdSections が全てレスポンスに含まれるため、レスポンスサイズが約 61K 文字になる。

Orchestrator が parallel_verification へ遷移する際、workflow_next が返す phaseGuide.subPhases 内の各サブフェーズの subagentTemplate は、その時点では不要である。個別サブフェーズの subagentTemplate は workflow_status を呼ぶことで取得できる設計が望ましい。ただしトップレベル（現フェーズ）の phaseGuide.subagentTemplate は Orchestrator が次のフェーズを実行するために必要なので除外しない。

#### 変更内容

next.ts の 606〜614 行を以下のように変更する。

before（606〜614 行）:
```typescript
if (phaseGuide?.subPhases) {
  for (const sp of Object.values(phaseGuide.subPhases)) {
    if (sp.subagentTemplate) {
      sp.subagentTemplate = sp.subagentTemplate
        .replace(/\$\{taskName\}/g, taskState.taskName || '')
        .replace(/\$\{taskId\}/g, taskState.taskId || '');
    }
  }
}
```

after:
```typescript
if (phaseGuide?.subPhases) {
  for (const sp of Object.values(phaseGuide.subPhases) as Record<string, unknown>[]) {
    // workflow_nextのサブフェーズからはサイズの大きなフィールドを除外する
    // サブフェーズ個別のsubagentTemplateが必要な場合はworkflow_statusで取得すること
    delete (sp as Record<string, unknown>)['subagentTemplate'];
    delete (sp as Record<string, unknown>)['content'];
    delete (sp as Record<string, unknown>)['claudeMdSections'];
  }
}
```

#### 変更理由と後方互換性

トップレベルの phaseGuide.subagentTemplate は削除しない。Orchestrator の標準フローは「workflow_next でフェーズ遷移 → レスポンスの subagentTemplate を Task プロンプトに使用」であり、このフローは変更しない。削除するのはサブフェーズレベルの subagentTemplate のみであるため後方互換性が維持される。parallel_verification 遷移時のレスポンスサイズが約 61K 文字から 15K 文字以下に削減されることが期待される。

status.ts の 131〜139 行で実装されているスリム化ロジックと同等の処理を next.ts にも適用することで、両ツールの対称性を確保する。

#### ビルド・再起動手順

next.ts は MCP サーバーのコアモジュールに該当するため、変更後は以下の手順を実施する。

手順 1: `cd workflow-plugin/mcp-server && npm run build` を実行してトランスパイルを完了させる。
手順 2: dist/tools/next.js の更新日時が変更されたことを確認する。
手順 3: Claude Desktop の再起動またはプロセス終了で MCP サーバーを再起動する。
手順 4: workflow_status を実行して現在のフェーズを確認する。

---

### FR-3: definitions.ts のテンプレート追記

#### 変更対象ファイル

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

対応するソースコードパス: `workflow-plugin/mcp-server/src/phases/definitions.ts`

#### 現状の問題

security_scan の subagentTemplate には Fix 1 で「評価結論フレーズに特化した注意事項」が追加されており、NG/OK 例が明示されている。一方で manual_test・performance_test・e2e_test の各テンプレートには同等のガイダンスが存在しない。

manual_test テンプレートは「重複行回避の注意事項」セクションでシナリオ番号による一意化を指示しているが、複数修正箇所の評価結論行が 3 件以上繰り返される問題に特化した例示がない。performance_test テンプレートには重複行回避のセクション自体が存在しない。e2e_test テンプレートには「重複行回避の注意事項」があるが評価結論フレーズ特化の警告がない。

#### manual_test への追加内容

manual_test の subagentTemplate の末尾、「## 出力」行の直前に以下のテキストを追加する。

追加するテキスト（実際の文字列として definitions.ts に埋め込む際はバックスラッシュ n で改行を表現する）:

```
## 評価結論フレーズの重複回避（特化ガイダンス）
複数のテストシナリオで同一フォーマットの合否判定行を繰り返す場合、バリデーターの重複行検出によりエラーが発生する。シナリオ番号または操作名を行に含めて各行を一意にすること。
- NG: 「- 判定: 合格」をシナリオ 1・2・3 で繰り返す（3 回以上の同一行でエラー）
- OK: 「- シナリオ 1（subagentTemplate 取得経路確認）の合否判定: 合格、workflow_next レスポンスに subagentTemplate が存在することを確認した」
- OK: 「- シナリオ 2（workflow_status スリム化確認）の合否判定: 合格、レスポンスに subagentTemplate フィールドが含まれないことを確認した」
複数シナリオの合否行は必ずシナリオ番号または操作対象名を含めて一意にすること。
```

#### performance_test への追加内容

performance_test の subagentTemplate の末尾、「## 出力」行の直前に以下のテキストを追加する。

```
## 評価結論フレーズの重複回避（特化ガイダンス）
複数の計測対象や修正箇所を同一フォーマットで評価する場合、バリデーターの重複行検出によりエラーが発生する。計測対象名や修正箇所の識別子を行に含めて各行を一意にすること。
- NG: 「- 評価: 問題なし」を計測対象 A・B・C で繰り返す（3 回以上の同一行でエラー）
- OK: 「- workflow_next レスポンスサイズ（修正前後比較）の評価: 問題なし、61K 文字から 15K 文字以下に削減されており目標値を達成している」
- OK: 「- workflow_status レスポンスサイズ（Fix 2 適用後）の評価: 問題なし、10K 文字以下の状態が維持されており前回計測との差分はない」
複数計測対象の評価行は必ず計測対象名または修正箇所の識別子を含めて一意にすること。
```

#### e2e_test への追加内容

e2e_test の subagentTemplate の末尾、「## 出力」行の直前に以下のテキストを追加する。

```
## 評価結論フレーズの重複回避（特化ガイダンス）
複数の E2E シナリオで同一フォーマットの検証結論行を繰り返す場合、バリデーターの重複行検出によりエラーが発生する。シナリオ名または操作名を行に含めて各行を一意にすること。
- NG: 「- 検証結果: 合格」を E2E シナリオ 1・2・3 で繰り返す（3 回以上の同一行でエラー）
- OK: 「- E2E シナリオ 1（workflow_next のフェーズ遷移確認）の検証結果: 合格、parallel_verification への遷移が正常に完了し subagentTemplate が返されることを確認した」
- OK: 「- E2E シナリオ 2（サブフェーズ subagentTemplate 除外確認）の検証結果: 合格、subPhases 内の各サブフェーズから subagentTemplate フィールドが除外されていることを確認した」
複数シナリオの検証結論行は必ずシナリオ名または操作名を含めて一意にすること。
```

#### ビルド・再起動手順

definitions.ts は MCP サーバーのコアモジュールに該当するため、変更後は以下の手順を実施する。

手順 1: `cd workflow-plugin/mcp-server && npm run build` を実行してトランスパイルを完了させる。
手順 2: dist/phases/definitions.js の更新日時が変更されたことを確認する。
手順 3: Claude Desktop の再起動またはプロセス終了で MCP サーバーを再起動する。
手順 4: workflow_status を実行して現在のフェーズを確認する。

---

## 影響範囲

### 変更対象ファイル一覧

変更対象ファイルは以下の 3 ファイルである。

ファイル 1: `C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md`
- 変更種別: ドキュメント修正
- 変更箇所: 80 行目（取得経路の限定）と 94〜96 行目（テンプレート取得不可の明示）
- ランタイム影響: なし（ドキュメントのみ）

ファイル 2: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts`
- 変更種別: コード修正
- 変更箇所: 606〜614 行（サブフェーズのスリム化処理を追加）
- ランタイム影響: workflow_next レスポンスのサブフェーズフィールドから subagentTemplate・content・claudeMdSections が除外される
- ビルド・再起動: 必須

ファイル 3: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
- 変更種別: テンプレート文字列への追記
- 変更箇所: manual_test・performance_test・e2e_test の各 subagentTemplate 末尾
- ランタイム影響: 新規の subagentTemplate ガイダンスが Orchestrator に提供される
- ビルド・再起動: 必須

### 変更対象外ファイル

status.ts は Fix 2 で既にスリム化処理が実装済みであり、今回の変更対象外である。artifact-validator.ts はバリデーションルール自体の変更を行わないため変更対象外である。

### 後方互換性の評価

workflow_next がトップレベルの subagentTemplate を引き続き返すため、Orchestrator の標準フロー（workflow_next → subagentTemplate 使用）は変更されない。削除されるのはサブフェーズレベルの subagentTemplate のみであり、これらが利用されているケースは現在の実装では存在しない。サブフェーズ個別の subagentTemplate が必要な場合は workflow_status を経由して取得できる設計が確保されている。

### テスト方法

FR-2 の効果検証として、parallel_verification フェーズへの遷移時に workflow_next を呼び出し、レスポンスの文字数が 15K 文字以下になることを確認する。subPhases 内の各サブフェーズに subagentTemplate フィールドが含まれていないことをレスポンスの JSON で確認する。FR-1 の効果検証として、MEMORY.md の当該箇所が書き換えられていることを Read ツールで確認する。FR-3 の効果検証として、parallel_verification フェーズで workflow_next を呼び出した際の phaseGuide に manual_test・performance_test・e2e_test の各テンプレートが更新されていることを確認する。ただし subPhases 内の subagentTemplate は FR-2 によって除外されるため、直接確認には workflow_status を使用する。

---

## 実装計画

実装は FR-1・FR-2・FR-3 の順に実施する。FR-1 は MEMORY.md のドキュメント修正のみであり、最初に実施してランタイムへの影響なしに完了できる。
FR-2 は workflow-plugin/mcp-server/src/tools/next.ts の修正であり、606〜614 行のサブフェーズループ処理を変更する。変更後は npm run build と MCP サーバー再起動を実施する。
FR-3 は workflow-plugin/mcp-server/src/phases/definitions.ts の修正であり、manual_test・performance_test・e2e_test の各 subagentTemplate に評価結論フレーズの重複回避ガイダンスを追記する。FR-2 と同じビルド・再起動手順を実施する。
実装後の検証として、parallel_verification への遷移時に workflow_next のレスポンスサイズが 15K 文字以下になることを確認する。また workflow_status を使用してサブフェーズのテンプレートが正しく更新されていることを確認する。
テストは既存のテストスイートを実行してリグレッションがないことを確認する。実装全体のソースコードパス基準は src/ 以下のディレクトリ構成に従う。
