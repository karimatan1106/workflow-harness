## サマリー

このドキュメントは `workflow-plugin/mcp-server/src/phases/definitions.ts` の `buildPrompt()` 関数内における NG/OK 例の誤記修正に関する、ドキュメント更新フェーズの完了記録である。

修正により、サブエージェントプロンプトにおいて「コードフェンス外の散文・箇条書きへの直接記述が NG」「コードフェンス内への記述が OK（推奨）」という正しい対比が確立された。

修正対象は `definitions.ts` の行 1155〜1160 の6行のみであり、修正後は8行となる（各セクション「OK（代替）」行の追加により行数が増加）。

修正により parallel_verification フェーズの4つのサブエージェント（manual_test, security_scan, performance_test, e2e_test）が受け取るプロンプトが改善され、過去に発生していたバリデーション失敗の根本原因が解消される。

testing フェーズ以降では `npm run build` でのビルド成功と MCP サーバー再起動が必須であり、再起動後にサブエージェントプロンプトの実装が正しく反映されていることを確認することが重要である。

## 変更ファイル記録

### 修正対象ファイル

- **ファイルパス**: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- **変更行**: 行 1155〜1160（6行）→ 行 1155〜1162（8行に置き換え）
- **変更内容**: `buildPrompt()` 関数内の `qualitySection` 生成部分における NG/OK 例の誤記修正

### 修正前のコード（6行）

```
qualitySection += `\n正規表現パターンの記述:\n`;
qualitySection += `- NG: 正規表現で「英小文字1文字以上」を表すパターンをそのままコードブロックに書く\n`;
qualitySection += `- OK: 「英小文字の1文字以上の繰り返しを表す正規表現」のように散文で説明する\n`;
qualitySection += `\n配列アクセスの記述:\n`;
qualitySection += `- NG: 配列のインデックスアクセス記法をコードブロック内に直接記述する\n`;
qualitySection += `- OK: 「配列の先頭要素を取得する」「インデックス番号によるアクセス」のように散文形式で説明する\n`;
```

### 修正後のコード（8行）

```
qualitySection += `\n正規表現パターンの記述:\n`;
qualitySection += `- NG: コードフェンス外の散文や箇条書きに正規表現の文字クラス表記を直接記述すること\n`;
qualitySection += `- OK（推奨）: コードフェンス内に正規表現パターンを記述すること（バリデーターはコードフェンス内の行を検出対象から除外するため安全）\n`;
qualitySection += `- OK（代替）: コードフェンス外では「英小文字の1文字以上の繰り返しを表す正規表現」のように散文形式で説明すること\n`;
qualitySection += `\n配列アクセスの記述:\n`;
qualitySection += `- NG: コードフェンス外の散文や箇条書きに配列のインデックスアクセス記法を直接記述すること\n`;
qualitySection += `- OK（推奨）: コードフェンス内に配列アクセス記法を記述すること（バリデーターはコードフェンス内の行を検出対象から除外するため安全）\n`;
qualitySection += `- OK（代替）: コードフェンス外では「先頭要素を取得する」「インデックス番号によるアクセス」のように散文形式で説明すること\n`;
```

### 修正の効果

修正により `buildPrompt()` が全フェーズ・全サブフェーズのサブエージェントプロンプトに提供する品質要件セクション（`qualitySection`）が正しい指示内容を含むようになり、サブエージェントが「コードフェンス外が NG」「コードフェンス内が OK」という事実と矛盾する誤誘導を受けることがなくなる。

## メンテナンス情報

### ビルド・再起動手順（testing フェーズ以降で実施）

修正を有効化するには、implementation フェーズで実施した以下の4ステップが必須である。

**ステップ1**: `cd workflow-plugin/mcp-server && npm run build` を実行して TypeScript をトランスパイルする。この操作により `dist/phases/definitions.js` に修正内容が反映される。

**ステップ2**: `dist/phases/definitions.js` の更新日時を確認し、修正が反映されていることを検証する。ビルドに失敗した場合は TypeScript コンパイルエラーメッセージを確認して構文を修正する。

