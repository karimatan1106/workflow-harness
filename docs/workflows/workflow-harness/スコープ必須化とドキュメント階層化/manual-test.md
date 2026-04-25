# 手動テスト結果: スコープ必須化とドキュメント階層化

## サマリー

本ドキュメントは「スコープ必須化とドキュメント階層化」実装に対して実施したコードベース手動検証の結果を記録する。
対象は4つのファイル（set-scope.ts, definitions.ts, next.ts, types.ts）であり、
各シナリオについてコードを直接読んで実装内容を確認した。

主要な確認事項:
- シナリオ1（moduleName自動推定）: `path.basename` と末尾スラッシュ除去の正規表現が正しく実装されており、"src"が取得される動作を確認した
- シナリオ2（{moduleDir}プレースホルダー展開）: `resolvePhaseGuide` 関数内で `docsDir/modules/moduleName` へ展開するロジックが行1427-1429に存在することを確認した
- シナリオ3（requirements→parallel_analysis遷移時の警告）: `next.ts` 行182-191に `success: true` を維持しながら `scopeWarnings` に追記し、行635でレスポンスに付与する構造を確認した
- シナリオ4（addMode時のmoduleName引き継ぎ）: `set-scope.ts` 行322-324で `affectedDirs.length > 0` の場合のみ新規推定し、空の場合は `taskState.scope?.moduleName` を引き継ぐ分岐を確認した

全4シナリオで実装内容は仕様書と整合している。重大な問題は検出されなかった。

---

## テストシナリオ

### シナリオ1: workflow_set_scope によるモジュール名自動推定

確認対象ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\set-scope.ts`（行320-324）

シナリオ概要として、`dirs` に末尾スラッシュ付きのパス（例: `"workflow-plugin/mcp-server/src/"`）を指定した場合、
`moduleName` フィールドに末尾スラッシュを除去したベース名が格納されることを検証する。

シナリオ1で確認したset-scope.tsのmoduleName推定ロジック（行322-324）:
```typescript
const inferredModuleName = affectedDirs.length > 0
  ? path.basename(affectedDirs[0].replace(/[/\\]+$/, ''))
  : (taskState.scope?.moduleName ?? undefined);
```

評価手順として、入力 `affectedDirs[0]` が `"workflow-plugin/mcp-server/src/"` のとき、
正規表現 `/[/\\]+$/` が末尾スラッシュを除去して `"workflow-plugin/mcp-server/src"` になり、
`path.basename()` がパス区切り文字以降の最後の要素 `"src"` を返すことを確認した。

バックスラッシュを含むWindowsパス（例: `"workflow-plugin\\mcp-server\\src\\"` ）に対しても、
同じ正規表現が対応できる点も確認した。

### シナリオ2: {moduleDir} プレースホルダー展開

確認対象ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`（行1413-1449）

シナリオ概要として、`resolvePhaseGuide` 関数が第4引数 `moduleName` を受け取ったとき、
`{moduleDir}` プレースホルダーが `docsDir/modules/moduleName` に展開されることを検証する。

シナリオ2で確認したdefinitions.tsのmoduleDir計算ロジック（行1427-1429）:
```typescript
const moduleDir = moduleName && docsDir
  ? `${docsDir}/modules/${moduleName}`
  : (docsDir ?? '');
```

この実装により、`moduleName` が `"src"` で `docsDir` が `"docs/workflows/タスク名"` のとき、
`moduleDir` は `"docs/workflows/タスク名/modules/src"` になることを確認した。

`moduleName` が未設定（`undefined`）の場合、`moduleDir` は `docsDir` そのものにフォールバックし、
既存のプレースホルダー展開動作が維持される後方互換設計であることも確認した。

`outputFile`・`inputFiles`・`inputFileMetadata` の各フィールドで `.replace('{moduleDir}', moduleDir)` が
行1436, 1441, 1448に存在することを確認し、全出力先パスで展開が適用されることを確認した。

### シナリオ3: requirements→parallel_analysis遷移時のスコープ警告

確認対象ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts`（行182-191, 635）

シナリオ概要として、`currentPhase === 'requirements'` かつスコープのファイル数・ディレクトリ数が両方0のとき、
レスポンスの `warnings` フィールドに警告メッセージが含まれることを検証する。

シナリオ3で確認したnext.tsのrequirementsフェーズ警告処理（行182-191）:
```typescript
if (currentPhase === 'requirements') {
  const reqScopeFiles = taskState.scope?.affectedFiles?.length ?? 0;
  const reqScopeDirs = taskState.scope?.affectedDirs?.length ?? 0;
  if (reqScopeFiles === 0 && reqScopeDirs === 0) {
    scopeWarnings.push(
      'スコープが未設定です。parallel_analysisフェーズでブロックされます。...'
    );
  }
}
```

行635では `...(scopeWarnings.length > 0 ? { warnings: scopeWarnings } : {})` としてスプレッドで付与されており、
`success: true` を維持しながら `warnings` フィールドが追加される設計を確認した。

スコープが設定されている場合は `scopeWarnings` に追記されないため、`warnings` フィールドが含まれないことも確認した。

### シナリオ4: addMode時のmoduleName引き継ぎ

確認対象ファイル: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\set-scope.ts`（行322-324）

