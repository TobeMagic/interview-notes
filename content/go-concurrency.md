# Go 并发

对标 Java 并发。GMP 已经在运行时篇，这一篇只讲「怎么用」。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。

## channel 基础

### 1.🌟channel 有哪几种，有缓冲和无缓冲有什么区别？

**一句话**：无缓冲的发送和接收必须同时就绪才能通过（同步）；有缓冲的发送只要缓冲没满就能立刻返回（异步）。

```go
ch := make(chan int)      // 无缓冲
buf := make(chan int, 3)  // 缓冲 3
```

**展开**：

1. 无缓冲：发送方阻塞到有接收方，接收方阻塞到有发送方。这是「同步交接」。
2. 有缓冲：缓冲没满时发送立即返回，缓冲空时接收阻塞。
3. 缓冲满时发送阻塞，缓冲空时接收阻塞。
4. `cap(ch)` 拿容量，`len(ch)` 拿当前缓冲元素数。

**追问：无缓冲 channel 有什么实际用途？** 做同步点：`done := make(chan struct{})`，goroutine 完成后 `close(done)`，主 goroutine `<-done` 等待。比 `WaitGroup` 更轻。

**面经**：

- channel 底层和 panic，出现率约 5.32%。channel 的作用约 4.33%。https://www.nowcoder.com/discuss/789864350730162176
- 关键词统计里 channel 约占 6.24%。https://www.nowcoder.com/discuss/752654728466534400
- 腾讯校招一面：有缓冲和无缓冲的区别。https://juejin.cn/post/7434352545870184485

### 2.🌟关闭 channel 之后，发送和接收分别会怎样？

**一句话**：发送 panic，接收立刻返回零值且 `ok` 为 false，重复关闭也 panic。

```go
ch := make(chan int, 1)
ch <- 1
close(ch)

v, ok := <-ch     // v=1, ok=true（先取完缓冲）
v, ok = <-ch      // v=0, ok=false（已关闭）
close(ch)         // panic: close of closed channel
ch <- 2           // panic: send on closed channel
```

**展开**：

1. 关闭后缓冲里的数据还能取完，取完才返回零值。
2. `for v := range ch` 会在关闭且缓冲取完后自动结束。
3. 只有发送方应该关闭 channel，接收方不该关。
4. 多个发送方时不能随便关，因为不知道别人发完没有。

**追问：怎么安全地关闭有多个发送方的 channel？** 用一个额外的「关闭信号」channel，或者用 `sync.Once` 保证只关一次，或者用 `context` 取消。

**追问：关闭 channel 有什么好处？** 广播。`close(ch)` 会让所有阻塞在 `<-ch` 的 goroutine 同时醒来（收到零值）。这是「一对多通知」的常用手法。

**面经**：字节搜索后端二面：对已关闭的 channel 读写。https://www.nowcoder.com/discuss/668776138512052224

### 3.🌟对 nil channel 读写会怎样？

**一句话**：读和写都会永久阻塞。在 `select` 里的 nil channel 分支永远不会被选中。

```go
var ch chan int
ch <- 1     // 永久阻塞
<-ch        // 永久阻塞

select {
case <-ch:  // 永远不会选中
default:    // 会走这里
}
```

**展开**：

1. nil channel 的唯一用途就是「动态禁用某个 select 分支」。
2. 判断用 `ch == nil`。
3. 忘记 `make` 是最常见的 nil channel 来源。

**追问：nil channel 在 select 里有什么用？**

```go
var out chan int
if cond {
    out = ch   // 条件满足才启用这个分支
}
select {
case v := <-out:  // cond 为 false 时 out 是 nil，这个分支被禁用
}
```

**面经**：暂无已核对的公开原题。

### 4.🌟什么情况会 panic，什么情况会阻塞？

| 操作 | nil channel | 已关闭 channel | 正常 channel |
| --- | --- | --- | --- |
| 发送 | 永久阻塞 | panic | 缓冲满则阻塞 |
| 接收 | 永久阻塞 | 返回零值 + false | 空则阻塞 |
| 关闭 | panic | panic | 正常关闭 |
| `len` / `cap` | 0 | 剩余缓冲数 | 正常 |

