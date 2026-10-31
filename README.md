# 八股志 · Interview Notes

前端、Node、Go、PostgreSQL、MongoDB 的开源八股文笔记。

在线访问：**https://tobemagic.github.io/interview-notes/**

## 这是什么

市面上讲 Java 的八股文已经足够多，前端、Node、Go 和数据库这一侧却散落在面经帖、博客和口口相传里。这个仓库按模块收拢：每一节先给一句能直接说出口的答案，再展开，再列会被追问什么。

三条规矩：

1. **合并**：同一场面试会连着追问的，合成一节讲完。例如 Vue 和 React 的区别只写在 React 篇里，不单开 Vue 篇。
2. **拆分**：换了机制才另开一节，不把 InnoDB 间隙锁、CMS、双亲委派这类 Java 题硬翻过来。
3. **时效**：网上答案大面积过时的地方，明确标出版本分界。例如 Go 1.24 起内置 map 换成 Swiss Table、Go 1.22 起循环变量每轮新建、TypeScript 7.0 起编译器是 Go 原生端口。

面经只保留**公司、轮次、原题一句、链接**，不搬他人答案正文。关键结论给官方文档出处。

## 篇目

| # | 模块 | 对标 | 状态 |
|---|---|---|---|
| 01 | TypeScript | Java SE + 集合 | 完稿 |
| 02 | 浏览器 | JVM 的运行模型 | 大纲 |
| 03 | React | Spring 的渲染模型 | 大纲 |
| 04 | 工程化 | 源站无对标篇 | 大纲 |
| 05 | React Native | Spring 的端上版本 | 大纲 |
| 06 | Node 运行时 | JVM + 并发 | 大纲 |
| 07 | NestJS | Spring | 大纲 |
| 08 | Go 语言 | Java SE + 集合 | 完稿 |
| 09 | Go 运行时 | JVM | 大纲 |
| 10 | Go 并发 | Java 并发 | 大纲 |
| 11 | gRPC | 微服务远程调用 | 大纲 |
| 12 | PostgreSQL | MySQL 的章节，机制换掉 | 大纲 |
| 13 | MongoDB | 同一骨架，删掉纯 SQL 题 | 大纲 |

「大纲」表示已列出要写的题和已核对的公开原题，口述答案待补。

## 本地开发

```bash
npm install
npm run build      # 生成 dist/
npm run serve      # 或直接用任意静态服务器打开 dist/
```

构建输出到 `dist/`，是纯静态 HTML，没有任何运行时依赖。

### 目录结构

```
content/            # 一个模块一个 markdown，文件名即 slug
  typescript.md
  go-language.md
  ...
assets/
  style.css         # 全部样式
  site.js           # 筛选、目录高亮、键盘翻篇
site.config.mjs     # 模块顺序、分组、对标关系、完稿状态
build.mjs           # 生成器
dist/               # 构建产物（不入库）
```

### 新增一篇

1. 在 `content/` 放一个 `<slug>.md`，第一行是 `# 标题`，正文用 `##` 分节。
2. 在 `site.config.mjs` 的 `MODULES` 里加一条，顺序即目录顺序。

### 写作约定

生成器会识别两种标记：

```markdown
**一句话**：这一节的核心答案，会渲染成高亮导语块。

**面经**：公司、轮次、原题一句、链接。会渲染成带「面经」标签的引用条。
```

没有核对到公开原题的题，写 `**面经**：暂无已核对的公开原题。`，页面会显示为浅色提示，不会空着。

## 部署

推到 `main` 分支后由 GitHub Actions 自动构建并发布到 GitHub Pages，见 `.github/workflows/deploy.yml`。

首次需要在仓库 Settings → Pages 里把 Source 设为 **GitHub Actions**。

## 贡献

欢迎纠错。提交 PR 时请附上官方文档链接或其他可核实的出处。只接受两类改动：

- 事实错误修正（附出处）
- 新增已核对的公开面经原题（附链接）

不接受把其他站点的答案正文整段搬进来。

## License

内容与代码均以 [MIT](LICENSE) 发布。
