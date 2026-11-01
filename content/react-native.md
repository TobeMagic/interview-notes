# React Native

国内面经里它多半是项目追问，不是人人必问。这一篇覆盖架构、列表、性能和工程四块。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。

## 架构演进

### 1.🌟旧架构的 Bridge 是怎么工作的？

**一句话**：JS 和原生各跑一个线程，通信全靠异步消息，消息在桥队列里排队，序列化成 JSON 传递。

**展开**：

1. JS 调用原生：JS 线程把调用序列化成 JSON，放进桥队列，原生线程取出执行。
2. 原生回调 JS：同样走队列，回到 JS 线程。
3. 三个线程：JS 线程（React 渲染）、Shadow 线程（布局计算）、主线程（原生 UI）。
4. 桥是异步的、批量的，不是实时的。

**追问：Bridge 有什么问题？** 三个：全异步导致「同步调用」做不了（比如读一个原生属性）；JSON 序列化有开销；队列拥塞时表现为掉帧、手势丢字、白屏。这就是「快输入跟不上」的根因。

**追问：为什么快速输入会丢字？** 每次按键都要过桥，桥一拥塞，后面的按键就排队延迟。受控组件（`value` + `onChangeText`）尤其明显，因为每次输入都要「JS 处理 → 回传原生」。

**面经**：腾讯微信基础部一面追问简历里的 React 转 RN：两端适配、样式、打包。https://www.nowcoder.com/discuss/865669284599513088

### 2.🌟新架构的 JSI 是什么？

**一句话**：JSI 是 C++ 写的 JS 引擎接口层，让 JS 能直接持有原生对象的引用并同步调用，不需要序列化过桥。

**展开**：

1. JSI 不绑定具体引擎，Hermes、JSC 都能接。
2. JS 里可以拿到一个 C++ HostObject，调用它的方法就是直接调用 C++ 函数。
3. 支持同步调用，因为不再是「发消息等回复」，而是直接函数调用。
4. TurboModules 和 Fabric 都建立在 JSI 之上。

**追问：JSI 之后 Bridge 就没了吗？** 旧代码里的 Bridge 调用还兼容（通过 interop layer），但新写的原生模块应该用 TurboModules。0.82 起旧架构被移除。

**面经**：暂无已核对的公开原题。

### 3.🌟Fabric 和 TurboModules 分别解决什么？

**一句话**：Fabric 是新渲染器，把渲染管线搬到 C++ 并支持同步布局；TurboModules 是新原生模块系统，按需懒加载、走 JSI 直接调用。

| | 旧 | 新 |
| --- | --- | --- |
| 渲染 | UIManager + Shadow 线程 | Fabric（C++ 渲染器） |
| 原生模块 | NativeModules（启动时全量初始化） | TurboModules（懒加载） |
| 通信 | Bridge（异步 JSON） | JSI（同步 C++ 调用） |
| 布局 | 异步 | 支持同步测量 |

**展开**：

1. Fabric 把 Shadow Tree 搬到 C++，渲染可以跨线程、可中断，和 React 的并发渲染配合。
2. Fabric 支持「同步布局」：原生侧需要尺寸时能立刻拿到，不用等异步回调。
3. TurboModules 按需加载，启动时不用初始化所有原生模块，冷启动更快。

**追问：新架构现在是什么状态？** 官方在 2024-10 宣布新架构就绪，2025-10 的 0.82 版本起**只有新架构**，旧架构代码被移除。所以面试里说「还在灰度」已经过时。

**面经**：暂无已核对的公开原题。

### 4.Hermes 是什么，为什么用它？

**一句话**：Meta 专为 RN 优化的 JS 引擎，用预编译字节码换取更快的启动和更低的内存。

**展开**：

1. 传统引擎在启动时要解析 + 编译 JS，Hermes 在构建时就把 JS 编译成字节码，启动直接执行。
2. 代价：不支持 JIT，长时间运行的计算性能不如 JSC / V8。
3. 对 RN 合适：RN 的 JS 主要是「胶水代码」，跑得不重，启动和内存更重要。
4. Hermes 也支持 `Intl`、`Proxy` 等特性，但部分 ES 新特性支持滞后。

