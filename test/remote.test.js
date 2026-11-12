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

test('every tool in the table is one the recorded server offers', () => {
  const offered = new Set(require('./fixtures/mcp-results/tools-list.json').tools.map((t) => t.name));
  for (const [action, {tool}] of Object.entries(TOOLS)) assert.ok(offered.has(tool), `${action} -> ${tool}`);
});

test('the package declares the GitHub remote exactly as the plan writes it', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {
    role: 'part',
    remotes: [{name: 'github', transport: 'streamable-http', url: 'https://api.githubcopilot.com/mcp/', headers: {'X-MCP-Toolsets': 'actions,repos'}, credential: {env: 'COUNTINGHOUSE_GITHUB_TOKEN', fallbackEnv: 'GITHUB_TOKEN', header: 'Authorization', scheme: 'Bearer'}}]
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
