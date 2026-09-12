import { sourceName } from '../source';

describe('sourceName', () => {
  it('keeps the container the picker handed over', () => {
    expect(sourceName('file:///data/user/0/com.captionfy.app/cache/ImagePicker/abc.mp4')).toBe(
      'source.mp4'
    );
    expect(sourceName('file:///tmp/clip.webm')).toBe('source.webm');
  });

  it('lowercases it, because a phone writes MOV and a decoder reads mov', () => {
    expect(sourceName('file:///tmp/IMG_0421.MOV')).toBe('source.mov');
  });

  it('assumes mp4 when there is nothing to carry over', () => {
    expect(sourceName('file:///tmp/no-extension')).toBe('source.mp4');
    expect(sourceName('file:///tmp/dotted.name/')).toBe('source.mp4');
  });

  it('ignores a query string', () => {
    expect(sourceName('file:///tmp/clip.mp4?version=2')).toBe('source.mp4');
  });
});
