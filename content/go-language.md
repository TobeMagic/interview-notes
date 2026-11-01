# Go 语言

对标 Java SE 与集合里属于语言本身的部分。GMP、GC 在运行时篇，channel 和锁在并发篇。

每一节按同一顺序讲：先说这问题是哪来的，再说机制怎么转，最后落到细节和坑。

## 语言与编译

### 1.🌟Go 是一门什么样的语言

**一句话**：Go 是静态编译型语言，编译产物是单个可以直接执行的原生二进制，不依赖虚拟机。

**背景**：

Go 2009 年由 Google 发布，动机很具体：当时的服务端主流是 C++ 和 Java，两者都让「编译—部署」这件事变重了。C++ 编译慢、依赖管理混乱；Java 要装 JVM、启动要预热、内存占用大。

Google 内部大量服务是「高并发、I/O 密集、逻辑不复杂」的类型。这类服务需要的不是极致单核性能，而是：编译快、部署简单、并发好写、运行时稳定。

Go 的设计取舍全都指向这四点：

1. 编译快 → 语法简单，没有模板元编程，依赖必须显式声明。
2. 部署简单 → 静态链接成单个文件，`scp` 上去就能跑。
3. 并发好写 → goroutine + channel 进语言层，不用引第三方库。
4. 运行时稳定 → 自带的 GC 停顿控制在毫秒级以下，不追求极致吞吐。

**原理**：

一次 `go build` 发生的事：

```
.go 源码
  ├─ 解析 → AST
  ├─ 类型检查（每个包独立）
  ├─ 编译 → 目标文件（.o）
  └─ 链接 → 单个可执行文件（内含运行时）
```

关键点是最后一步：**运行时代码被打进了你的二进制**。所以「Go 有运行时」和「Go 有虚拟机」是两件事——运行时是编进去的库，不是外部进程。

这个运行时负责：goroutine 调度、GC、map 的哈希随机化、channel 实现、栈增长。你在 `pstack` 或崩溃堆栈里看到的 `runtime.gopark`、`runtime.mallocgc` 都是它。

**细节**：

**和 Java 的对照**：

| | Java | Go |
| --- | --- | --- |
| 产物 | `.class` 字节码 + jar | 单个原生二进制 |
| 执行 | JVM 解释 + JIT 预热 | 直接执行机器码 |
| 运行时 | 外部 JVM，可调参数多 | 编进二进制，靠 `GOGC` 调 |
| 部署 | 需要匹配的 JDK | `scp` 一个文件 |
| 并发 | 线程 + 线程池 | goroutine + channel |
| 泛型 | 1.5 起，擦除 | 1.18 起，实例化 |
| 启动 | 秒级（含类加载） | 毫秒级 |

**启动为什么快**：没有类加载、没有 JIT 编译预热。代价是长跑服务少了「越跑越快」的 JIT 优化，所以 Go 的性能更依赖代码本身写得对不对。

**交叉编译**：`GOOS=linux GOARCH=amd64 go build` 就能在 Mac 上产出 Linux 二进制，因为不依赖目标机的 C 库。这也是容器镜像能做得很小的原因（可以 `FROM scratch`）。

**面经**：腾讯 · 校招一面把 Go 的基础和 slice、map、interface、GMP 连着问，通常从「你如何理解 Go」起手。https://juejin.cn/post/7434352545870184485

### 2.包的初始化和 `init`

**一句话**：导入一个包时，先按依赖顺序初始化包级变量，再执行 `init`；同包多个 `init` 按文件名字典序、文件内按出现顺序。

**背景**：

Go 没有构造函数，也没有「应用启动钩子」这种机制。包的初始化是隐式发生的：只要你 `import` 了它，它就会自己跑起来。

这个设计让「注册」变得很方便（驱动、编解码器、监控指标），但也让启动链路变得不透明——你很难一眼看出程序启动时到底执行了什么。

**原理**：

初始化的完整顺序：

```
main 包
  └─ import 的包（递归，先初始化被依赖的）
       └─ 包级变量（按依赖顺序，被引用的先算）
            └─ init()
  └─ 自己的包级变量
  └─ 自己的 init()
  └─ main()
```

一个包里可以写多个 `init`，也可以一个文件里写多个。它们按「文件名字典序 → 文件内出现顺序」执行。

```go
// a.go
func init() { println("a") }

// b.go
func init() { println("b1") }
func init() { println("b2") }
// 输出：a, b1, b2
```

**细节**：

**`init` 的典型用途是注册**。`database/sql` 就是靠这个：

```go
import _ "github.com/lib/pq"   // 下划线导入：只要副作用，不用它的导出

// lib/pq 的 init 里：
func init() {
    sql.Register("postgres", &Driver{})
}
```

这就是为什么你只 import 不调用，`sql.Open("postgres", ...)` 就能用。

**`init` 的问题**：

1. **隐式副作用**：不知道哪个 import 触发了什么，启动链路难追。
2. **拖慢启动**：所有被导入的包都会初始化，哪怕这个请求路径根本用不到。
3. **测试不友好**：测试一个包就会跑它的 `init`，可能有外部依赖（连数据库、读文件）。
4. **无法返回错误**：`init` 不能返回值，失败了只能 panic 或者 `log.Fatal`。

**现代实践**：显式调用 `New()` 或 `Register()` 代替 `init`，把「什么时候初始化」交给调用方。标准库和成熟框架里 `init` 还很多，但新代码尽量少用。

**面经**：字节 · 后端一面把 `init` 归在「Go 工程实践」里，不是必考项。https://www.nowcoder.com/discuss/648273029868400640

### 3.包和模块

**一句话**：模块是 `go.mod` 描述的版本化单元，包是目录里的编译单元。

**背景**：

Go 在 1.11 之前没有模块，所有代码必须放在 `GOPATH` 下，依赖靠 `go get` 拉最新版——没有版本锁，线上和本地跑的不是同一份代码是常事。

1.11 引入 module，1.16 默认开启，这个问题才算解决。理解模块模型，才能看懂 `go.mod`、`go.sum`、`replace` 这些配置。

**原理**：

**三层结构**：

1. **仓库**：一个 git repo，比如 `github.com/user/project`。
2. **模块**：一个 `go.mod` 声明的单元，路径就是模块名。
3. **包**：一个目录，目录里所有 `.go` 文件属于同一个包（`package xxx`）。

一个模块包含多个包，一个目录只能有一个包。

**`go.mod` 的四个部分**：

```go
module github.com/user/project   // 模块路径

go 1.24                          // 语言版本（影响语法和循环变量语义）

require (
    github.com/gin-gonic/gin v1.10.0
)

replace github.com/x/y => ../local   // 本地替换，调试用
```

**`go.sum`**：记录每个依赖的内容哈希，防止被篡改或版本被覆盖。必须提交到仓库。

**细节**：

**`internal/` 的作用**：这个目录下的包只能被同模块内的代码导入。这是 Go 唯一的可见性控制手段（语言层面没有 `private package`）。

```
project/
  internal/
    db/        // 只能被 project 内的包导入
  pkg/
    api/       // 可以被外部导入
```

**`go mod tidy` 做什么**：补上代码里用到但 `go.mod` 没声明的依赖，删掉 `go.mod` 里有但代码没用的，同时更新 `go.sum`。提交前应该跑一次。

**版本选择规则**：Go 用「最小版本选择」（MVS）：每个依赖只保留满足所有要求的最低版本。这和 npm 的「尽量用最新」相反，好处是构建可复现。

**常见坑**：

- 依赖了大版本（`v2` 以上）的模块，路径必须带 `/v2` 后缀，否则会当成两个不同的模块。
- `replace` 只在当前模块生效，不会传递给依赖你的模块。
- 私有仓库要配 `GOPRIVATE`，否则会走公共 proxy 导致拉取失败。

**面经**：暂无已核对的公开原题。模块管理在社招里常作为「项目怎么管依赖」的追问。

## 基础类型

### 4.🌟Go 有哪些基本类型

**一句话**：布尔、整数（按位宽分有符号无符号）、浮点、复数、字符串，加上 `byte` 和 `rune` 两个别名。

**背景**：

Go 的类型系统比 Java 简单很多：没有包装类、没有自动装箱、没有隐式转换。所有类型转换都必须显式写出来。

这个设计增加了啰嗦程度，但消灭了一整类 bug：你永远不需要猜「这里会不会自动转」。

