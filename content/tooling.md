# 工程化

参考站没有对标篇。按面经把构建题收成一篇。微前端和 WebAssembly 不写。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。

## 模块化

### 1.🌟ESM 和 CommonJS 有什么区别？

| | ESM | CommonJS |
| --- | --- | --- |
| 语法 | `import` / `export` | `require` / `module.exports` |
| 加载时机 | 静态分析，编译时确定 | 运行时执行 |
| 加载方式 | 异步 | 同步 |
| 导出 | 值的引用（活绑定） | 值的拷贝 |
| 顶层 `await` | 支持 | 不支持 |
| 循环依赖 | 能处理（提升声明） | 拿到未完成的 exports |
| 适用 | 浏览器、现代 Node | 老 Node 生态 |

**一句话**：ESM 是静态的、异步的、导出的是活绑定；CJS 是动态的、同步的、导出的是快照。

**展开**：

1. ESM 的静态结构让 tree shaking 成为可能——打包器不用执行代码就能分析出哪些导出被用了。
2. 活绑定意味着 `export let count` 被修改时，导入方看到的是新值；CJS 导入后就是一份拷贝。
3. ESM 在浏览器里天然异步，CJS 在 Node 里同步读取文件。

**追问：为什么 `import` 必须写在顶层？** 因为要静态分析。动态导入用 `import()`，它返回 Promise。

**追问：`require` 能加载 ESM 吗？** Node 22 起可以（`require(esm)`），但有限制：不能是顶层 `await` 的模块。之前只能用动态 `import()`。

**面经**：字节一面：ESM 和 CJS 的区别。https://www.nowcoder.com/discuss/868205678375010304

### 2.`import` 和 `require` 在打包产物里有什么区别？

**一句话**：`import` 会被静态分析、提升、摇树优化；`require` 被当成普通函数调用，无法静态分析。

**展开**：

1. 打包器会把 ESM 的 import 转成内部的模块注册调用，未使用的导出被删除。
2. `require` 的路径如果是变量（`require(path)`），打包器无法确定，只能保留整个模块或报错。
3. 混用两种格式时，`import` 一个 CJS 模块拿到的是 `module.exports`（可能被包装成 `default`）。

**追问：为什么 CJS 模块摇不掉树？** 因为它的导出是运行时赋值的，静态分析看不出哪些被用了，保守起见全部保留。

**面经**：字节一面（2025-10-09）问过 `import` 和 `require` 的区别。https://www.kuazhi.com/post/716286102.html

### 3.什么是 tree shaking，为什么它会失效？

**一句话**：打包时删掉没有被引用的导出。失效的常见原因是副作用标注不清、CJS 格式、或导出被动态访问。

**展开**：

1. 前提是 ESM 的静态结构。
2. `package.json` 的 `sideEffects: false` 告诉打包器「这个包没有副作用，可以放心删」。
3. 写错 `sideEffects` 会误删有副作用的模块（比如全局 polyfill、CSS 导入），导致运行时错误。
4. 导出被挂在对象上（`export default { a, b }`）时，打包器无法判断哪个被用，只能全留。

**追问：`sideEffects` 该怎么写？** 默认 `false`（全都没有副作用），然后显式列出有副作用的文件：

```json
{ "sideEffects": ["*.css", "./src/polyfill.js"] }
```

**追问：CSS 为什么容易被摇掉？** 因为 `import './style.css'` 没有导出任何东西，打包器会认为它没用。所以要在 `sideEffects` 里保留 CSS 文件。

**面经**：27 届汇总把 tree shaking 和 `sideEffects` 列为工程化高频。https://www.nowcoder.com/discuss/889546972099584000

## 构建工具

### 4.🌟Webpack 和 Vite 有什么区别？

**一句话**：Webpack 是「先打包再启动」，Vite 开发时「不打包、按需编译」，生产构建用 Rollup。

| | Webpack | Vite |
| --- | --- | --- |
| 开发启动 | 先构建完整依赖图 | 秒起，按需编译 |
| 模块格式 | 自己实现模块系统 | 原生 ESM |
| 生产构建 | 自己打包 | Rollup |
| HMR | 重新构建改动的模块链 | 只让改动的模块失效 |
| 配置复杂度 | 高 | 低（约定优于配置） |
| 生态 | 极成熟 | 快速追赶 |

**展开**：

