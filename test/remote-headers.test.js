'use strict';
// The reviewer's whole-repo high on ch-access-github: the GitHub remote asks
// GitHub's MCP server for read-only tools, and only the ones this module
// calls. Both headers are GitHub's
// (https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md;
// X-MCP-Readonly "takes precedence over any other configuration"). With no
// X-MCP-Toolsets: GitHub adds the tools X-MCP-Tools names to the toolsets
// (docs/server-configuration.md, "Enabling Toolsets + Tools"), so a
// toolset sent with them would widen the list, not narrow it.
const test = require('node:test');
const assert = require('node:assert');
const pkg = require('../package.json');
const {TOOLS} = require('../lib/remote');

test('the GitHub remote is read-only and limited to the tools this module calls', () => {
  const [remote] = pkg.countinghouse.remotes;
  assert.strictEqual(remote.headers['X-MCP-Readonly'], 'true');
  const named = [...new Set(Object.values(TOOLS).map((t) => t.tool))].sort();
  assert.deepStrictEqual(remote.headers['X-MCP-Tools'].split(',').sort(), named, 'exactly the tools lib/remote.js names');
  assert.ok(!('X-MCP-Toolsets' in remote.headers), 'no toolset: it would add every tool in it');
});
