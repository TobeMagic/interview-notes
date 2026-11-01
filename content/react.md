# React

对标 Spring 的是组件与更新模型。工程化拆到另一篇，不写 Vue 篇。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。标星的是高频题。

## 框架选型

### 1.🌟Vue 和 React 的区别？

**一句话**：Vue 是响应式驱动、模板优先、上手快；React 是函数式、JSX、显式更新、生态更自由。

| 维度 | Vue | React |
| --- | --- | --- |
| 数据更新 | 依赖收集，自动追踪 | 显式 `setState`，手动声明依赖 |
| 视图描述 | 模板（SFC），指令 | JSX，就是 JS |
| 响应式实现 | Vue 2 `defineProperty`，Vue 3 Proxy | 不可变数据 + 重渲染 |
| 复用 | 组合式函数（Composition API） | Hooks / HOC / Render Props |
| 状态管理 | Pinia（官方推荐） | 社区方案（Redux / Zustand / Jotai） |
| 渲染优化 | 编译期分析 + 细粒度更新 | 手动 `memo` / `useMemo` |
| 学习曲线 | 平缓，约定多 | 陡，概念多但更灵活 |

**展开**：

1. Vue 的响应式是「知道我改了哪个属性」，所以能精确到组件粒度更新。
2. React 是「不知道你改了哪，重新跑一遍 render，再比差异」，所以需要 `memo` 减少重跑。
3. Vue 3 的编译优化（静态提升、补丁标记）把一部分 diff 工作挪到了编译期。
4. React 18 的并发渲染走的是另一条路：可中断渲染 + 优先级调度。

**追问：Vue 2 的 `defineProperty` 有什么缺陷？** 三个：新增/删除属性检测不到（要用 `$set` / `$delete`）、数组索引赋值检测不到（要 `splice`）、初始化时递归遍历所有属性，大对象性能差。Vue 3 用 Proxy 解决了前两个，第三个改成惰性代理。

**追问：为什么 React 不也做响应式？** 设计哲学不同。React 认为「不可变数据 + 重渲染」更可预测，副作用和状态来源明确；响应式在大规模应用里容易出现「谁改了我」的追踪困难。

**面经**：

- 27 届汇总把 Vue 2 和 Vue 3 响应式标成框架第一高频，几乎每场都问。https://www.nowcoder.com/discuss/889546972099584000
- 字节一面（2025-10-09）：Vue 与 React 的区别；Vue 双向绑定原理。https://www.kuazhi.com/post/716286102.html

### 2.Vue 的双向绑定原理是什么？

**一句话**：`v-model` 是语法糖，本质是「值绑定 + 事件监听」，底层靠响应式系统追踪依赖。

**展开**：

1. Vue 2：`defineProperty` 把 data 的每个属性变成 getter/setter，getter 里收集依赖（Watcher），setter 里通知更新。
2. Vue 3：`Proxy` 代理整个对象，`track` 收集依赖，`trigger` 触发更新。配合 `effect` 做副作用。
3. `v-model` 在 `<input>` 上展开成 `:value` + `@input`，在组件上展开成 `:modelValue` + `@update:modelValue`。

**追问：Proxy 相比 `defineProperty` 好在哪？** 能拦截新增/删除属性、数组索引、`in` 操作，而且不用递归初始化（惰性）。代价是不支持 IE，且代理整个对象比劫持属性开销略大。

**面经**：字节一面（2025-10-09）：Vue 双向绑定原理。https://www.kuazhi.com/post/716286102.html

## 组件与渲染

### 3.🌟函数组件和类组件有什么区别？

**一句话**：函数组件是「每次渲染都是一次函数调用」，类组件是「实例 + 生命周期方法」。

**展开**：

1. 函数组件捕获当次渲染的 props 和 state（闭包），类组件读 `this.props` 永远是当前值。
2. 函数组件没有实例，不能 `ref` 到组件实例（除非 `forwardRef` + `useImperativeHandle`）。
3. 类组件的生命周期方法有明确时机，函数组件用 `useEffect` 表达副作用，语义更统一。
4. 函数组件更利于逻辑复用（自定义 Hook），类组件靠 HOC / Render Props。