1. Vite 开发时把源码当原生 ESM 交给浏览器，浏览器请求哪个模块就编译哪个。
2. 依赖用 esbuild 预构建（把 CJS 转 ESM、把多个小文件合成一个），避免大量请求。
3. 生产构建用 Rollup，因为它的产物优化更成熟。
4. Vite 的 HMR 只失效改动的模块及其边界，不用重走整条依赖链。

**追问：Vite 生产构建为什么不用 esbuild？** esbuild 快但产物优化（代码分割、CSS 处理、tree shaking 的精细度）不如 Rollup。开发时不需要这些，所以用 esbuild 换速度。

**追问：Vite 有什么缺点？** 开发时首屏请求多（模块多时浏览器压力大）、老浏览器兼容要额外插件、某些依赖的 CJS 兼容要手动配。

**面经**：

- 字节一面：Webpack 和 Vite 有什么区别；Vite 打包用什么。https://www.nowcoder.com/discuss/868205678375010304
- 27 届汇总把 Webpack 和 Vite 标成工程化第一题。https://www.nowcoder.com/discuss/889546972099584000

### 5.🌟Webpack 的构建流程是怎样的？

**一句话**：初始化参数 → 加载插件 → 确定入口 → 编译模块（loader 转换）→ 生成依赖图 → 输出（plugin 介入）。

**展开**：

1. **初始化**：读配置，创建 `Compiler` 实例，注册所有 plugin。
2. **编译**：从 entry 开始，递归解析依赖。每个模块先过 loader 链（从右到左、从下到上），再被 acorn 解析成 AST，找出依赖。
3. **生成**：把模块包进函数（`__webpack_require__`），生成 chunk。
4. **输出**：`emit` 钩子让 plugin 做最后处理，写文件。

**追问：loader 和 plugin 有什么区别？** loader 是「模块转换器」，处理单个文件的源码，必须返回字符串或 Buffer；plugin 是「构建流程的钩子」，能监听整个生命周期，能做 loader 做不到的事（分包、生成 HTML、压缩）。

**追问：loader 为什么从右往左执行？** 因为它是函数组合：`style-loader(css-loader(sass-loader(source)))`。最右边的先接触源码，最左边的最后处理。

**面经**：腾讯微信基础部一面：Webpack 怎么分包、怎么减体积。https://www.nowcoder.com/discuss/865669284599513088

### 6.🌟Webpack 的分包怎么做？

**一句话**：用 `splitChunks` 把公共依赖、第三方库拆成独立 chunk，用动态 `import()` 做路由级分割。

```js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: { test: /node_modules/, name: 'vendors', priority: 10 },
      common: { minChunks: 2, name: 'common', priority: 5 }
    }
  }
}
```

**展开**：

1. `chunks: 'all'` 对同步和异步都生效。
2. 拆包原则：按变更频率拆（框架、UI 库、业务代码分开），让缓存更有效。
3. `runtimeChunk: 'single'` 把 webpack 的运行时代码单独抽出，避免主包哈希频繁变化。
4. 不是越碎越好：太多小 chunk 增加请求数，HTTP/2 下影响小一些，但仍有开销。

**追问：怎么减小产物体积？** 按顺序：分析（`webpack-bundle-analyzer`）→ 换更小的替代库（`dayjs` 替 `moment`）→ 按需引入（`lodash-es` + 具名导入）→ 代码分割 → 压缩和 tree shaking。

**面经**：腾讯微信基础部一面：在哪个项目做了打包、体积分析、代码规范。https://www.nowcoder.com/discuss/865669284599513088

### 7.HMR 是怎么工作的？

**一句话**：文件改动后，只替换受影响的模块，保留应用状态，不刷新页面。

**展开**：

1. 文件监听（chokidar）→ 重新编译改动的模块 → 通过 WebSocket 通知浏览器。
2. 浏览器端 HMR runtime 拉取新模块，沿着依赖链向上找「接受更新的模块」（`module.hot.accept`）。
3. 找到就替换；找不到就降级成整页刷新。
4. Vite 更精细：只让改动的模块及其边界失效，其余缓存不变。

**追问：React 的 HMR 怎么保持状态？** `react-refresh` 在替换组件时保留 hook 状态，只重新执行组件函数。它要求组件导出形式稳定（不能匿名导出）。

