# 第二章 Go 语言

对标 Java SE 和集合。GMP、GC 在运行时篇，channel 和锁在并发篇。这一章只管「语法和数据结构本身」。

排版约定：每题先一句能说出口的答案，再展开，再列追问。题下紧跟已核对的公开原题。章末有汇总索引。带 ⚠️ 的是网上答案普遍过时或写错的地方。

## 1. 程序怎么编译和跑

**一句话**：`go build` 把包和依赖一起静态编成一个可执行文件，直接交给操作系统跑，没有虚拟机。

**展开**：

1. 编译器（`cmd/compile`）把每个包编成目标文件，链接器（`cmd/link`）合成一个二进制。默认静态链接，不依赖 libc，`CGO_ENABLED=0` 时可完全静态。
2. 没有字节码，没有 JIT。机器码在编译期就定了，所以启动没有预热。
3. 交叉编译只要设 `GOOS` / `GOARCH`，因为不依赖目标机的 C 运行时。
4. 每个可执行文件里都链了一份**运行时**，它负责调度 goroutine、GC、map 的哈希随机化、channel 实现。这就是「有运行时但没有虚拟机」：运行时代码编进你的二进制，不是外部进程。

| | Java | Go |
| --- | --- | --- |
| 产物 | `.class` 字节码 + jar | 单个原生可执行文件 |
| 执行 | JVM 解释 + JIT | 直接执行机器码 |
| 运行时 | 外部 JVM，参数调优 | 编进二进制，靠 `GOGC`、`GOMAXPROCS` 调 |
| 部署 | 需要装对应 JDK | `scp` 一个文件 |

**追问：为什么 Go 启动快？** 没有类加载、没有 JIT 预热。代价是少了「跑久了越来越快」的优化，所以性能更依赖写好代码而不是等编译器。

**追问：`go run` 和 `go build` 的区别？** `go run` 编到临时目录再执行，适合开发；`go build` 留下产物。

**追问：`init` 什么时候跑？** 包被导入时，先按依赖顺序初始化包级变量，再跑 `init`。同一包里多个 `init` 按文件名字典序、文件内按出现顺序。`init` 不能被调用，也没有参数和返回值。常见用途是注册驱动——`database/sql` 的驱动就靠 `init` 注册。

**面经**：暂无已核对的公开原题。这题通常从「Go 和 Java 的区别」「为什么选 Go」起手。

## 2. 类型：值、指针、零值

**一句话**：Go 只有值传递。指针也是值，只是这个值是个地址。

**展开**：

1. 函数传参永远拷贝。传指针拷贝地址，所以能改到原对象；传结构体拷贝整个结构体，改了不影响外面。
2. **零值可用**是 Go 的设计原则：`var s string` 是 `""`，`var n int` 是 `0`，`var p *T` 是 `nil`，`var m map[K]V` 是 `nil`，`var sl []T` 是 `nil`。所以很少写构造函数，`var buf bytes.Buffer` 直接能用。
3. 零值可用不等于什么都能做：`nil` map 能读不能写，`nil` slice 能 `append`，`nil` channel 读写都永久阻塞。

**追问：什么时候用指针接收者？** 三条：要修改接收者、结构体较大拷贝贵、或者类型里已经混用了指针接收者（保持一致，否则方法集对不上，接口实现会出问题）。

**追问：`string` 能改吗？** 不能，它是不可变字节序列加长度。`s[0] = 'x'` 编译不过。要改先转 `[]byte`，改完再转回来——这一步会拷贝。

**面经**：腾讯校招一面问过 slice 和数组的区别、底层结构，顺带问到值传递。https://juejin.cn/post/7434352545870184485

## 3. slice：开头带上 `make` 和 `new`

这一节把 `make` / `new` 放在最前面，因为面试里它常和 slice 一起问。

### 3.1 `make` 和 `new`

