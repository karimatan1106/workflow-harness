# ワークフロープロセス阻害要因解消 - 脅威モデル

## サマリー

本ドキュメントは、8件のワークフローフック不備修正（D-1～D-8）に対する脅威分析を提供する。
修正対象はbash-whitelist.js（5件）、phase-edit-guard.js（2件）、enforce-workflow.js（1件）である。
主要な脅威は、D-3のSHELL_BUILTINS除外でのコマンド迂回、D-4のnode単体許可での任意スクリプト実行、D-6のgit -C正規化での迂回攻撃の3点である。
STRIDEモデルに基づく評価では、最大リスクスコア15（deploy連携攻撃）で、全体としてMedium～Highレベルの対策が必要。
次のplanningフェーズでは、本脅威モデルの緩和策を実装計画に統合する必要がある。

---

## 脅威モデリング手法

採用モデルはSTRIDE（Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege）。
評価基準として影響度（1-5）と発生確率（1-5）の積でリスクスコア（1-25）を算定する。
リスクレベルはCritical（16-25）、High（11-15）、Medium（6-10）、Low（1-5）の4段階で分類する。
既存のセキュリティ制御（BASH_BLACKLIST、phase-edit-guard、code_review等）による緩和効果を考慮して評価する。
各修正が既存の防御機構を弱体化させないことの検証も本脅威モデルのスコープに含む。

---

## FR-1脅威分析: ci_verificationフェーズのホワイトリスト登録

### T1-1: 不正なGitHub API呼び出しによる情報漏洩（Information Disclosure）

ghコマンドの許可により、認証済みGitHub APIへのアクセスが可能になる。
攻撃者がCI検証を装い、プライベートリポジトリ情報やセンシティブなCI実行結果の取得を試みるリスクがある。
T1-1の影響度は3（機密情報漏洩）、発生確率は2（GitHub CLI認証必要で限定的）、リスクスコアは6のMediumレベルである。
緩和策として、ghコマンドは読み取り専用操作（pr checks、run view等）のみ使用し、BASH_BLACKLISTのリダイレクト制御を維持する。
GitHub CLI認証トークンは最小権限（read:repo、read:workflow）で設定し、ci_verificationフェーズでのファイル編集は禁止とする。

### T1-2: 大量API呼び出しによるCI検証プロセス停止（Denial of Service）

ghコマンドの無制限実行によるGitHub API rate limit到達で、CI検証プロセスが停止する可能性がある。
T1-2の影響度は3（ワークフロー停止）、発生確率は1（意図的攻撃がなければ発生しない）、リスクスコアは3のLowレベルである。
GitHub APIの認証済みrate limit（5000リクエスト/時間）は通常のCI検証で十分であり、ci_verificationフェーズは数分以内で完了する設計。
フック全体の実行時間制約により大量呼び出しは自然に制限される。

---

## FR-2脅威分析: deployフェーズのホワイトリスト登録

### T2-1: 不正なコンテナイメージデプロイ（Tampering）

dockerコマンドの許可により、悪意のあるコンテナイメージのビルド・プッシュ・デプロイが可能になるリスクがある。
T2-1の影響度は5（本番環境への重大な影響）、発生確率は2（レビュープロセスで検出可能）、リスクスコアは10のMediumレベルである。
deployフェーズはワークフロー最終段階で、code_review/testing/regression_test/parallel_verificationの全検証を通過済み。
Dockerfileの変更はphase-edit-guardで制御され、コンテナレジストリへのpush権限は別途IAM/RBACで管理する。

### T2-2: ssh/scpによるリモートサーバー権限昇格（Elevation of Privilege）

ssh/scpコマンドの許可により、リモートサーバーへの接続と任意コマンド実行が可能になるリスクがある。
T2-2の影響度は5（サーバー完全掌握）、発生確率は1（SSH秘密鍵管理が別途必要）、リスクスコアは5のLowレベルである。
SSH秘密鍵は秘密管理システム（Vault、AWS Secrets Manager等）で管理し、デプロイ用SSH鍵は最小権限で構成する。
SSH接続先は既知のデプロイサーバーに限定し、リモートコマンドはsystemctl restart等の限定的操作のみとする。

### T2-3: kubectlによる不正Kubernetesリソース展開（Tampering）

