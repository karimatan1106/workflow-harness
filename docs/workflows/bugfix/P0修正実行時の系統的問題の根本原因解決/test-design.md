## サマリー

本ドキュメントはP0修正実行時の系統的問題（FR-1〜FR-4）の根本原因解決に向けたテスト設計を定める。
修正対象のArtifactQualityCore（artifact-validator.ts）・record-test-result.ts・definitions.ts・next.tsと設定文書2件（CLAUDE.md・workflow-plugin/CLAUDE.md）について、各修正の動作を検証するテストケースを網羅的に定義する。
根本原因はバリデーターのコードフェンス非除外・モデルエスカレーション機構欠如・複合語誤検出・ベースライン未記録の技術的強制欠如の4点であり、それぞれFR-1〜FR-4のテストケースで検証する。

- 目的: FR-1〜FR-4の修正が正しく動作することを検証し、既存820件のリグレッションテストスイートへの影響が発生しないことを確認する
- 主要な決定事項: extractNonCodeLines・BuildRetryResult・isCompoundWordContext・forceTransitionを中心とする新規テストを各テストファイルに追加する
- 次フェーズで必要な情報: test_implフェーズではコードフェンス外行抽出・エスカレーション条件・複合語判定・ベースライン存在チェックのテストコードを実装すること

---

## テスト方針

### 修正の概要・背景・根本原因の整理

P0修正実行時に発生した4つの系統的問題は、ワークフローのOrchestratorが各フェーズのsubagentへリトライプロンプトを送信する際に顕在化した。
根本原因調査の結果、ArtifactQualityCore（バリデーター本体）がコードブロック内の禁止パターンと角括弧プレースホルダーエラーをコードフェンス外と同様に全文字列検索（content.includes・content.match）していた非対称な状態が確認された。
重複行検出がInsideCodeFenceフラグによりコードブロック内行を非除外対象として除外しているのに対し、禁止パターン検出と角括弧プレースホルダーエラー検出にはコードフェンス非除外の状態が継続していた。
現状の問題点はコードフェンス内外の区別が不明確であり、円滑な進行を阻害している状況を特定した結果、不当な検出の基準を明確にすることが本修正の出発点となる。

FR-2のモデルエスカレーション機構欠如の問題では、haikuモデルによるリトライループが繰り返し失敗してもOrchestratorが同一モデルで再試行を継続するという構造が根本原因であった。
buildRetryPrompt関数がBuildRetryResult型のオブジェクトでsuggestModelEscalationフィールドを返すことでOrchestratorへの通知経路を確立し、リトライテンプレートにエスカレーション手順を明記することでfail-safe（フェールセーフ）な動作を実現する。
fail-closed（フェールクローズド）ではなくfail-safe設計を採用することで、suggestModelEscalationが未設定の場合も既存の呼び出し元コードが動作し続ける後方互換動作を確保する。

FR-3の複合語誤検出問題の根本原因は、BLOCKING_FAILURE_KEYWORDSが単語境界アサーション（`\b`）なしにスペース区切り複合語に部分マッチしていた点にある。
isCompoundWordContextとisHyphenatedWordの両検出機構を対称的に適用することで検出改善と精度向上を実現し、スペース区切り複合語の誤拒否を排除する。
大文字小文字不問マッチを維持しながら単語境界強化により結合語の誤検出を防ぐ戦略を採用することで、動的な判断が自動的に行われるよう設計する。
record-test-result.tsのhashValidationポリシーの非対称性（testingとregression_testで同一出力判定が異なる）も根本原因の一つであり、currentPhase条件分岐による修正後は同一SHA256ハッシュ（TestOutputHash）の修正前後比較が両方記録可能になる。
重複拒否ポリシーの緩和と再記録拒否ポリシーの非対称化により、回復フローが確立され既存内容を削除せず追記のみで対応できる設計となる。

FR-4の根本原因はCLAUDE.mdのルール20（ベースライン記録義務化）が文書上の義務化のみで、workflowNext関数（next.ts）に技術的強制欠如の状態が続いていた点にある。
testing→regression_test遷移前にtaskState.testBaselineの存在チェックを追加し、ベースライン未設定状態でのregression_testへの遷移阻止（警告付き確認方式）を実現する。

### テスト方針の全体像：本修正の修正範囲と実装対象

本修正の修正範囲は実装対象である中核のバリデーター関数・record-test-result.ts・definitions.ts・next.tsに限定し、成果物のトレーサビリティを確保することを方針とする。
本仕様書では全変更の変更種別を既存処理変更・型定義変更・値変更・引数追加・処理追加に分類して管理する。
テストの内訳は単体テストと統合テストに分割し、検証手順は処理設計の制約に留意しつつ最小限の変更で保護を確保する戦略を採用する。

本修正では共通関数抽出によりextractNonCodeLines()という新規追加関数を導入し、StructuralLine判定とschema準拠の値型定義を対称化する。
共通関数名はextractNonCodeLinesとし、行配列を返す純粋関数として設計することで、既存の重複行検出ロジックとの対称性を回復させる。
新規追加関数が既存の内外区別不能な状態を解消し、コードブロック内行を走査対象から除外する仕組みを統一する。

### 実装計画とテストの対応

各FRの実装計画で定義された新規関数・型定義・変更箇所に対応するテストケースを以下の通り配置する。

| 修正ファイル | テストファイルパス | FR番号 |
|------------|-----------------|--------|
| artifact-validator.ts | workflow-plugin/mcp-server/src/validation/__tests__/artifact-validator.test.ts | FR-1 |
| record-test-result.ts | workflow-plugin/mcp-server/src/tools/__tests__/record-test-result.test.ts | FR-3 |
| definitions.ts | workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts | FR-2, FR-4 |
| next.ts | workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts | FR-4 |

### 非機能要件（NFR）テストの方針

