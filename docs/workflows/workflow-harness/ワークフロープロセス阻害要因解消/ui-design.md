# UI設計書: ワークフロープロセス阻害要因解消

## サマリー

本UI設計書は、ワークフロープラグインの阻害要因を解消するために、CLIインターフェース（エラーメッセージとログ出力）の改善を定義する。

本タスクはバックエンド（hooks/MCP server）の変更のみであり、GUIコンポーネントは対象外である。
主要な改善対象として、以下の3つのコンポーネントが該当する：

1. **set-scope.ts**: フェーズエラーメッセージの動的フェーズリスト表示
2. **scope-validator.ts**: スコープ検証の警告ログ出力（サブモジュール除外時）
3. **bash-whitelist.js**: ブロック時メッセージの改善（フェーズ別許可コマンドリスト表示）

メッセージ設計の観点として、以下の原則を採用する：
- ユーザーが問題を自力で解決できるように、具体的な解決手順を含める
- フェーズごとに許可されている操作を明示的に列挙する
- エラー終了コードを統一し、CI/CD統合を容易にする
- 警告ログはJSON Lines形式で構造化し、ログ分析を可能にする

CLIインターフェースは全てターミナル出力を通じて実装されるため、ANSI色分けと記号の視覚的区別を活用する。

## メッセージ設計

### 1. set-scope.tsのエラーメッセージ改善

#### 1.1 フェーズ違反エラー（動的フェーズリスト表示）

現在のメッセージ:
```
影響範囲の設定はresearch/requirements/planningフェーズでのみ可能です（現在: implementation）
```

改善後のメッセージ:
```
[✗] スコープ設定がフェーズに制限されています

現在のフェーズ: implementation (10/19)

スコープ設定が可能なフェーズ:
  - research フェーズ 1/19 (初期)
  - requirements フェーズ 2/19 (要件定義)
  - planning フェーズ 4/19 (詳細設計)

解決手順:
  1. 現在のフェーズを確認: /workflow status
  2. 対象フェーズまでリセット: /workflow reset "スコープ再設定のため"
  3. 再度スコープを設定

[i] 各フェーズの役割:
    - research: 既存コード分析、依存関係の把握
    - requirements: 要件に基づく影響範囲の明確化
    - planning: 詳細設計に基づく最終的な影響範囲確定

終了コード: 3
```

メッセージ構造:
- **[✗]** アイコンで問題を視覚的に表現
- **現在のフェーズ**: フェーズ名とプログレス（現在/総数）を表示
- **スコープ設定が可能なフェーズ**: リスト形式で列挙し、各フェーズの概要も記載
- **解決手順**: 番号付きステップで具体的な対応を示唆
- **情報セクション**: 各フェーズの役割を説明

#### 1.2 スコープサイズ超過エラー（改善）

現在のメッセージ:
```
スコープが大きすぎます（ファイル: 250件、上限: 200件）。
タスクを機能単位に分割してください。
```

改善後のメッセージ:
```
[!] スコープサイズが上限を超えています

現在の設定:
  - ファイル数: 250件 / 200件（超過: 50件）
  - ディレクトリ数: 15件 / 20件（OK）

REQ-3: スコープサイズ制限
  上限: 200ファイル、20ディレクトリ
  理由: 単一タスクの複雑度を抑制し、品質を確保

解決手順:
  1. 影響範囲を分析: src/ の主要なサブモジュールを特定
  2. 以下の方法でスコープを削減:
     a) 機能単位でタスクを分割
     b) 共有モジュールは別タスクとして独立させる
     c) 対象ファイルから不要な項目を除外

例: 決済機能の場合
  ❌ 悪い例:
     files: ["src/backend/", "src/frontend/features/", "src/common/"]
  ✅ 良い例:
     Task 1: 決済ドメイン実装
       files: ["src/backend/domain/payment/", "src/backend/application/use-cases/payment/"]
     Task 2: 決済UI実装
       files: ["src/frontend/features/payment/"]
     Task 3: 共有モジュール更新
       files: ["src/common/types/payment.ts"]

[i] スコープの最適化により、テスト範囲や検証負荷も削減されます

終了コード: 3
```