**追问：为什么函数组件里 `setTimeout` 拿到的是旧 state？** 因为每次渲染都有独立的闭包，`setTimeout` 捕获的是创建时那次的 `count`。解法是用 `useRef` 存最新值，或者把依赖加进 `useEffect`。

**面经**：字节剪映一面问过 `useState` 闭包题，点 3 次 `count` 是多少、怎么改成延迟 1 秒拿到最新值。https://www.nowcoder.com/discuss/839496349576855552

### 4.🌟Fiber 是什么，解决什么问题？

**一句话**：Fiber 是 React 16 重写的协调引擎，把递归渲染改写成可中断、可恢复的链表遍历，让高优先级任务能插队。

**展开**：

1. 旧架构（Stack Reconciler）用递归，一旦开始就停不下来，长任务会卡住主线程。
2. Fiber 把每个组件变成一个工作单元，用 `child` / `sibling` / `return` 三个指针串成链表。
3. 渲染分两阶段：render 阶段（可中断，构建 workInProgress 树）和 commit 阶段（不可中断，一次性提交 DOM 变更）。
4. 双缓冲：当前树 `current` 和工作中树 `workInProgress`，commit 时切换指针，避免中间状态被看到。

**追问：为什么 render 可以中断，commit 不能？** 因为 render 只计算、不产生副作用，中断了丢弃重来也没关系；commit 要改真实 DOM、跑生命周期、触发副作用，中断会导致界面和状态不一致。

**追问：遍历 Fiber 树的顺序是怎样的？** 深度优先：先 `child`，没有就 `sibling`，都没有就 `return` 回父级再找 `sibling`。这个顺序保证父组件先于子组件处理。

**面经**：

- 字节一面：Reconciler 如何遍历 Fiber 树；DOM 树和 Fiber 树的区别；为什么用 MessageChannel 不用 `setTimeout`；听说过时间分片吗。https://www.nowcoder.com/discuss/868205678375010304
- 阿里提前批一面：Fiber 上留哪些信息；父子节点怎么连。https://www.nowcoder.com/discuss/353158247416799232

### 5.🌟时间切片是怎么实现的？

**一句话**：把渲染工作切成 5ms 左右的小片，每片之后用 `MessageChannel` 让出主线程，检查有没有更高优先级的任务。

**展开**：

1. 调度器（Scheduler）维护一个任务队列，按优先级排序（`Immediate` > `UserBlocking` > `Normal` > `Low` > `Idle`）。
2. 每执行一片，检查 `shouldYield()`：当前时间是否超过 `deadline`。
3. 让出用 `MessageChannel` 的 `port.postMessage`，因为它是宏任务但没有 `setTimeout` 的 4ms 钳制。
4. 恢复时从上次中断的 Fiber 节点继续。

**追问：为什么不用 `requestIdleCallback`？** 三个原因：兼容性差（Safari 长期不支持）、触发频率不稳定（浏览器忙时可能一直不触发）、粒度不可控（不知道还有多少空闲时间）。所以 React 自己实现调度。

**追问：`requestIdleCallback` 适合什么场景？** 非紧急的、可以无限延迟的任务，比如埋点上报、预计算缓存。不适合 UI 更新。

**面经**：字节一面：为什么用 MessageChannel 不用 `setTimeout`。https://www.nowcoder.com/discuss/868205678375010304

### 6.🌟Diff 算法是怎么做的？

**一句话**：同层比较，不同类型直接替换，同类型比 key 和属性，列表用双端对比。

**展开**：

1. 只做同层比较，不跨层级移动。跨层级移动会被当成「删除 + 新建」。
2. 类型不同（`div` → `span`）直接卸载重建整棵子树。
3. 同类型元素只更新变化的属性。
4. 列表 diff（React 的 `reconcileChildrenArray`）：先同步头部，再同步尾部，中间部分用 Map 按 key 查找。

**追问：为什么不用 index 当 key？** 列表顺序变化时，index 会重排，导致所有节点都被认为「变了」，既浪费又会让受控组件状态错位（比如输入框的值跟着 index 走）。用稳定 id。