**一句话**：nil 只阻塞，关闭只 panic（接收除外）。

**面经**：暂无已核对的公开原题。

### 5.channel 的底层结构是什么？

**一句话**：一个环形缓冲区 + 两个等待队列（发送方和接收方）+ 一把锁。

```go
type hchan struct {
    qcount   uint      // 当前元素数
    dataqsiz uint      // 缓冲区大小
    buf      unsafe.Pointer  // 环形缓冲区
    sendx    uint      // 发送索引
    recvx    uint      // 接收索引
    recvq    waitq     // 接收等待队列
    sendq    waitq     // 发送等待队列
    lock     mutex
}
```

**展开**：

1. 发送时如果有等待的接收方，直接把数据交给它（不用进缓冲）。
2. 否则如果缓冲没满，放进缓冲区。
3. 否则挂到 `sendq` 等待。
4. 接收是对称逻辑。
5. 关闭时唤醒所有等待者。

**追问：为什么 channel 有锁还能高效？** 因为大部分操作只在队列操作时短暂加锁，数据传递本身是内存拷贝。而且很多场景是「有等待者直接交接」，不经过缓冲。

**面经**：暂无已核对的公开原题。

## select

### 6.🌟`select` 是怎么工作的？

**一句话**：同时等待多个 channel 操作，哪个就绪执行哪个；多个就绪时随机选一个；都没就绪且有 `default` 就执行 `default`。

```go
select {
case v := <-a:
    fmt.Println("a", v)
case b <- 1:
    fmt.Println("sent to b")
case <-time.After(time.Second):
    fmt.Println("timeout")
default:
    fmt.Println("nothing ready")
}
```

**展开**：

1. 随机选择是为了避免饥饿——固定顺序会让某个 case 永远优先。
2. 没有 `default` 时阻塞到至少一个就绪。
3. `time.After` 返回一个 channel，到时间后收到值。但每次调用都会创建定时器，循环里用会泄漏，要用 `time.NewTimer` + `Reset`。

**追问：`select` 里能写 `case <-ch:` 但不读值吗？** 能，只关心「有信号」，不关心值。常用于完成通知。

**追问：`select {}` 空 select 会怎样？** 永久阻塞，导致死锁（如果所有 goroutine 都这样）。可以用来让 main 永不退出，但要小心。

**面经**：暂无已核对的公开原题。

### 7.`select` 能实现超时和取消吗？

```go
select {
case res := <-work():
    return res
case <-ctx.Done():
    return ctx.Err()
case <-time.After(3 * time.Second):
    return errors.New("timeout")
}
```

**一句话**：能，把 `ctx.Done()` 和 `time.After` 当成额外的 case 就行。

**展开**：

1. `ctx.Done()` 在取消或超时时关闭，`<-ctx.Done()` 立刻返回。
2. `time.After` 每次创建新定时器，高频场景要复用 `Timer`。
3. 超时后要确保 `work()` 里的 goroutine 也能退出，否则泄漏。

**追问：`time.After` 在循环里有什么问题？** 每次迭代创建一个 `Timer`，在到期前不会被 GC，高 QPS 下会堆积大量定时器。用 `time.NewTimer` 加 `Reset`，或者用 `context.WithTimeout`（内部也复用）。

**面经**：暂无已核对的公开原题。

## 同步原语

### 8.🌟`Mutex` 和 `RWMutex` 怎么选？

**一句话**：读写比例悬殊、读操作为主时用 `RWMutex`；写多或者临界区很短时 `Mutex` 更快。

**展开**：

1. `RWMutex` 允许多个读者并发，写者独占。
2. `RWMutex` 内部有额外的计数和唤醒逻辑，开销比 `Mutex` 大。
3. 写者优先：有写者在等时，新读者会排队，避免写饥饿。
4. 临界区极短（几个赋值）时，`RWMutex` 的开销可能超过收益。

**追问：`RWMutex` 能重入吗？** 不能。Go 的锁都不可重入，重入会死锁。要重入得自己封装或者改设计。

**追问：读锁里能升级成写锁吗？** 不能，会死锁。要改数据就重新加写锁，或者用其他同步方式。

**面经**：暂无已核对的公开原题。

### 9.🌟`sync.Once` 保证什么？

