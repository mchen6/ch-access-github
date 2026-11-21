'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {TOOLS} = require('../lib/remote');

const ROOT = path.join(__dirname, '..');
const handlers = fs.readdirSync(path.join(ROOT, 'handlers', 'githubService')).map((f) => path.join(ROOT, 'handlers', 'githubService', f));
const NAMES = ['actions_list', 'actions_get', 'get_job_logs', 'list_commits', 'get_commit', 'list_workflow_runs', 'list_workflow_jobs', 'remote:github'];

test('a tool rename is one table entry: no handler names a tool', () => {
  for (const file of handlers) {
    const src = fs.readFileSync(file, 'utf8');
    for (const name of NAMES) assert.ok(!src.includes(name), `${path.basename(file)} names ${name}`);
  }
  for (const file of fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f !== 'remote.js')) {
    const src = fs.readFileSync(path.join(ROOT, 'lib', file), 'utf8');
    for (const name of NAMES) assert.ok(!src.includes(name), `lib/${file} names ${name}`);
  }
});

// countinghouse's logger step 1 removed the DeviceError and CHError globals:
// a module's own failure is ctx.error with its own code.
test('no handler or lib file reaches for an error global the runtime no longer gives', () => {
  const files = [...handlers, ...fs.readdirSync(path.join(ROOT, 'lib')).map((f) => path.join(ROOT, 'lib', f))];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/new (DeviceError|CHError)\b|\b(DeviceError|CHError)\(/.test(src), `${path.relative(ROOT, file)} uses a removed error global`);
  }
});

test('every tool in the table is one the recorded server offers', () => {
  const offered = new Set(require('./fixtures/mcp-results/tools-list.json').tools.map((t) => t.name));
  for (const [action, {tool}] of Object.entries(TOOLS)) assert.ok(offered.has(tool), `${action} -> ${tool}`);
});

// #413 rev 3 section 6.1 (P2): the short form. "credential": "GITHUB_TOKEN"
// is {"env": "GITHUB_TOKEN", "header": "Authorization", "scheme": "Bearer"},
// and the transport defaults to "streamable-http". No fallbackEnv: under a
// version 2 credentials file the credential is the module's own, stored by
// `ch-local credentials add ch-access-github`.
test('the package declares the GitHub remote in the short form', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {
    role: 'part',
    remotes: [{name: 'github', url: 'https://api.githubcopilot.com/mcp/', headers: {'X-MCP-Readonly': 'true', 'X-MCP-Tools': 'actions_list,get_job_logs,list_commits'}, credential: 'GITHUB_TOKEN'}]
  });
});

// Reviewer, PR #35: "never a name or email" is the schema's guarantee too.
test('every output object in the schema forbids fields it does not name', () => {
  const schema = require('../schema.json');
  const objects = [];
  const walk = (node, where) => {
    if (node == null || typeof node !== 'object') return;
    if (node.type === 'object' && node.properties != null) objects.push([where, node]);
    for (const [k, v] of Object.entries(node)) walk(v, `${where}.${k}`);
  };
  for (const [action, s] of Object.entries(schema.githubService)) walk(s.output, `${action}.output`);
  assert.ok(objects.length >= 6, `found ${objects.length} output objects`);
  for (const [where, node] of objects) assert.strictEqual(node.additionalProperties, false, where);
});
