# Go 语言

对标 Java SE 与集合。GMP、GC 在运行时篇，channel 和锁在并发篇。这一篇只管「语法和数据结构本身」。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。带 ⚠️ 的地方是网上答案普遍过时或写错的地方。

## 语言概述与编译

### 1.🌟Go 是什么，和 Java 有什么本质区别？

**一句话**：Go 是编译型语言，`go build` 把包和依赖一起静态编成一个可执行文件，直接交给操作系统跑，没有虚拟机。

| | Java | Go |
| --- | --- | --- |
| 产物 | `.class` 字节码 + jar | 单个原生可执行文件 |
| 执行 | JVM 解释 + JIT 编译 | 直接执行机器码 |
| 运行时 | 外部 JVM，参数调优 | 编进二进制，靠 `GOGC`、`GOMAXPROCS` 调 |
| 部署 | 需要装对应 JDK | `scp` 一个文件 |
| 并发模型 | 线程 + 线程池 | goroutine + channel |
| 泛型 | 1.5 起，擦除实现 | 1.18 起，实例化实现 |

**展开**：

1. 没有字节码，没有 JIT，机器码在编译期就定了，所以启动没有预热。
2. 每个二进制里都链了一份**运行时**，负责调度 goroutine、GC、map 的哈希随机化、channel 实现。这就是「有运行时但没有虚拟机」：运行时代码编进你的二进制，不是外部进程。
3. 交叉编译只要设 `GOOS` / `GOARCH`，因为不依赖目标机的 C 运行时。

**追问：为什么 Go 启动快？** 没有类加载、没有 JIT 预热。代价是少了「跑久了越来越快」的优化，所以性能更依赖写好代码而不是等编译器。

**面经**：腾讯 · 校招一面把 Go 的基础和 slice、map、interface、GMP 连着问，通常从「你如何理解 Go」起手。https://juejin.cn/post/7434352545870184485

### 2.`go build`、`go run`、`go install` 有什么区别？

**一句话**：`build` 产出到当前目录，`run` 编到临时目录再执行，`install` 装到 `$GOBIN`。

**展开**：

1. `go build ./...` 编译所有包但不装；不带参数编译当前包到当前目录。
2. `go run main.go` 适合开发，每次都要重新编译，不适合压测。
3. `go install` 把二进制放到 `GOPATH/bin` 或 `GOBIN`，第三方工具用这个。
4. `-ldflags "-s -w"` 去掉符号表和调试信息，能减小体积，但 panic 堆栈会缺信息。

**追问：`go build` 有缓存吗？** 有。编译结果按内容哈希缓存，没改过的包直接复用。缓存目录是 `GOCACHE`。

**面经**：暂无已核对的公开原题。这类工程题通常在「项目怎么部署」里顺带问。

### 3.`init` 函数什么时候执行，能干什么？

**一句话**：包被导入时，先按依赖顺序初始化包级变量，再跑 `init`；同一包里多个 `init` 按文件名字典序、文件内按出现顺序。

**展开**：

1. `init` 不能被调用，不能有参数和返回值。
2. 一个包可以有多个 `init`，按上述顺序跑。
3. 常见用途是注册：`database/sql` 的驱动靠 `import _ "github.com/lib/pq"` 触发 `init` 注册。
4. 导入顺序：被依赖的包先初始化，`main` 最后。

**追问：`init` 有什么坑？** 它让「导入即副作用」，链路不清晰；而且会拖慢启动。所以现代实践更推荐显式调用 `New()` 或 `Register()`。

**面经**：暂无已核对的公开原题。字节后端一面把 `init` 归在「Go 工程实践」里，不是必考项。https://www.nowcoder.com/discuss/648273029868400640

### 4.Go 的包和模块是什么关系？

**一句话**：模块（module）是 `go.mod` 描述的版本化单元，包（package）是目录里的编译单元。

**展开**：

1. 一个模块包含多个包，一个目录只能有一个包。
2. `go.mod` 声明模块路径、Go 版本、依赖。
3. `go.sum` 是依赖内容的校验和，防止篡改。
4. `internal/` 目录下的包只能被同一模块内导入。

**追问：`go mod tidy` 做了什么？** 补上缺失的依赖、删掉没用到的、更新 `go.sum`。提交前应该跑一次。

**面经**：暂无已核对的公开原题。模块管理在社招里常作为「项目怎么管依赖」的追问出现。

## 基础语法与类型

### 5.🌟Go 有哪些基本类型？

**一句话**：布尔、整数（有符号无符号、按位宽分）、浮点、复数、字符串，加上 `byte`（`uint8` 别名）和 `rune`（`int32` 别名）。

**展开**：

1. 整数：`int8/16/32/64`、`uint8/16/32/64`、`int`、`uint`、`uintptr`。`int` 的位宽跟着平台。
2. 浮点：`float32`、`float64`。没有 `float`。
3. 字符串是不可变的字节序列，不是字符序列。
4. 零值：数值 `0`，布尔 `false`，字符串 `""`，指针/接口/map/slice/channel/函数 `nil`。

**追问：`int` 和 `int64` 能直接运算吗？** 不能，Go 没有隐式类型转换。`int` + `int64` 编译报错，必须显式转。

**追问：`byte` 和 `rune` 什么时候用？** `byte` 处理字节（编码、二进制协议），`rune` 处理字符（UTF-8 码点、字符串遍历）。

**面经**：美团 · Go 后端一面：简述 rune 类型。https://segmentfault.com/a/1190000045455181

### 6.🌟Go 只有值传递，怎么理解？

