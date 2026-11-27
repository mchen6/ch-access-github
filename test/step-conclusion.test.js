'use strict';
// A step GitHub gives no conclusion (one that never started, in a cancelled
// job: a null the MCP server may omit) is a step with conclusion null, as the
// output's schema says; a step that is null itself is a step with neither, in
// its place (steps are matched by position when names don't match). Neither
// loses the list.
const test = require('node:test');
const assert = require('node:assert');
const {fakeCtx, body} = require('./fake-ctx');
const failedJobs = require('../handlers/githubService/failedJobs');
// (every answer held to the declared output, as the runtime holds it)
const Ajv2020 = require('ajv/dist/2020');
const valid = new Ajv2020({strict: false, allErrors: true}).compile(require('../schema.json').githubService.failedJobs.output);

test('a step without a conclusion is conclusion null; a null step keeps its place, with neither', async () => {
  const answer = body('list_workflow_jobs');
  const failed = answer.jobs.jobs.find((j) => j.conclusion === 'failure');
  const last = failed.steps[failed.steps.length - 1];
  delete last.conclusion;
  failed.steps.push(null);
  const ctx = fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify(answer)}]}}});
  const {output} = await failedJobs({repo: 'mchen6/countinghouse', runId: '42775507169'}, ctx);
  const job = output.jobs.find((j) => j.jobId === String(failed.id));
  assert.strictEqual(job.steps.length, failed.steps.length, 'every step in its place');
  for (const s of job.steps) assert.deepStrictEqual(Object.keys(s), ['name', 'conclusion']);
  assert.deepStrictEqual(job.steps.slice(-2), [{name: last.name, conclusion: null}, {name: '', conclusion: null}]);
  assert.ok(valid(output), JSON.stringify(valid.errors));
});


test('a step\'s name GitHub leaves out, a conclusion that is no string, a step that is no object: the list stays whole and valid (a step keeps its place, for matching by position)', async () => {
  const answer = body('list_workflow_jobs');
  const failed = answer.jobs.jobs.find((j) => j.conclusion === 'failure');
  failed.steps = [{name: null, conclusion: 'failure'}, {conclusion: 'success'}, {name: 'odd', conclusion: 0}, 'x', 7, {name: 'ok', conclusion: 'skipped'}];
  const ctx = fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify(answer)}]}}});
  const {output} = await failedJobs({repo: 'mchen6/countinghouse', runId: '42775507169'}, ctx);
  assert.ok(valid(output), JSON.stringify(valid.errors));
  const job = output.jobs.find((j) => j.jobId === String(failed.id));
  assert.deepStrictEqual(job.steps, [{name: '', conclusion: 'failure'}, {name: '', conclusion: 'success'}, {name: 'odd', conclusion: null}, {name: '', conclusion: null}, {name: '', conclusion: null}, {name: 'ok', conclusion: 'skipped'}]);
});

// A failed job is compared with the job of the same name in other runs: two
// jobs that lost their names must never read as one, so a failed job without
// a name refuses the answer (the pack counts that run as not compared).
test('a failed job without a name refuses the answer, never a job named \'\'', async () => {
  for (const name of [undefined, null, '', 7]) {
    const answer = body('list_workflow_jobs');
    const failed = answer.jobs.jobs.find((j) => j.conclusion === 'failure');
    if (name === undefined) delete failed.name; else failed.name = name;
    const ctx = fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify(answer)}]}}});
    await assert.rejects(failedJobs({repo: 'mchen6/countinghouse', runId: '42775507169'}, ctx), (err) => err.code === 'REMOTE_ANSWER_INVALID' && /a failed job that has no name/.test(err.message), String(name));
  }
});
