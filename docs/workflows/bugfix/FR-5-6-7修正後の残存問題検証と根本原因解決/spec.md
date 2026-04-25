# verify-sync.ts 仕様書

## サマリー

本仕様書は、`verify-sync.ts` の設計内容をまとめたものである。
このスクリプトは `definitions.ts`（真のソースオブトゥルース）、ルート `CLAUDE.md`、および `workflow-plugin/CLAUDE.md` の3つのファイル間でフェーズ設定の整合性を自動検証するシステムである。

FR-5-6-7修正後の残存問題検証として実施したresearchフェーズの調査により、3ファイルは現時点で同期済みであることが確認されたが、根本原因である「手動更新に依存した構造」は解消されていない。
将来的な同期漏れを防ぐため、本スクリプトによる機械的な検証を恒久的な解消策として実装する。

主要な決定事項:
- 新規ファイル1つのみを作成し、既存ファイルは変更しない（影響範囲を最小化）
- `definitions.ts` を ESM import で直接読み込み、型安全なフィールドアクセスを実現する
- `fs.readFileSync` でCLAUDE.mdを全文読み込み、正規表現でMarkdownテーブルを解析する
- 終了コード（0/1/2）でCI/CDとの統合を可能にする

次フェーズで必要な情報:
- `PhaseGuide` 型の `subPhases` フィールドを再帰展開し、25フェーズをフラット化する方法
- ルートCLAUDE.mdの「フェーズ別subagent設定」テーブルのヘッダー行構造（列インデックス）
- `workflow-plugin/CLAUDE.md` のsubagent設定テーブルが6列構成である点（列インデックスの差異）

---

## 概要

### 目的と課題背景

本スクリプトは、FR-5-6-7修正後の残存問題検証から始まったタスクの根本原因解決を目的とする。
`definitions.ts` の `PHASE_GUIDES` オブジェクトと、2種類の `CLAUDE.md`（ルートおよびworkflow-plugin配下）に記載されたMarkdownテーブルを比較し、3項目（subagentType、model、allowedBashCategories）の整合性を自動検証する。

フェーズ定義の真のソースは `definitions.ts` の `PHASE_GUIDES` であり、CLAUDE.mdのカテゴリテーブルおよびsubagent設定テーブルはその複写である。
しかし現状では3ファイルの同期を手動で行うため、フェーズ追加や設定変更の際に同期漏れが発生しうる構造になっている。
このスクリプトを実行することで、3ファイル間の乖離を即座に差分検出し、開発者へのフィードバックループを短縮する。

### 実行環境

実行環境はNode.jsであり、TypeScriptのコンパイルには `ts-node` 互換の `tsx` ライブラリを使用する。
`tsx` はすでにMCPサーバーのビルド環境に含まれており、外部依存パッケージとして追加インストールは不要である。
プロジェクトルートから以下のコマンドで実行する。

```bash
npx tsx workflow-plugin/mcp-server/src/verify-sync.ts
```

`ts-node` でも実行可能だが、ESMインポートの解決には `tsx` の方が互換性が高い。
プロジェクトのpackage.jsonが `"type": "module"` を宣言しているため、Node.jsはすべての `.js` ファイルをESMとして扱い、`tsx` はこの設定を引き継いで動作する。

### 出力の概要

スクリプトは標準出力にフェーズごとの検証結果（OK/NG）を出力し、最後にサマリー行を表示する。
ファイル読み込みエラーや解析エラーが発生した場合は、スタックトレースを標準エラー出力に出力して終了コード2で終了する。
CI/CDパイプラインでは終了コードを参照して成否を判定するため、標準出力は人間可読な報告のみとし、デバッグ情報は標準エラーに出力する。

---

## 実装計画

### ファイル配置と実装言語

本タスクで新規作成するファイルは以下の1つのみである。
実装言語はTypeScriptであり、プロジェクト既存の `tsconfig.json` の設定を継承してコンパイルする。