**追问：没有 key 时复杂度是多少？** O(n²)——每个旧节点都要在新列表里线性查找。有 key 时是 O(n)。

**面经**：

- 字节剪映三面：Diff 复杂度；没有 key 时复杂度是多少。https://www.nowcoder.com/discuss/839496349576855552
- 字节一面：Diff 怎么比。https://www.nowcoder.com/discuss/868205678375010304

### 7.`setState` 是同步还是异步的？

**一句话**：在 React 控制的事件和生命周期里是批处理的（看起来「异步」），在 `setTimeout`、原生事件里（React 17 及以前）是同步的。React 18 起全部自动批处理。

**展开**：

1. React 17 及以前：只在 React 合成事件和生命周期里批处理。
2. React 18：`createRoot` 下所有更新都自动批处理，包括 `setTimeout`、Promise、原生事件。
3. 批处理的本质是「多次调用合并成一次渲染」，不是「延迟执行」。
4. 要强制同步刷新用 `flushSync`，但要少用，会破坏批处理。

**追问：为什么连续三次 `setCount(c => c + 1)` 能加 3？** 因为函数式更新会被排队依次执行。而 `setCount(count + 1)` 三次都是基于同一个旧 `count`，结果只加 1。

**追问：`setState` 之后立刻读 state 为什么是旧值？** 因为更新是排队的，当前这次渲染的 `state` 变量是常量。要读新值用 `useEffect` 或者函数式更新。

**面经**：字节剪映一面问过 `setState` 为什么不能立刻拿到新值。https://www.nowcoder.com/discuss/839496349576855552

## Hooks

### 8.🌟Hooks 的状态存在哪，为什么不能写在 `if` 里？

**一句话**：状态存在 Fiber 节点的 `memoizedState` 链表上，按调用顺序一一对应。写在条件里会打乱顺序，导致状态错位。

**展开**：

1. 每个 Hook 调用对应链表上的一个节点，`useState` 存值和队列，`useEffect` 存依赖和清理函数。
2. React 靠「调用顺序」而不是「名字」来匹配，所以顺序必须稳定。
3. 写在 `if` 里，某次渲染少调一个，后面所有 Hook 都会错位读取。
4. 同理不能写在循环、嵌套函数里（除非嵌套函数也是每次渲染都执行且顺序固定）。

**追问：为什么 React 不设计成按名字匹配？** 因为要写编译器插件去分析变量名，成本高且不可靠。顺序匹配简单、运行时开销小。

**追问：自定义 Hook 为什么可以调用其他 Hook？** 因为它本身也是一个函数，在组件渲染时被调用，Hook 调用会展平到同一条链表上。只要调用顺序稳定就没问题。

**面经**：阿里提前批一面：Hooks 相对 class 好在哪；状态怎么存；是不是全局；为什么 `useState` / `useEffect` 必须写在最上层。https://www.nowcoder.com/discuss/353158247416799232

### 9.🌟`useEffect` 的依赖数组怎么用？

**一句话**：依赖变了才重跑，返回的函数在下一次执行前或卸载时清理。不写依赖数组则每次渲染都跑。

**展开**：

1. `[]` 只跑一次（挂载后），清理在卸载时。
2. 不写则每次渲染后都跑，通常不是想要的。
3. 依赖要包含 effect 里用到的所有响应式值（props、state、组件内定义的函数）。
4. 清理函数在「下一次 effect 执行前」和「卸载时」调用。

**追问：依赖漏了会怎样？** 拿到旧的闭包值，表现为「状态不更新」。ESLint 的 `exhaustive-deps` 规则能查出来，但有时需要手动处理（用 `useRef` 或 `useCallback`）。

**追问：依赖写多了会怎样？** 不必要的重复执行，可能导致死循环（比如依赖里放了一个每次渲染都新建的对象）。

**追问：怎么避免「依赖地狱」？** 把逻辑拆到自定义 Hook、用 `useReducer` 把多个相关状态合并、用 `useRef` 存不需要触发渲染的值、用 `useEvent`（实验性）或 `useCallback` 稳定函数引用。

