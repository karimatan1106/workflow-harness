# Documentation Layers (→ ADR-004, ADR-005)

HowをCLAUDE.mdに書くとコードと乖離し二重管理になる。Howはコードかスキルファイルが担う。

判定基準(LLM目線): LLMに選択の余地を与えるか、与えないか。
- Why = この判断に従う理由。覆すな → docs/adr/ADR-NNN.md（イミュータブル）
- What = 達成すべきゴール。手段はLLMが選ぶ → .claude/rules/、requirements
- How = この手段を使え。LLMの裁量なし → スキルファイル、コード、planning
- 新ルール追加時: ADR（Why）を必ず作成。Whyなきルールは追加しない。
