## サマリー
- [SD-001][finding] manager.ts の resetTask メソッド (L83) は state.completedPhases と state.subPhaseStatus をクリアするが state.retryCount のクリアが欠落しており、harness_reset 後も旧フェーズのリトライカウンターが残存してハーネスが永続的にブロックされる
- [SD-002][finding] manager.ts の goBack メソッド (L69-78) はフェーズをロールバックする際に completedPhases をスライスするが state.retryCount を操作しないため、ロールバック先フェーズのカウンターが最大値5のまま残り直後の harness_next が RLM-1 ブロックを踏む
- [SD-003][decision] resetTask への修正は state.retryCount = {} による全フィールドクリアとする。リセットは全フェーズ履歴を消去する操作であり全カウンターのゼロ化が一貫した設計である
- [SD-004][decision] goBack への修正はロールバック先フェーズのカウンターのみゼロ化する形とする。state.retryCount が設定されていない場合には retryCount オブジェクト作成後にゼロ代入し、他フェーズのカウンターは部分的ロールバックの意図を尊重して保持する
- [SD-005][constraint] retryCount フィールドは types.ts L96 で retryCount?: Record<string, number> としてオプショナル定義されているため、修正コードは retryCount が設定されていない場合を必ず考慮しなければならない
- [SD-006][risk] goBack にて state.retryCount?.[targetPhase] が設定されていない場合に代入操作を行うと retryCount オブジェクト自体が存在しないため TypeScript の型安全性に注意が必要。state.retryCount ??= {} で初期化してから代入する形が安全である
- [SD-007][finding] 既存テスト manager-lifecycle.test.ts の describe('resetTask') ブロックにはリトライカウンターに関するアサーションが存在しない。修正後に retryCount がクリアされることを検証するテストケースを新規追加する
- [SD-008][finding] handler-misc.test.ts の describe('StateManager retryCount methods') には resetRetryCount のテストが存在するが resetTask および goBack がリトライカウンターに与える影響のテストは存在しない
- [SD-009][dependency] 修正対象は単一ファイル mcp-server/src/state/manager.ts のみ。types.ts の型定義変更は不要であり manager-read.ts や manager-write.ts も変更不要
- [SD-010][next] テストは mcp-server/src/__tests__/manager-lifecycle.test.ts に追加する。resetTask 後に retryCount が空オブジェクトになること、goBack 後にロールバック先フェーズのカウンターが 0 になることをそれぞれ検証する

## スコープ定義
修正対象ファイルは workflow-harness/mcp-server/src/state/manager.ts の1ファイルのみである。
具体的な修正箇所は2か所あり、1つ目は L80-88 に定義された resetTask メソッドの L83 で、連続代入式 `state.completedPhases = []; state.subPhaseStatus = {};` の直後に `state.retryCount = {};` を挿入する。
2つ目は L69-78 に定義された goBack メソッドで、L75 の `state.phase = targetPhase;` の直後に `(state.retryCount ??= {})[targetPhase] = 0;` を追加し、ロールバック先フェーズのカウンターのみをゼロ化する。
テスト追加先は workflow-harness/mcp-server/src/__tests__/manager-lifecycle.test.ts であり、既存の resetTask および goBack のテストブロックに隣接する形で新規テストケースを2件追加する。
型定義ファイル workflow-harness/mcp-server/src/state/types.ts は変更しない。L96 の `retryCount?: Record<string, number>` は本修正で使用する空オブジェクト代入と完全に互換しており、追加の変更は不要である。
修正の実装に際して TypeScript の厳格モードが有効であることを前提とし、オプショナルチェーンおよびヌル合体演算子を活用した安全な記述を行う。
本修正はソースコードのみの変更であり、MCP サーバーのビルドと単体テストの実行によって検証できる。
build スクリプト (`npm run build`) がエラーゼロで完了し、`npm test` で全テストがパスすれば修正は完了とみなせる。

## 影響範囲
本変更は manager.ts の resetTask と goBack の2メソッドにのみ影響し、他のメソッドおよびファイルには変更を加えない。
resetTask は harness_reset ツールハンドラーからのみ呼ばれ、goBack は harness_back ツールハンドラーからのみ呼ばれる。いずれもユーザーが明示的にリセットまたはロールバックを要求した場合にのみ実行される操作であり、通常のフェーズ進行フローには影響しない。
retryCount フィールドはオプショナル定義であるため、空オブジェクトへの代入は型安全であり、初期化されていない状態を正規化する副次効果もある。
harness_next のリトライ判定ロジックは retryCount[phase] の値を参照するが、空オブジェクトや設定されていないキーへのアクセスは undefined を返すためカウンターが0から再開される。これはリセット・ロールバック後の期待動作と一致する。
既存の全テストが引き続きパスすることを確認した上で変更を完了とする。新規テスト2件はリグレッション防止のためのアサーションであり、既存テストの動作を変更しない。
本修正はハーネスの状態整合性を回復する修正であり、MCP プロトコルの通信フォーマットや stateIntegrity HMAC 署名の計算方法には一切影響しない。

## スコープ外
types.ts の retryCount フィールド定義は変更しない。`retryCount?: Record<string, number>` というオプショナル型かつ Record 型の定義は本修正で空オブジェクトを代入する操作と完全に互換しており、変更の必要がない。
harness_next のリトライ判定ロジック自体（フェーズ進行時にカウンターをインクリメントする処理）は変更しない。RLM-1 の5回上限ルールはそのまま維持し、カウンターのインクリメントやリセット専用メソッド resetRetryCount の動作も変更しない。
manager-read.ts、manager-write.ts、handler.ts、validator.ts への変更は行わない。retryCount クリアは状態管理層の責務であり、ハンドラー層や読み書き層での対処は設計として不適切である。
本タスクはバグ修正であり新規フィーチャーの追加や既存 MCP ツール API のシグネチャ・戻り値の変更は行わない。外部インターフェースへの影響は皆無である。
リトライ履歴の永続化や resetHistory への retryCount 記録機能の追加は本タスクの対象外である。ユーザーの意図はリセット・ロールバック後にカウンターがクリアされることであり、履歴保持機能の追加ではない。
将来的な機能拡張として retryCount の詳細ログや通知機能の追加が考えられるが、それらの実装は本タスクの範囲外であり別途タスクとして扱う。
