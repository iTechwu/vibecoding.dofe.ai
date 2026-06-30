const test = require('node:test');
const assert = require('node:assert/strict');
const { checkImplementationCycles } = require('./check-docs0629-implementation-cycles');

test('accepts cycles with implementation validation and docs markers', () => {
  const issues = checkImplementationCycles({
    file: 'docs/0629/IMPLEMENTATION-ANNOTATIONS.md',
    content: `
## Cycle 1 - Example

**Implementation:** Changed a thing.

**Validation:** Ran a test.

**Docs:** Updated the status.
`,
  });

  assert.deepEqual(issues, []);
});

test('reports cycles missing required markers', () => {
  const issues = checkImplementationCycles({
    file: 'docs/0629/IMPLEMENTATION-ANNOTATIONS.md',
    content: `
## Cycle 2 - Missing Docs

**Implementation:** Changed a thing.

**Validation:** Ran a test.
`,
  });

  assert.deepEqual(issues, [
    'docs/0629/IMPLEMENTATION-ANNOTATIONS.md:2 ## Cycle 2 - Missing Docs is missing **Docs:**',
  ]);
});

test('checks every cycle before the final review section', () => {
  const issues = checkImplementationCycles({
    file: 'docs/0629/IMPLEMENTATION-ANNOTATIONS.md',
    content: `
## Cycle 3 - Complete

**Implementation:** Changed a thing.
**Validation:** Ran a test.
**Docs:** Updated docs.

## Cycle 4 - Missing Validation

**Implementation:** Changed another thing.
**Docs:** Updated docs.

### Pass 1 Final Review
`,
  });

  assert.deepEqual(issues, [
    'docs/0629/IMPLEMENTATION-ANNOTATIONS.md:8 ## Cycle 4 - Missing Validation is missing **Validation:**',
  ]);
});
