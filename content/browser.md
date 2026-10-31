# 浏览器

对标 JVM 里「程序怎么跑」的那部分。TCP 握手细节仍看网络基础，这一篇只写前端会被追问的部分。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。带 ⚠️ 的是网上答案普遍过时或写错的地方。

## 浏览器架构

### 1.🌟浏览器是多进程还是多线程的？

**一句话**：现代浏览器是多进程架构，每个标签页通常是一个独立渲染进程，进程内再多线程协作。

**展开**：

1. 主要进程：浏览器主进程（UI、网络、存储）、渲染进程（每个站点一个，隔离崩溃和权限）、GPU 进程（合成、光栅化）、插件进程、网络进程。
2. 站点隔离（Site Isolation）：不同站点强制不同进程，防止 Spectre 这类侧信道攻击。
3. 好处：一个页面崩了不影响别人；坏处：内存占用高，每个进程都有自己的 V8 实例。

**追问：为什么同一站点开两个标签页可能共用一个进程？** 同源站点可以共享进程（进程模型允许合并），具体取决于内存压力和浏览器策略。这不是你能控制的。

**追问：渲染进程里有哪些线程？** 主线程（JS、DOM、样式、布局）、合成线程（分层、分块）、光栅线程（栅格化）、工作线程（Web Worker）。主线程忙住了，页面就不响应。

**面经**：字节剪映一面问过浏览器的进程和线程。https://www.nowcoder.com/discuss/839496349576855552

### 2.为什么 JS 是单线程的？

**一句话**：因为 JS 的主要职责是操作 DOM，多线程同时改 DOM 会带来复杂的同步问题，所以设计成单线程 + 事件循环。

**展开**：

1. 单线程不意味着不能并发：I/O 交给浏览器的其他线程，回调回到主线程执行。
2. 计算密集的任务会阻塞主线程，导致页面卡顿，解法是 Web Worker。
3. Worker 不能直接操作 DOM，只能通过消息通信，这是刻意的隔离。

**追问：Web Worker 能解决所有卡顿吗？** 不能。它只能把纯计算搬走，DOM 操作、样式计算、布局仍然在主线程。而且 Worker 启动和通信有开销，小任务搬过去反而更慢。

**面经**：字节剪映一面问过 JS 为什么是单线程。https://www.nowcoder.com/discuss/839496349576855552

## 从输入 URL 到页面展示

### 3.🌟输入 URL 到页面展示，中间发生了什么？

**一句话**：导航 → 响应 → 解析 → 样式 → 布局 → 绘制 → 合成，七步。

**展开**：

1. **导航**：补全 URL、查 HSTS、检查 Service Worker 缓存、DNS 解析、建 TCP/TLS 连接、发请求。
2. **响应**：看状态码、看 `Content-Type`、决定是下载还是渲染。遇到 `Content-Disposition: attachment` 就下载。
3. **解析**：HTML 逐字节解码成字符，分词成 token，构建 DOM 树。遇到 `<script>` 会阻塞解析（除非 `async` / `defer`）。
4. **样式**：解析 CSS 构建 CSSOM，和 DOM 合并成渲染树（Render Tree），只包含可见节点。
5. **布局**：计算每个节点的位置和大小，产出布局树。
6. **绘制**：生成绘制指令列表，记录「先画什么后画什么」。
7. **合成**：分层、分块、光栅化，交给 GPU 合成上屏。

**追问：DNS 和 TCP 要讲多细？** 前端面试点到为止：DNS 走缓存（浏览器 → 系统 → 路由器 → ISP），TCP 三次握手，TLS 握手。除非面试官明确问网络，否则重点放在拿到 HTML 之后。

**追问：哪一步最慢？** 通常是网络（RTT 累积）和主线程上的 JS 执行。首屏慢先看请求链和关键资源，再看主线程长任务。

**面经**：

- 统计题「输入 URL 到页面展示」，出现概率约 8.85%，字节、百度等。https://www.nowcoder.com/discuss/794499199579488256
- 字节飞书一面：HTML 返回之后，到画出来经过什么。不要求先讲 DNS。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 4.🌟DOM 树和渲染树有什么区别？

**一句话**：DOM 树包含所有节点，渲染树只包含需要显示的节点，而且要合并样式。

**展开**：

1. `display: none` 的节点在 DOM 里，不在渲染树里。
2. `visibility: hidden` 的节点在渲染树里，只是不可见，仍然占位。
3. `::before` / `::after` 这类伪元素在渲染树里，不在 DOM 里。
4. `<head>`、`<script>` 这类不渲染的节点不进渲染树。

