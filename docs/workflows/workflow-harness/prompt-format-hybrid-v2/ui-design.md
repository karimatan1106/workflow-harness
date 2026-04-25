# UI Design: Prompt Format Hybrid v2

taskId: prompt-format-hybrid-v2
phase: ui_design

## インターフェース一覧

This task modifies a skill file read by orchestrators and agents. The "UI" is the interface between the orchestrator layer and its subagents, defined by prompt format conventions. Three interfaces are affected:

| Interface ID | Name | Producer | Consumer |
|-------------|------|----------|----------|
| IF-01 | Agent delegation prompt format | Orchestrator | coordinator / worker |
| IF-02 | MCP parameter format | Orchestrator | MCP server tools |
| IF-03 | Format contamination guard | All agents | DoD validation gate |

## Agent委譲プロンプトインターフェース

IF-01 governs how orchestrators construct delegation prompts for subagents.

Current state: Templates A/B/C define Why/What/How/Constraints structure but do not specify the textual format of the prompt body itself.

After change: A new "Prompt Format Rules" section will provide explicit guidance:
- Top-level keys (Task, Why, What, How, Constraints) use plain text without Markdown heading markers
- Internal state files use TOON format
- Deliverable artifacts use Markdown format
- Long prompts (20+ lines) insert blank line separators between logical sections

Input specification:
  - Orchestrator reads workflow-delegation.md at delegation time
  - Phase name and taskId are injected into template placeholders
  - Format rules apply uniformly across all three template variants

Output specification:
  - Subagent receives a prompt conforming to the key-value structure
  - No Markdown heading syntax (##) appears within the prompt body sent to agents
  - Section boundaries are indicated by blank lines, not heading markers

## MCPパラメータインターフェース

IF-02 governs how MCP tool parameters are formatted when called by orchestrators or agents.

Current state: No explicit guidance exists for MCP parameter formatting conventions.

After change: The format rules section will specify:
- Short parameters (labels, identifiers, single values) use single-line format
- Long parameters (descriptions, multi-step instructions, body content) use multi-line format
- Parameter values follow the same TOON/Markdown split as other outputs

Input specification:
  - MCP tool schema defines parameter names and types
  - Orchestrator constructs parameter values according to format rules

Output specification:
  - Single-line parameters contain no embedded newlines
  - Multi-line parameters use consistent indentation within the value block
  - Format selection (short vs long) is determined by content length and semantic role

## 検証基準

Validation criteria for each interface:

IF-01 validation:
  - Delegation prompts generated after this change must not contain ## markers inside the prompt body
  - Top-level keys must appear as plain text followed by colon
  - TOON format used for .toon outputs, Markdown for .md outputs

IF-02 validation:
  - MCP parameters with fewer than 80 characters use single-line format
  - MCP parameters with structured content or multiple sentences use multi-line format
  - No format contamination between parameter input and output

IF-03 validation:
  - An agent receiving TOON-formatted input must still produce Markdown output when the spec requires Markdown
  - An agent receiving Markdown-formatted input must still produce TOON output when the spec requires TOON
  - The contamination guard line appears in the Common Constraints section

## decisions

- three interfaces identified: covers agent prompts, MCP params, and contamination guard -- matches the three distinct communication channels affected by format rules
- no visual mockup needed: all interfaces are text-based agent-to-agent communication -- visual design is not applicable to LLM prompt formatting
- format contamination as separate interface: elevates prevention to first-class concern -- input/output format independence is the core motivation for this task
- 80-character threshold for MCP short vs long: aligns with common terminal width convention -- provides concrete cutoff rather than subjective judgment
- blank line separators over heading markers: avoids Markdown syntax leaking into non-Markdown contexts -- maintains format purity across agent boundaries

## artifacts

- interfaceList: 3 interfaces (IF-01, IF-02, IF-03) with producer/consumer mapping
- validationCriteria: concrete checks for each interface

## next

- phase: design_review
- input: interface definitions from this document feed into AC-to-design mapping
