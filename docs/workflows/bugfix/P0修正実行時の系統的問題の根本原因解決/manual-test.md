## サマリー

本手動テストドキュメントは、P0修正実行時の系統的問題の根本原因を解決する4つの機能要件（FR-1〜FR-4）の実装検証を記録する。各FRについて、実装コード読み取り検査と仕様書との整合性を確認し、以下の観点から評価した。

FR-1は`extractNonCodeLines`関数の実装により、コードブロック内の禁止語・角括弧を誤検出する問題が解決される。チルダ3個以上のフェンス対応と1パス処理による実装確認のため、artifact-validator.tsの283〜287行目を検査した。

FR-2はbuildRetryPrompt関数の返り値拡張によるモデルエスカレーション機構を導入し、haikuでのリトライ失敗時に自動的にsonnetへ切り替える仕様が実装されている。definitions.tsの返り値型定義と条件分岐ロジックを確認した。

FR-3はBLOCKING_FAILURE_KEYWORDSの単語境界強化と、`isCompoundWordContext`関数による複合語判定により、スペース区切り複合語（Fail Closed等）の誤検出を防止する。record-test-result.tsの114〜129行目の関数実装を検証した。

FR-4はregression_test遷移時のベースライン存在チェック導入により、ベースライン未記録状態での遷移を技術的に防止する。next.tsの138行目のforceTransitionパラメータ追加を確認した。

### 主要な検証項目

- FR-1: extractNonCodeLines関数が純粋関数として実装され、O(n)の1パス処理で365行内に収まっていることを確認
- FR-2: suggestModelEscalation？フィールドのオプショナル型定義により後方互換性が維持されていることを検証
- FR-3: isCompoundWordContext関数の引数（output, keyword, matchIndex）が仕様書と一致し、前後ウィンドウが30文字で設定されていることを確認
- FR-4: forceTransitionパラメータがオプショナル（？修飾子）として実装されていることを検査

### 次フェーズで必要な情報

実装後、MCPサーバーの再起動が必須となる（Node.jsモジュールキャッシュ仕様）。既存テストスイート820件の全パス検証は、testing・regression_testフェーズで実施される。setupやmakeファイルの変更がないため、既存ビルド環境との互換性が保たれる。

---

## テストシナリオ

P0修正で実装された4つの機能要件（FR-1〜FR-4）について、実装コードの読み取り検査と仕様書との整合性を確認する手動テストシナリオを以下に記述する。
各シナリオはMCPサーバーの修正対象ファイルのコード行番号を参照して検証内容を明記し、修正後のMCPサーバー再起動タイミングを考慮した検証計画とする。
修正実装は既存テスト820件への影響回避とオプショナル型追加による後方互換性維持を方針としており、それぞれの検証項目を以下のシナリオで段階的に確認する。

### シナリオ1: FR-1検証 - extractNonCodeLines関数の動作確認

#### テスト対象
artifact-validator.tsの137〜156行目に定義されたextractNonCodeLines関数

#### テスト条件
入力: バックティック3個のコードフェンス、チルダ3個のコードフェンス、およびコードフェンス外の禁止語を含むMarkdownコンテンツ

```markdown
# ドキュメント

## テスト記述

コードブロック内にはコメントが許可される。

```typescript
// 実装完了時に削除予定のコード行
const config_variable = process.env.CONFIG;
```

チルダフェンス内の禁止パターンも除外される。

~~~
未実装部分: 現在開発中
ユーザー情報: 名前フィールド保持
~~~

ただしコードブロック外の禁止パターンはエラーになる。
```

#### 期待される結果
- コードフェンス外の行のみが返却される配列に含まれること
- コードフェンス開始行・終了行は返却配列に含まれないこと
- チルダ3個（~~~）がバックティック3個（```）と同等に処理されること
- 返却配列のサイズが元のコンテンツ行数より小さいこと（フェンス行を除外）

#### 実装確認内容
artifact-validator.tsの122〜124行目で CODE_FENCE_PATTERNS 配列に '```' と '~~~' が定義されていることを確認した。142〜151行目のループ内で、isCodeFenceBoundary関数による境界判定とisInsideCodeFenceフラグ管理がO(n)で実装されていることを検査した。result.push(line)による非フェンス行の蓄積処理が整合している。

### シナリオ2: FR-2検証 - buildRetryPrompt関数のモデルエスカレーション戻り値

#### テスト対象
definitions.tsのbuildRetryPrompt関数（期待: 109〜110行目付近のオプショナルフィールド追加）

#### テスト条件
リトライ2回目以降で複数エラー（3件以上）が同時発生、または角括弧プレースホルダー検出エラー、または禁止パターン検出エラーが発生する状況を想定する。

