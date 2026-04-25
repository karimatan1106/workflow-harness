# スコープ管理の3つの根本原因修正 - 要件定義

## サマリー

前回タスク実行時に発生したスコープ管理の3つの問題に対する修正要件を定義する。

**対象問題:**
1. `set-scope.ts` でのpreExistingChanges消失（FIX-1）
2. `scope-validator.ts` での削除済みgit追跡ディレクトリ拒否（FIX-2）
3. `bash-whitelist.js` でのcommitフェーズrm不許可（FIX-3）

**修正アプローチ:**
- FIX-1: 既存preExistingChangesの保持ロジック追加
- FIX-2: git ls-filesフォールバックによる追跡状態確認
- FIX-3: commitフェーズホワイトリストへのrm追加

**期待効果:**
- ワークフロー開始前の変更がpreExistingChangesとして正しく記録・保持される
- 削除済みgit追跡ディレクトリをスコープに追加可能になる
- commitフェーズで一時ファイルを削除可能になる

**影響範囲:**
- 修正対象: 3ファイル（set-scope.ts、scope-validator.ts、bash-whitelist.js）
- テスト対象: 既存テストケース（set-scope.test.ts、scope-validator.test.ts、bash-whitelist.test.js）
- 副作用リスク: 低（既存動作の拡張のみ、破壊的変更なし）

## 機能要件

### FIX-1: preExistingChanges保持

**対象ファイル:** `workflow-plugin/mcp-server/src/tools/set-scope.ts:318-324`

**現在の動作:**
```typescript
// 行318-324（簡略化）
const newScope = {
  affectedFiles: [...],
  affectedDirs: [...]
  // preExistingChangesフィールドなし
};
taskState.scope = newScope; // 既存のpreExistingChangesが失われる
```

**問題:**
- `workflow_start` で記録された `taskState.scope.preExistingChanges` が消失
- `workflow_set_scope` 実行時にscopeオブジェクトが新規作成されるため
- 結果: docs_update→commit遷移時にワークフロー開始前の変更がスコープ外変更として誤検出される

**要件:**
1. `workflow_set_scope` 実行時に既存の `taskState.scope.preExistingChanges` を保持すること
2. preExistingChangesが未定義の場合は空配列をデフォルト値とすること
3. addModeの有無に関わらず常にpreExistingChangesを保持すること

**受け入れ基準:**
- `workflow_set_scope` 実行前後でpreExistingChangesの内容が変化しないこと
- preExistingChangesが未定義の場合でもエラーが発生しないこと
- addMode=trueとaddMode=falseの両方でpreExistingChangesが保持されること

**実装方針:**
```typescript
// set-scope.ts:318-324を以下のように修正
const existingPreExistingChanges = taskState.scope?.preExistingChanges || [];
const newScope = {
  affectedFiles: [...],
  affectedDirs: [...],
  preExistingChanges: existingPreExistingChanges
};
taskState.scope = newScope;
```

**テスト方針:**
- 既存テスト: `set-scope.test.ts` のテストケースを確認（破壊的変更がないこと）
- 新規テスト: workflow_set_scope実行前後でpreExistingChangesが保持されることを検証

### FIX-2: git追跡ディレクトリのスコープ追加許可

**対象ファイル:** `workflow-plugin/mcp-server/src/validation/scope-validator.ts:160-162`

**現在の動作:**
```typescript
// 行160-162（簡略化）
if (!fs.existsSync(dir)) {
  throw new Error(`ディレクトリが存在しません: ${dir}`);
}
```

**問題:**
- git追跡済みだがディスクから削除されたディレクトリをスコープに追加できない
- fs.existsSync()のみを使用し、git追跡状態を確認していない
- 結果: remotionディレクトリ（削除済み）をスコープに追加しようとしてエラーが発生

**要件:**
1. fs.existsSync()がfalseでも、git追跡対象であればスコープ追加を許可すること
2. git ls-filesコマンドでディレクトリ配下のファイルが追跡されているか確認すること
3. git追跡状態の確認が失敗した場合は従来通りfs.existsSync()の結果を使用すること

**受け入れ基準:**
- git追跡済みで削除済みのディレクトリをスコープに追加できること
- gitリポジトリではないプロジェクトでも既存動作が維持されること
- git ls-filesの実行エラーが適切にハンドリングされること

**実装方針:**
```typescript
// scope-validator.ts:160-162を以下のように修正
if (!fs.existsSync(dir)) {
  // フォールバック: git追跡状態を確認
  const gitTracked = await checkGitTracked(dir);
  if (!gitTracked) {
    throw new Error(`ディレクトリが存在しません: ${dir}`);
  }
}

async function checkGitTracked(dir: string): Promise<boolean> {
  try {
    const result = execSync(`git ls-files "${dir}"`, { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch (error) {
    return false; // gitコマンドが失敗した場合はfalse
  }
}
```