**追问：为什么说渲染树包含样式信息？** 因为每个渲染节点都带着计算后的样式（computed style）。同一个 DOM 节点可能对应多个渲染节点（比如 `::before` 和元素本身）。

**面经**：字节一面问过拿到渲染树之后的阶段。https://www.nowcoder.com/discuss/868205678375010304

### 5.🌟`async` 和 `defer` 的区别？

| | 普通 `<script>` | `async` | `defer` |
| --- | --- | --- | --- |
| 下载 | 阻塞解析 | 并行下载 | 并行下载 |
| 执行时机 | 立即，阻塞解析 | 下载完立即执行 | DOM 解析完后，`DOMContentLoaded` 前 |
| 执行顺序 | 按文档顺序 | 不保证 | 按文档顺序 |
| 适用 | 必须同步的脚本 | 独立第三方脚本 | 依赖 DOM 的业务脚本 |

**一句话**：`async` 是「下完就执行，顺序不定」，`defer` 是「下完等着，DOM 好了按顺序执行」。

**追问：`defer` 的脚本一定在 `DOMContentLoaded` 之前执行吗？** 是，规范保证。所以 `defer` 脚本里可以安全访问 DOM。

**追问：`defer` 的脚本还需要监听 `DOMContentLoaded` 吗？** 不需要，它执行时 DOM 已经解析完。加监听反而晚一拍。

**面经**：影石一面问过 `script` 遇到会怎样、`async` 和 `defer` 的区别。https://www.nowcoder.com/discuss/792836776233562112

### 6.为什么 CSS 会阻塞渲染，JS 会阻塞解析？

**一句话**：CSS 阻塞渲染是因为没有样式就没法布局；JS 阻塞解析是因为脚本可能改 DOM 结构。

**展开**：

1. CSS 不阻塞 DOM 解析，但阻塞渲染树构建，也阻塞后面 JS 的执行（因为 JS 可能读样式）。
2. JS 会阻塞解析，因为 `document.write` 可能改变后续内容，解析器必须等它执行完。
3. 所以 `<link>` 放 `<head>`、`<script>` 放底部或用 `defer`，是减少阻塞的标准做法。

**追问：CSS 能阻塞 `DOMContentLoaded` 吗？** 能，如果它后面有脚本，而脚本要等 CSS 加载完才能执行。间接阻塞。

**面经**：暂无已核对的公开原题。

## 渲染流水线

### 7.🌟重排和重绘有什么区别？

**一句话**：重排（回流）是几何属性变了，要重新算布局；重绘是外观变了，布局没变，只重画。

**展开**：

1. 触发重排：改宽高、位置、`display`、字体大小、窗口大小、读取 `offsetTop` / `scrollTop` 这类强制同步布局的属性。
2. 触发重绘：改 `color`、`background`、`visibility`、`box-shadow`。
3. 重排必然重绘，重绘不一定重排。
4. 现代浏览器会批量处理，读一次写一次能避免布局抖动。

**追问：怎么减少重排？** 批量改样式（改 `class` 而不是逐条改）、用 `DocumentFragment` 批量插入、动画用 `transform` / `opacity`（只触发合成）、避免在循环里读写交替。

```js
// 差的写法：强制同步布局，每次读都触发重排
for (const el of items) {
  el.style.width = el.offsetWidth + 10 + 'px';
}

// 好的写法：先读后写
const widths = items.map((el) => el.offsetWidth);
items.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });
```

**面经**：字节剪映一面问过重排和重绘。https://www.nowcoder.com/discuss/839496349576855552

### 8.🌟什么是分层和合成？为什么 `transform` 快？

**一句话**：浏览器把页面拆成多个图层，每个图层独立光栅化，最后由 GPU 合成。改 `transform` / `opacity` 只影响合成，不重排不重绘。

**展开**：

1. 会创建新图层的属性：`transform`、`opacity`、`will-change`、`position: fixed`、`filter`。
2. 合成在 GPU 上做，不占主线程，所以动画流畅。
3. 但图层不是越多越好：每个图层占显存，过多会导致内存暴涨、合成变慢。

**追问：`will-change` 该怎么用？** 只在动画开始前加，动画结束后移除。常驻会一直占图层和显存。别给 `*` 加。

**追问：`transform` 和 `left/top` 做动画的区别？** `left/top` 改的是布局属性，每帧重排；`transform` 只改合成，能跑在合成线程上，不阻塞主线程。

**面经**：暂无已核对的公开原题。

### 9.什么是强制同步布局（layout thrashing）？

**一句话**：在同一个帧里读写交替，每次读都强制浏览器立刻算布局，导致多次重排。

```js
// 每轮都强制布局
for (let i = 0; i < 100; i++) {
  el.style.height = el.offsetHeight + 1 + 'px';
}
```

