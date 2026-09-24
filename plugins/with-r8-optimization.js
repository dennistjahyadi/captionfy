/**
 * Point the release build at R8's *optimizing* default rules.
 *
 * `expo-build-properties` can turn R8 on — `enableMinifyInReleaseBuilds` writes
 * `android.enableMinifyInReleaseBuilds=true` into `gradle.properties`, and the
 * generated `build.gradle` already reads it — but it cannot say which of the
 * SDK's two default rule files the build uses, and AGP's template picks the
 * wrong one:
 *
 *     proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
 *
 * `proguard-android.txt` is one line of substance and that line is
 * `-dontoptimize`. With it, R8 shrinks and obfuscates and then stops, which is
 * why Play Console reports an obfuscation percentage and a dash under
 * "Optimization percentage" — the pass that fills that column never ran.
 * `proguard-android-optimize.txt` is the same file with `-dontoptimize` traded
 * for five optimization passes and `-allowaccessmodification`, and it is what
 * https://developer.android.com/topic/performance/vitals/code-optimization
 * tells you to use.
 *
 * It has to be a plugin for the reason `with-release-signing.js` does:
 * `android/` is not in git and every `expo prebuild` writes it again, so a hand
 * edit to `android/app/build.gradle` lives exactly until the next one.
 *
 * What this does *not* do is turn minification on. That stays in `app.json`
 * under `expo-build-properties`, because that is where the rest of the Android
 * build properties are and two places to look is one too many. Without it this
 * plugin is inert: `proguardFiles` is read only when `minifyEnabled` is true.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * AGP's own template line. Matched with the quotes loose, because the template
 * has spelled this both `getDefaultProguardFile("…")` and with single quotes
 * across versions, and with the trailing rules file loose for the same reason.
 */
const DEFAULT_PROGUARD_FILE = /getDefaultProguardFile\((["'])proguard-android\.txt\1\)/;

module.exports = function withR8Optimization(config) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents;

    if (gradle.includes('proguard-android-optimize.txt')) return cfg;

    // The anchor is AGP template text. If a future Expo stops writing it, say so
    // here rather than shipping a bundle that quietly went back to -dontoptimize
    // and finding out from Play Console months later.
    if (!DEFAULT_PROGUARD_FILE.test(gradle)) {
      throw new Error(
        'with-r8-optimization: the default proguard file was not where it was expected in android/app/build.gradle.'
      );
    }

    cfg.modResults.contents = gradle.replace(
      DEFAULT_PROGUARD_FILE,
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );

    return cfg;
  });
};
