import {
  assertCsvShape,
  assertRowShape,
  COLUMNS,
  HEADER_LINE,
  SAMPLE_RUN,
  toRow,
  toRowLine,
  type Row,
} from '../row';

const sampleRow = (): Row => toRow(SAMPLE_RUN, SAMPLE_RUN.models[0]);

describe('rig-a.csv row shape', () => {
  it('emits exactly one value per header column', () => {
    expect(toRowLine(sampleRow()).split(',')).toHaveLength(COLUMNS.length);
  });

  it('puts every value under its own column name', () => {
    const cells = toRowLine(sampleRow()).split(',');
    const byColumn = Object.fromEntries(COLUMNS.map((column, index) => [column, cells[index]]));

    // The round 1 corruption read as a language code in `transcript`. `chunks`
    // and `lang_mode` are where it started, so these are the ones worth pinning.
    expect(byColumn.vad_spans).toBe('1');
    expect(byColumn.chunks).toBe('1');
    expect(byColumn.lang_mode).toBe('detect-once');
    expect(byColumn.transcript).toBe('sample');
    expect(byColumn.language).toBe('en');
  });

  it('leaves notes empty for the operator', () => {
    expect(sampleRow().notes).toBe('');
    expect(COLUMNS[COLUMNS.length - 1]).toBe('notes');
  });

  it('throws when a row has fewer values than the header', () => {
    const short = sampleRow();
    delete (short as Partial<Row>).lang_mode;

    expect(() => assertRowShape(short)).toThrow(/Missing: lang_mode/);
  });

  it('throws when a row carries a value with no column', () => {
    const wide = { ...sampleRow(), gpu_backend: 'vulkan' } as Row;

    expect(() => assertRowShape(wide)).toThrow(/Not in the header: gpu_backend/);
  });

  it('passes the startup self-check', () => {
    expect(() => assertCsvShape()).not.toThrow();
    expect(HEADER_LINE.split(',')).toHaveLength(COLUMNS.length);
  });

  it('quotes a transcript containing commas and quotes', () => {
    const run = {
      ...SAMPLE_RUN,
      models: [{ ...SAMPLE_RUN.models[0], transcript: 'so, "obviously", yeah' }],
    };
    const cells = toRowLine(toRow(run, run.models[0])).split(',');

    // Splitting on commas is only valid because every other column is comma-free.
    expect(cells).toHaveLength(COLUMNS.length + 2);
    expect(toRowLine(toRow(run, run.models[0]))).toContain('"so, ""obviously"", yeah"');
  });
});
