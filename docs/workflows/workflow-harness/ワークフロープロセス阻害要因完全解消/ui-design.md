# UI設計: エラーメッセージ出力の標準化

## サマリー

本ドキュメントではN-2修正（phase-edit-guard.jsのstderr出力完全化）で実装される4つのエラーメッセージの設計を規定する。
メッセージの文言は既存のdisplayBlockMessage関数で採用されている標準フォーマットに準拠し、ユーザー向けの明確なフィードバックを提供する。
Bashホワイトリスト違反、Fail Closed、stdin読み込みエラー、JSON解析エラーの各ケースについて、
エラーメッセージの内容、表示タイミング、出力先を統一的に定義する。
これらメッセージによりClaude Codeが適切なエラー表示をできるようになり、
ユーザーのデバッグ効率が向上する。

## メッセージ設計の基本方針

### 既存フォーマットの継承

phase-edit-guard.jsのdisplayBlockMessage関数で採用されているフォーマット：

```
Hook validation failed ({理由}): {詳細説明}
```

新規追加メッセージもこのフォーマットに統一し、ユーザーが「Hook validation failed」で一貫性のあるエラー識別ができるようにする。
メッセージ出力先はconsole.error固定とし、stderr経由でClaude Codeに確実に伝達される。

### エラー分類の観点

4つのメッセージをエラーの発生箇所と性質で分類：

| メッセージ | エラー箇所 | 分類 | 重大度 |
|-----------|----------|------|--------|
| Bashホワイトリスト違反 | コマンド検証ステップ | 動的バリデーション | 高 |
| Fail Closed | 予期しない例外 | システムエラー | 中 |
| stdin読み込みエラー | 入力ストリーム処理 | I/Oエラー | 中 |
| JSON解析エラー | ペイロード処理 | バリデーションエラー | 中 |

重大度の高いBashホワイトリスト違反は、既存実装により詳細な情報（違反コマンド例）を含める。
他の3メッセージは、ユーザー操作の不正よりも実装上の問題を示唆するため、簡潔で対応方法を明確にする。

## エラーメッセージ詳細設計

### メッセージ1: Bashホワイトリスト違反（行1595-1612）

**出力形式**:

```
Hook validation failed (Bash whitelist): Your command contains disallowed Bash patterns: {パターン}. Please contact the plugin administrator for whitelist updates.
```

**実装コード**:

```javascript
console.error(`Hook validation failed (Bash whitelist): Your command contains disallowed Bash patterns: ${disallowedPatterns.join(', ')}. Please contact the plugin administrator for whitelist updates.`);
```

**説明**:

- 既存のdisplayBlockMessage関数で採用されているフォーマットと完全一致
- `{パターン}`部分には違反した具体的なBashパターンが挿入される
- 理由部分を「(Bash whitelist)」に統一し、他のエラーとの区別を容易にする
- 詳細説明では違反内容を明示し、ユーザーが違反原因を特定できるようにする
- 最後の「contact the plugin administrator」は、ホワイトリスト追加が必要な場合の対応方法を示唆する
- 表示例: `Hook validation failed (Bash whitelist): Your command contains disallowed Bash patterns: >> /dev/null, tee. Please contact the plugin administrator for whitelist updates.`

**エラー発生のトリガー条件**:

- phase-edit-guardが実行するBashコマンドにホワイトリスト外のパターンが含まれた場合
- git add等の標準操作の前後に手動でコマンド実行時（ユーザーが直接トリガー）
- Claude Code外のターミナルコマンド実行は対象外（フック対象外）

**ユーザーへの指導内容**:

このエラー発生時のユーザーへの指導：
1. 違反パターンを特定（エラーメッセージのパターン名を確認）
2. そのパターンがセキュリティリスクでない場合のみホワイトリスト追加をリクエスト
3. ドキュメント「設計禁止パターン」をCLAUDE.mdで確認して動作確認

### メッセージ2: Fail Closed（行1859-1862）

**出力形式**:

```
Hook validation failed unexpectedly. Please check hook configuration.
```

**実装コード**:

```javascript
} catch (err) {
  // N-2: Output error message to stderr for user visibility
  console.error('Hook validation failed unexpectedly. Please check hook configuration.');
  process.exit(2); // Fail Closed
}
```

**説明**:

