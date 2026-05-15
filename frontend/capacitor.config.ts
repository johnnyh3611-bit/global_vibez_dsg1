/**
 * Capacitor config — scaffolding for Item 5 (Native Mobile Shell).
 *
 * To produce native shells after redeploy:
 *   cd frontend
 *   yarn build
 *   yarn add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
 *   npx cap init "Global Vibez DSG" com.globalvibez.dsg --web-dir=build
 *   npx cap add ios
 *   npx cap add android
 *   npx cap sync
 *
 * The webDir below points at the CRA production build output. Push
 * notifications + biometric login wired via @capacitor/push-notifications
 * and @capgo/capacitor-biometric-auth (added in a follow-up).
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.globalvibez.dsg",
  appName: "Global Vibez DSG",
  webDir: "build",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#06070d",
  },
  android: {
    backgroundColor: "#06070d",
    allowMixedContent: false,
  },
};

export default config;
