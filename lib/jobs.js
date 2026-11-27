'use strict';
// A run's failed jobs, every page of them.
const {request, causeOf, refusalDetails} = require('./remote');

const FAILED = new Set(['failure', 'timed_out']);
const MAX_PAGES = 10; // 1,000 jobs at 100 a page; GitHub's matrix limit is 256

async function collectFailedJobs(ctx, {owner, repo, runId}, perPage) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const {error, body} = await request(ctx, 'failedJobs', {owner, repo, resource_id: runId, perPage, page});
    if (error != null) throw ctx.error('REMOTE_FAILED', `GitHub's server could not list the jobs of run ${runId}${causeOf(error)}`, refusalDetails(error));
    // The server nests the list: {jobs: {total_count, jobs: [...]}}.
    const list = body != null && body.jobs != null && Array.isArray(body.jobs.jobs) ? body.jobs.jobs : null;
    if (list == null || !Number.isInteger(body.jobs.total_count)) throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the jobs of run ${runId} without a jobs list and its total_count`);
    all.push(...list);
    if (list.length === 0 || !(all.length < body.jobs.total_count)) return failedOf(ctx, runId, all);
  }
  throw ctx.error('JOBS_INCOMPLETE', `run ${runId} has more jobs than ${MAX_PAGES} pages of ${perPage} hold`);
}

// A failed job is compared with the job of the same name in other runs, so
// one without a name refuses the answer: two that lost their names must never
// read as one job.
function failedOf(ctx, runId, all) {
  const failed = all.filter((j) => j != null && FAILED.has(j.conclusion));
  if (failed.some((j) => typeof j.name !== 'string' || j.name === '')) {
    throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the jobs of run ${runId} with a failed job that has no name`);
  }
  return failed
    .map((j) => ({
      jobId: String(j.id),
      name: j.name,
      conclusion: j.conclusion,
      // (a step with no conclusion -- one that never started, whose null
      // the server may leave out -- or one that is no string is conclusion
      // null; a step's name left out is '', and a step that is no object is
      // a step with neither, so every step keeps its place for matching by
      // position)
      steps: (Array.isArray(j.steps) ? j.steps : []).map((s) => (s != null && typeof s === 'object'
        ? {name: typeof s.name === 'string' ? s.name : '', conclusion: typeof s.conclusion === 'string' ? s.conclusion : null}
        : {name: '', conclusion: null}))
    }));
}

module.exports = {collectFailedJobs};
