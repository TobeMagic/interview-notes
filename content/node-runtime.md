# Node 运行时

对标 JVM，加上和并发重叠的那一段。NestJS 在另一篇。

答案不在这里。

## 事件循环

六阶段、`nextTick`、微任务、和浏览器的差别并成一节。

要写的题：

1. 一轮循环经过哪六个阶段。`setTimeout` 和 `setImmediate` 各落在哪。
2. `process.nextTick` 和 Promise 微任务谁先。
3. 浏览器的任务循环和这里差在哪。渲染帧在 Node 里没有对应物。

面经：

- 字节一面：任务循环在浏览器和 Node 有什么区别。https://www.nowcoder.com/discuss/868205678375010304
- 腾讯微信基础部一面把 Node 和 NestJS 放在同一段基础理论里问。https://www.nowcoder.com/discuss/865669284599513088

浏览器篇的事件循环输出题负责手写。这篇只讲六阶段和差别。

## 内存和 Buffer

Buffer 并进这一节，不单开。

要写的题：

1. 堆、栈、进程外的内存各放什么。
2. Buffer 为什么不走普通的 JS 堆。
3. 什么时候会把主线程堵住。GC 停顿在面试里点到「会卡」，不展开 V8 分代细节成另一篇。

## Stream 和背压

单独一节。

要写的题：

1. 可读、可写、双工、转换流各干什么。
2. 读得比写得快时，背压怎么停下来。

## cluster、worker_threads、child_process

并成一节。

要写的题：

1. `cluster` 解决的是多核上的监听，进程之间不共享堆。
2. `worker_threads` 解决的是 CPU 活。什么能共享内存。
3. `child_process` 用来跑外部程序。和上面两者不要混。
4. libuv 线程池默认拿去跑什么，不拿去跑 JS。

面经：

- 字节一面问过 Node 的 `cluster` 怎么开，一个端口能不能被多个进程听。见前端面试档案馆对字节一面的记录：https://jiangjingmin.github.io/posts/experience/collect.html