**原理**：

```go
// 布尔
bool                              // true / false

// 有符号整数
int8 int16 int32 int64
int                               // 平台相关：32 位平台上 32 位，64 位平台上 64 位

// 无符号整数
uint8 uint16 uint32 uint64 uint uintptr

// 浮点
float32 float64                   // 注意：没有 float

// 复数
complex64 complex128

// 字符串
string

// 别名
byte  = uint8                     // 处理字节
rune  = int32                     // 处理 Unicode 码点
```

**零值**：

| 类型 | 零值 |
| --- | --- |
| 数值 | `0` |
| 布尔 | `false` |
| 字符串 | `""` |
| 指针 / 接口 / map / slice / channel / func | `nil` |

**细节**：

**没有隐式转换**：`int` 和 `int64` 不能直接运算。

```go
var a int = 1
var b int64 = 2
c := a + b        // 编译错误
c := int64(a) + b // 必须显式转
```

这看起来麻烦，但它避免了 C 语言里一整类溢出和截断问题。

**`byte` 和 `rune` 的区别**：

```go
s := "你好"
len(s)                    // 6，字节数
utf8.RuneCountInString(s) // 2，字符数

s[0]                      // 0xE4，第一个字节
for i, r := range s {     // i 是字节偏移，r 是 rune
}
```

`byte` 用于编码、协议、二进制处理；`rune` 用于字符计数、遍历、大小写转换。

**`int` 的陷阱**：它的位宽跟着平台走。写序列化、跨平台协议时一定要用固定位宽的类型（`int32`、`int64`），否则 32 位和 64 位机器上行为不同。

**`uintptr` 是什么**：一个足够装下指针的无符号整数。它是普通数值，GC 不会追踪它指向的对象，所以只能在 `unsafe` 场景下短暂使用。

**面经**：美团 · Go 后端一面：简述 rune 类型。https://segmentfault.com/a/1190000045455181

### 5.🌟Go 只有值传递，怎么理解

**一句话**：函数传参永远拷贝；指针也是值，只是这个值是个地址。

**背景**：

「Go 是值传递还是引用传递」是面试常见争议题。答案很明确：**Go 只有值传递**，没有引用传递。

但这个答案容易引起困惑，因为传 slice、map、channel 时，函数里改内容外面确实看得到。理解这个的关键是分清「拷贝的是什么」。

**原理**：

**值传递**的定义：函数收到的是实参的一份拷贝，函数内重新赋值参数本身不影响外面。

**引用传递**的定义：函数收到的是实参变量本身的别名，函数内重新赋值会影响外面。

Go 只有第一种。但不同的类型「拷贝的东西」不一样：

| 类型 | 拷贝的是什么 | 改内容外面看得到吗 |
| --- | --- | --- |
| `int` / `string` | 值本身 | 否 |
| `struct` | 整个结构体 | 否 |
| `*T` | 地址 | 是（解引用后改） |
| `slice` | `{ptr, len, cap}` 三元组 | 改元素是；`append` 扩容否 |
| `map` | 一个指针（指向 hmap） | 是 |
| `channel` | 一个指针（指向 hchan） | 是 |
| `interface` | `{type, data}` 二元组 | 看 data 指向什么 |

关键在于：**slice、map、channel 的「值」本身就内含指针**。拷贝的是这个指针，不是底层数据。

```go
func modify(s []int) {
    s[0] = 100        // 改了底层数组，外面看得到
}

func appendOne(s []int) {
    s = append(s, 1)  // 只改了函数内的 slice 头，外面看不到
}

func modifyMap(m map[string]int) {
    m["a"] = 1        // 改了 hmap，外面看得到
}
```

**细节**：

**为什么说「没有引用传递」很重要**：因为函数内重新赋值参数永远不影响外面。

```go
func setNil(m map[string]int) {
    m = nil           // 外面那个 map 还是原样
}
```

如果是引用传递，这里会把外面的 map 也变成 nil。Go 不会。

**结构体什么时候该传指针**：三个条件满足任一就该用指针——要修改、结构体较大（拷贝成本高）、或者类型里已经混用了指针接收者（保持一致，否则方法集对不上，接口实现会出问题）。

**slice 的坑**：因为拷贝的是三元组，函数内 `append` 如果不扩容，会写到共享的底层数组里，但长度不变——外面看不到新元素，可底层数组已经被改了。这是最隐蔽的一类 bug。

**面经**：腾讯 · 校招一面：Go 中的参数传递是值传递还是引用传递。https://segmentfault.com/a/1190000045455181

### 6.🌟零值是什么，为什么它很重要

**一句话**：每个类型都有零值，声明后直接可用——这是 Go 刻意设计的原则，目的是少写构造函数。

**背景**：

Java 里 `new` 一个对象前，字段可能是 `null`，用之前必须初始化。Go 反过来：`var x T` 就能直接用，因为 `T` 的每个字段都已经是零值。

这个设计叫「零值可用」（zero value is useful），它影响了很多标准库的设计。

**原理**：

```go
var s string          // ""
var n int             // 0
var b bool            // false
var p *T              // nil
var m map[K]V         // nil，能读不能写
var sl []T            // nil，能 append
var f func()          // nil，调用会 panic
```

零值可用的标准库例子：

```go
var buf bytes.Buffer       // 直接能 Write
var mu sync.Mutex          // 直接能 Lock
var sb strings.Builder     // 直接能 WriteString
var wg sync.WaitGroup      // 直接能 Add
```

对比 Java：`new StringBuilder()` 必须显式创建，`new HashMap<>()` 必须显式创建。

**细节**：

**零值可用 ≠ 零值什么都能做**：

| 类型 | nil 状态下的行为 |
| --- | --- |
| `slice` | `len` 为 0，可以 `append`，可以 `range` |
| `map` | `len` 为 0，可以读（返回零值），**写会 panic** |
| `channel` | 读写都永久阻塞 |
| `func` | 调用 panic |
| `interface` | 等于 nil，调用方法 panic |

所以 map 必须 `make` 或字面量初始化才能写，这是新手最常见的 panic。

**nil slice 和空 slice 的区别**：

```go
var a []int          // nil
b := []int{}         // 空 slice，非 nil
c := make([]int, 0)  // 空 slice，非 nil

len(a) == len(b) == len(c)   // 都是 0
a == nil                     // true
b == nil                     // false
```

真正的区别在 JSON 序列化：`nil` 序列化成 `null`，空 slice 序列化成 `[]`。接口返回数组时这个差异会让前端炸。

**接口的零值是 nil，但「装了 nil 的接口」不是 nil**——这是另一个坑，见接口那节。

**面经**：暂无已核对的公开原题。零值可用在「Go 为什么不需要构造函数」这类设计题里追问。

### 7.常量与 `iota`

**一句话**：`const` 是编译期常量，`iota` 在 `const` 块里从 0 开始、每行加 1。

**背景**：

Go 没有 `enum` 关键字。要表达「一组有限的取值」，标准做法是 `const` 块加自定义类型。

`iota` 是这套做法的核心：它让「从 0 开始递增」不用手写数字。

**原理**：

```go
type Weekday int

const (
    Sunday Weekday = iota   // 0
    Monday                  // 1（省略类型和值，复用上一行的表达式）
    Tuesday                 // 2
)
```

`iota` 在每个 `const` 块内从 0 开始，每遇到一行常量声明就加 1。

**常用模式**：

```go
// 位标志
type Flag uint
const (
    FlagA Flag = 1 << iota   // 1
    FlagB                    // 2
    FlagC                    // 4
)

// 跳过一个值
const (
    _  = iota   // 跳过 0
    KB = 1 << (10 * iota)   // 1024
    MB                        // 1048576
)
```

**细节**：

**常量不能是 slice、map、struct**：只能是基本类型和字符串。因为常量要能在编译期确定值。

**无类型常量是高精度的**：

```go
const big = 1 << 62      // 编译器内部用任意精度表示
var x int64 = big        // 赋值时才确定类型，这里刚好放得下
var y int32 = big        // 编译错误：溢出
```

**Go 没有真正的枚举**：`Weekday(99)` 是合法的，编译器不检查取值范围。要校验得自己写方法：

```go
func (d Weekday) Valid() bool {
    return d >= Sunday && d <= Tuesday
}
```