**一句话**：函数传参永远拷贝。指针也是值，只是这个值是个地址。

**展开**：

1. 传指针拷贝地址，所以能改到原对象；传结构体拷贝整个结构体，改了不影响外面。
2. 传 slice 拷贝的是三元组（指针 + len + cap），所以改元素外面看得到，扩容外面看不到。
3. 传 map 拷贝的是指针，因为 map 底层就是一个指针，所以函数里改外面一定看得到。
4. 传 channel 也是拷贝指针。

**追问：为什么说 Go 没有引用传递？** 因为「引用传递」意味着函数内外是同一个变量。Go 里函数参数永远是新的变量，只是这个变量可能装着地址。改地址指向的内容会影响外面，重新赋值参数本身不会。

**面经**：腾讯 · 校招一面：Go 中的参数传递是值传递还是引用传递。https://segmentfault.com/a/1190000045455181

### 7.🌟零值是什么，为什么重要？

**一句话**：每个类型都有零值，声明后直接可用，这是 Go 的设计原则——少写构造函数。

```go
var s string        // ""
var n int           // 0
var p *T            // nil
var m map[K]V       // nil，能读不能写
var sl []T          // nil，能 append
var buf bytes.Buffer // 直接就能用
```

**展开**：

1. 零值可用让 `var x T` 就能开始用，不需要 `NewT()`。
2. 但「可用」不等于「能做所有事」：`nil` map 写会 panic，`nil` channel 读写都永久阻塞。
3. `sync.Mutex`、`bytes.Buffer`、`strings.Builder` 的零值都设计成可直接用。

**追问：`nil` slice 和空 slice 有什么区别？** `len` 都是 0，都能 `append`，`range` 都不迭代。区别在 `== nil` 判断和 JSON 序列化：nil 序列化成 `null`，空 slice 序列化成 `[]`。

**面经**：暂无已核对的公开原题。零值可用在「Go 为什么不需要构造函数」这类设计题里追问。

### 8.常量、`iota` 和枚举怎么写？

```go
type Weekday int

const (
    Sunday Weekday = iota   // 0
    Monday                  // 1
    Tuesday                 // 2
)
```

**一句话**：`const` 是编译期常量，`iota` 在 `const` 块里从 0 开始，每行加 1。

**展开**：

1. 常量只能是基本类型和字符串，不能是 slice、map、struct。
2. 无类型常量有「高精度」，赋值时才确定类型：`const big = 1 << 62`。
3. `iota` 可以用表达式：`1 << iota` 生成 1、2、4、8。
4. 用 `_` 跳过某个值。

**追问：Go 有真正的枚举吗？** 没有。`const` + 自定义类型只是约定，编译器不检查取值范围，`Weekday(99)` 是合法的。要校验得自己写 `Valid()` 方法。

**面经**：暂无已核对的公开原题。枚举在 Go 面经里出现频率低，属于「知道就行」。

### 9.类型转换、类型断言、类型开关有什么区别？

**一句话**：转换是「换一个类型看同一个值」，断言是「从接口里取出具体类型」，类型开关是断言的批量版。

```go
var i interface{} = "hi"

s := i.(string)          // 断言，失败会 panic
s, ok := i.(string)      // 断言，失败 ok=false
n := int64(42)           // 转换
switch v := i.(type) {   // 类型开关
case string: _ = v
case int:    _ = v
}
```

**展开**：

1. 转换要求类型兼容（数值之间、`string` 和 `[]byte` / `[]rune`）。
2. 断言只能用于接口值，且要求接口里装的确实是那个类型。
3. 类型开关的 `v` 在每个 case 里是具体类型，不是原接口。

**追问：为什么断言要用双返回值形式？** 单返回值形式失败会 panic。对外部输入做断言时必须用 `, ok` 形式，避免把可恢复的错误变成崩溃。

**面经**：腾讯 · 校招一面：你如何理解 interface 类型、interface 能不能比较，顺带问类型断言。https://segmentfault.com/a/1190000045455181

### 10.结构体、嵌入和组合怎么用？

```go
type Base struct{ ID int }
func (b Base) Describe() string { return "base" }

type User struct {
    Base              // 嵌入，字段和方法被提升
    Name string
}
```

**一句话**：Go 用嵌入实现「组合优于继承」，被嵌入类型的方法和字段会被提升到外层。

**展开**：

1. 嵌入不是继承：外层不「是」内层，只是「有」内层。
2. 提升的方法接收者仍是内层，不是外层。
3. 外层可以定义同名方法覆盖提升来的方法，这叫「遮蔽」。
4. 嵌入接口也是常见用法：结构体只实现部分方法，其余委托给嵌入的接口。

**追问：嵌入和命名字段有什么区别？** 命名字段要 `u.Base.Describe()`，嵌入后能 `u.Describe()`。嵌入还会让外层满足内层的接口。

**面经**：腾讯 · 校招一面：Go 的结构体可以嵌套组合吗；两个结构体可以等值比较吗。https://segmentfault.com/a/1190000045455181

## slice 与数组

### 11.🌟`make` 和 `new` 有什么区别？

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

**面经**：

- 牛客 Go 高频统计：`make` / `new` 约 6.82%。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯 · 校招一面把 make/new 归在「slice 和数组的底层结构」那一组里问。https://juejin.cn/post/7434352545870184485

### 12.🌟slice 的底层结构是什么？

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

**追问：`s = s[:0]` 会释放内存吗？** 不会，只把 len 置 0，底层数组还在，cap 不变。要释放得 `s = nil` 或让它离开作用域。

**面经**：