- 配置場所: `workflow-plugin/mcp-server/src/verify-sync.ts`
- 実行方式: `npx tsx workflow-plugin/mcp-server/src/verify-sync.ts`（事前コンパイル不要）
- `tsconfig.json`: 既存の `workflow-plugin/mcp-server/tsconfig.json` の設定をそのまま継承する

外部ライブラリの追加は制約として禁止されており、使用可能なパッケージはNode.js組み込みモジュール（`fs`、`path`、`url`）およびプロジェクト既存の依存のみである。
`definitions.ts` はESM importで読み込むため、`fs` 経由でのソースコードレベルのテキスト解析は行わない。

### モジュール構成と関数設計

スクリプトは以下の4つの関数と1つのメイン処理で構成される。

#### `extractFromDefinitions(): PhaseEntry[]`

`PHASE_GUIDES` を `Object.entries()` でイテレートし、各エントリのフィールドを取得する。
並列フェーズ（`parallel_analysis`, `parallel_design`, `parallel_quality`, `parallel_verification`）のエントリには `subPhases` プロパティが存在するため、再帰的に展開して全サブフェーズをフラットな配列に含める。
返却するフラット配列の各要素は `{ phaseName, subagentType, model, allowedBashCategories }` の形式とする。

型定義に基づく情報抽出の手順:
- `PhaseGuide` 型のフィールドに直接アクセスし、型変換やキャストを必要としない実装とする
- オプショナルフィールドには存在確認（オプショナルチェーン `?.`）を行い、実行時エラーを防ぐ
- `allowedBashCategories` は文字列配列として定義されており、抽出処理で型を維持する
- トップレベルの並列フェーズ自体（例: `parallel_analysis`）はCLAUDE.mdのテーブルに個別行として存在しないため、サブフェーズのみを展開対象とする
- 展開後の総エントリ数は25件となる（主要フェーズ15件＋サブフェーズ10件）

#### `parseRootCLAUDEMdSubagentTable(content: string): Map<string, TableEntry>`

ルートCLAUDE.mdの「フェーズ別subagent設定」セクションヘッダーを正規表現で特定し、その中のMarkdownテーブルを行抽出して解析する。
セクションヘッダーの識別は `## フェーズ別subagent設定` に一致する行を起点とし、次の `## ` 見出し行が出現した時点をセクション終端とする。

テーブル行抽出の解析方法:
- ヘッダー行（フェーズ名・subagent_type・model・入力ファイル・出力ファイルの5列）をスキップする
- セパレータ行（`|---|`形式で始まる行）をスキップする
- 各データ行を `|` で分割し、前後空白を除去してからフェーズ名（列0）、subagent_type（列1）、model（列2）を情報抽出する
- Mapのキーはフェーズ名文字列とし、値はTableEntry型オブジェクトとする

#### `parseRootCLAUDEMdBashTable(content: string): Map<string, string[]>`

ルートCLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクションに配置されたカテゴリテーブルを行単位で解析し、フェーズ名と許可カテゴリの対応関係を抽出する。
カテゴリテーブルは3列構成（フェーズ名・許可カテゴリ・用途）であり、許可カテゴリのセル値は「readonly, testing」のようにカンマ区切りで複数記載される場合がある。

解析仕様の詳細:
- カテゴリセルはカンマ区切りで分割し、各カテゴリ文字列の前後空白を除去してから文字列配列として扱う
- セル値が「なし」または空文字の場合は空配列として扱い、比較時に空配列との一致と見なす
- フェーズ名のセルに複数のフェーズ名がカンマ区切りで記載されている場合、以降のすべてのフェーズに同じカテゴリ情報を展開する

#### `parsePluginCLAUDEMdSubagentTable(content: string): Map<string, TableEntry>`

`workflow-plugin/CLAUDE.md` のsubagent設定テーブルを解析する。
このテーブルはルート版と異なる6列構成（フェーズ・subagent_type・model・入力ファイル・入力ファイル重要度・出力ファイル）であり、プラグイン版特有の列インデックスに対応する必要がある。

