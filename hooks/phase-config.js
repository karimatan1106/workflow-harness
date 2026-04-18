'use strict';

// Bash: phase -> allowed command categories
const BASH_COMMANDS = {
  // cd: shell builtin for directory navigation; no file-system side effects
  readonly: ['cd'],
  testing: [
    'npm test', 'npm run test', 'npx vitest', 'npx jest',
    'npx playwright', 'pytest', 'node --test',
  ],
  // includes read-only inspection commands needed to verify before push
  git: ['git add', 'git commit', 'git push', 'git tag', 'git status', 'git log', 'git show', 'git branch', 'git diff', 'git check-ignore'],
  security: [
    'npm audit', 'npx audit-ci', 'detect-secrets', 'semgrep',
    'npx snyk', 'trivy', 'gitleaks',
  ],
};

const PHASE_BASH = {
  scope_definition: ['readonly'], research: ['readonly'], impact_analysis: ['readonly'],
  requirements: ['readonly'], threat_modeling: ['readonly'], planning: ['readonly'],
  state_machine: ['readonly'], flowchart: ['readonly'], ui_design: ['readonly'],
  design_review: ['readonly'], test_design: ['readonly'], test_selection: ['readonly'],
  code_review: ['readonly'], manual_test: ['readonly'], acceptance_verification: ['readonly'],
  docs_update: ['readonly'], ci_verification: ['readonly'], deploy: ['readonly'],
  health_observation: ['readonly'],
  test_impl: ['readonly', 'testing'], implementation: ['readonly', 'testing'],
  refactoring: ['readonly', 'testing'], build_check: ['readonly', 'testing'],
  testing: ['readonly', 'testing'], regression_test: ['readonly', 'testing'],
  performance_test: ['readonly', 'testing'], e2e_test: ['readonly', 'testing'],
  security_scan: ['readonly', 'testing', 'security'],
  commit: ['readonly', 'git'], push: ['readonly', 'git'],
};

// Write/Edit: phase -> allowed extensions
const PHASE_EXT = {
  scope_definition:        ['.md'],
  research:                ['.md'],
  impact_analysis:         ['.md'],
  requirements:            ['.md'],
  threat_modeling:         ['.md'],
  planning:                ['.md'],
  design_review:           ['.md'],
  test_design:             ['.md'],
  test_selection:          ['.md'],
  code_review:             ['.md'],
  manual_test:             ['.md'],
  acceptance_verification: ['.md'],
  docs_update:             ['.md'],
  ci_verification:         ['.md'],
  deploy:                  ['.md'],
  health_observation:      ['.md'],
  security_scan:           ['.md'],
  performance_test:        ['.md'],
  state_machine:           ['.md', '.mmd'],
  flowchart:               ['.md', '.mmd'],
  ui_design:               ['.md', '.mmd'],
  testing:                 ['.md', '.ts', '.tsx', '.js'],
  regression_test:         ['.md', '.ts', '.tsx', '.js'],
  test_impl:               ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.md'],
  implementation:          ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.html', '.md', '.py', '.go', '.rs', '.java', '.yml', '.yaml', '.toml', '.env', '.sh'],
  refactoring:             ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.test.ts', '.spec.ts', '.py', '.go', '.rs', '.java', '.md'],
  e2e_test:                ['.md', '.test.ts', '.spec.ts'],
  build_check:             null,
  commit:                  null,
  push:                    null,
  completed:               null,
};

module.exports = { BASH_COMMANDS, PHASE_BASH, PHASE_EXT };