- 字节 · 后端一面：slice 的底层实现是什么；slice 是线程安全的吗。https://www.nowcoder.com/discuss/648273029868400640
- 字节 · 质量技术组一面：slice 的底层实现；slice 是线程安全的吗。https://www.nowcoder.com/discuss/647582648621092864
- 牛客 Go 高频：slice 和数组的底层约 4.16%，slice 原理约 3.66%。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯 · 校招一面：slice 和数组的区别，底层结构。https://juejin.cn/post/7434352545870184485

### 13.🌟slice 的扩容机制是怎样的？

**一句话**：容量不够时申请更大的数组，把旧数据拷过去，返回指向新数组的 slice。旧数组如果还有别的 slice 引用，就继续留着。

**展开**：

1. 小 slice 增长快（接近翻倍），大 slice 增长放缓（新版按元素大小分档，约 1.25 倍），目的是控制内存浪费。
2. **扩容后的 cap 不保证等于你以为的数**，实现会对齐到内存分配器的 size class。别背死「一定 2 倍」。
3. `make([]T, 0, n)` 预分配能避免多次拷贝，这是最常见的性能优化。
4. `append` 一次追加多个元素时，可能直接按需扩容，不只是翻倍。

**追问：`copy` 和 `append` 谁快？** 已知长度时 `copy` 直接写内存，`append` 要检查容量。往已有 slice 填数据用 `copy`。

**追问：扩容时旧数组什么时候回收？** 没有任何 slice 引用它的时候。所以「截取一个小 slice 长期持有」会拖住整个大数组，见下一题。

**面经**：

- 字节 · 大厂面经汇总：slice 切片扩容机制，为什么不一直用 2 倍扩容。https://mshiku.com/e/5053/
- 牛客 Go 高频：slice 扩容约 5.82%。https://www.nowcoder.com/discuss/789864350730162176
- 字节 · 后端一面：slice 扩容的新容量计算规则。https://www.nowcoder.com/discuss/648273029868400640

### 14.截取 slice 会造成内存泄漏吗？

```go
func first10(big []byte) []byte {
    return big[:10]   // 仍持有整个 big 的底层数组
}
```

**一句话**：会。小 slice 仍持有整个底层数组，只要它活着，整块内存都回收不掉。

**修法**：

```go
out := make([]byte, 10)
copy(out, big[:10])       // 或 append([]byte(nil), big[:10]...)
return out
```

**展开**：

1. 这个坑在处理大文件、大响应体时最容易踩。
2. 只有「长期持有」才有问题，用完就丢没关系。
3. 同样的问题在 `strings.Split` 之后截取也会出现。

**追问：`strings.Clone` 是干什么的？** Go 1.18 加的，拷贝一份字符串，切断和原大字符串的共享。作用和上面的 `copy` 一样，针对字符串场景。

**面经**：腾讯 · 校招一面：切片使用的时候需要注意什么。https://segmentfault.com/a/1190000045455181

### 15.🌟数组和 slice 有什么区别？

| | 数组 `[3]int` | slice `[]int` |
| --- | --- | --- |
| 长度 | 类型的一部分，编译期定死 | 运行时可变 |
| 赋值 | 整块拷贝 | 拷贝三元组，共用底层数组 |
| 比较 | 可 `==`（长度相同、元素相同） | 只能和 `nil` 比 |
| 传参 | 拷贝整个数组 | 拷贝三元组 |

**追问：为什么很少直接传数组？** 拷贝成本随长度增长，函数签名还被长度绑死。要么传指针 `*[3]int`，要么转 slice。

**面经**：

- 腾讯 · 校招一面：slice 和数组的区别、底层结构。https://juejin.cn/post/7434352545870184485
- 牛客 Go 高频：slice 和数组的区别约 4.16%。https://www.nowcoder.com/discuss/789864350730162176

## map

### 16.🌟Go 1.24 之后，map 底层还是分桶吗？

**一句话**：不是了。**1.24 起内置 map 换成了 Swiss Table 实现**，桶模型已经不是当前实现。

**⚠️ 这是最容易背过时的一题。** 十几年来的标准答案都是「hmap + bmap、每桶 8 个 key、溢出桶链」。

现在的结构（按官方实现注释和官方博客）：

1. map 顶层是若干独立表（table），每张表最多 1024 条。哈希高位用来选进哪张表，这是可扩展哈希。
2. 表内部是开放寻址，存储切成 8 槽一组。每组配一个 64 位控制字，每字节对应一个槽：一位表示空/已删/在用，低 7 位存该键哈希的低 7 位（`h2`）。
3. 查找时用 `h2` 对控制字做一次并行比较，一次筛掉组里 8 槽中的绝大多数，再用完整键确认。这是 Swiss Table 的核心收益。
4. 删除时如果组是满的，要留 tombstone（墓碑），否则探测会提前停。墓碑只在扩容时彻底清掉。
5. 扩容以「表」为单位整张扩，不是全 map 一起搬。

**面试怎么答**：先说「1.24 之前是分桶 + 溢出桶，1.24 起是 Swiss Table，每组 8 槽加控制字」，再讲查找流程。主动说明版本分界，比背旧桶模型安全。

**追问：为什么 map 的遍历顺序是随机的？** 故意的。运行时每次遍历随机选起点，防止业务依赖顺序。要顺序就自己排序键。

**面经**：

- 腾讯 · 校招二面：讲一下 map 的底层结构；map 中 hash 冲突怎么解决。https://segmentfault.com/a/1190000045455181
- 美团 · Go 后端一面：Go 中 map 的数据结构、扩容机制、key 为什么是无序的。https://segmentfault.com/a/1190000045455181
- 腾讯 · 校招一面：map 怎么去做并发安全、底层结构。https://juejin.cn/post/7434352545870184485

