/**
 * N-48: Mobile E2E config (scaffold).
 * Requires device/emulator environment to execute.
 */

export const MOBILE_CONFIG = {
  /** iOS testing via XcodeBuildMCP */
  ios: {
    tool: 'XcodeBuildMCP' as const,
    minXcode: '26.3',
    simulator: 'iPhone 16 Pro',
    os: 'iOS 19.0',
  },

  /** Android testing via mobile-mcp */
  android: {
    tool: 'mobile-mcp' as const,
    adbRequired: true,
    emulator: 'Pixel_8_API_35',
    minSdk: 35,
  },

  /** Cross-platform testing via Detox (React Native) */
  crossPlatform: {
    tool: 'detox' as const,
    framework: 'react-native' as const,
    config: {
      testRunner: { args: { config: 'e2e/jest.config.js' } },
      apps: {
        'ios.release': { type: 'ios.app', binaryPath: 'ios/build/Release/App.app' },
        'android.release': { type: 'android.apk', binaryPath: 'android/app/build/outputs/apk/release/app-release.apk' },
      },
      devices: {
        simulator: { type: 'ios.simulator', device: { type: 'iPhone 16' } },
        emulator: { type: 'android.emulator', device: { avdName: 'Pixel_8_API_35' } },
      },
    },
  },

  /** Maestro YAML-based testing */
  maestro: {
    tool: 'maestro' as const,
    flowDir: 'tests/e2e/flows/',
    sampleFlow: `
appId: com.example.app
---
- launchApp
- tapOn: "Login"
- inputText: "test@example.com"
- tapOn: "Submit"
- assertVisible: "Welcome"
    `.trim(),
  },
} as const;
