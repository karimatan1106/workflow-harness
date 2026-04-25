## サマリー

- 目的: FR-R4AおよびFR-R4Bの変更がセキュリティに与える影響を検証する
- 主要な決定事項: FR-R4Bでのverif icationPhasesへの'parallel_verification'追加はtestingカテゴリのみを付与するため、implementationカテゴリのコマンド（npm install、mkdir等）は引き続き非許可となり権限昇格は発生しない
- 変更範囲の評価: bash-whitelist.jsの221行目（FR-R4B）とdefinitions.tsのperformance_testテンプレート（FR-R4A）という限定的な2箇所の変更であり、HMAC署名ロジックや環境変数保護機構には直接の影響がない
- 検出された重大問題: なし（低リスクの指摘事項が1件）
- 次フェーズで必要な情報: セキュリティ上の問題なし、通常のワークフロー継続を推奨する

## 脆弱性スキャン結果

### FR-R4B: bash-whitelist.jsのverificationPhases配列変更

変更内容は221行目の配列リテラルに`'parallel_verification'`という文字列を追加したものである。この変更がコマンドインジェクションの攻撃面を拡大する可能性を検証した。

フェーズ判定ロジックを確認すると、getWhitelistForPhase関数は`verificationPhases.includes(phase)`という静的な配列メンバーシップ検証を行っている。`phase`パラメータはMCPサーバーの状態ファイルから読み込まれ、HMAC整合性で保護されている。攻撃者がphaseを偽造するにはHMAC秘密鍵の取得が前提となり、これは独立した保護層によって防がれる。

parallel_verificationフェーズで許可される追加カテゴリはtestingのみである（232行目: `[...BASH_WHITELIST.readonly, ...BASH_WHITELIST.testing, 'gh']`）。testingカテゴリのコマンド一覧はnpm test、npm run test、npx vitest、npx jest、npx mocha等のテストランナーに限定されており、ファイル書き込みや特権昇格につながるコマンドは含まれない。

ブラックリスト（BASH_BLACKLIST）は全フェーズで共通適用されるため、parallel_verificationフェーズの追加後も`bash -c`、`sh -c`、リダイレクト操作、`rm -rf`等の危険パターンは引き続きブロックされる。

以前から存在していたsecurity_scan、performance_test、e2e_testの3フェーズはすでにverificationPhasesに含まれており、同一の許可セットを取得していた。今回追加されたparallel_verificationはこれら3フェーズの親フェーズであり、同等の権限レベルを与えることは設計上の一貫性を持つ。

**FR-R4B脆弱性スキャン結論: 問題なし**

変更前後でBASH_WHITELISTの内容（readonly + testing + 'gh'）は変化しておらず、新たな攻撃面の追加は確認されない。

### FR-R4A: definitions.tsのperformance_testテンプレート変更

変更内容はperformance_test.subagentTemplateの文字列にガイダンスブロックを追記したものである。このテンプレートはサブエージェントへのプロンプト生成に使用される静的なテキストであり、実行時に動的評価される箇所は存在しない。

テンプレートインジェクションの観点から確認した。テンプレート文字列は`${userIntent}`と`${docsDir}`という2つのプレースホルダーを含む。これらは`definitions.ts`の呼び出し元（getSubagentSettings関数等）でJavaScriptの文字列置換により展開される。追加されたガイダンスブロックはプレースホルダーを含まない純粋な日本語テキストであり、ユーザー入力を含む変数を新たに追加していない。

`userIntent`はMCPサーバーが受け取るタスク名・意図情報であり、外部入力に該当する。しかし生成されたプロンプトはClaude APIに送信されるテキストであり、Node.jsの`eval()`やOSコマンド実行には直接渡されない。テンプレートインジェクションがAIプロンプトインジェクションとして悪用されるシナリオは、ワークフローのアクセス制御（HMAC認証、フェーズ制約）によって別途緩和されている。

追加された2つのガイダンスブロック（サマリーセクションガイダンスおよびパフォーマンス計測結果セクションガイダンス）はそれぞれ具体的な記述例を含む文字列であり、コードブロック（バックティック3連）を使用していないため、コードフェンスエスケープの問題も発生しない。

**FR-R4Aテンプレート安全性スキャン結論: 問題なし**

### HMAC整合性への影響確認

definitions.tsはworkflow-state.jsonのHMAC署名計算には参加していない。署名はstate-manager.ts（manager.ts）がJSON.stringifyした状態オブジェクトに対してhmac.tsのsignWithCurrentKey()を呼び出すことで生成される。definitions.tsの変更はフェーズ定義メタデータ（テンプレート文字列、許可カテゴリ等）であり、状態データそのものではない。したがって今回の変更後もHMAC検証は正常に機能する。