NFR-1（既存820件の全パス維持）は `npm test` をworkflow-plugin/mcp-server/ディレクトリで実行し、リグレッションテストスイート全件のパスを確認する。
NFR-2（パフォーマンス劣化10%以内）はextractNonCodeLines関数を1000行のMarkdownコンテンツに対して複数回実行するパフォーマンステストで処理時間増加を計測する。
NFR-3（後方互換動作）はBuildRetryResultのsuggestModelEscalationフィールドが未設定の場合に既存の呼び出し元コードが正常動作するアサーションで確認する。

---

## 変更影響分析

本セクションでは全変更の変更種別・変更方法・追加箇所・変更理由・影響範囲を体系的に整理し、追記箇所と判定条件を明記する。

### ファイル別変更種別の一覧

**artifact-validator.ts（FR-1）**
変更種別は既存処理変更（283行目・288行目）と新規追加関数（extractNonCodeLines）の2種類に分類される。
変更方法は、283行目の禁止パターン検出をcontent.includesからextractNonCodeLines結合文字列の検索に変更し、288行目の角括弧検出をcontent.matchからextractNonCodeLines結合文字列への正規表現マッチに変更する。
変更理由はコードブロック内外の区別欠如という根本原因への対処であり、影響範囲は禁止パターン検出と角括弧プレースホルダー検出の2処理に限定される。
追加箇所は新設するextractNonCodeLines関数の配置位置（283行目より上部の共通関数領域）であり、行番号を参照したテストコードで追記箇所を特定できる。

**record-test-result.ts（FR-3）**
変更種別は関数変更（isCompoundWordContext追加）と値型変更（hashValidationポリシーのフェーズ条件分岐）の2種類に分類される。
変更方法は、isCompoundWordContextをisHyphenatedWordと並列に配置し、validateTestOutputConsistency内の呼び出し箇所に両検出適用を記録指示追加する形で実装する。
変更理由は複合語誤検出と同一ハッシュ再記録拒否という2つの独立した問題への対処であり、影響範囲はBLOCKING_FAILURE_KEYWORDS検出処理とhashValidation処理に限定される。

**definitions.ts（FR-2）**
変更種別は型定義変更（BuildRetryResult型の新設）と返り値設計の変更（suggestModelEscalation追加）の2種類に分類される。
変更方法はbuildRetryPrompt関数の返り値をstring型からBuildRetryResult型に変更するが、引数追加は発生しない。
変更理由はOrchestratorへのモデルエスカレーション通知経路欠如への対処であり、影響範囲はbuildRetryPrompt関数の返却値設計に限定され、buildPrompt（通常フェーズ）は変更不要である。

**next.ts（FR-4）**
変更種別は引数追加（forceTransition?: boolean）と処理追加（ベースライン存在チェック）の2種類に分類される。
変更方法はworkflowNext関数の234行目付近に存在チェック処理を追記し、引数追加はオプショナルで既存の呼び出し元への影響を最小限にとどめる。
変更理由は技術的強制手段の欠如への対処であり、影響範囲はtesting→regression_test遷移処理のみに限定される。

### 判定条件の明記

各変更種別に対応する判定条件を明記し、テスト実行時の合否基準として使用する。
既存処理変更の判定条件は「修正前の動作と修正後の動作がコードフェンス外については同一であること」とし、コードフェンス内の行のみが除外対象となる。
型定義変更の判定条件は「オプショナルフィールドが未設定でも既存呼び出し元がTypeScriptコンパイルエラーなく動作すること」とし、後方互換性を保護する。
値型追加等の最小限変更の判定条件は「追加したフィールドの型がschema定義に準拠し、変更不要な既存フィールドの値が変化しないこと」とし、不当な挙動変化を排除確認する。

---

## FR-1テストケース: extractNonCodeLines関数とコードフェンス除外ロジック

### FR-1のテストグループ概要

FR-1の根本原因は、ArtifactQualityCore内の禁止パターン検出（283行目付近のPlaceholderPattern検出）と角括弧プレースホルダーエラー検出（288行目付近）がInsideCodeFenceフラグを持たず全文字列に適用されていた点にある。
extractNonCodeLines関数は、バックティック3個以上またはチルダフェンス（チルダ3個以上）で囲まれたコードフェンス内の行を除外したstring配列を返す純粋関数として実装される。
重複行検出（311行目付近）の既存実装は変更対象外であり、このグループのテストケースでは既存の重複行検出の動作が変化しないことも確認する。
本修正では行単位の走査で対象行の行番号を特定し、行配列から不当な検出を排除することで検出改善と精度向上を検証する。
ネストしたコードフェンスのリスクを緩和し、ハイフン結合語をクリアに判断する回避手段を提供することも本テストグループの確認範囲に含める。

テストファイルパス: `workflow-plugin/mcp-server/src/validation/__tests__/artifact-validator.test.ts`

### TC-FR1-001: バックティックコードフェンス内の行がstring配列から除外されること

**前提条件**: extractNonCodeLines関数がartifact-validator.tsからエクスポートされており、コードフェンス追跡のisInsideCodeFenceフラグ管理が実装されている状態。行単位の走査でisInsideCodeFenceが各行の判定条件として機能する設計となっている。
**入力**: バックティック3個で開始・終了するコードブロックを含むMarkdown文字列（"テキスト行\n\`\`\`\nconst x = 1;\n\`\`\`\n後続テキスト"）。
**テスト手順**: extractNonCodeLines関数に当該文字列を渡し、返却されたstring配列の内容を確認する。行番号を参照して除外対象行が正確に特定されていることも確認する。
**期待結果**: 返却配列に "テキスト行" と "後続テキスト" が含まれ、"const x = 1;" はコードフェンス内行として除外されていること。行配列の要素数が2であることを確認し、追加内容が混入していないことを検証する。
**根拠**: spec.mdにて「コードフェンス内にある行は全て返却配列から除外する」と明記されており、InsideCodeFence状態にある行の除外が機能している必要がある。

### TC-FR1-002: チルダフェンス（チルダ3個以上）内の行がstring配列から除外されること