**字符串枚举的替代方案**：用 `const` 加字符串，或者用 `go:generate` 配合 `stringer` 生成 `String()` 方法。

**面经**：暂无已核对的公开原题。枚举在 Go 面经里出现频率低。

### 8.类型转换、断言、类型开关

**一句话**：转换是「换个类型看同一个值」，断言是「从接口里取出具体类型」，类型开关是断言的批量版。

**背景**：

Go 有两套「改变类型」的机制，用途完全不同，但名字很像，经常被混。

- **类型转换**：`T(v)`，用于数值之间、字符串和字节切片之间。
- **类型断言**：`v.(T)`，只用于接口值，把接口里装的具体值取出来。

**原理**：

```go
// 转换：要求类型兼容
var i int = 42
var f float64 = float64(i)
var b []byte = []byte("hi")

// 断言：接口 → 具体类型
var x any = "hello"
s := x.(string)          // 单返回值，失败 panic
s, ok := x.(string)      // 双返回值，失败 ok=false

// 类型开关：多分支断言
switch v := x.(type) {
case string:
    fmt.Println("string", v)   // v 是 string
case int:
    fmt.Println("int", v)      // v 是 int
default:
    fmt.Println("other", v)    // v 是 any
}
```

**细节**：

**断言必须用双返回值形式处理外部输入**。单返回值形式在类型不匹配时 panic：

```go
func handle(v any) {
    s, ok := v.(string)
    if !ok {
        return   // 优雅降级
    }
    use(s)
}
```

**类型开关里 `v` 的类型**：每个 case 里 `v` 是对应的具体类型，不是原接口类型。这是编译器自动收窄的。

**断言和反射的关系**：类型断言只处理「接口里装的类型」这一层；要看结构体字段、动态调用方法，得用 `reflect`。

**什么情况下断言会失败**：接口里装的实际类型和断言的类型不一致。注意「装的类型是指针还是值」也算不一致：

```go
type T struct{}
var x any = &T{}
_, ok := x.(T)    // false，装的是 *T 不是 T
_, ok = x.(*T)    // true
```

**面经**：腾讯 · 校招一面：你如何理解 interface 类型、interface 能不能比较，顺带问类型断言。https://segmentfault.com/a/1190000045455181

### 9.结构体、嵌入与组合

**一句话**：Go 用嵌入实现「组合优于继承」，被嵌入类型的方法和字段会被提升到外层。

**背景**：

Go 没有继承。官方的立场是「组合优于继承」，用嵌入（embedding）来复用代码。

这个设计避免了继承链带来的紧耦合，但也让「多态」得靠接口而不是父类。理解嵌入的机制，才能看懂标准库和框架里大量的写法。

**原理**：

```go
type Base struct {
    ID int
}

func (b Base) Describe() string {
    return fmt.Sprintf("id=%d", b.ID)
}

type User struct {
    Base                  // 嵌入：没有字段名
    Name string
}

u := User{Base: Base{ID: 1}, Name: "a"}
u.Describe()              // 方法被提升，等价于 u.Base.Describe()
u.ID                      // 字段被提升
```

**为什么这不等于继承**：

1. `User` 不「是」`Base`，只是「有」`Base`。类型上它们是独立的。
2. 提升的方法接收者仍然是 `Base`，不是 `User`。所以方法里访问不到 `User.Name`。
3. `User` 可以定义同名方法覆盖提升来的方法（遮蔽），但 `Base` 的方法里调自己仍然是 `Base` 的。

**细节**：

**嵌入接口**：结构体可以嵌入接口，只实现部分方法，其余委托给嵌入的接口。

```go
type ReadWriter struct {
    io.Reader
    io.Writer
}

// 实现了 Read 和 Write，都不用写代码
```

这是「装饰器」和「mock」的常用手法。

**嵌入指针还是值**：

- 嵌值：`User` 里的 `Base` 是一份拷贝，改 `u.ID` 不影响原 `Base`。
- 嵌指针：`*Base`，共享同一个对象，但要注意 nil。

**命名冲突**：两个嵌入类型有同名字段时，外层访问会歧义（编译错误），必须显式写 `u.A.X`。

**结构体比较**：所有字段都可比时，结构体可以用 `==` 比较。含 slice、map、func 的结构体不可比。

**面经**：腾讯 · 校招一面：Go 的结构体可以嵌套组合吗；两个结构体可以等值比较吗。https://segmentfault.com/a/1190000045455181

## slice 与数组

### 10.🌟`make` 和 `new` 有什么区别

**一句话**：`new(T)` 返回 `*T` 指向零值；`make` 只用于 slice / map / channel，返回初始化好的值本身。

**背景**：

这两个函数经常被混，因为都叫「创建」。但它们的用途完全不同：

- `new` 是通用的「分配一块零值内存，返回指针」。
- `make` 是专门的「初始化 slice / map / channel 的内部结构，返回值」。

区别的实质是：这三种类型**不能只分配零值内存就用**，必须初始化内部的指针/缓冲区。

**原理**：

```go
p := new(int)        // *int，指向 0
*p = 1

s := make([]int, 3)          // len=3, cap=3，三个 0
m := make(map[string]int)    // 分配了 hmap，可以写
c := make(chan int, 10)      // 分配了 hchan + 缓冲区
```

**为什么这三种类型需要 `make`**：

- `slice` 需要一个指向底层数组的指针，光分配 `{nil, 0, 0}` 没法用。
- `map` 需要一个哈希表的运行时结构（`hmap`），零值是 nil。
- `channel` 需要一个队列结构（`hchan`），零值也是 nil。

**细节**：

**`new([]int)` 能用吗**：能编译，返回 `*[]int` 指向 nil slice，但几乎没用——你还得 `*p = append(*p, 1)`。想要能用的 slice 用 `make` 或字面量。

**`new` 的适用场景**：主要是需要指针的地方，比如 `sync.Pool` 的 `New` 函数、或者某些 API 要求返回指针。实际业务代码里 `new` 用得很少，`&T{}` 更常见。

**`make` 的三个参数形式**：

```go
make([]int, 3)       // len=3, cap=3
make([]int, 0, 10)   // len=0, cap=10 —— 预分配，避免扩容
make([]int, 3, 10)   // len=3, cap=10
```

`make([]T, 0, n)` 是最常见的性能优化，一次性分配够用的容量。

**nil map 的 panic**：

```go
var m map[string]int
m["a"] = 1        // panic: assignment to entry in nil map
```

必须 `make` 或 `m := map[string]int{}` 才能写。

**面经**：

- 牛客 Go 高频统计：`make` / `new` 约 6.82%。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯 · 校招一面把 make/new 归在「slice 和数组的底层结构」那一组里问。https://juejin.cn/post/7434352545870184485

### 11.🌟slice 的底层结构

**一句话**：slice 是 `{指向底层数组的指针, len, cap}` 三元组，它本身是值，拷贝 slice 只拷贝这个三元组。

**背景**：

slice 是 Go 里最常用的数据结构，但它不是「动态数组」那么简单。理解它的三元组结构，才能解释「为什么函数里 append 外面看不到」「为什么截取会造成内存泄漏」这两个高频问题。

**原理**：

```go
type slice struct {
    array unsafe.Pointer   // 指向底层数组
    len   int              // 当前长度
    cap   int              // 容量（从 array 开始能用到多少）
}
```

内存布局：

```
slice 变量          底层数组
┌─────────┐        ┌───┬───┬───┬───┬───┐
│ array ──┼───────►│ 1 │ 2 │ 3 │   │   │
│ len = 3 │        └───┴───┴───┴───┴───┘
│ cap = 5 │         0   1   2   3   4
└─────────┘
```

**由此推出的三条结论**：

1. **传 slice 进函数，改元素外面看得到**。因为拷贝的三元组里，`array` 指向同一个底层数组。
2. **函数里 append 导致扩容，外面看不到新元素**。因为扩容后函数内的 slice 头指向新数组，外面的还指向旧数组。
3. **没扩容的 append 会改到底层数组**，但外面长度不变——这是最隐蔽的坑。

```go
func f(s []int) {
    s = append(s, 1)   // cap 够，不扩容，写进底层数组第 0 位
}

a := make([]int, 0, 4)
f(a)
fmt.Println(len(a))   // 0，长度没变
fmt.Println(a[:1])    // [1]，但底层数组已经被改了
```

**细节**：

