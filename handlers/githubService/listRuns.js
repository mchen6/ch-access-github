'use strict';
// ch-access-github/githubService.listRuns: {repo, branch?, limit} -> {runs}.
const {request, causeOf} = require('../../lib/remote');
const {parseRepo, isId, invalid} = require('../../lib/input');

const text = (v) => typeof v === 'string' && v !== '';
const whole = (v) => Number.isSafeInteger(v) && v >= 1;
// What a run can't be listed without: an answer missing one is refused whole,
// never a partial list. (What GitHub may leave out -- a run's branch, name or
// workflow id -- loses nothing.)
const NEEDED = {id: (v) => whole(v) || isId(v), head_sha: text, created_at: text, html_url: text};
const lacking = (r) => Object.keys(NEEDED).find((k) => r == null || !NEEDED[k](r[k]));

module.exports = async (input, ctx) => {
  const where = parseRepo(input != null ? input.repo : null);
  if (where == null) throw invalid(ctx, 'repo must be "owner/name"');
  const {branch, limit} = input;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid(ctx, 'limit must be an integer from 1 to 100');
  if (branch !== undefined && (typeof branch !== 'string' || branch === '')) throw invalid(ctx, 'branch, when given, must be a branch name');
  const {error, body} = await request(ctx, 'listRuns', {...where, perPage: limit, ...(branch !== undefined ? {workflow_runs_filter: {branch}} : {})});
  if (error != null) throw ctx.error('REMOTE_FAILED', `GitHub's server could not list the runs of ${input.repo}${causeOf(error)}`, {serverText: error});
  if (body == null || !Array.isArray(body.workflow_runs)) throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the runs of ${input.repo} without a runs list`);
  const listed = body.workflow_runs.slice(0, limit);
  for (const r of listed) {
    const field = lacking(r);
    if (field !== undefined) throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the runs of ${input.repo} with a run that has no usable ${field}`);
  }
  // Only these fields leave, attempt (a re-run keeps its run id) and workflowId
  // only when GitHub's is a whole number from 1: head_commit (names and emails)
  // never does. GitHub's server drops a null branch and sends a null name as "":
  // whichever way one is missing, branch is null and workflow is "".
  const runs = listed.map((r) => ({
    runId: String(r.id),
    conclusion: r.conclusion != null ? r.conclusion : null, // null while the run is in progress
    commit: r.head_sha,
    branch: text(r.head_branch) ? r.head_branch : null,
    createdAt: r.created_at,
    workflow: text(r.name) ? r.name : '',
    url: r.html_url,
    ...(whole(r.run_attempt) ? {attempt: r.run_attempt} : {}),
    ...(whole(r.workflow_id) ? {workflowId: String(r.workflow_id)} : {})
  }));
  return {output: {runs}};
};
