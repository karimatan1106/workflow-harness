# artifact_drift (ART-1) 誤検知 調査報告

## 結論

design-review.md の artifact_drift 誤検知は、承認後にDoD修正のためファイルが再編集されたことが原因。gitの変更なしという報告は、ファイルがそもそもgit未追跡(untracked)であるため。

## 根本原因

### 時系列

1. `05:26:24` -- `harness_approve(type: "design")` が実行され、design-review.md のSHA-256ハッシュが記録された
   - 記録ハッシュ: `f9ce2a7d97be1924437414e9884ef4e6a598372419b8152fbdc12788f79f7841`
2. `05:26:28` -- design_review フェーズのDoD検証が失敗（3件のエラー）
   - Missing required sections: next
   - Forbidden patterns found: 未定
   - Missing acDesignMapping section (IA-3)
3. DoDエラー修正のため design-review.md が再編集された
4. `05:29:38` -- design_review が通過し test_design フェーズへ遷移
5. test_design フェーズの DoD で artifact_drift チェックが実行される
   - 現在のハッシュ: `875b1ad58a440471b80ca10da7ead1f4236ab6940c26397aba5310bbad73c4a6`
   - 記録ハッシュと不一致 --> drift 検出

### 構造的問題: 承認とDoD検証の順序

```
[approve] --> hash記録 --> [DoD検証] --> 失敗 --> [ファイル修正] --> [DoD再検証] --> 通過
                                                    ^^^^^^^^
                                                    ここでハッシュが変わる
```

approval.ts の `handleHarnessApprove` (L102-108) は承認時にハッシュを記録するが、DoD検証はその後に実行される。DoDが失敗してファイルを修正すると、記録済みハッシュと乖離する。

### なぜ "gitでは変更なし" と見えたか

design-review.md はgit untracked（未追跡ファイル）であり、`git diff` は空を返す。承認後の変更はgitレベルでは検知できない。proof logの "git diff confirms no changes" はLLMが記録した主観的証拠であり、自動チェックの結果ではない。

## 影響範囲

### 該当コード

| ファイル | 行 | 役割 |
|---------|-----|------|
| `workflow-harness/mcp-server/src/gates/dod-l4-art.ts` | L1-41 | ART-1チェック実装。SHA-256比較 |
| `workflow-harness/mcp-server/src/tools/handlers/approval.ts` | L102-108 | 承認時のハッシュ記録 |
| `workflow-harness/mcp-server/src/state/manager-invariant.ts` | L55-58 | `applyRecordArtifactHash` |
| `workflow-harness/mcp-server/src/state/types.ts` | L117 | `artifactHashes` フィールド定義 |

### ART-1 チェック対象フェーズ (dod-l4-art.ts L13-16)

test_design, test_impl, implementation, build_check, code_review, testing, regression_test, acceptance_verification

### APPROVAL_ARTIFACT_MAP (approval.ts L11-15)

| approvalType | ファイル |
|-------------|---------|
| hearing | /hearing.md |
| requirements | /requirements.md |
| design | /design-review.md |
| test_design | /test-design.md |
| code_review | /code-review.md |

## 状態ファイルの証拠

パス: `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/232ed9ec-4af7-4cdf-b147-97cb18b1716c_article-insights-harness-improvements/workflow-state.toon`

```
artifactHashes:
  "C:\ツール\Workflow\docs\workflows\article-insights-harness-improvements/design-review.md": f9ce2a7d97be1924437414e9884ef4e6a598372419b8152fbdc12788f79f7841
```

現在のファイルハッシュ: `875b1ad58a440471b80ca10da7ead1f4236ab6940c26397aba5310bbad73c4a6` (不一致)

## 副次的発見

1. パス区切り混在: 状態ファイル内のパスが `C:\ツール\Workflow\docs\...improvements/design-review.md` とバックスラッシュとスラッシュが混在。Windows環境でのパス正規化が不十分。
2. 二重ファイル: `design_review.md`(1,308 bytes)と`design-review.md`(12,850 bytes)の2ファイルが存在。前者はフェーズ出力、後者はapproval対象。
3. 状態ディレクトリの二重ネスト: `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/` という二重パス構造がある。

## 修正方針の候補

1. DoD通過後にハッシュを再記録する（承認時ではなくフェーズ遷移時に記録）
2. 承認+DoD検証をアトミックに実行し、DoD失敗時は承認も取り消す
3. harness_next（フェーズ遷移）時にハッシュを更新する
