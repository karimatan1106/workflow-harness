/**
 * N-49: Desktop E2E config (scaffold).
 * Requires desktop application runtime to execute.
 */

export const DESKTOP_CONFIG = {
  /** Electron apps via Playwright */
  electron: {
    tool: 'playwright' as const,
    launch: '_electron.launch({ args: ["main.js"] })',
    windowTimeout: 10_000,
    sampleTest: `
const app = await _electron.launch({ args: ['main.js'] });
const window = await app.firstWindow();
await expect(window.title()).resolves.toBeTruthy();
await app.close();
    `.trim(),
  },

  /** Tauri apps via WebDriver */
  tauri: {
    tool: 'tauri-driver' as const,
    macosAlternative: 'tauri-webdriver',
    port: 4444,
    capabilities: {
      browserName: 'wry',
      'tauri:options': { application: '../target/release/app' },
    },
  },

  /** Windows native apps via Terminator MCP */
  windows: {
    tool: 'terminator' as const,
    api: 'UIAutomation' as const,
    capabilities: ['find_elements', 'click', 'type_text', 'get_text', 'screenshot'],
  },

  /** macOS native apps via NSAccessibility */
  macos: {
    tool: 'macos-ui-automation-mcp' as const,
    api: 'NSAccessibility' as const,
    capabilities: ['find_elements', 'click', 'type', 'read_text', 'screenshot'],
  },
} as const;

/** N-60: Desktop tool registry */
export const DESKTOP_TOOLS = {
  playwright: { name: 'Playwright Electron', platform: 'electron' as const },
  tauriDriver: { name: 'tauri-driver', platform: 'tauri' as const },
  terminator: { name: 'Terminator', platform: 'windows' as const, stars: 1300 },
  macosAutomation: { name: 'macos-ui-automation-mcp', platform: 'macos' as const },
  circuitMCP: { name: 'circuit-mcp', platform: 'cross' as const, tools: 61 },
} as const;
