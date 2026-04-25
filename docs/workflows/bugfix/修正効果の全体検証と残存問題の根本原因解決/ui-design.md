## サマリー

- 目的: FR-1・FR-2・FR-3 の 3 修正に対応した MCP ツールのインターフェース設計を定義する。
- 主要な決定事項: workflow_next はトップレベルの subagentTemplate を維持しつつサブフェーズレベルのフィールドを除外する。workflow_status は subagentTemplate を返さずスリムガイドのみを返す設計とする。MEMORY.md の subagentTemplate 取得手順は workflow_next 経由に限定して記述する。
- 次フェーズで必要な情報: next.ts 606〜614 行の変更差分、definitions.ts の各テンプレート末尾への追記内容、MEMORY.md の 80 行目と 94〜96 行目の書き換え内容。
- 変更対象: next.ts（FR-2）・definitions.ts（FR-3）・MEMORY.md（FR-1）の 3 ファイルに対応するインターフェース仕様を本ドキュメントで定義する。
- ビルド要件: next.ts と definitions.ts の変更後は npm run build と MCP サーバー再起動が必須であり、再起動未実施のままフェーズを進めてはならない旨を各設計セクションで明示する。

---

## CLIインターフェース設計

### workflow_next ツールの呼び出し仕様

workflow_next は MCP サーバーが公開するツールであり、現在のフェーズを次のフェーズへ遷移させる。
呼び出し元である Orchestrator は以下の引数を渡すことができる。

引数一覧:
- taskId（文字列、省略可能）: 遷移対象のタスク ID。省略時はアクティブなタスクを自動選択する。
- sessionToken（文字列、省略可能）: Orchestrator 認証用のセッショントークン。REQ-6 要件に対応するために使用する。
- forceTransition（真偽値、省略可能）: regression_test への遷移をベースライン未設定の状態で強制する場合に true を渡す。新規プロジェクト向けの設定であり通常は省略する。

parallel_verification への遷移時の挙動（FR-2 修正後）:
- FR-2 修正前: subPhases 内の 4 サブフェーズそれぞれに subagentTemplate・content・claudeMdSections が含まれ、レスポンス全体が約 61K 文字になる。
- FR-2 修正後: subPhases の各サブフェーズから subagentTemplate・content・claudeMdSections が除外される。トップレベルの phaseGuide.subagentTemplate は引き続き返されるため Orchestrator の標準フローは変わらない。

### workflow_status ツールの呼び出し仕様

workflow_status は現在のタスク状態を返すツールであり、Orchestrator がフェーズ情報を確認する目的で使用する。
引数は taskId（省略可能）のみである。

Fix 2 適用後の挙動:
- phaseGuide.subagentTemplate フィールドはレスポンスに含まれない。
- スリムガイド（フェーズ名・必須セクション等の要約情報）のみが返される。
- subagentTemplate を取得したい場合は workflow_next 経由で取得すること。
- workflow_status は「フェーズ確認」目的に限定して使用することが望ましい。

---

## エラーメッセージ設計

### workflow_next のバリデーション失敗エラー形式

workflow_next がフェーズ遷移時に成果物バリデーションを実行し、失敗した場合のエラーメッセージ形式を以下に定義する。

エラーメッセージの基本構造:
```
{
  "success": false,
  "error": "バリデーション失敗",
  "details": {
    "phase": "フェーズ名",
    "file": "対象ファイルパス",
    "violations": [
      {
        "type": "違反種別（例: 禁止パターン検出、行数不足、重複行、必須セクション欠落）",
        "message": "具体的な違反内容の説明",
        "line": 行番号（特定できる場合）
      }
    ]
  }
}
```

違反種別ごとのメッセージ例:
- 禁止パターン検出: 「成果物に禁止語（バリデーターが検出する英語略語4語・日本語8語グループ）が含まれています。対象語句を間接表現に置き換えてください。」
- 重複行エラー: 「トリム後に完全一致する行が3回以上出現しています。各行に固有の情報（シナリオ番号または操作名）を含めて一意にしてください。」
- 必須セクション欠落: 「必須セクション『## テストシナリオ』が存在しません。成果物に該当のMarkdownヘッダーを追加してください。」
- 行数不足: 「セクション『## サマリー』の実質行数が5行未満です。内容を追加してセクション密度の要件を満たしてください。」

### parallel_verification サブフェーズでのエラー処理フロー

FR-2 修正後、Orchestrator は parallel_verification に遷移した際に以下のフローでサブフェーズを実行する。

ステップ 1: workflow_next を呼んで parallel_verification に遷移する。レスポンスのトップレベル phaseGuide.subagentTemplate を取得する（このフィールドは除外されていない）。
ステップ 2: 各サブフェーズ（manual_test・security_scan・performance_test・e2e_test）を Task ツールで並列起動する。起動プロンプトには workflow_next で取得した subagentTemplate を使用する。
ステップ 3: サブフェーズのバリデーションが失敗した場合、Orchestrator は成果物を直接修正してはならない。代わりに Task ツールで subagent を再起動し、エラーメッセージを含むリトライプロンプトを渡す。
ステップ 4: バリデーション成功後に workflow_complete_sub を呼んでサブフェーズを完了とする。

---

## APIレスポンス設計

### workflow_next のレスポンス構造（FR-2 修正後）

並列フェーズ（parallel_verification）への遷移時のレスポンス構造を以下に示す。

