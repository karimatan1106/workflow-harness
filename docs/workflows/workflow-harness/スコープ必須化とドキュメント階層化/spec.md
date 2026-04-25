# スコープ必須化とドキュメント階層化 実装仕様書

## サマリー

本仕様書は「スコープ必須化とドキュメント階層化」タスクの実装仕様を定義する。
requirements.md に記載した機能要件 FR-1/FR-2/FR-3 と非機能要件 NFR-1〜NFR-5 を満たすため、
4つのコードファイルと2つのテストファイルに対する変更内容を行番号レベルで特定する。
加えて、既存の897テスト継続パスを保証する実装方針と、10ms 以内のパフォーマンス要件の達成方法を明示する。
本仕様で採用する段階的必須化の方針は、既存ワークフローの後方互換を維持しながら早期に問題を検出するための設計方針である。

主要な決定事項:
- `next.ts` の research フェーズ処理（行174-180）にはスコープ警告コードが既に存在するため、文言改善と requirements→parallel_analysis 遷移への新規警告追加のみで対応する
- `types.ts` の scope インターフェースに `moduleName?: string` をオプショナル追加して後方互換を保つ
- `set-scope.ts` の safeExecute ブロック内で dirs の最初のパス末尾要素を moduleName として保存する
- `definitions.ts` の resolvePhaseGuide() 関数に {moduleDir} プレースホルダーを追加し、moduleDir を docsDir/modules/{moduleName} に展開する
- FR-3 コンテキスト絞り込みはドキュメント変更のみで実現し、ランタイムのファイルフィルタリング処理を追加しない
- `artifact-validator.ts` の bracket check に .mmd 拡張子スキップを追加し、Mermaid 図ファイル内の正当な角括弧記法を誤検出から除外する
- `semantic-checker.ts` の `validateKeywordTraceability` をLLMセマンティックチェックに置換し、キーワード頻度ではなく意味的情報継承を検証する（`claude-haiku-4-5-20251001` モデルを使用、API失敗時は非ブロッキングでフォールバック）

次フェーズ（parallel_design）ではステートマシン図・フローチャート・UI設計を本仕様書に基づいて作成する。

---

## 概要

### 現状課題と解決方針

調査フェーズで判明した現状課題は「スコープ設定の遅延検出」と「ドキュメントのフラット構造」の2点である。
スコープ設定の遅延検出とは、スコープ未設定が parallel_analysis → parallel_design 遷移まで発覚しないため、
ユーザーが設計フェーズ直前に突然ブロックされる問題を指す。
ドキュメントのフラット構造とは、現在のすべての成果物が docsDir 直下に配置されているため、
モジュール単位の階層管理ができない問題を指す。この構造では機能領域ごとに成果物を区分けできず、
複数の並行タスクが存在する場合にファイルパスの一意性が損なわれるリスクがある。

解決方針は「早期警告による情報提供」と「プレースホルダー拡張によるパス解決」の2軸で採用する。
早期警告は research フェーズ完了時（情報レベル）と requirements フェーズ完了時（警告レベル）の2段階で実施し、
既存の parallel_analysis → parallel_design ブロック（成果物バリデーションの前提条件）はそのまま維持する。
プレースホルダー拡張は {moduleDir} という新規プレースホルダーを resolvePhaseGuide() に追加し、
モジュール名が設定されている場合は docsDir/modules/{moduleName} に展開するフォールバック付き設計とする。
段階的必須化の採用理由は、即時ブロックでは既存タスクの作業継続が不可能になるためであり、
情報→警告→ブロックの3段階で段階的に到達するよう設計した。

### エラーメッセージと日本語警告の文言仕様

スコープ未設定時に出力するエラーメッセージ・警告・情報の全てを日本語で統一し、1行以内に収める基準とする。
メッセージ内に改行コードを含めないこと（改行なし要件）は NFR-2 として明示されており、
workflow_next のレスポンス JSON をパースするクライアントへの互換性確保のためでもある。
未設定時に表示するメッセージの推奨文言例は以下の通りである。