**追问：HMR 有什么坑？** 状态残留导致「明明改了代码还是旧行为」、CSS 热更新的层叠顺序问题、某些模块不支持热替换导致静默整页刷新。

**面经**：暂无已核对的公开原题。

## 产物优化

### 8.🌟代码分割有哪些方式？

| 方式 | 语法 | 场景 |
| --- | --- | --- |
| 动态导入 | `import('./mod')` | 路由、弹窗、重组件 |
| 路由级 | 路由配置里 `lazy` | 首屏只加载当前路由 |
| 手动分包 | `splitChunks` / `manualChunks` | 第三方库分离 |
| 预加载 | `<link rel="modulepreload">` | 提前拉下一个要用的 chunk |

**一句话**：按「什么时候需要」切，不要按「代码在哪个目录」切。

**追问：动态导入的 chunk 命名怎么控制？** Webpack 用 `/* webpackChunkName: "name" */` 魔法注释，Vite / Rollup 用 `manualChunks` 或 `output.chunkFileNames`。

**追问：预加载会不会浪费带宽？** 会。`prefetch` 在空闲时下载，用户可能根本不去那个页面。所以只对高概率路径用，或者用「悬停预加载」这种交互触发的策略。

**面经**：暂无已核对的公开原题。

### 9.🌟缓存哈希是怎么生成的？

**一句话**：对文件内容（或 chunk 内容）做哈希，内容变则哈希变，文件名变则缓存失效。

**展开**：

1. `[hash]` 是整个构建的哈希，任何文件变了全变——现在基本不用。
2. `[chunkhash]` 是 chunk 内容的哈希。
3. `[contenthash]` 是文件内容的哈希，CSS 和 JS 分开，最精确。
4. 把 runtime 单独抽出（`runtimeChunk`），避免「只改业务代码，vendor 哈希也变」。

**追问：为什么我改了业务代码，vendor 的哈希也变了？** 因为模块 id 变化（默认用数字 id，按引用顺序分配）。解法：`optimization.moduleIds: 'deterministic'`，或者用 `runtimeChunk` 隔离。

**追问：CSS 的哈希怎么稳定？** 用 `MiniCssExtractPlugin` 的 `[contenthash]`，并且确保 CSS 的模块顺序稳定，否则内容顺序变化也会改哈希。

**面经**：暂无已核对的公开原题。

### 10.怎么分析产物体积？

**一句话**：先看整体构成（bundle analyzer），再看具体模块为什么被打进来（stats / source map）。

**展开**：

1. `webpack-bundle-analyzer` 生成可交互的树图，看每个包占多大。
2. `webpack --profile --json > stats.json` 然后用 `webpack-bundle-analyzer stats.json` 看更细的信息。
3. Vite 用 `rollup-plugin-visualizer`。
4. 看「为什么这个模块在包里」比看体积更重要——经常是某个库的间接依赖。

**追问：发现某个大库只用了几个函数怎么办？** 换成按需导入（`lodash-es` + 具名导入）、换成更小的替代库、或者只在需要的路由里动态导入。

**面经**：腾讯微信基础部一面问过体积分析。https://www.nowcoder.com/discuss/865669284599513088

## 工程约束

### 11.ESLint 和 Prettier 有什么区别？

**一句话**：ESLint 管代码质量和潜在错误，Prettier 只管格式化。职责不重叠，不要用 ESLint 做格式化。

**展开**：

1. ESLint 能查未使用变量、错误的 Hook 依赖、不安全的写法，也能自动修复一部分。
2. Prettier 不关心语义，只按规则重排代码。
3. 两者冲突时用 `eslint-config-prettier` 关掉 ESLint 的格式规则。
4. 现在推荐 ESLint flat config（`eslint.config.js`）。

**追问：提交时怎么自动检查？** `lint-staged` + `husky` 的 pre-commit 钩子，只检查改动的文件。CI 里再跑一次全量。

**面经**：暂无已核对的公开原题。

### 12.monorepo 有哪些方案？

| 方案 | 特点 |
| --- | --- |
| pnpm workspace | 轻量，靠符号链接共享依赖，磁盘占用小 |
| Turborepo | 在 workspace 之上加任务缓存和并行调度 |
| Nx | 功能全，有依赖图、代码生成、增量构建 |
| Lerna | 老牌，现在主要做版本发布 |

**一句话**：小团队用 pnpm workspace 就够，需要构建缓存和任务编排再加 Turborepo。

