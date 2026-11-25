'use strict';
// GitHub can leave out a run's branch, name or workflow id (its server drops a
// null branch, and sends a null name as ""). One such run must not lose the
// list; a run without what identifies it must not pass as half a run.
const test = require('node:test');
const assert = require('node:assert');
const Ajv2020 = require('ajv/dist/2020');
const {fakeCtx, body} = require('./fake-ctx');
const listRuns = require('../handlers/githubService/listRuns');

const recorded = body('list_workflow_runs').workflow_runs;
const valid = new Ajv2020({strict: false, allErrors: true}).compile(require('../schema.json').githubService.listRuns.output);
const MISSING = Symbol('missing');
const withField = (key, value) => {
  const run = {...recorded[0]};
  if (value === MISSING) delete run[key]; else run[key] = value;
  return run;
};
const list = (runs) => listRuns({repo: 'mchen6/countinghouse', limit: 50}, fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify({total_count: runs.length, workflow_runs: runs})}]}}}));
// (every answer held to the declared output, as the runtime holds it)
const first = async(key, value) => {
  const {output} = await list([withField(key, value), recorded[1]]);
  assert.ok(valid(output), `${key} ${String(value)}: ${JSON.stringify(valid.errors)}`);
  assert.strictEqual(output.runs.length, 2, 'the other run is listed too');
  return output.runs[0];
};
const named = (v) => (v === MISSING ? 'missing' : JSON.stringify(v));

for (const value of [null, MISSING, '', 7]) {
  test(`head_branch ${named(value)}: the branch is null, and the list answers`, async() => {
    assert.strictEqual((await first('head_branch', value)).branch, null);
  });
  test(`name ${named(value)}: the workflow is "", and the list answers`, async() => {
    assert.strictEqual((await first('name', value)).workflow, '');
  });
}

test('workflow_id is given as a string of digits when it is a whole number from 1', async() => {
  for (const id of [1, 329944229, Number.MAX_SAFE_INTEGER]) assert.strictEqual((await first('workflow_id', id)).workflowId, String(id));
});

for (const value of [MISSING, null, 0, -1, 1.5, '329944229', true, Number.MAX_SAFE_INTEGER + 1]) {
  test(`workflow_id ${named(value)}: no workflowId`, async() => {
    assert.ok(!('workflowId' in await first('workflow_id', value)));
  });
}

for (const [key, bad] of [['id', [MISSING, null, 0, '', 1.5, '12345678901234567']], ['head_sha', [MISSING, null, '', 7]], ['created_at', [MISSING, null, '', 7]], ['html_url', [MISSING, null, '', 7]]]) {
  for (const value of bad) {
    test(`${key} ${named(value)}: an honest error that names the field, never a partial list`, async() => {
      await assert.rejects(list([recorded[1], withField(key, value)]), (err) => {
        assert.strictEqual(err.code, 'REMOTE_ANSWER_INVALID');
        assert.ok(err.message.includes(key), err.message);
        for (const text of [recorded[0].display_title, recorded[0].head_branch]) assert.ok(!err.message.includes(text), 'nothing of the run\'s text');
        return true;
      });
    });
  }
}

test('a run that has everything is listed as before, with its workflowId', async() => {
  const {output} = await list([recorded[0]]);
  assert.ok(valid(output), JSON.stringify(valid.errors));
  assert.deepStrictEqual(output.runs[0], {runId: String(recorded[0].id), conclusion: recorded[0].conclusion, commit: recorded[0].head_sha, branch: recorded[0].head_branch,
    createdAt: recorded[0].created_at, workflow: recorded[0].name, url: recorded[0].html_url, workflowId: String(recorded[0].workflow_id), attempt: recorded[0].run_attempt});
});

test('an entry that is no run is an honest error; an id sent as digits is a run\'s', async() => {
  for (const entry of [null, 7, 'x']) await assert.rejects(list([recorded[1], entry]), (err) => err.code === 'REMOTE_ANSWER_INVALID', named(entry));
  assert.strictEqual((await first('id', '42')).runId, '42');
});

test('a run past the limit is not read, whatever it lacks', async() => {
  const runs = [recorded[0], withField('head_sha', MISSING)];
  const {output} = await listRuns({repo: 'mchen6/countinghouse', limit: 1}, fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify({workflow_runs: runs})}]}}}));
  assert.strictEqual(output.runs.length, 1);
});