**一句话**：`Do(f)` 在并发调用下只执行一次 `f`，其他调用阻塞等待第一次完成。

```go
var (
    once sync.Once
    cfg  *Config
)

func GetConfig() *Config {
    once.Do(func() { cfg = load() })
    return cfg
}
```

**展开**：

1. 即使 `f` panic，`Once` 也会标记为已执行，后续调用不会再执行。
2. 适合单例初始化、全局配置加载。
3. 内部用 `atomic` + `Mutex` 实现，快路径无锁。

**追问：`Once` 里 panic 了怎么办？** 会传播 panic，且标记为已完成。如果希望失败后能重试，得自己实现（用 `Mutex` + 标志位）。

**面经**：暂无已核对的公开原题。

### 10.`sync.Pool` 什么时候用？

**一句话**：复用临时对象，减少 GC 压力。适合「创建成本高、生命周期短、可重置」的对象。

```go
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

b := bufPool.Get().(*bytes.Buffer)
b.Reset()
// 用完
bufPool.Put(b)
```

**展开**：

1. Pool 里的对象随时可能被 GC 清掉，不能依赖它一定存在。
2. `Get` 返回的是 `any`，要类型断言。
3. 取出后要 `Reset`，不能假设是干净的。
4. 每个 P 有自己的私有栈和共享链，减少锁竞争。

**追问：Pool 适合放什么？** `bytes.Buffer`、编码/解码的临时缓冲、结构体对象。不适合放有状态且不能重置的对象、不适合放连接（连接要用连接池）。

**面经**：暂无已核对的公开原题。

### 11.`sync.WaitGroup` 怎么用，有什么坑？

```go
var wg sync.WaitGroup
for i := 0; i < 10; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        work(n)
    }(i)
}
wg.Wait()
```

**一句话**：`Add` 加计数，`Done` 减计数，`Wait` 阻塞到计数归零。

**坑**：

1. `Add` 必须在 `go` 之前调用，否则 `Wait` 可能提前返回。
2. `Done` 要用 `defer`，保证 panic 时也减。
3. 不能复制 `WaitGroup`（里面有 `noCopy` 检查）。
4. 计数为负会 panic。

**追问：`WaitGroup` 和 channel 怎么选？** 只等「全部完成」用 `WaitGroup`；需要收集结果或做扇入扇出用 channel。

**面经**：暂无已核对的公开原题。

### 12.🌟原子操作和锁怎么选？

**一句话**：单个变量的简单读写、计数用原子操作；多个变量的组合操作、复杂临界区用锁。

**展开**：

1. `sync/atomic` 提供 `Add`、`Load`、`Store`、`CompareAndSwap`、`Swap`。
2. Go 1.19 起有 `atomic.Int64` 等类型，比函数式更安全（避免忘记用 atomic）。
3. 原子操作不能保证「多个操作的原子性」，比如「读-改-写」组合还是要锁。
4. 原子操作在高竞争下会自旋，性能可能不如锁。

**追问：`atomic.Value` 能存什么？** 任意类型，但要求所有 `Store` 的类型一致。适合无锁读配置、热更新。

**面经**：暂无已核对的公开原题。

### 13.什么是数据竞争，`-race` 能查出什么？

**一句话**：两个 goroutine 同时访问同一内存，至少一个是写，且没有同步。`-race` 能检测出这类问题。

```bash
go test -race ./...
go run -race main.go
```

**展开**：

1. race detector 基于 happens-before 分析，运行时插桩记录内存访问。
2. 只能检测「实际发生」的竞争，没跑到的分支查不出来。
3. 开启后性能下降 5–20 倍，只在测试和预发用。
4. 检测到会打印两个访问的调用栈，直接定位。

**追问：`-race` 没报就说明没竞争吗？** 不说明。它只看实际执行路径，测试覆盖率不够就可能漏。而且它需要真实的并发交错，偶然性很大。

**面经**：暂无已核对的公开原题。

### 14.`sync.Map` 和加锁的 map 怎么选？

**一句话**：读多写少、键集合稳定用 `sync.Map`；写多或要遍历全部键用 `RWMutex` + 普通 map。

**展开**：

