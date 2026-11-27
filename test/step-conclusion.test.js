'use strict';
// A step GitHub gives no conclusion (one that never started, in a cancelled
// job: a null the MCP server may omit) is a step with conclusion null, as the
// output's schema says; a step that is null itself is skipped. Neither loses
// the list.
const test = require('node:test');
const assert = require('node:assert');
const {fakeCtx, body} = require('./fake-ctx');
const failedJobs = require('../handlers/githubService/failedJobs');

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
});
