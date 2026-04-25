# 脅威モデル: 前回ワークフロー実行時の問題根本原因修正

## サマリー

FIX-1からFIX-5の修正に対するSTRIDE脅威モデリングを実施した。
特にFIX-2のpreExistingChanges改ざんリスクとFIX-5のgit checkout/restoreの不正利用リスクが高い。
FIX-2はHMAC整合性検証で保護され、FIX-5はブランチ操作のブラックリスト化で対策する。
FIX-1、FIX-3、FIX-4は脅威レベルが低く、標準的な対策で十分である。
全5件の修正に対して合計6つの対策（T2-1、T2-2、T4-1、T5-1、T5-2、T5-3）を定義した。
修正の優先度はFIX-2とFIX-5が高、FIX-4が中、FIX-1とFIX-3が低である。

## 脅威分析

### FIX-1: task-index.json sync（脅威レベル: 低）

task-index.jsonはワークフローの内部状態キャッシュであり、workflow-state.jsonのHMAC検証により改ざんが検出される。MCPサーバー再起動による修正であり、新たな攻撃面は発生しない。

### FIX-2: スコープバリデーター事前変更除外（脅威レベル: 高）

STRIDE分析でSpoofingとTamperingのリスクを特定した。
攻撃シナリオとして、preExistingChangesフィールドに任意のファイルパスを注入し、スコープ検証をバイパスする可能性がある。
対策として、preExistingChangesはworkflow_start時にMCPサーバーが記録し、HMAC署名で保護される。外部から直接改ざんした場合はHMAC検証で検出され拒否される。
preExistingChangesの値はgit diffの実行結果のみを使用し、ユーザー入力を受け付けない設計とする。

### FIX-3: loop-detector stdinエラー（脅威レベル: 低）

stdinイベントハンドリングの修正はプロセス内部の問題であり、外部攻撃面は存在しない。once()による単発リスナー化とeventHandledフラグの追加は既存のセキュリティモデルに影響しない。

### FIX-4: loop-detector閾値引き上げ（脅威レベル: 中）

閾値を10から20に引き上げることで真のループ検出感度が低下する可能性がある。しかし20回の編集は通常のワークフローでは発生しにくく、30回以上の編集は依然として検出される。閾値の引き上げはimplementationとrefactoringフェーズのみに限定し、他のフェーズの閾値は変更しない。

### FIX-5: bash-whitelist git checkout/restore追加（脅威レベル: 高）

STRIDE分析でTamperingとInformation Disclosureのリスクを特定した。
git checkout -bやgit checkout .が許可されるとコードの完全性が損なわれる。
対策としてgit checkout --（ファイル指定の変更破棄のみ）を許可し、ブランチ操作は明示的にブラックリスト化する。git restore .もブラックリスト化しファイル指定のgit restoreのみ許可する。

## 対策

### 対策一覧

FIX-2対策T2-1: HMAC署名によるpreExistingChanges保護を適用する。
FIX-2対策T2-2: git diff実行結果のみをpreExistingChangesに記録しユーザー入力を排除する。
FIX-4対策T4-1: 閾値引き上げをimplementationとrefactoringフェーズのみに限定する。
FIX-5対策T5-1: git checkout -b、git checkout .をブラックリスト化する。
FIX-5対策T5-2: git restore .をブラックリスト化しgit restore <ファイル名>のみ許可する。
FIX-5対策T5-3: bash-whitelist.jsのgitカテゴリにprefixマッチで安全に追加する。

### リスクマトリクス

高リスク: FIX-2のpreExistingChanges改ざんとFIX-5のgit checkout不正利用が該当する。
中リスク: FIX-4のループ検出感度低下が該当する。
低リスク: FIX-1の内部キャッシュ同期とFIX-3のstdinエラーハンドリングが該当する。