### 17.🌟并发读写 map 会怎样？

**一句话**：会触发运行时检查并**直接 fatal**，不是 panic，`recover` 抓不住。

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

**追问：那为什么单 goroutine 里遍历时删除不会崩？** 单 goroutine 的并发语义不触发检查，但遍历时增删是未定义行为，行为依实现而定。规范只保证「遍历时删除当前或已遍历的键是安全的」。

**面经**：

- 腾讯 · 校招一面：map 并发访问会怎么样，这个异常可以捕获吗。https://segmentfault.com/a/1190000045455181
- 字节 · 后端一面：map 是线程安全的吗，如何实现一个线程安全的 map。https://www.nowcoder.com/discuss/648273029868400640
- 字节 · 质量技术组一面：map 是线程安全的吗，如何实现线程安全的 map（读写锁 / 分片锁 / sync.Map）。https://www.nowcoder.com/discuss/647582648621092864

### 18.🌟`sync.Map` 和 `map` + `RWMutex` 怎么选？

**一句话**：读多写少、键集合基本稳定时 `sync.Map` 更划算；写多或者要遍历全部键时，`RWMutex` 加普通 map 更好。

**展开**：

1. `sync.Map` 用「只读副本 + 脏 map」分离读写：读几乎不加锁，写时才动锁并把新键记到 dirty，读不到再去 dirty 补。
2. 代价：写多时脏 map 频繁升级，比 `RWMutex` 还慢；`Range` 也不是一致性快照。
3. 典型场景：缓存、连接池、只增不删的注册表。

**追问：`sync.Map` 为什么没有 `Len()`？** 有，Go 1.15 加的。但它是近似值，并发时不准——因为要同时看只读和脏两份。

**追问：`sync.Map` 的零值可用吗？** 可用，`var m sync.Map` 直接就能用，不需要初始化。这点和普通 map 相反。

**面经**：

- 牛客 Go 高频：`sync.Map` 底层，出现率约 6.49%。https://www.nowcoder.com/discuss/789864350730162176
- 美团 · Go 后端一面：除了加 Mutex 锁以外还有哪些方式安全读写共享变量。https://segmentfault.com/a/1190000045455181

### 19.nil map 和空 map 的区别？

**一句话**：nil map 能读、能 `len`、能 `range`，但写会 panic；空 map 是 `make` 出来的，什么都能做。

```go
var a map[string]int       // nil
b := make(map[string]int)  // 空 map

_ = a["x"]      // 0，安全
_ = len(a)      // 0
a["x"] = 1      // panic: assignment to entry in nil map
b["x"] = 1      // ok
```

**追问：怎么判断 map 是不是空的？** 用 `len(m) == 0`，不要用 `m == nil`——两者都可能为空。

**面经**：暂无已核对的公开原题。这类题通常作为「map 底层」的追问出现。

### 20.map 的 key 有什么要求？

**一句话**：必须可比较（comparable），slice、map、func 不能当 key，包含它们的 struct 也不能。

**展开**：

1. 可比较的类型：布尔、数值、字符串、指针、channel、接口、数组（元素可比较）、struct（字段都可比）。
2. 浮点能当 key，但 `NaN != NaN`，所以 `NaN` 作键永远取不出来。
3. 接口当键要小心：动态类型不可比较时，运行时 panic。

**追问：为什么 slice 不能当 key？** 因为它不可比较（只能和 `nil` 比）。深层比较需要遍历，和 map 的 O(1) 查找语义冲突。要这么用就把 slice 转成字符串（比如用 `fmt.Sprint` 或哈希）。

**面经**：牛客 Go 高频把「map 的 key 为什么必须可比较」列为高频追问。https://www.nowcoder.com/discuss/789864350730162176

## string

### 21.🌟`string` 的底层是什么，为什么不可变？

**一句话**：`string` 是只读的字节序列加一个长度。它不记录字符，只记录字节。

**展开**：

1. 底层是 `{ptr, len}`，指向只读的字节数组。
2. 不可变带来的好处：能被安全共享、当 map key、并发读不用锁。
3. 代价是每次修改都要新建，所以大量拼接要用 `strings.Builder`。

**追问：为什么 `s[0] = 'x'` 编译不过？** 因为 `string` 的底层数组是只读的，语言层面直接禁止。要改先转 `[]byte`，改完再转回来——这一步会拷贝。

**追问：`string` 和 `[]byte` 转换有开销吗？** 有，会拷贝。但编译器对 `m[string(b)]`、`string` 比较、`range` 这类场景做了优化，不产生拷贝。别依赖，要零拷贝用 `unsafe`。

**面经**：暂无已核对的公开原题。string 不可变通常作为「为什么 string 能当 map key」的前提被问。

### 22.🌟`len(s)` 是字符数吗？

**一句话**：不是，是字节数。中文一个字 3 字节，emoji 可能 4 字节。

```go
s := "你好"
len(s)                    // 6
utf8.RuneCountInString(s) // 2
len([]rune(s))            // 2，但会分配切片
```

**展开**：

1. `range s` 按 rune 迭代，`s[i]` 按字节取。
2. `s[i:j]` 是字节下标切片，可能切出非法 UTF-8。
3. `[]rune(s)` 一次性分配，`range` 边遍历边解码不分配。