1. `sync.Map` 用「只读副本 + 脏 map」分离读写，读几乎无锁。
2. 写多时脏 map 频繁升级，比 `RWMutex` 还慢。
3. `Range` 不是一致性快照，遍历期间可能看到部分更新。
4. `LoadOrStore` 是原子的「读或写」，适合缓存。

**追问：`sync.Map` 的 `Len()` 准吗？** 不准，是近似值，因为要同时看只读和脏两份。

**面经**：`sync.Map` 底层，出现率约 6.49%。https://www.nowcoder.com/discuss/789864350730162176

## context

### 15.🌟`context` 是干什么的？

**一句话**：在 goroutine 之间传递取消信号、超时、截止时间和少量请求范围的值。

```go
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()

select {
case <-ctx.Done():
    return ctx.Err()
case res := <-work(ctx):
    return res
}
```

**展开**：

1. 四种创建方式：`Background`、`TODO`、`WithCancel`、`WithTimeout` / `WithDeadline`、`WithValue`。
2. 取消是「广播」：父 context 取消，所有子 context 都取消。
3. `cancel()` 必须调用，否则泄漏（`WithTimeout` 的定时器不会释放）。

**追问：`context` 是并发安全的吗？** 是。`Done()` 返回的 channel 可以被多个 goroutine 同时读，`Err()` 也安全。可以放心在多个 goroutine 间传递。

**追问：`context.Value` 适合放什么？** 只放「请求范围的元数据」：traceId、用户身份、语言。不要用它传业务参数或依赖，那是函数参数该做的。

**面经**：context 的实现、场景、是否并发安全，出现率约 3.33%，字节等。https://www.nowcoder.com/discuss/789864350730162176

### 16.`context` 的取消是怎么传播的？

**一句话**：父 context 维护一个子节点列表，取消时遍历通知所有子节点，子节点再递归通知自己的子节点。

**展开**：

1. `WithCancel` 返回的 `cancelCtx` 里有 `children map[canceler]struct{}`。
2. 取消时关闭 `done` channel，然后遍历 children 调用它们的 cancel。
3. `WithValue` 不参与取消传播，只是链式查找值。
4. `WithTimeout` 本质是 `WithCancel` + 定时器。

**追问：为什么 `cancel()` 要 `defer`？** 因为它会释放定时器和从父节点摘除自己。不调用会泄漏，`go vet` 会检查这一点。

**面经**：暂无已核对的公开原题。

### 17.怎么在 goroutine 里正确使用 context？

```go
func worker(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case job := <-jobs:
            if err := handle(ctx, job); err != nil {
                return err
            }
        }
    }
}
```

**一句话**：每个可能阻塞的操作都要能响应 `ctx.Done()`，并且把 ctx 传给下游调用。

**展开**：

1. ctx 作为第一个参数，命名为 `ctx`。
2. 不要存进 struct，要显式传递。
3. 下游调用要带上 ctx，让取消能穿透。
4. 阻塞的 I/O 要设超时，否则取消也救不了。

**追问：goroutine 泄漏和 context 有什么关系？** 大部分泄漏是「goroutine 阻塞在 channel 或 I/O 上，没有取消路径」。加 ctx 就有了退出通道。

**面经**：暂无已核对的公开原题。

## 并发模式

### 18.🌟worker pool 怎么写？

```go
func pool(ctx context.Context, jobs <-chan Job, workers int) {
    var wg sync.WaitGroup
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for {
                select {
                case <-ctx.Done():
                    return
                case j, ok := <-jobs:
                    if !ok {
                        return
                    }
                    process(j)
                }
            }
        }()
    }
    wg.Wait()
}
```

**一句话**：固定数量 goroutine 从同一个 channel 取任务，控制并发度。

**展开**：

1. worker 数量按任务类型定：CPU 密集用 `GOMAXPROCS`，I/O 密集可以更多。
2. 用 `ctx` 做整体取消，用 `close(jobs)` 表示没有新任务。
3. 结果的收集用另一个 channel 或者 `sync.WaitGroup` + 共享切片（要加锁）。

**追问：为什么不直接每个任务一个 goroutine？** 任务量大时会创建百万 goroutine，内存和调度压力大。而且无法控制对下游的并发压力（比如数据库连接数）。

