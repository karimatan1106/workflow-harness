## サマリー

- [R-001][finding] phase-edit-guard.jsのrunHook関数(行48-79)は拡張子チェックのみを実施しており、ファイルパスのディレクトリ成分を検査するロジックが存在しない。docs/workflows/配下への書き込みは現在の実装ではフェーズ許可拡張子を持つ限り通過する。
- [R-002][finding] isBypassPath()関数(hook-utils.js行49-56)はworkflow-harness/、.claude/projects/memory/、.claude/settings等をバイパス対象として定義するが、docs/workflows/を検出してブロックするパターンは持たない。ブロック方向の検出機能は設計上存在しない。
- [R-003][finding] SKILL.mdのSection 2「Command Routing」には「re-launch subagent with retry prompt (never edit directly)」と記述されているが、Orchestratorパターン節は独立して存在せず、具体的な違反例パターンが一切記載されていない。
- [R-004][finding] workflow.mdはSKILL.mdの完全ミラーであり、両ファイルとも89行で内容が一致している。SKILL.mdへの変更はworkflow.mdにも同一内容で適用して同期を維持する必要がある。
- [R-005][finding] CLAUDE.md Section 5 Forbidden Actionsには「Orchestrator directly editing artifacts on validation failure」が禁止事項として宣言されているが、phase-edit-guard.jsにこのルールを技術的に執行するロジックが存在しないため、宣言と実装が乖離した状態にある。
- [R-006][constraint] phase-edit-guard.jsは現在86行であり、200行制限(CORE PRINCIPLE)に対して114行の余裕がある。追加ロジック10行以内の制約は容易に満足できる設計余裕がある。
- [R-007][finding] CLAUDE.md Section 6のOrchestratorパターン節にはサブエージェント委任フローが詳述されているが、同内容がSKILL.mdに引き継がれていないため、SKILL.md経由で動作するOrchestratorはこの指示を受け取れない構造的欠陥がある。
- [R-008][finding] CLAUDE.md Section 7 Retry Protocolの第1項「NEVER edit artifacts directly with Edit/Write tools」は全フェーズで適用されるが、フック側には対応する検出機構がなく、OrchestratorがSection 7を違反した場合でも技術的阻止が行われない。

## 調査結果

phase-edit-guard.jsのrunHook関数(行48-79)は、まずJSONパースでEdit/Write以外のツール呼び出しをexit(0)でスルーし、次にisBypassPath(filePath)でバイパス判定を行い、そしてgetCurrentPhase()で現在フェーズを取得して対応する許可拡張子リストをPHASE_EXTENSIONSから参照する。
getEffectiveExtension()は.test.tsや.spec.tsのような複合拡張子を正しく認識するため、テストファイルのフェーズ制御は機能している。
このフローにはパス成分のディレクトリ検査が含まれておらず、docs/workflows/配下のパスであっても拡張子が許可リストに含まれれば通過する。
研究フェーズのような.mdのみ許可のフェーズでは、docs/workflows/配下の.mdファイルをOrchestratorが直接Edit/Writeした場合に何もブロックされない状態である。
implementationフェーズのようにPHASE_EXTENSIONSが多数の拡張子を許可するフェーズでは、さらに広範なファイルタイプの直接書き込みが可能になってしまう。

SKILL.mdのSection 2「Command Routing」は`/harness next`の動作説明として「On DoD failure: re-launch subagent with retry prompt (never edit directly)」と記載している。
これはOrchestratorが直接編集してはならないというルールを含んでいるが、独立したOrchestratorパターン節として整理されておらず、違反例（OrchestratorがEdit/Write toolでdocs/workflows/配下を直接書き込む行為）の具体例も存在しない。
CLAUDE.md Section 6にはOrchestratorパターンの詳細説明があり、サブエージェント委任フローのコードブロック形式の説明が明確に記述されているが、SKILL.mdにはその内容が引き継がれていない。
CLAUDE.md Section 7の第1項「NEVER edit artifacts directly」は5項目あるRetry Protocol内に埋め込まれており、Orchestratorが直接書き込みを試みる場面でのコンテキストとして認識されにくい位置にある。

