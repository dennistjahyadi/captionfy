/**
 * Turning speech spans into transcription chunks.
 *
 * Pure TypeScript. No react-native imports belong in this directory.
 */

export type Span = { t0Ms: number; t1Ms: number };

/**
 * Groups speech spans into as few chunks as possible, each no longer than `maxChunkMs`.
 *
 * whisper's encoder runs at a fixed 1500 frames, which is 30 seconds of mel, no
 * matter how much real audio a call contains. A 400 ms span therefore costs the
 * same encoder pass as a 28 second one. Handing whisper one span at a time made a
 * 42 second clip pay seven full encoder passes for 42 seconds of audio.
 *
 * Because the window is padded either way, widening a chunk over the silence
 * between two spans is free. Only when the next span will not fit inside the
 * window does a new chunk open, which is what skips long stretches with no speech
 * in them rather than paying to encode them.
 */
export function packSpansIntoChunks(spans: Span[], maxChunkMs: number): Span[] {
  if (maxChunkMs <= 0) throw new Error('maxChunkMs must be positive');

  const ordered = [...spans].sort((a, b) => a.t0Ms - b.t0Ms);
  const chunks: Span[] = [];

  for (const span of ordered) {
    for (const piece of splitSpan(span, maxChunkMs)) {
      const current = chunks[chunks.length - 1];
      if (current && piece.t1Ms - current.t0Ms <= maxChunkMs) {
        current.t1Ms = Math.max(current.t1Ms, piece.t1Ms);
      } else {
        chunks.push({ t0Ms: piece.t0Ms, t1Ms: Math.max(piece.t0Ms, piece.t1Ms) });
      }
    }
  }

  return chunks;
}

/** Cuts a span that outruns the encoder window into equal pieces. */
export function splitSpan(span: Span, maxChunkMs: number): Span[] {
  const duration = span.t1Ms - span.t0Ms;
  if (duration <= maxChunkMs) return [{ t0Ms: span.t0Ms, t1Ms: Math.max(span.t0Ms, span.t1Ms) }];

  const pieces = Math.ceil(duration / maxChunkMs);
  const pieceMs = Math.ceil(duration / pieces);
  return Array.from({ length: pieces }, (_, index) => ({
    t0Ms: span.t0Ms + index * pieceMs,
    t1Ms: Math.min(span.t1Ms, span.t0Ms + (index + 1) * pieceMs),
  }));
}

/** Total time covered by the spans, ignoring any overlap between them. */
export function totalSpanMs(spans: Span[]): number {
  return spans.reduce((total, span) => total + Math.max(0, span.t1Ms - span.t0Ms), 0);
}
