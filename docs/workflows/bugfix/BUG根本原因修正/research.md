## サマリー

本調査では、ワークフロープラグインに存在する3つのバグの根本原因を特定した。

- 目的: BUG-1（isStructuralLineのヘッダー除外漏れ）、BUG-2（HMAC計算アルゴリズム不一致）、BUG-3（submodule未コミット変更）の根本原因追究
- 主要な発見: 3つのバグは全て設計時の仕様統一不足とテスト不足に起因する
- 次フェーズで必要な情報: 各バグの修正方針と影響範囲

## 調査結果

### BUG-1: isStructuralLine にMarkdownヘッダー除外がない

対象ファイル: `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

isStructuralLine関数（93行目付近）は重複行検出で除外すべき構造的行を判定する。水平線、コードフェンス、テーブル行、太字ラベルは除外対象だが、Markdownヘッダー（`#`で始まる行）が含まれていない。

一方、セクション密度チェック（599行目付近）では`startsWith('#')`で別途ヘッダーを判定しており、ロジックの不整合がある。

根本原因: 初期実装時にMarkdownヘッダーが「構造要素」として見落とされた。ヘッダーは同一文書内で繰り返し使われるパターンがあり、3回以上出現すると誤検知が発生する。

影響範囲: 全てのワークフロー成果物の重複行バリデーション。特にテスト結果やレビュー文書で頻出する。

修正方針: isStructuralLine関数に`/^#+\s/`パターンを追加する。

### BUG-2: MCP serverとhooksのHMAC計算アルゴリズム不一致

対象ファイル はMCP server側の`workflow-plugin/mcp-server/src/state/hmac.ts`とhooks側の`workflow-plugin/hooks/hmac-verify.js`の2つ。

3つの不一致が存在する。

#### 不一致1: 鍵ファイル形式の違い

MCP serverのsaveKeys()（hmac.ts 152行）は`{version: 1, keys: [{keyId, key, createdAt, rotatedAt}]}`形式で書き込む。hooksのloadHMACKeys()（hmac-verify.js 35行）は`[{generation, key, createdAt}]`の配列形式を期待する。hooksは`Array.isArray()`チェックでオブジェクト形式を拒否し、空配列を返す。

#### 不一致2: 鍵エンコーディングの違い

MCP serverのsignWithCurrentKey()（hmac.ts 191行）はhex文字列をそのまま使用する: `crypto.createHmac('sha256', currentKey.key)`。hooksのcalculateHMAC()（hmac-verify.js 144行）はバイナリバッファに変換する: `Buffer.from(keyHex, 'hex')`。同じhex文字列でも、文字列として渡すかバッファとして渡すかで異なるHMACが生成される。

#### 不一致3: ダイジェストエンコーディングの違い

MCP serverは`.digest('hex')`（hmac.ts 193行）で16進数文字列を出力する。hooksは`.digest('base64')`（hmac-verify.js 122行）でBase64文字列を出力する。

根本原因: REQ-9（鍵ローテーション）実装時にhmac.tsが大幅改修されたが、hooks側のhmac-verify.jsが旧アルゴリズムのまま更新されなかった。

影響範囲: 全てのファイル書き込み操作がブロックされる。enforce-workflow.jsフックが全タスクのHMAC検証に失敗する。

修正方針: hmac.tsをhooks側アルゴリズムに合わせて修正する。具体的にはsaveKeys()の出力形式を配列にし、signWithCurrentKey()でBuffer.from(key, 'hex')を使用し、digest('base64')に変更する。verifyWithAnyKey()も同様に修正する。

### BUG-3: submoduleにartifact-validator.tsの変更が未コミット

対象はworkflow-pluginサブモジュール内のartifact-validator.ts。.mmdファイル除外の修正がワーキングツリーに残っているがコミットされていない。

根本原因: submoduleのコミットプロセスが複雑で（submodule内コミット→mainリポジトリ参照更新→mainコミット）、前回の修正作業時にsubmodule内のコミットステップが漏れた。

修正方針: 未コミット変更をsubmodule内でコミットし、mainリポジトリの参照を更新する。

## 共通する構造的問題

3つのバグに共通する構造的問題として、テスト駆動開発の不徹底（isStructuralLineとHMAC計算の境界条件テスト不足）、インターフェース仕様書の不在（MCP serverとhooks間のHMACプロトコル未文書化）、自動化の不足（submoduleコミット確認の自動チェック未導入）がある。

## 再発防止策の方向性

isStructuralLineの構造要素定義を網羅的にテストするケースを追加する。HMAC署名アルゴリズムの共通仕様書を作成してMCP serverとhooksで同一仕様を参照する。submoduleダーティ状態を検出するpre-commitフックを導入する。MCP serverとhooksの統合テスト（署名生成と検証の往復テスト）を追加する。