**为什么 `append` 必须接收返回值**：因为它可能返回指向新数组的新 slice 头。不接收就等于这次 append 白做。

```go
append(s, 1)          // 错误：结果丢了
s = append(s, 1)      // 正确
```

**`s = s[:0]` 不释放内存**：只把 len 置 0，底层数组还在，cap 不变。里面的元素还留着，如果是指针会阻止 GC。

**截取导致的内存泄漏**：

```go
func first10(big []byte) []byte {
    return big[:10]     // 仍持有整个 big 的底层数组
}
```

修法是拷一份出来：

```go
out := make([]byte, 10)
copy(out, big[:10])
return out
```

**slice 是并发不安全的**：多个 goroutine 同时 `append` 会丢数据（读-改-写不是原子的）。要加锁或用 channel。

**面经**：

- 字节 · 后端一面：slice 的底层实现是什么；slice 是线程安全的吗。https://www.nowcoder.com/discuss/648273029868400640
- 字节 · 质量技术组一面：slice 的底层实现；slice 是线程安全的吗。https://www.nowcoder.com/discuss/647582648621092864
- 牛客 Go 高频：slice 和数组的底层约 4.16%，slice 原理约 3.66%。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯 · 校招一面：slice 和数组的区别，底层结构。https://juejin.cn/post/7434352545870184485

### 12.🌟slice 的扩容机制

**一句话**：容量不够时申请更大的数组、拷贝旧数据、返回指向新数组的 slice；旧数组如果还有别的 slice 引用就继续留着。

**背景**：

`append` 是 Go 里最常用的操作，但它的行为不是「在末尾加一个元素」那么简单。容量够就直接写，不够就要扩容——扩容涉及内存分配和数据拷贝，是性能敏感点。

理解扩容规则，才能解释「为什么预分配能提速」「为什么容量增长不是简单翻倍」。

**原理**：

扩容的简化流程：

1. 计算需要的容量（至少是 `len + 新增元素数`）。
2. 按增长规则算出新容量。
3. 分配新数组，拷贝旧数据。
4. 返回新的 slice 头（指向新数组）。

**增长规则**（Go 1.18 之后）：

- 旧容量小于 256：新容量 = 旧容量 × 2。
- 旧容量大于等于 256：新容量按 `(oldcap + 3×256) / 4` 增长，也就是大约 1.25 倍，逐渐收敛。

这个规则的设计目标是：小 slice 快速长大（减少扩容次数），大 slice 缓慢增长（减少内存浪费）。

**细节**：

**扩容后的 cap 不保证等于计算值**：实际分配会对齐到内存分配器的 size class。所以 `cap` 可能是 6、12、24、48 这样的值，不是精确的 2 倍。

面试时别说「一定翻倍」，说「大约翻倍，但会按内存分配粒度对齐」。

**预分配是最高效的优化**：

```go
// 差：多次扩容 + 多次拷贝
var out []int
for i := 0; i < 1000; i++ {
    out = append(out, i)
}

// 好：一次分配
out := make([]int, 0, 1000)
for i := 0; i < 1000; i++ {
    out = append(out, i)
}
```

1000 个元素，前者要扩容约 10 次，累计拷贝几千个元素。

**为什么不一直翻倍**：翻倍增长是指数级的，容量大了以后一次扩容就要分配巨大的内存，容易造成内存碎片和 GC 压力。

**`copy` vs `append`**：已知长度、往已有 slice 里填数据时，`copy` 直接写内存，`append` 要检查容量。批量赋值用 `copy`。

**面经**：

- 字节 · 大厂面经汇总：slice 切片扩容机制，为什么不一直用 2 倍扩容。https://mshiku.com/e/5053/
- 牛客 Go 高频：slice 扩容约 5.82%。https://www.nowcoder.com/discuss/789864350730162176
- 字节 · 后端一面：slice 扩容的新容量计算规则。https://www.nowcoder.com/discuss/648273029868400640

### 13.数组和 slice 的区别

**一句话**：数组是定长值类型，slice 是变长引用类型（内含指针）。

**对照表**：

| | 数组 `[3]int` | slice `[]int` |
| --- | --- | --- |
| 长度 | 类型的一部分，编译期定死 | 运行时可变 |
| 赋值 | 整块拷贝 | 拷贝三元组，共用底层数组 |
| 比较 | 可 `==`（元素逐个比） | 只能和 `nil` 比 |
| 传参 | 拷贝整个数组 | 拷贝三元组 |
| 扩容 | 不存在 | `append` 触发 |

**细节**：

**数组很少直接用**：拷贝成本随长度增长，函数签名还被长度绑死。

```go
func f(arr [1000]int)    // 每次调用拷贝 8KB
```

要么传指针 `*[1000]int`，要么转成 slice。

**数组在 slice 里**：`make([]int, 3)` 的底层就是一个 `[3]int` 数组。

**数组的用途**：固定大小的缓冲区（`[32]byte` 做哈希）、和 C 交互的 `[N]T`、以及作为 map 的 key（slice 不行，数组可以）。

**面经**：腾讯 · 校招一面：slice 和数组的区别、底层结构。https://juejin.cn/post/7434352545870184485

## map

### 14.🌟map 的底层结构（Go 1.24 之后）

**一句话**：Go 1.24 起内置 map 用 Swiss Table 实现——顶层多张表，每表 8 槽一组加 64 位控制字。

**背景**：

这题是「背了就过时」的典型。2010 到 2024 年，标准答案是「hmap + bmap、每桶 8 个 key、溢出桶链」。这套结构服役了十四年，几乎所有面经都是这么写的。

**Go 1.24 把内置 map 完全重写成了 Swiss Table**。所以现在答旧桶模型，是答错了。

面试时主动说出「1.24 起换了实现」，比背旧结构更能证明你在跟版本。

**原理**：

**顶层：多张表**。map 被拆成若干独立的表（table），每张表最多 1024 个条目。哈希的高位用来选进哪张表——这是可扩展哈希（extendible hashing）。

```
map
 ├─ table 0   （最多 1024 条）
 ├─ table 1
 └─ table 2 ...
```

**表内：8 槽一组 + 控制字**。每张表内部是开放寻址，存储切成 8 个槽一组。每组配一个 64 位控制字：

- 每个字节对应一个槽。
- 1 位表示该槽是「空 / 已删 / 在用」。
- 低 7 位存该键哈希的低 7 位（叫 `h2`）。

```
控制字（64 位）：
┌────────┬────────┬────────┬─ ... ─┐
│ 槽0    │ 槽1    │ 槽2    │       │
│ 状态+h2│ 状态+h2│ 状态+h2│       │
└────────┴────────┴────────┴─ ... ─┘
```

**查找流程**：

1. 算哈希，高位选表，低位取 `h2`。
2. 用 `h2` 在控制字上做**一次并行比较**（位运算），一次筛掉组里 8 个槽中的绝大多数。
3. 命中的候选再用完整键比较确认。
4. 没命中就按探测序列找下一组。

第 2 步是 Swiss Table 的核心收益：原本要逐个槽比 8 次，现在一次位运算就完成。

**扩容**：以「表」为单位整张扩，不是全 map 一起搬。所以单次扩容的代价上限是「把一张 1024 条的表拆成两张」。

**细节**：

**删除要留墓碑**：如果一组的 8 个槽都满了，删除时不能标成「空」，否则探测会在那里提前停止，后面的键就找不到了。所以标成「已删」（tombstone）。墓碑只在扩容时彻底清掉。

**哈希随机化**：Go 的 map 遍历顺序是故意随机的。运行时每次遍历随机选起点，防止业务代码依赖顺序。

**怎么答才稳**：

1. 先说版本分界：「1.24 之前是分桶 + 溢出桶，1.24 起是 Swiss Table」。
2. 再讲当前结构：多表、8 槽一组、控制字、`h2` 并行比较。
3. 最后补一句旧结构，说明你知道历史。

**面经**：

- 腾讯 · 校招二面：讲一下 map 的底层结构；map 中 hash 冲突怎么解决。https://segmentfault.com/a/1190000045455181
- 美团 · Go 后端一面：Go 中 map 的数据结构、扩容机制、key 为什么是无序的。https://segmentfault.com/a/1190000045455181
- 腾讯 · 校招一面：map 怎么去做并发安全、底层结构。https://juejin.cn/post/7434352545870184485