メッセージ構造:
- **[!]** アイコンで警告を表現
- **現在の設定**: 数値で現状を正確に表示
- **REQ-3: スコープサイズ制限**: 制限の背景・理由を説明
- **解決手順**: 段階的な削減方法を提示
- **具体例**: よい例と悪い例でパターンを示す

### 2. scope-validator.tsの警告ログ出力

#### 2.1 サブモジュール除外時の警告ログ

現在: ログ出力なし

改善後: 以下の構造化ログをJSON Lines形式で出力

```json
{"timestamp":"2026-02-08T14:30:00.123Z","event":"SCOPE_SUBMODULE_EXCLUDED","taskId":"task_a1b2c3d4","phase":"planning","excludedModules":["src/backend/infrastructure/cache/","src/backend/infrastructure/messaging/"],"reason":"SCOPE_DEPTH_MODE=normal (min_depth=3)","affectedDependencies":["auth.service","payment.service"],"impact":"These services may lack comprehensive testing coverage"}
```

ログフィールド:
- **timestamp**: ISO 8601形式のUTCタイムスタンプ
- **event**: "SCOPE_SUBMODULE_EXCLUDED" で固定
- **taskId**: 対象タスクの識別子
- **phase**: 現在のフェーズ
- **excludedModules**: 除外されたサブモジュールのパス配列
- **reason**: 除外理由（深度制限の詳細）
- **affectedDependencies**: 除外モジュールに依存するサービス
- **impact**: 影響の概要説明

#### 2.2 深度検証ログ

```json
{"timestamp":"2026-02-08T14:31:00.456Z","event":"SCOPE_DEPTH_VALIDATION","taskId":"task_a1b2c3d4","phase":"planning","dirs":["src/backend/application/use-cases/auth/","src/backend/domain/entities/user/"],"minDepth":3,"maxDepth":5,"status":"PASS","details":"All directories meet depth requirement"}
```

ログフィールド:
- **timestamp**: タイムスタンプ
- **event**: "SCOPE_DEPTH_VALIDATION" で固定
- **taskId**: タスクID
- **phase**: フェーズ
- **dirs**: 検証対象ディレクトリリスト
- **minDepth**: 最小深度要件
- **maxDepth**: 最大深度制限
- **status**: PASS または FAIL
- **details**: 検証結果の詳細

### 3. bash-whitelist.jsのブロック時メッセージ改善

#### 3.1 フェーズ別許可コマンド表示

現在のブロックメッセージ（例）:
```
[✗] ブロック: コマンドは許可されていません
実行しようとしたコマンド: npm run dev
```

改善後のメッセージ:
```
[✗] Bashコマンドがフェーズ制限によりブロックされました

実行しようとしたコマンド: npm run dev
ブロック理由: implementation フェーズでは dev サーバー実行は禁止

現在のフェーズ: implementation (10/19)

このフェーズで許可されているコマンド:
  パッケージ管理:
    - npm install, npm ci
    - pnpm install, pnpm add
    - yarn install

  ビルド・コンパイル:
    - npm run build
    - npx tsc, npx webpack, npx vite build

  基本操作:
    - mkdir, mkdir -p, rm -f
    - ls, cat, grep, find
    - git status, git log, git diff

禁止理由:
  dev サーバー実行は implementationフェーズでは対象外です。
  実行可能フェーズ: testing, parallel_verification

解決手順:
  1. 現在のフェーズを確認: /workflow status
  2. 許可コマンドでコード作成を完了
  3. 適切なフェーズ（testing等）に進む: /workflow next

[!] ただしビルドエラー修正時は以下を許可します:
    - SKIP_BASH_WHITELIST=true (緊急時のみ)
    - 使用ログ: .claude/state/bypass.log

終了コード: 2
```

