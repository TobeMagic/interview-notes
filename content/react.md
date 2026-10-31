# React

对标 Spring 的是组件和更新模型。工程化拆到另一篇。不写 Vue 篇。

答案不在这里。

## Vue 和 React 差在哪

只写这一节。Vue 2 和 Vue 3 的响应式放在对比里，因为这是框架题里最常被问的，而这篇不单独讲 Vue。

要写的题：

1. 数据怎么流动。Vue 的 `v-model` 和 React 的单向数据各解决什么。
2. 视图怎么知道数据变了。Vue 2 的 `defineProperty`、Vue 3 的 Proxy、React 的 `setState` / `useState`。
3. 组件怎么复用。Vue 的单文件组件，React 的 Hooks。
4. 状态放哪。Vuex / Pinia 只作为对比一句，不展开。

面经：

- 27 届汇总把 Vue 2 和 Vue 3 响应式标成框架第一高频，几乎每场都问。https://www.nowcoder.com/discuss/889546972099584000
- 字节一面（2025-10-09，牛客「魔法恐龙」，公开转载）：Vue 与 React 的区别；Vue 双向绑定原理；自定义 Hooks；虚拟 DOM；Fiber。https://www.kuazhi.com/post/716286102.html

## 怎么更新

Fiber、Diff、时间切片、为什么不用 `requestIdleCallback`、双缓冲并成一节。`setState` 批处理、React 18 并发、Suspense 也并进这里。

要写的题：

1. Fiber 解决递归渲染不能中断的什么问题。
2. 遍历 Fiber 树的顺序。和 DOM 树差在哪。
3. render 可以停，commit 为什么不能停。
4. 时间切片怎么切。为什么用 MessageChannel，不用 `setTimeout`。
5. Diff 在同一层比什么。没有 key 时复杂度怎么样。为什么不用 index 当 key。
6. 一次点击里多次 `setState`，渲染几次。
7. `startTransition` 和 Suspense 把什么活标成可让路。

面经：

- 字节一面：Reconciler 如何遍历 Fiber 树；DOM 树和 Fiber 树的区别；Diff 怎么比；为什么用 MessageChannel 不用 `setTimeout`；听说过时间分片吗。https://www.nowcoder.com/discuss/868205678375010304
- 字节剪映三面：Fiber 是什么；时间切片怎么实现；Diff 复杂度；没有 key 时复杂度是多少。https://www.nowcoder.com/discuss/839496349576855552
- 字节一面：Fiber；很长的任务怎么切片；父组件重渲染怎么挡住子组件。https://www.nowcoder.com/feed/main/detail/e0c62c65730b40d181ccea8c9e839f79
- 阿里提前批一面：Fiber 上留哪些信息；父子节点怎么连。https://www.nowcoder.com/discuss/353158247416799232

## Hooks

规则、闭包旧值、`useEffect` 依赖、`useMemo` / `useCallback` 并成一节。

要写的题：

1. Hooks 的状态存在哪。为什么不能写在 `if` 里。
2. 点三次按钮，`count` 为什么还是旧的。
3. `useEffect` 的依赖漏了或写多了，分别发生什么。清理函数什么时候跑。
4. `useMemo` 和 `useCallback` 挡住的是哪一次计算。

面经：

- 阿里提前批一面：Hooks 相对 class 好在哪；状态怎么存；是不是全局；为什么 `useState` / `useEffect` 必须写在最上层。https://www.nowcoder.com/discuss/353158247416799232
- 字节剪映一面：`useState` 闭包题，点 3 次 `count` 是多少；怎么改成延迟 1 秒拿到最新值。https://www.nowcoder.com/discuss/839496349576855552
- 影石一面：为什么用 Hooks 不用 class；自定义 Hook 和普通函数差在哪；`setState` 为什么不能立刻拿到新值。https://www.nowcoder.com/discuss/792836776233562112

## 渲染性能

只写重渲染和 `memo`。虚拟列表的做法和浏览器篇的长列表共用结论，这里写 React 里谁会跟着渲染。

要写的题：

1. 父组件渲染时，子组件什么情况下会跟着来。
2. `memo` 比较的是什么。什么时候挡不住。

面经：

- 字节一面：父组件重渲染如何防止子组件重渲染。https://www.nowcoder.com/feed/main/detail/e0c62c65730b40d181ccea8c9e839f79
- 字节剪映二面：组织树节点卡顿，以及做过哪些性能优化。https://www.nowcoder.com/discuss/839496349576855552
- 字节一面（2025-10-09）：列表滚动卡顿怎么排查。https://www.kuazhi.com/post/716286102.html
- 27 届汇总把虚拟列表标成性能高频。https://www.nowcoder.com/discuss/889546972099584000
