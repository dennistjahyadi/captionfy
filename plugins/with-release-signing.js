/**
 * Sign release builds with the upload key instead of the debug one.
 *
 * The generated `android/` project signs release builds with `debug.keystore`,
 * which is the same key on every machine that has ever run React Native. Play
 * refuses an upload signed with it, and it cannot be fixed by editing
 * `android/app/build.gradle` by hand: that directory is not in git and every
 * `expo prebuild` writes it again from scratch. So the change is a plugin,
 * which is the only edit to the native project that survives.
 *
 * The key itself is named by four Gradle properties. They belong in
 * `~/.gradle/gradle.properties`, outside this repository and outside the
 * generated project, because both of those are thrown away routinely and a
 * keystore password in either one is a password in a backup somewhere:
 *
 *     WORDBURN_UPLOAD_STORE_FILE=/absolute/path/to/wordburn-upload.jks
 *     WORDBURN_UPLOAD_STORE_PASSWORD=…
 *     WORDBURN_UPLOAD_KEY_ALIAS=upload
 *     WORDBURN_UPLOAD_KEY_PASSWORD=…
 *
 * With them absent, a release build still builds and still installs — signed
 * with the debug key, exactly as before. That is deliberate: `./run.sh` builds
 * release APKs to measure on the phone, and a missing keystore must not stop
 * somebody measuring a frame rate. Only `scripts/build-aab.sh` insists on the
 * real key, because only that output is going to Play.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

/** Sits inside `signingConfigs`, next to the debug one AGP writes. */
const RELEASE_SIGNING_CONFIG = `
        release {
            if (project.hasProperty('WORDBURN_UPLOAD_STORE_FILE')) {
                storeFile file(WORDBURN_UPLOAD_STORE_FILE)
                storePassword WORDBURN_UPLOAD_STORE_PASSWORD
                keyAlias WORDBURN_UPLOAD_KEY_ALIAS
                keyPassword WORDBURN_UPLOAD_KEY_PASSWORD
            }
        }`;

/**
 * The debug config's closing lines, which is where the release one goes after.
 * Matching the whole block rather than the word `signingConfigs` keeps this
 * from landing inside `buildTypes`, which also has a `debug` and a `release`.
 */
const DEBUG_SIGNING_CONFIG = /(keyPassword 'android'\n\s*\}\n)/;

/**
 * The release build type's line, comment and all, so the anchor is unique.
 *
 * The assignment is spelled both ways across template versions — `signingConfig
 * signingConfigs.debug` in Gradle's method-call style and `signingConfig =
 * signingConfigs.debug` in the property style — so the `=` is optional here.
 */
const RELEASE_BUILD_TYPE =
  /\/\/ Caution! In production[\s\S]*?signingConfig\s*=?\s*signingConfigs\.debug/;

const RELEASE_BUILD_TYPE_SIGNED = `// Signed with the upload key when ~/.gradle/gradle.properties names one,
            // and with the debug key when it does not. See plugins/with-release-signing.js.
            signingConfig project.hasProperty('WORDBURN_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('WORDBURN_UPLOAD_STORE_FILE')) return cfg;

    // Both anchors are AGP's own template. If either stops matching after an
    // Expo upgrade, say so here rather than writing an unsigned bundle and
    // finding out from Play Console.
    if (!DEBUG_SIGNING_CONFIG.test(gradle)) {
      throw new Error(
        'with-release-signing: the debug signingConfig block was not where it was expected in android/app/build.gradle.'
      );
    }
    if (!RELEASE_BUILD_TYPE.test(gradle)) {
      throw new Error(
        'with-release-signing: the release buildType was not where it was expected in android/app/build.gradle.'
      );
    }

    gradle = gradle.replace(DEBUG_SIGNING_CONFIG, `$1${RELEASE_SIGNING_CONFIG}\n`);
    gradle = gradle.replace(RELEASE_BUILD_TYPE, RELEASE_BUILD_TYPE_SIGNED);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