メッセージ構造:
- **[✗]** エラーアイコン
- **実行しようとしたコマンド**: ユーザーが実行しようとした正確なコマンド
- **ブロック理由**: なぜそのコマンドが禁止されているのか
- **現在のフェーズ**: フェーズ名とプログレス
- **このフェーズで許可されているコマンド**: カテゴリ別に列挙
- **禁止理由**: ワークフローの観点から理由を説明
- **解決手順**: 次に取るべきアクションを提示
- **バイパス方法**: 緊急時の対応方法

#### 3.2 複数フェーズ対応のホワイトリスト表示

例: 複数フェーズで異なるコマンド許可時

```
[✗] Bashコマンドがフェーズ制限によりブロックされました

実行しようとしたコマンド: npx jest --watch
ブロック理由: jest --watch（継続実行）は testingフェーズでは禁止

現在のフェーズ: testing (13/19)

このフェーズで許可されているコマンド:
  テストランナー（実行モード）:
    - npx vitest run
    - npx jest（1回実行）
    - npx mocha

  このフェーズで禁止される操作:
    - --watch フラグ（継続監視）
    - --debug フラグ（デバッグ実行）

推奨される代替実行方法:
  1. 単一実行: npx jest (継続的な再実行なし)
  2. 特定テスト: npx jest tests/auth.test.ts
  3. ファイル変更時の自動再実行: 別タスクで対応

[i] 継続的なテスト監視は開発フェーズ（implementation）で実行してください

終了コード: 2
```

#### 3.3 読み取り専用フェーズでの実行禁止

例: research フェーズで書き込みコマンド

```
[✗] Bashコマンドがフェーズ制限によりブロックされました

実行しようとしたコマンド: npm install
ブロック理由: researchフェーズではパッケージインストールは禁止

現在のフェーズ: research (1/19)

researchフェーズの目的:
  既存コードベースの調査・分析
  ⇒ 追加のパッケージやライブラリは導入しない

researchフェーズで許可されているコマンド:
  ファイル閲覧:
    - ls, cat, grep, find
    - git log, git diff, git show

  メタデータ取得:
    - git status, git ls-tree
    - file, wc

  コード分析ツール:
    - grep, rg（設定ファイル検索）
    - find（依存関係マッピング）

次のフェーズでパッケージ追加を行ってください:
  - requirements フェーズ: 要件に基づくパッケージ検討
  - planning フェーズ: 仕様に基づくパッケージ確定
  - implementation フェーズ: 実装時のパッケージインストール

進捗: /workflow status
次フェーズへ: /workflow next

終了コード: 2
```

## エラーメッセージ一覧

### set-scope.ts のエラーメッセージ

| エラー内容 | エラーコード | 対処方法 |
|-----------|-----------|--------|
| フェーズ違反（スコープ設定は特定フェーズのみ） | 3 | 対象フェーズにリセット → スコープ再設定 |
| スコープサイズ超過（ファイル数） | 3 | タスクを機能単位で分割 |
| スコープサイズ超過（ディレクトリ数） | 3 | 影響範囲を絞る |
| スコープ深度違反（浅すぎる） | 3 | より詳細なディレクトリ指定 |
| スコープ深度違反（深すぎる） | 3 | より高位のディレクトリ指定 |
| files/dirs が空（両方未指定） | 3 | 少なくとも1つの対象を指定 |

### scope-validator.ts の警告ログ

| ログイベント | ログレベル | 条件 |
|------------|---------|------|
| SCOPE_SUBMODULE_EXCLUDED | WARN | サブモジュール深度制限により除外時 |
| SCOPE_DEPTH_VALIDATION | INFO | 深度検証実施時（合否問わず） |
| SCOPE_DEPENDENCY_MISSING | WARN | 除外モジュールへの依存検出時 |

### bash-whitelist.js のブロックメッセージ