**追问：Hermes 和 JSC 怎么选？** 0.70 起 Hermes 是默认且推荐。只有遇到 Hermes 不支持的语法或需要 JIT 性能时才考虑 JSC，而且未来 JSC 支持会逐渐弱化。

**面经**：暂无已核对的公开原题。

## 渲染与样式

### 5.RN 的样式和 CSS 有什么区别？

**一句话**：RN 用 JS 对象写样式，是 Flexbox 子集，没有层叠、没有选择器、没有单位。

**展开**：

1. 默认 `flexDirection: 'column'`，和 Web 的 `row` 相反。
2. 所有尺寸是数字，单位是 dp（密度无关像素），不用写 `px`。
3. 没有 `display: block/inline`，只有 `flex` 和 `none`。
4. 不支持伪类、媒体查询，要用 `Dimensions` / `useWindowDimensions` 自己判断。
5. `StyleSheet.create` 有性能收益（一次性创建、可被原生侧缓存）。

**追问：怎么写响应式？** 用 `useWindowDimensions` 拿宽高，按断点算样式；或者用 `flex` 比例布局，尽量少写死尺寸。

**面经**：腾讯微信基础部一面追问 RN 样式适配。https://www.nowcoder.com/discuss/865669284599513088

### 6.RN 的布局是怎么算的？

**一句话**：用 Yoga 引擎（C++ 实现的 Flexbox）算布局，结果交给原生视图设置 frame。

**展开**：

1. Yoga 只实现 Flexbox 子集，不支持 Grid。
2. 布局计算在 Shadow 线程（旧）或 C++ 层（新架构），不占 JS 线程。
3. 布局结果通过 `setFrame` 应用到原生视图。
4. 文本测量要调原生 API，是布局里比较贵的一环。

**追问：为什么 `onLayout` 是异步的？** 因为它要等布局算完才回调。拿到尺寸后再改样式会多一帧，容易出现闪烁。新架构的同步布局能力可以缓解这个问题。

**面经**：暂无已核对的公开原题。

## 列表

### 7.🌟ScrollView、FlatList、FlashList 有什么区别？

| | ScrollView | FlatList | FlashList |
| --- | --- | --- | --- |
| 渲染方式 | 全量渲染所有子节点 | 窗口渲染（只渲染可视区附近） | 复用 cell（类似原生 RecyclerView） |
| 内存 | 随数据量线性增长 | 受 `windowSize` 控制 | 恒定，和屏幕能放下的数量相当 |
| 适用 | 少量内容、需要整体滚动 | 中等列表 | 长列表、复杂 item |
| 实现 | 原生 ScrollView | VirtualizedList | Shopify 维护的第三方库 |

**一句话**：内容少用 `ScrollView`，一般列表用 `FlatList`，长列表或复杂 item 用 `FlashList`。

**追问：`FlatList` 为什么比 `ScrollView` 省内存？** 它只渲染可视区加上下 `windowSize` 范围的内容，滚出范围的就卸载。`ScrollView` 是全部挂载，1 万条数据就是 1 万个原生视图。

**追问：`FlashList` 快在哪？** 它复用已经创建的视图（改数据而不是销毁重建），避免频繁创建/销毁原生视图的开销。代价是 item 必须有稳定的 `estimatedItemSize`，否则滚动会跳。

**面经**：暂无已核对的公开原题。

### 8.🌟FlatList 有哪些关键属性？

| 属性 | 作用 |
| --- | --- |
| `keyExtractor` | 提供稳定 key，避免用 index |
| `getItemLayout` | 提供固定高度，跳过测量，滚动定位更准 |
| `windowSize` | 渲染窗口大小（单位是屏幕高度倍数，默认 21） |
| `initialNumToRender` | 首屏渲染数量 |
| `maxToRenderPerBatch` | 每批渲染数量 |
| `removeClippedSubviews` | 卸载屏幕外的视图（Android 收益明显） |
| `onEndReached` | 触底加载更多 |
| `ListEmptyComponent` | 空状态 |

**一句话**：`keyExtractor` 和 `getItemLayout` 是最值得先配的两个，一个决定 diff 效率，一个决定滚动精度。

**追问：`getItemLayout` 为什么重要？** 有它就不用测量每个 item 的高度，`scrollToIndex` 能立刻定位，长列表滚动也更顺。固定高度的列表一定要配。

