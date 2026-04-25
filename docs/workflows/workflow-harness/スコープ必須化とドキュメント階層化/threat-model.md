# スコープ必須化とドキュメント階層化 脅威モデル

## サマリー

本ドキュメントは「スコープ必須化とドキュメント階層化」変更に対して STRIDE 手法に基づく脅威モデリングを実施した結果をまとめる。

分析対象は以下の4ファイルに対する変更である。
- `next.ts`: フェーズ遷移時の段階的スコープチェック追加
- `definitions.ts`: `{moduleDir}` プレースホルダー追加・`inputFiles` スコープ絞り込み
- `set-scope.ts`: モジュール名自動推定ロジック追加
- `types.ts`: `moduleName` フィールド追加

### 主要な決定事項

- 優先度を「High」として対処すべき脅威は3件（T-03, T-07, T-09）
- パストラバーサル対策は既存の `normalizedRoot` チェックで一定程度カバーされているが、絶対パス時の検証が不完全である
- `{moduleDir}` プレースホルダーの展開処理でパス操作を受け入れる場合は、解決結果が `docsDir` 配下に収まることを保証する必要がある
- スコープ段階的チェックはメモリアクセスのみでありDoS影響は限定的と評価する

### 次フェーズで必要な情報

- `resolvePhaseGuide()` の実装詳細（`{moduleDir}` 展開時にパス検証が必要かどうかの判断材料）
- `moduleName` を state に書き込む際に HMAC を更新する処理が `stateManager.writeTaskState()` で保証されているかどうかの確認
- `set-scope.ts` での `dirs` パラメータ受け取り後、`path.basename()` でモジュール名を切り出す場合の Unicode / パス区切り文字の扱い

---

## 脅威一覧

### Spoofing（なりすまし）

#### T-01: 偽の workflow_set_scope 呼び出しによるスコープ無効化

攻撃者または不正な AI エージェントが `workflow_set_scope` を空の `files` / `dirs` で呼び出すことで、スコープを実質的に消去し段階的スコープチェックをバイパスする。

現状の `set-scope.ts` は `affectedFiles.length === 0 && affectedDirs.length === 0` の場合に `success: false` を返して拒否するため、空スコープへの上書きは技術的にブロックされている。ただし `addMode: false` で単独ファイルのみ設定した後に、正規フローと見せかけて別の `workflow_set_scope` 呼び出しでスコープを縮小する操作は許容されてしまう可能性がある。

- 深刻度: Medium（遷移ブロックまでの間に別の処理が入る可能性はあるが、並列実行競合は限定的）
- 対象コンポーネント: `set-scope.ts` の `workflowSetScope()` 関数

#### T-02: セッショントークン不在でのスコープ設定

`workflow_set_scope` はセッショントークン検証（`verifySessionToken`）を実施するが、トークンが `undefined` の場合の挙動はシステム設定に依存する。セッショントークン必須設定 (`SESSION_TOKEN_REQUIRED`) が無効な環境では、認証なしでスコープを上書きできる。

`moduleName` フィールドが追加されることで、トークンなし呼び出しによってモジュール名を任意の値に書き換えるリスクが新たに生じる。`{moduleDir}` プレースホルダー展開に使用されるモジュール名が偽装されると、subagent が誤ったドキュメントパスを参照することになる。

- 深刻度: Low（システムデフォルトでトークン必須ではないため通常運用内の動作）
- 対象コンポーネント: `set-scope.ts`、`definitions.ts` の `resolvePhaseGuide()`

---

### Tampering（改ざん）

#### T-03: workflow-state.json の直接編集によるスコープチェック回避（優先度 High）

`workflow-state.json` のスコープフィールドを直接編集することで、`parallel_analysis → parallel_design` 遷移ブロックを回避できる。フックの HMAC 検証により改ざんは検出されるが、HMAC 未設定環境または `HMAC_STRICT=false` 設定下ではフック側のブロックが機能しない。

スコープ段階的チェックが `next.ts` 内でのメモリアクセスのみに依存しているため、`workflow-state.json` を整合性のある形で再生成する手段（例: MCP サーバーの `stateManager` を経由した正規書き込み）が存在する場合は回避可能となる。

