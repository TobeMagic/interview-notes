# Node 运行时

对标 JVM，加上和并发重叠的那一段。NestJS 在另一篇。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。

## 整体架构

### 1.🌟Node 的架构是怎样的？

**一句话**：JS 跑在 V8 上，异步 I/O 和事件循环由 libuv 提供，Node 自己负责把两者接起来并提供标准库。

**展开**：

1. **V8**：执行 JS、管理 JS 堆、做 JIT 优化、提供 GC。
2. **libuv**：跨平台异步 I/O，事件循环、线程池、文件系统、网络、DNS。
3. **Node 核心库**：`fs`、`net`、`http`、`stream` 这些模块把 libuv 的能力包成 JS API。
4. **C++ 绑定**：核心库通过 N-API / V8 API 调到 C++。

**追问：Node 是单线程的吗？** JS 执行是单线程的，但底层不是。libuv 有线程池（默认 4 个）处理文件、DNS、加密，网络 I/O 用 epoll / kqueue / IOCP 做事件通知。

**追问：libuv 线程池默认多大，怎么调？** 默认 4，用 `UV_THREADPOOL_SIZE` 环境变量调。跑大量 `fs` 或 `crypto` 操作时调大有收益，但别超过 CPU 核数太多。

**面经**：暂无已核对的公开原题。

### 2.V8 的垃圾回收是怎么工作的？

**一句话**：分代回收，新生代用 Scavenge（复制算法），老生代用标记-清除/整理，配合增量标记和并发标记减少停顿。

**展开**：

1. **新生代**（Scavenge）：对象分在 from / to 两个半区，回收时把存活对象复制到另一半，然后交换。快，但空间利用率只有一半。
2. **老生代**：活过两次新生代回收的对象晋升上来，用 Mark-Sweep（标记清除）和 Mark-Compact（标记整理）。
3. **增量标记**：把标记拆成小片，穿插在 JS 执行之间，避免长时间停顿。
4. **并发标记**：标记工作放到辅助线程，进一步减少主线程阻塞。

**追问：什么时候会卡？** 老生代满了触发全量 GC、大对象分配（直接进老生代）、内存泄漏导致频繁 GC。用 `--trace-gc` 或 `--inspect` 看。

**追问：Node 默认堆有多大？** 64 位系统约 4GB（`--max-old-space-size` 可调）。超过会 OOM 崩溃，报 `JavaScript heap out of memory`。

**面经**：暂无已核对的公开原题。

## 事件循环

### 3.🌟Node 的事件循环有哪几个阶段？

**一句话**：六个阶段，依次是 timers、pending callbacks、idle/prepare、poll、check、close callbacks，每个阶段之间清空微任务。

| 阶段 | 处理什么 |
| --- | --- |
| timers | `setTimeout`、`setInterval` 到期的回调 |
| pending callbacks | 上一轮延迟的系统回调（如 TCP 错误） |
| idle / prepare | 内部使用 |
| poll | 等待 I/O，执行 I/O 回调 |
| check | `setImmediate` 回调 |
| close callbacks | `close` 事件的回调（如 socket 关闭） |

**展开**：

1. poll 阶段会阻塞等待 I/O，等待时间取决于有没有 `setImmediate` 和定时器。
2. 每个阶段结束、每个回调执行后，都会清空微任务队列（`process.nextTick` 优先，然后 Promise）。
3. `process.nextTick` 不属于任何阶段，在当前操作结束后立刻执行。

**追问：`setTimeout(fn, 0)` 和 `setImmediate` 谁先执行？** 在顶层不确定，取决于进程启动耗时和定时器精度。但在 I/O 回调里，`setImmediate` 一定先于 `setTimeout`，因为 poll 之后就是 check。

**面经**：字节一面：任务循环在浏览器和 Node 有什么区别。https://www.nowcoder.com/discuss/868205678375010304

### 4.🌟`process.nextTick` 和 Promise 微任务谁先？

**一句话**：`nextTick` 先。它有自己的队列，在当前操作结束后、Promise 微任务之前清空。

```js
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
// 输出：nextTick, promise
```

**展开**：

1. `nextTick` 队列在每次阶段切换、每次回调后都会清空。
2. 递归 `nextTick` 会饿死事件循环——它不让出到下一个阶段。
3. 用 `setImmediate` 才是真正的「让出」。