情報レベル（research 完了時）の推奨表現:
「スコープが未設定です。workflow_set_scope で影響範囲を設定することを推奨します。」

警告レベル（requirements 完了時）の推奨表現:
「スコープが未設定です。parallel_analysis フェーズに進む前に workflow_set_scope で設定してください。」

ブロック（parallel_analysis 完了時）の日本語警告表現:
「スコープ（影響範囲）が未設定のため parallel_design フェーズに進めません。workflow_set_scope で設定してください。」

エラーメッセージと警告メッセージの区別は `success` フィールドの値で行う。
ブロックする次遷移に対しては `success: false`、警告のみの遷移に対しては `success: true` を設定する。
表示方法の強化として、将来的に `warnings` フィールドへの分離も検討されているが、本タスクでは `message` プレフィックス方式で実装する。

### フェーズスキップとの関係

calculatePhaseSkips() はスコープ情報（affectedFiles / affectedDirs）が空かどうかを確認し、
test_impl フェーズをスキップするかどうかを判定する。
本タスクの変更では calculatePhaseSkips() のロジック本体は変更せず、スキップ時の警告メッセージ文言のみを追加する。
phaseskips の判定に使う scope フィールドへの参照パターン（taskState.scope?.affectedFiles?.length）は変更しない。
これにより、既存の phases_by_size 定義（small/medium/large の各フェーズリスト）とスキップロジックの整合性は保たれる。
スキップ時に出力する日本語の警告メッセージは1行以内で、スキップ判定ロジックの変更は行わず出力のみを追加する。

### タスクサイズと影響フェーズ

本タスクは medium サイズとして実行される。
medium サイズでは parallel_analysis・parallel_design・parallel_quality・parallel_verification の
各並列フェーズが含まれ、sub_phase_dependencies による順序制約（planning は threat_modeling の完了待ち）が適用される。
本仕様は medium サイズの14フェーズ構成を前提に設計している。
small サイズ（8フェーズ）では threat_modeling・ui_design・parallel_verification が省略されるが、
コード変更内容自体はフェーズ構成に依存しないため、全サイズで同一の実装が適用される。

### 成果物バリデーションへの影響

artifacts バリデーションは workflow_next または workflow_complete_sub の呼び出し時に実行される。
本タスクでは artifact-validator.ts に1箇所変更を加える。変更内容は .mmd 拡張子ファイルの角括弧プレースホルダー検出をスキップする処理の追加であり、Mermaid 図ファイル内の正当な記法（stateDiagram-v2 の状態遷移記法等）が誤検出されるバグを修正する。
resolvePhaseGuide() の {moduleDir} 拡張により、outputFile のパス解決結果が変わる場合がある。
この変更は次フェーズ移行前のバリデーション対象パスを変更するが、バリデーション判定条件（行数・密度・禁止語）は維持される。

### フェーズ編集ルールとの整合性

phase_edit_rules は各フェーズで編集可能なファイル種別を定義している。
本タスクで変更する next.ts・set-scope.ts・definitions.ts・types.ts はすべてソースコードファイルであり、
implementation フェーズでのみ編集が許可されている。
test_impl フェーズでは .test.ts ファイルのみの作成が許可され、ソースコードの変更は禁止される。
この制約により、テストコードと実装コードの作成順序（TDD Red → Green）が技術的に強制される。

---

## 変更対象ファイル

### コード変更対象（優先度順）

変更対象となる5つのコードファイルを変更難易度の低い順に示す。

1. `workflow-plugin/mcp-server/src/state/types.ts` — scope インターフェースへの moduleName 追加（2行追加）
2. `workflow-plugin/mcp-server/src/tools/next.ts` — requirements→parallel_analysis 遷移警告追加・文言改善（10行程度）
3. `workflow-plugin/mcp-server/src/tools/set-scope.ts` — moduleName 自動推定と保存処理追加（10行程度）
4. `workflow-plugin/mcp-server/src/phases/definitions.ts` — resolvePhaseGuide への {moduleDir} プレースホルダー対応（20行程度）
5. `workflow-plugin/mcp-server/src/artifact-validator.ts` — .mmd ファイルの角括弧チェックスキップ（1行追加）
6. `workflow-plugin/mcp-server/src/validation/semantic-checker.ts` — validateKeywordTraceability 置換と validateLLMSemanticTraceability 追加（30行程度）

