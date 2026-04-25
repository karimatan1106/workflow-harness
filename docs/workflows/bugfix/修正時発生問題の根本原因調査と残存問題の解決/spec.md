# 修正時発生問題の根本原因調査と残存問題の解決 - 仕様書

## サマリー

本仕様書は、前回タスクのparallel_verificationフェーズで発生した問題のうち、コード修正が必要な2件の実装仕様を定義するものである。
対象ファイルはworkflow-plugin/mcp-server/src/phases/definitions.ts（security_scanテンプレートへのNG/OK例追記）とworkflow-plugin/mcp-server/src/tools/status.ts（phaseGuideレスポンスの重量フィールド除外）の2ファイルである。
definitions.tsの修正はテンプレート文字列リテラルへの追記のみでロジック変更は不要であり、status.tsの修正はresolvePhaseGuideの戻り値からsubagentTemplate・content・claudeMdSectionsをdestructuringで取り除く実装を採用する。
両ファイルの変更後はnpm run buildでコンパイルし、MCPサーバーを再起動することが必須である。

- 目的: 前回タスクのparallel_verificationフェーズで発生した問題のうち、コード修正が必要な2件（definitions.tsのsecurity_scanテンプレート修正・status.tsのレスポンス削減）の実装仕様を定義する
- 主要な決定事項: security_scanテンプレートへの重複行回避ガイダンス強化はテンプレート文字列の追記のみ、status.tsのレスポンス削減はphaseGuideオブジェクトのdestructuringによる除外フィールド制御の2点を採用する
- 変更対象ファイル: workflow-plugin/mcp-server/src/phases/definitions.ts（918行目のsecurity_scan.subagentTemplate）とworkflow-plugin/mcp-server/src/tools/status.ts（122〜127行目のphaseGuide設定箇所）の2ファイル
- MCP再起動: 両ファイルの変更後にnpm run buildでコンパイルし、MCPサーバーを再起動することが必須
- 次フェーズで必要な情報: 変更箇所の具体的な行番号、追記するテンプレート文字列のNG/OK例の文言、status.tsの除外ロジックの実装方法

## 概要

本タスクで対処する問題は2件あり、いずれも前回のparallel_verificationフェーズで顕在化した構造的な課題である。
1件目はsecurity_scanサブフェーズの成果物で発生する重複行エラーの予防強化であり、評価結論フレーズに特化したNG/OK例をテンプレートに追記することで対応する。
2件目はworkflow_statusが返すレスポンスのサイズ過大問題であり、status.tsのphaseGuide設定ロジックを修正して重量フィールドを除外することで対応する。
これらの修正は独立しており、どちらか一方のみを先に実施することも可能だが、まとめて実施した後に一度だけMCPサーバーを再起動する方が効率的である。

### 修正対象の問題

1件目の問題は、複数の評価対象（BUG-A・BUG-Bなど）を「評価結果: リスクなし」のような短い評価結論行で記述すると、3件以上同一行が並んだ時点でartifact-validatorがエラーを返すという構造にある。現在のsecurity_scanテンプレートには評価対象名の固有識別子を含めてそれぞれの行を一意にするよう促すNG/OK例が記載されているが、「評価結果: XXX」「判定: 問題なし」「結論: 合格」のような評価結論フレーズに特化した例示が不足している点が根本原因である。

2件目の問題は、workflow_statusが返すphaseGuideにsubagentTemplateとcontentというサイズの大きなフィールドが含まれていることである。subagentTemplateは5000〜10000文字程度の大容量テキストで、parallel_verificationフェーズでは4サブフェーズ分が含まれ合計40000文字を超える。status.tsの122〜127行目でphaseGuideをそのままresult.phaseGuideにセットしているため、全フィールドがレスポンスに含まれる状態となっている。

### 修正方針の技術的根拠

definitions.tsの修正については、テンプレート文字列リテラルの追記のみで対応できるためバリデーターのロジック変更は不要である。status.tsの修正については、resolvePhaseGuideの戻り値からsubagentTemplate、content、claudeMdSectionsをdestructuringで取り除いたうえでresult.phaseGuideにセットする方法を採用する。next.tsの同様の処理は変更しないことで後方互換性を維持する。

## 実装計画

