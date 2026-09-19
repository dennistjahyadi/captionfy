import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
/**
 * CRF 18 rather than the default 18-ish-but-not: TikTok re-encodes on upload,
 * so the file handed to it wants headroom, not a small size.
 */
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