**面经**：影石一面问过为什么用 Hooks 不用 class；自定义 Hook 和普通函数差在哪。https://www.nowcoder.com/discuss/792836776233562112

### 10.`useMemo` 和 `useCallback` 有什么区别？

**一句话**：`useMemo` 缓存计算结果，`useCallback` 缓存函数本身。`useCallback(fn, deps)` 等价于 `useMemo(() => fn, deps)`。

```ts
const value = useMemo(() => heavyCompute(a, b), [a, b]);
const handler = useCallback(() => onClick(id), [id, onClick]);
```

**展开**：

1. 主要用途是稳定引用：传给 `memo` 子组件的 props、作为其他 Hook 的依赖。
2. 不是「性能银弹」。缓存本身有成本（比较依赖、存值），小计算反而更慢。
3. 不要用它来「保证正确性」，它只是优化，React 可能在内存压力下丢弃缓存。

**追问：什么时候不该用？** 计算很便宜、组件不重渲染、依赖每次都变（缓存永远失效）时，用了反而增加开销和复杂度。

**追问：`useMemo` 能保证只算一次吗？** 不能。React 官方明确说它是性能优化，不是语义保证，未来可能在特定情况下重新计算。有副作用的计算不能放进去。

**面经**：阿里提前批问过 Hooks 相关的一组问题。https://www.nowcoder.com/discuss/353158247416799232

### 11.`useRef` 有哪些用途？

**一句话**：存一个跨渲染保持不变的可变值，或者拿 DOM 引用。改它不触发重渲染。

**展开**：

1. 存定时器 id、上一次的值、渲染次数。
2. 拿 DOM：`<div ref={ref}>`，`ref.current` 指向元素。
3. `forwardRef` 让函数组件能接收 ref，`useImperativeHandle` 自定义暴露的接口。
4. 存「最新值」解决闭包陷阱：`ref.current = count` 在每次渲染时更新。

**追问：`useRef` 和 `createRef` 的区别？** `createRef` 每次调用都返回新对象，只能用在类组件或函数组件外部；`useRef` 在多次渲染间返回同一个对象。

**面经**：暂无已核对的公开原题。

### 12.`useReducer` 和 `useState` 怎么选？

**一句话**：状态逻辑复杂、多个子值相关、下一个状态依赖上一个的复杂计算时用 `useReducer`；简单独立状态用 `useState`。

**展开**：

1. `useReducer` 把更新逻辑集中到 reducer 里，组件只负责 dispatch。
2. 适合：表单多字段、状态机、需要记录历史（撤销/重做）。
3. 配合 Context 可以做轻量全局状态，但要小心所有消费者都重渲染。

**追问：`useReducer` 的 dispatch 稳定吗？** 稳定，多次渲染返回同一个引用，可以安全地放进依赖数组或传给 `memo` 子组件。

**面经**：暂无已核对的公开原题。

### 13.Context 怎么用，有什么性能陷阱？

**一句话**：Context 用来跨层级传值；陷阱是任何 value 变化都会让所有消费者重渲染，不管是否用到变化的部分。

**展开**：

1. `createContext` 建上下文，`Provider` 提供值，`useContext` 消费。
2. value 每次渲染都新建对象时，所有消费者都会重渲染，要用 `useMemo` 包住。
3. 拆分多个 Context 比一个大的更好，消费者只订阅自己需要的。
4. Context 不是状态管理，它只是传递机制。

**追问：怎么避免 Context 引起的全量重渲染？** 拆 Context、用选择器库（`use-context-selector`）、或者干脆换成 Zustand / Jotai 这类细粒度订阅的库。

**面经**：暂无已核对的公开原题。

### 14.`useLayoutEffect` 和 `useEffect` 有什么区别？

**一句话**：`useLayoutEffect` 在 DOM 变更后、浏览器绘制前同步执行；`useEffect` 在绘制后异步执行。

**展开**：

1. `useLayoutEffect` 会阻塞绘制，适合读取布局并同步修改（避免闪烁）。
2. `useEffect` 不阻塞绘制，适合数据请求、订阅、日志。
3. SSR 环境没有 DOM，`useLayoutEffect` 会警告，要用 `useIsomorphicLayoutEffect` 兼容。