- 深刻度: High（スコープ必須化の根幹を無効化できる）
- 対象コンポーネント: `workflow-state.json`、`state-manager.ts` の HMAC 処理

#### T-04: {moduleDir} プレースホルダーへのパストラバーサル注入

`workflow_set_scope` で `dirs: ["src/../../../etc/shadow"]` のような相対パスを指定することで、モジュール名として `etc` が推定される場合、`{moduleDir}` が `{docsDir}/modules/etc` に展開され予期しないパスが subagent プロンプトに含まれる可能性がある。

既存の `normalizedRoot` チェックは相対パスのプロジェクトルート外解決を拒否しているが、絶対パスは検証をスキップする設計になっている。絶対パスで `C:\Windows\System32` などを指定した場合、ディレクトリ名 `System32` が `moduleName` に設定されてドキュメントパスに挿入される。この場合パスは `{docsDir}/modules/System32` となり、サーバープロセスの機密情報には直接アクセスできないが、subagent が誤ったコンテキストで動作するリスクがある。

- 深刻度: Medium（直接的なファイルシステムアクセスには至らないが、subagent の動作に影響）
- 対象コンポーネント: `set-scope.ts` のモジュール名推定ロジック、`definitions.ts` の `resolvePhaseGuide()`

#### T-05: requirements フェーズ完了時の警告メッセージへの影響注入

FR-1-1（research フェーズ完了時の情報メッセージ）で出力されるメッセージ文言が外部入力（`taskName` など）を含む場合、エスケープ不備によりユーザー向けメッセージに制御文字が混入する可能性がある。

現状の `next.ts` のメッセージは文字列リテラルに `taskState.*` を埋め込む形式であり、`taskName` や `scope` フィールドの内容が直接 `message` に挿入されないため影響は限定的である。

- 深刻度: Low（MCP レスポンス内のメッセージフィールドのみ影響）
- 対象コンポーネント: `next.ts` のスコープ警告メッセージ生成部分

---

### Information Disclosure（情報漏洩）

#### T-06: inputFiles スコープ絞り込みによる情報欠損

FR-3-2 の `inputFiles` スコープ絞り込みで、subagent が必要な入力ファイルにアクセスできなくなる「情報欠損型情報漏洩」が発生するリスクがある。スコープを `src/backend/domain/auth/` のみに設定した場合、`requirements.md` や `spec.md` がスコープ外となり subagent に渡されないケースが想定される。

成果物の品質低下が原因で機密情報や設計意図が次フェーズへ正しく伝達されないことは、情報漏洩ではなく機密性損失に分類される。結果的に後続の脅威モデリングやセキュリティレビューが不完全なまま進行するリスクがある。

- 深刻度: Medium（品質劣化による間接的な影響）
- 対象コンポーネント: `definitions.ts` の `inputFileMetadata` / `inputFiles` 生成ロジック

#### T-07: moduleDir パスを通じたシステム構造の暴露（優先度 High）

`{moduleDir}` プレースホルダーが展開された結果の絶対パスが subagent プロンプトに含まれる場合、プロジェクトのファイルシステム構造情報（例: `C:\ツール\Workflow\docs\workflows\auth\modules\auth`）がログや成果物ファイルに記録される可能性がある。

MCP サーバーが外部ネットワークに接続されている環境ではこの情報が外部に送信される恐れがある。また成果物ファイルは `docs/workflows/` に保存されるが、`.gitignore` 対象であるにも関わらず誤って `git add -f` でコミットされる可能性は排除できない。

- 深刻度: High（システムパス情報の漏洩はセキュリティポリシー違反の要因になりうる）
- 対象コンポーネント: `definitions.ts` の `resolvePhaseGuide()` におけるパス文字列生成

---

### Denial of Service（サービス拒否）

#### T-08: 大量スコープ設定による遷移チェック遅延

`workflow_set_scope` で `MAX_SCOPE_FILES`（最大10000件）に近いファイル数を設定した場合、`next.ts` の段階的チェック自体はメモリアクセスのみで完結するため直接的な遅延は発生しない。ただし `validateScopePostExecution()` や `validateScopeDependencies()` が全スコープファイルを走査するため、依存関係解析と組み合わさると `O(n^2)` に近い計算が発生する可能性がある。