**追问：为什么要有 `nextTick`？** 历史原因：在事件循环继续之前、在 I/O 之前执行回调，保证「当前操作完全结束后再做」。现在多数场景可以用 `queueMicrotask` 替代。

**追问：递归 `nextTick` 会怎样？**

```js
function loop() { process.nextTick(loop); }
loop();   // 事件循环永远进不去，I/O 全部饿死
```

**面经**：暂无已核对的公开原题。

### 5.Node 和浏览器的事件循环有什么区别？

| | 浏览器 | Node |
| --- | --- | --- |
| 结构 | 宏任务 + 微任务 | 六阶段 |
| 微任务时机 | 每个宏任务后 | 每个阶段、每个回调后 |
| `nextTick` | 无 | 有，优先于 Promise |
| `setImmediate` | 无 | 有（check 阶段） |
| 渲染 | 有渲染帧 | 无 |
| `requestAnimationFrame` | 有 | 无 |

**一句话**：浏览器是两层队列，Node 是六阶段流水线，微任务的清空时机更频繁。

**追问：`setTimeout` 的精度一样吗？** 不一样。浏览器有 4ms 最小钳制（嵌套 5 层后），Node 的 `setTimeout` 也受系统精度影响，但更接近指定值。Node 里要「尽快执行」用 `setImmediate`。

**面经**：字节一面问过浏览器和 Node 任务循环的区别。https://www.nowcoder.com/discuss/868205678375010304

## 模块系统

### 6.CommonJS 的模块查找和缓存是怎样的？

**一句话**：`require` 按路径查找文件，编译后执行，结果缓存在 `require.cache`，后续 `require` 直接返回缓存。

**展开**：

1. 查找顺序：核心模块 → `node_modules` 逐级向上找 → 全局路径。
2. 文件扩展名依次尝试 `.js`、`.json`、`.node`、目录的 `package.json` 的 `main`、`index.js`。
3. 模块包装：代码被包进 `function (exports, require, module, __filename, __dirname) {}` 执行。
4. 缓存按解析后的绝对路径索引，所以同一个文件的不同路径写法可能拿到不同实例（符号链接场景）。

**追问：循环依赖会怎样？** 拿到的是「未执行完的 exports」，可能是空对象。因为模块在执行到一半就被另一个模块 require 了，`module.exports` 还没赋值完。

**追问：怎么清除缓存？** `delete require.cache[require.resolve('./mod')]`。热重载、测试隔离时会用，但要注意依赖它的模块还是旧引用。

**面经**：暂无已核对的公开原题。

### 7.ESM 和 CJS 在 Node 里怎么互操作？

**一句话**：ESM 可以 `import` CJS（拿到 `module.exports` 作为 default），CJS 从 Node 22 起可以 `require` ESM（有限制）。

**展开**：

1. `.mjs` 强制 ESM，`.cjs` 强制 CJS，`.js` 看最近的 `package.json` 的 `type` 字段。
2. `import` CJS 模块时，具名导入依赖静态分析（cjs-module-lexer），分析不出来就只能用 default。
3. `require(esm)` 要求模块没有顶层 `await`。
4. `createRequire` 可以在 ESM 里用 `require`。

**追问：为什么 `import { foo } from 'cjs-pkg'` 有时报错？** 因为 cjs-module-lexer 没能静态识别出 `foo` 这个导出（比如 `module.exports = someObject` 动态赋值）。改用 `import pkg from 'cjs-pkg'` 再 `pkg.foo`。

**面经**：暂无已核对的公开原题。

## 内存与 Buffer

### 8.🌟Buffer 是什么，和普通数组有什么区别？

**一句话**：Buffer 是 Node 里处理二进制数据的固定长度字节数组，内存分配在 V8 堆外。

**展开**：

1. 它是 `Uint8Array` 的子类，但分配在 V8 堆外（外部内存），不受 V8 堆大小限制。
2. 创建方式：`Buffer.from()`（拷贝）、`Buffer.alloc()`（初始化零）、`Buffer.allocUnsafe()`（不初始化，可能含旧数据）。
3. `allocUnsafe` 更快，但可能读到之前进程留下的内存，安全敏感场景别用。
4. 超过 4KB 的 Buffer 直接用 `ArrayBuffer`，小于的从 8KB 的池子里切。

