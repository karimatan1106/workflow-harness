# テスト設計：ワークフロー残存阻害要因C1-C3修正

## サマリー

本テスト設計は、3つのフックファイルに対する6件の修正を検証するためのテストケースを定義する。
各テストは修正前に失敗し、修正後に成功するTDD Red-Greenパターンで設計されている。
テスト対象はenforce-workflow.jsのPHASE_EXTENSIONS、bash-whitelist.jsのBASH_BLACKLISTとmatchesBlacklistEntry関数、phase-edit-guard.jsのPHASE_RULESの3箇所である。
テストはNode.jsのassertモジュールを使用したスクリプトとして実装し、各フックファイルの内容を文字列検査する方式を採用する。
統合テストとして各フックファイルが構文エラーなしで読み込めることの確認も含む。

## テスト計画

テストは検証スクリプトとして実装し、6件の修正項目それぞれに対して独立したテストケースを用意する。
各テストケースはフックファイルの内容を読み取り、修正が正しく適用されているかを文字列パターンで検証する形式をとる。
テストスクリプトはNode.jsのassertモジュールを使用し、外部依存なしで実行可能な構成とする。
テスト実行コマンドはnode -eを通じたスクリプト呼び出しとし、bash-whitelist.jsのホワイトリスト範囲内で実行する。
全テストケースの結果を集計し、成功・失敗の件数を標準出力に報告する仕組みを含める。

## テストケース

### TC-1：PHASE_EXTENSIONSにdocs_updateエントリが存在する（C-1検証）

enforce-workflow.jsのPHASE_EXTENSIONSオブジェクトから直接docs_updateキーを読み取り、値として配列が返ることを検証する。
配列の中に'.md'と'.mdx'の2要素が含まれることを確認する。
このテストは修正前のenforce-workflow.jsではdocs_updateキーが存在しないため失敗する。

### TC-2：PHASE_EXTENSIONSにci_verificationエントリが存在する（C-2検証）

enforce-workflow.jsのPHASE_EXTENSIONSオブジェクトからci_verificationキーを読み取り、値として配列が返ることを検証する。
配列の中に'.md'が含まれることを確認する。
CLAUDE.mdの仕様ではci_verificationフェーズの編集可能ファイルは.mdのみと定義されている。

### TC-3a：BASH_BLACKLISTのリダイレクトパターンがregex型で定義されている（C-3検証 part1）

bash-whitelist.jsのBASH_BLACKLIST配列を検索し、リダイレクト演算子のパターンがtype: 'regex'で定義されていることを確認する。
従来のtype: 'contains'のまま残っていないことも合わせて検証する。
ファイル内容の文字列検査で「type: 'regex'」の存在と正規表現パターンの記述を確認する。

### TC-3b：matchesBlacklistEntry関数にregex型のcase分岐が存在する（C-3検証 part2）

bash-whitelist.jsのmatchesBlacklistEntry関数のswitch文内に「case 'regex'」の分岐が追加されていることを確認する。
regex分岐の実装としてentry.pattern.testメソッドの呼び出しが含まれていることを検証する。
この検証はファイル内容のテキスト検索で行い、case文とreturn文の両方の存在を確認する。

### TC-3c：アロー関数を含むコマンドがブラックリストに検出されない（C-3検証 part3）

修正後のmatchesBlacklistEntry関数がアロー関数構文「=>」を含むnode -eコマンドをブラックリスト検出しないことを検証する。
具体的にはコマンド文字列「node -e "arr.map(x => x + 1)"」に対して、リダイレクトパターンのマッチが発生しないことを確認する。
一方で通常のリダイレクト「echo test > file.txt」はmatchが維持されることも検証する。

### TC-4a：PHASE_RULESにregression_testエントリが存在する（H-1a検証）

phase-edit-guard.jsのPHASE_RULESオブジェクトにregression_testキーが存在することを確認する。
allowedプロパティに'spec'と'test'が含まれ、blockedプロパティに'code'と'diagram'が含まれることを検証する。
CLAUDE.mdの仕様ではregression_testフェーズはテストファイルと仕様書の編集が可能と定義されている。

### TC-4b：PHASE_RULESにci_verificationエントリが存在する（H-1b検証）

phase-edit-guard.jsのPHASE_RULESオブジェクトにci_verificationキーが存在することを確認する。
allowedプロパティに'spec'のみが含まれ、blockedプロパティに'code'と'test'を含む全カテゴリが設定されていることを検証する。
ci_verificationフェーズは仕様書のみの編集が許可される設計に準拠していることを確認する。

### TC-4c：PHASE_RULESにdeployエントリが存在する（H-1c検証）

phase-edit-guard.jsのPHASE_RULESオブジェクトにdeployキーが存在することを確認する。
allowedプロパティに'spec'のみが含まれ、blockedにはその他全カテゴリが含まれることを検証する。
deployフェーズは仕様書のみの編集が許可される設計に準拠していることを確認する。

### TC-5：全フックファイルが構文エラーなしでロードできる（統合テスト）

修正後の3つのフックファイル（enforce-workflow.js、bash-whitelist.js、phase-edit-guard.js）がNode.jsのrequire関数で正常にロードできることを確認する。
構文エラーやランタイムエラーが発生しないことを検証し、修正によるファイル破損がないことを保証する。
各ファイルのロード後、エクスポートされたオブジェクトが未定義でないことも合わせて確認する。

## テスト実装方針

テストスクリプトはワークフロー成果物ディレクトリに配置し、assert標準モジュールのみを使用する。
テストファイルのパスはdocs/workflows/ワ-クフロ-残存阻害要因C1-C3修正/verify-fixes.test.tsとする。
テスト対象ファイルのパスはworkflow-plugin/hooks/配下の3ファイルを絶対パスで指定する。
テスト実行はnode -eコマンド経由でスクリプトを呼び出す形式とし、終了コード0で成功、非0で失敗を示す。