本仕様書で定義する実装は2件のファイル変更から構成されており、definitions.tsへのテンプレート追記とstatus.tsのレスポンス削減ロジックの追加を順番に実施する。
実装の順序としては、まずdefinitions.tsのテンプレート文字列を修正し、続いてstatus.tsのphaseGuide設定ブロックを変更し、最後にnpm run buildでコンパイルしてMCPサーバーを再起動する。
各修正は独立しているため、どちらから着手しても問題はないが、最後に必ず一度だけビルドと再起動を実施すること。
ビルド成功後はworkflow_statusを呼んでphaseGuideのレスポンスにsubagentTemplateが含まれないことを確認し、workflow_nextを呼んでsubagentTemplateが引き続き含まれることを確認する。
この2点の確認が完了した時点で本タスクの実装は完了となる。

### 修正1: definitions.ts — security_scanテンプレートへのガイダンス追記

対象の918行目にあるsubagentTemplateのテンプレート文字列中の「## 重複行回避の注意事項」セクションに、評価結論フレーズに特化したNG/OK例を追記する。

現在の重複行回避セクションには「FR番号・ファイル名・関数名などの固有識別子を含めて行を一意にすること」および「問題なし」単独行のNGパターンは記述されているが、「評価結果: リスクなし」「判定: 問題なし」「結論: 合格」のような評価結論フレーズが3件以上繰り返されるパターンの警告が不足している。

追記する内容の具体的な文言は以下のコードブロックに示す通りである。

```
複数の修正点（BUG-A・BUG-B・BUG-Cなど）に対して同一の評価結論フレーズを繰り返す場合は特に注意が必要である。「評価結果: リスクなし」「判定: 問題なし」「結論: 合格」のような評価結論行が3件以上並ぶと重複行エラーが発生する。各評価行には修正点を一意に特定できる識別子（BUG番号・ファイル名・関数名・行番号等）と判断根拠の要点を必ず含めること。
- NG: 「- 評価結果: リスクなし」をBUG-1・BUG-2・BUG-3で繰り返す（3回以上の同一行でエラー）
- NG: 「- 判定: 問題なし」「- 結論: 合格」のような評価結論行の3件以上の繰り返し
- OK: 「- BUG-1（definitions.ts importantSection追記）の評価: リスクなし、テンプレート文字列のみの変更でロジック非変更のため」
- OK: 「- BUG-2（flowchart丸括弧制約）の評価: リスクなし、生成物フォーマット制約の追加のみで機能変更なし」
```

この文言をsecurity_scanテンプレートの「## 重複行回避の注意事項」セクションの末尾、既存のNGパターン例の後に追記する。追記後のテンプレート文字列内の当該セクションは以下のような構造になる。

```
## 重複行回避の注意事項\n
複数のFRや評価対象を同一フォーマットで評価する場合、各評価行に対象のFR番号・ファイル名・関数名などの固有識別子を含めて行を一意にすること。完全一致する行が3回以上出現するとartifact-validatorが重複行エラーを返す。「問題なし」「リスクなし」のような短い評価結論を単独で3件以上繰り返さず、各行に評価対象の具体名と判断根拠を付記すること。\n
- NG: 「- セキュリティリスク: 問題なし」をFR-A・FR-B・FR-Cで繰り返す（3回以上の同一行でエラー）\n
- OK: 「- FR-A（state_machine定義）のセキュリティリスク: 問題なし、入力値はMCPサーバー内部でのみ使用」\n
- OK: 「- FR-B（flowchart定義）のセキュリティリスク: 問題なし、外部入力の関与なし」\n
複数の修正点（BUG-A・BUG-B・BUG-Cなど）に対して同一の評価結論フレーズを繰り返す場合は特に注意が必要である。「評価結果: リスクなし」「判定: 問題なし」「結論: 合格」のような評価結論行が3件以上並ぶと重複行エラーが発生する。各評価行には修正点を一意に特定できる識別子（BUG番号・ファイル名・関数名・行番号等）と判断根拠の要点を必ず含めること。\n
- NG: 「- 評価結果: リスクなし」をBUG-1・BUG-2・BUG-3で繰り返す（3回以上の同一行でエラー）\n
- NG: 「- 判定: 問題なし」「- 結論: 合格」のような評価結論行の3件以上の繰り返し\n
- OK: 「- BUG-1（definitions.ts importantSection追記）の評価: リスクなし、テンプレート文字列のみの変更でロジック非変更のため」\n
- OK: 「- BUG-2（flowchart丸括弧制約）の評価: リスクなし、生成物フォーマット制約の追加のみで機能変更なし」\n
```