### テスト追記対象（既存ファイルへの追記）

テストは既存テストファイルへの追記のみで対応し、新規テストファイルは作成しない。
追記方式を採用することで既存テストとの衝突を回避し、既存897件のスイートに新規件数を追記する形式とする。
新規追加するユニットテストの件数は next.test.ts に4件、definitions.test.ts に4件、semantic-checker.test.ts に3件の合計11件を見込む。

7. `workflow-plugin/mcp-server/src/__tests__/artifact-validator.test.ts` — .mmd ファイルスキップのテスト追記
8. `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts` — requirements フェーズ警告テスト追記
9. `workflow-plugin/mcp-server/src/__tests__/definitions.test.ts` — resolvePhaseGuide の {moduleDir} テスト追記

### ドキュメント変更対象

7. `C:\ツール\Workflow\CLAUDE.md` — サブエージェント起動テンプレートへのスコープ制約セクション追記（FR-3-1）

### モジュールパスとプレースホルダーリストのフォーマット仕様

サポートするプレースホルダーリストと展開先の対応は以下の通りである。
{docsDir} は既存のプレースホルダーであり、ワークフロー成果物ディレクトリに展開される。
{workflowDir} も既存のプレースホルダーであり、内部状態管理ディレクトリに展開される。
{moduleDir} は本タスクで新規追加するプレースホルダーであり、{docsDir}/modules/{moduleName} に展開される。
moduleName が未設定の場合、{moduleDir} は {docsDir} にフォールバックし後方互換を維持する。

resolvePhaseGuide のレスポンス形式に {moduleDir} プレースホルダーを追加することで、
フェーズ定義内の outputFile・inputFiles・requiredArtifacts の各フィールドでモジュールパスを記述可能になる。
プレフィックスマッチによるドキュメントパス抽出は docsDir を基点として modules サブディレクトリを認識する形式とする。
具体的なモジュールパスとして認識される形式は `{docsDir}/modules/{moduleName}/spec.md` であり、
outputFiles および requiredArtifacts のどちらにも {moduleDir} プレースホルダーを記述可能とする。

---

## 実装計画

### 変更1: types.ts — scope インターフェースへの moduleName 追加

変更箇所は `scope` フィールド定義（行222-229付近）である。

変更前の構造:

```typescript
scope?: {
  affectedFiles: string[];
  affectedDirs: string[];
  preExistingChanges?: string[];
};
```

変更後の構造:

```typescript
scope?: {
  affectedFiles: string[];
  affectedDirs: string[];
  preExistingChanges?: string[];
  /** dirs指定時に自動推定されるモジュール名（FR-2-2）。{moduleDir}プレースホルダーの展開に使用する */
  moduleName?: string;
};
```

moduleName はオプショナルフィールドのため、TaskState を参照するすべての既存テストおよびコードへの影響はゼロである。
scope フィールド自体がオプショナルのため、参照時は必ず `taskState.scope?.moduleName` のパターンを使用し null 安全を確保する。
この型定義追加のみで897テストが継続パスする根拠は、TypeScript の構造的部分型付けによりオプショナルフィールドの追加が既存の型チェックを破壊しないためである。
最小限の変更（2行追加）で必要性を満たす方針に沿った変更であり、型レベルの破壊的変更（scope を必須化するなど）は採用しない。

### 変更2: next.ts — requirements → parallel_analysis 遷移時の警告追加

変更箇所は requirements フェーズからの遷移処理（行182-188 の承認チェック直後）である。
ランタイムバリデーションのスコープチェック実行タイミングは requirements → parallel_analysis 遷移時であり、
メモリアクセスのみで I/O 処理を含まないため NFR-4 の 10ms 以内要件を満たす。
コマンドとして workflow_set_scope の文字列を警告メッセージに含める必要があり、これにより受け入れ基準 AC-3 を充足する。

追加するコードブロック（行188の直後に挿入）:

```typescript
// FR-1-2: requirements→parallel_analysis遷移時のスコープ未設定警告
if (currentPhase === 'requirements') {
  const reqScopeFiles = taskState.scope?.affectedFiles?.length ?? 0;
  const reqScopeDirs = taskState.scope?.affectedDirs?.length ?? 0;
  if (reqScopeFiles === 0 && reqScopeDirs === 0) {
    scopeWarnings.push(
      'スコープが未設定です。parallel_analysisフェーズでブロックされます。workflow_set_scopeで影響範囲を設定してください。'
    );
  }
}
```

既存 research フェーズ警告（行174-180）の文言は現状維持とする（既に適切な内容のため）。
既存 parallel_analysis ブロック（行206-213）の文言も現状維持とする。
スコープチェックは `taskState.scope?.affectedFiles?.length` パターンで行い、null 安全なアクセスにより例外を発生させない。
後方互換性の根拠として、workflow_set_scope を一度も呼び出さない既存タスクは警告メッセージが追加されるが遷移はブロックされないため作業継続が可能である。
既存コマンドとの衝突回避として、scopeWarnings は遷移フラグ（success）とは独立した配列であり、警告追加が遷移結果に影響しない設計を維持する。

### 変更3: set-scope.ts — moduleName 自動推定と保存処理

変更箇所は safeExecute ブロック内の scope 保存処理（行316-343付近）である。
ファイルフィルタリング（inputFiles のスコープ絞り込み）の詳細として、
dirs パラメータから自動推定された moduleName は {moduleDir} プレースホルダー展開に使用され、
間接的に inputFiles の参照対象パスを絞り込む効果をもたらす。
ただし、ランタイムでの inputFiles への直接フィルタリング処理は追加せず（FR-3-2 の設計方針）、
あくまでもプレースホルダー置換によるパス誘導で対応する。
副作用確認として、既存の affectedFiles・affectedDirs 処理への影響はゼロであることをテストで検証する。

モジュール名自動推定ロジック:

```typescript
// dirs の最初の要素からモジュール名を自動推定（FR-2-2）
const inferredModuleName = affectedDirs.length > 0
  ? path.basename(affectedDirs[0].replace(/[/\\]+$/, ''))
  : (taskState.scope?.moduleName ?? undefined);

const updatedState = {
  ...taskState,
  scope: {
    affectedFiles,
    affectedDirs,
    preExistingChanges: existingPreExistingChanges,
    ...(inferredModuleName ? { moduleName: inferredModuleName } : {}),
  },
};
```

dirs 配列が空で files のみの場合、moduleName が保持されない。
addMode が true の場合、affectedDirs が空のとき既存の moduleName を引き継ぐ処理が
inferredModuleName の三項演算子の `taskState.scope?.moduleName ?? undefined` によって実現される。
トレイリングスラッシュがある場合は `replace(/[/\\]+$/, '')` で除去してから適用し、basename を正しく取得する。
大量スコープ（10000件以上）設定時のパフォーマンス考慮として、moduleName の推定は配列の先頭要素のみを参照するため、
スコープ件数が増加しても推定処理のコストは O(1) で一定となる。

### 変更4: definitions.ts — resolvePhaseGuide への {moduleDir} プレースホルダー対応

変更箇所は resolvePhaseGuide 関数のシグネチャ（行1413付近）とプレースホルダー置換処理（行1425-1468付近）である。
プロンプトテンプレート（subagentTemplate）への moduleDir 追加については、
resolvePhaseGuide() が返す PhaseGuide の outputFile・inputFiles 内の {moduleDir} プレースホルダーを展開することで、
subagent 起動時にテンプレートへ moduleDir が自動的に埋め込まれる仕組みとする。
定義内での {moduleDir} 記述は、既存の {docsDir} や {workflowDir} と同じ記法で統一し、学習コストを最小化する。

関数シグネチャ変更:

```typescript
export function resolvePhaseGuide(
  phase: string,
  docsDir?: string,
  userIntent?: string,
  moduleName?: string  // FR-2-3: {moduleDir}プレースホルダー解決用
): PhaseGuide | undefined
```