**追问：什么时候必须用 `useLayoutEffect`？** 需要「先测量再调整」且不能让用户看到中间状态时，比如 tooltip 定位、滚动位置恢复。

**面经**：暂无已核对的公开原题。

### 15.自定义 Hook 怎么写，和普通函数有什么区别？

**一句话**：以 `use` 开头、内部调用其他 Hook 的函数。区别只是「能被 React 识别为 Hook」，从而参与 Hooks 规则检查。

```ts
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

**展开**：

1. 命名必须以 `use` 开头，ESLint 插件靠这个判断。
2. 两个组件用同一个自定义 Hook，状态是独立的（各自一份）。
3. 自定义 Hook 是逻辑复用，不是状态共享。共享状态要用 Context 或状态库。

**追问：自定义 Hook 能返回什么？** 任何东西：值、函数、数组、对象。返回数组时通常约定 `[value, setValue]` 形式，方便调用方重命名。

**面经**：影石一面：自定义 Hook 和普通函数差在哪。https://www.nowcoder.com/discuss/792836776233562112

## 并发与更新

### 16.🌟React 18 的并发特性有哪些？

**一句话**：`useTransition`、`useDeferredValue`、`Suspense`、自动批处理，核心是「渲染可中断 + 优先级调度」。

**展开**：

1. `startTransition` / `useTransition`：把更新标记为「可被高优先级打断」。
2. `useDeferredValue`：让某个值「滞后一版」，避免昂贵渲染阻塞输入。
3. `Suspense`：配合 `lazy` 或数据请求，显示 fallback 而不是空白。
4. 自动批处理：所有更新都批处理，不再区分事件来源。

**追问：`useTransition` 和 `useDeferredValue` 怎么选？** 能包住「触发更新的函数」用 `useTransition`；只能拿到「值」用 `useDeferredValue`。

**追问：并发渲染会改变执行顺序吗？** 会。低优先级渲染可能被丢弃、重来、被打断，所以 render 阶段必须是纯函数，不能有副作用。

**面经**：27 届汇总把 React 18 / 19 列为框架高频。https://www.nowcoder.com/discuss/889546972099584000

### 17.Suspense 是怎么工作的？

**一句话**：子组件「还没准备好」时抛出一个 Promise，React 捕获后显示 fallback，Promise resolve 后重新渲染。

**展开**：

1. 这是「异常控制的 Suspense」：不是 `catch` 错误，而是 `catch` thenable。
2. `React.lazy` 就是靠这个机制做代码分割。
3. 数据请求的 Suspense 需要框架支持（Next.js、Relay），手写要包一层缓存。

**追问：Suspense 和 `useEffect` 里请求数据有什么区别？** Suspense 让「加载中」成为渲染的一部分，避免瀑布式请求和 loading 状态散落；`useEffect` 请求是「先渲染空状态，再填充」，容易出现闪烁和竞态。

**面经**：暂无已核对的公开原题。

### 18.Server Components 是什么？

**一句话**：在服务端渲染、不打包进客户端的组件，可以直接访问数据库和文件系统，不能使用状态和事件。

**展开**：

1. 和 SSR 不同：SSR 是「服务端渲染成 HTML，客户端还要水合」；RSC 是「服务端渲染，客户端根本没有这个组件的代码」。
2. 好处：减少包体积、直接访问后端资源、避免数据请求瀑布。
3. 限制：不能用 `useState` / `useEffect`、不能绑定事件。需要交互的部分用 `'use client'` 标记客户端组件。
4. 目前主要在 Next.js App Router 里用。

**追问：RSC 和 SSR 会冲突吗？** 不冲突，可以组合：RSC 在服务端渲染成特殊格式（RSC Payload），客户端组件在需要时水合。

**面经**：字节一面（75 分钟）问过 SSR / RSC / CSR。https://www.nowcoder.com/discuss/799382455135293440

## 性能优化

### 19.🌟父组件重渲染时，子组件一定会重渲染吗？

**一句话**：默认会，除非子组件被 `memo` 包住且 props 没变，或者子组件是 `children` 形式传入的。

**展开**：

1. React 的重渲染是「父组件重新执行 → 返回新的元素树 → 子组件也被重新创建」。
2. `memo` 做浅比较 props，相等就跳过渲染。
3. `children` 作为 props 传入时，如果父组件没重建这个元素，子组件引用不变，`memo` 能生效。

```tsx
// 这样写，Child 每次都会重渲染
function Parent() {
  return <Child />;
}

