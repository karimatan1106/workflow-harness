# 設計-実装整合性の自動検証機能 調査結果

## 1. 既存ワークフロー設計書フォーマット調査

### 1.1 設計書の配置先と構成

全ての設計書は `docs/workflows/{taskName}/` 以下に標準化されている。

| ファイル | 形式 | 目的 |
|---------|------|------|
| research.md | Markdown | 既存実装分析・技術調査 |
| requirements.md | Markdown | 機能要件・受け入れ基準 |
| spec.md | Markdown | 技術仕様・実装設計 |
| state-machine.mmd | Mermaid | UI/ビジネスロジック状態遷移 |
| flowchart.mmd | Mermaid | 処理フロー設計 |
| ui-design.md | Markdown | UI設計・画面仕様 |
| test-design.md | Markdown | テスト設計・テストケース |

### 1.2 抽出可能な設計項目

**Requirements.md から:**
- 機能要件: `FR-N.M` 形式
- 非機能要件: `NFR-N.M` 形式
- 受け入れ基準: `AC-N.M` 形式、`- [ ]` チェックボックス

**Spec.md から:**
- クラス定義: `class ClassName:`
- メソッド: `def method_name(...)`
- ファイルパス: `src/...` パターン

**State Machine から:**
- 状態: `StateA --> StateB`
- 遷移条件: `:` 右側の文字列

**Flowchart から:**
- プロセス: `ID[Label]`
- 決定点: `ID{Decision?}`
- サブグラフ: `subgraph Name ... end`

## 2. workflow_next ツールの仕組み

### 2.1 フェーズ遷移フロー

```
1. タスク取得
   ↓
2. 完了確認（phase !== 'completed'）
   ↓
3. 承認チェック（requiresApproval()）
   ↓
4. 並列フェーズの完了確認
   ↓
5. 次フェーズ取得
   ↓
6. フェーズ更新
```

### 2.2 統合ポイント

`stateManager.updateTaskPhase()` の前にバリデーション挿入可能。

### 2.3 既存のブロック条件

```typescript
// 並列フェーズの完了確認
if (isParallelPhase(currentPhase)) {
    const incomplete = stateManager.getIncompleteSubPhases(taskId);
    if (incomplete.length > 0) {
        return { success: false, message: '未完了サブフェーズがあります' };
    }
}

// 承認チェック
if (requiresApproval(currentPhase)) {
    return { success: false, message: '承認が必要です' };
}
```

## 3. 既存フック仕組み

### 3.1 phase-edit-guard.js

- PreToolUseフック
- Edit/Write/Bashツールの使用を監視
- フェーズごとに編集可能なファイルタイプを制限
- readOnlyフェーズではファイル編集を全面禁止

### 3.2 エラーシステム

```typescript
return {
    success: false,
    message: '設計項目の以下が未完了です: ...',
    details: { missingItems: [...] }
};
```

## 4. 設計項目の抽出方法

### 4.1 正規表現パターン

**Requirements:**
```regex
/(FR|NFR|AC)-(\d+)\.(\d+)/  # ID抽出
/^- \[([ x])\] (.+)$/       # チェックボックス
```

**State Machine:**
```regex
/(\w+)\s*-->\s*(\w+)(?:\s*:\s*(.+))?/  # 遷移
```

**Flowchart:**
```regex
/(\w+)\[(.+?)\]/   # プロセス
/(\w+)\{(.+?)\}/   # 決定点
```

**Specification:**
```regex
/class (\w+):/     # クラス
/def (\w+)\(/      # メソッド
/src\/[^\s`]+/     # ファイルパス
```

## 5. 検証ロジック案

```
[workflow_next 呼び出し]
    ↓
[現在フェーズを確認]
    ↓
implementation フェーズ → requirements フェーズ の間?
    ↓ YES
[設計ファイル全チェック]
    ├─ spec.md: 実装対象が明確か
    ├─ state-machine.mmd: 完成しているか
    ├─ flowchart.mmd: 完成しているか
    └─ requirements.md: 受け入れ基準が定義されているか
    ↓
[チェック結果]
    ├─ OK → 次フェーズへ進行
    └─ NG → エラーメッセージと共にブロック
```

## 6. 推奨実装アプローチ

### Phase 1 (必須)
1. 設計項目抽出パーサー作成
2. implementation開始前の設計完了チェック
3. code_review時の設計-実装照合

### Phase 2 (推奨)
1. Mermaid図の完成度検証
2. 未実装項目の自動リスト化
3. 警告モード/厳格モードの切り替え

### Phase 3 (オプション)
1. コード内 `@spec` コメント自動検証
2. 設計変更時の影響分析
3. 実装進捗の可視化ダッシュボード
