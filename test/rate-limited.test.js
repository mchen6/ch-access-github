'use strict';
// A refusal GitHub gives for a rate limit carries details.rateLimited: true,
// beside the server's text, so a caller can stop calling (GitHub warns that
// calling on while rate limited may ban the integration) without reading
// words. Set only when the limit is certain: a 429, or a 403 whose text names
// a rate limit; a bare 403 may be a permission, and carries no flag.
const test = require('node:test');
const assert = require('node:assert');
const {fakeCtx} = require('./fake-ctx');
const failedJobs = require('../handlers/githubService/failedJobs');
const listRuns = require('../handlers/githubService/listRuns');
const jobLog = require('../handlers/githubService/jobLog');
const runCommits = require('../handlers/githubService/runCommits');

const refused = (text) => ({result: {content: [{type: 'text', text}], isError: true}});
const TOO_MANY = 'failed to list workflow jobs: GET https://github.invalid/repos/o/r/actions/runs/5/jobs: 429 Too Many Requests []';
const LIMIT_403 = 'failed to list workflow jobs: GET https://github.invalid/repos/o/r/actions/runs/5/jobs: 403 You have exceeded a secondary rate limit []';
const FORBIDDEN = 'failed to list workflow jobs: GET https://github.invalid/repos/o/r/actions/runs/5/jobs: 403 Forbidden []';

const flagOf = async (p) => {
  try { await p; } catch (err) { return [err.code, err.details != null ? err.details.rateLimited : undefined, err.details != null ? typeof err.details.serverText : undefined]; }
  throw new Error('not refused');
};

test('a job listing refused for a rate limit says so in its details: 429, and a 403 that names one', async () => {
  assert.deepStrictEqual(await flagOf(failedJobs({repo: 'o/r', runId: '5'}, fakeCtx({actions_list: refused(TOO_MANY)}))), ['REMOTE_FAILED', true, 'string']);
  assert.deepStrictEqual(await flagOf(failedJobs({repo: 'o/r', runId: '5'}, fakeCtx({actions_list: refused(LIMIT_403)}))), ['REMOTE_FAILED', true, 'string']);
});

test('a bare 403, or any other refusal, carries no rate-limit flag', async () => {
  assert.deepStrictEqual(await flagOf(failedJobs({repo: 'o/r', runId: '5'}, fakeCtx({actions_list: refused(FORBIDDEN)}))), ['REMOTE_FAILED', undefined, 'string']);
  assert.deepStrictEqual(await flagOf(failedJobs({repo: 'o/r', runId: '5'}, fakeCtx({actions_list: refused('failed: unexpected status code: 502 Bad Gateway')}))), ['REMOTE_FAILED', undefined, 'string']);
  // (a number in the text that is no status, "4291 requests", is not a 429)
  assert.deepStrictEqual(await flagOf(failedJobs({repo: 'o/r', runId: '5'}, fakeCtx({actions_list: refused('failed: 4291 requests left')}))), ['REMOTE_FAILED', undefined, 'string']);
});

test('every action\'s refusal carries the flag the same way: runs, a log, a commit', async () => {
  assert.deepStrictEqual(await flagOf(listRuns({repo: 'o/r', limit: 5}, fakeCtx({actions_list: refused(TOO_MANY)}))), ['REMOTE_FAILED', true, 'string']);
  assert.deepStrictEqual(await flagOf(jobLog({repo: 'o/r', jobId: '7'}, fakeCtx({get_job_logs: refused(TOO_MANY)}))), ['LOG_UNAVAILABLE', true, 'string']);
  assert.deepStrictEqual(await flagOf(runCommits({repo: 'o/r', commit: 'a'.repeat(40)}, fakeCtx({list_commits: refused(TOO_MANY)}))), ['REMOTE_FAILED', true, 'string']);
});