**一句话**：`new(T)` 返回 `*T`，指向一个零值；`make` 只能用于 slice、map、channel，返回初始化好的值本身，不是指针。

```go
p := new(int)        // *int，指向 0
*p = 1

s := make([]int, 3)  // len=3, cap=3，里面是三个 0
m := make(map[string]int)      // 分配了哈希表，可以写
c := make(chan int, 10)        // 带缓冲
```

**追问：`new([]int)` 能用吗？** 能编译，返回 `*[]int` 指向 nil slice，但几乎没用——还得 `*p = append(*p, 1)`。想要能用的 slice 用 `make` 或字面量。

**追问：为什么 `var m map[string]int` 直接赋值会 panic？** 它是 nil map，底层没有哈希表。读安全（返回零值），写 panic。所以 map 必须 `make` 或字面量初始化。

**面经**：牛客 Go 高频统计里 `make` / `new` 约 6.82%。https://www.nowcoder.com/discuss/789864350730162176

### 3.2 slice 的结构

**一句话**：slice 是 `{指向底层数组的指针, len, cap}` 三元组，它本身是值，拷贝 slice 只拷贝这个三元组。

```go
type slice struct {
    array unsafe.Pointer
    len   int
    cap   int
}
```

**所以**：

1. 传 slice 进函数，函数里改元素，外面看得到——共用底层数组。
2. 函数里 `append` 导致扩容，外面看不到新元素——函数里的 slice 头是拷贝，扩容后指向新数组。
3. 没扩容的 `append` 也会改到底层数组，可能覆盖外面看不到的位置：

```go
func f(s []int) { s = append(s, 1) }
a := make([]int, 0, 4)
f(a)
fmt.Println(len(a))   // 0，长度没变；但底层数组第 0 位已是 1
```

**追问：为什么 `append` 之后要接收返回值？** 因为它可能返回指向新数组的新 slice 头。`append(s, x)` 不赋值给任何变量，在扩容时等于白做。

**面经**：

- 牛客 Go 高频：slice 和数组的底层约 4.16%，slice 原理约 3.66%。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯校招一面：slice 和数组的区别，底层结构。https://juejin.cn/post/7434352545870184485

### 3.3 扩容

**一句话**：容量不够时申请更大的数组，把旧数据拷过去，返回指向新数组的 slice。旧数组如果还有别的 slice 引用，就继续留着。

要答的细节：

1. 小 slice 增长快（接近翻倍），大 slice 增长放缓（新版按元素大小分档，约 1.25 倍），目的是控制内存浪费。
2. **扩容后的 cap 不保证等于你以为的数**，实现会对齐到内存分配器的 size class。别背死「一定 2 倍」。
3. `make([]T, 0, n)` 预分配能避免多次拷贝，这是最常见的性能优化。
4. `s = s[:0]` 复用底层数组，但元素还留着，持有指针会阻止 GC。

**追问：`copy` 和 `append` 谁快？** 已知长度时 `copy` 直接写内存，`append` 要检查容量。往已有 slice 填数据用 `copy`。

**追问：截取会泄漏吗？** 会。`big[0:10]` 仍持有整个 `big` 的底层数组，只要这个小 slice 活着，整块内存都回收不掉。修法是 `append([]T(nil), big[:10]...)` 拷出来。

**面经**：牛客 Go 高频：slice 扩容约 5.82%。https://www.nowcoder.com/discuss/789864350730162176

### 3.4 数组和 slice 的区别

| | 数组 `[3]int` | slice `[]int` |
| --- | --- | --- |
| 长度 | 类型的一部分，编译期定死 | 运行时可变 |
| 赋值 | 整块拷贝 | 拷贝三元组，共用底层数组 |
| 比较 | 可 `==`（长度相同、元素相同） | 只能和 `nil` 比 |
| 传参 | 拷贝整个数组 | 拷贝三元组 |