**追问：怎么安全地截取前 N 个字符？** 用 `[]rune` 或者 `for i := range s` 数 rune 边界。直接 `s[:n]` 可能切坏多字节字符。

**面经**：美团 · Go 后端一面：简述 rune 类型，和 byte 的区别。https://segmentfault.com/a/1190000045455181

### 23.字符串拼接有哪几种方式，怎么选？

| 方式 | 适用 | 复杂度 |
| --- | --- | --- |
| `+` | 少量、编译期可确定 | 每次新建 |
| `fmt.Sprintf` | 带格式化 | 慢，反射 |
| `strings.Builder` | 循环拼接 | O(n)，推荐 |
| `bytes.Buffer` | 拼接二进制 | O(n) |
| `strings.Join` | 已有切片 | O(n) |

```go
var b strings.Builder
b.Grow(1024)          // 预分配，避免多次扩容
for _, s := range items { b.WriteString(s) }
result := b.String()
```

**追问：`Builder` 和 `Buffer` 怎么选？** 只拼字符串用 `Builder`，它更省内存（没有 `Read` 方法，不用留读位置）。要读写二进制用 `Buffer`。

**追问：`Builder` 能复制吗？** 不能，复制后会 panic（有 `copyCheck` 检查）。它是一次性的。

**面经**：暂无已核对的公开原题。字符串拼接在社招里常作为性能优化题。

## 方法与接口

### 24.🌟值接收者和指针接收者怎么选？

**一句话**：要修改接收者、结构体较大、或类型里已混用指针接收者，就用指针接收者。

**展开**：

1. 值接收者拷贝一份，改不到原对象。
2. 指针接收者能改原对象，但要注意 nil 接收者。
3. 方法集规则决定接口实现：值类型的方法集只有值接收者方法，指针类型的方法集包含两者。

```go
type Speaker interface { Speak() }
type Dog struct{}
func (d *Dog) Speak() {}

var s Speaker = &Dog{}   // ok
var s2 Speaker = Dog{}   // 编译错误
```

**追问：为什么值接收者的方法，指针也能调？** 可寻址时编译器自动取地址（`(&d).Speak()`）。但放进接口时不会自动取地址，所以上面第二行报错。

**追问：全部用指针接收者有什么坏处？** 小类型（比如 `type ID int64`）用指针反而多一次间接寻址，也没必要。而且全指针意味着类型不可比较（除非是指针比较），影响当 map key。

**面经**：腾讯 · 校招一面：你如何理解 interface 类型；interface 可以进行等值比较吗。https://segmentfault.com/a/1190000045455181

### 25.🌟接口的底层结构是什么？

**一句话**：接口值是「类型 + 数据」二元组，空接口用 `eface`，带方法的接口用 `iface`（多一个 itab 指针）。

```go
type eface struct {
    _type *_type
    data  unsafe.Pointer
}

type iface struct {
    tab  *itab          // 类型 + 方法表
    data unsafe.Pointer
}
```

**展开**：

1. `itab` 里有接口类型、具体类型、方法地址数组。方法调用通过它跳转。
2. `itab` 有全局缓存，同样的「接口 + 类型」组合只算一次。
3. 空接口不用方法表，所以用 `eface`。

**追问：为什么接口调用比直接调用慢？** 多一次间接跳转，而且通常不能内联。但 Go 有 devirtualization 优化，能确定具体类型时会还原成直接调用。

**面经**：腾讯互娱 · 一面：Go 的接口作用、用处、实现。https://segmentfault.com/a/1190000045455181

### 26.🌟接口的 nil 陷阱是什么？

**一句话**：只有类型和数据都为 nil，接口才等于 nil。装了一个 nil 指针的接口不等于 nil。

```go
type MyErr struct{}
func (e *MyErr) Error() string { return "x" }

func f() error {
    var e *MyErr = nil
    return e            // 返回的 error 里有类型 *MyErr，数据是 nil
}

fmt.Println(f() == nil)  // false
```

**为什么**：`e` 转成 `error` 时，类型信息 `*MyErr` 被填进去了，只是数据指针是 nil。所以 `err != nil` 成立，但调 `err.Error()` 可能 panic。

**修法**：函数内部用完指针后显式 `return nil`，不要返回类型化的 nil 指针。

**追问：接口比较会怎样？** 类型相同、数据相同才相等。数据是不可比较类型（slice、map、func）时比较会 panic。所以别拿接口当 map key，除非确定可比较。

**面经**：

- 腾讯 · 校招一面：interface 可以进行等值比较吗。https://segmentfault.com/a/1190000045455181
- 腾讯互娱 · 一面：Go 的接口作用、用处、实现。https://segmentfault.com/a/1190000045455181

### 27.🌟Go 的接口为什么是隐式的，和 Java 差在哪？

**一句话**：不需要 `implements`，只要方法集满足就自动实现，这叫结构化满足。

| | Java | Go |
| --- | --- | --- |
| 声明 | 显式 `implements` | 隐式，方法集满足即可 |
| 定义位置 | 必须在实现方 | 可以在使用方 |
| 空接口 | `Object` | `any` / `interface{}` |
| 默认方法 | 有 | 没有，用嵌入接口组合 |

**好处**：可以为别人的类型定义接口，不用改它的代码。
**代价**：不知道该实现谁，要靠编译期兜底：

```go
var _ Iface = (*T)(nil)   // 编译期确认 *T 实现了 Iface
```

**追问：`any` 和 `interface{}` 有区别吗？** 没有，`any` 是 Go 1.18 加的别名。但 `any` 更短，新代码推荐用。

