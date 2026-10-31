#!/usr/bin/env node
/**
 * 极简静态站点生成器。
 * 输入：content/<slug>.md + site.config.mjs
 * 输出：dist/index.html、dist/<slug>/index.html、dist/assets/*
 *
 * 生成的内容：
 * - 首页：刊物式 masthead + 可筛选总表 + 样张
 * - 模块页：左侧目录 + 正文，每个二级标题一个锚点
 * - 题下的「**面经**」块会被渲染成带公司标签的引用条
 * - 「**一句话**」被提成导语
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { SITE, MODULES, GROUPS } from './site.config.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
const SERVE = args.includes('--serve');
const CHECK = args.includes('--check');

/* ------------------------------------------------------------------ */
/* 渲染                                                                */
/* ------------------------------------------------------------------ */

marked.setOptions({ gfm: true, breaks: false });

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\u4e00-\u9fa5\- ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'sec';

/** 从 markdown 提结构 */
function parseDoc(md, mod) {
  const lines = md.split('\n');
  const sections = [];      // { id, level, text, bodyStart }
  const out = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^##\s+/.test(line)) {
      const text = line.replace(/^##\s+/, '').trim();
      sections.push({ id: slugify(text), level: 2, text, line: i });
    }
    if (!inFence && /^###\s+/.test(line)) {
      const text = line.replace(/^###\s+/, '').trim();
      sections.push({ id: slugify(text), level: 3, text, line: i });
    }
    out.push(line);
  }

  // 给标题加锚点
  let fence = false;
  const withAnchors = lines.map((line) => {
    if (/^```/.test(line)) fence = !fence;
    if (fence) return line;
    const m2 = line.match(/^##\s+(.*)$/);
    if (m2) return `<h2 id="${slugify(m2[1])}">${m2[1]}</h2>`;
    const m3 = line.match(/^###\s+(.*)$/);
    if (m3) return `<h3 id="${slugify(m3[1])}">${m3[1]}</h3>`;
    return line;
  });

  return { sections: sections.filter((s) => s.level === 2), md: withAnchors.join('\n') };
}

/** 把「**面经**：xxx」「**面经**：」「面经：」后面的内容包成引用条 */
function transformCitations(html) {
  // markdown 里形如 **面经**：后续文本（通常到下一个空行为止）
  return html.replace(
    /<p><strong>面经<\/strong>[：:]\s*([\s\S]*?)<\/p>/g,
    (_, inner) => {
      const txt = inner.trim();
      if (!txt) return '<p class="cite cite--empty"><span class="cite-tag">面经</span>暂无已核对的公开原题。</p>';
      return `<div class="cite"><span class="cite-tag">面经</span><div class="cite-body">${txt}</div></div>`;
    }
  );
}

/** 「一句话」提成导语 */
function transformOneLiner(html) {
  return html.replace(
    /<p><strong>一句话<\/strong>[：:]\s*([\s\S]*?)<\/p>/g,
    (_, inner) => `<p class="lead-line"><span class="lead-tag">一句话</span>${inner.trim()}</p>`
  );
}

/** 统计信息 */
function statsOf(md) {
  const cn = (md.match(/[\u4e00-\u9fa5]/g) || []).length;
  const cites = (md.match(/\*\*面经\*\*/g) || []).length;
  const oneLiners = (md.match(/\*\*一句话\*\*/g) || []).length;
  const questions = oneLiners || null;
  return { chars: cn, cites, questions };
}

/* ------------------------------------------------------------------ */
/* 模板                                                                */
/* ------------------------------------------------------------------ */

const CSS = fs.readFileSync(path.join(ROOT, 'assets', 'style.css'), 'utf8');

function shell({ title, body, bodyClass = '', depth = 0 }) {
  // 用相对路径，本地 file:// 预览和 GitHub Pages 子路径都能直接打开
  const up = '../'.repeat(depth);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(SITE.description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(SITE.description)}">
<link rel="stylesheet" href="${up}assets/style.css">
</head>
<body class="${bodyClass}">
${body}
<script src="${up}assets/site.js" defer></script>
</body>
</html>`;
}

function masthead({ depth = 0 } = {}) {
  const up = '../'.repeat(depth);
  const home = depth === 0 ? './' : up;
  return `
<header class="masthead">
  <div class="mast-inner">
    <div class="mast-top">
      <span>Vol.01 — 二〇二六年</span>
      <span>前端 · Node · Go · 数据库</span>
      <span>开源 · 持续修订</span>
    </div>
    <div class="mast-title">
      <a href="${home}" class="brand"><h1>${SITE.title}</h1><span class="brand-sub">${SITE.subtitle}</span></a>
      <nav class="mast-nav">
        ${GROUPS.map((g) => `<a href="${home}#g-${encodeURIComponent(g)}">${g}</a>`).join('')}
        <a href="${SITE.repo}" target="_blank" rel="noopener" class="nav-gh">GitHub ↗</a>
      </nav>
    </div>
  </div>
</header>`;
}

function footer(doneCount) {
  return `
<footer class="site-foot">
  <div class="foot-inner">
    <div class="foot-col">
      <div class="foot-mark">${SITE.title}</div>
      <p>开源面试笔记。${doneCount} / ${MODULES.length} 篇完稿，其余为题目大纲。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">规矩</div>
      <p>同一场面试连着追问的，合成一节。<br>换了机制才另开一节。<br>过时的答案标版本分界。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">来源</div>
      <p>答案以官方文档为准。<br>面经只留公司、轮次、原题、链接。<br>不搬他人答案正文。</p>
    </div>
    <div class="foot-col">
      <div class="foot-h">License</div>
      <p>${SITE.license}<br><a href="${SITE.repo}" target="_blank" rel="noopener">${SITE.repo.replace('https://', '')}</a></p>
    </div>
  </div>
</footer>`;
}

/* ------------------------------------------------------------------ */
/* 首页                                                                */
/* ------------------------------------------------------------------ */

function buildIndex(docs) {
  const done = MODULES.filter((m) => m.status === 'done');
  const totalCites = docs.reduce((a, d) => a + (d.stats?.cites || 0), 0);
  const totalChars = docs.reduce((a, d) => a + (d.stats?.chars || 0), 0);

  const rows = GROUPS.map((g) => {
    const items = MODULES.filter((m) => m.group === g);
    return items
      .map((m, i) => {
        const d = docs.find((x) => x.mod.slug === m.slug);
        const s = d?.stats || {};
        const idx = String(MODULES.indexOf(m) + 1).padStart(2, '0');
        return `<tr data-group="${g}" data-status="${m.status}">
          <td class="c-num">${idx}</td>
          <td class="c-name"><a href="./${m.slug}/"><span class="n">${esc(m.title)}</span><small>${esc(m.counterpart)}</small></a></td>
          <td class="c-sec">${d ? d.sections.filter((x) => !/面经|汇总|这一章没写|依据/.test(x.text)).length : '—'} 节</td>
          <td class="c-q">${s.questions ? s.questions : (d ? d.sections.length : '—')}</td>
          <td class="c-status"><span class="st st--${m.status}">${m.status === 'done' ? '完稿' : '大纲'}</span></td>
          <td class="c-go">→</td>
        </tr>`;
      })
      .join('');
  }).join('');

  const sample = docs.find((d) => d.mod.slug === 'go-language') || docs[0];
  const sampleHtml = sample ? extractSample(sample) : '';

  const body = `
${masthead()}
<main>
  <section class="lead">
    <div class="lead-main">
      <div class="kicker">本期要目</div>
      <h2>把「面试会问什么」写成<em>可以照着背、也可以照着查</em>的东西。</h2>
      <p class="drop">市面上讲 Java 的八股文已经足够多，前端、Node、Go 和 PostgreSQL 这一侧却散落在面经帖、博客和口口相传里。这本册子按模块收拢：每一节先给一句能直接说出口的答案，再展开，再列会被追问什么。</p>
      <p>公司原题挂在题下，只留<strong>公司、轮次、原题一句、链接</strong>。不搬别人的答案，关键结论标注官方文档出处。</p>
      <p>网上大量答案已经过时。<strong>Go 1.24 的 map 不再是分桶加溢出桶，TypeScript 7 的编译器已经是 Go 写的原生端口</strong>——这类版本分界在正文里逐条标出。</p>
    </div>
    <aside class="lead-side">
      <div class="side-h">这册子的三条规矩</div>
      <ol class="rules">
        <li><b>合并</b>同一场面试会连着追问的，合成一节讲完</li>
        <li><b>拆分</b>换了机制才另开一节，不硬把 Java 题翻过来</li>
        <li><b>时效</b>过时的答案标出版本分界，不装作没变</li>
      </ol>
      <div class="side-stats">
        <div><b>${MODULES.length}</b><span>篇</span></div>
        <div><b>${done.length}</b><span>完稿</span></div>
        <div><b>${totalCites}</b><span>处原题</span></div>
        <div><b>${(totalChars / 1000).toFixed(1)}k</b><span>汉字</span></div>
      </div>
    </aside>
  </section>

  <section class="catalog">
    <div class="sec-head"><h2>目录</h2><div class="fill"></div><span class="cnt">${MODULES.length} 篇 / ${done.length} 篇完稿</span></div>
    <div class="filters" role="group" aria-label="筛选">
      <button class="on" data-filter="all">全部 ${MODULES.length}</button>
      ${GROUPS.map((g) => `<button data-filter="${g}">${g} ${MODULES.filter((m) => m.group === g).length}</button>`).join('')}
      <button data-filter="done">已完稿 ${done.length}</button>
    </div>
    <table class="tbl">
      <thead><tr><th class="c-num">#</th><th>模块</th><th class="c-sec">章节</th><th class="c-q">题</th><th class="c-status">状态</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  ${sampleHtml}

  <section class="cta">
    <div class="cta-inner">
      <div>
        <h3>发现错误，或者有更好的答法？</h3>
        <p>内容以官方文档为准。面经只作线索，不搬他人答案正文。提交 PR 时请附上出处。</p>
      </div>
      <a class="cta-btn" href="${SITE.repo}" target="_blank" rel="noopener">在 GitHub 上查看 ↗</a>
    </div>
  </section>
</main>
${footer(done.length)}`;
  return shell({ title: `${SITE.title} · ${SITE.subtitle}`, body, bodyClass: 'page-home' });
}

function extractSample(doc) {
  const md = doc.raw;
  const blocks = md.split(/\n(?=##\s)/);
  const pick = blocks.find((b) => /^##\s+4\./.test(b)) || blocks[1] || '';
  const lines = pick.split('\n').slice(0, 26).join('\n');
  const html = transformCitations(marked.parse(lines));
  return `<section class="excerpt">
    <div class="rail">
      <div class="kicker">样张</div>
      <div class="big">${esc(doc.mod.title).slice(0, 2)}</div>
      <div class="src">摘自「${esc(doc.mod.title)}」<br>${doc.stats.chars} 字 / ${doc.stats.cites} 处原题</div>
    </div>
    <div class="excerpt-body">${html}</div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* 模块页                                                              */
/* ------------------------------------------------------------------ */

function buildModule(doc, allDocs) {
  const { mod, raw, sections } = doc;
  const toc = sections
    .filter((s) => !/这一章没写|依据/.test(s.text))
    .map((s) => `<a href="#${s.id}" class="toc-a">${esc(s.text)}</a>`)
    .join('');

  // 去掉第一个 H1 和紧随其后的「答案不在这里」这类说明，正文自己带
  let md = raw.replace(/^#\s+.*\n/, '');
  md = md.replace(/^答案不在这里。\n?/m, '');

  let html = marked.parse(md);
  html = transformCitations(html);
  html = transformOneLiner(html);

  const pos = MODULES.findIndex((m) => m.slug === mod.slug);
  const prev = MODULES[pos - 1];
  const next = MODULES[pos + 1];

  const body = `
${masthead({ depth: 1 })}
<div class="doc-shell">
  <aside class="doc-side">
    <div class="doc-side-inner">
      <div class="side-group">本册</div>
      ${GROUPS.map((g) => `
        <div class="side-group">${g}</div>
        ${MODULES.filter((m) => m.group === g)
          .map((m) => `<a href="../${m.slug}/" class="side-link ${m.slug === mod.slug ? 'on' : ''}">
            <span>${esc(m.title)}</span>
            ${m.status === 'done' ? '<i class="dot dot--done"></i>' : '<i class="dot"></i>'}
          </a>`)
          .join('')}`).join('')}
    </div>
  </aside>

  <main class="doc-main">
    <div class="doc-crumb">
      <a href="../">${SITE.title}</a><span>/</span><span>${mod.group}</span><span>/</span><b>${esc(mod.title)}</b>
      <span class="crumb-status st st--${mod.status}">${mod.status === 'done' ? '完稿' : '大纲'}</span>
    </div>

    <header class="doc-head">
      <div class="doc-no">${String(pos + 1).padStart(2, '0')}</div>
      <h1>${esc(mod.title)}</h1>
      <p class="doc-sub">对标 ${esc(mod.counterpart)}</p>
      <div class="doc-meta">
        <span>${sections.length} 节</span>
        <span>${doc.stats.chars} 汉字</span>
        <span>${doc.stats.cites} 处面经</span>
      </div>
      ${mod.status === 'outline' ? '<div class="doc-warn">这一篇目前只有题目大纲：列出要写的题和已核对的面经出处，口述答案待补。</div>' : ''}
    </header>

    <nav class="doc-toc">
      <div class="toc-h">本章目录</div>
      ${toc}
    </nav>

    <article class="doc-body">
      ${html}
    </article>

    <nav class="doc-pager">
      ${prev ? `<a class="pager prev" href="../${prev.slug}/"><span>上一篇</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}
      ${next ? `<a class="pager next" href="../${next.slug}/"><span>下一篇</span><b>${esc(next.title)}</b></a>` : '<span></span>'}
    </nav>
  </main>
</div>
${footer(MODULES.filter((m) => m.status === 'done').length)}`;
  return shell({ title: `${mod.title} · ${SITE.title}`, body, bodyClass: 'page-doc', depth: 1 });
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

  const docs = [];
  for (const mod of MODULES) {
    const file = path.join(CONTENT, `${mod.slug}.md`);
    if (!fs.existsSync(file)) {
      if (CHECK) console.warn(`⚠️  缺少内容：content/${mod.slug}.md`);
      continue;
    }
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = parseDoc(raw, mod);
    docs.push({
      mod,
      raw,
      md: parsed.md,
      sections: parsed.sections,
      stats: statsOf(raw),
    });
  }

  // 资源
  fs.writeFileSync(path.join(DIST, 'assets', 'style.css'), CSS);
  const jsSrc = path.join(ROOT, 'assets', 'site.js');
  if (fs.existsSync(jsSrc)) {
    fs.copyFileSync(jsSrc, path.join(DIST, 'assets', 'site.js'));
  }

  // 首页
  fs.writeFileSync(path.join(DIST, 'index.html'), buildIndex(docs));

  // 模块页
  for (const doc of docs) {
    const dir = path.join(DIST, doc.mod.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildModule(doc, docs));
  }

  // 404（Pages 用在子路径）
  fs.writeFileSync(
    path.join(DIST, '404.html'),
    shell({
      title: `404 · ${SITE.title}`,
      body: `${masthead()}<main class="notfound"><h1>404</h1><p>这一页不存在，或者还没写。</p><a href="./">回目录</a></main>${footer(2)}`,
    })
  );

  // .nojekyll 让 GitHub Pages 不做 Jekyll 处理
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  const total = docs.length;
  console.log(`✓ 生成 ${total} 篇 + 首页 → dist/`);
  if (CHECK) {
    for (const d of docs) {
      const missing = d.sections.filter((s) => /要写的题|面经/.test(s.text)).length;
      console.log(`  ${d.mod.slug.padEnd(16)} ${String(d.stats.chars).padStart(5)} 字  ${String(d.stats.cites).padStart(2)} 处面经  ${d.sections.length} 节`);
    }
  }
}

main();
