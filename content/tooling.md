# 工程化

源站没有对标篇。按面经把构建题收成一节。微前端和 WebAssembly 不写。

答案不在这里。

## Webpack、Vite、摇树、热更新、分割

并成一节。

要写的题：

1. Vite 开发时为什么不用先打完整包。生产构建用什么。
2. Webpack 和 Vite 的热更新各更新哪一块。
3. tree shaking 靠什么静态结构。`sideEffects` 写错会怎样。
4. ESM 和 CommonJS 在打包器眼里差在哪。
5. 路由和重组件怎么拆出去。拆完怎么让没改过的包继续用缓存。

面经：

- 27 届汇总把 Webpack 和 Vite 标成工程化第一题。https://www.nowcoder.com/discuss/889546972099584000
- 字节一面：Webpack 和 Vite 有什么区别；Vite 打包用什么；ESM 和 CJS。https://www.nowcoder.com/discuss/868205678375010304
- 腾讯微信基础部一面：在哪个项目做了打包、体积分析、代码规范；Webpack 怎么分包、怎么减体积。https://www.nowcoder.com/discuss/865669284599513088

## 这一节末尾的追问，不另开

1. monorepo 除了 pnpm workspace 还有什么。
2. pnpm 为什么快。

面经：

- 字节飞书一面：简历里的 monorepo 是什么；除了 pnpm workspace 还有什么方案。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 27 届汇总把 pnpm 和 npm 的差别单独列过，这里并进追问。https://www.nowcoder.com/discuss/889546972099584000