**追问：为什么很少直接传数组？** 拷贝成本随长度增长，函数签名还被长度绑死。要么传指针 `*[3]int`，要么转 slice。

## 4. map

### 4.1 底层结构

**⚠️ 这是最容易背过时的一节。** 十几年来的标准答案都是「hmap + bmap、每桶 8 个 key、溢出桶链」。**Go 1.24 起内置 map 换成了 Swiss Table 实现**，桶模型已不是当前实现。

现在的结构（按官方实现注释和官方博客）：

1. map 顶层是若干独立表（table），每张表最多 1024 条。哈希高位用来选进哪张表，这是可扩展哈希。
2. 表内部是开放寻址，存储切成 8 槽一组。每组配一个 64 位控制字，每字节对应一个槽：一位表示空/已删/在用，低 7 位存该键哈希的低 7 位（`h2`）。
3. 查找时用 `h2` 对控制字做一次并行比较，一次筛掉组里 8 槽中的绝大多数，再用完整键确认。这是 Swiss Table 的核心收益。
4. 删除时如果组是满的，要留 tombstone（墓碑），否则探测会提前停。墓碑只在扩容时彻底清掉。
5. 扩容以「表」为单位整张扩，不是全 map 一起搬。

**面试怎么答**：先说「1.24 之前是分桶 + 溢出桶，1.24 起是 Swiss Table，每组 8 槽加控制字」，再讲查找流程。主动说明版本分界，比背旧桶模型安全。

**追问：为什么 map 的遍历顺序是随机的？** 故意的。运行时每次遍历随机选起点，防止业务依赖顺序。要顺序就自己排序键。

**面经**：腾讯校招一面问过 map 怎么并发安全、底层结构。https://juejin.cn/post/7434352545870184485

### 4.2 并发不安全

**一句话**：map 没有内部锁，并发读写会触发运行时检查并**直接 fatal**，不是 panic，`recover` 抓不住。

```go
var m = map[int]int{}
go func() { for { m[1] = 1 } }()
go func() { for { _ = m[2] } }()
// fatal error: concurrent map read and map write
```

**要点**：

1. 这个检查是抽样式的：写操作置标志位，读操作检查。所以「没崩过」不代表安全。
2. fatal error 无法恢复：它走 `throw` 而非 `panic`，整个进程退出，defer 也执行不完。
3. 修法：`sync.RWMutex` 包一层，或者 `sync.Map`（读多写少、键集合稳定时）。

**追问：`sync.Map` 为什么快？** 它用「只读副本 + 脏 map」分离读写：读几乎不加锁，写时才动锁并把新键记到 dirty，读不到再去 dirty 补。所以**读多写少**才划算；写多或要遍历全部键时不如 `RWMutex` + 普通 map。

**追问：nil map 和空 map 的区别？** `var m map[K]V` 是 nil，能读、`len` 为 0、`range` 正常结束，但写会 panic；`make(map[K]V)` 是空 map，能写。判断用 `m == nil`。

**追问：map 的 key 有什么要求？** 必须可比较（comparable）。slice、map、func 不能当 key，包含它们的 struct 也不能。

**面经**：

- 牛客 Go 高频：`sync.Map` 约 6.49%。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯校招一面：map 并发访问会怎样，异常能不能抓住。https://juejin.cn/post/7434352545870184485

## 5. string

**一句话**：`string` 是只读的字节序列加一个长度。它不记录字符，只记录字节。

**要点**：

1. `len(s)` 是字节数，不是字符数。中文一个字 3 字节，emoji 可能 4 字节。
2. `range s` 按 rune（UTF-8 码点）迭代，`s[i]` 按字节取。混用会切坏字符。
3. `s[i:j]` 是**字节**下标切片，可能切出非法 UTF-8。
4. `string` 和 `[]byte` 互转要拷贝。编译器对 `m[string(b)]`、比较这类场景有优化，不产生拷贝，但别依赖；要零拷贝用 `unsafe` 或 `strings.Builder`。
5. 拼接：少量用 `+`，循环里用 `strings.Builder`（预分配 `Grow`）。

