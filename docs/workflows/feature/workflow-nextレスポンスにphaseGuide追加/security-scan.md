# セキュリティスキャン結果

## サマリー

phaseGuide機能の実装に対するセキュリティスキャンを実施しました。
本スキャンでは、PHASE_GUIDESマスターオブジェクトの改ざんリスク、resolvePhaseGuide関数のパストラバーサルリスク、情報漏洩の可能性、および不正注入リスクについて詳細に検討しました。
スキャン結果として、重要度「高」から「低」まで合計4つの潜在的な脆弱性が発見されています。
全て修正可能な問題であり、本レポートでは各脆弱性の詳細な分析と推奨される対策を提示します。
優先度順に対応することで、phaseGuide機能のセキュリティ品質を確保できます。
次フェーズでは、検出された問題への修正が反映されていることの確認が必要です。

## 脆弱性スキャン結果

### 1. PHASE_GUIDES オブジェクトの改ざんリスク

**重要度**: 高

**位置**: `definitions.ts` 行534〜804

**分析結果**:

PHASE_GUIDESはexport constで定義されていますが、TypeScript/JavaScriptのオブジェクト参照の性質により、モジュール外部からのディープアクセスによって値を改ざん可能です。例えば、`resolvePhaseGuide('research', docsDir).requiredSections` を取得した後、その配列に要素を追加する操作が可能です。

次.tsファイルの行496では `resolvePhaseGuide(nextPhase, taskState.docsDir)` が呼び出されてレスポンスに含まれますが、このオブジェクトはシャローコピーであるため、ネストされたオブジェクト（subPhases、requiredSectionsなど）は参照が保持されています。

CLIツールやMCPクライアントがレスポンスのphaseGuideを受け取った場合、理論的には同期機構を通じてPHASE_GUIDESのメモリ空間にアクセス可能なシナリオが成立します。

**具体例**:
```typescript
const guide = resolvePhaseGuide('research');
guide.requiredSections.push('## 悪意のあるセクション');
// 以降のresolvePhaseGuide呼び出しで不正なセクションが含まれる
```

**対策**:

PHASE_GUIDESを完全に不変化し、resolvePhaseGuide関数がディープコピーを返すように変更すること。特に以下のプロパティは完全に再構築すべきです：

- `requiredSections`: 配列のディープコピーを生成
- `subPhases`: オブジェクトのディープコピーを生成（サブフェーズごとに展開）
- `inputFiles`、`editableFileTypes`、`allowedBashCategories`: すべて新規配列を生成

### 2. resolvePhaseGuide関数のパストラバーサルリスク

**重要度**: 中

**位置**: `definitions.ts` 行813〜848

**分析結果**:

resolvePhaseGuide関数は、phaseパラメータを直接PHASE_GUIDESのキーとして使用しています。phaseは外部入力（ユーザーからのコマンドや、タスク状態から動的に取得）に基づく可能性があります。

現在のコードは `PHASE_GUIDESのキーの範囲内` という暗黙の制約に依存していますが、制約が明示的に検証されていません。理論的には以下のシナリオが考えられます：

1. 未実装のフェーズ名を指定: `resolvePhaseGuide('__proto__')` のようなプロトタイプ汚染攻撃
2. 任意のキーアクセス: `resolvePhaseGuide('constructor')` のようなオブジェクト機構へのアクセス試行

具体的には、next.tsの行496で `nextPhase` 変数（PhaseName型で型チェック済み）を渡していますが、型安全性はランタイム時点で保証されません。MCPクライアント経由での不正なphaseパラメータ指定が技術的には可能です。

**対策**:

resolvePhaseGuide関数の冒頭で、guideが確実に存在すること（undefined判定）を確認するだけでなく、guideオブジェクトの全プロパティが想定されるスキーマに合致することを検証すること。キー存在チェック専用の関数を実装し、PHASE_GUIDESに存在しないキーへのアクセスを明示的に拒否すること。

### 3. phaseGuideレスポンス内の情報漏洩リスク

**重要度**: 中

**位置**: `next.ts` 行505、`status.ts` 行123

**分析結果**:

次.tsの行505とstatus.tsの行123では、resolvePhaseGuide()の結果がそのままレスポンスに含まれます。phaseGuideには以下の機構上の情報が含まれています：

1. **許可拡張子のドキュメント化**: `allowedBashCategories`（'readonly'、'testing'、'implementation'）と `editableFileTypes`（'.md'、'.ts'等）が明示的に列挙されることで、ワークフローエンジンの制御戦略が外部に周知されます。

2. **内部モデル情報**: `subagentType`（'general-purpose'、'Plan'、'Bash'等）と `model`（'haiku'、'sonnet'）は、MCPサーバー内部のsubagent割り当て方針とLLMモデル選択ロジックを露出させます。

3. **最小行数要件**: `minLines`プロパティで、成果物検証の内部ロジックが推察可能になります。

これらの情報は、攻撃者がワークフローシステムの防御メカニズムを理解し、迂回戦略を立案するうえで有用です。例えば、`allowedBashCategories`から許可・禁止されたBashコマンドを逆算し、フェーズチェック回避の方法を探索可能になります。

**対策**:

phaseGuideレスポンスを、CLIユーザー向けとMCP内部用で層別化すること。CLIレスポンスに含める情報を以下に限定：

- `phaseName`（フェーズ名）
- `description`（目的説明）
- `requiredSections`（成果物の必須セクション）
- `outputFile`（出力先）