**前提条件**: extractNonCodeLines関数がチルダフェンスをコードフェンスとして認識する実装が完了しており、isInsideCodeFenceフラグがチルダ開始行でも反転する状態。
**入力**: チルダ3個（`~~~`）で開始・終了するコードブロックを含むMarkdown文字列（"前置テキスト\n~~~\nconst y = 2;\n~~~\n末尾テキスト"）。
**テスト手順**: extractNonCodeLines関数に当該文字列を渡し、返却されたstring配列を確認する。
**期待結果**: 返却配列に "前置テキスト" と "末尾テキスト" が含まれ、チルダフェンス内の "const y = 2;" は除外されていること。
**根拠**: spec.md FR-1節「チルダ3個以上（`~~~`）もコードフェンスとして認識する」という設計方針に基づく。

### TC-FR1-003: コードフェンス開始行・終了行自体がstring配列から除外されること

**前提条件**: extractNonCodeLines関数の動作仕様として、フェンス状態フラグを反転させるコードフェンス開始行と終了行も返却配列に含めない実装が完了している状態。
**入力**: バックティック3個で始まる開始行（`\`\`\`typescript`）を含むMarkdown文字列（"説明文\n\`\`\`typescript\ncode\n\`\`\`"）。
**テスト手順**: extractNonCodeLines関数に当該文字列を渡し、返却されたstring配列に "\`\`\`typescript" および "\`\`\`" が含まれないことを確認する。
**期待結果**: 開始行と終了行はフェンス状態フラグを反転させるだけであり、返却配列から除外されていること。
**根拠**: spec.md FR-1節「コードフェンス開始行（バックティックまたはチルダで始まる行）はフェンス状態フラグを反転させ、その行自体は返却配列に含めない」。

### TC-FR1-004: コードブロック内の禁止パターンがバリデーションエラーにならないこと

**前提条件**: artifact-validator.tsの禁止パターン検出処理がextractNonCodeLines関数の結果を結合した文字列に対して実施される実装が完了している状態（283行目変更後）。
**入力**: コードブロック内にのみ "WIP: このコード" を含み、コードフェンス外には禁止語を含まないMarkdownコンテンツ。
**テスト手順**: validateArtifactQuality関数（またはcheckForbiddenPatterns関数相当）に当該コンテンツを渡し、返却されたエラー配列を確認する。
**期待結果**: コードフェンス内の禁止語は検索範囲の限定により対象外となり、バリデーションエラーが返却されないこと。今回の修正方法の効果として、自動的に検出対象から除外される挙動が確認できる。
**根拠**: spec.md FR-1節「変更後: extractNonCodeLines(content).join('\n').includes(pattern) 相当の処理」に基づき、コードブロック内行は禁止パターン検索の対象外となる。

### TC-FR1-005: コードフェンス外に存在する禁止パターンは引き続き検出されること

**前提条件**: FR-1修正後のartifact-validator.tsがロードされており、検索範囲の限定によりコードフェンス外行のみが検索対象となっている状態。
**入力**: コードフェンス外の行に "TBD: 後で実装する" という禁止パターンを含み、コードフェンスブロックも別途存在するMarkdownコンテンツ。
**テスト手順**: validateArtifactQuality関数を実行し、禁止パターン検出エラーが返却されることを確認する。
**期待結果**: コードフェンス外の禁止パターンはForbiddenPatternCheckで正確に検出され、エラーが返却されること。現状の問題点修正後も、コードフェンス外の禁止語検出という中核機能が維持される。
**根拠**: extractNonCodeLines関数は「コードフェンス外の行はそのまま返却配列に追加する」（spec.md）ため、コードフェンス外の禁止パターン検出の正確さは変化しない。

### TC-FR1-006: チルダフェンス内の角括弧プレースホルダーが誤拒否されないこと

**前提条件**: artifact-validator.tsの角括弧プレースホルダーエラー検出処理が288行目付近でextractNonCodeLines適用後の正規表現マッチに変更されている状態。
**入力**: チルダ3個で囲まれたコードブロック内に配列アクセス記法や変数名のプレースホルダー形式を含むMarkdownコンテンツ（コードフェンス外には角括弧プレースホルダーを含まない）。
**テスト手順**: validateArtifactQuality関数を実行し、角括弧プレースホルダーエラーが返却されないことを確認する。
**期待結果**: チルダフェンス内の行はInsideCodeFence状態として除外され、角括弧プレースホルダーエラーが発生しないこと。
**根拠**: spec.md FR-1節「288行目付近の角括弧プレースホルダー検出処理を変更する」「コードブロック内の変数名を誤検出する問題を解決する」。

### TC-FR1-007: 複数コードブロックが正しく追跡され非コード行のみが返却されること

**前提条件**: extractNonCodeLines関数がO(n)の1パス処理として実装されており、複数のコードフェンスブロックをisInsideCodeFenceフラグで追跡できる状態。
**入力**: 独立したコードフェンスブロックが2箇所あり、その前・中間・後にコードフェンス外の通常テキスト行が含まれるMarkdownコンテンツ。
**テスト手順**: extractNonCodeLines関数を直接呼び出し、返却されたstring配列の内容を検証する。コードフェンス内の行が配列に含まれないことを確認する。
**期待結果**: コードフェンス外の行（3箇所のテキスト）のみがstring配列に返却され、コードフェンス開始行・内部行・終了行は全て除外されること。
**根拠**: spec.md FR-1節「処理は1パス（O(n)）で完結し、入れ子コードフェンスは考慮しない（標準Markdownの仕様に従い最初にマッチしたフェンスで開閉を管理する）」。

### TC-FR1-008: 既存の重複行検出ロジック（InsideCodeFence追跡）が変化しないこと（リグレッション確認）

**前提条件**: artifact-validator.tsの311行目付近の重複行検出処理は変更対象外であり、既存のInsideCodeFenceフラグ管理ロジックがそのまま維持されている状態。
**入力**: コードフェンス内に同一行が3回以上出現し、コードフェンス外には重複行が存在しないMarkdownコンテンツ。
**テスト手順**: validateArtifactQuality関数を実行し、重複行検出エラーが返却されないことを確認する。
**期待結果**: コードフェンス内の行は重複行検出の対象外であり、エラーが発生しないこと。FR-1変更前後で同一の結果を返すリグレッションとして機能する。
**根拠**: spec.md FR-1節「重複行検出処理（311行目付近）は変更しない。既存のinsideCodeFenceフラグ管理ロジックはそのまま維持する」。