プラグイン版の解析では `parseRootCLAUDEMdSubagentTable` と同一のセクション識別ロジックを再利用するが、6列テーブルであるためルートCLAUDE.md版と相対的な列インデックスが異なる点に注意する。
subagent_typeが列1、modelが列2である点はルート版と共通であるため、列インデックスの差は「入力ファイル重要度」列の存在のみによる。

#### `compareAndReport(definitions, rootSubagent, rootBash, pluginSubagent): number`

4つのデータを突き合わせてフェーズごとに差分検出を行い、不一致箇所を人間可読な形式で標準出力に報告する。
返却値はプロセス終了コード（0または1）とする。

比較・報告の手順:
- `definitions` の各エントリについて、`rootSubagent` と `pluginSubagent` のMapに対してキー存在確認を行い、欠落フェーズを検出する
- subagentTypeがdefinitions.tsと両CLAUDE.mdで一致するか比較し、不一致箇所を報告する
- modelがdefinitions.tsと両CLAUDE.mdで一致するか確認し、不一致箇所を報告する
- allowedBashCategoriesがdefinitions.tsとルートCLAUDE.mdのBashカテゴリテーブルで一致するか検証する（順序は問わず、要素の網羅性で判定）
- 不一致数を累計し、最後のサマリー行に不一致数と対象フェーズ数を記載する

---

## 変更対象ファイル

本タスクで変更するファイルは以下の1件のみである。

| 操作 | ファイルパス | 理由 |
|------|-----------|------|
| 新規作成 | `workflow-plugin/mcp-server/src/verify-sync.ts` | 整合性検証スクリプトの本体 |

既存ファイルへの変更は一切行わない。
`definitions.ts` はESM importで読み込むだけであり、ソースコードへの変更は不要である。
ルートの `CLAUDE.md` と `workflow-plugin/CLAUDE.md` は `fs.readFileSync` で読み込み専用として扱い、変更しない。
`package.json` への `scripts` エントリ追加はスコープ外とする（CI/CDパイプラインへの組み込みは後続タスクで実施）。

---

## データ構造定義

### PhaseEntry（definitions.ts抽出結果の型定義）

スクリプト内部で使用するデータ構造を以下のように定義する。
`extractFromDefinitions()` 関数が返すフラット配列の各要素がこの型定義に対応し、型安全なアクセスを保証する。

各フィールドの意味は以下の通りである。
- `phaseName`: フェーズの識別子文字列。例: `research`、`build_check`、`threat_modeling`
- `subagentType`: subagentの種別。`general-purpose`、`Bash`、`Explore` のいずれかの値をとる
- `model`: 使用するClaudeモデル名。`sonnet`、`haiku`、`opus` のいずれかの値をとる
- `allowedBashCategories`: 許可されたBashコマンドカテゴリの文字列配列。各カテゴリは `readonly`、`testing`、`implementation`、`git`、`deploy` のいずれかとなる

```typescript
interface PhaseGuide {
  phaseName: string;
  subagentType: string;
  model: string;
  allowedBashCategories: string[];
}
```

### TableEntry（CLAUDE.mdテーブル解析結果の型定義）

Markdownテーブルのデータ行から行抽出した情報を保持する型定義である。
この型はルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdの両方のsubagentテーブル解析結果に共通して使用し、型変換のオーバーヘッドなく比較処理を実施できる。

各フィールドの意味は以下の通りである。
- `phaseName`: CLAUDE.mdテーブルの第1列から情報抽出したフェーズ名文字列
- `subagentType`: CLAUDE.mdテーブルの第2列から情報抽出したsubagent種別文字列
- `model`: CLAUDE.mdテーブルの第3列から情報抽出したモデル名文字列