**展开**：

1. monorepo 的核心收益：跨包改动一次提交、统一依赖版本、共享配置。
2. 核心成本：构建慢、CI 复杂、依赖边界容易失控。
3. pnpm 的严格依赖隔离（不能 import 未声明的包）能防止隐式依赖。

**追问：monorepo 里怎么保证只构建改动的包？** 用 `--filter`（pnpm）或 Turborepo 的任务图，只跑受影响的包和它们的下游。

**面经**：字节飞书一面：简历里的 monorepo 是什么；除了 pnpm workspace 还有什么方案。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 13.包管理器 npm、yarn、pnpm 有什么区别？

**一句话**：npm 是标准，yarn 引入了 lockfile 和更快安装，pnpm 用硬链接 + 符号链接做内容寻址，最省磁盘且依赖隔离最严格。

**展开**：

1. pnpm 把所有包存在全局 store，项目里用硬链接引用，不同项目相同版本只存一份。
2. pnpm 的 `node_modules` 是符号链接结构，包只能访问自己声明的依赖（严格隔离）。
3. npm 和 yarn 会把依赖提升到顶层，导致「幽灵依赖」——能 import 没声明的包。
4. 安装速度：pnpm 通常最快，尤其在有缓存时。

**追问：幽灵依赖有什么问题？** 你的代码用了没在 `package.json` 里声明的包，一旦上游不再依赖它，你的构建就崩了。pnpm 从根上禁止这种情况。

**面经**：27 届汇总把 pnpm 和 npm 的差别单独列过。https://www.nowcoder.com/discuss/889546972099584000

### 14.环境变量怎么管理？

**一句话**：构建时注入（`import.meta.env` / `process.env`），不要把密钥打进前端产物。

**展开**：

1. Vite 用 `import.meta.env.VITE_*`，只有 `VITE_` 前缀的会暴露给客户端。
2. Webpack 用 `DefinePlugin` 在编译时替换。
3. 前端能看到的变量等于公开的，密钥必须在服务端。需要前端用的第三方密钥要用代理转发。
4. 不同环境用 `.env.development` / `.env.production` 区分。

**追问：为什么不能用 `process.env.XXX` 直接读？** 因为浏览器没有 `process`。打包器会把 `process.env.XXX` 静态替换成字符串，但只对它认识的变量名生效，动态访问（`process.env[key]`）不会被替换。

**面经**：暂无已核对的公开原题。

### 15.怎么做前端灰度发布？

**一句话**：把用户分流到不同版本，按比例或规则逐步放量，出问题能快速回滚。

**展开**：

1. 分流维度：用户 id 哈希、地域、设备、白名单。
2. 实现方式：Nginx / 网关按 cookie 路由到不同静态资源目录、或者 HTML 里注入不同版本的入口。
3. 关键是版本隔离：不同版本的资源路径不能冲突，否则缓存会串。
4. 监控要能按版本区分，否则灰度没意义。

**追问：灰度期间接口兼容怎么处理？** 接口要向后兼容（加字段不删字段），新旧版本同时在线。这是灰度的前提，不是可选项。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 字节 · 一面 | Webpack 和 Vite 的区别、Vite 打包用什么、ESM 和 CJS | 1、4 |
| 字节 · 一面（2025-10-09） | `import` 和 `require` 的区别 | 2 |
| 腾讯 · 微信基础部一面 | Webpack 怎么分包、怎么减体积、体积分析 | 5、6、10 |
| 字节 · 飞书一面 | monorepo 方案 | 12 |
| 27 届汇总 | Webpack / Vite、tree shaking、pnpm | 3、4、13 |

来源：27 届汇总 https://www.nowcoder.com/discuss/889546972099584000 ；字节一面 https://www.nowcoder.com/discuss/868205678375010304 ；腾讯微信基础部一面 https://www.nowcoder.com/discuss/865669284599513088 ；字节飞书一面 https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3 ；字节一面 2025-10-09 https://www.kuazhi.com/post/716286102.html

## 这一篇没写的东西

- **微前端**：面经里出现频率低，且方案分歧大，不写。
- **WebAssembly**：不是前端岗的必考项。
- **SSR 框架的具体配置**：Next.js / Nuxt 属于框架层，只在这篇的构建部分点到。
- **CI/CD 的具体流水线**：属于 DevOps，面试很少深问。