---

## FR-2テストケース: BuildRetryResultとモデルエスカレーション機構

### FR-2のテストグループ概要

FR-2の根本原因は、buildRetryPrompt関数（definitions.ts 1199行目付近）がモデルエスカレーション情報を返却せず、Orchestratorのリトライループがhaikuモデルのまま継続する構造的欠陥にあった。
修正後はBuildRetryResult型にオプショナルフィールド `suggestModelEscalation?: boolean` が追加され、retryCount（リトライ回数）とエラー種別・件数に基づいてエスカレーション判定が行われる。
フェーズプロンプトへの影響はbuildRetryPrompt関数のみに限定され、通常フェーズプロンプトの生成ロジック（buildPrompt関数）は変更しない。
complete-sub呼び出し元とworkflow_next呼び出し元の双方がBuildRetryResult型を安全に利用できるメタデータ設計となっており、本グループではその動作を検証する。

テストファイルパス: `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts`

### TC-FR2-001: retryCount=1の初回リトライではsuggestModelEscalationがfalseであること

**前提条件**: buildRetryPrompt関数がBuildRetryResult型のオブジェクトを返却する実装が完了しており、retryCount<2の条件では常にsuggestModelEscalation=falseが設定される状態。
**入力**: retryCount=1、errors配列に禁止パターン検出エラーを3件含むパラメータ（複数エラー同時発生であっても初回は対象外）。
**テスト手順**: buildRetryPrompt関数を呼び出し、返却されたBuildRetryResultのsuggestModelEscalationフィールドを確認する。
**期待結果**: suggestModelEscalationがfalse（またはundefined）であること。過剰エスカレーションを防ぐためretryCount<2ではエスカレーションしない。
**根拠**: spec.md FR-2節「1回目のリトライでは常に `suggestModelEscalation: false` を返し、過剰エスカレーションを防ぐ」。

### TC-FR2-002: retryCount=2かつerrors.length=3（境界値）でsuggestModelEscalationがtrueであること

**前提条件**: BuildRetryResult型の定義と、retryCount>=2かつerrors.length>=3の条件分岐ロジックが実装されている状態。
**入力**: retryCount=2、errors配列にセクション密度不足・禁止パターン検出・重複行検出の各エラーを含む3件（複数エラー同時発生の最小閾値）。
**テスト手順**: buildRetryPrompt関数を呼び出し、返却されたBuildRetryResultのsuggestModelEscalationフィールドを確認する。
**期待結果**: suggestModelEscalationがtrueであること。errors.length=3が「複数の違反が同時に発生（errors.length >= 3）」の境界値として機能していることを確認する。
**根拠**: spec.md FR-2節「エラー種別が複数の違反が同時に発生（errors.length >= 3）に該当する場合に `suggestModelEscalation: true` を設定する」。

### TC-FR2-003: retryCount=3かつ角括弧検出エラーのみでもsuggestModelEscalationがtrueであること

**前提条件**: buildRetryPrompt関数内のエラー種別判定ロジックが角括弧検出エラーをエスカレーション対象として認識している状態。
**入力**: retryCount=3、errors配列に角括弧プレースホルダーエラー1件のみを含むパラメータ（エラー件数は3件未満）。
**テスト手順**: buildRetryPrompt関数を呼び出し、返却されたBuildRetryResultのsuggestModelEscalationフィールドを確認する。
**期待結果**: suggestModelEscalationがtrueであること。角括弧検出エラーはエラー件数に関わらずhaikuでの修正困難なケースとしてエスカレーション対象となる。
**根拠**: spec.md FR-2節「エラー種別が角括弧検出エラーに該当する場合に `suggestModelEscalation: true` を設定する」。

### TC-FR2-004: retryCount=2かつ禁止パターン単独エラー（errors.length=1）でsuggestModelEscalationがtrueであること

**前提条件**: buildRetryPrompt関数が禁止パターン検出エラーを単独でもエスカレーション対象として判定する実装が完了している状態。
**入力**: retryCount=2、errors配列に禁止パターン検出エラー1件のみを含むパラメータ。
**テスト手順**: buildRetryPrompt関数を呼び出し、返却されたBuildRetryResultのsuggestModelEscalationフィールドを確認する。
**期待結果**: suggestModelEscalationがtrueであること。禁止パターン検出エラーはリトライ2回目以降に即エスカレーション対象として機能する。
**根拠**: spec.md FR-2節「エラー種別が禁止パターン検出エラーに該当する場合に `suggestModelEscalation: true` を設定する」。

### TC-FR2-005: retryCount=2かつその他エラー（errors.length=1）ではsuggestModelEscalationがfalseであること

**前提条件**: buildRetryPrompt関数のエラー種別判定がセクション密度不足等の「その他」エラーを非エスカレーション対象として処理する実装が完了している状態。
**入力**: retryCount=2、errors配列にセクション密度不足エラー1件のみを含むパラメータ（角括弧・禁止パターン・複数エラー同時の条件を満たさない）。
**テスト手順**: buildRetryPrompt関数を呼び出し、返却されたBuildRetryResultのsuggestModelEscalationフィールドを確認する。
**期待結果**: suggestModelEscalationがfalseであること。エスカレーション条件を満たさないその他エラーは過剰エスカレーションの対象外となる。
**根拠**: spec.md FR-2節「過剰エスカレーションを防ぐ」という設計方針に基づき、エスカレーション条件は限定的に定義されている。

### TC-FR2-006: suggestModelEscalationフィールドが未設定でも既存呼び出し元が正常動作すること（NFR-3後方互換）