| ブロック条件 | 終了コード | 対処方法 |
|------------|---------|--------|
| ホワイトリストに未登録 | 2 | 許可コマンド一覧を確認 |
| ブラックリストに該当 | 2 | 禁止パターンを避ける |
| フェーズに未対応 | 2 | 対象フェーズに進む |
| インタプリタ実行（python等） | 2 | Node.jsで代替実装 |
| ファイル破壊操作 | 2 | ディレクトリ慎重操作 |

## 関連ファイル

### 改善対象

- `workflow-plugin/mcp-server/src/tools/set-scope.ts`
- `workflow-plugin/mcp-server/src/validation/scope-validator.ts`
- `workflow-plugin/hooks/bash-whitelist.js`

### 参照ドキュメント

- `docs/workflows/ワ-クフロ-プロセス阻害要因解消/spec.md` (仕様書)
- `docs/workflows/ワ-クフロ-プロセス阻害要因解消/requirements.md` (要件定義)

## メッセージ設計の原則

### 1. エラーハンドリング三段階構造

全てのエラーメッセージは以下の3段階を含む：

1. **問題の特定**: 何が起きたのかを明確に説明
2. **原因の説明**: なぜそれが起きたのかを背景とともに説明
3. **解決手順**: 具体的なステップで解決方法を示す

### 2. 視覚的区別（ANSI色 + 記号）

- **[✓]** 成功（ANSI 32 緑）
- **[✗]** エラー（ANSI 31 赤）
- **[!]** 警告（ANSI 33 黄）
- **[i]** 情報（ANSI 34 青）

### 3. フェーズコンテキストの提供

全てのメッセージにおいて、現在のフェーズを表示し、ユーザーが進捗を把握できるようにする。
フェーズプログレス表示: `フェーズ名 (現在/総数)`

### 4. 代替手段の提示

禁止操作を説明する際は、必ず代替手段またはそれが可能なフェーズを明示する。

### 5. 具体例の活用

抽象的な説明は避け、実際のコマンドやパスを含めた具体例で説明する。

### 6. 構造化ログ（JSON Lines）

警告ログはJSON Lines形式で出力し、ログ分析システムとの連携を容易にする。

## ANSI色分けの実装詳細

### 4. ターミナル色付けの指定

CLIメッセージの出力時には、console.errorおよびlogger出力でANSI色コードを使用する。
これにより、ターミナルでのメッセージの視認性と識別性が大幅に向上する。

#### 4.1 色コードマッピング

| 用途 | ANSI色コード | RGB値 | 用例 |
|------|------------|--------|------|
| エラーメッセージのヘッダー | `\x1b[31m` (赤) | #FF0000 | [✗] ブロック通知 |
| セクションタイトル | `\x1b[36m` (シアン) | #00FFFF | 現在のフェーズ: |
| 許可コマンド（パス） | `\x1b[32m` (緑) | #00FF00 | npm run build |
| 禁止コマンド（パス） | `\x1b[33m` (黄) | #FFFF00 | npm run dev |
| 参考情報 | `\x1b[34m` (青) | #0000FF | [i] 情報テキスト |
| リセット | `\x1b[0m` (デフォルト) | - | メッセージ終了後 |

#### 4.2 出力フォーマット例（内部実装用）

