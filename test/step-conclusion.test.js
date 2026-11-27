'use strict';
// A step GitHub gives no conclusion (one that never started, in a cancelled
// job: a null the MCP server may omit) is a step with conclusion null, as the
// output's schema says; a step that is null itself is skipped. Neither loses
// the list.
const test = require('node:test');
const assert = require('node:assert');
const {fakeCtx, body} = require('./fake-ctx');
const failedJobs = require('../handlers/githubService/failedJobs');
// (every answer held to the declared output, as the runtime holds it)
const Ajv2020 = require('ajv/dist/2020');
const valid = new Ajv2020({strict: false, allErrors: true}).compile(require('../schema.json').githubService.failedJobs.output);

test('a step without a conclusion is conclusion null; a null step is skipped', async () => {
  const answer = body('list_workflow_jobs');
  const failed = answer.jobs.jobs.find((j) => j.conclusion === 'failure');
  const last = failed.steps[failed.steps.length - 1];
  delete last.conclusion;
  failed.steps.push(null);
  const ctx = fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify(answer)}]}}});
  const {output} = await failedJobs({repo: 'mchen6/countinghouse', runId: '42775507169'}, ctx);
  const job = output.jobs.find((j) => j.jobId === String(failed.id));
  assert.strictEqual(job.steps.length, failed.steps.length - 1, 'the null step skipped');
  for (const s of job.steps) assert.deepStrictEqual(Object.keys(s), ['name', 'conclusion']);
  assert.deepStrictEqual(job.steps[job.steps.length - 1], {name: last.name, conclusion: null});
  assert.ok(valid(output), JSON.stringify(valid.errors));
});


test('a step\'s or a job\'s name GitHub leaves out, a conclusion that is no string, a step that is no object: the list stays whole and valid', async () => {
  const answer = body('list_workflow_jobs');
  const failed = answer.jobs.jobs.find((j) => j.conclusion === 'failure');
  failed.steps = [{name: null, conclusion: 'failure'}, {conclusion: 'success'}, {name: 'odd', conclusion: 0}, 'x', 7, {name: 'ok', conclusion: 'skipped'}];
  delete failed.name;
  const ctx = fakeCtx({actions_list: {result: {content: [{type: 'text', text: JSON.stringify(answer)}]}}});
  const {output} = await failedJobs({repo: 'mchen6/countinghouse', runId: '42775507169'}, ctx);
  assert.ok(valid(output), JSON.stringify(valid.errors));
  const job = output.jobs.find((j) => j.jobId === String(failed.id));
  assert.strictEqual(job.name, '');
  assert.deepStrictEqual(job.steps, [{name: '', conclusion: 'failure'}, {name: '', conclusion: 'success'}, {name: 'odd', conclusion: null}, {name: 'ok', conclusion: 'skipped'}]);
});