**展开**：

1. 会触发的读属性：`offsetTop` / `offsetLeft` / `offsetWidth` / `offsetHeight`、`scrollTop`、`clientWidth`、`getComputedStyle`、`getBoundingClientRect`。
2. 浏览器的正常流程是「批量写 → 一次布局 → 一次绘制」，读写交替打破了这个批量。
3. 修法：先收集所有读，再统一写。

**追问：怎么在 DevTools 里发现？** Performance 面板录制，看有没有紫色的 Layout 块密集出现，或者用「Layout Shift」轨道。

**面经**：暂无已核对的公开原题。

### 10.什么是关键渲染路径，怎么优化？

**一句话**：从拿到 HTML 到首屏可见的最短路径，优化目标是减少关键资源数和关键字节数。

**展开**：

1. 关键资源：阻塞渲染的 CSS、阻塞解析的同步脚本、首屏必须的字体和图片。
2. 优化手段：内联首屏关键 CSS、异步加载非关键 CSS（`media` + `onload`）、脚本用 `defer`、字体用 `font-display: swap`、首屏图片预加载。
3. 减少往返次数往往比减小体积更有效，因为 RTT 是硬成本。

**追问：`<link rel="preload">` 和 `prefetch` 有什么区别？** `preload` 是「这个页面马上要用，高优先级下载」；`prefetch` 是「下一个页面可能要用，空闲时低优先级下载」。

**面经**：影石一面问过白屏哪些环节能优化。https://www.nowcoder.com/discuss/792836776233562112

## 缓存

### 11.🌟强缓存和协商缓存有什么区别？

**一句话**：强缓存直接命中本地副本，不发请求；协商缓存会发请求问服务器「还能用吗」，通常返回 304。

| | 强缓存 | 协商缓存 |
| --- | --- | --- |
| 判断依据 | `Cache-Control` / `Expires` | `ETag` / `If-None-Match`、`Last-Modified` / `If-Modified-Since` |
| 是否发请求 | 否 | 是 |
| 状态码 | 200（from disk/memory cache） | 304 |
| 优先级 | 高 | 低 |

**展开**：

1. `Cache-Control: max-age=31536000, immutable` 是强缓存的标准写法。
2. `Expires` 是 HTTP/1.0 的绝对时间，受客户端时钟影响，`Cache-Control` 优先。
3. `ETag` 比 `Last-Modified` 更精确，能识别「1 秒内改多次」。
4. `no-cache` 不是不缓存，是「每次都要协商」；`no-store` 才是完全不缓存。

**追问：为什么 `no-cache` 和 `no-store` 容易搞混？** 名字有误导性。`no-cache` 允许存但必须验证，`no-store` 禁止任何存储。做敏感数据（登录态、支付信息）才用 `no-store`。

**追问：怎么让用户拿到新的 JS？** 文件名带内容哈希（`app.a1b2c3.js`），HTML 不缓存或短缓存。这样发版后 HTML 指向新文件名，旧文件自然失效。

**面经**：

- 列举缓存头，腾讯等。https://www.nowcoder.com/discuss/794499199579488256
- 字节剪映一面：强缓存和协商缓存的区别。https://www.nowcoder.com/discuss/839496349576855552

### 12.🌟HTML 应该怎么设置缓存？

**一句话**：HTML 不缓存或很短（`no-cache` 或 `max-age=0, must-revalidate`），静态资源长缓存加内容哈希。

**展开**：

1. HTML 是入口，必须让用户及时拿到新的引用。用 `no-cache` 走协商，有 304 也不贵。
2. JS/CSS/图片文件名带哈希，可以 `max-age=31536000, immutable`，一年不用再问。
3. 没有构建哈希的老项目，只能用 `no-cache` 或短 `max-age` 加版本参数（`?v=1.2.3`）。

**追问：Service Worker 会覆盖 HTTP 缓存吗？** 会，它在 HTTP 缓存之上。SW 自己接管请求后，HTTP 缓存头对它不起作用，得自己写缓存策略。这也是 SW 容易出现「用户卡在旧版本」的原因。

**面经**：字节一面（2025-10-09）问过资源更新问题：如何让用户加载新的 JS 资源。https://www.kuazhi.com/post/716286102.html

### 13.浏览器有哪些存储，怎么选？

| 方式 | 容量 | 生命周期 | 是否随请求发送 |
| --- | --- | --- | --- |
| Cookie | 4KB | 可设置过期 | 是（同源请求自动带） |
| localStorage | 5–10MB | 永久，手动删 | 否 |
| sessionStorage | 5–10MB | 标签页关闭 | 否 |
| IndexedDB | 数百 MB 起 | 永久 | 否 |
| Cache API | 配额内 | 永久 | 否（Service Worker 用） |

