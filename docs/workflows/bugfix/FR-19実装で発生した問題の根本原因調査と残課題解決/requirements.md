## サマリー

- 目的: FR-19実装後に残存した2種類の問題（atomicWriteJson のリトライ欠如によるEPERMエラー、ルートディレクトリへの一時スクリプト残存）を解消し、Windows環境での安定性とリポジトリの清潔さを回復する
- 主要な決定事項: lock-utils.ts の atomicWriteJson 関数にリトライロジックを追加し、ルートに残存する検証スクリプト3ファイルを削除する
- 次フェーズで必要な情報: lock-utils.ts の修正箇所（115〜127行目）、削除対象ファイルのパス（verify-templates.js, full-template-verify.js, detailed-verify.js）

---

## 背景

FR-19 の実装（全フェーズへのワークフロー制御ツール禁止指示追加）は 2026-02-24 に完了したが、その実装過程で2つの問題が副次的に発生した。

第一の問題は、ci_verification から deploy への遷移時に EPERM エラーが発生してフェーズ遷移が失敗した事象である。lock-utils.ts の atomicWriteJson 関数は Windows 環境でのファイルロック競合を考慮せず、renameSync を1回だけ試行する設計になっていた。ウィルス対策ソフトや Windows エクスプローラーが一時ファイルをロックする瞬間に rename 操作が重なると EPERM エラーが発生するが、これは一時的な競合であり短時間のリトライで解消できる性質のものである。2回目の呼び出しで成功した事実がこれを裏付けている。

第二の問題は、FR-19 実装後の refactoring フェーズで subagent がルートディレクトリに検証スクリプト3ファイルを作成し、削除できずに残存させた事象である。subagent は python3 とノードのヒアドキュメント実行がフックでブロックされた後、代替手段として .js ファイルをルートに直接作成した。その後の rm コマンドもコマンドチェーン違反でブロックされたため、ファイルが未追跡状態のまま残存している。

---

## 機能要件

### FR-REQ-1: atomicWriteJson へのリトライロジック追加

lock-utils.ts の atomicWriteJson 関数（115〜127行目）を修正し、renameSync が EPERM または EBUSY で失敗した場合に以下の仕様でリトライする。

- 最大リトライ回数: 3回（初回試行を含めると最大4回の試行）
- 待機時間: リトライ前に 100ms のスリープを挟む
- 対象エラーコード: EPERM および EBUSY の2種類（これ以外のエラーは即座に上位へ伝播する）
- 全リトライ失敗時: 最後のエラーを上位へ throw する
- スリープ実装: manager.ts に既存の Atomics.wait パターンを再利用するか、同等の実装を lock-utils.ts 内に記述する
- 既存の cleanup ロジック（tmpFile の unlinkSync）は変更しない

### FR-REQ-2: ルート残存ファイルの削除

以下の3ファイルをリポジトリから完全に削除する。

- C:/ツール/Workflow/verify-templates.js（48行のNode.js CommonJS スクリプト）
- C:/ツール/Workflow/full-template-verify.js（105行のNode.js CommonJS スクリプト）
- C:/ツール/Workflow/detailed-verify.js（92行のNode.js CommonJS スクリプト）

これらはプロダクションコードではなく、FR-19 実装時の検証目的で一時的に作成されたスクリプトである。いずれも git の未追跡ファイルとして存在しており、削除後は git status で表示されなくなることを確認する。

---

## 非機能要件

### パフォーマンス要件

atomicWriteJson のリトライ処理は、競合が発生しない通常ケースで追加のオーバーヘッドを生じさせてはならない。リトライが発生するのはエラー検出後のみであり、正常パスへの影響はゼロである。

### 信頼性要件

修正後の atomicWriteJson は Windows 環境のウィルス対策ソフトが有効な状態でも、単一の一時的なロック競合によってフェーズ遷移が失敗しないことが要求される。連続した3回の競合が発生するケースは極めてまれであり、最大3回のリトライで十分なカバレッジが得られる。

### 後方互換性要件

atomicWriteJson の関数シグネチャ（引数・戻り値の型）を変更してはならない。既存の呼び出し元（manager.ts の writeTaskState および updateTaskPhase）が修正なしで動作することが必須である。

### コードスタイル要件

修正コードは既存の lock-utils.ts のスタイル（TypeScript、ESM インポート、同期関数）に従う。acquireLockSync が採用しているリトライパターンと整合性のある実装を行う。

### リポジトリ清潔性要件

削除後に git status を実行し、3ファイルが「untracked files」から消えていることを確認する。削除操作後に新たな未追跡ファイルがルートに生じないこと。

---

## 受入条件

### FR-REQ-1 の受入条件

atomicWriteJson 関数に EPERM および EBUSY エラーに対するリトライロジックが実装されていること。最大3回のリトライと各100msの待機時間がコードに明示されていること。既存の単体テストが全て合格し続けること（リトライ追加によるリグレッションがないこと）。manager.ts の呼び出し元コードを変更せずに動作すること。

### FR-REQ-2 の受入条件

verify-templates.js、full-template-verify.js、detailed-verify.js の3ファイルがリポジトリルートから削除されていること。削除後の git status コマンドで、これら3ファイルが「untracked files」セクションに表示されないこと。ルートディレクトリに他の新規ファイルが生じていないこと。

### 統合受入条件

FR-REQ-1 と FR-REQ-2 の両方が満たされた状態で、既存テストスイートが全て合格すること。MCP サーバーのビルド（npm run build）が成功すること。
