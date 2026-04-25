## サマリー

- 目的: FR-A/B/C1/C2/D の各修正がセキュリティ上の問題を引き起こしていないかを検証した
- 評価スコープ: workflow-plugin/mcp-server/src/phases/definitions.ts（テンプレート文字列追記）および C:\ツール\Workflow\CLAUDE.md（FR-D ドキュメント修正）の2ファイルを主対象とし、コアモジュール（artifact-validator.ts・state-manager.ts）は変更対象外であることを確認した
- 主要な決定事項: 修正はすべてサブエージェントへのプロンプトガイダンス追記であり、ロジック変更を含まないため攻撃面の拡大はなかった。ただし既存の依存パッケージに 13 件の脆弱性が確認された（High 5 件・Moderate 6 件・Low 2 件）
- 検証状況: TS-1（ビルド成功確認）・TS-2（HMAC コアロジック未変更確認）・TS-3（CLAUDE.md sessionToken 取得手順確認）・TS-4（FORBIDDEN_PATTERNS 整合性確認）の 4 脅威シナリオをすべて検証し合否を判定した
- 次フェーズで必要な情報: 依存パッケージの脆弱性（特に @modelcontextprotocol/sdk の High: クロスクライアントデータリーク）はプロダクション運用前に対応が必要であるため、performance_test フェーズおよび後続の docs_update フェーズで引き継ぐこと

---

## 脆弱性スキャン結果

スキャン対象範囲として、workflow-plugin/mcp-server/src/ 配下の TypeScript ファイル全体および C:\ツール\Workflow\CLAUDE.md を対象とした。
スキャン実行日時として 2026-02-28（Windows 11 / Node.js 環境）に pnpm audit コマンドを使用してスキャンを実施した。
使用したスキャンツールとして pnpm audit（pnpm-lock.yaml をベースにした依存パッケージ解析）を利用し、GHSA データベースに基づいて既知の脆弱性を照合した。
スキャン完了状態として、pnpm audit は正常終了し「13 vulnerabilities found / Severity: 2 low | 6 moderate | 5 high」の結果を出力した。
スキャン実行コマンドとして `cd workflow-plugin/mcp-server && pnpm audit` を実行し、依存パッケージ全体の既知脆弱性を確認した。

### TS-1: ビルド成功確認（バックスラッシュエスケープ構文エラー）

FR-A/B/C1/C2 による definitions.ts のテンプレート文字列追記においてエスケープ構文エラーが発生していないことを確認した。
確認方法として、dist/phases/definitions.js を Node.js ランタイムでロードし（`require('./dist/phases/definitions.js')`）、PHASE_GUIDES 内の各サブフェーズオブジェクトにアクセスできることを検証した。
検証結果として、「definitions loaded OK, phase keys: 18」の出力が得られ、全 18 フェーズガイドが正常にロードされることを確認した。
また全テストスイートを実行し 950/950 全件合格（77 ファイル、実行時間 3.53 秒）を確認した。

### TS-2: HMAC 整合性の確認（コアロジック未変更）

state-manager.ts および artifact-validator.ts の変更履歴を `git log --oneline -5` で確認した結果、今回の修正セット（FR-A〜FR-D）では両ファイルへの変更がないことを確認した。
最新の state-manager.ts・artifact-validator.ts のコミットは FR-A〜FR-D より以前のものであり、HMAC-SHA256 によるワークフロー状態保護のロジックは一切変更されていない。
definitions.ts の変更はテンプレート文字列の末尾への追記のみであり、HMAC キーの生成・検証処理に関わるコードへの影響はない。

---

## 検出された問題

### 問題1: @modelcontextprotocol/sdk のクロスクライアントデータリーク（High）

深刻度の評価として High に分類され、共有されたサーバーおよびトランスポートインスタンスを再利用した場合に異なるクライアント間でデータが漏洩する可能性がある（GHSA-345p-7cg4-v4c7）。
影響を受けるコンポーネントとして @modelcontextprotocol/sdk バージョン 1.10.0 以上 1.25.3 以下が対象であり、パッチ済みバージョンは 1.26.0 以上である。
推奨対策として @modelcontextprotocol/sdk を 1.26.0 以上にアップグレードすることが必要である。本プロジェクトは開発ツール用 MCP サーバーであり、通常は単一クライアント（Claude Desktop）が使用するため、即時のデータリークリスクは低いと判断する。
優先度の判定として、プロダクション環境での複数クライアント接続を想定する場合は高優先度での対応が必要である。

### 問題2: minimatch の ReDoS 脆弱性（High、2件）

深刻度の評価として High に分類され、GHSA-3ppc-4f35-3m26 および GHSA-7r86-cg39-jmmj の 2 件が検出された。
影響を受けるコンポーネントとして `@vitest/coverage-v8 > test-exclude > minimatch` のパスで使用される minimatch がバージョン 9.0.0 以上 9.0.7 未満であることが判明した。
推奨対策として minimatch を 9.0.7 以上にアップグレードすることが必要であるが、当該パッケージはテスト実行環境（vitest）の間接依存であり、実行時環境には含まれない。
優先度の判定として CI/CD パイプラインでのテスト実行時にのみリスクが存在するため、中優先度として次のメンテナンスサイクルで対応することを推奨する。