**テスト方針:**
- 既存テスト: `scope-validator.test.ts` のテストケースを確認
- 新規テスト: git追跡済み削除ディレクトリの追加を検証
- 新規テスト: 非gitリポジトリでの既存動作維持を検証

### FIX-3: commitフェーズのrm許可

**対象ファイル:** `workflow-plugin/hooks/bash-whitelist.js:87-90`

**現在の動作:**
```javascript
// 行87-90（簡略化）
const PHASE_COMMANDS = {
  commit: ['git'],
  // rmが含まれていない
};
```

**問題:**
- commitフェーズで一時ファイル（scope-placeholder.md等）を削除できない
- phase-edit-guardがrmコマンドをブロックする
- build_checkフェーズではrmが許可されているが、commitでは不許可

**要件:**
1. commitフェーズでrmコマンドを使用可能にすること
2. rmの対象は一時ファイルのみに限定すること（*.md、.tmp/配下等）
3. ソースコードやテストファイルの削除は引き続き禁止すること

**受け入れ基準:**
- commitフェーズでrm -f scope-placeholder.mdが実行可能なこと
- rmによるソースコード削除は引き続きブロックされること
- 既存のcommitフェーズ動作に副作用がないこと

**実装方針（案1: gitカテゴリにrm追加）:**
```javascript
// bash-whitelist.js:87-90を修正
const PHASE_COMMANDS = {
  commit: ['git', 'rm'], // rmを追加
};
```

**実装方針（案2: 専用カテゴリ作成）:**
```javascript
// bash-whitelist.js に新規カテゴリを追加
const COMMAND_CATEGORIES = {
  cleanup: ['rm -f', 'rm -rf .tmp/'], // 一時ファイル削除専用
};
const PHASE_COMMANDS = {
  commit: ['git', 'cleanup'],
};
```

**推奨案:** 案1（シンプルで既存構造を変更しない）

**テスト方針:**
- 既存テスト: `bash-whitelist.test.js` のテストケースを確認
- 新規テスト: commitフェーズでrm実行可能なことを検証
- 新規テスト: rmによるソースコード削除がブロックされることを検証（phase-edit-guardで制御）

## 非機能要件

### パフォーマンス

**FIX-1:**
- preExistingChanges配列のコピー処理が追加されるが、配列サイズは通常100ファイル未満
- スプレッド構文による浅いコピーで十分（ディープコピー不要）
- パフォーマンス影響: 無視できる（< 1ms）

**FIX-2:**
- git ls-filesコマンドの実行が追加される
- 実行頻度: ディレクトリがディスク上に存在しない場合のみ（稀）
- 実行時間: 通常100ms未満（リポジトリサイズに依存）
- フォールバック機構により、gitが存在しない環境でも既存動作を維持

**FIX-3:**
- ホワイトリスト配列に要素を1つ追加するのみ
- パフォーマンス影響: なし

### 可用性

**FIX-1:**
- preExistingChangesが未定義の場合のデフォルト値を設定することで、既存タスクとの互換性を維持
- 副作用: なし

**FIX-2:**
- git ls-filesの実行エラーをcatchし、falseを返すことでフォールバック
- gitが存在しない環境でもfs.existsSync()の結果を使用するため、既存動作を破壊しない
- 副作用: なし

**FIX-3:**
- rmコマンドの許可により、commitフェーズの柔軟性が向上
- phase-edit-guardによるファイル編集制御は引き続き有効
- 副作用リスク: 低（commitフェーズでは既にファイル編集が禁止されている）

### セキュリティ

**FIX-1:**
- preExistingChanges配列の内容を変更せず保持するのみ
- セキュリティリスク: なし

**FIX-2:**
- git ls-filesコマンドの引数にユーザー入力を使用するため、コマンドインジェクションリスクあり
- 対策: パス文字列をダブルクォートで囲み、特殊文字をエスケープ
- 追加対策: execSyncのオプションでshell: falseを使用（可能であれば）

**FIX-3:**
- rmコマンドの許可により、意図しない削除のリスクが増加
- 対策: phase-edit-guardによるファイル編集制御が引き続き有効
- 追加対策: commitフェーズでは編集可能ファイルが「なし」に設定されているため、rmで削除できるのは一時ファイルのみ

### 保守性

