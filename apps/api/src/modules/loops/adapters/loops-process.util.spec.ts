import { extractJson, parseJsonLoose } from './loops-process.util';

describe('parseJsonLoose / extractJson', () => {
  it('parses a plain JSON object', () => {
    expect(parseJsonLoose('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
  });

  it('parses a JSON array', () => {
    expect(parseJsonLoose('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('extracts JSON surrounded by prose', () => {
    const raw = 'Here is the plan:\n{"shards":[{"id":"s1"}]}\nDone.';
    expect(parseJsonLoose(raw)).toEqual({ shards: [{ id: 's1' }] });
  });

  it('handles nested objects without being fooled by trailing braces (old lastIndexOf bug)', () => {
    // The old implementation used lastIndexOf('}'), which would slice past the
    // real end when extra braces follow the value.
    const raw = '{"outer":{"inner":1}} extra } }';
    expect(parseJsonLoose(raw)).toEqual({ outer: { inner: 1 } });
  });

  it('strips markdown json code fences', () => {
    const raw = '```json\n{"k":"v"}\n```';
    expect(parseJsonLoose(raw)).toEqual({ k: 'v' });
  });

  it('strips bare markdown code fences', () => {
    const raw = '```\n[1,2]\n```';
    expect(parseJsonLoose(raw)).toEqual([1, 2]);
  });

  it('tolerates trailing commas', () => {
    expect(parseJsonLoose('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
    expect(parseJsonLoose('[1,2,3,]')).toEqual([1, 2, 3]);
  });

  it('ignores braces inside strings', () => {
    const raw = '{"note":"this } looks like an end","ok":true}';
    expect(parseJsonLoose(raw)).toEqual({ note: 'this } looks like an end', ok: true });
  });

  it('ignores brackets inside strings', () => {
    const raw = '{"a":"[not an array]","b":[1]}';
    expect(parseJsonLoose(raw)).toEqual({ a: '[not an array]', b: [1] });
  });

  it('returns undefined for non-JSON text', () => {
    expect(parseJsonLoose('no json here')).toBeUndefined();
    expect(parseJsonLoose('')).toBeUndefined();
  });

  it('returns undefined for malformed JSON it cannot repair', () => {
    expect(parseJsonLoose('{"a":')).toBeUndefined();
  });

  it('extractJson is an alias of parseJsonLoose', () => {
    const raw = '{"x":1}';
    expect(extractJson(raw)).toEqual(parseJsonLoose(raw));
  });
});