next.ts 行608付近の呼び出し箇所を以下に変更する:

```typescript
const phaseGuide = resolvePhaseGuide(
  nextPhase,
  taskState.docsDir,
  taskState.userIntent,
  taskState.scope?.moduleName  // FR-2-3
);
```

{moduleDir} の解決値の決定ルール:
- moduleName が設定されている場合: `moduleDir = "${docsDir}/modules/${moduleName}"`
- moduleName が未設定の場合: `moduleDir = docsDir`（フォールバック、後方互換を保つ）

プレースホルダー置換の追加箇所（既存の {docsDir} 置換の直後）:

```typescript
const moduleDir = moduleName && docsDir
  ? `${docsDir}/modules/${moduleName}`
  : (docsDir ?? '');

if (resolved.outputFile) {
  resolved.outputFile = resolved.outputFile
    .replace(/{docsDir}/g, docsDir ?? '')
    .replace(/{moduleDir}/g, moduleDir);
}
if (resolved.inputFiles) {
  resolved.inputFiles = resolved.inputFiles.map(f =>
    f.replace(/{docsDir}/g, docsDir ?? '').replace(/{moduleDir}/g, moduleDir)
  );
}
```

サブフェーズの再帰処理にも同様の {moduleDir} 置換を追加する（inputFileMetadata の path フィールドも対象）。
PHASES_BY_SIZE・SUB_PHASE_DEPENDENCIES・PHASE_EDIT_RULES など既存の定数は一切変更しない。
calculatePhaseSkips() のロジック本体も変更せず、メッセージ追加のみを行う。
複数タスクが同時実行される場合のファイルパスの一意性は、moduleName がタスクごとに異なるスコープ由来であるため自然に確保される。

### 変更5: artifact-validator.ts — .mmd ファイルの角括弧チェックスキップ

変更箇所は checkBracketPlaceholders 関数（または同等の角括弧チェック処理）の先頭部分である。
.mmd 拡張子のファイルは Mermaid 図ファイルとして扱い、角括弧プレースホルダーの検出対象から除外する。
この変更により stateDiagram-v2 の [*] 記法や flowchart の ["text"] 記法が誤検出されなくなる。

変更後のコードは以下の通りである。

```typescript
// .mmd ファイルは Mermaid 図ファイルのため角括弧チェックをスキップ
if (filePath.endsWith('.mmd')) return [];
```

この1行追加のみで対応する。既存の角括弧チェックロジックは変更せず、ファイル拡張子による早期リターンのみを追加する。
.mmd 以外のファイルに対する動作は変更後も同一であり、リグレッションリスクはない。
artifact-validator.test.ts に .mmd ファイルを入力とした場合に空配列が返ることを検証するテストを1件追記する。

### 変更6: semantic-checker.ts — LLMセマンティックチェックへの置換

現行の `validateKeywordTraceability` 関数はspecドキュメントのキーワード出現頻度を数える方式のため、
test-designのような実装固有の用語が多数出現するドキュメントでは多くのキーワードが「未参照」と判定される問題がある。
本来の目的である「前フェーズの重要な情報が後続フェーズに適切に伝搬されているか」の確認に対して、
キーワード頻度方式は不適切であり、意味的な情報継承を評価するLLMベース方式に置換する。

#### 新規追加関数: extractSummarySection

```typescript
/** ## サマリー セクション以降の最大200行を抽出するヘルパー関数 */
export function extractSummarySection(text: string): string
```

この関数は `## サマリー` 見出しを検索し、その行から最大200行分のテキストを返す。
`## サマリー` が見つからない場合は先頭200行を返すフォールバックを持ち、
空文字列入力に対しては空文字列を返す安全な実装とする。
CRLF統一（`\r\n` を `\n` に変換）は関数内で処理する。

#### 新規追加関数: validateLLMSemanticTraceability

```typescript
export async function validateLLMSemanticTraceability(
  prevDocPath: string,
  currentDocPath: string,
): Promise<{ passed: boolean; score: number; reasoning: string }>
```