kubectlコマンドの許可により、Kubernetesクラスターへの不正リソース展開が可能になるリスクがある。
T2-3の影響度は5（クラスター全体への影響）、発生確率は2（RBAC制御で緩和可能）、リスクスコアは10のMediumレベルである。
Kubernetes RBACでデプロイ可能なリソースタイプを制限し、Admission Controllerで追加検証を実施する。
YAMLマニフェストの変更はphase-edit-guardで制御され、kubectl dry-run=client での事前検証を推奨する。

---

## FR-3脅威分析: シェル組み込みコマンドのホワイトリスト除外

### T3-1: exitコマンドによる検証迂回（Elevation of Privilege）

exit 0の許可により、エラー発生時に強制的に成功状態で終了し、ワークフロー検証を迂回する可能性がある。
例として `npm test; exit 0` でテスト失敗を隠蔽するケースが想定される。
T3-1の影響度は4（品質検証の迂回）、発生確率は2（コードレビューで検出可能）、リスクスコアは8のMediumレベルである。
code_reviewフェーズで不自然なexit 0使用を検出し、CI/CDパイプライン側で独立したテスト実行を行う。
testingフェーズではテスト結果の終了コードを必ず確認する設計とする。

### T3-2: :(null command)による検証スキップ（Spoofing）

コロンコマンド（null command、常に成功）の許可により、本来実行すべきコマンドをスキップする可能性がある。
T3-2の影響度は3（検証の迂回）、発生確率は1（コードレビューで容易に検出）、リスクスコアは3のLowレベルである。
コロンコマンドの使用は非推奨とし、code_reviewフェーズで不自然な使用パターンを検出する方針とする。

---

## FR-4脅威分析: nodeコマンドの単体実行許可

### T4-1: 任意JavaScriptコード実行（Elevation of Privilege）

node filename.jsの許可により、ファイルシステムアクセス、環境変数窃取、外部ネットワーク通信が可能になるリスクがある。
T4-1の影響度は5（システム全体への影響）、発生確率は2（既にnode -eで同等リスク許容済み）、リスクスコアは10のMediumレベルである。
既にnode -e "require('fs').writeFileSync(...)" で任意コード実行が可能であり、node filename.jsは新たなリスクを追加しない。
phase-edit-guardにより.jsファイルの編集はimplementation/refactoringフェーズでのみ可能であり、code_reviewで外部通信コードを検出する。

### T4-2: npmパッケージの脆弱性（Information Disclosure）

node実行スクリプトが依存するnpmパッケージに既知の脆弱性が存在し、情報漏洩に繋がるリスクがある。
T4-2の影響度は4（機密情報の漏洩）、発生確率は2（npm auditで検出可能）、リスクスコアは8のMediumレベルである。
security_scanサブフェーズでnpm auditを実行し、package-lock.jsonでバージョンを固定する。
信頼できるnpmレジストリのみを使用し、DependabotやSnykでの継続的脆弱性スキャンを推奨する。

---

## FR-5脅威分析: PHASE_ORDERへの欠落フェーズ追加

### T5-1: 不正確なガイダンスによるユーザー混乱（Repudiation）

PHASE_ORDERの不完全性により、フックのブロックメッセージが誤った次フェーズを提示するリスクがある。
T5-1の影響度は2（ユーザー体験の低下）、発生確率は3（現在発生中の問題）、リスクスコアは6のMediumレベルである。
PHASE_ORDERを完全な19フェーズ＋並列サブフェーズで構成し、ユニットテストで全フェーズ遷移を検証する。
CLAUDE.mdのフェーズ順序定義との整合性を確保し、並列フェーズとサブフェーズの関係をコメントで明記する。

### T5-2: 存在しないフェーズへの遷移によるワークフロー停止（Denial of Service）

並列フェーズがPHASE_ORDERに存在しないためfindNextPhaseForFileType()が-1を返し、進行不能になるリスクがある。
T5-2の影響度は3（ワークフロー停止）、発生確率は2（並列フェーズ使用時のみ）、リスクスコアは6のMediumレベルである。
MCPサーバー側のWorkflowPhase型定義と完全一致させ、undefinedを返す場合のフォールバック処理を追加する。

---

## FR-6脅威分析: git -Cオプションのホワイトリスト対応

### T6-1: 正規化処理の迂回による不正コマンド実行（Tampering）