**FIX-1:**
- preExistingChanges保持ロジックを1箇所に集約
- 将来的にscopeオブジェクトにフィールドを追加する場合も同様の方法で対応可能
- コードの可読性: 向上（スプレッド構文で明示的に保持）

**FIX-2:**
- git追跡状態確認ロジックを独立した関数として分離
- 他のバリデーションでも再利用可能
- コードの可読性: 向上（フォールバック機構が明示的）

**FIX-3:**
- bash-whitelist.jsの既存構造に従い、最小限の変更で実装
- コードの可読性: 維持（既存パターンを踏襲）

## 受け入れ基準

### FIX-1: preExistingChanges保持

#### 機能テスト

1. **基本動作:**
   - [ ] workflow_start でpreExistingChangesが記録される
   - [ ] workflow_set_scope 実行後もpreExistingChangesが保持される
   - [ ] preExistingChanges配列の内容が変化していない

2. **エッジケース:**
   - [ ] preExistingChangesが未定義の状態でworkflow_set_scopeを実行してもエラーが発生しない
   - [ ] preExistingChangesが空配列の状態で動作する
   - [ ] addMode=trueとaddMode=falseの両方で動作する

3. **統合テスト:**
   - [ ] docs_update→commit遷移時にワークフロー開始前の変更がブロックされない
   - [ ] scope外変更の検出が正常に機能する

#### 非機能テスト

1. **パフォーマンス:**
   - [ ] preExistingChanges配列のコピー処理が1ms未満で完了する

2. **後方互換性:**
   - [ ] 既存のワークフローが正常に動作する
   - [ ] 既存のテストケースが全てパスする

### FIX-2: git追跡ディレクトリのスコープ追加許可

#### 機能テスト

1. **基本動作:**
   - [ ] git追跡済みで削除済みのディレクトリをスコープに追加できる
   - [ ] git ls-filesが正常に実行される
   - [ ] git追跡されているファイルが検出される

2. **エッジケース:**
   - [ ] gitリポジトリではないプロジェクトで既存動作が維持される
   - [ ] git ls-filesの実行エラーが適切にハンドリングされる
   - [ ] git ls-filesが空文字列を返す場合にfalseが返される

3. **統合テスト:**
   - [ ] remotionディレクトリ（削除済み）をスコープに追加できる
   - [ ] 削除済みディレクトリのファイルがgit diffに表示される場合に正常に処理される

#### 非機能テスト

1. **パフォーマンス:**
   - [ ] git ls-filesの実行時間が100ms未満である（通常のリポジトリサイズ）
   - [ ] フォールバック機構によるオーバーヘッドが無視できる

2. **セキュリティ:**
   - [ ] パス文字列のエスケープが正しく行われる
   - [ ] コマンドインジェクション攻撃が不可能である

3. **後方互換性:**
   - [ ] 既存のスコープ追加動作に副作用がない
   - [ ] 既存のテストケースが全てパスする

### FIX-3: commitフェーズのrm許可

#### 機能テスト

1. **基本動作:**
   - [ ] commitフェーズでrm -f scope-placeholder.mdが実行可能である
   - [ ] phase-edit-guardがrmコマンドを許可する
   - [ ] 一時ファイルの削除が正常に完了する

2. **エッジケース:**
   - [ ] rmによるソースコード削除は引き続きブロックされる（phase-edit-guardで制御）
   - [ ] rmによるテストファイル削除は引き続きブロックされる
   - [ ] rm -rfによる再帰削除も許可される（一時ディレクトリ削除用）

3. **統合テスト:**
   - [ ] commitフェーズで一時ファイルを削除後、git commitが正常に実行される
   - [ ] 他のフェーズではrmが引き続き制御される

#### 非機能テスト

1. **セキュリティ:**
   - [ ] phase-edit-guardによるファイル編集制御が引き続き有効である
   - [ ] commitフェーズでの意図しない削除が防止される

2. **後方互換性:**
   - [ ] 既存のcommitフェーズ動作に副作用がない
   - [ ] 既存のテストケースが全てパスする

## 制約事項

### 技術的制約

1. **Node.js互換性:**
   - Node.js 18以上を前提（execSyncの使用）
   - 非同期処理の追加により、scope-validator.tsの関数シグネチャが変更される可能性

2. **Git依存性:**
   - FIX-2はgitコマンドが利用可能な環境を前提とする
   - gitが存在しない環境ではフォールバックにより既存動作を維持

3. **ファイルシステム:**
   - FIX-2はシンボリックリンクの追跡をサポートしない（git ls-filesの制限）
   - FIX-3はcommitフェーズの編集可能ファイル定義に依存

### 運用上の制約