### 問題3: rollup の Arbitrary File Write 脆弱性（High）

深刻度の評価として High に分類され、GHSA-mw96-cpmx-2vgc として報告されており、rollup バージョン 4.0.0 以上 4.59.0 未満にパス・トラバーサルによる任意ファイル書き込みの脆弱性がある。
影響を受けるコンポーネントとして `vitest > vite > rollup` のパスで使用される rollup が対象であり、ビルドおよびテスト実行環境でのみ使用される間接依存である。
推奨対策として rollup を 4.59.0 以上にアップグレードすることが必要であるが、テストのみの環境であるため実行時の影響はない。
優先度の判定として中優先度とし、vitest のバージョンアップに合わせて対応することを推奨する。

### 問題4: hono の timing attack 脆弱性（Low）および qs の脆弱性（Moderate）

深刻度の評価として hono は Low・qs は Moderate に分類された。
影響を受けるコンポーネントとして `@modelcontextprotocol/sdk > @hono/node-server > hono` および `@modelcontextprotocol/sdk > express > qs` が対象である。
推奨対策として @modelcontextprotocol/sdk 自体のアップグレードにより間接的に解決される可能性が高いため、問題1の対応と合わせて対処することが効率的である。
優先度の判定として低優先度とし、問題1の対応に追随して解決することを推奨する。

### TS-3: CLAUDE.md の sessionToken 取得手順確認

CLAUDE.md の AIへの厳命 23 番を読み取り確認した結果、以下の手順が正確に記載されていることを検証した。
taskId を明示指定して workflow_status を呼び出すことが明記されており（例: `workflow_status({ taskId: 'タスクID' })`）、操作手順として適切に記述されている。
taskId が不明な場合の手順として、先に `workflow_list` を呼び出して taskId を確認してから `workflow_status({ taskId: '確認したID' })` を呼び出す手順が明記されており、セッション再開時の sessionToken 喪失リスクが適切に管理されている。
sessionToken の用途制限として「取得先は workflow_status のみ、使用先は workflow_record_test_result のみに限定する」と明記されており、sessionToken の意図しない横流し防止が担保されている。

### TS-4: FORBIDDEN_PATTERNS と CLAUDE.md の整合性確認

artifact-validator.ts の exportGlobalRules() 関数から実際の forbiddenPatterns 配列を取得した結果、12 語（英語 4 語・日本語 8 語）が定義されていることを確認した。
実際に取得した内容は `["TODO","TBD","WIP","FIXME","未定","未確定","要検討","検討中","対応予定","サンプル","ダミー","仮置き"]` であり、CLAUDE.md の「禁止パターン（完全リスト）」セクションに記載されたリストと一致している。
definitions.ts のフォールバック値も同一の 12 語を含むよう FR-REQ-4 で修正済みであり、3 者間（artifact-validator.ts・definitions.ts フォールバック・CLAUDE.md）の整合性が維持されている。

---

## 総合評価

検出された全脆弱性の深刻度別サマリーとして、Critical: 0 件、High: 5 件（@modelcontextprotocol/sdk 1 件・minimatch 2 件・rollup 1 件・hono 経由 1 件）、Moderate: 6 件、Low: 2 件の合計 13 件が検出された。これらはすべて依存パッケージの既存の脆弱性であり、今回の FR-A〜FR-D 修正による新規の脆弱性の導入はない。

インジェクション・認証バイパス等の高リスク脅威に対する対応状況として、今回の修正はサブエージェントプロンプトのテンプレート文字列への追記のみであり、外部入力がコードパスに新たに関与するような変更はない。インジェクション・認証バイパスの脅威シナリオ（TS-1〜TS-4）はいずれも該当なしと判定した。

threat-model.md に記載された脅威シナリオ（TS-1〜TS-4）と今回のスキャン結果の整合性について、TS-1 はビルド成功確認により問題なし、TS-2 はコアモジュール未変更によりHMAC保護が維持、TS-3 は CLAUDE.md への適切な手順記載により sessionToken 管理リスクを低減、TS-4 は FORBIDDEN_PATTERNS の 3 者間整合性確認により問題なしと判定した。

即時対応が必要なものと後続フェーズへ引き継ぐものの区分として、今回の修正範囲（FR-A〜FR-D）に起因する即時対応が必要な問題はない。検出された 13 件の依存パッケージ脆弱性は既存の技術的負債であり、次のメンテナンスサイクル（後続フェーズ）での対応を推奨する。

全体的なセキュリティ評価として条件付き合格と判定する。FR-A〜FR-D の修正自体には新規のセキュリティリスクが確認されなかった。ただし依存パッケージの High 脆弱性 5 件（特に @modelcontextprotocol/sdk のクロスクライアントデータリーク）は引き続き監視が必要であり、パッケージアップグレードを次のメンテナンス作業として計画することを条件とする。