**追问：为什么 Buffer 不走 V8 堆？** 因为二进制数据量大、生命周期短，放 V8 堆会导致频繁 GC 和内存碎片。堆外内存由 Node 自己管理，更高效。

**追问：`Buffer.from(str)` 和 `Buffer.alloc(len)` 有什么区别？** 前者从字符串/数组拷贝内容，长度由输入决定；后者分配指定长度的空 Buffer，内容全零。

**面经**：暂无已核对的公开原题。

### 9.什么是流（Stream），有哪几种？

**一句话**：流是分块处理数据的抽象，不用一次性把全部数据读进内存。

| 类型 | 作用 | 例子 |
| --- | --- | --- |
| Readable | 数据源 | `fs.createReadStream`、`http.IncomingMessage` |
| Writable | 数据目的地 | `fs.createWriteStream`、`http.ServerResponse` |
| Duplex | 双向 | `net.Socket`、`zlib` |
| Transform | 读的同时转换 | `zlib.createGzip`、`crypto.createCipheriv` |

**展开**：

1. 流有四种模式：暂停（paused）、流动（flowing）、缓冲、对象模式（`objectMode`）。
2. `pipe` 自动处理背压，比手动 `on('data')` 更安全。
3. `pipeline` 比 `pipe` 更好：能统一处理错误和清理。

**追问：`pipe` 有什么坑？** 源流出错时目标流不会自动关闭，会导致内存泄漏。用 `stream.pipeline` 或 `pipeline` 的 Promise 版本。

**面经**：暂无已核对的公开原题。

### 10.🌟什么是背压，怎么处理？

**一句话**：消费者处理得比生产者慢时，要通知生产者慢下来，否则内存会被缓冲区撑爆。

**展开**：

1. 可写流的 `write()` 返回 `false` 表示缓冲区满了，应该停止写入。
2. 等 `drain` 事件再继续写。
3. `pipe` 内部自动处理这套逻辑。
4. `highWaterMark` 控制缓冲区大小，默认 16KB（字节流）或 16 个对象（对象模式）。

```js
function write(writable, chunk) {
  if (!writable.write(chunk)) {
    return new Promise((resolve) => writable.once('drain', resolve));
  }
}
```

**追问：不处理背压会怎样？** 内存持续增长，最终 OOM。典型场景是「读文件写到网络，网络慢」，不处理就会把整个文件读进内存。

**面经**：暂无已核对的公开原题。

## 并发与多进程

### 11.🌟`cluster`、`worker_threads`、`child_process` 有什么区别？

| | cluster | worker_threads | child_process |
| --- | --- | --- | --- |
| 单位 | 进程 | 线程 | 进程 |
| 内存 | 独立 | 可共享（SharedArrayBuffer） | 独立 |
| 通信 | IPC | MessagePort + 共享内存 | IPC / stdio |
| 用途 | 多核扩 HTTP 服务 | CPU 密集计算 | 跑外部程序 |
| 端口 | 可共享监听 | 不需要 | 不能共享 |

**一句话**：扩服务用 `cluster`，跑 CPU 活用 `worker_threads`，调外部程序用 `child_process`。

**追问：`cluster` 怎么让多个进程监听同一个端口？** 主进程创建 server 并监听，子进程通过 IPC 拿到句柄。Linux 上是主进程 accept 后分发（round-robin 默认），Windows 上是句柄传递。

**追问：`worker_threads` 能共享内存吗？** 能，用 `SharedArrayBuffer` 加 `Atomics` 做同步。这是它比 `child_process` 强的地方——不用序列化大块数据。

**面经**：字节一面问过 Node 的 `cluster` 怎么开启，一个端口能不能被多个进程监听。见 https://jiangjingmin.github.io/posts/experience/collect.html

### 12.`worker_threads` 怎么用？

```js
// main.js
const { Worker } = require('node:worker_threads');
const w = new Worker('./worker.js', { workerData: { n: 40 } });
w.on('message', (result) => console.log(result));
w.on('error', console.error);

// worker.js
const { parentPort, workerData } = require('node:worker_threads');
parentPort.postMessage(fib(workerData.n));
```

**一句话**：主线程创建 Worker，通过 `postMessage` 通信，`workerData` 传初始数据。

**展开**：