// 这样写，只要 children 引用不变，Child 不会重渲染
function Parent({ children }) {
  return <div>{children}</div>;
}
```

**追问：`memo` 什么时候失效？** props 里有每次新建的对象、数组、函数时，浅比较永远不相等。要配合 `useMemo` / `useCallback` 稳定引用。

**追问：除了 `memo` 还有什么手段？** 状态下沉（把 state 放到真正需要它的组件里）、组件拆分、`children` 模式、Context 拆分、虚拟列表。

**面经**：字节一面：父组件重渲染如何防止子组件重渲染。https://www.nowcoder.com/feed/main/detail/e0c62c65730b40d181ccea8c9e839f79

### 20.虚拟列表是怎么实现的？

**一句话**：只渲染可视区域内的项，用占位撑起总高度，滚动时计算应该渲染哪几项。

**展开**：

1. 需要三项数据：每项高度（固定或测量）、容器可视高度、滚动位置。
2. 计算 `startIndex = floor(scrollTop / itemHeight)`，`endIndex = startIndex + visibleCount`。
3. 用 `transform: translateY` 或 padding 把渲染的项推到正确位置。
4. 不定高时要先测量再缓存，或者用预估高度 + 动态修正。

**追问：不定高虚拟列表怎么处理？** 常见做法：先假设一个平均高度，渲染后测量真实高度并更新偏移量，滚动时用二分查找定位。复杂度比固定高度高很多。

**追问：为什么不用 `IntersectionObserver` 做虚拟列表？** 它能做懒加载，但做不了「回收已离开视口的 DOM」——它只知道元素进了视口，不知道位置计算。虚拟列表要自己算索引。

**面经**：

- 字节剪映二面：组织树节点卡顿，做过哪些性能优化。https://www.nowcoder.com/discuss/839496349576855552
- 字节一面（2025-10-09）：列表滚动卡顿怎么排查。https://www.kuazhi.com/post/716286102.html

### 21.怎么定位 React 的性能问题？

**一句话**：先用 React DevTools Profiler 看哪些组件渲染了、渲染了多久、为什么渲染，再针对性优化。

**展开**：

1. Profiler 能记录一次交互的渲染火焰图，看 commit 耗时和每个组件的渲染次数。
2. 勾选「Highlight updates」能直观看到哪些组件在不必要地重渲染。
3. 「Why did this render?」显示 props / state / context 哪个变了。
4. 生产环境可以用 `web-vitals` + 自定义打点，看真实用户的 INP。

**追问：渲染次数多但很快，需要优化吗？** 要看总时长。100 个组件各 0.1ms 和 10 个组件各 10ms，后者更值得优化。Profiler 的 flame chart 能看出来。

**面经**：暂无已核对的公开原题。

### 22.`key` 除了列表还能用在哪？

**一句话**：任何需要「重置组件状态」的地方。改 `key` 会让 React 卸载旧组件、挂载新组件。

```tsx
// 切换用户时重置表单
<Form key={userId} user={user} />
```

**展开**：

1. 常见场景：路由切换时重置页面状态、切换 tab 时重置滚动位置、强制重新挂载动画。
2. 代价是丢失所有内部状态、重新执行挂载副作用。
3. 不要用它来「优化性能」，它是重置手段不是优化手段。

**追问：`key` 放在列表项上有什么要求？** 必须在兄弟节点间唯一且稳定。不要用随机数或 `Math.random()`，那等于每次都重建。

**面经**：暂无已核对的公开原题。

## 状态管理

### 23.全局状态该怎么选？

| 方案 | 适用 | 特点 |
| --- | --- | --- |
| Context | 低频变化、层级深的配置 | 内置，变化时全量消费者重渲染 |
| Redux Toolkit | 大型应用、需要时间旅行调试 | 生态成熟，样板代码已大幅减少 |
| Zustand | 中小型应用 | 极简，细粒度订阅 |
| Jotai / Recoil | 原子化状态 | 按原子订阅，重渲染最少 |
| TanStack Query | 服务端状态 | 缓存、重试、失效，不管理客户端状态 |

**一句话**：客户端状态和服务端状态要分开管。服务端数据用查询库，客户端状态按规模选。

**展开**：

1. 「服务端状态」指来自接口的数据，它有缓存、过期、重试、失效的问题，用 TanStack Query / SWR。
2. 「客户端状态」指 UI 状态、表单、主题，用 Zustand / Jotai 或 Context。
3. Redux 仍然适合需要严格单向数据流和可追溯的大型团队。

**追问：为什么不要把接口数据放进 Redux？** 会重复实现缓存、失效、重试这些逻辑，而且容易和组件生命周期脱节。查询库专门解决这个。

**面经**：27 届汇总把 Pinia 和 Vuex 的对比列为 Vue 高频，React 侧对应状态管理选型。https://www.nowcoder.com/discuss/889546972099584000

### 24.受控组件和非受控组件有什么区别？

**一句话**：受控组件的值由 React state 管理，非受控组件的值存在 DOM 里，用 ref 读。

```tsx
// 受控
<input value={name} onChange={(e) => setName(e.target.value)} />

