#!/usr/bin/env node
/**
 * 用 GitHub Contents API 推送，绕过被阻断的 github.com:443。
 * 适用：仓库刚初始化、文件数与体积在 API 限制内（单文件 < 25MB，推荐 < 1MB）。
 *
 * 用法：node scripts/api-push.mjs --message "提交说明" [--dry]
 *
 * 行为：
 * - 以远端 main 为基线，比较本地 HEAD 的文件树，只推差异
 * - 每个文件一次 PUT（新建/更新）或 DELETE
 * - 空仓库会先放一个占位 README 完成初始化
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = 'TobeMagic/interview-notes';
const BRANCH = 'main';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const msgIdx = argv.indexOf('--message');
const MESSAGE = msgIdx >= 0 ? argv[msgIdx + 1] : 'chore: 更新内容';
const DRY = argv.includes('--dry');

function token() {
  return execSync('gh auth token', { encoding: 'utf8' }).trim();
}
const TOKEN = token();

async function api(pathname, { method = 'GET', body = null } = {}) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'interview-notes-publisher',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} → ${res.status} ${json?.message || ''}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** 取远端分支当前文件 → sha 映射 */
async function remoteTree() {
  try {
    const data = await api(`/repos/${REPO}/git/trees/${BRANCH}?recursive=1`);
    const map = new Map();
    for (const item of data.tree) {
      if (item.type === 'blob') map.set(item.path, item.sha);
    }
    return map;
  } catch (e) {
    if (e.status === 404 || e.status === 409) return new Map();
    throw e;
  }
}

async function main() {
  const localFiles = git('ls-files').split('\n').filter(Boolean);
  const localHead = git('rev-parse HEAD').slice(0, 7);
  console.log(`本地 ${localFiles.length} 个文件 @ ${localHead}`);

  const remote = await remoteTree();
  console.log(`远端 ${remote.size} 个文件`);

  // 计算差异：内容 hash 不同即需更新
  const toWrite = [];
  const toDelete = [];
  for (const f of localFiles) {
    const buf = fs.readFileSync(path.join(ROOT, f));
    // git blob sha = sha1("blob <len>\0" + content)
    const sha = execSync(`git hash-object ${JSON.stringify(path.join(ROOT, f))}`, {
      encoding: 'utf8',
    }).trim();
    if (remote.get(f) !== sha) toWrite.push({ path: f, buf, sha });
  }
  for (const f of remote.keys()) {
    if (!localFiles.includes(f)) toDelete.push(f);
  }

  console.log(`需要写入 ${toWrite.length}，删除 ${toDelete.length}`);
  if (DRY) {
    toWrite.forEach((t) => console.log(`  + ${t.path} (${(t.buf.length / 1024).toFixed(1)}k)`));
    toDelete.forEach((d) => console.log(`  - ${d}`));
    return;
  }
  if (!toWrite.length && !toDelete.length) {
    console.log('已是最新，无需推送');
    return;
  }

  // 逐文件 PUT / DELETE
  let done = 0;
  for (const item of toWrite) {
    const existing = remote.get(item.path);
    const body = {
      message: MESSAGE,
      content: item.buf.toString('base64'),
      branch: BRANCH,
    };
    if (existing) body.sha = existing;
    await api(`/repos/${REPO}/contents/${encodeURI(item.path)}`, { method: 'PUT', body });
    done++;
    process.stdout.write(`\r  写入 ${done}/${toWrite.length}`);
  }
  for (const f of toDelete) {
    const body = { message: MESSAGE, sha: remote.get(f), branch: BRANCH };
    await api(`/repos/${REPO}/contents/${encodeURI(f)}`, { method: 'DELETE', body });
  }
  console.log('');
  console.log(`✓ 已推送到 https://github.com/${REPO}`);
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