- phase-edit-guardの予期しない例外をキャッチするcatchブロック用
- メッセージは最小限の情報提示にとどめ、詳細はログ出力に委譲（分離の原則）
- 理由括弧を省略し、「unexpected」という表現で異常系の発生を示唆する
- 「hook configuration」を指示することで、ユーザーが誤設定を疑うようにガイド
- 表示例: `Hook validation failed unexpectedly. Please check hook configuration.`
- process.exit(2)の直前に出力するため、stderr確実出力が保証される

**エラー発生のトリガー条件**:

- phase-edit-guard.jsの実装にバグがあり、予期しない例外が発生
- 実装は正常だが、実行環境の問題（Node.jsバージョン互換性等）で異常発生
- getHookConfigの結果がnull/undefinedで、後続アクセスで例外発生

**ユーザーへの指導内容**:

このエラー発生時のユーザーへの指導：
1. `.claude/settings.json`の`hooks`セクション定義が正しいか確認
2. `phase-edit-guard.js`ファイルの存在と読み取り権限を確認
3. Claude Code再起動で一時的なメモリ破損が回復するか試行
4. 上記対応で解決しない場合は、プロジェクト管理者に報告

### メッセージ3: stdin読み込みエラー（行1880-1884）

**出力形式**:

```
Hook validation failed (stdin read error). Failed to read input from stdin.
```

**実装コード**:

```javascript
input.on('error', (err) => {
  // N-2: Output error message to stderr for user visibility
  console.error('Hook validation failed (stdin read error). Failed to read input from stdin.');
  process.exit(2);
});
```

**説明**:

- phase-edit-guardがpayloadをstdinから読み込む際のI/Oエラー用
- エラー括弧に「stdin read error」を挿入し、エラー種別を明示する
- stdinはgitやClaude Code内部で自動パイプされるため、ユーザーが直接制御できない
- メッセージは「Failed to read」と受動的表現を使用し、ユーザーの操作ミスではなくシステム問題を示唆
- 表示例: `Hook validation failed (stdin read error). Failed to read input from stdin.`
- パイプの閉鎖やシグナル受信によるエラーをキャッチ対象

**エラー発生のトリガー条件**:

- Gitプロセスがstdinパイプを予期せず閉鎖した場合
- system-level I/O エラー（ファイルディスクリプタ限界等）で読み込み失敗
- フック実行環境のシグナルハンドラで入力ストリームが中断

**ユーザーへの指導内容**:

このエラー発生時のユーザーへの指導：
1. Git操作を再実行（一時的なI/Oエラーの可能性）
2. PCのメモリ使用率が100%でないか確認（リソース不足の判定）
3. フルスクリーンのファイルディスクリプタ監査は不要（GitとClaudeの内部制御）

### メッセージ4: JSON解析エラー（行1891-1894）

**出力形式**:

```
Hook validation failed (JSON parse error). Invalid JSON input from stdin.
```

**実装コード**:

```javascript
let payload;
try {
  payload = JSON.parse(stdinContent);
} catch (err) {
  // N-2: Output error message to stderr for user visibility
  console.error('Hook validation failed (JSON parse error). Invalid JSON input from stdin.');
  process.exit(2);
}
```

**説明**:

- stdinから読み込んだペイロード文字列のJSON.parse()失敗用
- エラー括弧に「JSON parse error」を挿入し、エラー種別を明確化する
- JSON形式エラーは、payloadの生成側（workflow-plugin/mcp-server側）の問題を示唆する
- メッセージは「Invalid JSON」と簡潔に説明し、自動生成コードの問題を示唆
- 表示例: `Hook validation failed (JSON parse error). Invalid JSON input from stdin.`
- エラー詳細情報（JSON.parse失敗の例：unexpected token等）はconsole.error(err)に委譲せず、簡潔性を優先

**エラー発生のトリガー条件**:

- workflow-core.tsがinvokeHook時に不正なJSON文字列を生成（実装バグ）
- payloadオブジェクトをJSON.stringify()できない型を含む（例：円形参照）
- stdinバッファが部分的に読み込まれ、不完全なJSON文字列が到達（stdin read errorとの関連性有り）

**ユーザーへの指導内容**:

このエラー発生時のユーザーへの指導：
1. MCPサーバーログを確認（`workflow-plugin/mcp-server/logs`）して、payload生成側のエラーを探索
2. Claude Code再起動で一時的なメモリ破損が回復するか試行
3. 定期的に発生する場合はプロジェクト管理者に報告し、実装バグのデバッグを依頼

## メッセージの出力順序と相互関係

### フック実行フロー内の出力タイミング

```
phase-edit-guard.js実行開始
  ↓
Bashコマンド検証
  ├─ ✗ 違反検出 → メッセージ1 出力 → process.exit(2)
  └─ ✓ 合格
      ↓
    ペイロード処理開始
      ↓
    stdin読み込み
      ├─ ✗ I/Oエラー → メッセージ3 出力 → process.exit(2)
      └─ ✓ 成功
          ↓
        JSON解析
          ├─ ✗ パースエラー → メッセージ4 出力 → process.exit(2)
          └─ ✓ 成功
              ↓
            バリデーション実行（ハンドラ呼び出し）
              ├─ 例外発生 → メッセージ2 出力 → process.exit(2)
              └─ 正常完了
```

メッセージは階層化され、早期段階のエラーほど先に出力される。
ユーザーは最初に表示されたメッセージが、エラーの最上流の原因を示していると理解できる。

### 複合エラーの場合

複数条件が同時に失敗する場合（例：stdin I/Oエラーでバッファ不完全 → JSON解析失敗）、
早期段階で処理が止まるため、メッセージ3（stdin読み込みエラー）のみが表示される。
ユーザーはメッセージ3の対応（Git操作再実行等）を実施することで、
連鎖エラーが自動的に解決される設計。

## エラーメッセージのテストケース

### ユニットテスト設計（test_designフェーズで詳細化）

#### TC-N2-1: Bashホワイトリスト違反メッセージ確認

```
前提条件:
  - phase-edit-guard.jsがロード済み
  - 違反パターンが明示的に設定可能

手順:
  1. phase-edit-guardで違反パターンを検出（例: "rm -rf"）
  2. console.errorへの出力をキャプチャ

期待結果:
  - メッセージに"Hook validation failed (Bash whitelist):"を含む
  - 違反パターン例が具体的に列挙されている
  - "contact the plugin administrator"を含む
```

#### TC-N2-2: Fail Closedメッセージ確認

```
前提条件:
  - phase-edit-guard.jsの実装内で意図的に例外を発生させるパッチ適用可能

手順:
  1. getHookConfigの結果をnullに上書き
  2. 後続のdescriptorアクセスで例外発生をトリガー
  3. console.errorへの出力をキャプチャ

期待結果:
  - メッセージが"Hook validation failed unexpectedly."から開始
  - "hook configuration"を含む
  - process.exitが呼び出されていることを確認
```

#### TC-N2-3: stdin読み込みエラーメッセージ確認

```
前提条件:
  - stdin.on('error')イベントリスナーが登録されている

手順:
  1. inputストリームに人為的なエラーイベント発行
  2. console.errorへの出力をキャプチャ

期待結果:
  - メッセージに"Hook validation failed (stdin read error):"を含む
  - "Failed to read input from stdin"を含む
  - process.exitが呼び出されていることを確認
```

#### TC-N2-4: JSON解析エラーメッセージ確認

```
前提条件:
  - stdinから不正なJSON文字列を供給可能

手順:
  1. JSON.parseで解析失敗するペイロード（例："{invalid"）を供給
  2. console.errorへの出力をキャプチャ

期待結果:
  - メッセージに"Hook validation failed (JSON parse error):"を含む
  - "Invalid JSON input from stdin"を含む
  - process.exitが呼び出されていることを確認
```

## 統合テスト設計（test_designフェーズで詳細化）

### テストシナリオS-N2-1: エラーメッセージの完全性確認

```
目的: 4つのメッセージが実際のエラーケースで正しく出力されることを検証

手順:
  1. 各エラーケースをトリガー（git add → コマンド実行による違反検出等）
  2. Claude CodeのBashツール実行ログでstderr出力を取得
  3. 期待メッセージとの完全一致確認

チェック項目:
  - メッセージ1（Bashホワイトリスト）: 「Hook validation failed (Bash whitelist):」を含む
  - メッセージ2（Fail Closed）: 「Hook validation failed unexpectedly.」を含む
  - メッセージ3（stdin読み込みエラー）: 「Hook validation failed (stdin read error).」を含む
  - メッセージ4（JSON解析エラー）: 「Hook validation failed (JSON parse error).」を含む
```