1. **テストカバレッジ:**
   - 既存テストケースの破壊的変更を避けるため、新規テストは最小限に留める
   - 統合テストは手動実行が必要（CI/CDパイプラインの設定が必要）

2. **デプロイ:**
   - MCPサーバーの再起動が必要（モジュールキャッシュのクリア）
   - 実行中のワークフロータスクには影響しない（新規タスクから適用）

3. **ドキュメント更新:**
   - CLAUDE.mdのスコープ管理セクションを更新
   - 既知の問題リストからFIX-1、FIX-2、FIX-3を削除

## 影響範囲分析

### 修正対象ファイル

| ファイル | 修正箇所 | 影響度 |
|---------|---------|--------|
| `workflow-plugin/mcp-server/src/tools/set-scope.ts` | 行318-324 | 低（1箇所のみ） |
| `workflow-plugin/mcp-server/src/validation/scope-validator.ts` | 行160-162 | 中（新規関数追加） |
| `workflow-plugin/hooks/bash-whitelist.js` | 行87-90 | 低（配列に要素追加） |

### 依存ファイル

| ファイル | 関係 | 影響 |
|---------|------|------|
| `workflow-plugin/mcp-server/src/tools/start.ts` | preExistingChanges記録元 | なし（読み取りのみ） |
| `workflow-plugin/mcp-server/src/tools/next.ts` | scope検証呼び出し元 | なし（インターフェース不変） |
| `workflow-plugin/hooks/phase-edit-guard.js` | rmコマンド制御 | なし（既存制御を維持） |

### テストファイル

| ファイル | 修正必要性 | 理由 |
|---------|-----------|------|
| `workflow-plugin/mcp-server/src/tools/set-scope.test.ts` | 必須 | preExistingChanges保持テストを追加 |
| `workflow-plugin/mcp-server/src/validation/scope-validator.test.ts` | 必須 | git追跡ディレクトリテストを追加 |
| `workflow-plugin/hooks/bash-whitelist.test.js` | 任意 | rmコマンド許可テストを追加（既存テストで十分な可能性） |

## リスク分析

### 高リスク項目（発生確率: 低、影響度: 高）

**なし**

### 中リスク項目（発生確率: 中、影響度: 中）

**FIX-2: git ls-filesのパフォーマンス:**
- 大規模リポジトリ（100万ファイル以上）でgit ls-filesが遅延する可能性
- 軽減策: タイムアウト設定（1秒）を追加し、タイムアウト時はfalseを返す
- フォールバック: fs.existsSync()の結果を使用

### 低リスク項目（発生確率: 低、影響度: 低）

**FIX-1: preExistingChanges配列のメモリ使用量:**
- preExistingChanges配列が大量のファイルを含む場合にメモリ使用量が増加
- 現実的な影響: 無視できる（100ファイル × 100バイト = 10KB程度）

**FIX-3: rmコマンドの誤用:**
- commitフェーズで意図しないファイルを削除する可能性
- 軽減策: phase-edit-guardによる編集可能ファイル制御が引き続き有効
- ユーザーへの注意喚起: ドキュメントにrmの使用方法を明記

## 次フェーズへの引き継ぎ事項

### planningフェーズで検討すべき項目

1. **実装順序:**
   - FIX-1 → FIX-2 → FIX-3の順で実装（依存関係なし）
   - 各修正を独立したコミットとして管理

2. **テスト戦略:**
   - 各修正のユニットテストを作成
   - 統合テストは既存ワークフローの実行で検証

3. **セキュリティ考慮:**
   - FIX-2のgit ls-filesコマンドインジェクション対策を実装
   - パス文字列のサニタイズ方法を決定

### test_designフェーズで作成すべきテストケース

1. **FIX-1:**
   - workflow_set_scope後のpreExistingChanges保持テスト
   - 未定義preExistingChangesのデフォルト値テスト

2. **FIX-2:**
   - git追跡済み削除ディレクトリの追加テスト
   - gitコマンドエラーハンドリングテスト
   - 非gitリポジトリでの既存動作維持テスト

3. **FIX-3:**
   - commitフェーズでのrm実行テスト
   - phase-edit-guardとの統合テスト

## 参考資料

### 関連ドキュメント

- `C:\ツール\Workflow\CLAUDE.md` - ワークフローフェーズ定義
- `C:\ツール\Workflow\docs\workflows\スコ-プ管理の3つの根本原因修正\research.md` - 調査結果

### 関連Issue

前回タスク「構造的問題9件の根本原因修正」で発生したSCOPE_STRICTブロック問題

### 変更履歴

| 日付 | 版 | 変更内容 |
|------|-----|---------|
| 2026-02-16 | 1.0 | 初版作成 |
