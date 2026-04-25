# 危険コマンドブロックフック - 仕様書

## 1. 概要

### 目的
Claude Codeが危険なコマンドを実行することを防止するPreToolUseフック

### スコープ
- Bashツールのコマンド検査
- 危険パターンの検出とブロック

## 2. 入力形式

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "実行するコマンド",
    "description": "コマンドの説明"
  }
}
```

## 3. 出力形式

### 許可時
- exit code: 0
- stdout: なし

### ブロック時
- exit code: 1
- stderr: JSONエラーメッセージ

```json
{
  "error": "ブロック理由",
  "blocked_pattern": "マッチしたパターン",
  "command_preview": "コマンドの先頭100文字"
}
```

## 4. 危険パターン一覧

### 4.1 PowerShell系
```javascript
/stop-process/i                           // Stop-Process
/remove-item.*-force.*-recurse/i          // 強制再帰削除
/get-process.*\|.*stop-process/i          // パイプによる終了
/invoke-wmimethod.*terminate/i            // WMI経由終了
```

### 4.2 Windows taskkill系
```javascript
/taskkill\s+\/f/i                         // 強制終了（全形式）
/taskkill.*\/pid\s+\*/i                   // 全PID
/taskkill.*\/fi\s+/i                      // フィルタ指定
```

### 4.3 WMI系
```javascript
/wmic\s+process\s+(delete|terminate)/i    // プロセス削除
/wmic\s+os.*shutdown/i                    // シャットダウン
```

### 4.4 Unix/Linux系（既存）
```javascript
/kill\s+-9\s+-1/                          // 全プロセスKILL
/killall\s+-9/                            // 強制killall
/pkill\s+-9/                              // 強制pkill
/pkill.*node/i                            // node終了
/killall.*node/i                          // node終了
```

### 4.5 システム系（既存）
```javascript
/shutdown/i                               // シャットダウン
/reboot/i                                 // 再起動
/init\s+[06]/                             // init停止/再起動
/halt/i                                   // 停止
/poweroff/i                               // 電源オフ
```

### 4.6 ファイル破壊系（既存）
```javascript
/rm\s+-rf\s+\//                           // ルート削除
/del\s+\/s\s+\/q\s+c:/i                   // Cドライブ削除
/format\s+c:/i                            // フォーマット
```

### 4.7 バイパス対策
```javascript
/bash\s+-c\s+['"].*kill/i                 // bash -c経由
/sh\s+-c\s+['"].*kill/i                   // sh -c経由
/powershell.*-command.*stop-process/i     // PowerShell経由
/cmd\s+\/c.*taskkill/i                    // cmd /c経由
/eval\s+['"].*kill/i                      // eval経由
```

## 5. 処理フロー

```
1. タイムアウト設定（3秒）
2. stdin読み込み
3. JSONパース
4. コマンド抽出（tool_input.command）
5. 各パターンでチェック
6. マッチ → exit(1) + エラー出力
7. 不一致 → exit(0)
```

## 6. エラーハンドリング

- JSONパースエラー: exit(0) で許可
- タイムアウト: exit(0) で許可
- 未捕捉例外: ログ出力後 exit(0)

## 7. テスト要件

### ブロックされるべきコマンド
- `Stop-Process -Force`
- `taskkill /F /IM node.exe`
- `bash -c 'kill -9 -1'`

### 許可されるべきコマンド
- `npm install`
- `git status`
- `node script.js`
- `kill-process-name` (部分一致しない)