**前提条件**: suggestModelEscalationフィールドはオプショナル定義（`suggestModelEscalation?: boolean`）であり、既存の呼び出し元コードはこのフィールドを参照しない実装。
**入力**: suggestModelEscalationフィールドを含まない旧形式のBuildRetryResult（文字列型または旧オブジェクト型）。
**テスト手順**: 旧形式の返り値を受け取る既存の呼び出し元コードを実行し、エラーなく動作することを確認する。
**期待結果**: suggestModelEscalationが未定義でも既存処理が継続し、fail-safe（フェールセーフ）な後方互換動作が維持されること。
**根拠**: spec.md NFR-3「後方互換性の維持」およびFR-2節「呼び出し元がモデルエスカレーション情報を利用しない場合でも既存動作は変わらない設計とし、fail-closedではなくfail-safeな後方互換動作を採用する」。

### TC-FR2-007: buildRetryPromptが返すBuildRetryResultオブジェクトにprompt文字列が含まれること

**前提条件**: buildRetryPrompt関数がBuildRetryResult型のオブジェクトを返却しており、既存のprompt文字列フィールドが維持されている状態。
**入力**: retryCount=1、エラー1件を含む標準的なパラメータ。
**テスト手順**: buildRetryPrompt関数を呼び出し、返却値にpromptフィールド（文字列型）が存在することを確認する。
**期待結果**: 返却値に空でないprompt文字列フィールドが存在すること。BuildRetryResult型への変更後もOrchestratorがpromptを取得できることを確認する。
**根拠**: spec.md FR-2節「buildRetryPrompt関数の返り値にモデルエスカレーション情報を追加する」という変更方針に基づき、既存のprompt文字列は維持される。

### TC-FR2-008: buildRetryPromptのフェーズプロンプト生成ロジックへの非波及を確認すること

**前提条件**: definitions.ts内のbuildPrompt関数（通常フェーズプロンプト生成担当）がFR-2の変更範囲外であることが実装で保証されている状態。
**入力**: researchフェーズのbuildPrompt呼び出しパラメータ（通常フェーズプロンプト生成）。
**テスト手順**: buildPrompt関数をresearchフェーズで呼び出し、返却値にsuggestModelEscalationフィールドが含まれないことを確認する。
**期待結果**: 通常フェーズプロンプト（buildPrompt）の返却値は変更されず、BuildRetryResult型への変更がフェーズプロンプト全体に波及していないことを確認する。
**根拠**: spec.md FR-2節「FR-2の変更はbuildRetryPrompt関数のみに限定し、通常フェーズプロンプトの生成ロジックは変更しない」。

---

## FR-3テストケース: isCompoundWordContextとハッシュ重複ポリシー

### FR-3のテストグループ概要

FR-3の根本原因は2点である。1点目はBLOCKING_FAILURE_KEYWORDSが単語境界アサーション（`\b`）なしにスペース区切り複合語に部分マッチする問題であり、"Fail Closed"・"Fail Safe"等のフェールセーフ・フェールクローズド関連用語が誤検出されていた。
2点目はrecord-test-result.tsのhashValidationポリシーがtestingとregression_testフェーズで非対称な動作（同一SHA256ハッシュを常に拒否）を採用していた点で、修正前後の変更後比較をregression_testフェーズで記録できなかった。
isCompoundWordContext関数とisHyphenatedWord関数の両検出機構が論理的に独立した修正として並列適用されることをテストで確認する。
動的なコンテキスト判断を自動的に行う仕組みを再利用可能な形で導入し、単語境界強化・大文字小文字不問マッチ・結合語誤検出防止の効果を排除確認することを本グループの目標とする。

テストファイルパス: `workflow-plugin/mcp-server/src/tools/__tests__/record-test-result.test.ts`

### TC-FR3-001: "Fail Closed"を含む出力でexitCode=0の記録が成功すること

**前提条件**: isCompoundWordContext関数が追加され、validateTestOutputConsistency関数内でisHyphenatedWordチェックと並行してisCompoundWordContextチェックが適用されている状態。
**入力**: exitCode=0、output="Fail Closed tests: 5 passed, 0 failed. Suite completed." という形式のテスト記録リクエスト。
**テスト手順**: workflow_record_test_resultツール（またはrecordTestResult関数）を呼び出し、返却値にエラーが含まれないことを確認する。
**期待結果**: isCompoundWordContext関数が "Fail" の直後に "Closed"（大文字始まり語）を検出して複合語コンテキストと判定し、BLOCKING_FAILURE_KEYWORDSによる誤拒否が排除されること。
**根拠**: spec.md FR-3節「具体的には "Fail Closed"、"Fail Safe"、"Fail Open" のようなパターンを検出対象とし、マッチしたキーワードが固有名詞や専門用語の一部である可能性を追跡する」。

### TC-FR3-002: "Fail Safe"を含む出力で記録が成功すること（フェールセーフ関連用語の誤拒否確認）

**前提条件**: isCompoundWordContext関数が "Fail Safe" パターンを複合語として正確に認識する実装が完了している状態。
**入力**: exitCode=0、output="Fail Safe design implemented: all boundary conditions handled correctly." という形式のテスト記録リクエスト。
**テスト手順**: workflow_record_test_resultツールを呼び出し、返却値にエラーが含まれないことを確認する。
**期待結果**: isCompoundWordContext関数が "Fail" の直後に "Safe"（大文字始まり語）を検出して複合語コンテキストと判定し、記録が成功すること。
**根拠**: spec.md FR-3節「"Fail Closed"、"Fail Safe"、"Fail Open" のようなパターンを検出対象」として定義されている。

### TC-FR3-003: 単独の "FAIL" キーワードを含む出力が拒否されること（誤拒否排除後も正当な検出が維持）

