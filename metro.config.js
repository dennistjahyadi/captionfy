// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// whisper.rn loads ggml models and Core ML encoders as bundled assets, so Metro
// has to treat them as binary assets rather than source it can parse.
config.resolver.assetExts.push('bin', 'mil');

module.exports = config;