**追问：为什么 `string` 不可变？** 因为可以被安全共享、当 map key、并发读不用锁。代价是每次修改都要新建。

**追问：`[]rune(s)` 和 `range s` 的差别？** 都按码点，`[]rune` 一次性分配切片（内存翻几倍），`range` 边遍历边解码，不额外分配。只要遍历就用 `range`。

**面经**：暂无已核对的公开原题。

## 6. 方法与接口

### 6.1 方法集

**一句话**：值类型的方法集只有值接收者方法，指针类型的方法集包含值接收者和指针接收者方法。

**后果**：`*T` 能满足的接口，`T` 不一定能满足。

```go
type Speaker interface { Speak() }
type Dog struct{}
func (d *Dog) Speak() {}

var s Speaker = &Dog{}   // ok
var s2 Speaker = Dog{}   // 编译错误：Dog 的方法集里没有 Speak
```

**追问：为什么值接收者的方法，指针也能调？** 可寻址时编译器自动取地址（`(&d).Speak()`）。但放进接口时不会自动取地址，所以上面第二行报错。

**面经**：腾讯校招一面问过 interface 怎么理解、能不能比较。https://juejin.cn/post/7434352545870184485

### 6.2 接口是隐式的

**一句话**：不需要 `implements`，只要方法集满足就自动实现。这叫结构化满足，和 Java 的显式声明相反。

**好处**：可以为别人的类型定义接口。
**代价**：不知道该实现谁，要靠编译期兜底：

```go
var _ Iface = (*T)(nil)   // 编译期确认 *T 实现了 Iface
```

**空接口**：`any` 就是 `interface{}`，任何类型都满足，等价于 Java 的 `Object`。Go 1.18 起 `any` 是别名，不是新类型。

**面经**：暂无已核对的公开原题。

### 6.3 接口的 nil 陷阱

**一句话**：接口值是「类型 + 数据」二元组，只有两者都为 nil，接口才等于 nil。

```go
type MyErr struct{}
func (e *MyErr) Error() string { return "x" }

func f() error {
    var e *MyErr = nil
    return e            // 返回的 error 里有类型 *MyErr，数据是 nil
}

fmt.Println(f() == nil)  // false
```

**为什么**：`e` 转成 `error` 时，类型信息 `*MyErr` 被填进去了，只是数据指针是 nil。所以 `err != nil` 成立，但调 `err.Error()` 可能 panic（取决于方法是否解引用）。

**修法**：函数内部用完指针后显式 `return nil`，不要返回类型化的 nil 指针。

**追问：接口比较会怎样？** 类型相同、数据相同才相等。数据是不可比较类型（slice、map、func）时比较会 panic。所以别拿接口当 map key，除非确定可比较。

**追问：`eface` 和 `iface` 是什么？** 空接口用 `eface`（类型指针 + 数据指针），带方法的接口用 `iface`（多一个 itab 指针，itab 里是方法表）。问到能说出来就行，不用背字段名。

## 7. 错误处理：`error`、`panic`、`recover`

### 7.1 `error` 是接口

```go
type error interface { Error() string }
```

**一句话**：错误是普通返回值，不是异常。调用方必须显式检查，编译器不会替你传播。

**要点**：

1. 惯用法是最后一个返回值：`v, err := f()`，紧接着 `if err != nil`。
2. **包装**用 `fmt.Errorf("...: %w", err)`，`%w` 才能让 `errors.Is` / `errors.As` 穿透。
3. `errors.Is(err, target)` 判断链上有没有某个哨兵错误；`errors.As(err, &target)` 取出链上某个具体类型的值。别再用 `==` 直接比。
4. 自定义错误实现 `Unwrap() error` 就能接入这条链。
5. 错误信息不要大写开头、不要带标点，因为它常被拼进更长的消息。