**一句话**：小量身份凭证用 Cookie，简单键值用 localStorage，会话级用 sessionStorage，大量结构化数据用 IndexedDB。

**展开**：

1. Cookie 会自动发送，所以别存大对象，也别存敏感信息（除非 `HttpOnly` + `Secure`）。
2. localStorage 是同步 API，存大对象会卡主线程。
3. IndexedDB 是异步的，支持索引和事务，适合离线数据。

**追问：Cookie 怎么种下去？** 两种：服务端响应头 `Set-Cookie`（可以带 `HttpOnly`，JS 读不到），或者前端 `document.cookie = 'k=v; path=/; max-age=...'`。`HttpOnly` 的 Cookie 前端改不了。

**面经**：

- Cookie、LocalStorage、SessionStorage 的区别。https://www.nowcoder.com/discuss/794499199579488256
- 字节剪映一面：Cookie 和 Session；Cookie 怎么种下。https://www.nowcoder.com/discuss/839496349576855552

## 跨域与安全

### 14.🌟什么是同源策略？

**一句话**：协议、域名、端口三者完全相同才算同源。同源策略限制的是「读」跨源响应，不是「发请求」。

**展开**：

1. 判断只看这三样。`https://a.com` 和 `http://a.com` 不同源，`a.com:80` 和 `a.com:8080` 也不同源。
2. 限制范围：`fetch` / XHR 读响应、读 Cookie、读 DOM（iframe）、读 localStorage。
3. 不限制：`<img>`、`<script>`、`<link>`、`<form>` 提交、`<iframe>` 显示。

**追问：给出四个 URL 判断哪些跨域，怎么做？** 逐个比协议、域名、端口。注意默认端口（http 80、https 443）算同源，子域名不算（`a.example.com` 和 `example.com` 不同源）。

**面经**：

- 四种 URL 是否跨域，出现概率约 7.22%。https://www.nowcoder.com/discuss/794499199579488256
- 字节剪映一面：什么是同源策略，怎么跨域，为什么代理可以绕过。https://www.nowcoder.com/discuss/839496349576855552

### 15.🌟CORS 是怎么工作的？

**一句话**：服务端返回 `Access-Control-Allow-*` 响应头，浏览器据此判断是否把响应交给前端代码。

**展开**：

1. 简单请求（GET/POST/HEAD，且是特定 Content-Type）直接发，看响应头。
2. 非简单请求先发 `OPTIONS` 预检，问服务器允不允许这个方法、头、凭证。
3. `Access-Control-Allow-Origin` 不能是 `*` 同时带 `credentials`，必须回具体源。
4. `Access-Control-Max-Age` 缓存预检结果，减少 OPTIONS 请求。

**追问：跨域请求失败时，服务端收到请求了吗？** 收到了，也可能已经执行了（比如删数据）。浏览器只是不把响应交给 JS。所以「跨域能防 CSRF」是错的。

**追问：开发时为什么代理能绕过？** 因为代理让请求变成同源：浏览器请求本地开发服务器，开发服务器转发到目标（服务端之间没有同源策略）。绕的是浏览器，不是 CORS。

**面经**：

- 影石一面：跨域的表现，发出去没有响应还是没发；根据什么判断跨域；OPTIONS 预检。https://www.nowcoder.com/discuss/792836776233562112
- 字节剪映一面：为什么开发时代理可以绕过跨域。https://www.nowcoder.com/discuss/839496349576855552

### 16.🌟XSS 有哪几种，怎么防？

**一句话**：存储型、反射型、DOM 型三种。防御核心是「不信任任何输入，输出时按上下文转义」。

**展开**：

1. **存储型**：恶意脚本存进数据库，所有访问者都中招。最常见也最危险。
2. **反射型**：脚本在 URL 参数里，服务端拼进 HTML 返回。需要诱导点击。
3. **DOM 型**：前端 JS 把不可信数据写进 `innerHTML`、`eval`、`location`。
4. 防御：输出转义（HTML 实体、属性、JS 字符串、URL 各有规则）、`textContent` 代替 `innerHTML`、CSP 限制脚本来源、`HttpOnly` Cookie 防止窃取会话。

**追问：CSP 能完全防住 XSS 吗？** 不能完全，但能大幅降低危害。严格 CSP（禁 `unsafe-inline`、限定 `script-src`）能挡住大部分注入。绕过手法一直有，所以转义仍是第一道。

**追问：`innerHTML` 一定不安全吗？** 传入静态字符串没问题，传入任何来自用户或接口的数据就有风险。`<img src=x onerror=...>` 这种不执行 `<script>` 也能触发。

