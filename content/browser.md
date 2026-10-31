# 浏览器

对标「程序怎么跑」。TCP 握手细节仍看源站计算机网络，这里只写前端会被追问的部分。

答案不在这里。

## 从输入 URL 到页面出来

渲染流水线、重排重绘、`async` / `defer` 并进这一节，不拆开。

要写的题：

1. 输入 URL 到页面展示经过哪些阶段。DNS 和 TCP 只点到为止，重点在拿到 HTML 之后。
2. DOM、CSSOM、布局、分层、绘制、合成。
3. 重排和重绘差在哪，怎么少做。
4. `script` 的 `async` 和 `defer` 怎么执行。
5. 白屏长，哪些环节能先动。

面经：

- 统计题「输入 URL 到页面展示」，出现概率约 8.85%，字节、百度等。https://www.nowcoder.com/discuss/794499199579488256
- 字节飞书一面：HTML 返回之后，到画出来经过什么。不要求先讲 DNS。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 字节一面：拿到渲染树之后的阶段；光栅化为什么交给 GPU。https://www.nowcoder.com/discuss/868205678375010304
- 影石一面：遇到 `script` 会怎样；白屏哪些环节能优化。https://www.nowcoder.com/discuss/792836776233562112

## 强缓存和协商缓存

并成一节，把字段和选型一起讲。

要写的题：

1. 强缓存和协商缓存各看哪些头。
2. 什么资源用强缓存，什么资源用协商缓存。
3. 怎么让用户拿到新的 JS。

面经：

- 列举缓存头，腾讯等。https://www.nowcoder.com/discuss/794499199579488256
- 字节、快手：浏览器怎么区分两种缓存，怎么选。同上。
- 字节剪映一面：强缓存和协商缓存的区别。https://www.nowcoder.com/discuss/839496349576855552

## 同源、跨域、预检

并成一节。

要写的题：

1. 怎样算同源。给出四个 URL，判断哪些跨域。
2. 跨域时请求有没有发出去，预检请求是什么。
3. 开发时代理为什么能绕过。

面经：

- 四种 URL 是否跨域，出现概率约 7.22%。https://www.nowcoder.com/discuss/794499199579488256
- 字节剪映一面：什么是同源策略，怎么跨域，为什么代理可以绕过。https://www.nowcoder.com/discuss/839496349576855552
- 影石一面：跨域的表现，发出去没有响应还是没发；根据什么判断跨域；OPTIONS。https://www.nowcoder.com/discuss/792836776233562112

## 存储

Cookie、localStorage、sessionStorage、IndexedDB 并成一节。

要写的题：

1. 四者差在容量、生命周期、会不会跟请求走。
2. Cookie 是怎么种下去的。和 Session 怎么配合。

面经：

- Cookie、LocalStorage、SessionStorage 的区别。https://www.nowcoder.com/discuss/794499199579488256
- 字节剪映一面：Cookie 和 Session；Cookie 怎么种下；LocalStorage 和 SessionStorage。https://www.nowcoder.com/discuss/839496349576855552

## 安全

XSS 和 CSRF 并成一节。

要写的题：

1. XSS 从哪进来，页面上怎么挡。
2. CSRF 靠什么发生，Cookie 在这里扮演什么角色。

面经：

- 字节前端一面：CSRF、XSS。https://www.nowcoder.com/discuss/799382455135293440

## 网络里新增的一问：SSE 和 WebSocket

并进网络，不单开 AI 篇。

要写的题：

1. 什么时候用 SSE，什么时候用 WebSocket。
2. 流式输出半截 Markdown 怎么处理。断线之后怎么续。

面经：

- 腾讯前端：为什么对话用 SSE 不用 WebSocket。
- 字节前端一面：SSE 吐出半截 Markdown 怎么办。
- 哈啰：断线重连、心跳、取消之后怎么降级。
- 汇总：https://www.nowcoder.com/discuss/889546972099584000

## 事件循环

单独成节。输出题是机制题，留在这里。和 Node 六阶段的差别在这一节写清，Node 篇只回指。

要写的题：

1. 宏任务和微任务有哪些，一段代码的输出顺序。
2. 大量计算把页面卡住，怎么把活拆开。
3. `requestAnimationFrame` 落在循环的哪一步。

面经：

- 27 届汇总把手撕里的事件循环输出题标成出现 6 次以上，字节 TikTok、百度、小红书、字节番茄、快手都有。https://www.nowcoder.com/discuss/889546972099584000
- 字节一面：微任务和宏任务是什么；浏览器和 Node 的任务循环有什么区别。https://www.nowcoder.com/discuss/868205678375010304
- 影石一面：怎么用事件循环把大量计算拆开；`requestAnimationFrame` 在循环中的位置。https://www.nowcoder.com/discuss/792836776233562112

## 加载性能

关键路径、LCP、INP、CLS、长任务并成一节。虚拟列表的结论和 React 篇共用，这里写指标和长任务。

要写的题：

1. LCP、INP、CLS 各表示什么，坏了先看哪。
2. 什么叫长任务。主线程被占住时页面会怎样。
3. 首屏慢，先砍请求链还是先砍 JS。

面经：

- 字节一面用大约 20 分钟追性能：从指标到阶段，再到具体优化。https://www.nowcoder.com/discuss/799382455135293440
- 27 届汇总把首屏、虚拟列表、性能指标分成三块。https://www.nowcoder.com/discuss/889546972099584000