NFR-4（10ms 以内）の達成は、スコープチェック単体では問題ないが、後続バリデーション処理の総計で超過するリスクがある。

- 深刻度: Low（環境変数 `MAX_SCOPE_FILES` でキャップされているため最大スコープは制限内）
- 対象コンポーネント: `next.ts` のバリデーション連鎖部分

#### T-09: 段階的チェック追加によるフロー停止誤発動（優先度 High）

FR-1-1（research 完了時）と FR-1-2（requirements 完了時）の警告は遷移をブロックしない設計だが、実装の誤りや条件分岐のバグによって `success: false` を返してしまう場合、既存ワークフローが突然停止するリスクがある。

既存の897件テストは `scope` が `undefined` の場合も想定しているが、`scope?.affectedFiles?.length` のオプショナルチェーンが適切でない場合は `TypeError` が発生し、フェーズ遷移全体がエラーになる可能性がある。特に `safeExecute()` のラッパーの外側でスコープチェックが記述された場合、未捕捉の例外が `NextResult` に `success: false` として伝播する。

- 深刻度: High（全既存タスクのフェーズ遷移が停止するリスク）
- 対象コンポーネント: `next.ts` の `workflowNext()` 内スコープチェックブロック

---

### Elevation of Privilege（権限昇格）

#### T-10: {moduleDir} 経由での読み取り対象ディレクトリ拡張

`{moduleDir}` が subagent プロンプトの入力ファイルパスとして使われる場合、subagent は `Read` ツールで `{docsDir}/modules/{moduleName}/` 配下のファイルを読み込む。`moduleName` が `../../secrets` などの値に設定されれば、subagent が想定外のディレクトリを参照する可能性がある。

ただし Claude Code の `Read` ツールはファイルシステム上の任意ファイルを読み取れる設計であり、これは既存の権限範囲内の操作である。脅威としては「subagent が誤ったコンテキストで動作すること」であり、サーバープロセスの権限昇格には直接つながらない。

- 深刻度: Medium（subagent の誤動作リスクは有るが、サーバー権限は変化しない）
- 対象コンポーネント: `definitions.ts` の `resolvePhaseGuide()`、subagent の Read ツール利用

#### T-11: moduleName フィールドを利用した状態オブジェクト汚染

`types.ts` に `moduleName?: string` が追加される。`stateManager.writeTaskState()` を経由せずに `TaskState` オブジェクトを直接書き換えることは通常できないが、将来的に `moduleName` フィールドを他のバリデーション条件として参照するコードが追加された場合に、フィールド値の注入が条件分岐に影響する。

現時点では `moduleName` は `{moduleDir}` 展開にのみ使用される設計のため、影響範囲は限定されている。

- 深刻度: Low（現設計では `moduleName` の参照用途が限定的）
- 対象コンポーネント: `types.ts` の `TaskState.scope.moduleName`

---

## リスク

本セクションでは、上記の脅威一覧に基づくリスク評価を深刻度・影響範囲・軽減策の3軸でまとめる。

### 高深刻度リスク（High）

**T-03 — workflow-state.json 直接編集によるスコープチェック回避**
- 深刻度: High（スコープ必須化の根幹を無効化できるため、機能要件の意義を失わせる）
- 影響範囲: `workflow-state.json`、`state-manager.ts` の HMAC 保護機構全体。HMAC 未設定環境では全タスクのスコープ検証が無効化される。
- 軽減策: `HMAC_STRICT=true` をデフォルト有効化し、`parallel_analysis` 遷移チェック直前に HMAC 再検証を挿入する。

**T-07 — moduleDir パスを通じたシステム構造の暴露**
- 深刻度: High（プロジェクトのファイルシステム絶対パスが成果物やログを通じて外部に漏洩するリスク）
- 影響範囲: `definitions.ts` の `resolvePhaseGuide()` が生成する subagent プロンプト全体、および `docs/workflows/` 配下の成果物ファイル。
- 軽減策: `{moduleDir}` 展開時に絶対パスを `{docsDir}` 相対表現に変換し、プロジェクトルート外の絶対パスを `moduleName` として採用しない処理を追加する。

