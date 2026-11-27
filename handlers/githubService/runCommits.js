'use strict';
// ch-access-github/githubService.runCommits: {repo, commit} -> {commit,
// authorLogin}: the GitHub login of the commit's author, never a name or email.
const {request, causeOf, statusOf, refusalDetails} = require('../../lib/remote');
const {parseRepo, isSha, invalid} = require('../../lib/input');

module.exports = async (input, ctx) => {
  const where = parseRepo(input != null ? input.repo : null);
  if (where == null) throw invalid(ctx, 'repo must be "owner/name"');
  if (!isSha(input.commit)) throw invalid(ctx, 'commit must be a full 40-character commit SHA');
  // Only the fields read: names, emails and the message never cross into the module.
  const {error, body} = await request(ctx, 'runCommits', {...where, sha: input.commit, perPage: 1, fields: ['sha', 'author']});
  // An unknown SHA: GitHub answers 404 Not Found, or 422 "No commit found for SHA".
  // (a 404 is also what a repository the token cannot see answers: said so)
  if (error != null && statusOf(error) === 404) throw ctx.error('COMMIT_NOT_FOUND', `commit ${input.commit} is not in ${input.repo}, or the token cannot see ${input.repo} (404)`, {serverText: error});
  if (error != null && /\b422 Unprocessable Entity\b|No commit found/.test(error)) throw ctx.error('COMMIT_NOT_FOUND', `commit ${input.commit} is not in ${input.repo}`, {serverText: error});
  if (error != null) throw ctx.error('REMOTE_FAILED', `GitHub's server could not read commit ${input.commit}${causeOf(error, 'Contents')}`, refusalDetails(error));
  if (!Array.isArray(body)) throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered commit ${input.commit} with something that is not a list of commits`);
  const first = body[0];
  if (first == null || first.sha !== input.commit) throw ctx.error('COMMIT_NOT_FOUND', `commit ${input.commit} is not in ${input.repo}`);
  const login = first.author != null && typeof first.author.login === 'string' ? first.author.login : null;
  return {output: {commit: first.sha, authorLogin: login}};
};
