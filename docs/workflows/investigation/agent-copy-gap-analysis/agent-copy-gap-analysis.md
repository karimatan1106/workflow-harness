# Agent定義コピー欠落の調査報告

## 1. setup.sh の現状

setup.sh は9ステップで構成されている:

1. `.claude/hooks/` 作成
2. `pre-tool-guard.sh` ラッパー生成
3. `settings.json` にフック登録
4. `.mcp.json` にMCPサーバー登録
5. `.agent/` ディレクトリ作成
6. `.agent/.worker-allowed-tools` 作成
7. `.agent/.worker-allowed-extensions` 作成
8. スキルファイルコピー (`.claude/skills/workflow-harness/`)
9. ルールファイルコピー (`.claude/rules/`)

**欠落: `.claude/agents/` (coordinator.md, worker.md) のコピーステップが存在しない。**

## 2. 親リポジトリの `.claude/agents/` 内容

| ファイル | 役割 | tools | maxTurns |
|---------|------|-------|----------|
| coordinator.md | L2 Coordinator。スコープ分析、タスク分解 | Read,Glob,Grep,Bash,Skill,ToolSearch | 30 |
| worker.md | L3 Worker。ファイル操作実行 | Read,Write,Edit,Glob,Grep,Bash | 15 (background) |

これらは `Agent` ツールの `subagent_type` パラメータで参照される定義ファイル。

## 3. ハーネス側にソースが存在しない

`workflow-harness/.claude/agents/` ディレクトリ自体が存在しない。
つまり、setup.sh にコピーステップを追加するだけでは不十分で、まずハーネス側にソースファイルを配置する必要がある。

## 4. pre-tool-guard.sh の Agent whitelist との関係

`hooks/pre-tool-guard.sh` L61-71:
```
if [ "$TOOL_NAME" = "Agent" ]; then
  case "$SUBAGENT_TYPE_LOWER" in
    coordinator|worker)
      ;; # allowed
    *)
      echo "BLOCKED: ..." >&2
      exit 2
  esac
fi
```

影響分析:
- Orchestrator が `Agent(subagent_type="coordinator")` を呼ぶ → hookは通過する
- しかし `.claude/agents/coordinator.md` が対象プロジェクトに存在しなければ、Claude Code が agent定義を見つけられず実行時エラーになる
- hookは「呼び出し可否」のみ制御し、agent定義ファイルの存在は検証しない
- 結果: hookは通すが、agent起動に失敗するという「すり抜けエラー」が発生する

## 5. 必要な修正

### 5-A. ハーネス側にソースを配置
```
workflow-harness/.claude/agents/
  coordinator.md
  worker.md
```

### 5-B. setup.sh にステップ10を追加
ステップ8(skills)・ステップ9(rules)と同様のパターンで:
```bash
# 10. Copy agent definitions (force overwrite for latest version)
AGENTS_SRC="$HARNESS_DIR/.claude/agents"
AGENTS_DST="$PROJECT_DIR/.claude/agents"

if [ -d "$AGENTS_SRC" ]; then
  mkdir -p "$AGENTS_DST"
  cp -rf "$AGENTS_SRC/"* "$AGENTS_DST/"
  echo "Copied agent definitions to $AGENTS_DST:"
  ls -1 "$AGENTS_DST" | sed 's/^/  /'
else
  echo "WARNING: Agent definitions source not found: $AGENTS_SRC"
fi
```

force overwrite (cp -rf) が適切。agent定義はハーネス側が権威ソースであり、プロジェクト固有のカスタマイズは想定しない。

### 5-C. (任意) hookでagent定義存在チェック追加
pre-tool-guard.sh の Agent whitelist判定後に、定義ファイルの存在を確認して早期エラーにすることも可能。ただし hookからプロジェクトルートの `.claude/agents/` を参照する必要があり、パス解決の複雑さが増すため優先度は低い。

## 6. 影響範囲

- 新規プロジェクトへのハーネスセットアップ時、coordinator/worker agentが使えない
- 既存の親リポジトリ(Workflow)は手動で配置済みのため影響なし
- setup.sh を再実行した既存プロジェクトにも自動で配布される(修正後)