// 非受控
<input defaultValue="x" ref={inputRef} />
```

**展开**：

1. 受控能实时校验、联动、格式化，但每次输入都触发重渲染。
2. 非受控性能更好，适合大表单或非 React 生态的库。
3. 文件输入 `<input type="file">` 只能是受控的（值不能设），只能用 ref 读。

**追问：大表单用受控会不会卡？** 会。解法：非受控 + ref 收集、或用 react-hook-form 这类「非受控为主」的库、或者把每个字段拆成独立组件减少重渲染范围。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 字节 · 一面（2025-10-09） | Vue 与 React 的区别、Vue 双向绑定原理 | 1、2 |
| 字节 · 剪映一面 | `useState` 闭包题、`setState` 为什么拿不到新值 | 3、7 |
| 字节 · 一面 | Reconciler 遍历 Fiber、DOM 树与 Fiber 树的区别 | 4 |
| 字节 · 一面 | 为什么用 MessageChannel 不用 `setTimeout` | 5 |
| 字节 · 剪映三面 | Diff 复杂度、没有 key 时复杂度 | 6 |
| 阿里 · 提前批一面 | Hooks 状态存在哪、为什么不能写在 `if` 里 | 8 |
| 影石 · 一面 | 为什么用 Hooks、自定义 Hook 与普通函数的区别 | 9、15 |
| 字节 · 一面（75 分钟） | SSR / RSC / CSR | 18 |
| 字节 · 一面 | 父组件重渲染如何避免子组件重渲染 | 19 |
| 字节 · 剪映二面 | 组织树节点卡顿、性能优化手段 | 20 |
| 字节 · 一面（2025-10-09） | 列表滚动卡顿怎么排查 | 20 |

来源：27 届汇总 https://www.nowcoder.com/discuss/889546972099584000 ；字节一面 https://www.nowcoder.com/discuss/868205678375010304 ；剪映一面 https://www.nowcoder.com/discuss/839496349576855552 ；影石一面 https://www.nowcoder.com/discuss/792836776233562112 ；阿里提前批 https://www.nowcoder.com/discuss/353158247416799232 ；字节 75 分钟 https://www.nowcoder.com/discuss/799382455135293440 ；字节一面 2025-10-09 https://www.kuazhi.com/post/716286102.html

## 这一篇没写的东西

- **Vue 的完整知识体系**：只在第 1、2 题作为对比出现，不单独成篇。
- **React Router / Next.js 的路由细节**：框架层，面试问到再答。
- **构建和分包**：工程化篇。这里只在第 18 题提到 RSC 对包体积的影响。
- **测试（Testing Library、E2E）**：面试很少深问，属于工程实践。