**面经**：腾讯 · 校招一面：1.18 版本后 interface 有什么增强。https://segmentfault.com/a/1190000045455181

### 28.接口应该定义在使用方还是实现方？

**一句话**：Go 的惯例是定义在使用方——谁需要这个能力，谁定义接口。

**展开**：

1. 因为接口是隐式的，使用方定义接口不需要改实现方，天然解耦。
2. 常见做法：`io.Reader`、`io.Writer` 都是使用方（标准库的消费方）定义的。
3. 反例：一个包导出接口，实现也在同一个包——这通常是 Java 思维带过来的。

**追问：那库作者不该导出接口吗？** 少数情况该导出：接口本身是返回值类型，或者接口方法很多、用户自己实现成本高。一般「返回具体类型，接受接口」是更好的 API。

**面经**：暂无已核对的公开原题。这是设计品味题，社招会问。

## 错误处理

### 29.🌟`error` 是什么，为什么要显式检查？

**一句话**：`error` 是个接口（只有 `Error() string`），错误是普通返回值，不是异常。调用方必须显式检查。

```go
type error interface { Error() string }
```

**展开**：

1. 惯用法是最后一个返回值：`v, err := f()`，紧接着 `if err != nil`。
2. 错误信息不要大写开头、不要带标点，因为它常被拼进更长的消息。
3. 不要用 `_` 忽略错误，除非你明确知道为什么可以忽略。

**追问：为什么 Go 不用异常？** 设计上认为异常会让控制流不可见，调用方容易漏处理。代价是代码啰嗦，所以社区一直在讨论 `try` 提案，至今没有采纳。

**追问：`errors.New` 和 `fmt.Errorf` 怎么选？** 静态消息用 `errors.New`（更轻），要格式化用 `fmt.Errorf`，要包装链用 `%w`。

**面经**：暂无已核对的公开原题。错误处理在 Go 面经里通常是「panic 和 error 怎么选」的起点。

### 30.🌟错误包装和 `errors.Is` / `errors.As` 怎么用？

```go
var ErrNotFound = errors.New("not found")

func find(id int) error {
    if id <= 0 {
        return fmt.Errorf("find %d: %w", id, ErrNotFound)   // 包装
    }
    return nil
}

err := find(0)
errors.Is(err, ErrNotFound)      // true，穿透包装链
var pe *PathError
errors.As(err, &pe)              // 取出链上某个类型
```

**一句话**：`%w` 保留 `Unwrap`，`errors.Is` 沿链判断「是不是某个哨兵错误」，`errors.As` 沿链取出某个具体类型的值。

**展开**：

1. `%v` 只是格式化文本，链断了；`%w` 才保留链。
2. 一个 `fmt.Errorf` 里可以有多个 `%w`（Go 1.20 起），`Is` / `As` 会遍历所有分支。
3. 自定义错误实现 `Unwrap() error` 就能接入链。

**追问：为什么不能用 `==` 比较错误？** 因为包装后的错误是个新对象，`==` 比的是地址。只有没包装的哨兵错误才能 `==`，但包装是更好的实践，所以统一用 `Is`。

**追问：什么时候用哨兵错误，什么时候自定义类型？** 只判断「是不是这个错」用哨兵；要带额外字段（错误码、重试时间）用自定义类型加 `errors.As`。

**面经**：暂无已核对的公开原题。`%w` 和 `errors.Is/As` 在 Go 1.13 之后才成为标准答法。

### 31.🌟`panic` 和 `error` 什么时候分别用？

**一句话**：`panic` 是程序级故障，表示「不该发生的、没法继续的」；`error` 是业务上可预期的失败。

**展开**：

1. 不该 panic 的：文件不存在、网络超时、参数校验失败——这些都是可预期的。
2. 该 panic 的：程序逻辑错误（数组越界、nil 解引用由运行时抛）、初始化时配置缺失导致无法启动。
3. 库代码尽量不 panic，把选择权交给调用方。

**追问：`panic` 能跨 goroutine 传播吗？** 不能。panic 只终止当前 goroutine，如果没被 recover，整个进程退出。

**面经**：腾讯 · 校招一面：panic 都会被捕获吗，哪些 panic 不会捕获。https://segmentfault.com/a/1190000045455181

### 32.🌟`recover` 怎么用，有哪些抓不住的？

**一句话**：`recover` 只能在 `defer` 里、且必须在 panic 的那个 goroutine 里生效。

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

**抓不住的**（不是「哪类 panic」的问题，而是「在哪个 goroutine、在哪一层」）：

1. 别的 goroutine 的 panic。
2. `recover` 不在 `defer` 里的。
3. fatal error：并发写 map、栈溢出、OOM。

**追问：`recover` 之后函数怎么返回？** 正常返回。如果 `defer` 里改了命名返回值，能改掉返回内容。

**追问：为什么要给每个 goroutine 加 recover？** 因为子 goroutine panic 会带走整个进程。常驻任务、后台 worker 尤其要加。

**面经**：

- 腾讯 · 校招一面：外层的协程能捕获子协程的 panic 吗；panic 都会被捕获吗，哪些 panic 不会捕获。https://segmentfault.com/a/1190000045455181
- 字节 · 后端一面：在匿名函数内 panic，匿名函数外的 defer 是否会触发 recover；反之呢。https://www.nowcoder.com/discuss/648273029868400640

### 33.🌟`defer` 的执行时机和参数求值？

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
4. 1.14 起的开放编码让非循环场景几乎零成本。

**追问：`defer` 在循环里有什么坑？** 会累积到函数返回才执行。循环里打开文件用 `defer f.Close()`，可能一次开几千个句柄。要在循环内用，就包一层函数或者显式 `Close`。