normalizeGitCommand()の正規化ロジック不備により、特殊な構文で不正gitコマンドがホワイトリスト検証を迂回するリスクがある。
例として `git -C /tmp -c core.editor='rm -rf /' commit` のような攻撃パターンが想定される。
T6-1の影響度は5（任意コマンド実行）、発生確率は2（正規表現の脆弱性）、リスクスコアは10のMediumレベルである。
normalizeGitCommand()は-Cオプションのみを処理し、正規化後のコマンドが既存ホワイトリストに完全一致することを確認する。
悪意のある入力パターンを網羅的にテストし、特殊文字を含むパスは警告を出力する。

### T6-2: 任意ディレクトリのGitリポジトリアクセスによる情報漏洩（Information Disclosure）

git -Cにより任意パスのGitリポジトリにアクセスし、コミットメッセージやコード変更履歴を窃取するリスクがある。
T6-2の影響度は3（機密情報の漏洩）、発生確率は2（ファイルシステム権限で制限可能）、リスクスコアは6のMediumレベルである。
gitコマンドはreadonly操作（log、status、diff等）のみがホワイトリストに含まれ、ファイルシステム権限で保護する。
BASH_BLACKLISTによりファイルへの書き込みは禁止されるため、窃取データの外部保存は困難。

---

## FR-7脅威分析: フックブロックメッセージのstderr出力

### T7-1: エラーメッセージの非表示によるブロック理由の隠蔽（Repudiation）

console.logでのstdout出力により、Claude Codeがブロック理由を正しく認識せずユーザーに表示されないリスクがある。
T7-1の影響度は2（ユーザー体験の低下）、発生確率は3（現在の動作に依存）、リスクスコアは6のMediumレベルである。
console.errorへの変更はGit pre-commit hookの標準動作に準拠し、エラーメッセージの内容とフォーマットは維持する。
Claude Code側でのstderr処理を検証し、色付きメッセージがstderrでも有効であることを確認する。

### T7-2: ブロックメッセージ内情報のログ記録（Information Disclosure）

stderrに出力されるファイルパスやコマンド内容がログ収集システムで記録されるリスクがある。
T7-2の影響度は2（限定的な情報漏洩）、発生確率は1（既に機密情報を含まない設計）、リスクスコアは2のLowレベルである。
displayBlockMessage()は既にファイルパスを表示しており新たなリスクを導入しない。
パスワード・APIキー等の機密情報はコミット前に検出され、フックではブロック済み。

---

## FR-8脅威分析: architecture_reviewフェーズ定義削除

### T8-1: 削除による既存コードの予期しない破壊（Denial of Service）

architecture_reviewへの参照が他コードやドキュメントに残存している場合、削除で未定義フェーズエラーが発生するリスクがある。
T8-1の影響度は2（一部機能の停止）、発生確率は1（MCPサーバーに存在しないため限定的）、リスクスコアは2のLowレベルである。
git grepで全コードベースを検索して参照箇所を確認し、enforce-workflow.jsとphase-edit-guard.js以外に参照がないことを検証する。
削除後にユニットテストおよび統合テストで既存フェーズの動作が変わらないことを確認する。
architecture_reviewはMCPサーバーのWorkflowPhase型にも存在しないため、削除はコードベースの整合性向上に寄与する。

---

## 統合的脅威評価: 複合リスクシナリオ

### CS-1: nodeコマンドとgit -Cの組み合わせ攻撃

攻撃者がnode malicious.jsでスクリプトを実行しgit -Cで機密情報を窃取後、外部サーバーに送信するシナリオ。
CS-1のリスクスコアは12でHighレベルと評価する。
network-outbound制御でファイアウォールやプロキシにより外部通信を制限し、code_reviewフェーズで外部通信コードを検出する。
テストスクリプトはテスト設計書に基づくレビュー済みのもののみを実行する方針とする。

### CS-2: deployフェーズでのdocker-ssh連携攻撃

攻撃者がdocker buildで悪意のあるイメージをビルドし、ssh経由でリモートサーバーにバックドアを設置するシナリオ。
CS-2のリスクスコアは15でHighレベルと評価する。
deployフェーズに到達するまでに6つの検証フェーズ（testing、regression_test、parallel_verification等）を通過する必要がある。
Dockerfileの変更はcode_reviewで必ずレビューされ、CI/CDパイプラインでコンテナイメージスキャンを実施する。

