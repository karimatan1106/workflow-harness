# 危険コマンドブロックフック修正 - 要件定義

## 機能要件

### FR-1: 入力形式の修正
- Claude Codeからの入力形式 `{ tool_input: { command: '...' } }` を正しくパース
- JSONパースエラー時は許可（fail open）

### FR-2: PowerShellコマンドのブロック
以下のコマンドパターンをブロック:
- `Stop-Process` (大文字小文字不問)
- `Remove-Item ... -Force -Recurse` (ルートディレクトリ削除)
- `Get-Process | Stop-Process` (パイプによる全プロセス終了)
- `Invoke-WmiMethod ... Terminate`

### FR-3: Windows taskkillの完全対応
- `/F /PID` 形式
- `/FI` フィルタ形式
- 全プロセス指定パターン

### FR-4: WMIコマンドのブロック
- `wmic process delete`
- `wmic os call shutdown`

### FR-5: シェル経由バイパス対策
- `bash -c '...'` 内の危険コマンド検出
- `powershell -Command "..."` 内の危険コマンド検出
- `sh -c '...'` 内の危険コマンド検出
- `eval '...'` 内の危険コマンド検出

### FR-6: タイムアウト処理
- 3秒のタイムアウト設定
- タイムアウト時は許可（fail open）

## 非機能要件

### NFR-1: パフォーマンス
- 処理時間: 100ms以内
- メモリ使用量: 50MB以内

### NFR-2: 信頼性
- パースエラー時は許可（fail open）
- 予期せぬエラー時は許可

### NFR-3: 保守性
- パターン追加が容易な構造
- テストコードの完備

## 受け入れ基準

### AC-1: PowerShellコマンドブロック
- [ ] `Stop-Process -Force` がブロックされる
- [ ] `Stop-Process -Id 1234` がブロックされる
- [ ] `Get-Process node | Stop-Process` がブロックされる

### AC-2: Windows taskkillブロック
- [ ] `taskkill /F /PID 1234` がブロックされる
- [ ] `taskkill /F /FI "IMAGENAME eq node.exe"` がブロックされる

### AC-3: バイパス対策
- [ ] `bash -c 'kill -9 -1'` がブロックされる
- [ ] `powershell -Command "Stop-Process..."` がブロックされる

### AC-4: 正常コマンド許可
- [ ] `npm install` が許可される
- [ ] `git status` が許可される
- [ ] `node script.js` が許可される
