# 実装仕様書：ワークフロー残存阻害要因C1-C3修正

## サマリー

ワークフロープラグインの3つのフックファイルに存在する6件の実装漏れを修正する仕様書である。
enforce-workflow.jsにdocs_updateとci_verificationの拡張子定義を追加し、bash-whitelist.jsのリダイレクト検出パターンを正規表現型に変更してアロー関数の誤検出を排除する。
phase-edit-guard.jsにregression_test、ci_verification、deployの3フェーズルールを追加する。
全修正はフックファイルのJavaScript定数オブジェクトへのエントリ追加と、パターンマッチング型の変更で完結する。
MCPサーバーのTypeScriptソースコードへの変更は不要だが、フックファイルはNode.jsで直接実行されるためビルド不要で即座に反映される。

## 概要

本タスクでは、CLAUDE.mdで定義された19フェーズのワークフローと、実際のフックファイル実装との不整合を解消する。
対象はenforce-workflow.js、bash-whitelist.js、phase-edit-guard.jsの3ファイルであり、合計6件の修正を実施する。
C-1とC-2はPHASE_EXTENSIONSへのフェーズエントリ追加であり、docs_updateとci_verificationフェーズでのMarkdownファイル書き込みを可能にする。
C-3はBASH_BLACKLISTのリダイレクト検出パターン「> 」をcontains型からregex型に変更し、アロー関数「=> 」との誤検出を排除する。
H-1a、H-1b、H-1cはPHASE_RULESへのフェーズルール追加であり、regression_test、ci_verification、deployフェーズでのファイル編集制限を適切に定義する。
修正はすべて既存の定数オブジェクトへのエントリ追加または型変更であり、関数ロジックの変更は最小限（matchesBlacklistEntryへのregex case追加のみ）に留める。

## 実装計画

### 段階1：enforce-workflow.jsのPHASE_EXTENSIONS修正（C-1、C-2）

enforce-workflow.jsの行74（e2e_testエントリ）の直後に、docs_updateとci_verificationの2エントリを追加する。
現在のコードではe2e_testエントリの後にcommitエントリが続いているため、その間に挿入する形となる。
docs_updateには拡張子として['.md', '.mdx']を設定し、CLAUDE.mdの「ドキュメント更新フェーズ」仕様に準拠する。
ci_verificationには拡張子として['.md']を設定し、CI検証結果の記録のみを許可するCLAUDE.md仕様に準拠する。
挿入後のPHASE_EXTENSIONSのフェーズ順序がCLAUDE.mdの定義と一致していることを目視確認する。

### 段階2：bash-whitelist.jsのBASH_BLACKLISTパターン修正（C-3）

bash-whitelist.jsの行90にある「{ pattern: '> ', type: 'contains' }」を「{ pattern: /(?<!=)> /, type: 'regex' }」に変更する。
否定後読み「(?<!=)」により、イコール記号の直後に続く「> 」をマッチ対象から除外し、アロー関数「=> 」の誤検出を防止する。
同時にmatchesBlacklistEntry関数（行258-283）のswitch文にregex型のcase分岐を追加する。
regex型の実装は「case 'regex': return entry.pattern.test(command);」の1行で完結する。
既存のcontains型、prefix型、awk-redirect型、xxd-redirect型の動作には一切影響しない。

### 段階3：phase-edit-guard.jsのPHASE_RULES修正（H-1a、H-1b、H-1c）

phase-edit-guard.jsのdocs_updateエントリ（行229-233）とcommitエントリ（行235-241）の間に3つのフェーズルールを追加する。
regression_testにはallowed: ['spec', 'test']、blocked: ['code', 'diagram', 'config', 'env', 'other']を設定する。
ci_verificationにはallowed: ['spec']、blocked: ['code', 'test', 'diagram', 'config', 'env', 'other']を設定する。
deployにはallowed: ['spec']、blocked: ['code', 'test', 'diagram', 'config', 'env', 'other']を設定する。
各エントリにはdescriptionとjapaneseName属性を含め、既存エントリの記述形式と統一する。

### 段階4：実装スクリプトの作成と実行

