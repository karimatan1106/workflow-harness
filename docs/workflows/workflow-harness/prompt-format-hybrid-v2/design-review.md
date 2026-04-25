# Design Review: Prompt Format Hybrid v2

taskId: prompt-format-hybrid-v2
phase: design_review

## acDesignMapping

| AC | Design Element | Coverage |
|----|---------------|----------|
| AC-1 | F-001: Prompt Format Rules section heading with TOON and Markdown format references | Full - section defines both format contexts |
| AC-2 | F-002: Agent delegation top-level key structure + F-003: MCP short/long parameter rules | Full - two specs cover both communication channels |
| AC-3 | F-004: Contamination prevention line added to Common Constraints section | Full - constraint enforces format independence at template level |
| AC-4 | F-005: 20-line threshold for long prompts + blank line separator requirement | Full - concrete threshold and separator mechanism specified |
| AC-5 | F-006: Line count verification ensuring file stays at or below 200 lines | Full - wc -l check as final implementation step |

## 設計カバレッジ分析

All 5 acceptance criteria map to at least one F-NNN specification:
- AC-1 is addressed by a single spec (F-001) because the section heading is a discrete verifiable artifact
- AC-2 requires two specs (F-002 and F-003) because agent delegation and MCP parameters are distinct interfaces with different formatting needs
- AC-3 maps to F-004 which adds a single constraint line, a focused change with clear verification
- AC-4 maps to F-005 covering two related concepts (threshold and separator) in one rule
- AC-5 maps to F-006 as a quantitative gate check

No acceptance criteria are left unmapped. No F-NNN specs exist without a corresponding AC.

Coverage matrix: 5 ACs covered by 6 F-NNN specs. The ratio of specs to ACs is 1.2, indicating each AC has focused implementation without excessive fragmentation.

## 設計品質評価

Simplicity: The design adds 11 lines to a single file. No new files, modules, or dependencies are introduced. The change is self-contained within workflow-delegation.md.

Consistency: The new section follows the same H2 heading convention used by existing sections (Phase Parameter Table, Common Constraints). Bullet formatting matches the existing Common Constraints style.

Reversibility: The entire change can be reverted with a single git revert. No downstream artifacts depend on the new section at initial deployment.

Maintainability: Format rules are co-located with the delegation templates they govern. Future rule additions follow the same bullet pattern without structural changes.

Risk assessment: The threat model confirmed all STRIDE categories at LOW or N/A. The planning phase verified line count stays under the 200-line constraint. No behavioral changes to existing templates.

## decisions

- one-to-many AC mapping for AC-2: two F-NNN specs needed because agent prompts and MCP parameters have distinct format requirements -- avoids conflating different interface concerns
- design coverage ratio of 1.2: acceptable because the slight over-specification improves verifiability -- each AC has at most 2 specs to check
- no architectural diagrams: single-file text change does not warrant component or sequence diagrams -- complexity does not justify the overhead
- co-location of format rules with templates: keeps rules adjacent to the content they govern -- reduces cognitive distance for future maintainers
- quantitative gate for AC-5: wc -l provides objective pass/fail -- eliminates subjective line count estimation

## artifacts

- acDesignMapping: 5 ACs mapped to 6 F-NNN specs with full coverage
- designQuality: simplicity, consistency, reversibility, maintainability assessed

## next

- phase: test_design
- input: AC-to-design mapping feeds directly into TC definition for each AC