**ステップ3**: MCP サーバープロセスを Claude Desktop のサーバー再起動ボタンまたはプロセス終了で再起動する。Node.js のモジュールキャッシュにより、再起動しない限り修正前のコードが動作し続けるため、この手順は省略不可である。

**ステップ4**: 再起動後に `workflow_status` を実行して現在のフェーズを確認し、同フェーズから作業を再開する。

### MCP サーバー再起動ルール（CLAUDE.md Rule 22）

CLAUDE.md の「AIへの厳命」ルール22では、artifact-validator.ts、definitions.ts、state-manager.ts のコアモジュール変更後はMCPサーバーを再起動することが明記されている。

本タスクでの修正は definitions.ts への変更であるため、このルール22 に該当する。必ず上記の4ステップを完遂し、再起動後に次フェーズに進むこと。

再起動を実施しないままでは、修正前の古いコードがメモリキャッシュに保持され続けるため、サブエージェントプロンプトが依然として誤った指示を含むことになり、修正の効果が全く発揮されない。

### definitions.ts の役割と波及範囲

`buildPrompt()` 関数は `resolvePhaseGuide()` の内部から全フェーズ・全サブフェーズのサブエージェントプロンプト生成時に呼び出される。この関数内の `qualitySection` の内容は、以下の全フェーズのサブエージェントに共通して提供される品質要件セクションとなる。

- research, requirements, parallel_analysis（threat_modeling, planning）
- parallel_design（state_machine, flowchart, ui_design）
- design_review, test_design
- test_impl, implementation, refactoring
- parallel_quality（build_check, code_review）
- testing, regression_test
- parallel_verification（manual_test, security_scan, performance_test, e2e_test）
- docs_update, commit, push, ci_verification, deploy

本修正により、これら全フェーズのサブエージェントが正しい角括弧プレースホルダー指示を受け取るようになる。特に parallel_verification フェーズの4つのサブエージェント（manual_test, security_scan, performance_test, e2e_test）は修正前のプロンプトで誤誘導を受けて連続バリデーション失敗を起こしていたため、この修正により大きな品質向上が期待される。

### 検証項目（testing フェーズで実施）

修正の正当性を確認するため、testing フェーズでは以下を実施すること。

`npm run build` がエラーなく完了し、TypeScript コンパイルエラーが発生していないこと。

MCP サーバー再起動後に `workflow_status` を実行して、現在のフェーズ情報が正しく返されることを確認すること（ステートインテグリティチェック）。

既存テストスイート（特に `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts`）が全てパスすることを確認すること。`buildPrompt()` 関数のシグネチャ・戻り値の型は変更されていないため、既存テストへの影響は最小限であるが、ビルド成功後の念のための確認が推奨される。

### ドキュメント参照ポイント

CLAUDE.md の以下の箇所が本修正に関連している。

- 「AIへの厳命」セクション、ルール22「コアモジュール変更後はMCPサーバーを再起動してから次フェーズに進むこと」（行 850〜865）
- 「成果物品質要件」セクションの「角括弧プレースホルダー禁止」説明（行 380〜400）
- 「成果物品質要件」セクションの「安全な代替表現パターン」説明（確定・確認が取れていない状態や追加調査が必要な状態の記述方法）

修正後の definitions.ts が生成するプロンプトにおいて、これら CLAUDE.md の要件が正しくサブエージェントに伝達されるようになる。

### 今後のメンテナンス

definitions.ts の `buildPrompt()` 関数の `qualitySection` 部分は、CLAUDE.md の品質要件セクションと常に整合していることが求められる。CLAUDE.md の品質要件が将来変更されたり新たな禁止語が追加された場合は、対応する `qualitySection` の内容も同期更新すること。

修正が buildRetryPrompt のテンプレートセクションにも影響するか確認すること。buildRetryPrompt ではリトライ時の改善指示を提示するため、同じく角括弧に関する警告が含まれる。行 1200〜1250 付近で同様の品質要件セクションが定義されている場合は、そちらも整合性確認を行うこと。