bash-whitelist.jsはMCPサーバーのdefinitions.tsからcreateRequireを介して読み込まれるが、こちらもHMAC署名の対象データには含まれない。フック（phase-edit-guard.js）はrequire()でbash-whitelist.jsを直接参照しており、変更内容はNode.jsのモジュールキャッシュにより実行中プロセスに即時反映はされないが、次回MCP起動後に確実に有効化される。

### 環境変数保護の確認

SECURITY_ENV_VARSの定義（bash-whitelist.js 11〜15行目）を確認した。対象変数はHMAC_STRICT、SCOPE_STRICT、SESSION_TOKEN_REQUIRED、HMAC_AUTO_RECOVER、SKIP_WORKFLOW、SKIP_LOOP_DETECTOR、VALIDATE_DESIGN_STRICT、SPEC_FIRST_TTL_MSの8変数である。FR-R4BもFR-R4AもSECURITY_ENV_VARSの内容を変更していない。sanitizeZeroWidthChars関数も変更されておらず、ゼロ幅Unicode文字によるコマンド偽装対策は維持されている。

## 検出された問題

### 低リスク: parallel_verificationフェーズへのgh許可の副作用

深刻度: 低

FR-R4Bにより`parallel_verification`フェーズで`gh`コマンド（GitHub CLI）が使用可能になった。`gh`コマンドはremoteリポジトリへのデータ取得・プルリクエスト作成等が可能であり、検証フェーズ（manual_test、security_scan等）での使用は本来想定されていない。

ただし、`gh`はverificationPhasesに属する`security_scan`、`performance_test`、`e2e_test`フェーズでも以前から許可されており（231〜232行目）、今回の追加は既存の設計方針の延長である。BASH_BLACKLISTによるリダイレクト・危険コマンド禁止は`gh`コマンドのパイプ操作にも適用される。現時点での悪用シナリオは理論的に限定的であり、即時対応は不要と判断する。

**推奨事項**: 将来の改善として、verificationPhasesに'gh'を許可する方針の意図をコードコメントで明示することを検討されたい。security_scanフェーズでの`gh security advisory list`のような利用が想定されている場合、その旨をbash-whitelist.jsのコメントに記載すると可読性が向上する。

### 指摘なし: コマンドインジェクション

verificationPhasesはハードコードされた文字列リテラル配列であり、外部入力によって動的に変更されない。追加された`'parallel_verification'`という文字列値はワークフロー内部のフェーズ名として定義済みであり、未知のフェーズ名を追加したものではない。コマンドインジェクションリスクは確認されない。

### 指摘なし: 権限昇格

parallel_verificationフェーズはtestingカテゴリのコマンドのみを追加取得する。implementationカテゴリ（npm install、mkdir等）はparallel_verificationフェーズには付与されない。testing_phasesとverification_phasesは同等のコマンドセットを許可しており、parallel_verificationフェーズに対するtesting追加は他の検証フェーズとの一貫性を確保するものであり、権限昇格には該当しない。

### 指摘なし: テンプレートインジェクション

FR-R4Aで追加されたガイダンステキストはプレースホルダーを含まない固定文字列である。JavaScriptのテンプレートリテラル展開やeval()等の動的実行への経路は存在しない。AIプロンプトとして送信される際も、追加テキストは品質向上のためのガイダンスであり、セキュリティ機能（HMAC、フェーズ制約）をバイパスする内容は含まれない。

## セキュリティスキャン総評

変更範囲の評価: bash-whitelist.jsの221行目とdefinitions.tsのperformance_testテンプレートという2箇所の限定的な変更であり、スキャン対象の攻撃面は狭い。
コマンドインジェクション観点の結論: verificationPhasesはハードコードされた配列であり外部入力による動的変更がないため、コマンドインジェクションリスクは存在しない。
権限昇格観点の結論: parallel_verificationフェーズへの追加カテゴリはtestingのみであり、implementationカテゴリは付与されないため、権限昇格は発生しない。
テンプレートインジェクション観点の結論: FR-R4Aで追加されたガイダンス文字列はプレースホルダーを含まない固定テキストであり、動的実行への経路が存在しないためリスクなしと判定する。
HMAC整合性への影響の結論: definitions.tsおよびbash-whitelist.jsはHMAC署名の対象データではなく、state-manager.tsの署名ロジックに影響しないため整合性は維持される。
総合判定: 重大および中程度のセキュリティ問題は検出されなかった。低リスク指摘1件（gh許可の方針コメント化を推奨）は即時対応不要であり、セキュリティ観点から今回の変更の承認を推奨する。
