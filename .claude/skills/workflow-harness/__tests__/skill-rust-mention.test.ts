import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Resolve skill files relative to this test file. __dirname points to the
// __tests__ directory; the skill markdown files live one level up.
const skillsDir = path.resolve(__dirname, '..');

const RUST_PATTERN = /Rust|cargo|\.rs\b|Cargo\.toml/;

const TARGET_SKILLS = [
  'workflow-execution.md',
  'workflow-operations.md',
  'workflow-project-structure.md',
  'workflow-rules.md',
];

describe('AC-6: Rust polyglot mention in workflow-harness skills', () => {
  // TC-AC6-01: each skill must mention Rust|cargo|*.rs|Cargo.toml at least once.
  for (const fileName of TARGET_SKILLS) {
    it(`TC-AC6-01: ${fileName} contains a Rust/cargo reference`, () => {
      const filePath = path.join(skillsDir, fileName);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toMatch(RUST_PATTERN);
    });
  }

  describe('TC-AC6-02: workflow-rules.md Bash Categories includes cargo', () => {
    const rulesPath = path.join(skillsDir, 'workflow-rules.md');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // Extract the "Bash Categories" section: from the heading to the next
    // top-level heading or end of file.
    const bashCategoriesMatch = rulesContent.match(
      /##\s*\d*\.?\s*Bash Categories[\s\S]*?(?=\n##\s|\n#\s|$)/,
    );

    it('Bash Categories section is present', () => {
      expect(bashCategoriesMatch).not.toBeNull();
    });

    const bashSection = bashCategoriesMatch ? bashCategoriesMatch[0] : '';

    it('testing row contains cargo', () => {
      const testingRow = bashSection
        .split('\n')
        .find((line) => /^\|\s*testing\b/i.test(line.trim()));
      expect(testingRow, 'testing row not found in Bash Categories table').toBeDefined();
      expect(testingRow ?? '').toMatch(/cargo/);
    });

    it('implementation row contains cargo', () => {
      const implementationRow = bashSection
        .split('\n')
        .find((line) => /^\|\s*implementation\b/i.test(line.trim()));
      expect(
        implementationRow,
        'implementation row not found in Bash Categories table',
      ).toBeDefined();
      expect(implementationRow ?? '').toMatch(/cargo/);
    });
  });
});
