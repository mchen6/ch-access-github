# @countinghouse/ch-access-github

countinghouse access module for GitHub: workflow runs, failed jobs, job logs and commits through GitHub's remote MCP server, read-only, with a personal access token that the runtime sends to GitHub and this module never sees.

**Status: preview, waiting for the runtime's remotes (RC1-min).** Runs on
[countinghouse](https://github.com/mchen6/countinghouse) once it can call a
remote MCP server on a module's behalf. The `countinghouse.remotes`
declaration in package.json is the pack plan's, and cannot be validated
until that runtime exists. An access module of the countinghouse client
packs: a `part`, loaded by a scenario and never listed to the model on its own.

## What it does

`ch-access-github/githubService` reads GitHub Actions through GitHub's MCP
server (`https://api.githubcopilot.com/mcp/`, toolsets `actions,repos`),
declared as the remote `github`. The token comes from
`COUNTINGHOUSE_GITHUB_TOKEN` (or `GITHUB_TOKEN`), is held by the runtime,
and never reaches this module.

| Action | Input | Output |
|---|---|---|
| `listRuns` | `{repo, branch?, limit<=100}` | `{runs: [{runId, conclusion, commit, branch, createdAt, workflow, url}]}`, with GitHub's own conclusion (null while in progress) and every workflow |
| `failedJobs` | `{repo, runId}` | `{jobs: [{jobId, name, conclusion, steps: [{name, conclusion}]}]}`, the failed and timed-out jobs, every page of them |
| `jobLog` | `{repo, jobId}` | `{text, lines, bytes, expired, truncated}`. A log past retention or gone (410/404) is `expired: true`, not an error. Any other failure is `LOG_UNAVAILABLE`, with the server's text in `details.serverText` |
| `runCommits` | `{repo, commit}` | `{commit, authorLogin}`: a GitHub login, never a name or an email |

Every output object refuses fields it does not name. `lib/remote.js` is the
one place a tool is named, so a rename on GitHub's side is one table entry.

The tests run against responses recorded once from GitHub's server
(`test/fixtures/mcp-results`, described in its README). Tokens, emails,
names and log lines are scrubbed from them. No test calls GitHub.

Part of the countinghouse client packs. Each package has its own repository; the family's design, plan and
acceptance tests are in a repository that stays private until the first
release.

## Development

```
npm ci
npm test
npm run validate   # packs the module and runs countinghouse-validate on the tarball
```

Pure JavaScript, no native module. Node 24 or later today (the runtime's
floor); 22.16 once countinghouse's floor shim lands (design). CI runs on
Linux, macOS and Windows.

## Publishing

Releases are published by `.github/workflows/publish.yml` under npm
trusted publishing: a `v<version>` tag on a `main` commit whose
package.json carries that version. No npm token exists anywhere and no 2FA
code is typed for a release. One-time setup on npmjs.com, by the
maintainer: the package's first version is published by hand (`npm publish
--access public`, with 2FA); then **Settings → Trusted publishing → GitHub
Actions** with owner `mchen6`, repository `ch-access-github`, workflow
`publish.yml`, allowing `npm publish` as well as `npm stage publish`;
then **Settings → Publishing access → Require two-factor authentication
and disallow tokens**. A new trusted-publisher configuration must publish
once within two days or it expires.

## License

Apache-2.0.
