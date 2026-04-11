# ADR-001: L5(LLM判断)ゲート禁止

Status: accepted
Date: 2026-03-01

## Context
ワークフローハーネスのDoDゲートにLLM判断（L5）を使うべきか検討した。

## Decision
L5(LLM判断)をゲートに使用しない。L1-L4の決定的チェックのみ許可する。
- L1: file_exists
- L2: exit_code
- L3: numeric_threshold
- L4: regex_match

## Rationale
PSC-5原則: 検証容易性 = 改善能力。
- LLM判断は非決定的 → 同じ入力で異なる結果
- 再現不可 → デバッグ不可 → 改善不可 → 品質劣化
- 決定的ゲートは常に再現可能で、失敗原因を特定できる

## Consequences
- ゲートの表現力はL1-L4に制限される
- L5が必要に見えるチェックはL3/L4に分解して実装する
- 「良い設計か」等の主観的判断はゲートに含めない