比較処理は `PhaseGuide` と `TableEntry` の対応フィールドを文字列として直接照合する。
テーブル解析時に前後空白をトリムするため、余分なスペースによる誤検出は発生しない。

```typescript
interface TableEntry {
  phaseName: string;
  subagentType: string;
  model: string;
}
```

---

## 出力仕様

### 正常系の出力フォーマット

各フェーズに対し1行を出力する。全フィールドが一致した場合はOKメッセージ、不一致があった場合はNGメッセージとなる。
一致した場合は「OK: {フェーズ名} - 全フィールド一致」と出力し、不一致の場合はフィールド名と両者の値を「NG: {フェーズ名} - {フィールド名}: definitions.ts={値}, CLAUDE.md={値}」の形式で報告する。
最後に「検証結果: {フェーズ数}フェーズ中{不一致数}件の不一致を検出」というサマリー行を出力して成否通知を完結させる。

```
OK: research - 全フィールド一致
NG: planning - model: definitions.ts=sonnet, root-CLAUDE.md=haiku
NG: build_check - allowedBashCategories: definitions.ts={readonly,testing,implementation}, root-CLAUDE.md={readonly}
検証結果: 25フェーズ中2件の不一致を検出
```

### 終了コードの定義

プロセス終了コードは以下の3つの値を持ち、CI/CDシステムへの成否通知に使用する。

- 終了コード0: 全25フェーズで不一致なし（完全同期状態）
- 終了コード1: 1件以上の不一致を検出（差分ありの状態）
- 終了コード2: ファイル読み込みエラーまたはパースエラー（スクリプト実行自体が失敗）

CI/CDパイプラインでは終了コードを参照してパスまたは失敗を判定する。

---

## 受け入れ基準との対応

要件定義で定義された受け入れ基準と本仕様の対応関係を示す。

### AC-1との対応

`extractFromDefinitions()` が `subPhases` を再帰展開することで、25エントリを網羅したフラット配列を生成する。
`compareAndReport()` の出力に25行のOK/NGメッセージが含まれ、サマリー行の「25フェーズ」記述が達成される。
検証完了の判定方法として、標準出力の行数が25行以上になっていることを確認する。

### AC-2との対応

`parseRootCLAUDEMdSubagentTable()` がデータ行を行単位で個別解析するため、1行削除された状態では対応フェーズがMapに存在しなくなる。
`compareAndReport()` はMapにキーが存在しない場合も「欠落」としてNGメッセージを出力し、終了コード1を返す。
テスト手順として実際に1行を削除してスクリプトを実行し、削除したフェーズ名がNGメッセージに含まれることを確認した後、元に戻す。

### AC-3との対応

`compareAndReport()` 内でsubagentType、model、allowedBashCategoriesの3フィールドをそれぞれ個別に比較するロジックが実装される。
不一致メッセージにはフィールド名が含まれ（例: `model: definitions.ts=sonnet, root-CLAUDE.md=haiku`）、コードレビュー時にソースコードレベルで確認できる。

---

## 非機能要件との対応

### 実行時間（NFR-3）

3ファイルの全文読み込みは `fs.readFileSync` で同期的に実行するため、非同期待機のオーバーヘッドが発生しない。
ファイルサイズはCLAUDE.mdが数百KB程度のテキストファイルであり、正規表現によるテーブル解析も数ミリ秒以内に完了する。
動作確認として、総実行時間が1秒以内であることを確認する。

### 型安全性（NFR-4）

`PHASE_GUIDES` は `Partial<Record<string, PhaseGuide>>` 型として定義されており、`Object.entries()` でイテレート後、各エントリに `as PhaseGuide` キャストなしでフィールドにアクセスできる。
`subPhases` フィールドはオプショナルフィールドとして `Record<string, PhaseGuide> | undefined` 型であるため、存在確認としてオプショナルチェーン（`?.`）を使用して安全にアクセスする。
`any` 型キャストは使用せず、コンパイル時エラーが実行時エラーを防ぐ構造を維持する。