**前提条件**: 単語境界アサーション（`\b`）と isCompoundWordContext の両方が適用されており、単語として独立した "FAIL" は引き続き検出される状態。
**入力**: exitCode=1、output="FAIL: critical assertion in auth module caused test failure. Process terminated." というテスト記録リクエスト。
**テスト手順**: workflow_record_test_resultツールを呼び出し、返却値にBLOCKING_FAILURE_KEYWORDSによる拒否エラーが含まれることを確認する。
**期待結果**: 単独の "FAIL" キーワードが拒否され、isCompoundWordContext関数が大文字始まり語を前後2語以内に検出しないため除外対象外と判定される。
**根拠**: spec.md FR-3節「isCompoundWordContext: キーワードの前後にスペース区切りの大文字始まり語がある場合（"Fail Closed"）を検出して除外対象外とする」の裏返しとして、単独キーワードは除外されない。

### TC-FR3-004: isCompoundWordContext関数がキーワード直後の大文字始まり語を検出してtrueを返すこと

**前提条件**: isCompoundWordContext関数が `function isCompoundWordContext(output: string, keyword: string, matchIndex: number): boolean` のシグネチャでエクスポートされている状態。
**入力**: output="Fail Open scenario was tested successfully", keyword="Fail", matchIndex=0 のパラメータ。
**テスト手順**: isCompoundWordContext関数を直接呼び出し、返却値を確認する。
**期待結果**: 関数がtrueを返すこと。"Fail" の直後に "Open"（大文字始まり語）が存在することが検出され、複合語コンテキストと判定される。
**根拠**: spec.md FR-3節「マッチ位置の前後50文字程度のウィンドウを取得し、ウィンドウ内でキーワードの直前または直後（2語以内）に大文字始まりの語が存在する場合に `true` を返す」。

### TC-FR3-005: isCompoundWordContext関数が単独の"fail"に対してfalseを返すこと

**前提条件**: isCompoundWordContext関数が正しくエクスポートされており、前後2語以内に大文字始まり語が存在しない場合はfalseを返す実装が完了している状態。
**入力**: output="the test did fail due to unexpected error condition", keyword="fail"、単独"fail"の位置をmatchIndexに指定したパラメータ。
**テスト手順**: isCompoundWordContext関数を直接呼び出し、返却値を確認する。
**期待結果**: 関数がfalseを返すこと。前後2語以内に大文字始まり語が存在せず、複合語コンテキストと判定されないことを確認する。
**根拠**: spec.md FR-3節「isCompoundWordContext: キーワードの前後にスペース区切りの大文字始まり語がある場合を検出」という条件を満たさない場合はfalseが返される。

### TC-FR3-006: isCompoundWordContextのウィンドウ外（50文字超）の大文字語が無視されること（パフォーマンス検証）

**前提条件**: isCompoundWordContext関数のマッチ位置前後50文字程度のウィンドウ制約が実装されており、処理時間が一定に保たれる状態。
**入力**: keyword("fail")の出現位置から60文字以上離れた場所に大文字始まり語が存在するoutput文字列とmatchIndex（50文字ウィンドウ外の大文字語は考慮されない）。
**テスト手順**: isCompoundWordContext関数を呼び出し、返却値がfalseであることを確認する。
**期待結果**: 50文字ウィンドウ外の大文字語は検出対象外であり、関数がfalseを返すこと。ウィンドウ制約がパフォーマンスと処理範囲の限定に寄与していることを確認する。
**根拠**: spec.md FR-3節「マッチ位置の前後50文字程度のウィンドウを取得し、コンテキストを把握する」という設計仕様に基づく。

### TC-FR3-007: regression_testフェーズで同一SHA256ハッシュ（TestOutputHash）の再記録が成功すること

**前提条件**: hashValidation処理にcurrentPhase条件分岐が追加され、regression_testフェーズでは既存ハッシュとの一致を検出しても上書き記録を許可する実装が完了している状態。
**入力**: 1回目の記録後、同一のテスト出力文字列（SHA256ハッシュが一致するTestOutputHash）を用いて2回目の記録を試みる。フェーズはregression_test。
**テスト手順**: 同一出力でworkflow_record_test_resultを2回呼び出し、2回目の呼び出しがエラーなく成功することを確認する。
**期待結果**: regression_testフェーズではhashValidation処理がスキップまたは上書き許可モードで動作し、修正前後の両方が記録可能であること。
**根拠**: spec.md FR-3節「この非対称なハッシュポリシーにより、regression_testでは同じテストスイートを複数回実行して記録できるようになり、修正前後の比較が両方記録可能になる」。

### TC-FR3-008: testingフェーズでは同一SHA256ハッシュの再記録が引き続き拒否されること

**前提条件**: hashValidation処理の条件分岐が正確に機能し、testingフェーズでは従来通りの同一ハッシュ拒否ポリシーが維持されている状態。
**入力**: testingフェーズで同一のテスト出力文字列（前回記録済みの同一SHA256ハッシュ）を用いて2回目の記録を試みるリクエスト。
**テスト手順**: testingフェーズで同一出力によるworkflow_record_test_resultを2回呼び出し、2回目の呼び出しがhashValidationエラーを返すことを確認する。
**期待結果**: testingフェーズでは同一ハッシュが拒否され、エラーが返却されること。testingとregression_testのフェーズ条件分岐が正確に機能していることが確認される。
**根拠**: spec.md FR-3節「testingフェーズでは従来通り同一ハッシュを拒否することを維持する」および「フェーズ条件を明示的に記述して両検出の非対称設計を文書化」。

---

## FR-4テストケース: ベースライン存在チェックとforceTransitionパラメータ

### FR-4のテストグループ概要

FR-4の根本原因は、CLAUDE.mdのルール20（ベースライン記録義務化）が文書上の義務化のみで技術的強制欠如の状態にあり、workflowNext関数（next.ts）にベースライン存在チェックが存在しなかった点にある。
testing→regression_test遷移時にtaskState.testBaselineが未設定の場合、requiresConfirmation=trueを含む返却値を返すことで因果関係追跡のためのベースラインが存在しない状態での遷移を防止する。
forceTransitionパラメータはオプショナルで追加され、既存テストが存在しない新規プロジェクトでの遷移スキップを許可することで利便性と安全性を両立する。
ハード阻止ではなく確認ダイアログ方式を採用する設計上の判断と、再起動手順を含む開始前チェックおよび修正完了後のベースライン記録指示をresearchフェーズプロンプトへ導入する施策も本グループで検証対象とする。

