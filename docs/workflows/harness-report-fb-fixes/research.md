# Research: harness-report-fb-fixes

phase: research
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/scope-definition.md

## FB-1+5: delegate-coordinator.ts Write/Edit除外

### Current Code (L120-125)

allowedToolsの構築ロジック:
- L120: buildAllowedTools(phaseGuide)がcoordinatorBase(Agent,TeamCreate,Read,Glob,Grep,Bash等)とphaseGuide.allowedToolsをマージ
- L121-124: planOnly=trueの場合のみWrite/Editをfilterで除外
- coordinatorBaseにはWrite/Editが含まれていない(coordinator-prompt.ts L22-26)
- phaseGuide.allowedToolsがWrite/Editを含むフェーズ(implementation等)ではマージ後に含まれる

### bashCategories確認

- hearing: ['readonly']
- scope_definition: ['readonly']
- research: ['readonly']
- 全フェーズにreadonlyが基底として含まれる
- readonlyのみのフェーズ判定: bashCategories.length === 1 && bashCategories[0] === 'readonly'

### 修正方針

planOnlyチェック(L121)を拡張し、readonlyのみフェーズでもWrite/Editを除外する。phaseGuideはhandleDelegateCoordinatorのL113で既に取得済み。bashCategoriesの参照コスト: なし(メモリ上のオブジェクト)。

### テスト状況

- delegate-coordinator.ts: 専用テストファイルなし。新規作成が必要。
- coordinator-prompt.ts: 専用テストファイルなし。buildAllowedTools()のユニットテストも新規作成が必要。
- テスト対象: allowedTools文字列にWrite/Editが含まれないことをアサート。

## FB-2: dod-helpers.ts テストケースID行パターン

### Current Code (isStructuralLine, L17-36)

既存パターン一覧:
1. L19: 見出し(#{1,6})
2. L20: 区切り線(---/***/___)
3. L21: コードフェンス(```)
4. L22: テーブル区切り行(|---|)
5. L23: テーブルデータ行(|.+|.+|)
6. L24: 太字ラベル(**label**:)
7. L25: リスト内太字ラベル(- **label**:)
8. L26: 短いラベル行(50文字以下で:終端) ← 重複可能性あり
9. L28: Mermaid構文キーワード
10. L30: Mermaidアロー(--> / ---)
11. L32: HTMLタグ
12. L34: シェルコマンド

### パターン重複分析

L26の短いラベルパターン `/^(?:[-*]\s+)?.{1,50}[:：]\s*$/` は行末が`:\s*$`のため、"TC-001:" はマッチするが "TC-001: テスト説明文" はマッチしない。新パターン `/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/` は行末制約なしのため、説明文付きテストケースID行もカバーする。既存パターンとの競合なし。

### checkDuplicateLines()との関係

L100-113: isStructuralLine()がtrueを返す行はcountMapに追加されない。テストケースID行が構造行として認識されれば重複チェックから除外される。

### テスト状況

- dod-helpers.ts: 専用テストファイルなし。dod-extended.test.tsがインポートしているが、isStructuralLine()の直接テストはない。新規テスト作成が必要。

## FB-4: manager-write.ts RTM ID重複時上書き

### Current Code (applyAddRTM, L126-130)

```
export function applyAddRTM(state: TaskState, entry: RTMEntry): void {
  state.rtmEntries.push(entry);
  state.updatedAt = new Date().toISOString();
  refreshCheckpointTraceability(state);
}
```

無条件pushのため同一IDで複数回呼ぶと重複する。

### RTMEntry型定義(types-core.ts)

id: string, requirement: string, designRef: string, codeRef: string, testRef: string, status: 'pending' | 'implemented' | 'tested' | 'verified'

### 呼び出し元の影響

- applyUpdateRTMStatus(L148-157): filterで同一IDの全エントリを取得・更新。重複がなくなればfilterは0or1件を返す。動作に影響なし。
- refreshCheckpointTraceability(L109-117): state.rtmEntriesをスプレッドでcheckpointにコピー。重複排除により正確なRTMが保持される。

### 修正方針

findIndex + splice方式:
```
const idx = state.rtmEntries.findIndex(e => e.id === entry.id);
if (idx !== -1) {
  state.rtmEntries.splice(idx, 1, entry);
} else {
  state.rtmEntries.push(entry);
}
```

### テスト状況

- manager-write.ts: 専用テストファイルなし。applyAddRTMの直接テストなし。新規作成が必要。

## FB-6: manager-lifecycle.ts goBack時artifactHashesクリア

### Current Code (goBack, L111-133)

L120-128の操作順序:
1. L120: completedPhasesでtargetPhaseのインデックス検索
2. L121-123: targetPhaseが見つからない場合エラー
3. L124: completedPhasesをスライスで切り詰め
4. L125: phase = targetPhase
5. L126: retryCount = {} ← クリア済み
6. L127: updatedAt更新
7. L128: updateCheckpoint()

artifactHashesはクリアされていない。goBack後に古いフェーズの成果物ハッシュが残る。

### artifactHashes型と正規化

- TaskState上のオプショナルフィールド: artifactHashes?: Record<string, string>
- normalizeForSigning(manager-write.ts L83-91): 空オブジェクトの場合deleteする。HMAC署名に影響なし。

### resetTask()との比較

L135-156: completedPhases=[], subPhaseStatus={}, retryCount={}をクリア。artifactHashesは明示的にクリアしていないが、全フェーズクリアのため成果物不整合は発生しない。goBackは部分的な巻き戻しのため、クリアが必要。

### テスト状況

- manager-lifecycle.test.ts: 存在する。recordTestFile/getTestInfo等のテスト。goBack()の直接テストは要確認だが、artifactHashesクリアのテストは確実に未存在。テスト追加が必要。
- manager-lifecycle-reset.test.ts: resetTask()のテスト。参考にできる。

## decisions

- RD-001: FB-1+5のreadonly判定はbashCategories.length===1 && bashCategories[0]==='readonly'で行う。every()を使い配列全要素が'readonly'かを確認する方法も検討したが、現行の定義では'readonly'は常に1要素なのでシンプルな判定で十分。
- RD-002: FB-2の新パターン位置はL26(短いラベル行)の直前に配置。より具体的なパターンを先に評価してearly returnさせることで、短いラベル行パターンとの重複評価を回避。
- RD-003: FB-4のfindIndex+splice方式はO(n)だがrtmEntriesは通常10件未満のため性能問題なし。Mapへの構造変更は影響範囲が大きく見送り。
- RD-004: FB-6はgoBack()のL126直後(retryCountクリアの次行)にstate.artifactHashes={}を追加。resetTask()は全クリアのため修正不要(scope-definitionの判断を維持)。
- RD-005: テストファイル新規作成が必要な対象: delegate-coordinator/coordinator-prompt, dod-helpers(isStructuralLine), manager-write(applyAddRTM)。manager-lifecycle.test.tsには既存ファイルへのテスト追加。
- RD-006: FB-1+5の判定ではphaseGuide.bashCategoriesを参照するが、phaseGuideオブジェクトはL113で既に構築済みのためコスト追加なし。planOnlyとの論理ORで統合可能。

## artifacts

- docs/workflows/harness-report-fb-fixes/research.md (this file)
- docs/workflows/harness-report-fb-fixes/scope-definition.md (input)

## next

planningフェーズで4件の修正の実装順序、テストファイル構成、各修正の具体的な差分を設計する。
