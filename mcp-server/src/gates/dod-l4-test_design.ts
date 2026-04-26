/**
 * DoD L4 test_design: TC-ID format validation
 * Accepts both TC-AC<N>-<NN> (current naming) and TC-<N>-<NN> (legacy compatibility).
 * Rejects non-numeric AC parts such as TC-A-01.
 * @spec docs/spec/features/workflow-harness.md
 */

export const TC_ID_REGEX = /^TC-(?:AC)?\d+-\d+$/;