### 15.🌟map 为什么并发不安全

**一句话**：map 没有内部锁，并发读写会触发运行时检查并**直接 fatal**——不是 panic，`recover` 抓不住。

**背景**：

这是 Go 面试里最常考的一题，也是实际项目里最容易踩的坑。很多人以为「没崩过就是安全的」，其实不是。

**原理**：

Go 运行时有一个专门的并发检测：写操作时置一个标志位，读操作时检查这个标志。如果发现「另一个 goroutine 正在写」，就调用 `throw`。

```go
var m = map[int]int{}

go func() { for { m[1] = 1 } }()
go func() { for { _ = m[2] } }()

// fatal error: concurrent map read and map write
```

**为什么是 fatal 不是 panic**：`throw` 不经过 defer 链，不会被 `recover` 捕获，整个进程直接退出。

**细节**：

**检测是抽样式的**：运行时不是每次操作都检查，而是用标志位 + 采样。所以「跑了很久没崩」不代表安全——可能只是没撞上那个窗口。

**为什么设计成 fatal**：因为并发写 map 会导致内部结构损坏（比如扩容和写入交错），此时继续运行的行为是不可预测的。直接崩掉比产生脏数据安全。

**三种修法**：

| 方案 | 适用 | 代价 |
| --- | --- | --- |
| `sync.RWMutex` + 普通 map | 写多、需要遍历 | 每次操作加锁 |
| `sync.Map` | 读多写少、键集合稳定 | 写多时反而慢 |
| 分片锁 | 极高并发 | 实现复杂 |

**分片锁的思路**：把一个大 map 拆成 N 个，每个有自己的锁。按 key 的哈希选分片，锁竞争降低到 1/N。

**面经**：

- 腾讯 · 校招一面：map 并发访问会怎么样，这个异常可以捕获吗。https://segmentfault.com/a/1190000045455181
- 字节 · 后端一面：map 是线程安全的吗，如何实现一个线程安全的 map。https://www.nowcoder.com/discuss/648273029868400640
- 字节 · 质量技术组一面：map 是线程安全的吗，如何实现线程安全的 map（读写锁 / 分片锁 / sync.Map）。https://www.nowcoder.com/discuss/647582648621092864

### 16.🌟`sync.Map` 和 `RWMutex` 怎么选

**一句话**：读多写少、键集合基本稳定时用 `sync.Map`；写多或要遍历全部键时，`RWMutex` 加普通 map 更好。

**背景**：

`sync.Map` 是 Go 1.9 加的，专门为「缓存」这类场景设计。但它不是「线程安全版的 map」的通用替代品——很多场景下它比加锁还慢。

**原理**：

`sync.Map` 的核心是「读写分离」：

1. 维护一份**只读副本**（`read`），读操作只在它上面找，几乎不加锁。
2. 维护一份**脏 map**（`dirty`），新写入的键放这里，要加锁。
3. 读的时候先查 `read`，没有再去 `dirty` 找（并提升计数）。
4. 当 `dirty` 里的键足够多时，把它提升为新的 `read`。

**为什么读快**：读路径基本是原子操作，不阻塞。

**为什么写多时慢**：每次写都要判断 `dirty` 是否需要提升，而且新键会不断往 `dirty` 里堆，触发提升时要做一次全量拷贝。

**细节**：

**`sync.Map` 的适用场景**（官方文档明确说的）：

1. 键集合基本不变（写一次读多次）。
2. 多个 goroutine 读、写不同键的集合。
3. 典型：缓存、连接池、只增不删的注册表。

**不适用的场景**：

1. 需要遍历全部键并做聚合（`Range` 不是一致性快照）。
2. 写操作频繁。
3. 需要 `len` 精确值（`Len()` 是近似值）。

**零值可用**：`var m sync.Map` 直接能用，不需要 `make`。这和普通 map 相反。

**常用方法**：`Load`、`Store`、`LoadOrStore`、`Delete`、`Range`。`LoadOrStore` 是原子的「读或写」，适合缓存。

**面经**：

- 牛客 Go 高频：`sync.Map` 底层，出现率约 6.49%。https://www.nowcoder.com/discuss/789864350730162176
- 美团 · Go 后端一面：除了加 Mutex 锁以外还有哪些方式安全读写共享变量。https://segmentfault.com/a/1190000045455181

### 17.nil map、空 map 与 key 的限制

**一句话**：nil map 能读不能写；key 必须可比较。

**nil map 和空 map**：

```go
var a map[string]int        // nil
b := map[string]int{}       // 空 map
c := make(map[string]int)   // 空 map

_ = a["x"]      // 0，安全
_ = len(a)      // 0
a["x"] = 1      // panic
b["x"] = 1      // OK
```

**怎么判断空**：用 `len(m) == 0`，不要用 `m == nil`（两者都可能为空，但语义不同）。

**key 的要求**：必须可比较（comparable）。

| 能当 key | 不能当 key |
| --- | --- |
| 布尔、数值、字符串 | slice |
| 指针、channel、接口 | map |
| 数组（元素可比） | func |
| struct（字段都比） | 含上述类型的 struct |

**细节**：

**浮点能当 key 但危险**：`NaN != NaN`，所以用 `NaN` 作键永远取不出来。

**接口当 key 要小心**：动态类型不可比较时，运行时 panic。

**为什么 slice 不能当 key**：深层比较需要遍历，和 map 的 O(1) 语义冲突。要这么用就把 slice 转成字符串或哈希值。

**面经**：牛客 Go 高频把「map 的 key 为什么必须可比较」列为高频追问。https://www.nowcoder.com/discuss/789864350730162176

## string

### 18.🌟string 的底层与不可变性

**一句话**：`string` 是只读的字节序列加长度，底层是 `{ptr, len}`。

**背景**：

Go 的 `string` 和 Java 的 `String` 有一点相同（都不可变），但底层结构不同：Java 的 String 是 UTF-16 数组，Go 的是 UTF-8 字节数组。

这个差异导致「长度」「遍历」「截取」的行为都不一样。

**原理**：

```go
type stringHeader struct {
    Data unsafe.Pointer   // 指向只读的字节数组
    Len  int
}
```

**不可变的好处**：

1. 可以被安全共享（多个变量指同一份数据）。
2. 可以当 map key。
3. 并发读不需要锁。

**代价**：每次修改都要新建。

**细节**：

**`len(s)` 是字节数不是字符数**：

```go
s := "你好"
len(s)                    // 6，UTF-8 每字 3 字节
utf8.RuneCountInString(s) // 2
len([]rune(s))            // 2，但会分配切片
```

**遍历按 rune，索引按字节**：

```go
for i, r := range s {     // i 是字节偏移，r 是码点
}
s[0]                       // 第一个字节，不是第一个字符
```

**截取可能切坏字符**：`s[:3]` 是「前三个字节」，不是「前三个字符」。中文会被切成半个。

**`string` ↔ `[]byte` 转换有拷贝**：

```go
b := []byte(s)     // 拷贝
s2 := string(b)    // 拷贝
```

编译器对某些场景有优化（`m[string(b)]`、`string` 比较、`strings.Builder`），但不保证。

**面经**：暂无已核对的公开原题。string 不可变通常作为「为什么 string 能当 map key」的前提被问。

### 19.string 的拼接与长度

**一句话**：`len(s)` 是字节数；拼接少量用 `+`，循环里用 `strings.Builder`。

**拼接方式对照**：

| 方式 | 适用 | 说明 |
| --- | --- | --- |
| `+` | 少量、编译期可确定 | 每次新建 |
| `fmt.Sprintf` | 带格式化 | 慢（反射） |
| `strings.Builder` | 循环拼接 | 推荐 |
| `bytes.Buffer` | 二进制 | 也可 |
| `strings.Join` | 已有切片 | 最简洁 |

**`Builder` 的正确用法**：

```go
var b strings.Builder
b.Grow(1024)              // 预分配，避免扩容
for _, s := range items {
    b.WriteString(s)
}
result := b.String()
```

**细节**：

**`Builder` 不能复制**：复制后会 panic（内部有 `copyCheck`）。它是一次性的。

**`Builder` vs `Buffer`**：`Builder` 更省内存（没有读位置），只用于拼接字符串；`Buffer` 支持读写，用于二进制。

**为什么 `+` 在循环里慢**：每次都要分配新字符串并拷贝两边的内容。n 次拼接是 O(n²) 的拷贝量。