**追问：`%w` 和 `%v` 的区别？** `%v` 只是格式化文本，链断了；`%w` 保留 `Unwrap`，能用 `errors.Is` 查到。

**追问：什么时候用哨兵错误，什么时候自定义类型？** 只判断「是不是这个错」用哨兵（`var ErrNotFound = errors.New(...)`）；要带额外字段（错误码、重试时间）用自定义类型 + `errors.As`。

**面经**：暂无已核对的公开原题。

### 7.2 `panic` 和 `recover`

**一句话**：`panic` 是程序级故障，表示「不该发生的、没法继续的」；`error` 是业务上可预期的失败。

**要点**：

1. `recover` 只能在 `defer` 里、且必须在 panic 的那个 goroutine 里生效。
2. **`recover` 抓不到别的 goroutine 的 panic**——新起的 goroutine panic 会直接带走整个进程。所以每个自己起的 goroutine 都要自带 `defer recover`，尤其是常驻任务。
3. `runtime.Error`（数组越界、nil 解引用）也是 panic，可以被 `recover`，但恢复后状态可能已不一致，一般不这么做。
4. `recover` 之后函数正常返回。如果 `defer` 里改了命名返回值，能改掉返回内容。

```go
func safeGo(fn func()) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                log.Printf("panic: %v\n%s", r, debug.Stack())
            }
        }()
        fn()
    }()
}
```

**追问：哪些 panic 抓不住？** 不是「哪类 panic」的问题，而是「在哪个 goroutine、在哪一层」：别的 goroutine 的、`recover` 不在 defer 里的、以及 fatal error（并发写 map、栈溢出、OOM）都抓不住。

**面经**：腾讯校招一面问过外层协程能不能捕获子协程的 panic、哪些 panic 抓不住。https://juejin.cn/post/7434352545870184485

### 7.3 `defer`

**一句话**：函数返回前按后进先出执行，参数在 `defer` 语句处就求值，函数体在返回时才跑。

```go
func f() (n int) {
    defer func() { n++ }()      // 闭包，看到的是最终的 n
    defer fmt.Println(n)        // 参数此刻求值，打印 0
    return 1                    // n = 1，然后 defer 依次执行
}
// 输出 0，返回值 n = 2
```

**要点**：

1. 参数立即求值：`defer fmt.Println(n)` 打印 defer 那一刻的 `n`。
2. 要改返回值必须用闭包，闭包捕获的是变量本身。
3. 多个 defer 逆序执行，资源获取和释放栈式配对。
4. 1.14 起的开放编码让非循环场景几乎零成本。**在循环体里 `defer` 会累积到函数返回才执行**，这是常见的句柄泄漏来源。

**追问：`defer` 里能改错误吗？** 能，配合命名返回值：

```go
func f() (err error) {
    defer func() { if err != nil { err = fmt.Errorf("wrap: %w", err) } }()
    return do()
}
```

但别滥用，会看不出来。

**面经**：暂无已核对的公开原题。defer 常作为「panic / recover」那条链的最后一问。

## 8. 泛型

**一句话**：Go 1.18 引入类型参数，用接口做约束（type set），编译期做实例化，不是 Java 那种擦除。

**要点**：

1. 约束是一个接口，里面的类型集合就是允许的实参：

```go
type Number interface { ~int | ~int64 | ~float64 }

func Sum[T Number](xs []T) (total T) {
    for _, x := range xs { total += x }
    return
}
```

2. `~` 表示「底层类型是它」的都可以，比如 `type MyInt int` 也能用。
3. 现成约束在 `cmp`、`slices`、`maps` 包里（如 `cmp.Ordered`）。
4. 泛型方法**不支持**：不能给类型加带自己类型参数的方法。

