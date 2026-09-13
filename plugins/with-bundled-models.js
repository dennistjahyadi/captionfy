/**
 * Packs the speech models into the APK.
 *
 * `assets/models` is pointed at rather than copied, the same way the burn-in
 * module points its assets directory at `assets/fonts`: two copies of an 82 MB
 * file is 82 MB of somebody's disk and one chance for them to differ. The files
 * are not in git — `scripts/fetch-models.sh` puts them there, and `run.sh` calls
 * it before every build.
 *
 * `noCompress` matters. whisper.rn opens a bundled model through AAssetManager
 * and streams it (`whisperInitFromAsset` in its jni.cpp), and a deflated asset
 * has to be inflated on every launch to be read at all. A q8 model is close to
 * incompressible, so the trade is a few megabytes of APK against a slower start
 * every single time.
 *
 * Android only, because iOS has never been built in any slice.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const ANCHOR = /^android \{$/m;

const BLOCK = `
    // Added by plugins/with-bundled-models.js
    sourceSets {
        main {
            assets.srcDirs += ["$rootDir/../assets/models"]
        }
    }
    androidResources {
        noCompress += ["bin"]
    }
`;

module.exports = function withBundledModels(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;

    if (contents.includes('with-bundled-models.js')) return gradleConfig;
    if (!ANCHOR.test(contents)) {
      throw new Error(
        "with-bundled-models: no `android {` block in app/build.gradle, so the models would " +
          'be left out of the APK silently. Fix the anchor in the plugin.'
      );
    }

    gradleConfig.modResults.contents = contents.replace(ANCHOR, `android {\n${BLOCK}`);
    return gradleConfig;
  });
};