**面经**：暂无已核对的公开原题。字符串拼接在社招里常作为性能优化题。

## 方法与接口

### 20.🌟值接收者和指针接收者

**一句话**：要修改接收者、结构体较大、或类型里已混用指针接收者，就用指针接收者。

**背景**：

Go 的方法可以绑定在值上，也可以绑定在指针上。这个选择不只影响「能不能改」，还影响**接口实现**——同样的类型，用值接收者定义的方法和用指针接收者定义的方法，方法集不同。

**原理**：

**方法集规则**：

- 值类型 `T` 的方法集：只有值接收者方法。
- 指针类型 `*T` 的方法集：值接收者 + 指针接收者方法。

**后果**：

```go
type Speaker interface { Speak() }

type Dog struct{}
func (d *Dog) Speak() {}

var s Speaker = &Dog{}   // OK：*Dog 的方法集包含 Speak
var s2 Speaker = Dog{}   // 编译错误：Dog 的方法集里没有 Speak
```

**细节**：

**为什么值接收者的方法指针也能调**：可寻址时编译器自动取地址。

```go
d := Dog{}
d.Speak()      // 等价于 (&d).Speak()
```

但放进接口时不会自动取地址，所以上面 `var s2 Speaker = Dog{}` 报错。

**选值接收者的理由**：

1. 类型小（几个字），拷贝成本低。
2. 明确表示「这个方法不修改状态」。
3. 不可变语义，用起来安全（map 的 key 需要可比较，值接收者更自然）。

**选指针接收者的理由**：

1. 要修改接收者。
2. 结构体大，避免拷贝。
3. 类型里已经有指针接收者方法（保持一致）。

**混用的危险**：一个类型混用两种接收者，方法集就对不上，容易出现「某些方法在接口里可用、某些不可用」的怪现象。

**面经**：腾讯 · 校招一面：你如何理解 interface 类型；interface 可以进行等值比较吗。https://segmentfault.com/a/1190000045455181

### 21.🌟接口的底层结构与 nil 陷阱

**一句话**：接口值是「类型 + 数据」二元组；只有两者都为 nil，接口才等于 nil。

**背景**：

这是 Go 最经典的一个坑，而且真实项目里经常踩：函数返回 `error`，你以为返回了 nil，但调用方的 `err != nil` 却成立。

根源在于接口的底层结构。

**原理**：

```go
// 空接口
type eface struct {
    _type *_type          // 类型信息
    data  unsafe.Pointer  // 数据指针
}

// 带方法的接口
type iface struct {
    tab  *itab            // 类型 + 方法表
    data unsafe.Pointer
}
```

**`itab` 里有什么**：接口类型、具体类型、方法地址数组。接口调用就是通过这个表跳转。

**陷阱**：

```go
type MyErr struct{}
func (e *MyErr) Error() string { return "x" }

func f() error {
    var e *MyErr = nil
    return e            // 返回的 error 里「类型」是 *MyErr，「数据」是 nil
}

fmt.Println(f() == nil)   // false！
```

因为 `e` 转成 `error` 时，类型信息 `*MyErr` 被填进去了。接口不为 nil，但数据指针是 nil。

**后果**：`err != nil` 成立，程序进入错误分支；但如果代码调 `err.Error()`，接收者是 nil，方法里如果解引用了字段就 panic。

**细节**：

**修法**：函数内部用完指针后显式 `return nil`。

```go
func f() error {
    var e *MyErr
    if cond {
        e = &MyErr{}
    }
    if e == nil {
        return nil        // 显式返回 nil
    }
    return e
}
```

**接口比较的规则**：类型相同且数据相同才相等。数据是不可比较类型（slice、map、func）时，比较会 panic。

**为什么 `itab` 要缓存**：同样「接口 + 类型」的组合只算一次方法表，存在全局表里，后续直接复用。

**面经**：

- 腾讯 · 校招一面：interface 可以进行等值比较吗。https://segmentfault.com/a/1190000045455181
- 腾讯互娱 · 一面：Go 的接口作用、用处、实现。https://segmentfault.com/a/1190000045455181

### 22.🌟Go 的接口为什么是隐式的

**一句话**：不需要 `implements`，只要方法集满足就自动实现。

**背景**：

这是 Go 和 Java 最大的设计差异之一。

Java 要显式 `implements`，好处是「搜索实现类」很方便；坏处是**接口必须和实现一起设计**——你不能给一个已有的第三方类型加接口，除非改它的代码。

Go 反过来：接口在使用方定义，实现方完全不用知道。

**原理**：

```go
// 第三方包里的类型
type File struct{ /* ... */ }
func (f *File) Read(p []byte) (int, error) { /* ... */ }

// 你的代码里定义接口
type Reader interface {
    Read(p []byte) (int, error)
}

// *File 自动满足 Reader，不需要改它的代码
var r Reader = &File{}
```

**好处**：

1. 接口可以后置定义——先有实现，再按需要抽接口。
2. 可以为别人的类型定义接口。
3. 接口可以很小（`io.Reader` 只有一个方法），组合灵活。

**代价**：

1. 不知道该实现谁，得靠编译期兜底。
2. IDE 里「查找实现」不如 Java 方便。

**细节**：

**编译期断言**：惯用法是用一个空变量强制检查。

```go
var _ Reader = (*File)(nil)
```

这行的作用是：如果 `*File` 不满足 `Reader`，编译就报错。放在接口实现旁边，能在改动时立刻发现。

**接口应该定义在使用方**：这是 Go 的惯例。谁需要这个能力，谁定义接口。

反例：一个包导出接口，实现也在同一个包——这通常是 Java 思维带过来的。

**`any` 和 `interface{}`**：完全等价，`any` 是 Go 1.18 加的别名。

**面经**：腾讯 · 校招一面：1.18 版本后 interface 有什么增强。https://segmentfault.com/a/1190000045455181

## 错误处理

### 23.🌟`error` 是什么，为什么 Go 不用异常

**一句话**：`error` 是个只有 `Error() string` 方法的接口，错误是普通返回值。

**背景**：

Go 的错误处理经常被吐槽「满屏 `if err != nil`」。这个设计是刻意的：

异常机制的问题是**控制流不可见**——你调一个函数，不知道它可能抛什么，也不知道调用点在哪。Java 用 checked exception 部分解决了这个问题，但代价是签名冗长。

Go 选择了另一条路：把错误变成普通的返回值，强制调用方显式处理。

**原理**：

```go
type error interface {
    Error() string
}
```

任何实现了 `Error() string` 的类型都是错误。惯用法是把它放在最后一个返回值。

```go
func readFile(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("read %s: %w", path, err)
    }
    return data, nil
}
```

**细节**：

**错误信息不要大写开头、不要带标点**：因为它常被拼进更长的消息里。

```go
// 不推荐
errors.New("File not found.")
// 推荐
errors.New("file not found")
```

**不要用 `_` 忽略错误**，除非你明确知道为什么可以忽略。静默失败比崩溃更难排查。

**`errors.New` vs `fmt.Errorf`**：

- 静态消息用 `errors.New`（更轻）。
- 要格式化用 `fmt.Errorf`。
- 要包装链用 `fmt.Errorf("...: %w", err)`。

**代价与收益**：代码啰嗦是真的，但「错误必须被看到」也是真的。Go 社区讨论过 `try` 提案（类似 `?` 操作符），至今没有采纳。

**面经**：暂无已核对的公开原题。错误处理在 Go 面经里通常是「panic 和 error 怎么选」的起点。

### 24.🌟错误的包装与判定

**一句话**：用 `%w` 包装保留链，用 `errors.Is` 判哨兵、`errors.As` 取类型。

**背景**：

错误在调用栈里往上传递时，每一层都想加自己的上下文（「读配置失败」「连接数据库失败」）。如果只是字符串拼接，原始错误的信息就丢了，上层没法区分「是网络错还是权限错」。

Go 1.13 引入了错误链（error wrapping），解决了这个问题。

**原理**：

```go
var ErrNotFound = errors.New("not found")

func find(id int) error {
    if id <= 0 {
        return fmt.Errorf("find %d: %w", id, ErrNotFound)   // %w 保留链
    }
    return nil
}

err := find(0)
errors.Is(err, ErrNotFound)      // true，沿链查找
```