```javascript
// エラーメッセージのターミナル出力例
console.error(`\x1b[31m[✗] Bashコマンドがフェーズ制限によりブロックされました\x1b[0m

実行しようとしたコマンド: \x1b[33mnpm run dev\x1b[0m
ブロック理由: implementation フェーズでは dev サーバー実行は禁止

現在のフェーズ: \x1b[36mimplementation (10/19)\x1b[0m

このフェーズで許可されているコマンド:
  \x1b[32m✓ npm run build\x1b[0m
  \x1b[32m✓ npx tsc\x1b[0m
  \x1b[33m✗ npm run dev (禁止)\x1b[0m
  \x1b[33m✗ npm run test (別フェーズで実行)\x1b[0m
`);
```

## セパレータ・レイアウト設計

### 5. ビジュアルセパレータの活用

メッセージの可読性を高めるため、以下のセパレータを使用する：

#### 5.1 セパレータパターン

```
┌─────────────────────────────────────────────────────────┐  /* 枠線 */
│ メッセージ                                              │
└─────────────────────────────────────────────────────────┘

======  /* 太線区切り */

────────  /* 細線区切り */

  ➤  次のステップへの矢印
  ⇒  フェーズ遷移の矢印
  • リストアイテム
  ○ サブリストアイテム
```

#### 5.2 セクション区切りの実装

エラーメッセージ内で、複数セクション（問題・原因・解決）を区切る場合は、空行とセパレータを組み合わせる：

```
[✗] メッセージタイトル
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

問題の詳細...

────────────────────────────────────────

解決手順...
```

## メッセージフローと入力値の反映

### 6. ユーザー入力値の埋め込み設計

エラーメッセージにはユーザーが実行したコマンド・指定したパスなどを明記し、
何が拒否されたのかを正確に示す：

#### 6.1 動的な値の埋め込み

```
実行しようとしたコマンド: {command}
実行ファイル: {executable}
パス: {path}
ファイル数: {fileCount}/{limit}
現在のフェーズ: {phaseName} ({currentNumber}/{totalPhases})
```

#### 6.2 値を含むメッセージ例

```
実行しようとしたコマンド: npm install lodash
ブロック理由: implementationフェーズではパッケージインストール禁止

実行しようとしたパス: src/backend/infrastructure/database/
スコープ深度: 5 (最大許容: 4)

当該ファイル数: 250件
スコープ上限: 200件
超過分: 50件
```

## ブロックメッセージの例

### 7. フェーズ別ブロックメッセージバリエーション

#### 7.1 ファイル書き込み禁止時（readonly フェーズ）

```
[✗] ファイル操作がフェーズ制限によりブロックされました

実行しようとした操作: 編集 (Edit tool)
対象ファイル: src/backend/domain/entities/User.ts
操作種別: ファイルの上書き保存

現在のフェーズ: research (1/19)

researchフェーズの制限:
  • ファイル読み込みのみ許可（分析目的）
  • ファイル作成・編集・削除は禁止
  • コードベース変更は許可されていない

編集可能なフェーズ:
  ➤ requirements フェーズ (2/19): 要件定義ドキュメント
  ➤ implementation フェーズ (8/19): ソースコード実装
  ➤ refactoring フェーズ (9/19): コード品質改善

ワークフロー進行状況: /workflow status
次フェーズへ進む: /workflow next

終了コード: 1
```

#### 7.2 テストファイル編集禁止時（implementation フェーズ）

```
[✗] ファイル操作がフェーズ制限によりブロックされました

実行しようとした操作: 作成 (Write tool)
対象ファイル: src/backend/tests/integration/payment.integration.test.ts
操作種別: テストファイル作成

現在のフェーズ: implementation (8/19)

implementationフェーズの制限:
  • 実装ソースコードの編集・作成のみ許可
  • テストファイルの作成・編集は禁止（test_implで実施）
  • テストの実行も禁止（testingフェーズで実施）

テストファイル作成可能なフェーズ:
  ➤ test_impl フェーズ (7/19): テスト駆動開発フェーズ
  ➤ testing フェーズ (12/19): テスト実行・結果検証
  ➤ parallel_verification フェーズ (14/19): E2Eテスト等追加

参考ガイド:
  • 実装時には tests/ ディレクトリへの操作は避ける
  • TDD サイクル: test_impl → implementation → refactoring
  • テスト失敗時は implementation → test_impl へ戻す

進捗確認: /workflow status
現在のフェーズでの作業内容: src/backend/domain/**, src/backend/application/**

終了コード: 1
```

#### 7.3 Git操作禁止時（特定フェーズ）

```
[!] Gitコマンドがワークフロー制限によりブロックされました

実行しようとしたコマンド: git push origin main
操作種別: リモートブランチへのプッシュ

現在のフェーズ: implementation (8/19)

プッシュ操作が許可されるフェーズ:
  ✓ push フェーズ (17/19): 確定したコミットをリモートに送信

他のgit操作について:
  ✓ git status, git log, git diff
  ✓ git add, git commit （commit フェーズで実施）
  ✓ git branch, git stash

ワークフロー内でのgit操作タイミング:
  implementation → refactoring → parallel_quality
    ↓
  commit フェーズ: git add, git commit
    ↓
  push フェーズ: git push origin
    ↓
  ci_verification フェーズ: CI/CDパイプラン結果確認

進捗: /workflow status

終了コード: 2
```

## ユーザー体験の改善方針

### 8. CLIメッセージ設計のベストプラクティス

#### 8.1 スクリーンリーダー対応

メッセージ出力時には、視覚障害者対応を念頭に、以下を実施する：

- テキストアイコン（[✗], [!], [i]）を絵文字の代わりに使用
- 色のみに頼らず、テキストで状態を明確に示す
- リスト構造を番号付きまたは箇条書きで表現
- セクション見出しを「###」形式で階層化

#### 8.2 ローカライゼーション対応

英語・日本語両言語でのメッセージ提供を前提に設計する：

```typescript
const messages = {
  en: {
    PHASE_RESTRICTION: "Bash command blocked by phase restriction",
    CURRENT_PHASE: "Current phase:",
    PERMITTED_COMMANDS: "Permitted commands in this phase:"
  },
  ja: {
    PHASE_RESTRICTION: "Bashコマンドがフェーズ制限によりブロック",
    CURRENT_PHASE: "現在のフェーズ:",
    PERMITTED_COMMANDS: "このフェーズで許可されているコマンド:"
  }
};
```

#### 8.3 ログレベル別の出力制御

異なるログレベルに応じて、メッセージの詳細度を調整する：

| ログレベル | 用途 | 出力内容 |
|-----------|------|---------|
| ERROR | 致命的エラー | 問題・原因・解決手順（全て） |
| WARN | 警告・確認 | 問題・推奨対応 |
| INFO | 情報・進捗 | 実行内容・結果概要 |
| DEBUG | デバッグ情報 | スコープ検証詳細・内部値 |

#### 8.4 エラーメッセージの統一フォーマット

全てのエラーメッセージは以下のフォーマットに従う：

```
[アイコン] メッセージタイトル

詳細情報セクション
  ├─ 項目1: 値1
  ├─ 項目2: 値2
  └─ 項目3: 値3

セクション2
  ➤ ステップ1
  ➤ ステップ2
  ➤ ステップ3

参考リンク・コマンド:
  /workflow status
  /workflow next

終了コード: N
```

### 9. インタラクティブなメッセージ要素

ユーザーが次のアクションを迷わないよう、メッセージの最後に推奨コマンドを記載：

```
【推奨される次のアクション】
  $> /workflow status              # 現在の状態確認
  $> /workflow next                # 次フェーズへ進む
  $> /workflow reset "理由"        # 前フェーズに戻す
```

## 実装チェックリスト

### 10. メッセージ実装時の確認項目

各エラーメッセージ実装時に以下を確認する：

- [ ] メッセージ先頭に [✗]/[!]/[i] アイコンを含む
- [ ] ANSI色コード（\x1b[3XmNまたは\x1b[0m）を使用
- [ ] 現在のフェーズと進捗を表示
- [ ] ユーザー入力値（コマンド・ファイル名等）を明記
- [ ] 解決手順を3段階以上の番号付きステップで記載
- [ ] 代替コマンド・許可されるフェーズを明示
- [ ] 推奨される次のアクション（/workflow コマンド）を提示
- [ ] 終了コード（1-3）を明記
- [ ] 空行でセクションを区切っている
- [ ] 重複する表現がない（各行が独立した情報を持つ）