```json
{
  "success": true,
  "taskId": "タスクID文字列",
  "currentPhase": "parallel_verification",
  "phaseGuide": {
    "phaseName": "parallel_verification",
    "description": "並列検証フェーズの説明",
    "subagentTemplate": "トップレベルの subagentTemplate テキスト（Orchestrator が使用するテンプレート）",
    "requiredSections": ["## テスト結果", "## 検証結論"],
    "subPhases": {
      "manual_test": {
        "name": "manual_test",
        "description": "手動テストフェーズ"
      },
      "security_scan": {
        "name": "security_scan",
        "description": "セキュリティスキャンフェーズ"
      },
      "performance_test": {
        "name": "performance_test",
        "description": "パフォーマンステストフェーズ"
      },
      "e2e_test": {
        "name": "e2e_test",
        "description": "E2Eテストフェーズ"
      }
    }
  }
}
```

重要: subPhases 内の各サブフェーズオブジェクトには subagentTemplate・content・claudeMdSections フィールドが含まれない。
これは FR-2 の修正によってレスポンスサイズが約 61K 文字から 15K 文字以下に削減された結果である。
サブフェーズ個別の subagentTemplate が必要な場合は workflow_status を呼び出して取得すること。

### workflow_status のレスポンス構造（Fix 2 適用後）

workflow_status が返す phaseGuide のうち、subagentTemplate は含まれない。
スリムガイドのみが返される設計であり、以下の構造となる。

```json
{
  "success": true,
  "taskId": "タスクID文字列",
  "currentPhase": "parallel_verification",
  "phaseGuide": {
    "phaseName": "parallel_verification",
    "description": "フェーズの簡潔な説明",
    "requiredSections": ["## テスト結果", "## 検証結論"],
    "subPhases": {
      "manual_test": {
        "name": "manual_test",
        "description": "手動テストフェーズ",
        "subagentTemplate": "サブフェーズ個別テンプレートテキスト（workflow_status 経由では取得可能）"
      }
    }
  }
}
```

注意: workflow_status はトップレベルの phaseGuide.subagentTemplate を返さない（Fix 2 の変更点）。
Orchestrator が subagentTemplate を必要とする場合は workflow_next を使用すること。
workflow_status のサブフェーズには subagentTemplate が含まれる仕様であり、
parallel_verification 開始後に個別サブフェーズのテンプレートを確認する際に活用できる。

---

## 設定ファイル設計

### MEMORY.md の更新後「subagentTemplate取得手順」セクション構造

FR-1 の修正により、MEMORY.md の「Orchestrator の subagentTemplate 使用ルール」セクションを以下の構造に更新する。

#### 正しい手順（この順序を省略してはならない）

更新後の手順 1（80 行目の書き換え結果）:
```
1. `workflow_next` のレスポンスから `phaseGuide.subagentTemplate` を取得する
   （注: `workflow_status` は Fix 2 以降 subagentTemplate を返さない。スリムガイドのみ返す設計）
```

更新後の「テンプレートが取得できない場合」セクション（94〜96 行目の書き換え結果）:
```
workflow_next を再度呼ぶか、workflow_status でフェーズ情報を確認した上で、
CLAUDE.md の「subagent起動テンプレート」セクションを使用する。
workflow_status は subagentTemplate を含まないため、テンプレートの取得源として使用できない。
```

#### 設計の根拠

Fix 2 が適用された環境では workflow_status は subagentTemplate を返さない。
Orchestrator が MEMORY.md の旧記述を信頼して workflow_status から subagentTemplate を取得しようとすると、取得に失敗してプロンプトを自力で構築するリスクが生じる。
修正後の MEMORY.md は「workflow_next が正しい取得源であること」と「workflow_status はテンプレートの取得源として使用できないこと」の両方を明示する。
この変更により、Orchestrator の誤動作（workflow_status に subagentTemplate を期待してループする）を防止できる。
MEMORY.md はランタイムのコードではなく参照ドキュメントであるため、変更後のビルドや MCP サーバー再起動は不要である。

### definitions.ts テンプレート設計方針

FR-3 の修正によって追加するガイダンスセクションの設計方針を以下に示す。

各テンプレートへの追加セクション名: 「## 評価結論フレーズの重複回避（特化ガイダンス）」
追加位置: 各 subagentTemplate テキストの末尾、「## 出力」行の直前
NG/OK 例の形式: バリデーター検出パターンに対して具体的なシナリオ番号または操作名を含む OK 例を 2 件以上示す
対象テンプレート: manual_test・performance_test・e2e_test の 3 テンプレートであり、security_scan は Fix 1 で既に修正済みのため対象外

追加後のテンプレート末尾構造（manual_test を例として示す）:

```
## 評価結論フレーズの重複回避（特化ガイダンス）
複数のテストシナリオで同一フォーマットの合否判定行を繰り返す場合、バリデーターの重複行検出によりエラーが発生する。
シナリオ番号または操作名を行に含めて各行を一意にすること。
- NG: 「- 判定: 合格」をシナリオ 1・2・3 で繰り返す（3 回以上の同一行でエラー）
- OK: 「- シナリオ 1（subagentTemplate 取得経路確認）の合否判定: 合格、workflow_next レスポンスに subagentTemplate が存在することを確認した」
- OK: 「- シナリオ 2（workflow_status スリム化確認）の合否判定: 合格、レスポンスに subagentTemplate フィールドが含まれないことを確認した」
複数シナリオの合否行は必ずシナリオ番号または操作対象名を含めて一意にすること。

**出力:**
成果物ファイル（manual-test.md 等）に記述する内容を以下に続けて記述する。
各テストシナリオの結果は「シナリオ番号（操作名）の合否判定:」形式で記述すること。
テストシナリオと合否判定はそれぞれ固有の情報を含む文章で記述し、同一文字列の繰り返しを避けること。
```

performance_test と e2e_test の追加セクションも同形式であり、計測対象名（performance_test）またはシナリオ名（e2e_test）を一意化の軸として使用する。
