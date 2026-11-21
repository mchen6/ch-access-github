'use strict';
// The reviewer's whole-repo high on ch-access-github: the GitHub remote asks
// GitHub's MCP server for read-only tools (X-MCP-Readonly "takes precedence
// over any other configuration") within the narrowest toolsets that hold the
// tools this module calls, and names those tools. Both headers are GitHub's
// (https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md).
// X-MCP-Toolsets stays set: GitHub adds the tools X-MCP-Tools names to the
// toolsets (docs/server-configuration.md), and its docs don't say that
// X-MCP-Tools alone keeps the default toolsets off (the reviewer's ruling).
const test = require('node:test');
const assert = require('node:assert');
const pkg = require('../package.json');
const {TOOLS} = require('../lib/remote');

test('the GitHub remote is read-only, within the narrowest toolsets, and names the tools this module calls', () => {
  const [remote] = pkg.countinghouse.remotes;
  assert.strictEqual(remote.headers['X-MCP-Readonly'], 'true');
  const named = [...new Set(Object.values(TOOLS).map((t) => t.tool))].sort();
  assert.deepStrictEqual(remote.headers['X-MCP-Tools'].split(',').sort(), named, 'exactly the tools lib/remote.js names');
  assert.strictEqual(remote.headers['X-MCP-Toolsets'], 'actions,repos', 'the narrowest toolsets holding the three: never empty (the defaults)');
});