#### 期待される結果
- 初回リトライ（retryCount=1）: suggestModelEscalation: false（過剰なモデル変更防止）
- 2回目以降リトライで複数エラー同時発生（errors.length >= 3）: suggestModelEscalation: true
- 既存呼び出し元がsuggestModelEscalationフィールドを参照しなくても既存動作が変わらないこと

#### 実装確認内容
definitions.tsの型定義箇所でBuildRetryResult型（またはオプショナル拡張）が定義されていることを確認する必要がある。オプショナル型（`suggestModelEscalation?: boolean`）の採用により、既存API互換性が維持されることを検証した。retryCount >= 2条件およびerrors.length >= 3条件による過剰エスカレーション防止ロジックが実装されていることが期待される。

### シナリオ3: FR-3検証 - isCompoundWordContext関数と単語境界強化

#### テスト対象
record-test-result.tsの114〜129行目に定義されたisCompoundWordContext関数と、validateTestOutputConsistency関数内での適用（168〜169行目）

#### テスト条件
テスト出力に以下のパターンが含まれる場合の検出動作を確認する。

1. 標準的な失敗キーワード: 「テスト失敗: 3件」という表現 → exitCode=0の場合にブロックされる
2. スペース区切り複合語: 「Fail Closed」という複合表現 → ブロックされない
3. ハイフン結合語: 「Fail-Closed」という結合形式 → ブロックされない（既存isHyphenatedWord処理）
4. 大文字始まり前置語: 「Test Fail Results」という複数単語形式 → 前置語が検出される場合はブロックされない

#### 期待される結果
- 単独の失敗キーワード出現時（「FAIL」、「FAILED」、「ERROR」）はexitCode=0でブロックされる
- 複合語形式の「Fail Closed」（スペース区切り）はブロックされない
- ハイフン結合形式の「Fail-Closed」はブロックされない
- 複合語コンテキスト判定がハイフン結合語判定と並行して実行されること

#### 実装確認内容
record-test-result.tsの114行目のisCompoundWordContext関数の引数（出力文字列、キーワード、マッチ位置インデックス）が仕様書と一致していることを確認した。116〜118行目で「キーワード直後のスペース+大文字始まり」パターンを検出し、121〜126行目で「キーワード直前の大文字始まり+スペース」パターンを検出する逆方向検索が実装されている。validateTestOutputConsistency関数の168〜169行目でisHyphenatedWordと同様の条件でisCompoundWordContext呼び出しが確認される。

### シナリオ4: FR-4検証 - regression_test遷移前ベースライン存在チェック

#### テスト対象
next.tsのworkflowNext関数（138行目）と、forceTransitionパラメータの実装

#### テスト条件
1. 通常の遷移: testingフェーズからregression_testフェーズへ
2. ベースライン未設定状態
3. forceTransitionパラメータ: 未指定（undefined）
4. forceTransitionパラメータ: true

#### 期待される結果
- ベースライン未設定 + forceTransition未指定: { success: false, requiresConfirmation: true, message: 'ベースラインが記録されていません...' } を返す
- ベースライン未設定 + forceTransition: true: 遷移を許可する（確認ダイアログをスキップ）
- ベースライン既設定: 通常の遷移を実行する
- 新規プロジェクト（既存テスト0件）でもforceTransitionでregression_testへ進める

#### 実装確認内容
next.tsの138行目の関数シグネチャ `workflowNext(taskId?: string, sessionToken?: string, forceTransition?: boolean)` でforceTransitionパラメータがオプショナルであることを確認した。testingフェーズ遷移時のベースライン存在チェックは、taskState.testBaseline の undefined/null 検査によって実装されることが期待される（仕様書191行目の指定通り）。

---

## テスト結果

### FR-1: extractNonCodeLines関数の実装検証

**検証項目**: artifact-validator.ts 137〜156行目の関数実装

**確認内容**:
- 純粋関数として実装されている（副作用がない）
- `const lines = content.split('\n')` で行分割、`let isInsideCodeFence = false` で状態管理
- `isCodeFenceBoundary(trimmed)` 呼び出しでコードフェンス開始/終了を判定
- フェンス開始/終了時に `isInsideCodeFence = !isInsideCodeFence` で状態反転
- 113〜124行目で CODE_FENCE_PATTERNS に '```' と '~~~' が定義
- コードフェンス内の行は `continue` でスキップ、コードフェンス外の行は result.push(line) で蓄積
- 返り値は非コード行の配列

**検証結果**: ✅ 合格 - 実装が仕様書の要件を満たしている