**面经**：暂无已核对的公开原题。

### 19.`errgroup` 和 `WaitGroup` 有什么区别？

```go
g, ctx := errgroup.WithContext(context.Background())
for _, url := range urls {
    url := url
    g.Go(func() error {
        return fetch(ctx, url)
    })
}
if err := g.Wait(); err != nil {
    return err
}
```

**一句话**：`errgroup` 在 `WaitGroup` 之上加了「错误传播」和「任一失败即取消其他」。

**展开**：

1. `g.Go` 返回的错误会被收集，`Wait` 返回第一个非 nil 错误。
2. `WithContext` 返回的 ctx 在任一任务失败或被取消时关闭。
3. `SetLimit(n)` 限制并发数（`x/sync` 版本）。
4. 需要收集所有错误用 `errors.Join` 或在闭包里自己聚合。

**追问：`errgroup` 能替代 worker pool 吗？** 加 `SetLimit` 后可以，而且更简洁。但它没有「任务队列」的概念，适合「一批已知任务并发执行」。

**面经**：暂无已核对的公开原题。

### 20.`singleflight` 解决什么问题？

```go
var g singleflight.Group

func GetUser(id string) (*User, error) {
    v, err, _ := g.Do(id, func() (any, error) {
        return fetchUser(id)
    })
    return v.(*User), err
}
```

**一句话**：同一个 key 的并发请求只执行一次，其余等待并共享结果。用于缓存击穿。

**展开**：

1. 典型场景：热点 key 缓存失效，大量请求同时打数据库。
2. `Do` 返回的 `shared` 表示结果是否被多个调用共享。
3. 注意：如果第一次调用失败，所有等待者都拿到同一个错误。

**追问：`singleflight` 和缓存锁有什么区别？** `singleflight` 是「进程内合并」，不需要分布式锁，但有单机限制。多实例部署时各实例还是会各打一次，要配合分布式锁或缓存预热。

**面经**：暂无已核对的公开原题。

### 21.怎么实现「扇出扇入」？

```go
func fanOutIn(ctx context.Context, in <-chan int, n int) <-chan int {
    outs := make([]<-chan int, n)
    for i := range outs {
        outs[i] = worker(ctx, in)
    }
    return merge(ctx, outs...)
}
```

**一句话**：多个 goroutine 从同一个 channel 读（扇出），结果汇到一个 channel（扇入）。

**展开**：

1. 扇出：多个 worker 读同一个 channel，天然负载均衡。
2. 扇入：用 `sync.WaitGroup` + 一个输出 channel，每个 worker 完成后关闭自己的源。
3. 关闭输出要在所有 worker 完成后，用单独的 goroutine 做。

**追问：怎么保证输出 channel 正确关闭？**

```go
func merge(ctx context.Context, cs ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup
    wg.Add(len(cs))
    for _, c := range cs {
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                select {
                case out <- v:
                case <-ctx.Done():
                    return
                }
            }
        }(c)
    }
    go func() { wg.Wait(); close(out) }()
    return out
}
```

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 字节 · 秋招一面 | channel 是否并发安全、和 `Mutex` 的差别 | 5、8 |
| 字节 · 搜索后端二面 | 对已关闭的 channel 读写 | 2 |
| 腾讯 · 校招一面 | 有缓冲和无缓冲 channel 的区别 | 1 |
| 牛客 · Go 高频 | channel panic、`sync.Map` 底层、context | 4、14、15 |

来源：牛客 Go 高频 https://www.nowcoder.com/discuss/789864350730162176 ；关键词统计 https://www.nowcoder.com/discuss/752654728466534400 ；字节秋招一面 https://www.nowcoder.com/feed/main/detail/71e75505e34f43689ce98e20f78f3ed8 ；字节搜索后端二面 https://www.nowcoder.com/discuss/668776138512052224 ；腾讯校招一面 https://juejin.cn/post/7434352545870184485

## 这一篇没写的东西

- **GMP 调度器结构**：运行时篇。
- **GC 和内存管理**：运行时篇。
- **`sync.Cond`、`sync.Map` 的完整 API**：面试很少深问，用到查文档。
- **分布式锁、分布式协调**：分布式系统篇，不属于语言层。