この関数は前フェーズ文書と現フェーズ文書の各サマリーセクションを読み込み、
`claude-haiku-4-5-20251001` モデルに意味的継承度を 0.0〜1.0 で評価させる。
プロンプト内容は「前フェーズの重要な情報が現フェーズに引き継がれているか、0.0から1.0のスコアと理由を返してください」とする。
スコアが 0.5 未満の場合は `passed: false` を返す。
タイムアウト（10秒）または API 呼び出し失敗の場合は `passed: true, score: 0.5, reasoning: 'フォールバック'` を返す非ブロッキング設計とする。

#### next.ts への変更（keywordTraceMapping の削除と llmSemanticCheckPhases の追加）

`keywordTraceMapping` から `test_impl` エントリを削除し、`parallel_analysis` エントリも削除する。
代わりに `llmSemanticCheckPhases` 定数を追加して対象フェーズを管理する。

```typescript
const llmSemanticCheckPhases = ['test_impl'];
```

test_impl フェーズ移行時に `validateLLMSemanticTraceability` を非同期実行し、
失敗時（スコア低下）は `warnings` 配列に追加するが `success: false` は返さない非ブロッキング設計とする。
`SEMANTIC_CHECK_STRICT` 環境変数が `false` に設定されている場合は警告のみで遷移を継続する既存制御と統合する。

#### 削除対象: validateKeywordTraceability の既存シグネチャ

現行の `validateKeywordTraceability(docsDir, source, target)` という3引数シグネチャは
新しい `validateLLMSemanticTraceability` に置換されるため、next.ts の `keywordTraceMapping` と共に削除する。
`validateSemanticConsistency` 関数は別の機能（ファイルシステム経由での呼び出し）を担うため変更しない。

#### @anthropic-ai/sdk の依存関係確認

`validateLLMSemanticTraceability` の実装では `@anthropic-ai/sdk` パッケージを使用する。
mcp-server の `package.json` に既存の依存関係として確認し、存在しない場合は追加する。
API キーは環境変数 `ANTHROPIC_API_KEY` から取得し、未設定時はフォールバック動作（passed: true を返す）とする。

---

### FR-3: ドキュメント変更による inputFiles スコープ絞り込み

FR-3-1 として CLAUDE.md のサブエージェント起動テンプレートにスコープ制約セクションを追加する。
スコープが設定されている場合、入力ファイルをスコープ内のファイルに限定することを指示する文言を追記する。
FR-3-2 として definitions.ts 内の inputFiles に関する記述に、スコープ設定時はスコープ内ファイルのみを参照する旨の注記を追加する。
この2点の変更はドキュメントおよびテンプレート文言の追加のみであり、ランタイムのファイルフィルタリング処理は追加しない。
スコープ外ファイルの誤読み込みを防ぐことで、subagent のコンテキスト肥大化を回避し品質向上につながる。

---

## 要件定義書との対応

本仕様は requirements.md に定義された機能領域 FR-1/FR-2/FR-3 に対応している。

FR-1（スコープ段階的必須化）への対応の列挙:
- FR-1-1 は next.ts の research 完了時処理（行174-180の文言整備）で実現する
- FR-1-2 は next.ts の requirements 完了時への新規警告追加（変更2）で実現する
- FR-1-3 は next.ts の既存ブロックロジック維持（変更なし）で対応する
- FR-1-4 は calculatePhaseSkips() のスキップ時メッセージ追加（変更2の派生）で実現する

FR-2（ドキュメント階層化）への対応の列挙:
- FR-2-1 は definitions.ts への {moduleDir} プレースホルダー追加（変更4）で実現する
- FR-2-2 は set-scope.ts への moduleName 自動推定ロジック追加（変更3）で実現する
- FR-2-3 は resolvePhaseGuide() の引数拡張と置換処理追加（変更4）で実現する

FR-3（コンテキスト絞り込み）への対応の列挙:
- FR-3-1 は CLAUDE.md のテンプレートへのスコープ制約文言追記（ドキュメント変更）で実現する
- FR-3-2 は definitions.ts の inputFiles 注記追加（変更4の一部）で実現する