### 修正2: status.ts — phaseGuideレスポンスからの重量フィールド除外

status.tsの121〜127行目のphaseGuide設定ロジックを変更する。現在の実装は以下の通りである。

```typescript
// 変更前（121〜127行目付近）
if (phase !== 'idle' && phase !== 'completed') {
  const phaseGuide = resolvePhaseGuide(phase, taskState.docsDir, taskState.userIntent);
  if (phaseGuide) {
    result.phaseGuide = phaseGuide;
  }
}
```

変更後の実装では、phaseGuideオブジェクトからsubagentTemplate、content、claudeMdSectionsの3フィールドを除外し、さらにsubPhasesの各エントリからも同じ3フィールドを除外する。実装方法として、シャローコピーとdelete演算子の組み合わせを使用する。

```typescript
// 変更後（121〜127行目付近）
if (phase !== 'idle' && phase !== 'completed') {
  const phaseGuide = resolvePhaseGuide(phase, taskState.docsDir, taskState.userIntent);
  if (phaseGuide) {
    // workflow_statusではサイズの大きなフィールドを除外してレスポンスを削減する
    // workflow_nextには引き続き全フィールドを含めることで後方互換性を維持する
    const { subagentTemplate: _st, content: _c, claudeMdSections: _cms, ...slimGuide } = phaseGuide;
    // サブフェーズのsubagentTemplateとcontentも除外する
    if (slimGuide.subPhases) {
      for (const subPhase of Object.values(slimGuide.subPhases)) {
        const sub = subPhase as Record<string, unknown>;
        delete sub['subagentTemplate'];
        delete sub['content'];
        delete sub['claudeMdSections'];
      }
    }
    result.phaseGuide = slimGuide as typeof phaseGuide;
  }
}
```

この変更により、workflow_statusのレスポンスにはphaseName・description・requiredSections・outputFile・allowedBashCategories・minLines等のメタ情報のみが含まれるようになる。subagentTemplateとcontentとclaudeMdSectionsはworkflow_nextのレスポンスには引き続き含まれるため、Orchestratorの動作フローは変更なしで継続できる。

### TypeScriptの未使用変数エラーへの対応

上記のdestructuring記法では、`_st`・`_c`・`_cms` という未使用変数が生成される。TypeScriptのstrict modeでは未使用変数がエラーとなる可能性がある。この場合の対処法として、以下の代替実装を使用する。

```typescript
// 代替実装（delete演算子を使用してTypeScript未使用変数エラーを回避する）
if (phase !== 'idle' && phase !== 'completed') {
  const phaseGuide = resolvePhaseGuide(phase, taskState.docsDir, taskState.userIntent);
  if (phaseGuide) {
    const slimGuide = { ...phaseGuide } as Record<string, unknown>;
    delete slimGuide['subagentTemplate'];
    delete slimGuide['content'];
    delete slimGuide['claudeMdSections'];
    if (slimGuide['subPhases'] && typeof slimGuide['subPhases'] === 'object') {
      for (const subPhase of Object.values(slimGuide['subPhases'] as Record<string, unknown>)) {
        if (subPhase && typeof subPhase === 'object') {
          const sub = subPhase as Record<string, unknown>;
          delete sub['subagentTemplate'];
          delete sub['content'];
          delete sub['claudeMdSections'];
        }
      }
    }
    result.phaseGuide = slimGuide as typeof phaseGuide;
  }
}
```

実装フェーズではビルドエラーが発生した場合、代替実装を採用すること。

## 変更対象ファイル