**追问：`defer` 里能改错误吗？** 能，配合命名返回值：

```go
func f() (err error) {
    defer func() { if err != nil { err = fmt.Errorf("wrap: %w", err) } }()
    return do()
}
```

但别滥用，会看不出来。

**面经**：

- 字节 · 后端一面：defer 的作用和底层原理；多个 defer 的执行顺序。https://www.nowcoder.com/discuss/648273029868400640
- 腾讯 · 校招二面：讲一下 defer 的原理；优雅启停怎么配合 defer。https://segmentfault.com/a/1190000045455181
- 腾讯互娱 · 一面：Go defer 执行顺序。https://segmentfault.com/a/1190000045455181

## 泛型

### 34.🌟Go 泛型怎么用，和 Java 差在哪？

**一句话**：Go 1.18 引入类型参数，用接口做约束（type set），编译期做实例化，不是 Java 那种擦除。

```go
type Number interface { ~int | ~int64 | ~float64 }

func Sum[T Number](xs []T) (total T) {
    for _, x := range xs { total += x }
    return
}
```

| | Java | Go |
| --- | --- | --- |
| 实现方式 | 擦除，运行时没有类型参数 | 编译期实例化，运行时有具体类型 |
| 约束 | `extends` 上界 | 接口 type set |
| 基本类型 | 必须装箱 | 直接用，不装箱 |
| 泛型方法 | 支持 | 不支持 |
| 协变 | 数组协变（不安全） | 没有协变，`[]T` 和 `[]U` 无关 |

**追问：`~` 是什么意思？** 「底层类型是它」的都可以，比如 `type MyInt int` 也能用 `Number` 约束。

**追问：泛型会让编译变慢、二进制变大吗？** 会。每个实参组合生成一份代码（有形状去重优化，但没有擦除那种彻底共享）。所以「用泛型写库、用接口写业务边界」是常见取舍。

**追问：为什么 Go 不支持泛型方法？** 因为方法上的类型参数会让接口实现和方法集推导复杂化，至今没有好设计。要类似效果就把类型参数放在接收者类型上。

**面经**：暂无已核对的公开原题。泛型在 Go 后端面经里出现频率低于 Java，多数公司只问「有没有用过、解决了什么问题」。

### 35.泛型约束里能用方法吗？

```go
type Stringer interface {
    String() string
}

func Join[T Stringer](xs []T) string { ... }
```

**一句话**：能。约束接口里除了类型集合，还可以写方法，要求实参类型必须有这些方法。

**展开**：

1. 方法约束和类型集合不能混用在同一个接口里（除了 `comparable` 这类特殊情况）。
2. `comparable` 是预声明约束，允许 `==` 和 `!=`。
3. 常见组合：`interface { ~int | ~string }` 表示底层是 int 或 string。

**追问：约束里能用 `any` 吗？** 能，`[T any]` 等于不约束。但这样 `T` 上什么方法都调不了。

**面经**：暂无已核对的公开原题。泛型约束在社招里作为「你写过泛型吗」的追问。

## 并发基础语法

并发模型的细节在并发篇，这里只讲语法本身。

### 36.`go` 关键字启动的 goroutine 什么时候跑？

**一句话**：由调度器决定，启动语句执行后不保证立刻跑，也不保证按启动顺序跑。

**展开**：

1. `go f()` 只是把任务放进队列，当前 goroutine 继续执行。
2. 主 goroutine 退出时，其他 goroutine 直接被终止，不会等待。
3. 所以要么用 `sync.WaitGroup` 等，要么用 channel 收结果。

**面经**：腾讯 · 校招一面：go 哪些内置类型是并发安全的；goroutine 怎么同步。https://segmentfault.com/a/1190000045455181

**追问：怎么等所有 goroutine 结束？**

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

注意 `wg.Add` 要在 `go` 之前，而且要传 `i` 的值——虽然 Go 1.22 起循环变量每轮新建，但显式传参更清楚。

**面经**：暂无已核对的公开原题。

### 37.⚠️循环变量在 goroutine 里会有什么问题？

**一句话**：Go 1.22 之前，`for` 里用 `:=` 声明的变量整个循环只有一个，闭包和 goroutine 共享它，所以经典的「全部打印最后一个值」。**Go 1.22 起每次迭代创建新变量**，这个坑按语言规范已经不存在了。

```go
for _, v := range items {
    go func() { use(v) }()   // 1.22+ 每轮一个 v，行为正确
}
```

**但要注意**：

1. 新语义只在 `go.mod` 里声明 `go 1.22` 或更高的模块生效。老模块仍是旧语义，所以老代码里的 `v := v` 还留着不是没道理。
2. 如果显式在循环**外**声明变量，仍然共享：

```go
var v string
for _, v = range items { go func(){ use(v) }() }   // 还是全打印最后一个
```

**面试怎么答**：先答版本分界，再说「所以现在不需要写 `v := v`，但看老代码要确认 go.mod」。既证明知道历史，也证明知道现状。

**面经**：暂无已核对的公开原题。这类题常作为「goroutine 里打印循环变量」的输出题出现，多放在并发篇。字节后端一面出现过类似的输出题（JSON 反序列化精度丢失）。https://segmentfault.com/a/1190000045455181

## 其他常用语法

### 38.`switch` 有什么特别之处？

**一句话**：默认不贯穿（不需要 `break`），可以带初始化语句，`fallthrough` 强制贯穿，`switch` 后可省略表达式当 `if-else` 链。

