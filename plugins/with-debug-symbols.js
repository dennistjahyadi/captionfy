/**
 * Ship native debug symbols with the bundle, so a native crash is readable.
 *
 * Most of the risky code in this app is not JavaScript. whisper.cpp and ggml are
 * C++, the burn-in module's pipeline is Kotlin over GL and MediaCodec, and Skia
 * is a large native library underneath the overlay. A crash in any of them
 * arrives in Play Console's Crashes & ANRs as a stack of hexadecimal addresses
 * and nothing else — the same crash, from the same build, is unreadable or
 * diagnosable depending only on whether the symbols went up with the bundle.
 *
 * AGP packs them in when asked, and Play strips them before delivering anything
 * to a phone. The upload gets larger; the install does not, which is the only
 * size that has to argue with the 150 MB line.
 *
 * This is a plugin rather than an edit to `android/app/build.gradle` for the
 * same reason the signing config is: that directory is not in git and every
 * `expo prebuild` writes it again from scratch.
 *
 * Vitals is the whole reason this exists. It collects crashes from users who
 * turned on diagnostics sharing, needs no SDK in the app, sends nothing extra
 * off anybody's device, and so leaves the Data safety answer in PLAY-CONSOLE.md
 * — "collects no user data" — true exactly as written. A crash reporter linked
 * into the app would not.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * `SYMBOL_TABLE` gives function names. `FULL` adds file and line numbers and
 * carries the whole of DWARF to get them, which for a build holding Skia,
 * Hermes and ggml is hundreds of megabytes of upload rather than tens.
 *
 * Names are enough to tell which library and which function died, which is the
 * question a first crash report has to answer. Change this one word if a real
 * stack trace ever needs the line, and expect the upload to take a while.
 */
const SYMBOL_LEVEL = 'SYMBOL_TABLE';

/**
 * The release build type's minify line: present in every AGP template this app
 * has seen, and unique to `buildTypes.release`. Deliberately not the word
 * `release`, which also names a block inside `signingConfigs` that
 * `with-release-signing.js` puts there — and not that plugin's own text either,
 * so the two can run in either order.
 */
const RELEASE_MINIFY = /(\n(\s*)minifyEnabled [A-Za-z]+\n)/;

module.exports = function withDebugSymbols(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('debugSymbolLevel')) return cfg;

    // AGP's own template. If it stops matching after an Expo upgrade, say so
    // here rather than uploading a bundle whose crashes cannot be read and
    // finding out months later from a report nobody can act on.
    if (!RELEASE_MINIFY.test(gradle)) {
      throw new Error(
        'with-debug-symbols: the release buildType was not where it was expected in android/app/build.gradle.'
      );
    }

    gradle = gradle.replace(
      RELEASE_MINIFY,
      `$1$2// Native symbols for Play Console's Crashes & ANRs. Uploaded with the
$2// bundle and stripped before delivery, so this costs upload size and not
$2// install size. See plugins/with-debug-symbols.js.
$2ndk {
$2    debugSymbolLevel '${SYMBOL_LEVEL}'
$2}\n`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
