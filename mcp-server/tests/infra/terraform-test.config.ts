/**
 * N-71: Terraform test + Terratest configuration (scaffold).
 * Requires terraform v1.6+ for native `terraform test`.
 */

/** Terraform test commands (v1.6+ native HCL test) */
export const TERRAFORM_TEST_CMD = 'terraform test';

/** Terratest Go integration test template */
export const TERRATEST_TEMPLATE = `
package test

import (
  "testing"
  "github.com/gruntwork-io/terratest/modules/terraform"
)

func TestBasicInfra(t *testing.T) {
  opts := &terraform.Options{
    TerraformDir: "../examples/basic",
  }
  defer terraform.Destroy(t, opts)
  terraform.InitAndApply(t, opts)
  // Add assertions here
}
`.trim();

/** Recommended terraform test file structure */
export const TERRAFORM_TEST_STRUCTURE = {
  testDir: 'tests/',
  testFile: 'tests/main.tftest.hcl',
  examplesDir: 'examples/',
  policiesDir: 'tests/infra/policies/',
} as const;