```go
switch x := f(); {
case x < 0:  // 无表达式的 switch
case x == 0:
default:
}
```

**展开**：

1. 每个 case 支持多个值：`case 1, 2, 3:`。
2. 类型开关 `switch v := i.(type)` 是特例，`v` 在每个分支是具体类型。
3. `fallthrough` 只能用在 case 的最后一行，且不能用在类型开关里。

**追问：为什么 Go 反着来，默认不贯穿？** 因为贯穿是 bug 的来源（忘记 `break`）。Go 把默认行为改成更安全的，要贯穿得显式写。

**面经**：暂无已核对的公开原题。语法题在 Go 面经里占比很低，多数从「写个例子」开始。

### 39.`goto` 和标签能不能用？

**一句话**：能，但只该用于跳出多层循环这种场景，别用来做流程控制。

```go
outer:
for i := 0; i < 10; i++ {
    for j := 0; j < 10; j++ {
        if cond() { break outer }
    }
}
```

**展开**：

1. `break` 和 `continue` 都能带标签。
2. `goto` 不能跳过变量声明。
3. 标签只在同一个函数内有效。

**追问：为什么 Go 保留 `goto`？** 主要是机械生成的代码需要。手写代码里几乎用不到。

**面经**：暂无已核对的公开原题。这类语法题面试基本不问。

### 40.`unsafe.Pointer` 什么时候用？

**一句话**：只在极致性能或和 C 交互时用，日常业务代码不该出现。

**展开**：

1. `unsafe.Pointer` 能在任意指针类型之间转换。
2. `uintptr` 是整数，可以被 GC 忽略，`unsafe.Pointer` 不行。
3. 典型用途：零拷贝 `string` ↔ `[]byte`、读取结构体字段偏移。

```go
// string 转 []byte 零拷贝（危险，不能改）
func toBytes(s string) []byte {
    return *(*[]byte)(unsafe.Pointer(&s))
}
```

**追问：这样转有什么风险？** 得到的 `[]byte` 指向只读内存，改它会导致段错误或未定义行为。而且依赖 `string` 和 slice 的内存布局，Go 版本升级可能变。

**面经**：暂无已核对的公开原题。`unsafe` 在业务岗很少问，基础设施岗会深挖。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 腾讯 · 校招一面 | 值传递还是引用传递；slice 和数组的区别、底层结构 | 6、12、15 |
| 腾讯 · 校招一面 | map 怎么并发安全、并发访问会怎样、异常能否抓住 | 16、17 |
| 腾讯 · 校招一面 | `interface` 怎么理解、能不能比较、1.18 有什么增强 | 24、26、27 |
| 腾讯 · 校招一面 | 外层协程能否捕获子协程 panic、哪些 panic 抓不住 | 31、32 |
| 腾讯 · 校招一面 | 结构体能否嵌套组合、两个结构体能否等值比较 | 10 |
| 字节 · 后端一面 | slice 底层、slice 是否线程安全、map 线程安全、defer 原理、匿名函数内外 panic | 12、17、32、33 |
| 字节 · 质量技术组一面 | slice 底层、slice 是否线程安全、map 线程安全 | 12、17 |
| 字节 · 大厂汇总 | slice 扩容机制、为什么不一直用 2 倍 | 13 |
| 美团 · Go 后端一面 | map 数据结构、扩容、key 无序；rune 类型 | 5、16、22 |
| 腾讯 · 校招二面 | map 底层结构、hash 冲突解决、defer 原理 | 16、33 |
| 字节 · 秋招一面 | channel 是否并发安全、和 `Mutex` 的差别 | 并发篇 |
| 字节 · 搜索后端二面 | 对已关闭的 channel 读写 | 并发篇 |
| 牛客 · Go 高频统计 | `make` / `new`、slice 扩容、`sync.Map` | 11、13、18 |

来源汇总：

- 牛客 Go 高频 https://www.nowcoder.com/discuss/789864350730162176
- 关键词统计 https://www.nowcoder.com/discuss/752654728466534400
- 腾讯校招一面 https://juejin.cn/post/7434352545870184485
- 腾讯校招多轮汇总 https://segmentfault.com/a/1190000045455181
- 字节后端一面 https://www.nowcoder.com/discuss/648273029868400640
- 字节质量技术组一面 https://www.nowcoder.com/discuss/647582648621092864
- 字节大厂汇总 https://mshiku.com/e/5053/
- 字节秋招一面 https://www.nowcoder.com/feed/main/detail/71e75505e34f43689ce98e20f78f3ed8
- 字节搜索后端二面 https://www.nowcoder.com/discuss/668776138512052224

## 这一篇没写的东西

- **GMP、work stealing、GC 三色标记**：运行时篇。
- **channel 的收发语义、`select`、`sync` 各锁的细节、`context`**：并发篇。
- **泛型写容器库、`reflect`、`cgo`**：不是这套岗位的必考项，只在被追问时点到。
- **模块版本管理（`go.mod` 语义化版本、`replace`、`vendor`）**：工程实践，面试很少深问。
- **标准库源码**（`net/http`、`encoding/json` 的实现）：属于框架层，在 gRPC 篇末尾点到。

## 依据

- Go 1.24 map 改 Swiss Table：https://go.dev/blog/swisstable 、https://go.dev/doc/go1.24
- 运行时 map 实现注释（组、控制字、`h2`、墓碑、按表扩容）：https://go.dev/src/internal/runtime/maps/map.go
- Go 1.22 循环变量新语义：https://go.dev/doc/go1.22 、https://go.dev/wiki/LoopvarExperiment
