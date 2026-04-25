# Threat Model: separate-workflow-harness-from-parent (Phase A)

task: separate-workflow-harness-from-parent
phase: threat_modeling
version: 1.0
date: 2026-04-11

## summary

STRIDE 6 カテゴリで Phase A の攻撃面を評価した。作業内容は「加法的 file copy + `.mcp.json` の cwd 1 行編集 + submodule commit/push」に限定されるため、攻撃面は極めて狭い。総合リスク評価は **Low**、ただし hooks コピー時の permission 保全と push 前の機密情報スキャンは明示的な制御として planning に組み込む。**High** カテゴリなし、Medium 1 件 (E), 残り 5 件は Low。

## 1. STRIDE Analysis

### 1.1 S — Spoofing (なりすまし)

- 脅威: push 先 remote が意図せず別リポジトリ (例 親側 `karimatan1106/Workflow.git`) に向いている可能性
- 既存統制: `workflow-harness/` サブモジュールは独自 `.git` を持ち remote は `karimatan1106/workflow-harness.git` に固定済み (research フェーズで `git remote -v` 確認)
- 追加統制: 実行直前に再度 `git -C workflow-harness remote -v` で origin URL を assert
- 評価 (S): **Low** (remote は固定かつ事前確認済)

### 1.2 T — Tampering (改竄)

- 脅威: hooks / phases / ADR / rules コピー時にバイト破損・改行コード変化・文字コード変換で原本と差分が生まれる
- 既存統制: 加法的コピー方針により親側原本は読み取り専用として不変
- 追加統制: コピー後に `diff` で親側原本と submodule 側を全ファイル比較し zero-diff を検証 (test phase の DoD)
- 評価 (T): **Low** (cp -p で原本保全、差分検出可能)

### 1.3 R — Repudiation (否認)

- 脅威: 移管 commit の作者追跡性が不十分で、後から変更責任を特定できない
- 既存統制: `git config user.name` / `user.email` が `karimatan1106` で設定済み、git log に author/committer が必ず残る
- 追加統制: 内部個人リポジトリのため GPG 署名は不要。commit メッセージに Phase A を明示して trace を強化
- 評価 (R): **Low** (git log と commit メッセージで監査追跡可能)

### 1.4 I — Information Disclosure (情報漏洩)

- 脅威: 移管対象 hook スクリプトや phase テンプレート内に API キー / GitHub PAT / credential がハードコードされており、public 化で漏洩する危険
- 既存統制: 対象リポジトリは private のため即時公開リスクは無いが、将来の public 化やフォーク拡散に備えて事前スキャン必要
- 追加統制: push 前に `grep -rEi '(api[_-]?key|token|secret|password|PAT|Bearer )' workflow-harness/.claude/hooks workflow-harness/.claude/commands workflow-harness/.claude/rules` を実行し 0 件を確認
- 評価 (I): **Low** (harness 純粋機能のみ、impact-analysis で親固有識別子ゼロを確認済)

### 1.5 D — Denial of Service (可用性阻害)

- 脅威: push 後に submodule を参照する他プロジェクトの自動 pull / CI が破壊され、下流が機能停止する
- 既存統制: submodule 独立 clone は手動 `git submodule update` 発動のみで自動 pull は存在しない。CI は静的 `.md`/`.sh` を対象に破壊テストを持たない (impact-analysis D5)
- 追加統制: 追加ファイルは既存 hook を上書きしない (tool-delegation.md 1 本を除く)、上書き 1 本は事前に diff で差分確認
- 評価 (D): **Low** (自動伝播なし、破壊テスト不在)

### 1.6 E — Elevation of Privilege (権限昇格)

- 脅威 1: `.sh` hook を cp で複製した際に実行権限 (+x) が欠落し、hook 起動が silent fail する (availability 劣化)
- 脅威 2: 逆にコピー先で 777 等の過剰権限が付与され、local 攻撃者が hook 置換で任意コード実行を起こす
- 既存統制: Windows 環境の NTFS では Unix permission bit はエミュレーションのみだが、git index には `100755` が記録される
- 追加統制: `cp -p` で mode 保全、コピー後に `git ls-files --stage workflow-harness/.claude/hooks/ | grep '^100755'` で実行可能 bit が親側と一致することを確認
- 評価 (E): **Low-Medium** (permission 保全手順を planning に明記する必要あり)

## 2. 総合リスク

- High: 0 件
- Medium: 1 件 (E — permission 保全手順を明示的に planning で規定する必要)
- Low: 5 件 (S / T / R / I / D)
- 総合判定: **Low** (E の Medium 要因は手順化で解消可能)

## decisions

- D-TM-1: STRIDE 6 カテゴリ全てで High なし。Medium は E の 1 件のみで、それ以外 5 カテゴリは Low
- D-TM-2: hooks コピーは `cp -p` で mode 保全。コピー後 `git ls-files --stage` で `100755` bit を親側と照合する手順を planning に明記
- D-TM-3: push 直前に `grep -rEi '(api[_-]?key|token|secret|password|PAT|Bearer )'` で移管対象配下をスキャンし 0 ヒットを DoD 条件とする
- D-TM-4: 実行直前に `git -C workflow-harness remote -v` で origin が `karimatan1106/workflow-harness.git` であることを assert
- D-TM-5: commit メッセージに API キー相当の文字列・ローカルパス・個人情報を含めない。Phase A 識別子と対象ディレクトリのみ記載
- D-TM-6: `.mcp.json` 編集後に `jq '.' workflow-harness/.mcp.json > /dev/null` で JSON 構文検証を実行し、破損した状態での push を防ぐ
- D-TM-7: force push は STRIDE T/D/E いずれの観点でも不要。通常 push のみ許可し、rollback は `git revert` + 通常 push で行う (impact-analysis D3 継承)

## artifacts

- `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/threat-model.md` (本ファイル)
- 参照: `scope-definition.md`, `impact-analysis.md`, `research.md` (同ディレクトリ配下)
- 検証対象: `workflow-harness/.claude/hooks/*.sh` の実行権限 bit, `workflow-harness/.mcp.json` の JSON 構文, `workflow-harness` の remote origin

## next

- planning phase: D-TM-2 (cp -p + mode 照合), D-TM-3 (secret scan), D-TM-4 (remote assert), D-TM-6 (jq 構文検証) の 4 手順を worker タスクの前後ガードとして組み込む
- requirements phase: 既存 AC-1 〜 AC-7 に加え、secret scan 0 ヒット / remote origin assert / hook 実行 bit 保全の 3 条件を DoD サブ条件として追加検討
- implementation phase: worker 層で各 batch 実行後に local verification を走らせ、submodule-commit-push の直前に 4 ガードをまとめて実行する
- test phase: `diff -r` による zero-diff 検証、`git ls-files --stage` による mode 検証、`jq .` による構文検証を DoD として登録