### テストシナリオS-N2-2: メッセージの重複出力防止

```
目的: 複合エラーで複数メッセージが同時出力されないことを検証

手順:
  1. stdin I/Oエラー + JSON解析失敗の複合条件をシミュレート
  2. stderr出力の行数をカウント

チェック項目:
  - エラーメッセージが1行のみ出力（メッセージ3が最初に処理される）
  - process.exit(2)直前の最後の出力メッセージが記録される
```

### テストシナリオS-N2-3: メッセージのユーザー可読性確認

```
目的: メッセージが実際のユーザー（非技術者）でも理解可能であることを検証

手順:
  1. 4つのメッセージテキストをユーザビリティテスト対象者に提示
  2. 各メッセージから読み取れる情報（エラーの種類、対応方法）を回答

チェック項目:
  - 「エラーの種類が特定できたか」→ 4つのメッセージで異なる種類を識別可能
  - 「対応方法が明確か」→ メッセージ3（再実行）、メッセージ1（ホワイトリスト追加）等が推測可能
  - 「メッセージが不安感を与えないか」→ 「unexpectedly」は中立的表現か評価
```

## 非機能要件の実現方法

### NFR-1: メッセージの一貫性

4つのメッセージ全てが「Hook validation failed」で開始する統一フォーマットを採用し、
ユーザーが一目でphase-edit-guardに由来するエラーであることを認識できる。
理由括弧（Bash whitelist）や詳細説明部分は、エラー種別ごとに異なる情報を提供しつつ、
読者の認知負荷を最小化する。

### NFR-2: メッセージの簡潔性

各メッセージは1-2文で構成され、ターミナルに表示する際の視認性を損なわない。
技術詳細（エラーコード、スタックトレース）は含めず、ユーザー向けのアクション指示に限定する。
詳細ログが必要な場合、ユーザーはログファイルを参照するよう促す。

### NFR-3: メッセージの操作ガイダンス

メッセージ1は「contact administrator」で対応主体を明示。
メッセージ2・3・4は「check configuration」「再実行」等の具体的次ステップを示唆。
ユーザーが即座に対応方法を判断できる支援を目指す。

### NFR-4: ローカライゼーション対応（将来拡張）

メッセージ全文を言語別リソースファイル化することで、
将来の日本語対応やその他言語対応が容易になる設計を想定。
現段階ではハードコード英文としつつ、メッセージをconsole.errorに出力するため、
ラッパー関数を介した多言語化が可能。

## メッセージの統合実装時の注意事項

### console.errorの同期性保証

Node.jsのconsole.error()は標準的に同期的にstderrに出力するため、
process.exit(2)の直前に呼び出せば、メッセージはバッファに残らず確実に表示される。
ただし、大規模なメッセージ文字列や複雑な出力操作は避け、
シンプルな文字列出力に限定する。

### エラー原因詳細の提供方法

メッセージ自体は簡潔にしつつ、デバッグ必要時にはログファイル参照を促すため、
実装時に各catchブロックで`console.error(err)`を追加することを検討。
ただし、本ドキュメントで規定するメッセージはユーザー向けのものであり、
追加的なログ出力は実装者判断に委譲する。

### 既存関数との統合確認

displayBlockMessage関数との出力形式の一貫性を確認するため、
実装時にdisplayBlockMessage関数の呼び出し結果とconsole.errorメッセージを
同じClaude Codeセッションで並行確認し、視覚的な統一性を検証する。

## まとめ

本ui-design.mdではN-2修正による4つのエラーメッセージの統一設計を規定した。
メッセージは既存のdisplayBlockMessage関数フォーマットに準拠し、
ユーザーが「Hook validation failed」で一貫してphase-edit-guardエラーを識別可能な設計とした。
各メッセージはエラーの種別を括弧で明示し、対応方法をガイドする詳細説明で構成される。
Bashホワイトリスト違反、Fail Closed、stdin読み込みエラー、JSON解析エラーの各ケースは、
フック実行フロー内で階層的に処理され、ユーザーは最初に表示されたメッセージから最上流の原因を特定できる。
本設計により、Claude Codeがstderr経由でエラーを適切に表示でき、
ユーザーのデバッグ効率が向上する。