1. Worker 有独立的 JS 堆和事件循环，但共享进程。
2. `transferList` 可以转移 `ArrayBuffer` 所有权，避免拷贝。
3. Worker 启动有开销（几十毫秒），不适合频繁创建，要用线程池。
4. `worker.terminate()` 强制结束，不等清理。

**追问：Worker 里能用 `require` 吗？** 能，Worker 有自己的模块系统。但要注意每个 Worker 都会重新加载模块，内存占用是叠加的。

**面经**：暂无已核对的公开原题。

### 13.Node 适合 CPU 密集任务吗？

**一句话**：不适合直接在主线程做，会把事件循环堵住；可以放到 `worker_threads` 或独立服务里。

**展开**：

1. 主线程被 CPU 任务占住时，所有请求都排队，表现为「服务假死」。
2. 判断方法：看事件循环延迟（`perf_hooks.monitorEventLoopDelay`）和 CPU 使用率。
3. 解法：Worker 池（`piscina`）、拆成独立服务（Go / Rust）、或者用 `child_process` 调外部程序。

**追问：什么算 CPU 密集？** 大量计算、加密解密、图片处理、JSON 大对象序列化。判断标准是「会不会长时间占住主线程超过几十毫秒」。

**面经**：暂无已核对的公开原题。

## 排查与运维

### 14.🌟怎么排查 Node 内存泄漏？

**一句话**：先确认是泄漏还是正常高水位（看 GC 后是否回落），再用堆快照对比找出增长对象。

**展开**：

1. `--inspect` 启动，Chrome DevTools 连上，Memory 面板拍堆快照。
2. 操作前后各拍一次，对比「新增的对象」。
3. 常见泄漏源：全局变量、未清理的定时器/监听器、闭包持有大对象、Map/Set 只增不删、事件监听器累积。
4. `process.memoryUsage()` 能看 `heapUsed`、`external`、`rss`。

**追问：怎么判断是不是泄漏？** 强制 GC 后看 `heapUsed` 是否回到基线。如果每次 GC 后基线都在抬高，就是泄漏。

**面经**：暂无已核对的公开原题。

### 15.怎么监控事件循环延迟？

```js
const { monitorEventLoopDelay } = require('node:perf_hooks');
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  console.log('p99:', h.percentile(99) / 1e6, 'ms');
}, 5000);
```

**一句话**：事件循环延迟是「定时器本该执行的时间」和「实际执行时间」的差，延迟高说明主线程被占住了。

**展开**：

1. p99 超过 100ms 就该警惕，超过 1s 基本是卡死。
2. 常见原因：同步 I/O、大 JSON 解析、正则回溯、同步加密、大循环。
3. `--trace-event-categories v8,node,node.async_hooks` 能导出 trace 看细节。

**追问：为什么用 p99 不用平均值？** 平均值会被大量正常请求稀释，用户感知的是最慢的那部分。p99 更能反映真实体验。

**面经**：暂无已核对的公开原题。

### 16.Node 服务怎么做优雅退出？

**一句话**：收到信号后停止接受新连接，等已有请求处理完再退出，超时强制结束。

```js
process.on('SIGTERM', async () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 30000).unref();
});
```

**展开**：

1. `server.close()` 停止监听，等已有连接结束。
2. `unref()` 让定时器不阻止进程退出。
3. 要处理 keep-alive 连接：设置 `server.keepAliveTimeout`，或者主动销毁空闲连接。
4. 数据库连接、消息队列消费者也要在这个阶段关闭。

**追问：为什么 K8s 里经常看到请求被中断？** 因为 Pod 收到 SIGTERM 后，Service 摘除有延迟，还有请求在打进来。要配 `preStop` 钩子 sleep 几秒，等流量真正停掉再关。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 字节 · 一面 | 任务循环在浏览器和 Node 有什么区别 | 3、5 |
| 字节 · 一面 | Node 的 `cluster` 怎么开启、一个端口能否被多进程监听 | 11 |

来源：字节一面 https://www.nowcoder.com/discuss/868205678375010304 ；前端面试档案馆 https://jiangjingmin.github.io/posts/experience/collect.html

## 这一篇没写的东西

- **NestJS 的框架细节**：另一篇。
- **HTTP 模块的具体用法**：属于框架层，面试问到再答。
- **npm 包发布和版本管理**：工程化篇。
- **跨进程通信的协议细节**：属于操作系统，面试很少深问。
