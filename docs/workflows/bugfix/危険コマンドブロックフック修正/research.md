# 危険コマンドブロックフック修正 - 調査結果

## 1. 現在のフックコードの問題点

### 1.1 入力形式の実装が不完全

現在のコード:
```javascript
const toolInput = JSON.parse(input);
const command = toolInput.command || '';
```

問題: Claude Codeからの入力形式は `{ tool_input: { command: '...' } }` 構造。
正しくは `toolInput.tool_input?.command` でアクセスすべき。

### 1.2 危険なコマンドパターンの検出漏れ

#### PowerShell系（完全に見逃し）
- `Stop-Process -Force` - 実際に使用されてプロセスが終了した
- `Stop-Process -Name node`
- `Stop-Process -Id $pid`
- `Get-Process | Stop-Process`

#### Windows系（不完全）
- `taskkill /F /PID 1234` - PID指定形式
- `taskkill /FI "IMAGENAME eq node.exe"` - フィルタ形式
- `wmic process delete`

#### バイパスパターン
- `bash -c 'kill -9 -1'`
- `powershell -Command "Stop-Process..."`

### 1.3 タイムアウト処理がない
他のフックは3秒のタイムアウトを設定している

## 2. 見逃されている危険なコマンドパターン

### PowerShell系（最優先で追加必要）
- Stop-Process
- Remove-Item -Force -Recurse
- Get-Process | Stop-Process

### Windows系
- taskkill /F /PID
- wmic process delete

### シェル経由バイパス
- bash -c
- powershell -Command
- sh -c

## 3. 改善推奨事項

1. 入力形式の修正: `data.tool_input?.command`
2. PowerShellパターン追加
3. タイムアウト処理追加: 3秒
4. テスト追加
