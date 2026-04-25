# E2E Test Report: prompt-format-hybrid-v2

task: prompt-format-hybrid-v2
phase: e2e_test
date: 2026-03-28
target: .claude/skills/workflow-harness/workflow-delegation.md

## E2Eテストシナリオ

These scenarios verify that prompts constructed following the new Prompt Format Rules produce valid, well-structured delegation inputs. Since this is a documentation-only change, E2E testing validates the rules themselves against sample prompt construction rather than executing runtime code.

### Scenario 1: Agent delegation prompt follows TOON+Markdown hybrid

Objective: Construct a sample Agent delegation prompt using the rules and verify it produces valid hybrid format.

Steps:
1. Read Prompt Format Rules bullet 1: "Agent delegation: top-level keys in TOON (Task, Why, Context, What, How, Constraints), inner content in Markdown"
2. Construct a sample prompt with TOON top-level keys and Markdown body content
3. Verify top-level keys use TOON format (key: value, no Markdown heading syntax)
4. Verify inner content uses Markdown (-, 1., indentation)
5. Verify blank lines separate top-level keys (per bullet 4: section separator rule)

Sample constructed prompt:
```
Task: Implement input validation for user registration form

Why: Current form accepts malformed email addresses, causing downstream processing errors

Context:
- File: src/components/RegisterForm.ts (142 lines)
- Existing validation covers name and password fields
- Email field has no validation beyond required check

What:
1. Add email format validation using regex pattern
2. Add error message display below email field
3. Integrate with existing validation framework

Constraints:
- File must remain under 200 lines after changes
- No new dependencies allowed
- Error messages in Japanese
```

Result: PASS. The constructed prompt correctly uses TOON keys at top level (Task, Why, Context, What, Constraints) with Markdown content (-, 1., indentation) inside each section. Blank lines separate each top-level key.

### Scenario 2: MCP short param follows plain text rule

Objective: Verify that MCP short parameters (summary, evidence) follow the single-sentence plain text rule.

Steps:
1. Read Prompt Format Rules bullet 2: "MCP short params (summary, evidence): single-sentence plain text, no newlines"
2. Construct sample MCP call with summary parameter
3. Verify summary is a single sentence with no line breaks, no Markdown formatting

Sample constructed MCP call:
```
harness_record_proof(
  summary: "All 5 manual test scenarios passed verifying Prompt Format Rules section placement and content"
)
```

Verification checks:
- Single sentence: yes (one complete thought ending with no line break)
- No Markdown formatting: yes (no bullets, headers, bold, or code fences)
- No newlines: yes (fits on one logical line)

Result: PASS. The short param follows plain text convention without any Markdown or TOON contamination.

### Scenario 3: MCP long param follows hybrid rule

Objective: Verify that MCP long parameters (instruction, output) follow hybrid format (TOON top-level + Markdown body).

Steps:
1. Read Prompt Format Rules bullet 3: "MCP long params (instruction, output): hybrid format (TOON top-level + Markdown body)"
2. Construct sample MCP call with instruction parameter using hybrid format
3. Verify top-level structure uses TOON keys
4. Verify body content uses Markdown

Sample constructed MCP call:
```
harness_delegate_work(
  instruction: "
Task: Write unit tests for email validation

Context:
- Source: src/components/RegisterForm.ts
- Test framework: vitest
- Existing test file: src/components/RegisterForm.test.ts

What:
1. Test valid email formats (standard, subdomain, plus addressing)
2. Test invalid email formats (missing @, missing domain, double dots)
3. Test edge cases (empty string, whitespace only, maximum length)

Constraints:
- Each test case uses descriptive Japanese test names
- No mocking of external services
"
)
```

Verification checks:
- Top-level keys in TOON: yes (Task, Context, What, Constraints)
- Inner content in Markdown: yes (-, 1., indentation)
- Section separators: yes (blank lines between top-level keys)
- Format consistent with bullet 3 rule: yes

Result: PASS. The long param correctly uses hybrid TOON+Markdown format, consistent with the Prompt Format Rules specification.

## テスト実行結果

| Scenario | Target Rule | Result | Notes |
|----------|------------|--------|-------|
| 1. Agent delegation | Bullets 1, 4 | PASS | TOON keys + Markdown body + blank separators all correct |
| 2. MCP short param | Bullet 2 | PASS | Single-sentence plain text, no formatting contamination |
| 3. MCP long param | Bullet 3 | PASS | Hybrid format matches specification exactly |

All 3 scenarios confirm the Prompt Format Rules are clear, unambiguous, and produce valid prompt structures when followed. The rules cover the three main delegation pathways (Agent, MCP short, MCP long) without conflict or overlap.

## decisions

- hybrid-format-validity: rules produce correct TOON+Markdown structure -- sample prompts constructed from rules match expected format without ambiguity
- short-param-clarity: plain text rule is unambiguous -- "single-sentence, no newlines" leaves no room for misinterpretation
- long-param-consistency: hybrid rule aligns with Agent delegation format -- both use TOON top-level + Markdown body, reducing cognitive overhead
- separator-rule: blank line convention is standard and clear -- consistent with existing Markdown section separation practice
- threshold-rule: 20-line file reference rule is testable -- provides a concrete numeric threshold rather than subjective judgment
- contamination-guard: Format constraint in Common Constraints reinforces separation -- dual placement (rules section + constraints) provides defense in depth

## artifacts

- tested-file: .claude/skills/workflow-harness/workflow-delegation.md (lines 118-135)
- test-method: constructive validation (build prompts from rules, verify correctness)
- scenarios-executed: 3
- scenarios-passed: 3

## next

- All Stage 7 verification phases complete
- Ready for acceptance review
