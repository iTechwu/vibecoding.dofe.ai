const test = require('node:test');
const assert = require('node:assert/strict');
const { checkNextExecutionPlans } = require('./check-docs0629-next-plans');

test('accepts a complete next execution plan', () => {
  const issues = checkNextExecutionPlans({
    file: 'docs/0629/example.md',
    content: `
### Finding

Next execution plan:

- 目标: Verify the flow.
- 范围: Run the focused command.
- 不做: Do not expand scope.
- 受益: Keeps the loop executable.
`,
  });

  assert.deepEqual(issues, []);
});

test('reports missing required plan parts with file and line', () => {
  const issues = checkNextExecutionPlans({
    file: 'docs/0629/example.md',
    content: `
### Finding

Next execution plan:

- 目标: Verify the flow.
- 范围: Run the focused command.
`,
  });

  assert.deepEqual(issues, [
    'docs/0629/example.md:4 Next execution plan is missing 不做:, 受益:',
  ]);
});

test('checks every next execution plan block in a long document', () => {
  const issues = checkNextExecutionPlans({
    file: 'docs/0629/long.md',
    content: `
### First

Next execution plan:

- 目标: First target.
- 范围: First scope.
- 不做: First non-goal.
- 受益: First benefit.

### Second

Next execution plan:

- 目标: Second target.
- 范围: Second scope.
- 受益: Second benefit.
`,
  });

  assert.deepEqual(issues, ['docs/0629/long.md:13 Next execution plan is missing 不做:']);
});