docs/workflows/パス検出ロジックは現在どのフックにも存在しない。
hook-utils.jsのisBypassPath()はworkflow-harness/とmemory/と.claude/settingsをバイパスとして定義するが、ブロック方向のパス検出機能は設計されていない。
block-dangerous-commands.jsもloop-detector.jsもdocs/workflows/パスに対する固有の検出を行わない。
phase-edit-guard.jsのrunHook内でisBypassPath()呼び出し後にdocs/workflows/パスチェックを追加することが最も影響範囲を限定した実装箇所として適切である。
フェーズ取得前に配置することでGetCurrentPhase()の不要な呼び出しを避けるとともに「フェーズに関わらずdocs/workflows/への直接書き込みは常時禁止」という設計意図を明確に表現できる。

変更が必要な具体的箇所として、phase-edit-guard.js行59の`if (isBypassPath(filePath)) process.exit(0);`の直後(行60付近)にdocs/workflows/パスチェックを約7-8行追加することが必要である。
SKILL.mdはSection 2の`/harness next`説明(行59-63)の後または新規セクションとして違反例と正しいパターンを合計10行程度追加することが必要である。
workflow.mdはSKILL.mdのミラーとして87-89行付近に同一変更を適用する。
これらの変更により宣言的ルール（SKILL.mdの記述）と技術的強制（フックのブロック）の両面でOrchestratorの直接編集を防止できる状態が確立される。

phase-edit-guard.jsのphaseチェックロジック全体を見ると、exit(0)を返すパスが7箇所（行50、53、57、59、62、65、69）存在し、exit(2)を返すパスは行76の1箇所のみである。
この非対称な構造はフェールセーフ設計を示しており、追加するdocs/workflows/チェックもこの設計原則に従い、検出失敗時にはexit(0)でスルーする実装とするべきかどうかを検討する必要がある。
docs/workflows/パスの検出はfilePath変数の文字列操作のみで行えるため、外部I/O依存がなく確実に検出できる。

## 既存実装の分析

phase-edit-guard.jsがexit code 2を返す唯一の条件は行70-77の「allowedExt.includes(ext)がfalse」の場合のみである。
つまり現在のブロック条件はフェーズに許可されていない拡張子を持つファイルを編集しようとした場合のみであり、ディレクトリベースのブロックは存在しない。
allowedExt === nullのフェーズ（build_check, commit, push, completed）はexit(0)で全て通過させる。
この設計はフェーズ固有の拡張子制御には機能しているが、Orchestratorが直接書き込んではならないdocs/workflows/配下のアーティファクト保護には機能していない。
追加する検出ロジックはexit code 2でブロックし、stderrに`{ decision: 'block', reason: '...' }`フォーマットのJSONを出力する既存パターンと一致させるべきである。
ブロックメッセージには「Use a subagent via Task tool instead of direct Edit/Write」のような指示を含めることで、Orchestratorがエラーメッセージから正しい対処方法を即座に理解できるようにする設計が望ましい。

SKILL.mdのOrchestratorパターン節は存在しない。
SKILL.mdはSection 1（Commands）とSection 2（Command Routing）とSection 3（Workflow Usage Decision）の3セクションで構成されており、Section 2のCommand Routing内に「never edit directly」というフレーズが1回登場するにとどまる。
「Orchestratorパターン」として独立した節はなく、違反例のコードブロックも存在しない。
CLAUDE.md Section 6ではOrchestratorパターンが詳細に説明されているが、SKILL.mdにはその内容が引き継がれていないことは本調査で初めて明らかになった構造的欠陥である。
CLAUDE.md Section 7 Retry Protocolの第1項も「NEVER edit artifacts directly with Edit/Write tools」と明記しているが、これもSKILL.mdには反映されていない。