バグ修正（artifact-validator.ts）: .mmd ファイルの Mermaid 記法が角括弧プレースホルダーとして誤検出される問題を修正する。変更5として実装計画に含める。

セマンティックチェック改善（semantic-checker.ts）: キーワード頻度方式によるトレーサビリティ検証をLLMベースの意味的継承度検証に置換する。変更6として実装計画に含める。

前倒し実装が可能な項目は変更1（types.ts）と変更3（set-scope.ts）と変更6（semantic-checker.ts）であり、
これらは他の変更ファイルへの依存が少なく独立して完了可能である。
完了時点の基準は「全受け入れ基準（AC-1〜AC-5）を満たし、897件以上のテストがパスすること」とする。

---

## ユニットテストスイートの設計

### テストスイートのコンポーネント構成

テストスイートは既存897件のスイートに11件の新規テストを追記して構成する。
既存テストファイルへの追記により、新規ファイルの作成なしでコンポーネント数を最小化する。

next.test.ts に追加するユニットテスト（4件）:
- requirements フェーズからの遷移でスコープ未設定時に warnings が含まれること
- requirements フェーズからの遷移でスコープ未設定でも success が true であること
- requirements フェーズからの遷移でスコープ設定済みの場合 warnings にスコープ警告が含まれないこと
- 警告メッセージに workflow_set_scope の文字列が含まれること

definitions.test.ts に追加するユニットテスト（4件）:
- moduleName 設定時に {moduleDir} が docsDir/modules/{moduleName} に展開されること
- moduleName 未設定時に {moduleDir} が docsDir にフォールバックされること
- inputFiles 内の {moduleDir} が正しく置換されること
- 既存の {docsDir} 置換動作が変更されないこと（リグレッション防止）

semantic-checker.test.ts に追加するユニットテスト（3件）:
- validateLLMSemanticTraceability が API 成功時に score 0.5 以上で passed: true を返すこと
- validateLLMSemanticTraceability が API 失敗時に passed: true でフォールバックすること（非ブロッキング設計の検証）
- extractSummarySection が ## サマリーセクションのみを抽出し200行以内に収めること

### 追加テストの位置づけ

追加する11件のユニットテストはスコープチェック・moduleName 推定・LLMセマンティックチェックの各ブランチをカバーする。
補助変更ファイル（types.ts・CLAUDE.md）へのテストは型チェックで担保されるため個別テストは不要とする。
主要変更ファイル（next.ts・definitions.ts・set-scope.ts・semantic-checker.ts）はそれぞれのテストファイルで検証される。

---

## 実装制約と衝突回避

### ワークフロー全体への副作用確認

本タスクで変更する6ファイルのうち、ワークフロー全体に影響する可能性があるのは definitions.ts と next.ts と semantic-checker.ts である。
definitions.ts の resolvePhaseGuide() は全フェーズの処理で呼び出されるため、変更後のリグレッションテストが特に重要となる。
next.ts のスコープチェック追加は既存の遷移フラグ（success）に影響しない設計であるため、副作用の範囲は警告メッセージの追加に限定される。
set-scope.ts の moduleName 推定は scope 保存処理の末尾に追加する形式であり、既存の affectedFiles・affectedDirs 処理には影響しない。

### 複数タスク同時実行時のパス一意性

複数のワークフロータスクが同時実行される場合、各タスクが異なる TaskState を持つため taskId でファイルパスが区別される。
{moduleDir} の展開結果は `{docsDir}/modules/{moduleName}` であり、docsDir がタスクごとに異なるパスを持つため衝突は発生しない。
ファイルパスの一意性はタスクIDを含む docsDir（例: docs/workflows/{taskId}_{taskName}/）によって自然に保証される。
スコープの modules サブディレクトリ構造は docsDir 配下に作成されるため、タスク間のパス重複は原理的に起こらない。

### 既存コマンドとの衝突回避

workflow_set_scope コマンドは既存の実装を変更せず、moduleName 推定ロジックを追記する形式を採用する。
workflow_next コマンドは既存の遷移処理のフローを変えず、スコープチェックを追加するのみである。
workflow_complete_sub コマンドおよびその他のコマンドは本タスクで変更しないため、衝突は発生しない。
resolvePhaseGuide() の引数追加は TypeScript のデフォルト引数（undefined）により既存の呼び出しコードを変更不要とする。