本タスクで変更するファイルは2件であり、いずれもworkflow-plugin/mcp-server/src/以下のTypeScriptソースファイルである。
変更後はトランスパイルが必要であり、dist/以下のJavaScriptファイルを更新しなければMCPサーバーに修正が反映されない。
MCPサーバーはNode.jsのモジュールキャッシュにより起動時に読み込んだバイナリを使用し続けるため、ディスク上のファイル更新後にプロセス再起動が必須となる。
以下に各ファイルの変更箇所と変更の種類を記載する。
変更しないファイルについても明示しており、後方互換性の維持と変更範囲の最小化を方針として採用している。

### 変更対象1: definitions.ts

- ファイルパス: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 変更箇所: 918行目のsecurity_scan.subagentTemplateフィールドの文字列リテラル
- 変更内容: 「## 重複行回避の注意事項」セクションの末尾に評価結論フレーズのNG/OK例を追記する
- 変更の種類: 文字列リテラルの追記のみ（ロジック変更なし）
- ビルド必要性: ソースコード変更のためnpm run buildが必要

### 変更対象2: status.ts

- ファイルパス: `workflow-plugin/mcp-server/src/tools/status.ts`
- 変更箇所: 121〜127行目のphaseGuide設定ブロック
- 変更内容: resolvePhaseGuideの戻り値からsubagentTemplate・content・claudeMdSectionsを除外してresult.phaseGuideにセットする
- 変更の種類: ロジック変更（後方互換性あり、next.tsは変更しない）
- ビルド必要性: ソースコード変更のためnpm run buildが必要

### 変更しないファイル

- `workflow-plugin/mcp-server/src/tools/next.ts`: workflow_nextのレスポンスは変更しない。Orchestratorがsubagentテンプレートを取得するために必要なsubagentTemplateフィールドは引き続き含める。
- `workflow-plugin/mcp-server/src/phases/artifact-validator.ts`: バリデーターのロジックは変更しない。テンプレート文字列の修正で対応できるため変更不要。
- `workflow-plugin/hooks/enforce-workflow.js`: BUG-3の修正は既に完了している。

## テスト方法と検証手順

### 修正1の検証手順

修正1（definitions.tsのテンプレート追記）の動作確認は、workflow_nextを呼んでsecurity_scanフェーズのphaseGuide.subPhases.security_scan.subagentTemplateを確認することで行う。

検証ステップは以下の通りである。まずnpm run buildでコンパイルし、MCPサーバーを再起動する。次に、parallel_verificationフェーズにあるタスクでworkflow_nextを呼び、レスポンス内のphaseGuide.subPhases.security_scan.subagentTemplateに「BUG番号」「評価結論フレーズ」「NG/OK例」の文字列が含まれていることを目視確認する。

追記した文言が正しく展開されていれば、security_scanフェーズのsubagentはテンプレートから評価結論フレーズの重複回避指示を受け取ることができる状態となっている。

### 修正2の検証手順

修正2（status.tsのレスポンス削減）の動作確認は、workflow_statusを呼んで戻り値のJSONサイズを確認することで行う。

検証ステップは以下の通りである。まずnpm run buildでコンパイルし、MCPサーバーを再起動する。次に、parallel_verificationフェーズのタスクでworkflow_statusを呼び、レスポンスJSONの文字数を確認する。phaseGuideフィールドにsubagentTemplateが含まれないこと、contentフィールドが含まれないこと、claudeMdSectionsフィールドが含まれないことをJSON構造で確認する。

同時に、workflow_nextを呼んだレスポンスにはsubagentTemplateが引き続き含まれることを確認する。この確認によってworkflow_nextの後方互換性が維持されていることを検証できる。

### MCP再起動が必要なタイミング

definitions.tsとstatus.tsのどちらか一方でも変更した場合、変更が有効になるためにはMCPサーバーの再起動が必須である。Node.jsのモジュールキャッシュ機構により、ディスク上のdist/以下のファイルを変更しても実行中のMCPサーバーには反映されない。

再起動の手順は以下の通りである。まず`cd workflow-plugin/mcp-server && npm run build`を実行してTypeScriptファイルをdist/以下にトランスパイルする。次にClaude Desktopのサーバー再起動ボタンまたはプロセス終了によりMCPサーバーを再起動する。再起動後にworkflow_statusを実行して現在のフェーズが正しく返ることを確認し、同フェーズから作業を再開する。

この再起動を怠った場合、変更前の古いバイナリがモジュールキャッシュとして使用され続けるため、修正の効果が現れない。