追加すべき検出ロジックの設計案として、runHook関数内のisBypassPath()チェック通過後にdocs/workflows/パスチェックを挿入する方針が適切である。
実装では`const normPath = filePath.replace(/\\/g, '/')`でパス区切り文字を正規化した上で`normPath.includes('docs/workflows/')`を検査する。
ブロック時はJSONメッセージとして`{ decision: 'block', reason: '...' }`をstderrに書き込んでprocess.exit(2)を呼ぶ。
エラーメッセージにはサブエージェント委任を促す文言を含める設計が望ましく、例えば「Direct write to docs/workflows/ is forbidden for Orchestrator. Delegate to a subagent via Task tool.」のような明示的な指示文がOrchestratorの次のアクションを正しく誘導する。
この設計はCLAUD.md Section 6とSection 7の意図を技術的に具現化したものである。

SKILL.mdへの追加内容として、違反パターンと正しいパターンを対比させた記述が最も認知的効果が高い。
違反例は「Orchestratorが直接Edit/Writeでdocs/workflows/配下のファイルを書き込む操作」であり、正しいパターンは「harness_nextのDoD失敗時にsubagentTemplateをTask toolに渡してサブエージェントを再起動する操作」である。
この対比形式の記述はCLAUDE.md Section 6と7の原則をSKILL.mdの読者に対して具体的な行動指針として伝達し、フック技術的ブロックと意識的抑止の二重防御を実現する。

フックとSKILL.mdの変更は独立したレイヤーで機能する点が重要である。
フック変更は技術的強制として違反行為を検出してブロックするが、SKILL.md変更は認知的強制として事前にOrchestratorの判断を正しい方向に誘導する。
どちらか一方だけでは不十分であり、両方を組み合わせることで防御の多層性（defence in depth）を実現できる。
この設計方針はCLAUDE.md Section 1の「scope_definition + impact_analysisで10Mラインを絞り込む」原則と同様に、問題を早い段階で文書化し、かつ技術的に検証可能な形で強制するアーキテクチャ哲学と一致している。

## 暗黙の制約・Magic Number 一覧

isBypassPath関数は`workflow-harness/`という文字列を`n.includes()`で検出する。
この文字列はハードコードされており、サブモジュールのディレクトリ名が変更された場合に機能しなくなる。
同様にdocs/workflows/パスチェックを追加する場合、この文字列もハードコードになるため、将来のdocsDir変更に対して脆弱になる点を考慮する必要がある。
ただし現状のコードベース全体でこの種のハードコードが標準的実装パターンとして採用されており、設計上の一貫性を保つためには同パターンに従うことが適切である。
将来的なパス変更への対応は別途設定外部化タスクとして扱うべきである。

PHASE_EXTENSIONSオブジェクトのnull値はexit(0)を意味するという慣習は文書化されていない暗黙の規則である。
行64-65の`allowedExt === null || allowedExt === undefined`チェックがこの規則を実装しており、build_check、commit、push、completedフェーズでは全拡張子が許可される。
今回追加するdocs/workflows/パスチェックは、このnull判定の前に配置することで、nullフェーズであってもdocs/workflows/への直接書き込みがブロックされる設計とする必要がある。
この配置判断はフェーズ独立の絶対禁止ルールとしての性質を保証するために重要である。

getEffectiveExtension関数の`doubles`配列(行41)は.test.ts、.spec.ts、.test.tsx、.spec.tsx、.test.js、.spec.jsの6パターンをハードコードしており、他の複合拡張子は単純なextname()で処理される。
この判定はphase-edit-guard.js専用であり、hook-utils.jsには含まれていない。
今回のdocs/workflows/パスチェックは拡張子に依存しない検出であるため、getEffectiveExtension()の呼び出し前に配置することで拡張子判定ロジックと完全に分離できる。

