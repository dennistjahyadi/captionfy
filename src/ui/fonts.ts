/**
 * The bundled faces.
 *
 * Be Vietnam Pro carries the whole interface and the base caption text. Spectral
 * appears inside a video, in the Editorial preset, and in the chrome only on
 * Welcome's headline — see `font.serif`.
 * Both are OFL and both draw Vietnamese diacritics properly, which English
 * captions need the moment a guest's name is in them.
 */
import { useFonts } from 'expo-font';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    'BeVietnamPro-Medium': require('../../assets/fonts/BeVietnamPro-Medium.ttf'),
    'BeVietnamPro-SemiBold': require('../../assets/fonts/BeVietnamPro-SemiBold.ttf'),
    'BeVietnamPro-ExtraBold': require('../../assets/fonts/BeVietnamPro-ExtraBold.ttf'),
    'Spectral-ExtraBold': require('../../assets/fonts/Spectral-ExtraBold.ttf'),
    'Spectral-ExtraBoldItalic': require('../../assets/fonts/Spectral-ExtraBoldItalic.ttf'),
  });
  return loaded;
}