**三个函数的区别**：

| 函数 | 用途 |
| --- | --- |
| `errors.Is(err, target)` | 链上有没有某个哨兵错误 |
| `errors.As(err, &target)` | 链上有没有某个类型的值，取出到 target |
| `errors.Unwrap(err)` | 取下一层错误（一般不用直接调） |

**细节**：

**`%w` 和 `%v` 的区别**：`%v` 只是格式化文本，链断了；`%w` 保留 `Unwrap`，能用 `Is` / `As` 查到。

**多个 `%w`**：Go 1.20 起一个 `fmt.Errorf` 可以有多个 `%w`，`Is` / `As` 会遍历所有分支。

**自定义错误接入链**：实现 `Unwrap() error` 方法即可。

```go
type MyError struct {
    Code int
    Err  error
}

func (e *MyError) Error() string { return fmt.Sprintf("code %d: %v", e.Code, e.Err) }
func (e *MyError) Unwrap() error { return e.Err }
```

**为什么不能用 `==` 比较错误**：包装后的错误是新对象，`==` 比的是地址。只有没包装的哨兵错误才能 `==`，但包装是更好的实践，所以统一用 `Is`。

**面经**：暂无已核对的公开原题。`%w` 和 `errors.Is/As` 在 Go 1.13 之后才成为标准答法。

### 25.🌟`panic` 和 `recover`

**一句话**：`panic` 是程序级故障，`error` 是业务上可预期的失败；`recover` 只能救当前 goroutine。

**背景**：

Go 有异常机制（`panic` / `recover`），但官方的立场是「不应该用它做正常错误处理」。它只用于「程序进入了不可能继续的状态」。

理解边界很重要，因为用错了会导致整个进程崩溃。

**原理**：

**panic 的传播**：

1. 当前函数停止执行，开始跑 defer。
2. defer 里如果调 `recover()`，能拿到 panic 值，函数正常返回。
3. 没有 recover，panic 继续向上传播，直到 goroutine 的最外层。
4. 最外层没 recover，整个进程退出。

**关键限制**：

```go
func safeGo(fn func()) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                log.Printf("panic: %v", r)
            }
        }()
        fn()
    }()
}
```

`recover` 必须在**同一个 goroutine**里、且在**defer 中**才生效。子 goroutine 的 panic 会带走整个进程。

**细节**：

**哪些情况抓不住**：

1. 别的 goroutine 的 panic。
2. `recover` 不在 defer 里的。
3. fatal error：并发写 map、栈溢出、OOM。这些走的是 `throw` 不是 `panic`。

**什么时候该 panic**：

- 程序启动时的致命配置错误（缺关键环境变量）。
- 不可能的代码路径（`default: panic("unreachable")`）。
- 库的初始化失败。

**什么时候不该 panic**：

- 参数校验失败（用 error）。
- 文件不存在、网络超时（用 error）。
- 业务规则不满足（用 error）。

**recover 之后的状态**：panic 可能发生在「改了一半」的时候，恢复后数据可能不一致。所以 recover 一般只用于「记录日志 + 重启 goroutine」，不用来继续正常业务。

**面经**：

- 腾讯 · 校招一面：外层的协程能捕获子协程的 panic 吗；panic 都会被捕获吗，哪些 panic 不会捕获。https://segmentfault.com/a/1190000045455181
- 字节 · 后端一面：在匿名函数内 panic，匿名函数外的 defer 是否会触发 recover；反之呢。https://www.nowcoder.com/discuss/648273029868400640

### 26.🌟`defer` 的执行时机

**一句话**：函数返回前按后进先出执行；参数在 `defer` 语句处就求值，函数体在返回时才跑。

**背景**：

`defer` 是 Go 的资源管理机制，用来保证「无论从哪条路径返回，清理都会执行」。它替代了 Java 的 `try-finally`。

但它的执行时机有两个容易搞错的细节：参数求值时机，以及和返回值的交互。

**原理**：

```go
func f() (n int) {
    defer func() { n++ }()      // 闭包，看到的是最终的 n
    defer fmt.Println(n)        // 参数此刻求值，打印 0
    return 1                    // n = 1，然后 defer 逆序执行
}
// 输出：0
// 返回值：2
```

两个细节：

1. **参数立即求值**：`defer fmt.Println(n)` 的参数在 defer 语句处就算好了，是 0。
2. **闭包捕获变量**：`defer func(){ n++ }()` 捕获的是变量 `n` 本身，执行时看到的是 1，加完是 2。

**执行顺序**：多个 defer 后进先出。

```go
for i := 0; i < 3; i++ {
    defer fmt.Println(i)
}
// 输出：2 1 0
```

**细节**：

**循环里用 defer 会累积**：

```go
for _, path := range paths {
    f, _ := os.Open(path)
    defer f.Close()      // 全部累积到函数返回才执行
}
```

文件多了会耗尽句柄。要在循环内关闭，就包一层函数：

```go
for _, path := range paths {
    func() {
        f, _ := os.Open(path)
        defer f.Close()
        // 用 f
    }()
}
```

**defer 的性能**：Go 1.14 起有开放编码（open-coded defer），非循环场景几乎零成本。所以不用为了性能避免 defer。

**defer 里改返回值**：能，但要用命名返回值 + 闭包。

```go
func f() (err error) {
    defer func() {
        if err != nil {
            err = fmt.Errorf("wrap: %w", err)
        }
    }()
    return do()
}
```

**面经**：

- 字节 · 后端一面：defer 的作用和底层原理；多个 defer 的执行顺序。https://www.nowcoder.com/discuss/648273029868400640
- 腾讯 · 校招二面：讲一下 defer 的原理；优雅启停怎么配合 defer。https://segmentfault.com/a/1190000045455181
- 腾讯互娱 · 一面：Go defer 执行顺序。https://segmentfault.com/a/1190000045455181

## 泛型

### 27.🌟Go 泛型怎么用，和 Java 差在哪

**一句话**：Go 1.18 引入类型参数，用接口做约束（type set），编译期实例化，不是 Java 那种擦除。

**背景**：

Go 长期没有泛型，社区用「接口 + 类型断言」或者代码生成来凑。1.18 引入泛型时，设计上做了很多取舍，和 Java / C++ 都不一样。

理解这些差异，才能知道 Go 泛型的适用边界。

**原理**：

```go
// 定义约束
type Number interface {
    ~int | ~int64 | ~float64
}

// 使用约束
func Sum[T Number](xs []T) (total T) {
    for _, x := range xs {
        total += x
    }
    return
}

Sum([]int{1, 2, 3})        // 6
Sum([]float64{1.5, 2.5})   // 4.0
```

**和 Java 的对照**：

| | Java | Go |
| --- | --- | --- |
| 实现方式 | 擦除，运行时没有类型参数 | 编译期实例化，运行时有具体类型 |
| 约束 | `extends` 上界 | 接口 type set |
| 基本类型 | 必须装箱 | 直接用，不装箱 |
| 泛型方法 | 支持 | **不支持** |
| 协变 | 数组协变（不安全） | 无协变，`[]T` 和 `[]U` 无关 |

**细节**：

**`~` 是什么意思**：表示「底层类型是它」的都可以。

```go
type MyInt int

Sum([]MyInt{1, 2})   // 可以用，因为 MyInt 的底层类型是 int
```

**为什么没有泛型方法**：方法上的类型参数会让接口实现和方法集推导复杂化，至今没有好设计。要类似效果就把类型参数放在接收者类型上。

```go
type Stack[T any] struct {
    items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }
```

**实例化的代价**：每个实参组合生成一份代码。所以泛型会让编译变慢、二进制变大。Go 有形状去重（shape-based）优化，但没有 Java 擦除那种彻底共享。

**什么时候该用泛型**：写通用容器、通用算法（`slices`、`maps` 包）。业务代码里，「用接口」往往比「用泛型」更清晰。

**面经**：暂无已核对的公开原题。泛型在 Go 后端面经里出现频率低于 Java，多数公司只问「有没有用过、解决了什么问题」。

### 28.泛型约束的写法

**一句话**：约束是接口，可以用联合类型、`~`、方法、`comparable` 组合。

**几种常见约束**：