行69の`.toon`ファイル特例は「TOONチェックポイントは.mdを許可する全フェーズで許可される」という暗黙の決定であり、コメントで説明されているがCLAUDE.mdやSKILL.mdには記載されていない。
今回追加するdocs/workflows/パスチェックに対しても.toonファイルを同様に例外とするかどうかを明確に判断する必要がある。
scope-definition.toonやresearch.toonはサブエージェントが生成するアーティファクトであるため、Orchestratorが直接書き込むことは原則ないが、例外適用の有無を明示することでフックの挙動の予測可能性が高まる。

hookファイル群の依存関係として、phase-edit-guard.jsはhook-utils.jsから`findProjectRoot`、`getCurrentPhase`、`isBypassPath`の3関数をrequire()でインポートしている。
これら3関数は今回の変更対象外であり、フックの内部実装を変更する際にも依存関係を維持したまま拡張できる。
runHook関数はこれらのユーティリティ関数を呼び出した後に独自の判定ロジックを展開する構造であり、docs/workflows/パスチェックはこの独自判定ロジック内に局所化できる。

## 依存バージョン固有挙動

phase-edit-guard.jsはNode.js CommonJS（`'use strict'`, `require()`）で書かれており、Node.js v22.15.0環境で実行される。
フックはClaude Codeのpre-tool-useフックとして呼び出され、stdinからJSON入力を受け取り、stdoutおよびstderrへの出力とprocess.exit()コードでClaude Code本体に応答を返す設計である。
この実行モデルはClaude Code独自のフック仕様に基づいており、Node.jsの標準的なCLIツールとは異なるシグナリング規約を持つ点に注意が必要である。

process.exit(2)はClaude Codeフックの「block」シグナルとして機能し、ツール呼び出しをキャンセルさせる。
process.exit(0)は「allow」であり、stderrへのJSON出力は`{ decision: 'block', reason: '...' }`フォーマットでClaude Codeがエラーメッセージをユーザーに表示する際に使用される。
process.exit(1)はフック自体のエラーとして処理される点でexit(2)と異なり、Claude Codeはexit(1)をシステムエラーとして扱いexit(2)をユーザーへの明示的ブロックとして区別する。
この3値の区別はClaude Code側の仕様であり、Node.js側のバージョン依存性はない。

stdinイベントチェーンはprocess.stdin.on('data', ...)でチャンクを蓄積し、process.stdin.on('end', ...)でrunHookを呼ぶ設計である。
process.stdin.on('error', ...)はexit(0)でフォールバックし、フック自体のエラーがツール呼び出しをブロックしないよう安全側に倒している。
この設計判断により、JSONパースエラーや空入力もexit(0)でスルーされるため、フックの誤作動によるClaude Code操作不能を防いでいる。
Node.js v22のstdinイベントモデルはv12以降と互換性があり、バージョン固有の問題は発生しない。
対象がJavaScriptフック変更とMarkdown文書変更であるため、npmパッケージのバージョン依存性も存在せず、package.jsonの変更なしに実装できる点も確認済みである。

Windows環境でのパス区切り文字問題として、filePathにはWindows形式のバックスラッシュ区切り（例: `docs\workflows\...`）とUnix形式のスラッシュ区切り（例: `docs/workflows/...`）の両方が渡される可能性がある。
hook-utils.jsのisBypassPath()はこの問題を`n = filePath.replace(/\\/g, '/')`で正規化して解決しており、今回追加するdocs/workflows/パスチェックも同様の正規化を適用する必要がある。
この正規化パターンは既存コードとの一貫性を保ち、Windows/macOS/Linux全環境での動作を保証する上で必須の処理である。

フックがpre-tool-useとして呼び出される際の入力JSON構造として、`tool_name`または`tool`フィールドにツール名、`tool_input`または`input`フィールドに引数が格納される。
`file_path`または`path`フィールドにファイルパスが格納されるという二重キー対応は、Claude Codeの異なるバージョンや呼び出し形式に対する後方互換性を考慮した設計である。
今回の変更はfilePathの取得方法には手を加えず、取得済みのfilePath変数に対してパスチェックを追加するのみであるため、入力JSON構造の変化に対して堅牢である。