テストファイルパス: `workflow-plugin/mcp-server/src/tools/__tests__/next.test.ts`

### TC-FR4-001: testBaseline未設定でtesting→regression_test遷移がrequiresConfirmation=trueを返すこと

**前提条件**: workflowNext関数内の「testing → regression_test 遷移時チェック」処理（234行目付近）にtestBaseline存在チェックが追加されており、taskState.testBaselineがundefinedの場合に警告が返される状態。
**入力**: currentPhase=testing、taskState.testBaseline=undefined、forceTransition未指定のworkflow_nextリクエスト。
**テスト手順**: workflowNext関数を呼び出し、返却値にrequiresConfirmation=trueとベースライン記録を促すメッセージが含まれることを確認する。
**期待結果**: 返却値にsuccess=falseまたは相当する値とrequiresConfirmation=trueが含まれること。技術的強制欠如が解消され、ベースライン未記録状態でのregression_testへの遷移が阻止される。
**根拠**: spec.md FR-4節「ベースライン未設定かつforceTransition未指定の場合: `{ success: false, message: '...', requiresConfirmation: true }` 相当の情報を含める」。

### TC-FR4-002: forceTransition=trueでtestBaseline未設定でも遷移が許可されること

**前提条件**: workflowNext関数のシグネチャにforceTransition?: booleanパラメータが追加されており、既存の呼び出し元への影響は発生しない設計になっている状態。
**入力**: currentPhase=testing、taskState.testBaseline=undefined、forceTransition=trueのworkflow_nextリクエスト。
**テスト手順**: workflowNext関数をforceTransition=trueで呼び出し、返却値に遷移成功を示す情報が含まれることを確認する。
**期待結果**: forceTransition=trueにより、ベースライン未設定警告がスキップされて遷移が実行されること。新規プロジェクトや既存テストが存在しない場合の利便性と安全性の両立が確認される。
**根拠**: spec.md FR-4節「`forceTransition: true` が指定された場合、ベースライン未設定警告をスキップして遷移を許可する」。

### TC-FR4-003: testBaseline設定済みの場合に遷移が即座に許可されること（因果関係追跡確保）

**前提条件**: taskState.testBaselineに有効なベースライン情報（totalTests・passedTests・failedTestsを含むオブジェクト）が格納されており、因果関係追跡のためのベースラインが確認できる状態。
**入力**: currentPhase=testing、taskState.testBaselineに正常なベースラインデータを設定したworkflow_nextリクエスト（forceTransition未指定）。
**テスト手順**: workflowNext関数を呼び出し、requiresConfirmationダイアログ表示なしに遷移が成功することを確認する。
**期待結果**: ベースライン記録済みの場合はrequiresConfirmationが返却されず、regression_testフェーズへの遷移が成功すること。
**根拠**: spec.md FR-4節「チェック内容: `taskState.testBaseline` が undefined または null の場合に警告メッセージを返す」の裏返しとして、設定済みの場合は警告なしに遷移する。

### TC-FR4-004: 警告メッセージにworkflow_capture_baselineへの言及が含まれること

**前提条件**: workflowNext関数がベースライン未設定時に返却するメッセージ文字列にworkflow_capture_baselineへの言及が含まれる実装が完了している状態。
**入力**: currentPhase=testing、taskState.testBaseline=undefined、forceTransition未指定のworkflow_nextリクエスト。
**テスト手順**: workflowNext関数を呼び出し、返却値のmessageフィールドを確認する。
**期待結果**: messageフィールドに "workflow_capture_baseline" という文字列が含まれること。Orchestratorがbaseline記録の手順を通知経路から直接得られることを確認する。
**根拠**: spec.md FR-4節「返却するメッセージ内容: 『ベースラインが記録されていません。workflow_capture_baselineを実行してからregression_testフェーズに進んでください。』」。

### TC-FR4-005: testing以外のフェーズからのworkflow_nextではbaselineチェックがスキップされること

**前提条件**: workflowNext関数のチェックトリガー条件がcurrentPhase === 'testing'に限定されており、他フェーズでは不要なチェックが発生しない実装が完了している状態。
**入力**: currentPhase=implementation、taskState.testBaseline=undefined、forceTransition未指定のworkflow_nextリクエスト。
**テスト手順**: workflowNext関数をimplementationフェーズから呼び出し、baselineチェックが動作しないことを確認する。
**期待結果**: implementationフェーズからの遷移ではrequiresConfirmationが返却されず、通常の遷移処理が継続すること。チェックの限定的な適用範囲が正確に機能していることを確認する。
**根拠**: spec.md FR-4節「チェックのトリガー条件: `currentPhase === 'testing'`（testingフェーズからregression_testへの遷移時）」。

### TC-FR4-006: forceTransition=falseがforceTransition未指定と同じ動作をすること

**前提条件**: forceTransitionパラメータがfalseの場合もundefinedの場合と同様にベースライン存在チェックが実行される実装が完了している状態。
**入力**: currentPhase=testing、taskState.testBaseline=undefined、forceTransition=falseを明示的に指定したworkflow_nextリクエスト。
**テスト手順**: workflowNext関数をforceTransition=falseで呼び出し、返却値を確認する。
**期待結果**: 返却値にrequiresConfirmation=trueが含まれ、遷移がブロックされること。forceTransition=falseとundefinedが同等に扱われることを確認する。
**根拠**: spec.md FR-4節「forceTransitionパラメータはオプショナルであり、既存の呼び出し元コードへの影響を最小化する設計」に基づき、デフォルト動作はチェック有効である。

---

## NFRテストケース: パフォーマンスと後方互換性

### NFRのテストグループ概要

