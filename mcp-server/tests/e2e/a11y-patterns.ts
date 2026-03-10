/**
 * N-43: Accessibility tree test patterns (scaffold).
 * Requires Playwright browser context to execute.
 */

/** Standard ARIA roles for accessibility testing */
export const A11Y_ROLES = [
  'button',
  'link',
  'heading',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'tab',
  'dialog',
  'alert',
] as const;

export type A11yRole = (typeof A11Y_ROLES)[number];

/**
 * Get the full accessibility tree snapshot.
 * @param page - Playwright Page object
 */
export async function getAccessibilityTree(page: any) {
  return page.accessibility.snapshot();
}

/**
 * Find an element by its ARIA role and accessible name.
 * @param page - Playwright Page object
 * @param role - ARIA role (e.g., 'button', 'link')
 * @param name - Accessible name (label text)
 */
export async function findByRole(page: any, role: string, name: string) {
  return page.getByRole(role, { name });
}

/**
 * Verify all interactive elements have accessible names.
 * @param page - Playwright Page object
 * @returns Array of elements missing accessible names
 */
export async function findMissingLabels(
  page: any,
): Promise<Array<{ role: string; selector: string }>> {
  const tree = await getAccessibilityTree(page);
  const missing: Array<{ role: string; selector: string }> = [];

  function walk(node: any, path: string) {
    if (node.role && !node.name && A11Y_ROLES.includes(node.role)) {
      missing.push({ role: node.role, selector: path });
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child, `${path} > ${child.role || 'unknown'}`);
      }
    }
  }

  if (tree) walk(tree, 'root');
  return missing;
}

/** WCAG 2.1 AA contrast ratio requirements */
export const CONTRAST_RATIOS = {
  normalText: 4.5,
  largeText: 3.0,
  uiComponents: 3.0,
} as const;