**追问：`onEndReached` 会重复触发吗？** 会，尤其滚动快或数据加载慢时。要用标志位或 `onEndReachedThreshold` 控制，加载中不再触发。

**面经**：暂无已核对的公开原题。

### 9.长列表卡顿怎么排查？

**一句话**：先确认是 JS 线程还是 UI 线程的瓶颈，再针对性处理。

**展开**：

1. 开 DevTools 的性能监视器，看 JS FPS 和 UI FPS 哪个掉。
2. JS 掉帧：大量计算、复杂 diff、频繁 setState。用 `InteractionManager` 或分帧处理。
3. UI 掉帧：视图层级太深、图片太大、阴影/圆角开销。用 `shouldRasterizeIOS` 之类的优化，或者简化视图。
4. 列表本身：配 `getItemLayout`、减小 `windowSize`、换成 `FlashList`。

**追问：`InteractionManager.runAfterInteractions` 有什么用？** 把非紧急任务推迟到动画/交互结束后执行，避免和滚动抢资源。现在推荐用 `requestAnimationFrame` 或 `startTransition` 替代。

**面经**：字节剪映二面问过组织树节点卡顿、做过哪些性能优化。https://www.nowcoder.com/discuss/839496349576855552

## 性能

### 10.🌟RN 启动慢怎么优化？

**一句话**：减少 JS bundle 体积、减少启动时的同步工作、用 Hermes 字节码、延迟非首屏初始化。

**展开**：

1. 拆 bundle：首屏只加载必要模块，其余用 `import()` 懒加载。
2. 减少启动时的同步操作：不要在 `index.js` 顶层做重计算、不要同步读大量存储。
3. 启用 Hermes（默认已开），开启字节码预编译。
4. 用 `InteractionManager` 把非关键初始化推迟到首屏渲染后。
5. 原生侧：减少启动时的原生模块初始化（TurboModules 已改善）。

**追问：怎么度量启动时间？** 用 `react-native-startup-time` 或自己埋点：从原生启动到 `AppRegistry.runApplication` 再到首屏 `onLayout`。分阶段看才有意义。

**面经**：暂无已核对的公开原题。

### 11.图片怎么优化？

**一句话**：用合适的尺寸、缓存、渐进加载，避免解码大图占内存。

**展开**：

1. `resizeMode` 选对：`cover` / `contain` / `stretch`，不同模式解码策略不同。
2. 用 CDN 按设备像素密度裁剪（`?w=300&dpr=2`），别直接下原图。
3. `Image` 有内存缓存和磁盘缓存，`FastImage`（第三方）能更精细控制。
4. 列表里的图片要用固定尺寸，避免布局抖动。
5. 大量小图用雪碧图或 `react-native-svg`。

**追问：为什么 RN 加载大图容易 OOM？** 因为图片要解码成位图存在内存里，一张 4000×3000 的图解码后是 48MB。iOS 和 Android 对单张图的内存都有上限。

**面经**：暂无已核对的公开原题。

### 12.怎么和原生通信？

**一句话**：旧架构用 `NativeModules` 和原生事件；新架构用 TurboModules 和 JSI，支持同步调用。

**展开**：

1. JS 调原生：`NativeModules.ModuleName.method()`。
2. 原生调 JS：事件（`DeviceEventEmitter` / `NativeEventEmitter`）或者回调。
3. 新架构：`TurboModuleRegistry.get()` 拿模块，方法直接走 JSI。
4. 需要高性能的场景可以写 C++ 的 JSI HostObject，完全绕过序列化。

**追问：JSBridge 是什么？** 这是 H5 和原生通信的概念（`window.postMessage` / URL scheme），不是 RN 的。RN 本身就是原生渲染，不需要 JSBridge。面试里别混。

**面经**：字节一面（75 分钟）问过 JSBridge。https://www.nowcoder.com/discuss/799382455135293440

### 13.热更新能做什么，不能做什么？

**一句话**：能换 JS bundle，不能换原生代码。原生依赖变了就必须发版。

**展开**：