NFR-1（820件リグレッションテストスイート維持）・NFR-2（処理時間増加10%以内）・NFR-3（後方互換動作）・サブモジュールコミット同期を検証するための非機能要件テストケースを定義する。
パフォーマンステストはextractNonCodeLines関数の処理時間計測として実施し、1000行Markdownに対する処理時間増加を修正前後で比較して劣化制限（10%以内）を達成していることを確認する。
820件の内訳は単体テストと統合テストに分割されており、本修正の評価対象となる新規テスト33件と既存テスト820件の合計実行が完了することを確認の最終条件とする。

### TC-NFR-01: 820件の既存リグレッションテストスイートが全パスすること（NFR-1）

**前提条件**: MCPサーバーのコンパイル（`npm run build`）が完了し、Node.jsモジュールキャッシュを持つサーバープロセスが再起動されており、workflow-plugin/mcp-server/ディレクトリでnpm testが実行可能な状態。開始前の再起動手順として、settings.jsonのMCPサーバー設定から再接続またはプロセス終了・再起動を実施すること。
**テスト手順**: `npm test` をworkflow-plugin/mcp-server/ディレクトリで実行し、テスト結果のサマリーを確認する。再起動後はサーバープロセスが正常応答することを確認してから実行する。
**期待結果**: 820件全てのテストケースがパスし、失敗件数が0であること。FR-1〜FR-4の修正はオプショナル型追加または新関数追加のみであり、既存APIへの破壊的変更は行われていないため、既存動作が維持される。修正完了後の全変更が既存テストに悪影響を与えていないことを最終確認する。
**根拠**: spec.md NFR-1「既存テスト820件の全パス維持」およびサマリー「既存テスト820件の全パス維持を前提とする」。

### TC-NFR-02: extractNonCodeLines関数の処理時間増加が修正前後で10%以内であること（NFR-2・パフォーマンステスト）

**前提条件**: パフォーマンステストを `workflow-plugin/mcp-server/src/validation/__tests__/` に配置し、1000行のMarkdownコンテンツ（うち200行がコードフェンス内）を生成するフィクスチャが準備されている状態。
**テスト手順**: 1000行のMarkdownコンテンツに対してvalidateArtifactQuality関数を100回実行し、処理時間の平均値を計測する。修正前のベースライン値と比較して処理時間増加率を算出する。
**期待結果**: 処理時間増加率が10%以内に収まること。isInsideCodeFenceフラグのみを使用したシンプルなループ処理により、複数回実行時でも処理時間劣化が累積しないことを確認する。
**根拠**: spec.md NFR-2「バリデーション処理時間の劣化制限（10%以内）」およびパフォーマンス要件節「O(n)の1パス処理として実装し、1000行のMarkdownファイルに対する処理時間が修正前比で10%以内の増加に留まること」。

### TC-NFR-03: workflow-plugin/CLAUDE.mdとCLAUDE.mdのサブモジュールコミット後の同期確認（NFR-3後方互換）

**前提条件**: 両CLAUDE.mdへの追記（FR-2のリトライテンプレートへのモデルエスカレーション手順）が完了し、workflow-plugin/CLAUDE.mdはサブモジュールコミットが実施されている状態。
**テスト手順**: git submodule statusでサブモジュールの最新コミットハッシュを確認し、両ファイルのリトライテンプレートセクションを比較して同一内容が存在することを確認する。
**期待結果**: 両ファイルのバリデーション失敗時のリトライプロンプトテンプレートセクションにsuggestModelEscalation関連の追記内容が存在し、内容が一致していること。変更差分が追記のみに限定されていることを確認する。
**根拠**: spec.md FR-2節「`workflow-plugin/CLAUDE.md` にも同一内容を追記して両ファイルを同期させる」および制約事項「workflow-plugin/CLAUDE.mdはサブモジュール内のファイルであるため、変更後にサブモジュールコミットが必要となる」。

---

## テスト実行手順

### 前提条件の確認（MCPサーバー再起動タイミング）

全FR修正のコンパイル完了後、Node.jsモジュールキャッシュ仕様によりMCPサーバープロセスを再起動することが必須である。
dist/*.jsファイルの変更はサーバープロセス再起動なしには実行中のサーバーに反映されないため、コンパイル完了後かつテスト実行前にMCPサーバーを再接続またはプロセスを再起動する。
再起動手順はsettings.jsonのMCPサーバー設定から再接続するか、プロセスを終了して再起動する方法を提供しており、開始前に必ずこの手順を完了させること。
再起動後はworkflow_statusコマンドでサーバーが正常に応答することを確認してからテストを実行する。
修正完了後の検証として、全テストスイートのパス状況と新規追加テストの通過を確認し、既存テストへの影響がないことを最終確認する。

### テスト実行順序

1. FR-1テスト（artifact-validator.test.ts）を実行し、extractNonCodeLinesの動作とコードフェンス除外ロジックを検証する
2. FR-2テスト（definitions.test.ts）を実行し、BuildRetryResultのsuggestModelEscalationフィールドとエスカレーション条件を検証する
3. FR-3テスト（record-test-result.test.ts）を実行し、isCompoundWordContextと非対称ハッシュポリシーを検証する
4. FR-4テスト（next.test.ts）を実行し、forceTransitionパラメータとベースライン存在チェックを検証する
5. NFRパフォーマンステストを実行し、処理時間増加が10%以内であることを検証する
6. リグレッションテストスイート全820件を `npm test` で一括実行し、全件パスを確認する

### テストカバレッジ集計

FR-1（extractNonCodeLines）は正常系5件・コードフェンス境界値2件・リグレッション1件の合計8件でカバーする。
FR-2（BuildRetryResult・エスカレーション）は正常系4件・境界値2件・後方互換2件の合計8件でカバーする。
FR-3（isCompoundWordContext・ハッシュポリシー）は正常系3件・単独検出2件・境界値3件の合計8件でカバーする。
FR-4（ベースライン存在チェック）は正常系2件・異常系2件・境界値2件の合計6件でカバーする。
NFR（非機能要件）は3件でカバーし、全体として33件の新規テストケースを追加する。
本テスト設計の評価対象として全33件の新規テストと820件の既存テストを統合して実行することが、本修正の完了判定条件となる。
