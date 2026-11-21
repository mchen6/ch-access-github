'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {fakeCtx, fixture, body} = require('./fake-ctx');
const listRuns = require('../handlers/githubService/listRuns');

const recorded = body('list_workflow_runs').workflow_runs;

test('listRuns maps the server\'s fields and never returns emails', async () => {
  const ctx = fakeCtx({actions_list: fixture('list_workflow_runs')});
  const {output} = await listRuns({repo: 'mchen6/countinghouse', limit: 50}, ctx);
  assert.strictEqual(output.runs.length, 50);
  const failed = output.runs.find((r) => r.runId === '42775507169');
  assert.deepStrictEqual(failed, {
    runId: '42775507169',
    conclusion: 'failure',
    commit: '5c23de037f76a066f7b40fbf9ba4c993ceed8c42',
    branch: 'r2-1-task1',
    createdAt: '2026-11-10T07:28:18Z',
    workflow: 'CI',
    url: recorded.find((r) => r.id === 42775507169).html_url
  });
  for (const r of output.runs) assert.deepStrictEqual(Object.keys(r), ['runId', 'conclusion', 'commit', 'branch', 'createdAt', 'workflow', 'url']);
  const text = JSON.stringify(output);
  assert.ok(!text.includes('removed@example.invalid'), 'no email passes through');
  assert.ok(!text.includes('Example Author'), 'no git identity name passes through');
  assert.ok(!text.includes('@'), 'nothing email-shaped at all');
  assert.deepStrictEqual(ctx.calls, [{address: 'remote:github/actions_list', args: {method: 'list_workflow_runs', owner: 'mchen6', repo: 'countinghouse', perPage: 50}}]);
});

test('listRuns keeps every workflow and GitHub\'s own conclusion', async () => {
  const ctx = fakeCtx({actions_list: fixture('list_workflow_runs')});
  const {output} = await listRuns({repo: 'mchen6/countinghouse', limit: 50}, ctx);
  const count = (w, c) => output.runs.filter((r) => r.workflow === w && r.conclusion === c).length;
  assert.deepStrictEqual([count('CI', 'success'), count('CI', 'cancelled'), count('CI', 'failure'), count('pages build and deployment', 'success')], [34, 4, 1, 11]);
});

test('listRuns passes a branch filter through', async () => {
  const ctx = fakeCtx({actions_list: fixture('list_workflow_runs')});
  await listRuns({repo: 'mchen6/countinghouse', branch: 'main', limit: 10}, ctx);
  assert.deepStrictEqual(ctx.calls[0].args, {method: 'list_workflow_runs', owner: 'mchen6', repo: 'countinghouse', perPage: 10, workflow_runs_filter: {branch: 'main'}});
});

test('listRuns validates its input', async () => {
  const ctx = fakeCtx({});
  const invalid = (err) => err.code === 'INPUT_REJECTED';
  for (const bad of [null, {}, {repo: 'mchen6', limit: 5}, {repo: 'a/b/c', limit: 5}, {repo: 'a/b', limit: 0}, {repo: 'a/b', limit: 101}, {repo: 'a/b', limit: 2.5}, {repo: 'a/b', limit: 5, branch: 3}, {repo: 'a/b', limit: 5, branch: ''}]) {
    await assert.rejects(listRuns(bad, ctx), invalid, JSON.stringify(bad));
  }
  assert.strictEqual(ctx.calls.length, 0);
});

// From /code-review medium on PR #32.
test('listRuns returns at most limit runs whatever the server sends', async () => {
  const ctx = fakeCtx({actions_list: fixture('list_workflow_runs')});
  const {output} = await listRuns({repo: 'mchen6/countinghouse', limit: 10}, ctx);
  assert.strictEqual(output.runs.length, 10);
  assert.strictEqual(output.runs[0].runId, String(body('list_workflow_runs').workflow_runs[0].id));
});

test('a second text part after the JSON does not spoil the answer', async () => {
  const r = fixture('list_workflow_runs').result;
  const withNote = {result: {...r, content: [...r.content, {type: 'text', text: 'note: more pages are available'}]}};
  const {output} = await listRuns({repo: 'mchen6/countinghouse', limit: 50}, fakeCtx({actions_list: withNote}));
  assert.strictEqual(output.runs.length, 50);
});

// The final pass on the packs (A12): only the message reaches the model, so
// it names the cause GitHub's status gives.
test('a refused listing names its cause: 404 (not found or no access), 401, 403', async () => {
  const answer = (status) => ({result: {content: [{type: 'text', text: `failed to list workflow runs: GET https://api.github.com/repos/o/r/actions/runs?per_page=5: ${status} []`}], isError: true}});
  const cases = [['404 Not Found', /not found, or the token cannot see it \(404\)/], ['401 Unauthorized', /the token was refused \(401: missing, expired or revoked\)/],
    ['403 Forbidden', /access denied \(403\): the token may not read Actions there, or a rate limit was hit/], ['502 Bad Gateway', /could not list the runs of o\/r$/]];
  for (const [status, said] of cases) {
    const ctx = fakeCtx({actions_list: answer(status)});
    await assert.rejects(listRuns({repo: 'o/r', limit: 5}, ctx), (err) => err.code === 'REMOTE_FAILED' && said.test(err.message), status);
  }
});