| | Java | Go |
| --- | --- | --- |
| 实现方式 | 擦除，运行时没有类型参数 | 编译期实例化，运行时有具体类型 |
| 约束 | `extends` 上界 | 接口 type set |
| 基本类型 | 必须装箱 | 直接用，不装箱 |
| 泛型方法 | 支持 | 不支持 |
| 协变 | 数组协变（不安全） | 没有协变，`[]T` 和 `[]U` 无关 |

**追问：泛型会不会让编译变慢、二进制变大？** 会。每个实参组合生成一份代码（有形状去重优化，但没有擦除那种彻底共享）。所以「用泛型写库、用接口写业务边界」是常见取舍。

**面经**：暂无已核对的公开原题。

## 9. 一个常被连着问的坑：循环变量

**⚠️ 版本分界**：Go 1.22 之前，`for` 里用 `:=` 声明的变量整个循环只有一个，闭包和 goroutine 共享它，所以经典的「全部打印最后一个值」。**Go 1.22 起每次迭代创建新变量**，这个坑按语言规范已不存在。

```go
for _, v := range items {
    go func() { use(v) }()   // 1.22+ 每轮一个 v，行为正确
}
```

**但要注意**：

1. 新语义只在 `go.mod` 声明 `go 1.22` 或更高的模块生效。老模块仍是旧语义，所以老代码里的 `v := v` 还留着不是没道理。
2. 如果显式在循环**外**声明变量，仍然共享：

```go
var v string
for _, v = range items { go func(){ use(v) }() }   // 还是全打印最后一个
```

**面试怎么答**：先答版本分界，再说「所以现在不需要写 `v := v`，但看老代码要确认 go.mod」。既证明知道历史，也证明知道现状。

**面经**：暂无已核对的公开原题。这类题常作为「goroutine 里打印循环变量」的输出题出现，多放在并发篇。

## 10. 面经汇总索引

| 公司 / 轮次 | 原题 | 对应节 |
| --- | --- | --- |
| 腾讯校招一面 | slice 和数组的区别、底层结构 | 2、3.2 |
| 腾讯校招一面 | map 怎么保证并发安全、并发访问会怎样、异常能否抓住 | 4.2 |
| 腾讯校招一面 | `interface` 怎么理解、能不能比较 | 6.1 |
| 腾讯校招一面 | 外层协程能否捕获子协程 panic、哪些 panic 抓不住 | 7.2 |
| 字节秋招一面 | channel 是否并发安全、和 `Mutex` 的差别 | 并发篇 |
| 字节搜索后端二面 | 对已关闭的 channel 读写 | 并发篇 |
| 牛客 Go 高频统计 | `make` / `new`、slice 扩容、`sync.Map` | 3.1、3.3、4.2 |

来源：牛客 Go 高频 https://www.nowcoder.com/discuss/789864350730162176 ；关键词统计 https://www.nowcoder.com/discuss/752654728466534400 ；腾讯校招一面 https://juejin.cn/post/7434352545870184485 ；字节秋招一面 https://www.nowcoder.com/feed/main/detail/71e75505e34f43689ce98e20f78f3ed8 ；字节搜索后端二面 https://www.nowcoder.com/discuss/668776138512052224

## 11. 这一章没写的东西

- GMP、work stealing、GC 三色标记：运行时篇。
- channel 的收发语义、`select`、`sync` 各锁的细节：并发篇。
- `context`：并发篇（「它是不是并发安全」是那道题的核心）。
- 泛型写容器库、`unsafe`、`reflect`、`cgo`：不是这套岗位的必考项，只在被追问时点到。

## 12. 依据

- Go 1.24 map 改 Swiss Table：https://go.dev/blog/swisstable 、https://go.dev/doc/go1.24
- 运行时 map 实现注释（组、控制字、`h2`、墓碑、按表扩容）：https://go.dev/src/internal/runtime/maps/map.go
- Go 1.22 循环变量新语义：https://go.dev/doc/go1.22 、https://go.dev/wiki/LoopvarExperiment