**T-09 — 段階的チェック追加によるフロー停止誤発動**
- 深刻度: High（条件分岐の実装ミスによって既存897件テストが通過している全ワークフロータスクのフェーズ遷移が突然停止するリスク）
- 影響範囲: `next.ts` の `workflowNext()` 全体。`safeExecute()` 外でスコープチェックを記述した場合、未捕捉例外が全フェーズ遷移に伝播する。
- 軽減策: スコープチェックコードを `safeExecute()` 内部ではなく `scopeWarnings` 配列への push のみに限定し、`taskState.scope?.affectedFiles?.length ?? 0` パターンを必須とする。

### 中深刻度リスク（Medium）

**T-01 — 偽の workflow_set_scope 呼び出しによるスコープ縮小**
- 深刻度: Medium（空スコープへの上書きは既存チェックで防止されているが、段階的縮小は現在許容される）
- 影響範囲: `set-scope.ts` の `workflowSetScope()` 関数。正規フローに見せかけたスコープ縮小操作が可能な状態。
- 軽減策: 設定前後のファイル数差分を計算し、縮小幅が50%以上の場合に警告メッセージを返す設計を採用する。

**T-04 — {moduleDir} プレースホルダーへのパストラバーサル注入**
- 深刻度: Medium（直接的なファイルシステムアクセスには至らないが、subagent が誤ったコンテキストで動作するリスクがある）
- 影響範囲: `set-scope.ts` のモジュール名推定ロジック。`moduleName` に不正な文字列が設定されると `definitions.ts` の `resolvePhaseGuide()` 全体に影響が及ぶ。
- 軽減策: `path.basename()` 結果に対して英数字・ハイフン・アンダースコア以外の文字をサニタイズし、絶対パスは `path.relative(process.cwd(), dir)` で相対変換してからモジュール名を抽出する。

**T-06 — inputFiles スコープ絞り込みによる情報欠損**
- 深刻度: Medium（スコープ外の必須入力ファイルにアクセスできなくなることで、成果物品質が低下し後続の脅威モデリングやセキュリティレビューが不完全になる）
- 影響範囲: `definitions.ts` の `inputFileMetadata` / `inputFiles` 生成ロジック。スコープ外となったファイルが subagent プロンプトから除外される。
- 軽減策: `requirements.md` や `spec.md` などのフェーズ必須ファイルは「ピン留めファイル」として常にリストに含め、スコープ絞り込みは任意補助ファイルにのみ適用する。

**T-10 — {moduleDir} 経由での読み取り対象ディレクトリ拡張**
- 深刻度: Medium（subagent の誤動作リスクは有るが、サーバープロセス権限は変化しない）
- 影響範囲: `definitions.ts` の `resolvePhaseGuide()` および subagent の Read ツール利用パターン全体。
- 軽減策: `resolvedModuleDir.startsWith(docsDir)` チェックを実施し、`docsDir` 配下に収まらない場合はデフォルトパスにフォールバックする。

### 低深刻度リスク（Low）

**T-02 — セッショントークン不在でのスコープ設定**
- 深刻度: Low（システムデフォルトでトークン必須ではないため通常運用内の動作だが、`moduleName` 偽装リスクが新たに生じる）
- 影響範囲: `set-scope.ts` および `definitions.ts` の `resolvePhaseGuide()` におけるモジュール名参照箇所。
- 軽減策: `SESSION_TOKEN_REQUIRED` の強制化は本タスクスコープ外として記録し、既存テストスイートで継続カバーする。

**T-05 — requirements フェーズ完了時の警告メッセージへの影響注入**
- 深刻度: Low（MCP レスポンスのメッセージフィールドのみに影響し、ファイルシステムやセキュリティ境界への影響はない）
- 影響範囲: `next.ts` のスコープ警告メッセージ生成部分（行173-179付近）。
- 軽減策: メッセージ文字列に `taskName` 等の外部文字列を直接埋め込まず、固定文言を使用する設計を維持する。

**T-08 — 大量スコープ設定による遷移チェック遅延**
- 深刻度: Low（`MAX_SCOPE_FILES` でキャップされているため最大スコープは制限内であり、段階的チェック自体はメモリアクセスのみ）
- 影響範囲: `next.ts` のバリデーション連鎖部分。NFR-4（10ms 以内）の達成に後続バリデーション処理の総計が影響する可能性がある。
- 軽減策: `MAX_SCOPE_FILES` および `MAX_SCOPE_DIRS` の環境変数設定を変更しないことを NFR-4 の前提条件とする。

