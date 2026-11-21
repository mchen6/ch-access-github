# @countinghouse/ch-access-github

countinghouse access module for GitHub: workflow runs, failed jobs, job logs and commits through GitHub's remote MCP server, read-only, with a personal access token that the runtime sends to GitHub and this module never sees.

**Status: preview.** Runs on
[countinghouse](https://github.com/mchen6/countinghouse), which calls a
remote MCP server on a module's behalf. `npm run validate` checks the
`countinghouse.remotes` declaration against the pinned runtime. An access module of the countinghouse client
packs: a `part`, loaded by a scenario and never listed to the model on its own.

## What it does

`ch-access-github/githubService` reads GitHub Actions through GitHub's MCP
server (`https://api.githubcopilot.com/mcp/`), asking it for the
`actions` and `repos` toolsets only (`X-MCP-Toolsets`: the narrowest that
holds the three tools it calls, `actions_list`, `get_job_logs` and
`list_commits`, which it also names in `X-MCP-Tools`) and for read-only
tools only (`X-MCP-Readonly: true`, which GitHub applies over any other
setting). So the token is used with the read-only tools of those two
toolsets. GitHub adds the tools `X-MCP-Tools` names to the toolsets rather
than filtering them, and its docs don't say that `X-MCP-Tools` alone keeps
the server from loading its default toolsets, so the toolsets stay set. The
headers are GitHub's, in
https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md;
the server honours them, so they narrow what the token is used for, but the
token's own permissions are the boundary,
declared as the remote `github` in the short form, `"credential":
"GITHUB_TOKEN"`: the runtime sends it as `Authorization: Bearer <token>`,
and only to `https://api.githubcopilot.com`. The token is this module's
own credential, stored with `ch-local credentials add ch-access-github`
(a token an earlier release of ch-local stored is carried over; a
development home that bound one to 0.1.0 under `COUNTINGHOUSE_GITHUB_TOKEN`
adds it again). It is held by the
runtime and never reaches this module.

The token it needs: a fine-grained personal access token, limited to the
repositories you want triaged, with the repository permissions
**Actions: Read-only** and **Contents: Read-only** (GitHub adds
**Metadata: Read-only** itself). Nothing that writes. A classic token or a
`gh` login works too, but usually carries the `repo` scope, which can
write: if the headers above were ignored, it could reach far more than this
module reads. Prefer the fine-grained token.

| Action | Input | Output |
|---|---|---|
| `listRuns` | `{repo, branch?, limit<=100}` | `{runs: [{runId, conclusion, commit, branch, createdAt, workflow, url}]}`, with GitHub's own conclusion (null while in progress) and every workflow |
| `failedJobs` | `{repo, runId}` | `{jobs: [{jobId, name, conclusion, steps: [{name, conclusion}]}]}`, the failed and timed-out jobs, every page of them |
| `jobLog` | `{repo, jobId}` | `{text, lines, bytes, expired, truncated}`. A large log may come back as its tail, its last lines only: `truncated: true` says so. A log past retention or gone (410/404) is `expired: true`, not an error. Any other failure is `LOG_UNAVAILABLE`, with the server's text in `details.serverText` |
| `runCommits` | `{repo, commit}` | `{commit, authorLogin}`: a GitHub login, never a name or an email |

A refusal from GitHub is `REMOTE_FAILED` (`LOG_UNAVAILABLE` for a log), its message naming the cause the status gives: 401, the token refused; 403, access denied (the permission the action needs: Actions, or Contents for `runCommits`) or a rate limit; 429, a rate limit; and for `listRuns` and `failedJobs`, 404, not found or the token cannot see it. A 404 is `COMMIT_NOT_FOUND` for `runCommits` (the commit is not there, or the token cannot see the repository) and `expired: true` for `jobLog`. The server's own text is in `details.serverText`.

Every output object refuses fields it does not name. `lib/remote.js` is the
one place a tool is named, so a rename on GitHub's side is one table entry.

The tests run against responses recorded once from GitHub's server
(`test/fixtures/mcp-results`, described in its README). Tokens, emails,
names and log lines are scrubbed from them. No test calls GitHub.

Part of the countinghouse client packs. Each package has its own repository. The family's design and plan are in
[ch-packs](https://github.com/mchen6/ch-packs) (public); the end-to-end acceptance test, which installs every package and calls the
tool, runs in [ch-local](https://github.com/mchen6/ch-local)'s CI.

## Development

```
npm ci
npm test
npm run validate   # packs the module and runs countinghouse-validate on the tarball
```

Pure JavaScript, no native module. Node 22.16 or later, as countinghouse. CI
runs Node 24 on Linux, macOS and Windows.

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
