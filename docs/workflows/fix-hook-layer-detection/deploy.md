# Deploy Plan — fix-hook-layer-detection

## summary

This is a tooling-layer fix, not a production service deploy. Hook scripts execute on every Claude Code tool invocation, so the patched `detectLayer` behavior becomes active the instant the edited files are on disk in a given clone. There is no build pipeline, no artifact publication, no container image, and no service restart. "Deploy" in this context reduces to publishing commits: push the submodule `workflow-harness` main branch to origin, then push the parent repository `feature/v2-workflow-overhaul` branch to origin so that the submodule pointer resolves on the remote. All local commits are staged and verified; the operation is awaiting explicit user authorization before push.

## deploy plan

1. Push submodule first: from `C:/ツール/Workflow/workflow-harness/`, run `git push origin main`. This publishes commit `72589cf` containing the hook logic fix so the parent pointer has a valid remote target.
2. Push parent next: from `C:/ツール/Workflow/`, run `git push origin feature/v2-workflow-overhaul`. This publishes parent commits `0dc99e8` and `87a2e77`, which include the submodule pointer bump and any parent-side wiring.
3. Verify on GitHub: open the parent PR/branch page, confirm submodule pointer link is clickable and resolves (no "unknown commit" warning), confirm both commit hashes appear in the branch history, and spot-check the diff against the local `git log`.

## rollback plan

Rollback is commit-based and does not require data migration — the change only affects hook script behavior at tool-call time.

- Parent rollback: `git revert 87a2e77 0dc99e8` on `feature/v2-workflow-overhaul`, then `git push origin feature/v2-workflow-overhaul`.
- Submodule rollback: `git revert 72589cf` on `workflow-harness/main`, then `git push origin main`.
- After revert, `detectLayer` returns to its earlier heuristic and any downstream clones pick up the reverted hook on their next `git pull` + submodule sync. No state file cleanup, no schema migration, no cache invalidation is needed.

## decisions

- D-001: push authorization pending — local commits ready on both parent and submodule, waiting on the user to confirm before any remote write occurs.
- D-002: deploy equals push — there is no separate artifact pipeline, package registry upload, or environment promotion for this repository's hook layer.
- D-003: submodule must be pushed before parent, otherwise CI and cloners resolving the parent pointer will hit "commit not found" on the submodule remote.
- D-004: rollback is handled via `git revert` on the relevant hashes; no data migration is required because hooks are pure logic with no persistent state of their own.
- D-005: hooks take effect immediately after the file write reaches disk — Claude Code re-invokes the hook script on each tool call, so no service restart or process reload step is part of the deploy.
- D-006: verification is GitHub-side manual inspection (branch view + submodule link click) rather than an automated smoke test, because the fix surfaces only inside interactive Claude Code sessions.

## artifacts

Commit hashes in push order:

1. Submodule `workflow-harness` main: `72589cf` — hook layer detection logic fix inside `detectLayer`.
2. Parent `feature/v2-workflow-overhaul`: `0dc99e8` — submodule pointer bump picking up `72589cf`.
3. Parent `feature/v2-workflow-overhaul`: `87a2e77` — follow-up parent-side wiring tied to the corrected layer detection.

## next

- Obtain explicit user authorization to push both remotes.
- Execute the two `git push` commands in the order above.
- Verify the GitHub branch and submodule pointer link resolves cleanly.
- Approve the remaining acceptance criteria for this task.
- Retire the task via the harness once acceptance is green.