**T-11 — moduleName フィールドを利用した状態オブジェクト汚染**
- 深刻度: Low（現設計では `moduleName` の参照用途が `{moduleDir}` 展開のみに限定されている）
- 影響範囲: `types.ts` の `TaskState.scope.moduleName` フィールド。将来的に参照箇所が増えた場合のリスクが潜在する。
- 軽減策: `moduleName` フィールドの用途を `{moduleDir}` 展開のみに限定する設計意図をコードコメントに記述し、意図しない参照拡張を防止する。

---

## 軽減策

### 優先度 High の軽減策

**T-03 向け**: `workflow-state.json` の HMAC 保護を強制する設定（`HMAC_STRICT=true`）をデフォルト有効化し、スコープフィールド改ざんを検出できる環境を標準とする。実装時には `parallel_analysis` 遷移チェックの直前に HMAC 再検証を挿入することを検討する。

**T-07 向け**: `resolvePhaseGuide()` で `{moduleDir}` を展開する際、絶対パス文字列をログや成果物の本文に直接含めず、`{docsDir}` からの相対表現に変換してプロンプトに挿入する設計を採用する。プロジェクトルート外を指す絶対パスは `moduleName` として採用しない処理を `set-scope.ts` に追加する。

**T-09 向け**: FR-1-1 / FR-1-2 のスコープ情報・警告メッセージ生成コードを `safeExecute()` のスコープ内部ではなく `scopeWarnings` 配列への push のみに限定し、遷移ロジックの外側に配置する現行設計（コード行173-179参照）を維持する。追加するチェックでは `taskState.scope?.affectedFiles?.length ?? 0` のパターンを必ず使用して `TypeError` を防止する。

### 優先度 Medium の軽減策

**T-01 向け**: addMode を問わず、既存スコープより縮小する上書き操作に対して警告を追加する。具体的には、設定前後のファイル数差分を計算し、縮小幅が50%以上の場合は警告メッセージを返す設計を検討する。

**T-04 向け**: `set-scope.ts` のモジュール名推定では `path.basename()` の結果に対して英数字・ハイフン・アンダースコア以外の文字をサニタイズする処理を追加する。絶対パスの場合も `path.relative(process.cwd(), dir)` でプロジェクト相対パスに変換してからモジュール名を抽出する。

**T-06 向け**: `inputFiles` スコープ絞り込みを適用する場合、`requirements.md` や `spec.md` などの必須入力ファイルは常にリストに含める「ピン留めファイル」の仕組みを設計する。スコープ絞り込みは任意補助ファイルにのみ適用し、フェーズ必須ファイルには適用しない。

**T-10 向け**: `{moduleDir}` 展開後のパスが `docsDir` 配下に収まることを `resolvePhaseGuide()` 内で検証する。具体的には `resolvedModuleDir.startsWith(docsDir)` チェックを行い、配下に収まらない場合は `docsDir` にフォールバックする安全なデフォルト動作を実装する。

### 優先度 Low の軽減策

**T-02 向け**: 本タスクの変更スコープ外であるため、`SESSION_TOKEN_REQUIRED` 設定の強制化はリスクとして記録するにとどめる。テストではトークンなし呼び出しのケースを既存テストスイートで継続カバーする。

**T-05 向け**: メッセージ文字列に `taskName` 等の外部文字列を埋め込む場合は、テンプレートリテラルではなく固定文言を使用し、タスク名の内容がメッセージ本文に混入しない設計を維持する。

**T-08 向け**: `MAX_SCOPE_FILES` の環境変数設定および `MAX_SCOPE_DIRS` の上限値を変更しないことを NFR-4 の前提条件とする。段階的チェック自体（行202-213）はメモリアクセスのみであることを実装時に確認する。

**T-11 向け**: `moduleName` フィールドの用途を `{moduleDir}` 展開のみに限定する設計意図をコードコメントに記述し、後続の開発者が意図しない参照拡張を行わないようにする。