**面经**：字节前端一面（75 分钟）问过 CSRF、XSS。https://www.nowcoder.com/discuss/799382455135293440

### 17.🌟CSRF 是什么，怎么防？

**一句话**：攻击者诱导已登录用户在不知情下向目标站发请求，利用的是「浏览器会自动带 Cookie」。

**展开**：

1. 发生条件：用户已登录、攻击者能构造请求、请求参数可预测。
2. 防御：`SameSite=Lax/Strict` Cookie（现代浏览器默认 Lax）、CSRF Token（服务端下发、请求带上）、校验 `Origin` / `Referer`、敏感操作用二次验证。

**追问：`SameSite=Lax` 能防住多少？** 能防住跨站的 POST 和大部分跨站 GET。但顶级导航的 GET 仍会带 Cookie，所以「GET 请求不能有副作用」这条纪律仍然必须遵守。

**追问：JSON API 还需要 CSRF 防护吗？** 需要。虽然跨域读不到响应，但请求已经发出去了。如果接口用 Cookie 鉴权，照样能被利用。

**面经**：字节前端一面（75 分钟）问过 CSRF、XSS。https://www.nowcoder.com/discuss/799382455135293440

### 18.CSP 怎么配？

**一句话**：通过响应头 `Content-Security-Policy` 白名单控制资源来源，用 nonce 或 hash 允许内联脚本。

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  report-uri /csp-report
```

**展开**：

1. `default-src` 是兜底，没单独指定的都用它。
2. `'unsafe-inline'` 会让 CSP 防护大打折扣，能用 nonce 就别用。
3. `report-only` 模式先观察不拦截，适合上线前试。
4. `report-uri` / `report-to` 收集违规报告。

**追问：非ce 方式怎么实施？** 每次请求生成随机 nonce，注入到响应头的 CSP 和页面里的 `<script nonce="...">`。服务端渲染容易做，纯静态站只能靠构建时生成或用 hash。

**面经**：暂无已核对的公开原题。

## 事件循环

### 19.🌟事件循环是怎么工作的？

**一句话**：主线程执行完同步代码后，先清空微任务队列，再取一个宏任务，如此循环。渲染时机在宏任务之间。

**展开**：

1. **宏任务**：`script` 整体、`setTimeout`、`setInterval`、I/O、UI 事件、`MessageChannel`。
2. **微任务**：`Promise.then`、`queueMicrotask`、`MutationObserver`、`await` 后面的代码。
3. 执行顺序：同步代码 → 清空所有微任务 → （可能渲染）→ 下一个宏任务。
4. 微任务里再产生微任务，会在本轮一起清空，可能饿死渲染。

**追问：`requestAnimationFrame` 在哪一步？** 在渲染之前，微任务清空之后。所以 rAF 里改样式能在这一帧生效。

**追问：为什么 `setTimeout(fn, 0)` 不是立即执行？** 因为它是一个宏任务，要等当前任务和所有微任务跑完，还要排队。规范上最小延迟是 4ms（嵌套超过 5 层时）。

**面经**：

- 27 届汇总把事件循环输出题标成出现 6 次以上，字节 TikTok、百度、小红书、番茄、快手都有。https://www.nowcoder.com/discuss/889546972099584000
- 影石一面：怎么用事件循环把大量计算拆开；`requestAnimationFrame` 在循环中的位置。https://www.nowcoder.com/discuss/792836776233562112

### 20.🌟浏览器和 Node 的事件循环有什么区别？

**一句话**：浏览器是「宏任务 + 微任务」两层；Node 有六个阶段，微任务在每个阶段切换时清空，`process.nextTick` 优先于 Promise。

| | 浏览器 | Node |
| --- | --- | --- |
| 结构 | 宏任务队列 + 微任务队列 | 六阶段（timers / pending / idle-prepare / poll / check / close） |
| 微任务时机 | 每个宏任务后 | 每个阶段切换、每次回调后 |
| `nextTick` | 无 | 有，优先于 Promise 微任务 |
| 渲染 | 有渲染帧 | 无 |

**展开**：

1. Node 的 `setImmediate` 在 check 阶段，`setTimeout` 在 timers 阶段，两者顺序取决于进入循环的时机。
2. 浏览器没有 `setImmediate`（IE 有过），替代品是 `MessageChannel`。
3. 详细六阶段在 Node 运行时篇。

**追问：为什么 React 用 `MessageChannel` 不用 `setTimeout`？** 因为 `MessageChannel` 是宏任务但没有 4ms 最小延迟，调度更及时。`setTimeout` 在嵌套多层后会被钳制到 4ms，时间切片粒度就粗了。

**面经**：字节一面：任务循环在浏览器和 Node 有什么区别。https://www.nowcoder.com/discuss/868205678375010304

### 21.微任务会阻塞渲染吗？

**一句话**：会。微任务在渲染之前清空，如果微任务无限递归，页面永远不会绘制。

```js
function loop() {
  Promise.resolve().then(loop);   // 页面直接卡死
}
loop();
```

**展开**：

1. 宏任务之间才有渲染机会，微任务链不断，就轮不到渲染。
2. 常见的隐形问题：`await` 链过长、大量 `Promise.then` 同步递归。
3. 要主动让出，用 `setTimeout` 或 `requestIdleCallback`。

**追问：`await` 一次会让出渲染吗？** 不一定。`await` 后面的代码是微任务，仍在同一个宏任务里。只有等宏任务结束才有渲染机会。

**面经**：暂无已核对的公开原题。

### 22.怎么把长任务拆开？

**一句话**：把大循环切成小片，每片之后让出主线程，让浏览器有机会渲染和响应用户输入。

```js
async function chunked(items, fn, budget = 5) {
  let start = performance.now();
  for (const item of items) {
    fn(item);
    if (performance.now() - start > budget) {
      await new Promise((r) => setTimeout(r, 0));  // 让出
      start = performance.now();
    }
  }
}
```

**展开**：

1. `setTimeout(fn, 0)` 让出最彻底，代价是至少 4ms 延迟。
2. `requestIdleCallback` 只在空闲时跑，适合非紧急任务。
3. `scheduler.postTask` 可以指定优先级（`user-blocking` / `user-visible` / `background`）。
4. React 的并发渲染本质也是这个思路，用 `MessageChannel` 做时间切片。

**追问：什么时候该用 Worker 而不是切片？** 纯计算、不需要 DOM、数据量大时用 Worker。切片只是把卡顿摊薄，总时长没变。

**面经**：影石一面：怎么把大量计算拆开。https://www.nowcoder.com/discuss/792836776233562112

## 网络与传输

### 23.🌟HTTP 缓存之外，前端还能怎么减少请求？

**一句话**：合并、内联、懒加载、预加载，本质是减少关键路径上的往返次数。

**展开**：

1. 合并：小图标用雪碧图或 iconfont，小模块合包（但别过度，影响缓存粒度）。
2. 内联：首屏关键 CSS 内联，小图片用 base64（会增大 HTML，谨慎）。
3. 懒加载：路由级 `import()`、图片 `loading="lazy"`、IntersectionObserver。
4. 预加载：`preload`（当前页关键）、`prefetch`（下一页）、`preconnect`（提前建连）。

**追问：HTTP/2 之后还需要合并吗？** 弱化了。多路复用让并发请求变便宜，过度合并反而影响缓存命中。现在更推荐「按变更频率拆包」。

**面经**：字节一面（75 分钟）问过 HTTP 版本和队头阻塞。https://www.nowcoder.com/discuss/799382455135293440

### 24.🌟SSE 和 WebSocket 怎么选？

**一句话**：只需要服务端推、数据是文本流，用 SSE；需要双向实时通信，用 WebSocket。

| | SSE | WebSocket |
| --- | --- | --- |
| 方向 | 单向（服务端 → 客户端） | 双向 |
| 协议 | HTTP | 独立协议（握手用 HTTP Upgrade） |
| 数据 | 文本（`text/event-stream`） | 文本或二进制 |
| 自动重连 | 内置 | 要自己实现 |
| 代理/网关 | 就是 HTTP，好过 | 需要支持 Upgrade |
| 典型场景 | 大模型流式输出、通知、行情 | 聊天、协作、游戏 |

**展开**：

1. SSE 用 `EventSource`，或者 `fetch` 读 `ReadableStream`（后者能带自定义头、能 POST）。
2. 大模型流式输出多用 `fetch` + `ReadableStream` 而不是 `EventSource`，因为要 POST 和自定义鉴权头。
3. SSE 的坑：中间层可能缓冲，要设 `X-Accel-Buffering: no` 或 `Cache-Control: no-transform`。

**追问：为什么 ChatGPT 用 SSE 不用 WebSocket？** 因为它只需要服务端单向流式输出，SSE 走普通 HTTP，网关、鉴权、负载均衡都能复用，不需要维护长连接状态。

**追问：流式输出半截 Markdown 怎么办？** 边收边解析，但要处理未闭合的语法（比如只收到 `**加粗`）。常见做法是按块增量渲染，或者只在流结束时做最终解析。

**面经**：

- 腾讯前端：为什么对话用 SSE 不用 WebSocket。
- 字节前端一面：SSE 吐出半截 Markdown 怎么办。
- 哈啰：断线重连、心跳、取消之后怎么降级。
- 汇总：https://www.nowcoder.com/discuss/889546972099584000

### 25.`fetch` 和 XHR 有什么区别？

**一句话**：`fetch` 是 Promise 化、更现代的 API，但默认不带 Cookie、不抛 HTTP 错误、没有进度事件。

**展开**：

1. 默认 `credentials: 'same-origin'`，跨域要显式设 `'include'`。
2. `fetch` 只在网络错误时 reject，404/500 也是 resolve。
3. 上传进度要用 `ReadableStream` 包装，XHR 有 `upload.onprogress` 更直接。
4. `fetch` 支持 `AbortController` 取消。

**追问：`fetch` 能取消吗？** 能，用 `AbortController`。老版本浏览器不支持，要 polyfill。取消后 `fetch` 抛 `AbortError`。

**面经**：27 届汇总提到 `fetch` 和 XHR 的差别。https://www.nowcoder.com/discuss/889546972099584000

## 性能指标

### 26.🌟Core Web Vitals 是哪三个指标？

**一句话**：LCP（最大内容绘制）、INP（交互到下一次绘制）、CLS（累积布局偏移）。

| 指标 | 衡量什么 | 良好阈值 |
| --- | --- | --- |
| LCP | 加载性能，首屏主内容何时可见 | ≤2.5s |
| INP | 交互响应，点击到界面更新 | ≤200ms |
| CLS | 视觉稳定性，布局偏移累计 | ≤0.1 |

**展开**：

1. LCP 的元素通常是首屏大图、大标题、视频封面。
2. INP 取代了 FID，因为它衡量的是整个交互的响应，不只是首次输入延迟。
3. CLS 只算「非用户预期」的偏移，用户主动滚动引起的不算。

**追问：LCP 慢该查什么？** 按顺序：TTFB 慢（服务端或网络）→ 资源加载慢（大图/字体）→ 渲染阻塞（CSS/JS）→ 主线程长任务。

**面经**：字节一面（75 分钟）用大约 20 分钟追性能：从指标到阶段，再到具体优化。https://www.nowcoder.com/discuss/799382455135293440

### 27.什么是长任务，怎么发现？

**一句话**：主线程上执行超过 50ms 的任务叫长任务，会阻塞输入响应和渲染。

**展开**：

1. 用 `PerformanceObserver` 监听 `longtask`。
2. DevTools Performance 面板里，超过 50ms 的黄色块就是。
3. 长任务期间用户的点击会排队，表现为「点了没反应」。

```js
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    console.log('长任务', e.duration, e.attribution);
  }
}).observe({ entryTypes: ['longtask'] });
```

**追问：长任务和 INP 有什么关系？** 长任务直接拖高 INP，因为输入事件的回调要等长任务结束才能执行。减少长任务是最有效的 INP 优化。

**面经**：暂无已核对的公开原题。

### 28.白屏时间长，先优化哪个环节？

**一句话**：先看 TTFB 和关键资源，再看主线程。顺序错了会做无用功。

**展开**：

1. TTFB 慢 → 服务端渲染、CDN、接口串行。
2. 关键资源多/大 → 内联关键 CSS、图片压缩、字体子集化。
3. 主线程长任务多 → 拆包、延迟非关键 JS、SSR/流式渲染。
4. 框架水合慢 → 减少首屏组件、用岛屿架构或流式 SSR。

**追问：怎么度量白屏？** 用 FP（首次绘制）、FCP（首次内容绘制）、LCP。也可以用 `PerformanceObserver` 自己打点，看从导航开始到首屏关键元素出现的时间。

**面经**：影石一面问过白屏哪些环节能优化。https://www.nowcoder.com/discuss/792836776233562112

## 其他常考点

### 29.`DOMContentLoaded` 和 `load` 有什么区别？

**一句话**：`DOMContentLoaded` 在 HTML 解析完、`defer` 脚本执行完后触发；`load` 要等所有资源（图片、样式、iframe）加载完。

**展开**：

1. `DOMContentLoaded` 时图片可能还没加载，尺寸拿不到。
2. `load` 时所有资源就绪，但用户可能早就看到页面了。
3. 首屏逻辑用 `DOMContentLoaded`，统计上报用 `load` 或 `visibilitychange`。

**追问：`readyState` 有哪几个值？** `loading`（解析中）、`interactive`（解析完，对应 DOMContentLoaded 前）、`complete`（加载完，对应 load 前）。

**面经**：暂无已核对的公开原题。

### 30.`requestAnimationFrame` 和 `setTimeout` 做动画有什么区别？

**一句话**：`requestAnimationFrame` 跟着浏览器刷新率走（通常 60fps），页面不可见时暂停；`setTimeout` 不受刷新率约束，会掉帧也会白跑。

**展开**：

1. rAF 回调在渲染前执行，改样式能当帧生效。
2. 页面切到后台，rAF 自动暂停，省电。
3. `setTimeout` 有最小延迟钳制，且不与渲染同步，容易抖动。

**追问：rAF 里做计算会怎样？** 会占用渲染时间，导致掉帧。复杂计算应该放到 Worker，或者用 `requestIdleCallback`。

**面经**：影石一面问过 `requestAnimationFrame` 在事件循环中的位置。https://www.nowcoder.com/discuss/792836776233562112

### 31.什么是 Service Worker，能做什么？

**一句话**：一个独立的、可拦截网络请求的后台脚本，能做离线缓存、消息推送、后台同步。

**展开**：

1. 生命周期：注册 → 安装（`install`）→ 激活（`activate`）→ 拦截（`fetch`）。
2. 只能在 HTTPS（或 localhost）下运行。
3. 不能访问 DOM，不能直接用 `localStorage`（用 IndexedDB 或 Cache API）。
4. 更新时机：脚本内容变了才会触发新版本安装，旧的等所有标签页关闭才退出。

**追问：为什么 SW 容易让用户卡在旧版本？** 因为默认 `waiting` 状态会等所有旧页面关闭。要用 `skipWaiting()` + `clients.claim()` 立即接管，但要小心资源版本不一致。

**面经**：暂无已核对的公开原题。

### 32.Web Worker 有哪些限制？

**一句话**：不能访问 DOM、不能访问 `window`，只能通过消息通信，且是独立的作用域。

**展开**：

1. 能用：`fetch`、IndexedDB、WebSocket、`crypto`、`performance`。
2. 不能用：`document`、`window`、`localStorage`、`alert`。
3. 通信：`postMessage` / `onmessage`，传对象是结构化克隆（会拷贝），`transferable` 可以转移所有权避免拷贝。
4. 模块 Worker 用 `type: 'module'`，能 `import`。

**追问：SharedArrayBuffer 怎么用？** 需要跨源隔离（COOP + COEP 响应头），然后用 `Atomics` 做同步。适合多 Worker 共享大缓冲区，比如音视频处理。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 字节 · 剪映一面 | 浏览器的进程和线程、JS 为什么单线程 | 1、2 |
| 字节 · 飞书一面 | HTML 返回之后到画出来经过什么 | 3 |
| 字节 · 一面 | 拿到渲染树之后的阶段 | 4 |
| 影石 · 一面 | `async` 和 `defer`、白屏优化 | 5、28 |
| 字节 · 剪映一面 | 重排和重绘、强缓存和协商缓存 | 7、11 |
| 字节 · 一面（2025-10-09） | 如何让用户加载新的 JS | 12 |
| 字节 · 剪映一面 | Cookie 和 Session、Cookie 怎么种下 | 13 |
| 字节 · 剪映一面 | 同源策略、代理绕过跨域 | 14、15 |
| 影石 · 一面 | 跨域的表现、OPTIONS 预检 | 15 |
| 字节 · 一面（75 分钟） | CSRF、XSS、HTTP 版本队头阻塞 | 16、17、23 |
| 字节 · 一面 | 浏览器与 Node 事件循环的区别 | 20 |
| 影石 · 一面 | 事件循环拆计算、rAF 位置 | 19、22、30 |
| 字节 · 一面（75 分钟） | 性能指标到优化阶段 | 26 |

来源：27 届汇总 https://www.nowcoder.com/discuss/889546972099584000 ；八股精 Web 前端 https://www.nowcoder.com/discuss/794499199579488256 ；字节一面 https://www.nowcoder.com/discuss/868205678375010304 ；剪映一面 https://www.nowcoder.com/discuss/839496349576855552 ；影石一面 https://www.nowcoder.com/discuss/792836776233562112 ；字节 75 分钟 https://www.nowcoder.com/discuss/799382455135293440 ；字节一面 2025-10-09 https://www.kuazhi.com/post/716286102.html

## 这一篇没写的东西

- **TCP / TLS 握手的细节**：网络基础篇。这里只点到「建连是 RTT 成本」。
- **HTTP 各版本的具体协议差异**：只在第 23 题点一句队头阻塞，详细内容属于网络篇。
- **React 的重渲染和虚拟列表**：React 篇。这里只讲浏览器侧的渲染流水线。
- **具体的构建优化手段**：工程化篇。这里只讲浏览器如何对待资源。
