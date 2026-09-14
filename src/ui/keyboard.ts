/**
 * How much of the screen the keyboard is covering, in dp.
 *
 * Android used to answer this by resizing the window under the app, which is
 * what `windowSoftInputMode="adjustResize"` in the manifest asks for and what a
 * bottom-docked sheet rides up on for free. It does not any more: measured on
 * the A54, a release build, with the dictionary's entry sheet open — the IME
 * came up over the whole sheet and neither the dialog the `Modal` lives in nor
 * the activity behind it gave up a single pixel. Every text field in the app is
 * inside a sheet, so every text field in the app was behind the keyboard.
 *
 * So the sheet is told how tall the keyboard is and gets out of the way itself.
 * React Native still reports that height from the IME's own window insets,
 * which is a measurement that does not depend on anything resizing.
 *
 * `metrics()` answers the same question for a component mounting while the
 * keyboard is already up. That is not a corner case here: the editor's sheets
 * share one `Sheet` whose contents change, so a word sheet can hand over to
 * another with the keyboard already open.
 */
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(() => (Keyboard.isVisible() ? keyboardHeight() : 0));

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      setInset(event.endCoordinates.height)
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setInset(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return inset;
}

function keyboardHeight(): number {
  return Keyboard.metrics()?.height ?? 0;
}