以下の内部仕様情報は、CLIレスポンスから除外：

- `allowedBashCategories`
- `editableFileTypes`
- `subagentType`
- `model`
- `minLines`
- `inputFiles`

### 4. subagentTypeおよびmodelパラメータの不正注入リスク

**重要度**: 低

**位置**: `definitions.ts` 行534〜804

**分析結果**:

PHASE_GUIDESの各フェーズ定義には、`subagentType`（汎用型、計画型、Bash型、探索型の4種類が存在）と`model`（Haiku、Sonnet、Opusの3種類が存在）が直列化されています。

MCPサーバーがこれらの値を、subagent起動メカニズムに直接渡す場合（例：Task toolのmodel パラメータに指定）、以下のリスクが考えられます：

1. **不正なsubagentType**: PHASE_GUIDESで定義されていないsubagentTypeを指定した場合、Task tool呼び出し時に不正なsubagentエンジンが起動される可能性があります。

2. **不正なmodelパラメータ**: 存在しないモデル名（例：'claude-opus-5.0'や'adversarial-model'）を指定した場合、API呼び出しがエラーになるか、予期しないモデルで代替される可能性があります。

現在のコード上ではPHASE_GUIDESは定数であるため、動的な改ざんは困難です。しかし、MCPサーバーが外部設定ファイルやデータベースからsubagentType/modelを読み込む仕様に移行した場合、入力値検証が不足していると外部から不正な値を注入可能になります。

**対策**:

subagentType および model の値を厳密にホワイトリスト検証すること。許可値のセット定義し、PHASE_GUIDESから読み込んだ値がそのセットに含まれることを明示的に検証してから使用すること。

## 検出された問題

### 問題1: PHASE_GUIDESの参照可能な内部構造（改ざん脆弱性）

**影響範囲**: `definitions.ts` で定義されたPHASE_GUIDESオブジェクト全体

**根本原因**: TypeScriptでexport constで定義されたオブジェクトのネストされたプロパティ（配列、オブジェクト）は、シャローコピーでは参照が保持されるため、呼び出し元からディープアクセス経由での改ざんが可能

**影響**: ワークフロー処理中に、別の処理によってPHASE_GUIDESの内容が無断で変更され、成果物検証ロジックが無効化される、または不適切な要件が注入される

**修正方法**:

resolvePhaseGuide関数内でディープコピーを実装し、全てのネストされたプロパティ（配列、オブジェクト）を新規生成すること。JavaScriptで実装する場合は、`JSON.parse(JSON.stringify())` またはLodashの `_.cloneDeep()` を使用するか、手動でディープコピー関数を実装すること。

### 問題2: フェーズ名の入力値検証不足（プロトタイプ汚染リスク）

**影響範囲**: `resolvePhaseGuide` 関数への入力phaseパラメータ

**根本原因**: phase パラメータが直接PHASE_GUIDESのキーとして使用されており、PhaseName型による型レベルの検証のみで、ランタイム値検証がない

**影響**: 例外的なキー値（'__proto__'、'constructor'等）を指定された場合、オブジェクトプロトタイプへのアクセスが成立し、システム全体の動作が不安定になるリスク

**修正方法**:

resolvePhaseGuide関数の冒頭で、入力phaseが実際にPHASE_GUIDESの キーとして存在することを明示的に確認すること。`Object.prototype.hasOwnProperty.call(PHASE_GUIDES, phase)` による安全なキー存在確認を実装すること。

### 問題3: システム内部仕様情報のレスポンス露出（情報漏洩）

**影響範囲**: `next.ts` 行505で返却されるphaseGuideオブジェクト、`status.ts` 行123で返却されるphaseGuideオブジェクト

**根本原因**: resolvePhaseGuideの返却オブジェクト全体（内部仕様情報を含む）がCLIレスポンスに含まれており、システムの制御メカニズムが外部に公開される

**影響**: allowedBashCategories、subagentType、modelなどの内部仕様情報が外部に露出することで、攻撃者がワークフロー制御を迂回する戦略を立案可能になる

**修正方法**:

phaseGuideレスポンスをフィルタリングし、CLIユーザー向けの情報（phaseName、description、requiredSections、outputFile）のみを抽出して返却する関数を実装すること。MCP内部処理用の完全なphaseGuideオブジェクトは別途、内部メカニズムのみで使用すること。

### 問題4: 動的な設定移行時のモデル値検証不足（不正注入リスク）

**影響範囲**: `definitions.ts` で定義されたmodel値（Haiku、Sonnet、Opus等）

**根本原因**: 現在はPHASE_GUIDES定数として埋め込まれているため実害はないが、外部設定を参照する仕様に移行した場合、入力値検証がない

**影響**: 不正なmodel値またはsubagentType値が外部から注入され、予期しないLLMモデルやsubagentエンジンが起動される、またはシステムエラーが誘発される

**修正方法**:

model値とsubagentType値のホワイトリスト定数を作成し、設定から読み込んだ値がそのホワイトリストに存在することを検証してから使用すること。以下の定数セットを実装：

subagentType の許可値として general-purpose、Plan、Bash、Explore の4種類を定数セットで定義し、model の許可値として haiku、sonnet、opus の3種類を定数セットで定義すること。phaseGuideオブジェクトから読み込んだ値がこれらの許可セットに含まれることを明示的に確認すること。