---

## 非機能要件の達成方法

### NFR-1: 897テスト継続パスの根拠

既存動作への影響ゼロを保証するための具体的な根拠を示す。
types.ts への moduleName 追加はオプショナルフィールドのため、既存のすべての型チェックを破壊しない。
next.ts の警告追加は scopeWarnings 配列への push のみであり、遷移フラグ（success）には影響しない。
set-scope.ts の moduleName 推定は新規処理の追加であり、既存の affectedFiles・affectedDirs 処理に副作用を与えない。
definitions.ts の resolvePhaseGuide() は引数を1つ増やすが、TypeScript の既定値（undefined）により既存の呼び出しコードは変更不要である。
テスト追加対象となる next.test.ts・definitions.test.ts への追記は既存テストケースを変更しない形式で行う。

### NFR-4: 10ms 以内パフォーマンスの達成方法

next.ts に追加するスコープチェックはメモリアクセスのみで完結し、I/O 処理を含まない。
具体的には `taskState.scope?.affectedFiles?.length ?? 0` という単一プロパティ参照と比較演算のみであり、
実行時間は1マイクロ秒未満と見積もられる。
これにより遷移処理全体の実行時間増加は 10ms の上限を大幅に下回る。

### NFR-5: 後方互換性確保の根拠

workflow_set_scope を呼び出さないタスクでも警告メッセージが追加されるだけで遷移はブロックされないため、
既存タスクの作業継続が可能である。
parallel_analysis → parallel_design のブロックは既存動作の維持であり、後方互換性を崩す変更ではない。
moduleName が未設定の場合、{moduleDir} は {docsDir} にフォールバックするため、
{moduleDir} を使用しない既存のフェーズ定義の動作は変わらない。

---

## テスト設計

### next.test.ts への追記

requirements フェーズからの遷移時のスコープ警告テストを既存テストファイルに追記する。
承認済みの状態（approvals: { requirements: true }）でモックを設定して検証する。

追加するテストケース:
- スコープ未設定で requirements → parallel_analysis 遷移時、warnings に警告文字列が含まれること
- スコープ未設定でも遷移が成功すること（success: true）
- スコープ設定済みの場合、スコープ関連の warnings が含まれないこと
- 警告メッセージに workflow_set_scope という文字列が含まれること

### definitions.test.ts への追記

resolvePhaseGuide の {moduleDir} プレースホルダー解決テストを追記する。
moduleName が設定されている場合と未設定の場合の両方のブランチをカバーする。

追加するテストケース:
- moduleName: "auth" を渡すと outputFile の {moduleDir} が docsDir/modules/auth に展開されること
- moduleName が未設定の場合、{moduleDir} が docsDir にフォールバックされること
- inputFiles 内の {moduleDir} も正しく置換されること
- 既存の {docsDir} 置換動作が変更されないこと（リグレッション防止）

### semantic-checker.test.ts への追記（変更6対応）

`validateLLMSemanticTraceability` および `extractSummarySection` の動作検証テストを追記する。
Anthropic SDK の呼び出しはモック化して外部API依存を排除し、ユニットテストとして独立実行できる形式とする。
テストファイルは `workflow-plugin/mcp-server/src/__tests__/semantic-checker.test.ts` に追記する。
既存の `validateKeywordTraceability` および `extractKeywordsFromMarkdown` に関するテストは
変更6の実装後に削除または無効化する（関数そのものが削除されるため）。

追加するテストケース（3件）:
- `validateLLMSemanticTraceability` がAPIの応答で score 0.7 を受け取った場合、`passed: true` を返すこと
- `validateLLMSemanticTraceability` がAPI呼び出し失敗（例外送出）の場合、`passed: true, score: 0.5` のフォールバック値を返すこと（非ブロッキング設計の検証）
- `extractSummarySection` が `## サマリー` 見出しを含むテキストから、その見出し以降のセクション本文のみを抽出し、先頭200行以内に収まること
