/**
 * N-70: kubeconform + Conftest/OPA configuration (scaffold).
 * Requires kubeconform binary and conftest for policy enforcement.
 */

/** kubeconform CLI command for K8s manifest validation */
export const KUBECONFORM_CMD = 'kubeconform -strict -summary -output json';

/** Conftest OPA policy test command */
export const CONFTEST_CMD = 'conftest test --policy tests/infra/policies/';

/** Pre-configured OPA policy rules */
export const OPA_POLICIES = {
  noPublicS3: {
    file: 'no-public-s3.rego',
    description: 'Block public S3 bucket ACLs',
  },
  minInstanceSize: {
    file: 'min-instance-size.rego',
    description: 'Enforce minimum instance size in production',
  },
  requireLabels: {
    file: 'require-labels.rego',
    description: 'All K8s resources must have app and team labels',
  },
} as const;

/** PreToolUse block pattern for production infra commands */
export const BLOCKED_INFRA_COMMANDS = [
  'terraform apply',
  'kubectl apply',
  'kubectl delete',
  'helm install',
  'helm upgrade',
] as const;