1. 原理：从服务端下载新 bundle，下次启动时加载。
2. 限制：不能改原生模块、不能加新的原生依赖、不能改 `Info.plist` / `AndroidManifest.xml`。
3. 合规风险：iOS 审核对「动态下发代码改变功能」有限制，只修 bug 的灰度通常可以，改变核心功能有风险。
4. CodePush 已停止服务（2024），现在多用自建方案或 Expo Updates。

**追问：热更新出问题怎么回滚？** 要有版本回滚机制：保留上一个可用 bundle，启动失败时自动回退。还要有「紧急关闭」开关，服务端控制不下发。

**面经**：暂无已核对的公开原题。

## 工程实践

### 14.导航方案怎么选？

| 方案 | 特点 |
| --- | --- |
| React Navigation | 社区标准，JS 实现，灵活 |
| React Native Navigation | 原生导航，性能更好，配置复杂 |
| Expo Router | 基于文件的路由，和 Web 心智一致 |

**一句话**：一般项目用 React Navigation，对原生转场性能要求高时用 React Native Navigation。

**追问：React Navigation 的性能问题在哪？** 它的转场动画在 JS 线程驱动，复杂页面切换可能掉帧。新架构下有所改善，但极端场景仍需原生导航。

**面经**：暂无已核对的公开原题。

### 15.RN 和原生混合开发怎么做？

**一句话**：原生应用里嵌入 RN 页面（brownfield），或者 RN 应用里嵌原生页面（greenfield 里加原生模块）。

**展开**：

1. 嵌入 RN 页面：原生侧创建 `RCTRootView`（iOS）/ `ReactRootView`（Android），加载指定 bundle 和模块名。
2. 页面间跳转：原生路由跳 RN 页面，RN 通过原生模块调起原生页面。
3. 数据传递：`initialProperties` 传初始参数，事件传后续更新。
4. 多个 RN 页面可以共用同一个 bridge / runtime，减少启动开销。

**追问：brownfield 有什么坑？** bundle 加载时机、内存管理（多个 rootView）、原生和 JS 的路由栈同步、版本升级时原生依赖和 JS 依赖要对齐。

**面经**：腾讯微信基础部一面追问简历里的 RN 混合开发。https://www.nowcoder.com/discuss/865669284599513088

### 16.0.82 之后旧架构还能用吗？

**一句话**：不能。0.82（2025-10）起旧架构代码被移除，只能走新架构。

**展开**：

1. 0.76 起新架构是默认，但可以用 `newArchEnabled=false` 关闭。
2. 0.82 起这个开关被移除，Bridge 相关代码删除。
3. 影响：还依赖旧架构 API 的第三方库必须升级，否则不能跑。
4. 迁移要点：检查所有原生依赖是否支持新架构、`TurboModuleRegistry` 替换 `NativeModules`、Fabric 组件的 `codegen` 配置。

**追问：遇到不支持新架构的库怎么办？** 三条路：找替代库、自己 fork 升级、用 interop layer（如果有）。长期看只能升级，因为旧架构不再维护。

**面经**：暂无已核对的公开原题。这是个时效题，答对版本分界比背旧架构更加分。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 腾讯 · 微信基础部一面 | React 转 RN 的两端适配、样式、打包 | 1、5、15 |
| 字节 · 剪映二面 | 组织树节点卡顿、性能优化手段 | 9 |
| 字节 · 一面（75 分钟） | JSBridge | 12 |
| 字节 · 一面（2025-10-09） | RN 开发的「坑」 | 1、2、9 |

来源：腾讯微信基础部一面 https://www.nowcoder.com/discuss/865669284599513088 ；剪映二面 https://www.nowcoder.com/discuss/839496349576855552 ；字节 75 分钟 https://www.nowcoder.com/discuss/799382455135293440 ；字节一面 2025-10-09 https://www.kuazhi.com/post/716286102.html

## 这一篇没写的东西

- **Expo 的完整用法**：属于框架层，面试很少深问。
- **原生开发（iOS / Android）**：RN 岗可能会问基础，但不属于这篇范围。
- **动画库（Reanimated / Animated）**：属于专题，面试问到再答。
- **具体第三方库的 API**：只写选型原则，不写文档搬运。

## 依据

- 新架构就绪：https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here
- 0.82 只支持新架构：https://reactnative.dev/blog/2025/10/08/react-native-0.82
