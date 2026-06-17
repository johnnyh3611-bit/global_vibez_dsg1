/**
 * Capacitor config — scaffolding for Item 5 (Native Mobile Shell).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  WHY THIS LIVES HERE AND THE NATIVE PROJECTS DON'T (Feb 2026 honest
 *  note): Running `npx cap add ios|android` produces ~100MB of native
 *  Xcode + Gradle projects that MUST be opened with Xcode (Mac-only)
 *  and Android Studio respectively. Those toolchains aren't available
 *  inside the cloud preview container, and the resulting binaries
 *  can only be signed + submitted from a developer Mac.
 *
 *  This config file is the entire portable contract. When you're
 *  ready to ship native shells, on a Mac dev machine:
 *
 *     cd frontend
 *     yarn install
 *     yarn add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
 *     npx cap init "Global Vibez DSG" com.globalvibez.dsg --web-dir=build
 *     yarn build
 *     npx cap add ios
 *     npx cap add android
 *     npx cap sync
 *     npx cap open ios       # → Xcode, archive, submit to App Store
 *     npx cap open android   # → Android Studio, build AAB, submit to Play
 *
 *  Push notifications + biometric login can be added in a follow-up
 *  via @capacitor/push-notifications + @capgo/capacitor-biometric-auth.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
