'use strict';
// Input checks shared by the githubService handlers.

// 'owner/name' -> {owner, repo}, or null.
function parseRepo(value) {
  if (typeof value !== 'string') return null;
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(value);
  if (m == null || m[2] === '.' || m[2] === '..') return null;
  return {owner: m[1], repo: m[2]};
}

const isId = (v) => typeof v === 'string' && /^[1-9]\d{0,15}$/.test(v) && Number.isSafeInteger(Number(v));
const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);

// a handler's own check: the module's own code through the runtime's ctx.error
// (countinghouse's logger step 1 removed the DeviceError global, and a
// catalogue code such as ARGUMENTS_INVALID is the runtime's, not a module's)
const invalid = (ctx, message) => ctx.error('INPUT_REJECTED', message);

module.exports = {parseRepo, isId, isSha, invalid};