### CS-3: SHELL_BUILTINSとexitによる検証スキップチェーン

攻撃者がnpm test || true; exit 0で全テストをスキップし不完全なコードをデプロイするシナリオ。
CS-3のリスクスコアは8でMediumレベルと評価する。
CI/CDパイプラインで独立したテスト実行を行いフック内のテスト結果に依存せず、regression_testフェーズでベースラインとの比較を行う。

---

## リスク優先順位マトリクス

FR-6（git -C正規化）の最大リスクスコアは10のMediumレベルで、正規化迂回と情報漏洩が主要脅威である。
FR-4（node単体実行）の最大リスクスコアは10のMediumレベルで、任意コード実行と脆弱性が主要脅威である。
FR-2（deployフェーズ）の最大リスクスコアは10のMediumレベルで、不正デプロイとkubectl操作が主要脅威である。
FR-3（SHELL_BUILTINS）の最大リスクスコアは8のMediumレベルで、exit 0による検証迂回が主要脅威である。
FR-1（ci_verification）、FR-5（PHASE_ORDER）、FR-7（stderr）はいずれもリスクスコア6のMediumレベルである。
FR-8（architecture_review削除）のリスクスコアは2のLowレベルで実質的なセキュリティリスクはない。
複合リスクとしてCS-2（deploy連携攻撃）がスコア15のHighレベルで最も注意が必要である。

---

## セキュリティ要件

### SR-1: ホワイトリスト最小権限の原則

deployフェーズのホワイトリストは必要最小限のコマンド（docker, kubectl, ssh, scp, rsync, gh, curl）に限定する。
各コマンドの用途をコメントで明記し、wget, nc, telnet等の不要コマンドは追加しない。
readonly系コマンド（ls、cat、grep等）はdeployフェーズでも使用可能とし、全コマンドの必要性をレビューする。

### SR-2: 正規化処理の厳格性

normalizeGitCommand()は正規化のみを行い、コマンド検証は既存ホワイトリストロジックに委ねる。
正規化後のコマンドが既存ホワイトリスト（git status等）に完全一致することを保証する。
特殊文字（セミコロン、アンパサンド、パイプ、バッククォート等）を含むパスは警告出力する。
悪意のある入力パターンを網羅するユニットテストで検証する。

### SR-3: シェル組み込みコマンドの限定

SHELL_BUILTINSにはtrue、false、:（null command）のみを含め、危険コマンド（eval、exec、source）は絶対に含めない。
exit単体はSHELL_BUILTINSに含めず、exitは`|| true`イディオムの代替として使用しない方針とする。
setオプションは-e、-u等の標準的エラー制御のみ推奨し、set -x（デバッグ出力）は機密情報漏洩リスクのため非推奨とする。

### SR-4: エラーメッセージの標準化

フックのブロックメッセージは全てstderr（console.error）に出力し、Git pre-commit hookの標準動作に準拠する。
メッセージ内容に機密情報（パスワード、APIキー等）を含めない設計を維持する。
Claude Codeでのエラー表示を手動テストで確認し、色付きメッセージの視認性を検証する。

### SR-5: フェーズ定義の整合性

PHASE_ORDERはCLAUDE.mdおよびMCPサーバーのWorkflowPhase型定義と完全一致させる。
並列フェーズとサブフェーズの順序関係を明確にし、architecture_reviewへの全参照を削除する。
findNextPhaseForFileType()の全パターンでユニットテストを実施する方針とする。

---

## 次フェーズへの引き継ぎ

planningフェーズでは本脅威モデルの緩和策を実装計画に統合する必要がある。
FR-6のnormalizeGitCommand()には悪意のある入力パターンのユニットテストとパストラバーサル検出ロジックが必須。
FR-4のnode許可にはcode_reviewでの外部通信コード検出とsecurity_scanへのnpm audit統合が推奨。
FR-2のdeployフェーズにはコマンド実行ログ記録とDockerfile/k8s YAMLのレビューチェックリストが推奨。
FR-3のSHELL_BUILTINSにはcode_reviewでのexit 0/|| trueパターン検出の静的解析ルール追加が推奨。
統合テストとして複合リスクシナリオ（CS-1, CS-2, CS-3）のテストケース作成が必要。