シナリオ概要として、`addMode=true` かつ新しい `dirs` が空配列のとき、
既存の `taskState.scope?.moduleName` が引き継がれることを検証する。

シナリオ4で確認したset-scope.tsのaddMode時moduleName分岐（行322-324）:
```typescript
const inferredModuleName = affectedDirs.length > 0
  ? path.basename(affectedDirs[0].replace(/[/\\]+$/, ''))
  : (taskState.scope?.moduleName ?? undefined);
```

`addMode=true` で追加されるのはファイルのみの場合、`affectedDirs` は既存分とマージされるため
`affectedDirs.length > 0` が成立する可能性もある点に留意が必要だが、
正常に `addMode` でディレクトリを追加する場合は新しい `affectedDirs` の先頭要素からmoduleNameが更新される。

`addMode=true` でfilesのみ追加し、dirsを指定しない場合、`affectedDirs` は既存スコープのものが引き継がれ（行185-190）、
その場合 `affectedDirs.length > 0` が成立するため、既存の先頭ディレクトリからmoduleNameが再推定される点も確認した。

---

## テスト結果

### シナリオ1: workflow_set_scope によるモジュール名自動推定

`path.basename(affectedDirs[0].replace(/[/\\]+$/, ''))` の式は、末尾スラッシュ除去後に Node.js の `path.basename` を適用するため、
Unix パスでもWindowsパスでも最後のディレクトリ名だけを取得できる。
`"workflow-plugin/mcp-server/src/"` を入力したとき `"src"` が得られることを式の評価で確認し、
正規表現による末尾スラッシュ除去とbasename取得がいずれも正常に動作することを静的検証した。

シナリオ1合否: 合格。末尾スラッシュ除去の正規表現と `path.basename` の組み合わせが Unix・Windows 両パスで正しく動作することをコードから確認した。

### シナリオ2: {moduleDir} プレースホルダー展開

`moduleName` が設定された場合の展開先パスは `docsDir/modules/moduleName` であり、
`outputFile`・`inputFiles`・`inputFileMetadata` の全フィールドで置換処理が適用されることを確認した。
`moduleName` 未設定時は `docsDir` にフォールバックするため、既存の挙動が破壊されない後方互換設計も確認した。
展開ロジックは `definitions.ts` 行1427-1429 に集中しており、3つのフィールドすべてで同一の変数を参照しているため整合性が保たれている。

シナリオ2合否: 合格。`{moduleDir}` プレースホルダーが `docsDir/modules/moduleName` へ正しく展開され、全出力先フィールドに適用されることを `definitions.ts` の該当行から確認した。

### シナリオ3: requirements→parallel_analysis遷移時のスコープ警告

`success: true` を維持しながら `warnings` フィールドに警告を付与する設計は、
FR-1-2の要件である「警告レベルの通知（ブロックしない）」を満たしている。
また `research` フェーズでも同様の情報レベル警告が行174-180に実装されており、
段階的必須化の3ステップ（情報→警告→ブロック）が揃っていることを確認した。
スコープが設定済みの場合は `scopeWarnings` への追記が行われず、不要な警告が出ない設計であることも検証した。

シナリオ3合否: 合格。requirements→parallel_analysis 遷移時にスコープ未設定を検出して `warnings` フィールドを付与し、`success: true` を維持する設計が `next.ts` 行182-191 および行635 の実装から確認できた。

### シナリオ4: addMode時のmoduleName引き継ぎ

確認結果として、実装は仕様書の主要な意図（空のdirsでは既存のmoduleNameを保持する）を満たしている。
ただし、`addMode=true` でfilesのみを追加する場合は、既存の `affectedDirs` が引き継がれるため
`affectedDirs.length > 0` が成立してmoduleNameが既存ディレクトリから再推定される点は、
仕様書に明記されていない動作である。これは実害のない動作だが、テスト設計書への追記が望ましい。

合否判定: 条件付き合格（主要パスは正常、ファイルのみaddMode時の再推定動作は軽微な注意点として記録）

### 総合評価

全4シナリオで実装コードが設計意図を満たしていることを確認した。
重大な実装不整合や動作バグは検出されなかった。
軽微な改善点として、addMode時のmoduleName再推定動作についてテスト設計書への追記を推奨する。
手動テストの実施方式はコードベース静的確認であり、実行環境を用いた動的テストは自動テストフェーズに委ねる。