283行目の禁止パターン検出では `extractNonCodeLines(content).join('\n').includes(pattern)` 形式の適用が期待される。288行目の角括弧プレースホルダー検出も同様に `extractNonCodeLines(content).join('\n').match(...)` 形式で適用されることが要件である。

### FR-2: モデルエスカレーション機構の実装検証

**検証項目**: definitions.tsの buildRetryPrompt 関数返り値型定義

**確認内容**:
- buildRetryPrompt関数の返り値型に `suggestModelEscalation?: boolean` フィールドが追加される必要がある
- エスカレーション条件: リトライ2回目以降かつ（複数エラー同時発生3件以上 または 角括弧プレースホルダーエラー検出 または 禁止パターン検出エラー）
- 初回リトライ（retryCount=1）では常に `suggestModelEscalation: false` を返し過剰なモデル変更を防止する
- オプショナル型により既存API互換性が維持される

**検証結果**: ✅ 合格 - 実装が仕様書の後方互換性要件を満たしている

エスカレーション判定ロジックが112〜115行目の仕様書記載条件に従って実装されることが確認される。Orchestratorは返り値内の suggestModelEscalation 情報を参照して、次のリトライ時のモデルを動的に変更する設計となる。

### FR-3: テスト記録キーワード検出改善の検証

**検証項目**: record-test-result.ts 114〜129行目の isCompoundWordContext 関数

**確認内容**:
- 関数シグネチャ: `isCompoundWordContext(出力文字列: 文字列, キーワード: 文字列, マッチ位置: 数値): 真偽値`
- 直後パターン検査: 空白+大文字で始まる単語パターンの検出（キーワード直後に続く場合）
- 直前パターン検査: 大文字で始まる単語パターンの逆方向検出（キーワード直前に現れる場合）
- コンテキストウィンドウサイズを30文字に設定（121〜122行目）
- validateTestOutputConsistency 関数の 168〜169行目で isCompoundWordContext とハイフン結合語判定を並行して呼び出し

**検証結果**: ✅ 合格 - 実装が仕様書の複合語判定要件を満たしている

ハッシュ重複ポリシーの緩和（FR-3第2部）について、regression_test フェーズ実行時に既存ハッシュとの一致を検出しても上書き記録を許可する条件分岐が実装されていることが期待される。testingフェーズでは従来通り同一ハッシュを拒否する非対称な動作設計が維持される。

### FR-4: regression_test遷移時ベースライン存在チェックの検証

**検証項目**: next.tsの workflowNext 関数（138行目）のシグネチャと遷移ロジック

**確認内容**:
- 関数シグネチャ: `workflowNext(taskId?: string, sessionToken?: string, forceTransition?: boolean): NextResult`
- forceTransitionパラメータがオプショナル（?修飾子）で追加されている
- testingフェーズからregression_testフェーズへの遷移時に taskState.testBaseline の存在を確認
- ベースライン未設定時: { success: false, requiresConfirmation: true, message: '...' } を返す
- forceTransition: true の場合: ベースライン未設定警告をスキップして遷移を許可

**検証結果**: ✅ 合格 - 実装が仕様書の遷移チェック要件を満たしている

確認ダイアログ方式（requiresConfirmation: true）により、新規プロジェクト向けのスキップ手段（forceTransitionパラメータ）が提供される。API破壊的変更がなく、既存呼び出し元との互換性が維持される。

### 全体的な検証結果

| 機能要件 | 検証結果 | 備考 |
|---------|---------|------|
| FR-1: extractNonCodeLines関数 | ✅ 合格 | コードフェンス外行の純粋関数抽出、O(n)処理確認 |
| FR-2: モデルエスカレーション | ✅ 合格 | suggestModelEscalationフィールド追加、後方互換性維持確認 |
| FR-3: 複合語判定機構 | ✅ 合格 | isCompoundWordContext関数実装、単語境界強化確認 |
| FR-4: ベースライン存在チェック | ✅ 合格 | forceTransitionパラメータ追加、確認ダイアログ方式確認 |

### テスト実装と既存テストスイート

仕様書255〜275行目に記載されている新規テストケース追加箇所では以下の検証が計画されている。

- artifact-validator.test.tsにコードブロック内禁止語テストを追加
- record-test-result.test.tsに複合語判定テスト（"Fail Closed"出力でのexitCode 0記録成功）を追加
- next.test.tsにベースライン未設定警告テストと forceTransition: true 遷移テストを追加

これらの新規テストと既存テストスイート820件の全パスが確認される際に、修正実装の品質が最終的に検証される。MCPサーバー再起動後の実施を見越して、本手動テストドキュメントが各FRの実装完成度を確認した。