```go
// 联合类型
type Number interface {
    ~int | ~int64 | ~float64
}

// 方法约束
type Stringer interface {
    String() string
}

// comparable（预声明约束）
func Contains[T comparable](xs []T, v T) bool {
    for _, x := range xs {
        if x == v {
            return true
        }
    }
    return false
}

// 组合
type Ordered interface {
    ~int | ~int64 | ~string
}
```

**细节**：

**`comparable` 是特殊的**：它允许 `==` 和 `!=`，是所有可比较类型的集合。用它才能写「查找」这类逻辑。

**方法约束和类型集合不能混用**：一个接口里要么是类型集合，要么是方法集合，不能两者都有（`comparable` 除外）。

**标准库的现成约束**：`cmp.Ordered`、`slices` 和 `maps` 包里的各种约束，直接用就行。

**面经**：暂无已核对的公开原题。泛型约束在社招里作为「你写过泛型吗」的追问。

## 并发语法

并发模型在并发篇，这里只讲语法。

### 29.`go` 关键字与 goroutine 等待

**一句话**：`go f()` 把任务交给调度器，当前 goroutine 继续执行；主 goroutine 退出时其它全部终止。

**原理**：

```go
go f()       // 不阻塞，立刻返回
```

调度器决定什么时候跑，不保证立刻执行，也不保证顺序。

**等待的正确写法**：

```go
var wg sync.WaitGroup
for i := 0; i < 10; i++ {
    wg.Add(1)              // 必须在 go 之前
    go func(n int) {
        defer wg.Done()
        work(n)
    }(i)                   // 传值，避免共享
}
wg.Wait()
```

**细节**：

**`wg.Add` 必须在 `go` 之前**：否则 `Wait` 可能在 `Add` 之前就返回了。

**主 goroutine 退出会终止一切**：不会等其它 goroutine。这是新手最常见的「为什么我的 goroutine 没跑」。

**`GOMAXPROCS` 决定并行度**：默认是 CPU 核数，决定同时有多少个 P 在执行 Go 代码。

**面经**：腾讯 · 校招一面：go 哪些内置类型是并发安全的；goroutine 怎么同步。https://segmentfault.com/a/1190000045455181

### 30.🌟循环变量在 goroutine 里的坑

**一句话**：Go 1.22 起循环变量每轮新建，这个坑按规范已不存在；但只在 `go.mod` 声明 1.22+ 的模块生效。

**背景**：

这是 Go 最著名的坑之一。十几年来，写 `for _, v := range items { go func(){ use(v) }() }` 会让所有 goroutine 都拿到最后一个 `v`。

1.22 改了语言规范，从根上修掉了。

**原理**：

**旧语义**（1.22 之前）：`for` 里用 `:=` 声明的变量整个循环只有一个，每次迭代是给同一个变量赋值。闭包捕获的是这个变量，所以最终都看到最后一个值。

**新语义**（1.22 起）：每次迭代创建新的变量。效果等价于每轮循环体开头有一句 `v := v`。

```go
for _, v := range items {
    go func() { use(v) }()   // 1.22+ 每轮一个 v，正确
}
```

**细节**：

**只在 `go 1.22+` 的模块生效**：语义由 `go.mod` 的 `go` 指令决定。老模块（`go 1.16`）仍然是旧语义。

所以看到老代码里的 `v := v` 不是没道理——它要兼容旧语义。

**显式在循环外声明仍然共享**：

```go
var v string
for _, v = range items {     // 注意是 = 不是 :=
    go func() { use(v) }()   // 还是共享
}
```

**面试怎么答**：先答版本分界，再说「现在不需要写 `v := v`，但看老代码要确认 go.mod」。这既证明知道历史，也证明知道现状。

**面经**：暂无已核对的公开原题。这类题常作为输出题出现。

## 其他语法

### 31.`switch` 的特殊之处

**一句话**：默认不贯穿、可以带初始化语句、可以省略表达式当 `if-else` 链。

**原理**：

```go
switch x := f(); {
case x < 0:
    // 负数
case x == 0:
    // 零
default:
    // 正数
}
```

三个特性：

1. **默认 `break`**：不需要写 `break`，要贯穿得显式 `fallthrough`。
2. **可带初始化**：`switch x := f(); x { ... }`。
3. **可省略表达式**：`switch { case cond: }` 等价于 `if-else` 链。

**细节**：

**`fallthrough` 的限制**：只能用在 case 最后一行，不能用在类型开关里。

**多值 case**：`case 1, 2, 3:`。

**类型开关**是特例：`switch v := i.(type)`，`v` 在每个分支是具体类型。

**为什么反着来**：贯穿是 bug 的来源（忘记 `break`）。Go 把默认行为改成更安全的。

**面经**：暂无已核对的公开原题。语法题在 Go 面经里占比很低。

### 32.`unsafe.Pointer` 什么时候用

**一句话**：只在极致性能或和 C 交互时用，日常业务代码不该出现。

**原理**：

`unsafe.Pointer` 能在任意指针类型之间转换，绕过类型系统。

```go
// string 转 []byte 零拷贝（危险）
func toBytes(s string) []byte {
    return *(*[]byte)(unsafe.Pointer(&s))
}
```

**细节**：

**`unsafe.Pointer` vs `uintptr`**：`uintptr` 是普通整数，GC 不追踪它指向的对象，可能被回收。`unsafe.Pointer` 是真正的指针，GC 会追踪。

**风险**：依赖内存布局，Go 版本升级可能变。改只读内存会导致段错误。

**合法用途**：和 C 交互（cgo）、实现零拷贝的序列化、读取结构体字段偏移。

**面经**：暂无已核对的公开原题。`unsafe` 在业务岗很少问，基础设施岗会深挖。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应节 |
| --- | --- | --- |
| 腾讯 · 校招一面 | 值传递还是引用传递 | 5 |
| 腾讯 · 校招一面 | slice 和数组的区别、底层结构 | 11、13 |
| 腾讯 · 校招一面 | map 怎么并发安全、并发访问会怎样、异常能否抓住 | 14、15 |
| 腾讯 · 校招一面 | `interface` 怎么理解、能不能比较、1.18 有什么增强 | 20、21、22 |
| 腾讯 · 校招一面 | 外层协程能否捕获子协程 panic、哪些 panic 抓不住 | 25 |
| 腾讯 · 校招一面 | 结构体能否嵌套组合、两个结构体能否等值比较 | 9 |
| 腾讯 · 校招二面 | map 底层结构、hash 冲突解决、defer 原理 | 14、26 |
| 字节 · 后端一面 | slice 底层、slice 是否线程安全、map 线程安全、defer 原理 | 11、15、26 |
| 字节 · 质量技术组一面 | slice 底层、map 线程安全 | 11、15 |
| 字节 · 大厂汇总 | slice 扩容机制、为什么不一直用 2 倍 | 12 |
| 美团 · Go 后端一面 | map 数据结构、扩容、key 无序；rune 类型 | 4、14 |
| 牛客 · Go 高频 | `make` / `new`、slice 扩容、`sync.Map` | 10、12、16 |

来源：

- 牛客 Go 高频 https://www.nowcoder.com/discuss/789864350730162176
- 关键词统计 https://www.nowcoder.com/discuss/752654728466534400
- 腾讯校招一面 https://juejin.cn/post/7434352545870184485
- 腾讯校招多轮汇总 https://segmentfault.com/a/1190000045455181
- 字节后端一面 https://www.nowcoder.com/discuss/648273029868400640
- 字节质量技术组一面 https://www.nowcoder.com/discuss/647582648621092864
- 字节大厂汇总 https://mshiku.com/e/5053/
- 字节秋招一面 https://www.nowcoder.com/feed/main/detail/71e75505e34f43689ce98e20f78f3ed8
- 字节搜索后端二面 https://www.nowcoder.com/discuss/668776138512052224

## 依据

- Go 1.24 map 改 Swiss Table：https://go.dev/blog/swisstable 、https://go.dev/doc/go1.24
- 运行时 map 实现注释：https://go.dev/src/internal/runtime/maps/map.go
- Go 1.22 循环变量新语义：https://go.dev/doc/go1.22 、https://go.dev/wiki/LoopvarExperiment

## 这一篇没写的东西

- **GMP、work stealing、GC**：运行时篇。
- **channel、`select`、`sync` 各锁、`context`**：并发篇。
- **`reflect`、`cgo`**：不是这套岗位的必考项。
- **模块版本管理细节**：面试很少深问。
- **标准库源码**：属于框架层。