前タスクと同様に、フックファイルはワークフロー管理下のファイルであるため、直接編集ではなく修正スクリプト（fix-all.js）を作成して実行する。
スクリプトはdocs/workflows/ワ-クフロ-残存阻害要因C1-C3修正/ディレクトリに配置し、node -e "require('./path')"で実行する。
Windows環境のCRLF改行コードに対応するため、ファイル読み込み時に\r\nを\nに正規化してから文字列検索を行う。
スクリプトは各ファイルの修正前後の内容を検証し、修正が正しく適用されたことを確認するログを出力する。

## 変更対象ファイル

### workflow-plugin/hooks/enforce-workflow.js（C-1、C-2）

PHASE_EXTENSIONSオブジェクトの行74（e2e_testエントリ）の後に以下を挿入する。

修正前の該当箇所（行74-75）:
```javascript
  'e2e_test': ['.md', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'],
  'commit': [],
```

修正後の該当箇所:
```javascript
  'e2e_test': ['.md', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'],
  'docs_update': ['.md', '.mdx'],
  'ci_verification': ['.md'],
  'commit': [],
```

### workflow-plugin/hooks/bash-whitelist.js（C-3）

BASH_BLACKLIST配列の行90を変更し、matchesBlacklistEntry関数にregex型を追加する。

修正前の行90:
```javascript
  { pattern: '> ', type: 'contains' },
```

修正後の行90:
```javascript
  { pattern: /(?<!=)> /, type: 'regex' },
```

matchesBlacklistEntry関数への追加（行276のcontains caseの前に挿入）:
```javascript
    case 'regex':
      return entry.pattern.test(command);
```

### workflow-plugin/hooks/phase-edit-guard.js（H-1a、H-1b、H-1c）

PHASE_RULESオブジェクトのdocs_updateエントリ（行233）の後、commitエントリ（行235）の前に3エントリを挿入する。

修正前の該当箇所（行233-235）:
```javascript
  },
  commit: {
```

修正後の該当箇所:
```javascript
  },
  regression_test: {
    allowed: ['spec', 'test'],
    blocked: ['code', 'diagram', 'config', 'env', 'other'],
    description: 'リグレッションテスト中。テストファイルと仕様書の編集が可能。',
    japaneseName: 'リグレッションテスト',
  },
  ci_verification: {
    allowed: ['spec'],
    blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],
    description: 'CI検証中。仕様書のみ編集可能。',
    japaneseName: 'CI検証',
  },
  deploy: {
    allowed: ['spec'],
    blocked: ['code', 'test', 'diagram', 'config', 'env', 'other'],
    description: 'デプロイ中。仕様書のみ編集可能。',
    japaneseName: 'デプロイ',
  },
  commit: {
```

## 実装上の注意事項

フックファイルはNode.jsで直接実行されるため、TypeScriptのビルドプロセスは不要である。
ただしMCPサーバー側のdist/ファイルはNode.jsモジュールキャッシュの影響を受けるため、MCPサーバーの変更がある場合は再起動が必要となる。
今回の修正はフックファイルのみが対象であり、MCPサーバーのソースコード変更は含まれないため、サーバー再起動は不要である。
bash-whitelist.jsのregex型パターンでは否定後読み「(?<!=)」を使用するが、Node.js v10以降でサポートされており互換性の問題はない。
修正スクリプトではString.prototype.replaceを使用するが、置換対象が一意であることを事前に確認し、複数箇所の意図しない置換を防止する。

## テスト方針

各修正の検証はimplementationフェーズで作成する修正スクリプト内で行い、修正適用後に対象箇所の文字列を検索して期待値と一致することを確認する。
テスト対象のソースコードパスは workflow-plugin/mcp-server/src/validation/artifact-validator.ts および workflow-plugin/mcp-server/src/tools/test-tracking.ts を含む。
C-1の検証ではPHASE_EXTENSIONS内にdocs_updateキーが存在し、値に'.md'と'.mdx'が含まれることを確認する。
C-2の検証ではPHASE_EXTENSIONS内にci_verificationキーが存在し、値に'.md'が含まれることを確認する。
C-3の検証ではBASH_BLACKLIST内に「type: 'regex'」のエントリが存在し、matchesBlacklistEntry関数に「case 'regex'」が含まれることを確認する。
H-1a/H-1b/H-1cの検証ではPHASE_RULES内にregression_test、ci_verification、deployの各キーが存在することを確認する。
testingフェーズでは実際のコマンド実行による統合テストを行い、各フェーズでの期待動作を検証する。
