# TypeScript

对标 Java SE 与集合里属于语言本身的部分。事件循环在浏览器篇，异步 I/O 在 Node 篇。

每一节按同一顺序讲：先说这问题是哪来的，再说机制怎么转，最后落到细节和坑。

## 概述与编译

### 1.🌟TypeScript 是什么，为什么前端要引入它

**一句话**：TypeScript 是 JavaScript 加了一层编译期类型检查，产出的仍然是 JavaScript。

**背景**：

JavaScript 早期只用来做表单校验和页面动效，代码量千行以内，一个人从头读到尾没问题。真正的问题是从「Ajax + 单页应用」开始出现的：一个前端项目变成了几万行、几十个开发者协作，模块之间的调用靠口头约定。

这种规模下暴露了三个问题：

1. **改一个字段，不知道哪些地方在用**。`user.name` 改成 `user.username`，只能全局搜索，靠人眼判断。
2. **参数形状靠猜**。一个 `fetchUser(id, options)` 的 `options` 到底支持哪些字段，只能去看实现或者文档，而文档经常是过期的。
3. **空值和缺字段要到线上才发现**。接口少返回一个字段，页面白屏，报错是 `Cannot read properties of undefined`，还得靠 sourcemap 反查是哪一层。

这三个问题本质是同一个：**没有契约**。TS 就是把这层契约写进代码里，让编译器在构建时替你做交叉检查。

**原理**：

TS 的处理分两个互不影响的部分：类型检查与代码生成。

```
.ts 源码
  ├─ 解析 → AST
  ├─ 绑定 → 符号表（这个标识符指向哪个声明）
  ├─ 检查 → 类型图（这个表达式能不能赋给那个位置）
  └─ 输出 → 按 target 降级语法的 .js + .d.ts
```

关键在于「检查」和「输出」是分开的。`tsc --noEmit` 可以只跑检查；esbuild、SWC 这类工具可以只跑输出、完全跳过检查。这就是为什么打包能快到秒级，也是为什么类型错误不一定能挡住构建。

类型系统本身有几个特征，理解了才知道它能做什么、不能做什么：

- **结构化**，不是名义的。两个类型只要形状兼容就能互相赋值，不需要 `implements`。
- **擦除式**，编译完类型全没了。所以运行时拿不到泛型实参，也没法 `instanceof` 一个 interface。
- **图灵完备**，类型层面能写循环和递归，所以有 `infer`、条件类型、模板字面量这些看起来像编程的语法。

**细节**：

它解决的是「编译期能不能对上」，解决不了「运行时的数据可不可信」。接口返回的 JSON、`localStorage` 里的内容、URL 参数，这些在类型上都可以被你「声明」成任何形状，编译器不会验证。

```ts
// 这行只是让编译器闭嘴，数据不合法照样运行时炸
const user = JSON.parse(raw) as User;
```

要真正安全，外部输入得先过一层运行时校验（zod、valibot、手写类型守卫），再谈类型。

**它的收益也不只是防错**：

1. 编辑器能补全、能跳转定义、能安全重命名，这些在纯 JS 项目里全靠猜。
2. 函数签名就是文档，而且不会过期。
3. 重构时改一个类型，所有不兼容的调用点立刻标红。

**面经**：

- 美团 · 前端：用过 TS 吗，跟 JS 有什么区别。https://mianshidashi.cn/interview-questions/meituan/frontend-engineer/typescript-vs-javascript-difference
- 字节 · 飞书一面：平时 JS 写得多还是 TS 多；TS 里比较常用的类型定义。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 2.🌟`tsc` 到底做了什么

**一句话**：做两件事——类型检查，以及把 `.ts` 转成 `.js` 和 `.d.ts`。

**背景**：

浏览器只认 JavaScript。所以无论你用多少 TS 语法，最终交付到浏览器的东西必须是一个或多个 `.js` 文件。`tsc` 就是官方提供的这个转换器，顺带把类型检查做了。

它和 Webpack、Vite 的职责边界经常被搞混：`tsc` 只负责「单个文件（或整个项目）的类型检查和语法降级」，打包、压缩、拆包、热更新都是打包器的事。

**原理**：

编译分五个阶段：

1. **解析（parse）**：把源码变成抽象语法树。这一步不关心类型，只关心语法对不对。
2. **绑定（bind）**：建符号表，搞清「这个名字指向哪个声明」。这一步要处理作用域、提升、模块导入。
3. **检查（check）**：这是最耗时的部分。遍历 AST，对每个表达式推断类型，检查赋值、调用、返回是否兼容。
4. **转换（transform）**：按 `target` 把新语法降级。箭头函数转 `function`、`async` 转状态机、可选链转三元判断。
5. **输出（emit）**：生成 `.js`，按需生成 `.d.ts` 和 sourcemap。

三个配置项决定它往哪个方向走：

| 配置 | 管什么 | 举例 |
| --- | --- | --- |
| `target` | 语法降级到哪个版本 | `ES5` 会把箭头函数转成 `function` |
| `lib` | 类型定义里能用哪些 API | 没有 `DOM` 就不能用 `document` |
| `module` | 输出什么模块格式 | `ESNext` / `CommonJS` / `NodeNext` |

`target` 和 `lib` 是独立的，这是最容易搞混的地方。你可以 `target: ES5` 配 `lib: ["ES2022", "DOM"]`——意思是「语法我降级了，但我知道运行环境有 Promise 和 document」。

**细节**：

**检查慢在哪**：它要构建整个程序的类型图，包括所有依赖包的 `.d.ts`。项目大、依赖多的时候，`node_modules` 里几千个声明文件都要读一遍。所以有 `skipLibCheck`（跳过 `.d.ts` 内部的检查，只检查你自己的代码）。

**为什么它不做打包**：模块打包涉及「哪些模块真的被用到」「怎么合并成一个文件」「怎么处理循环依赖」，这些需要全局的依赖图分析，超出了单文件编译的范畴。

**`include` / `exclude` / `files` 的关系**：`files` 是精确列表，`include` 是 glob，`exclude` 从 `include` 结果里减。`node_modules` 默认被排除。

**什么时候需要 `.d.ts`**：`declaration: true` 时生成。库作者必须开，业务项目通常不需要——除非你要给别人提供类型。

### 3.TypeScript 的编译器是什么写的

**一句话**：历史上是自举的 TypeScript/JavaScript 实现，**7.0 起是 Go 重写的原生端口**，命令还是 `tsc`。

**背景**：

这个问题以前从来没人问，2025 年之后变成了一道时效题。原因是微软把整个编译器用 Go 重写了一遍，2026 年 7 月发布 7.0，官方说全量构建快了 8 到 12 倍。

面试官问这个，考的不是你背不背得出编译器史，而是**你知不知道手上的工具最近发生了什么**。

**原理**：

为什么要重写：类型检查是典型的 CPU 密集任务，而且天然可以并行——不同文件之间的检查大部分是独立的。原来的实现跑在 Node 上，单线程加 GC，多核吃不满。Go 有真正的多线程和更可控的内存，所以能线性加速。

怎么做到行为一致：这次是「忠实移植」，不是重写设计。代码结构、算法逻辑都保持原样，只换语言和运行时。官方强调两个编译器的结果要一致，这样升级才不需要改业务代码。

编辑器侧的变化：新编译器改用 LSP（语言服务器协议），VS Code 有专门的扩展。这不是语法层面的变化，是工具链对接方式的变化。

**细节**：

**别答错这三处**：

- 「TypeScript 用 TypeScript 自己写的」——那是 6.x 之前。
- 「TypeScript 编译器是 Node 写的」——它是 JS 写的，跑在 Node 上。
- 「7.0 加了新语法」——没有。7.0 的重点是性能，语法层面基本不动。

比较稳的说法：**「历史上是自举实现，7.0 起是 Go 原生端口，命令和安装方式都没变。」**

**风险点**：依赖编译器内部管线的特性最可能出问题。最典型的是 `emitDecoratorMetadata`——它要求编译器在类型检查阶段把类型信息写进元数据，这是 NestJS 依赖注入的基础。社区对这个特性的未来一直有关注，但官方立场是「等 TS 团队明确说了再动」，不要替他们保证。

### 4.🌟什么是类型擦除

**一句话**：绝大多数类型语法在产物里一点都不剩，包括 `interface`、`type`、类型标注、泛型参数。

**背景**：

JS 引擎不认识类型。如果 TS 生成的新代码里要保留类型信息，那浏览器和 Node 都得改，这不可能。所以 TS 选择了另一条路：类型只在编译期存在，产物就是普通 JS。

这个决定带来了一整串后果，理解了擦除，很多「TS 为什么不能做某事」就都能自己推出来。

**原理**：

擦除的意思是：类型标注、类型别名、接口声明，这些在编译产物里没有任何对应物。

```ts
// 源码
interface User { id: number; name: string }

function greet(u: User): string {
  return `hi ${u.name}`;
}

// 产物（大致）
function greet(u) {
  return `hi ${u.name}`;
}
```

由此可以推出几条限制：

1. **不能 `new T()`**：运行时没有 `T` 这个东西，泛型参数只是编译期的占位符。
2. **不能 `instanceof` 一个 interface**：`instanceof` 要读 `prototype`，interface 没有运行时对象。
3. **不能 `T.name`**：类可以（`class` 有运行时值），泛型参数不行。
4. **不能 `typeof` 一个类型**：`typeof` 操作的是值，类型不是值。

要让泛型有运行时能力，只有一条路：把运行时需要的东西当参数传进去。

```ts
function create<T>(ctor: new () => T): T {
  return new ctor();          // ctor 是值，可以 new
}
```

**细节**：

**擦除的正面作用**：类型不参与运行时，所以 TS 代码和等价 JS 跑得一样快。说「TS 有运行时性能损耗」是误解，损耗全在编译期。

**`typeof` 的双重身份**：这一点初学者最容易混。

```ts
const x = 1;
type A = typeof x;      // 类型位置：查 x 的静态类型，结果是 number
const s = typeof x;     // 值位置：运行时的 typeof，结果是 "number"
```

看起来是同一个词，实际是两套机制，后者会留在产物里，前者不会。

**哪些写法能保留类型信息**：只有两条路——手写类型守卫，或者用装饰器元数据（`emitDecoratorMetadata` + `reflect-metadata`）。后者就是 NestJS 的做法，但它依赖旧版装饰器。

**面经**：美团 · 前端那道「TS 和 JS 的区别」的标准答法里就要求说清「编译后类型大多被擦除，运行时执行的仍是 JavaScript」。https://mianshidashi.cn/interview-questions/meituan/frontend-engineer/typescript-vs-javascript-difference

### 5.哪些 TS 语法不会被擦除

**一句话**：`enum`、`namespace`、参数属性、装饰器——这四样会在产物里留下运行时痕迹。

**背景**：

「类型零成本」是 TS 的宣传语，但它并不完全成立。有几个语法是「用类型系统的语法，生成运行时代码」，它们和擦除原则是冲突的。理解这几个例外，能解释很多项目规范为什么这么定。

**原理**：

```ts
enum Color { Red, Green }
```

编译产物是一个真实的对象：

```js
var Color;
(function (Color) {
  Color[Color["Red"] = 0] = "Red";
  Color[Color["Green"] = 1] = "Green";
})(Color || (Color = {}));
```

它做了双向映射：`Color.Red === 0`，`Color[0] === "Red"`。这段代码会被打进产物，增加体积。

其它三个：

| 语法 | 产物 | 为什么 |
| --- | --- | --- |
| `namespace N {}` | 一个 IIFE | 要模拟命名空间对象 |
| `constructor(private x)` | 构造函数里 `this.x = x` | 参数属性是语法糖 |
| `@dec class {}` | 装饰器调用 | 装饰器本质是函数 |

**细节**：

**为什么很多项目禁用 `enum`**，三个理由都成立：

1. 它生成运行时代码，和「类型零成本」的直觉冲突，也让「剥类型」的工具（esbuild）处理起来更麻烦。
2. `const enum` 要内联，意味着必须能看到定义，`isolatedModules` 下跨包使用直接报错。
3. 数值枚举允许任意数字赋值，`Color[99]` 是合法的，类型不安全。

替代方案是用 `as const` 对象加联合类型：

```ts
const Color = { Red: 'red', Green: 'green' } as const;
type Color = (typeof Color)[keyof typeof Color];   // 'red' | 'green'
```

好处是产物就是一个普通对象（本来也需要它），类型是从值推出来的，不用维护两份。

**`namespace` 该不该用**：不该。ESM 普及之后它是历史包袱，新代码用模块。只在两种场景还会见到——给老代码补类型，或者写 `.d.ts` 里的全局声明。

**参数属性和装饰器**：这两个是框架生态的基础，短期不会消失。NestJS 的整个依赖注入就靠它们。

## 语言基础

类型题经常从这里起手，因为很多「TS 为什么这样」的答案要回到 JS 的语言语义。

### 6.🌟闭包是什么，为什么它是 Hooks 的基础

**一句话**：闭包是函数记住了它被创建时所在的作用域，即使那个作用域已经执行完，里面的变量还能被访问。

**背景**：

闭包不是 TS 或某个框架的特性，是 JS 作用域链的必然结果。但它变成了前端面试的必考题，原因是**现代前端的核心抽象全都建立在闭包上**：React Hooks、防抖节流、模块私有变量、柯里化。

不理解闭包，就没法理解「为什么 `useEffect` 里拿到的是旧值」「为什么事件监听里的 `state` 不更新」。

**原理**：

JS 的函数是一等对象，它除了代码，还持有一个指向「定义时词法环境」的引用。调用时，变量查找先看自己的作用域，再顺着这个引用往外找。

```ts
function counter() {
  let n = 0;
  return () => ++n;      // 这个箭头函数持有对 n 的引用
}
const c = counter();
c();   // 1
c();   // 2
```

`counter()` 执行完后，它的执行上下文本该销毁，但因为返回的函数还引用着 `n`，引擎不能回收这块内存。这就是「闭包让变量活得更久」。

V8 的实际做法是**逃逸分析**：如果变量被闭包捕获，就把它从栈上搬到堆上（放进 `Context` 对象）；没被捕获的仍然留在栈上，函数返回就消失。

**细节**：

**闭包和内存泄漏的关系**：闭包本身不泄漏，但它是泄漏的常见载体。只要闭包还活着，它引用的整条作用域链都回收不掉。

```ts
function attach() {
  const huge = new Array(1e6).fill('x');
  window.addEventListener('resize', () => {
    console.log(huge.length);      // huge 被闭包留住
  });
}
```

这里 `huge` 有 8MB 左右，只要监听的函数没移除，就一直占着。修法是解绑监听，或者别在闭包里捕获大对象。

**经典坑：循环里的闭包**。

```ts
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));   // 3 3 3
}
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));   // 0 1 2
}
```

原因是 `var` 是函数作用域，三个闭包共享同一个 `i`；`let` 是块作用域，每轮迭代创建一个新的绑定。这个差异在 Go 里也存在，而且 Go 到 1.22 才改成每轮新建。

**闭包和 Hooks**：React 的函数组件每次渲染都是一次函数调用，`useState` 返回的值是当次渲染的常量，事件处理函数通过闭包捕获它。所以「点三次按钮 `count` 还是旧值」不是 bug，是闭包的正常行为。

**面经**：字节 · 剪映一面把 JS 异步、单线程、事件循环、栈和堆、`this`、`call` / `apply` / `bind` 连着问。https://www.nowcoder.com/discuss/839496349576855552

### 7.🌟`this` 到底指向谁

**一句话**：`this` 不看函数在哪定义，看它怎么被调用；箭头函数除外，它没有自己的 `this`。

**背景**：

`this` 是 JS 里最反直觉的设计之一。它像是一个隐式参数，由调用方式决定，而不是由定义位置决定。这个设计让方法复用变得麻烦，也是历史上大量 bug 的来源。

理解 `this` 的关键是记住：**它是一个运行时概念，由调用点的语法形式决定**。

**原理**：

四条绑定规则，按优先级从高到低：

| 优先级 | 形式 | `this` 指向 |
| --- | --- | --- |
| 1 | `new Fn()` | 新创建的对象 |
| 2 | `fn.call(obj)` / `fn.apply(obj)` / `fn.bind(obj)` | 指定的 `obj` |
| 3 | `obj.fn()` | `obj` |
| 4 | `fn()` 裸调用 | 严格模式 `undefined`，非严格是全局对象 |

```ts
const obj = { name: 'a', hi() { return this.name } };

obj.hi();          // 'a'  —— 规则 3
const f = obj.hi;
f();               // undefined —— 规则 4，接收者丢了
f.call(obj);       // 'a'  —— 规则 2
```

箭头函数是例外：它没有自己的 `this`，用的是定义时外层函数的 `this`。这叫**词法 `this`**，和普通函数的**动态 `this`** 是两套机制。

**细节**：

**`call` / `apply` / `bind` 的区别**：

| 方法 | 是否立即执行 | 参数形式 |
| --- | --- | --- |
| `call` | 是 | 逐个传 |
| `apply` | 是 | 数组 |
| `bind` | 否，返回新函数 | 逐个传 |

`bind` 绑定后的 `this` 不能再被 `call` 改掉，这是它的语义。

**箭头函数的其它限制**：不能 `new`（没有 `[[Construct]]`）、没有 `arguments`、没有 `prototype`。所以它不能当构造函数，也不能当 generator。

**React 里的历史包袱**：类组件的方法默认没有绑定，作为回调传出去就丢了 `this`，所以以前满屏 `this.handleClick = this.handleClick.bind(this)`。函数组件没有这个问题，但换成了闭包旧值问题。

**严格模式的影响**：非严格模式下裸调用的 `this` 是全局对象（浏览器里是 `window`），严格模式是 `undefined`。ESM 和 class 内部默认都是严格模式，所以现代代码里裸调用基本都会得到 `undefined`。

**面经**：

- 字节 · 剪映一面：`this` 指向、`call` / `apply` / `bind` 的区别。https://www.nowcoder.com/discuss/839496349576855552
- 字节 / 百度 / 快手：`this` 的绑定规则是 JS 基础必问项。https://www.nowcoder.com/discuss/889546972099584000

### 8.🌟原型链是什么

**一句话**：每个对象内部有一个链接指向它的原型对象，访问属性时顺着这条链往上找，直到 `null`。

**背景**：

JS 没有类（ES6 的 `class` 是语法糖），它用「对象委托」来实现复用：一个对象找不到某个属性时，去它的原型上找，再找不到就继续往上，这就是原型链。

理解原型链，才能回答「`new` 到底做了什么」「`class` 和函数有什么区别」「为什么说 JS 是原型继承」。

**原理**：

每个对象有一个内部槽 `[[Prototype]]`（通过 `Object.getPrototypeOf` 读）。函数还有一个 `prototype` 属性，它是一个对象，将来会成为实例的原型。

`new Fn()` 做四件事：

1. 创建一个空对象。
2. 把这个对象的 `[[Prototype]]` 指向 `Fn.prototype`。
3. 以这个对象为 `this` 执行 `Fn`。
4. 如果 `Fn` 返回的是对象，就用返回值；否则返回这个新对象。

```ts
function Person(name) { this.name = name }
Person.prototype.say = function () { return this.name };

const p = new Person('x');
p.say();                                        // 'x'
Object.getPrototypeOf(p) === Person.prototype;  // true
Object.getPrototypeOf(Person.prototype) === Object.prototype;  // true
Object.getPrototypeOf(Object.prototype);        // null，链到头了
```

`class` 的底层是同一套，但有三处不同：

1. `class` 不能当普通函数调用（`Person()` 可以，`class` 不行）。
2. `class` 的方法不可枚举（`for...in` 不会遍历到）。
3. `class` 内部强制严格模式。

**细节**：

**`__proto__` 和 `prototype` 别混**：

| | 是什么 | 谁能用 |
| --- | --- | --- |
| `obj.__proto__` | 访问器，读写 `[[Prototype]]` | 所有对象（继承自 `Object.prototype`） |
| `Fn.prototype` | 一个普通对象属性 | 只有函数有 |

标准 API 是 `Object.getPrototypeOf` / `Object.setPrototypeOf` / `Object.create`，`__proto__` 是历史遗留。

**`Object.create(null)` 的用途**：创建没有原型的对象，不会继承 `toString`、`hasOwnProperty`、`__proto__`。做字典或缓存时更安全，不会因为键名撞上原型属性而出错。

**原型污染**：如果攻击者能往 `Object.prototype` 上写属性，所有对象都会受影响。这是 `lodash.merge` 之类库的历史漏洞来源，防御方法是「不接受用户提供的 `__proto__` / `constructor` / `prototype` 键」。

**原型链和性能**：属性查找要沿链走，链越长越慢。所以业务对象尽量扁平，深层继承在 JS 里不是好模式。

**面经**：字节 · 剪映二面问过原型链。https://www.nowcoder.com/discuss/839496349576855552

### 9.基本类型和引用类型

**一句话**：基本类型按值存，赋值时复制值；引用类型存地址，赋值时复制地址。

**背景**：

这个区别决定了 JS 里一半的「为什么改了没生效 / 为什么莫名其妙变了」问题。它也解释了为什么要有深拷贝、为什么 `===` 比较对象时结果反直觉。

**原理**：

七个基本类型：`string`、`number`、`boolean`、`null`、`undefined`、`symbol`、`bigint`。它们存在栈上（或者被优化进寄存器），赋值就是复制值。

其余都是对象，存在堆上，变量里存的是地址。

```ts
let a = 1;
let b = a;
b = 2;
console.log(a);       // 1，互不影响

const o1 = { n: 1 };
const o2 = o1;
o2.n = 2;
console.log(o1.n);    // 2，指向同一个对象
```

函数传参也遵循这个规则：传基本类型拷值，传对象拷地址。所以函数里改对象属性会影响外面，但重新赋值参数不影响外面。

**细节**：

**`typeof null === 'object'`** 是历史 bug：早期实现用低位标记类型，`null` 的表示是全零，被识别成 object。修不了，会破坏太多现有代码。

**`NaN` 和 `-0` 的坑**：

```ts
NaN === NaN;              // false
Object.is(NaN, NaN);      // true
0 === -0;                 // true
Object.is(0, -0);         // false
```

`Object.is` 在 `NaN` 和 `-0` 上和 `===` 不同。React 的 `useState` 比较、`Object.is` 的语义都依赖这个区别。

**基本类型的「方法」**：`'abc'.toUpperCase()` 能调用，是因为引擎临时把字符串装箱成 `String` 对象，调用完就丢掉。所以给字符串加属性是无效的：

```ts
const s = 'abc';
s.x = 1;
console.log(s.x);    // undefined，非严格模式下静默失败
```

**面经**：暂无已核对的公开原题。这题通常作为「深浅拷贝」「`==` 和 `===`」的前置知识出现。

### 10.`==` 和 `===` 的区别

**一句话**：`===` 要求类型和值都相同；`==` 会先做类型转换再比。

**背景**：

JS 的 `==` 有一套复杂的隐式转换规则，规则本身不复杂，但组合起来会产生大量反直觉的结果。这是 JS 最著名的「坑」之一，也是 ESLint 默认禁 `==` 的原因。

**原理**：

`==` 的比较规则（简化版）：

1. 类型相同 → 直接比（和 `===` 一样）。
2. `null == undefined` → `true`，且它们和其它任何值比都是 `false`。
3. 一边是数字、一边是字符串 → 字符串转数字。
4. 一边是布尔 → 布尔转数字（`true` → 1，`false` → 0）。
5. 一边是对象、一边是基本类型 → 对象转基本类型（先 `valueOf` 再 `toString`）。

**细节**：

几个经典的坑，能背下来就能应付大部分追问：

```ts
[] == false        // true，因为 [] 转成 '' 再转成 0，false 转成 0
'' == 0            // true
null == 0          // false，规则 2 的例外
null == undefined  // true
NaN == NaN         // false
'1' == 1           // true
```

**唯一推荐用 `==` 的场景**：`x == null`，它同时覆盖 `null` 和 `undefined`，比 `x === null || x === undefined` 简洁。ESLint 的 `eqeqeq` 规则可以配 `smart` 允许这种写法。

**TS 里的情况**：TS 会对 `==` 做一定检查，如果两边类型完全不相交（比如 `string == number`）会直接报错。但它不会阻止 `any` 和 `unknown` 的 `==`，所以规范还是必要的。

**面经**：暂无已核对的公开原题。属于「知道这些坑」就够的题。

### 11.深浅拷贝的实现和坑

**一句话**：浅拷贝只复制第一层，嵌套对象还是共享的；深拷贝要递归到底，`structuredClone` 是最省事的选择。

**背景**：

因为引用类型的赋值只复制地址，想得到一个「改了不影响原对象」的副本就得拷贝。这件事在状态管理里尤其常见：React 强调不可变更新，每次都要产生新对象。

问题在于「多深算深」。嵌套几层的对象、数组、Map、Set、Date、类实例、循环引用——每种情况的处理都不一样。

**原理**：

**浅拷贝**的三个方式，效果基本一致：

```ts
const a = { ...obj };              // 展开
const b = Object.assign({}, obj);  // 合并
const c = { x: obj.x, y: obj.y };  // 手写
```

它们都只复制「自有可枚举属性」的第一层。嵌套对象仍然是同一个引用。

**深拷贝**的几种方式，各有适用范围：

| 方式 | 支持 | 不支持 |
| --- | --- | --- |
| `structuredClone` | Map、Set、Date、RegExp、ArrayBuffer、循环引用 | 函数、原型链、Symbol 键 |
| `JSON` 往返 | 纯数据、循环引用外的结构 | undefined、函数、Date、Map、Set、NaN、bigint、循环引用 |
| 递归手写 | 完全可控 | 要自己处理所有边界 |
| `lodash.cloneDeep` | 大部分场景 | 体积大 |

**细节**：

**`JSON` 方案的损失清单**，面试常考：

```ts
JSON.parse(JSON.stringify({
  a: undefined,      // 丢失
  b: () => {},       // 丢失
  c: new Date(),     // 变成字符串
  d: new Map(),      // 变成 {}
  e: NaN,            // 变成 null
  f: Infinity,       // 变成 null
  g: 1n,             // 直接抛错
}));
```

**`structuredClone` 的限制**：它用的是结构化克隆算法，和 `postMessage` 传对象是同一套。所以函数、Promise、WeakMap、DOM 节点都不能克隆，会抛 `DataCloneError`。

**为什么类实例克隆后会丢方法**：`structuredClone` 和 `JSON` 都只保留数据，不保留原型链。克隆出来的对象是普通对象，`instanceof` 会失败。要保留原型得手写或用专门的库。

**性能**：深拷贝的成本和数据量成正比。频繁深拷贝大对象是性能瓶颈，React 里应该尽量用不可变更新的方式（只改需要改的层），而不是每次整体深拷贝。

**面经**：暂无已核对的公开原题。常作为「React 状态为什么不能直接改」的追问。

## 类型系统

### 12.🌟`any`、`unknown`、`never` 分别什么时候用

**一句话**：三者的核心差别是「能赋给谁」，不是中文名。

**背景**：

TS 有两种「任意类型」：`any` 和 `unknown`。前者放弃检查，后者保留检查。`never` 则是另一个方向——它表示「不可能有值」。

分清它们的可赋值方向，才能理解为什么官方推荐用 `unknown` 替代 `any`。

**原理**：

| 类型 | 能接收什么 | 能赋给谁 | 用在哪 |
| --- | --- | --- | --- |
| `any` | 任何值 | 任何类型 | 逃生舱，但会污染下游 |
| `unknown` | 任何值 | 只能给 `unknown` / `any`，用前必须收窄 | 外部输入 |
| `never` | 什么都接收不了 | 能赋给任何类型 | 穷尽检查、永不返回 |
| `void` | — | 只能赋给 `any` / `unknown` | 函数无返回值 |

`any` 和 `unknown` 在**接收**方向一样（都能装任何值），差别在**读取**方向：`any` 随便用，`unknown` 必须先证明类型。

**为什么 `any` 比「没类型」更糟**：`any` 会传播。任何碰到 `any` 的运算结果还是 `any`，整条链路失去检查。

```ts
const data: any = fetchSomething();
const name = data.user.profile.name;   // 全都不检查，运行时炸
```

换成 `unknown`，第一行就报错，逼你先收窄。

**`never` 的两个用途**：

1. 永不返回的函数：`function fail(msg: string): never { throw new Error(msg) }`。
2. 穷尽检查：

```ts
type Shape = { kind: 'circle' } | { kind: 'square' };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return 1;
    case 'square': return 2;
    default:
      const _exhaustive: never = s;   // 加了新形状，这里编译不过
      return _exhaustive;
  }
}
```

**细节**：

**`void` 和 `never` 的区别**：`void` 是「有返回值，但值是 undefined 或调用方不该用」；`never` 是「根本没有返回值」。函数抛错、死循环用 `never`，无返回用 `void`。

**`catch` 变量为什么是 `unknown`**：`useUnknownInCatchVariables`（TS 4.4 起默认开启）把 `catch (e)` 的 `e` 定为 `unknown`，因为 JS 允许 `throw` 任何东西。

**怎么把 `unknown` 收窄**：`typeof`、`instanceof`、`in`、类型谓词、断言函数，或者直接用 schema 校验库 parse。

**`any` 什么时候可以用**：迁移中的老代码、和没有类型的第三方库交互、写复杂的类型体操时的中间变量。但要在边界上立刻转成具体类型。

**面经**：

- 京东 · 暑期 / 腾讯 · 提前批：`any` 和 `unknown` 的区别。https://www.nowcoder.com/discuss/889546972099584000
- 牛客 · 2023 前端 TS 真题合集：`any` / `unknown` / `never` / `void` 的区别，以及如何把 `unknown` 收窄。https://www.nowcoder.com/discuss/517852889394446336

### 13.🌟类型收窄有哪几种手段

**一句话**：`typeof`、`instanceof`、`in`、判别联合的字面量字段、`Array.isArray`、类型谓词、断言函数、真值判断。

**背景**：

联合类型是 TS 最常用的建模方式，但拿到一个 `string | number` 之后，你得先判断它到底是什么才能用。收窄就是「用运行时检查告诉编译器：在这个分支里它就是某个类型」。

这是类型系统里最实用的一环，也是「TS 写得顺不顺」的分水岭。

**原理**：

TS 的控制流分析会跟踪每个位置的变量类型。遇到 `if (typeof x === 'string')`，分支内 `x` 的类型就被收窄成 `string`。

```ts
function f(x: string | number) {
  if (typeof x === 'string') {
    x.toUpperCase();        // 这里 x 是 string
  } else {
    x.toFixed(2);           // 这里 x 是 number
  }
}
```

**各种手段的适用场景**：

| 手段 | 能区分什么 |
| --- | --- |
| `typeof` | 基本类型（注意 `null` 会得到 `'object'`） |
| `instanceof` | 类实例 |
| `in` | 有某个属性的对象（会查原型链） |
| 判别联合 | 有字面量标签的联合（最推荐） |
| `Array.isArray` | 数组 vs 非数组 |
| 类型谓词 `x is T` | 自定义判断 |
| 断言函数 `asserts x is T` | 判断失败就抛错 |
| 真值判断 | 排除 `null` / `undefined` / `''` / `0` |

**细节**：

**判别联合是最稳的方式**，因为它不依赖运行时特征，而是依赖你显式写的标签：

```ts
type Result =
  | { ok: true; data: string }
  | { ok: false; error: Error };

function handle(r: Result) {
  if (r.ok) return r.data;    // 收窄到第一个分支
  return r.error;             // 收窄到第二个
}
```

**类型谓词是「你对编译器的承诺」**，写错了不报错：

```ts
function isString(x: unknown): x is string {
  return true;          // 编译通过，但运行时是错的
}
```

所以要保证谓词函数体的检查是真的。

**收窄会失效的位置**：

```ts
function f(x: string | null) {
  if (x !== null) {
    setTimeout(() => {
      x.toUpperCase();     // 报错：回调执行时 x 可能已经变了
    });
  }
}
```

原因是回调是异步执行的，编译器无法保证条件在那一刻仍然成立。解法是把收窄后的值存进新变量：

```ts
if (x !== null) {
  const s = x;
  setTimeout(() => s.toUpperCase());   // 没问题
}
```

**`!= null` 的妙用**：它同时排除 `null` 和 `undefined`，比 `!== undefined` 更实用，因为大部分「空值」两种情况都算。

**面经**：牛客 · 2023 前端 TS 真题合集问了「如何将 unknown 类型指定为一个更具体的类型」。https://www.nowcoder.com/discuss/517852889394446336

### 14.字面量类型和 `as const`

**一句话**：`as const` 把值收窄到最窄的字面量，同时把对象变只读、数组变只读元组。

**背景**：

默认情况下，TS 会把字面量「拓宽」成更宽的类型，因为通常你想要的是「任意字符串」，不是「必须是 `'circle'` 这个字符串」。

```ts
const a = { kind: 'circle' };   // kind 的类型是 string，不是 'circle'
```

但建模判别联合时，你恰恰需要最窄的那个字面量。`as const` 就是用来关掉拓宽的。

**原理**：

```ts
const obj1 = { kind: 'circle' };
// { kind: string }

const obj2 = { kind: 'circle' } as const;
// { readonly kind: "circle" }

const arr1 = [1, 2];
// number[]

const arr2 = [1, 2] as const;
// readonly [1, 2]
```

它做两件事：收窄字面量，加 `readonly`。数组会变成定长元组。

**细节**：

**和类型标注的区别**：

```ts
const a: string = 'x';           // 标注：告诉编译器它是 string
const b = 'x' as const;          // 断言：让它保持 'x'
```

标注是「我声明它是什么」，`as const` 是「让它保持它本来的样子」。

**和 `readonly` 的区别**：`readonly` 只加只读，不收窄字面量。`as const` 两个都做。

**只读是编译期的**：`as const` 不会冻结对象。运行时代码仍然能改：

```ts
const o = { a: 1 } as const;
(o as any).a = 2;    // 运行时能改，只是类型层面禁止
Object.isFrozen(o);  // false
```

要真正冻结得用 `Object.freeze`。

**常见用途**：路由表、配置对象、常量映射（替代 `enum`）、i18n 的 key 表。

**面经**：暂无已核对的公开原题。

### 15.`satisfies` 解决什么问题

**一句话**：校验值符合某个类型，但不把值的类型拓宽成那个类型。

**背景**：

在 `satisfies` 出现之前，这里有个两难：

```ts
// 写法 A：标注类型，校验有了，但键和字面量丢了
const routes: Record<string, string> = {
  home: '/',
  user: '/user/:id',
};
routes.home;         // string，不是 '/'

// 写法 B：不用标注，字面量保住了，但校验没了
const routes = {
  home: '/',
  user: '/user/:id',
};
routes.typo;         // 报错（因为键不存在），但值写错不会报
```

`as const` 能保住字面量，但它不做校验。

**原理**：

`satisfies` 是 TS 4.9 引入的：它检查值是否满足某个类型，但**不改变值的推断类型**。

```ts
const routes = {
  home: '/',
  user: '/user/:id',
} satisfies Record<string, `/${string}`>;

routes.home;         // '/'，字面量保住了
routes.typo;         // 报错，键不存在
```

如果值写错（比如 `home: 'x'`），`satisfies` 会报错。这是「两者兼得」。

**细节**：

**和 `as` 的区别**：`as` 是断言，只改编译器看到的类型，不做校验，甚至能骗过编译器。`satisfies` 是校验，值本身类型不变。

**配合 `as const` 用**：想要既校验、又收窄字面量、又只读，可以两个一起用：

```ts
const config = {
  theme: 'dark',
  size: 12,
} as const satisfies { theme: string; size: number };
```

**典型场景**：路由表、主题色板、i18n key 表、事件名映射——共同点是「既要保证形状对，又要保留具体的键和值」。

**面经**：暂无已核对的公开原题。这是 TS 4.9 之后的新题，面经里还不多。

### 16.`null` 和 `undefined` 在严格模式下

**一句话**：`strictNullChecks` 打开后，它们不再能赋给其他类型，必须显式写进联合。

**背景**：

在非严格模式下，`null` 和 `undefined` 可以赋给任何类型，这意味着类型系统对「空值」完全失明。这是 TS 早期最大的漏洞，也是 `Cannot read properties of undefined` 这类线上错误的根源。

`strictNullChecks` 是 TS 2.0 引入的，它是 `strict` 里影响最大的一个开关。

**原理**：

```ts
// strictNullChecks: false
let s: string = null;      // 允许

// strictNullChecks: true
let s: string = null;      // 报错
let s2: string | null = null;   // 允许
```

可选属性 `a?: T` 的实际类型是 `T | undefined`，不是「不存在」。这在 `exactOptionalPropertyTypes` 打开后才有区别。

**细节**：

**三个空值相关运算符**：

| 语法 | 行为 |
| --- | --- |
| `a?.b` | `a` 是 `null` / `undefined` 时返回 `undefined`，不继续求值 |
| `a ?? b` | 只在 `a` 是 `null` / `undefined` 时取 `b` |
| `a \|\| b` | `a` 是任何假值时取 `b`（包括 `0`、`''`、`false`） |

`??` 和 `||` 的区别是真实 bug 来源：`count || 10` 在 `count` 为 0 时会得到 10。

**非空断言 `!` 的风险**：它只是让编译器闭嘴，运行时该是 `undefined` 还是 `undefined`。团队里应该配 `no-non-null-assertion` 规则限制使用。

**`a?: T` 和 `a: T | undefined` 的区别**：前者允许不写这个属性，后者要求写但值可以是 `undefined`。在 `exactOptionalPropertyTypes` 打开后，`{ a: undefined }` 不满足 `a?: T`。

**面经**：暂无已核对的公开原题。

## 结构与类型设计

### 17.🌟`type` 和 `interface` 怎么选

**一句话**：能描述对象形状就用 `interface`，需要联合、交叉、映射、条件类型时用 `type`。

**背景**：

这是 TS 面试出现频率最高的一题，但很多答法只停留在「interface 能合并、type 不能」。实际上两者的差异有更清晰的边界：**`interface` 是「声明一个对象类型」，`type` 是「给一个类型表达式取名字」**。

理解这个定位，选择就不需要背规则了。

**原理**：

```ts
interface A { a: string }
interface A { b: number }              // 合并成 { a, b }
type B = A & { c: boolean };            // 交叉

type C = string | number;               // type 能表达联合
interface D extends A { c: boolean }    // interface 能继承
```

四条实质差别：

| 维度 | `interface` | `type` |
| --- | --- | --- |
| 声明合并 | 支持 | 不支持 |
| 能表达的形态 | 对象 / 函数 / 类形状 | 任意类型表达式 |
| 继承方式 | `extends` | `&` 交叉 |
| 报错可读性 | 更接近声明处 | 联合出错时摊开很长 |

**细节**：

**声明合并的用途**：给第三方库补类型、扩展全局类型。这也是 `interface` 不可替代的地方。

```ts
interface Window {
  __APP_CONFIG__: AppConfig;
}
```

**`type` 不可替代的地方**：联合、条件类型、映射类型、模板字面量、`typeof` 取值的类型、元组。

**性能差异**：极深的递归类型用 `interface` 更容易被编译器缓存，`type` 的组合可能让检查变慢。这是实践结论，不是语言规定，但大项目里能感觉到。

**团队约定比技术差别更重要**：常见的约定是「对象形状用 `interface`，其余用 `type`」。统一了就不用在 review 里争论。

**面经**：

- 字节 · 抖音二面：`type` 和 `interface` 怎么选。https://www.nowcoder.com/discuss/889546972099584000
- 字节 · 飞书一面：`interface` 或者 `type` 去定义类型，这两者有什么区别。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 牛客 · 2023 前端 TS 真题合集：相同点与不同点的完整对比。https://www.nowcoder.com/discuss/517852889394446336

### 18.🌟什么是结构类型

**一句话**：TS 看形状不看身份，Java 看身份。

**背景**：

这是 TS 和 Java 最根本的设计差异，也是从 Java 转过来的人最容易误解的地方。

Java 是**名义类型**：`class Dog implements Animal` 才算 `Dog` 是 `Animal`，名字和继承链决定一切。

TS 是**结构类型**：只要形状满足，就是兼容的，不需要任何声明。

**原理**：

```ts
interface Point { x: number; y: number }

class Vec {
  constructor(public x: number, public y: number) {}
}

const p: Point = new Vec(1, 2);   // 可以，形状一样
```

`Vec` 从没写过 `implements Point`，但它有 `x` 和 `y` 两个 number，所以兼容。

这个规则也适用于函数：

```ts
type Handler = (e: Event) => void;

const fn = (e: MouseEvent) => {};   // 参数类型更具体
const h: Handler = fn;              // 可以（参数逆变）
```

**细节**：

**好处**：第三方类型能直接当你的接口用，不用包一层。比如 `axios` 返回的对象可以直接满足你的 `User` 接口。

**坏处**：两个语义完全不同但形状相同的类型可以互串。`UserId` 和 `OrderId` 都是 `string`，传错了不报错。

**怎么模拟名义类型**：加品牌字段：

```ts
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

function getUser(id: UserId) {}
getUser('abc' as OrderId);   // 报错
```

也可以用类的 `#private` 字段——私有字段让两个结构相同的类互不兼容。

**多余属性检查是例外**：对象字面量多写一个字段会报错，这是「新鲜字面量」的额外检查，不是结构类型的一部分。先赋给变量再传进去就绕过了。

**面经**：牛客 · 2023 前端 TS 真题合集专门问了「你对 TypeScript 类型兼容性的理解」，包括接口兼容性和函数兼容性的差别。https://www.nowcoder.com/discuss/517852889394446336

### 19.类里的访问修饰符

**一句话**：`public`（默认）、`protected`、`private`，加 `readonly`；TS 的 `private` 是编译期的，`#private` 才是运行时的。

**背景**：

TS 的 `private` 经常被误解成「真正的私有」。它只在类型检查时生效，编译出来还是普通属性，运行时能访问。ES2022 引入的 `#field` 才是真私有。

这两套机制并存，理解区别才能选对。

**原理**：

| 修饰符 | 谁能访问 | 编译后 |
| --- | --- | --- |
| `public` | 任何地方 | 不变 |
| `protected` | 自己和子类 | 不变 |
| `private` | 只有自己 | **不变，运行时可访问** |
| `#field` | 只有自己 | 真私有，运行时也拦 |
| `readonly` | 任何地方读 | 只是编译期约束 |
| `static` | 通过类名 | 挂在构造函数上 |

```ts
class A {
  private x = 1;      // 编译后是普通属性
  #y = 2;             // 编译后是真私有
}

const a = new A();
a['x'];   // 能拿到，1
a['#y'];  // 拿不到
```

**细节**：

**`readonly` 是浅的**：`readonly items: string[]` 只禁止重新赋值 `items`，`items.push()` 仍然可以。深度只读要用 `readonly string[]`。

**`protected` 和 `private` 的继承差别**：`protected` 子类能访问，`private` 不能。但 TS 的 `private` 检查是结构性的——两个类都有同名 `private` 字段时互不兼容。

**`#private` 的额外效果**：私有字段是真正的隔离，连 `JSON.stringify` 都序列化不出来，`Object.keys` 也拿不到。这在需要隐藏内部状态时很有用。

**参数属性**：`constructor(private x: number)` 是语法糖，等价于声明字段加赋值。它只在构造函数参数上有效。

**面经**：牛客 · 2023 前端 TS 真题合集把「类」列为独立知识点，包含访问修饰符、抽象类、静态属性、接口实现。https://www.nowcoder.com/discuss/517852889394446336

### 20.抽象类和接口

**一句话**：接口只描述形状、没有实现；抽象类可以带实现和状态，只能单继承。

**背景**：

这两个概念在 Java 里界限清晰，在 TS 里反而容易混，因为 TS 的接口能描述类，抽象类也能当接口用。

区别的实质是：**接口是「能做什么」，抽象类是「是什么」**。

**原理**：

```ts
interface Repository {
  findById(id: string): Promise<User>;
}

abstract class BaseRepository {
  abstract findById(id: string): Promise<User>;

  protected log(msg: string) {      // 有实现
    console.log(`[repo] ${msg}`);
  }
}
```

三处实质差别：

1. **实现**：抽象类可以有具体方法和字段，接口只能声明。
2. **状态**：抽象类可以有实例字段，接口不能。
3. **数量**：一个类能实现多个接口，只能继承一个抽象类。

**细节**：

**运行时差异**：抽象类编译后是真实的类，会出现在产物里；接口完全擦除。

**什么时候用抽象类**：需要共享实现或状态时。比如「所有 Repository 都有 `findById` 的通用缓存逻辑」，抽象类合适。

**什么时候用接口**：只定义契约、多个不相关的类都要满足时。比如 `Serializable`、`Comparable`。

**抽象类不能被实例化**：`new AbstractClass()` 编译报错。但运行时它就是个普通类，JS 里能 new。

**面经**：牛客 · 2023 前端 TS 真题合集列了「抽象类」和「接口实现」两个子知识点。https://www.nowcoder.com/discuss/517852889394446336

### 21.函数重载怎么写

**一句话**：TS 的重载是「多个签名声明 + 一个实现」，运行时只有一个函数，靠函数体自己判断类型。

**背景**：

Java 的重载是编译期和运行期都存在的：编译器按参数类型选方法，字节码里有多个方法。

TS 的重载只是给调用方看的类型提示，编译后只剩一个函数。理解这个区别，才能知道什么时候该用重载、什么时候用联合类型更省事。

**原理**：

```ts
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  return typeof input === 'string' ? Number(input) : String(input);
}
```

三部分的角色：

1. 前两行是**重载签名**，对调用方可见。
2. 第三行是**实现签名**，对外不可见，但必须兼容所有重载签名。
3. 运行时只有第三个函数体，类型判断靠自己写。

**细节**：

**重载 vs 联合类型**：参数组合简单时，联合类型加条件返回类型更省事：

```ts
// 重载写法
function parse(input: string): number;
function parse(input: number): string;

// 联合写法（更简洁）
function parse<T extends string | number>(input: T): T extends string ? number : string;
```

后者类型更精确（返回值跟着参数走），但可读性差一些。组合多的时候重载更好读。

**可选参数和默认值**：`a?: T` 和 `a: T = x` 都能减少重载的数量。默认值还让参数在省略时有确定的值。

**`this` 参数**：函数的第一个参数可以声明 `this: Type`，用来约束调用时的 `this`。它不占实际参数位，编译后被擦除。

```ts
function handler(this: HTMLElement, e: Event) {
  this.classList.add('active');    // this 被约束成 HTMLElement
}
```

**面经**：牛客 · 2023 前端 TS 真题合集把「函数」列为独立知识点。https://www.nowcoder.com/discuss/517852889394446336

## 泛型

### 22.🌟泛型解决什么问题

**一句话**：把类型当参数传，让同一段逻辑适配不同类型，同时保住类型之间的关联。

**背景**：

没有泛型时，想写「通用的」代码只有两条路：用 `any`，或者为每种类型复制一份。

`any` 的问题是丢失类型信息。看这个例子：

```ts
function first(arr: any[]): any {
  return arr[0];
}
const n = first([1, 2, 3]);   // n 是 any
n.toUpperCase();               // 不报错，运行时炸
```

复制的问题是可维护性——每加一个类型就要加一份实现。

泛型是第三条路：类型本身变成参数，调用时自动推断。

**原理**：

```ts
function first<T>(arr: readonly T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]);      // number | undefined
const s = first(['a', 'b']);     // string | undefined
```

`T` 是一个占位符，调用时由实参推断出来。关键在于：**同一份实现，不同的类型，类型关系不丢**。

再看一个能体现「关系不丢」的例子：

```ts
function pair<T>(a: T, b: T): [T, T] {
  return [a, b];
}

pair(1, 2);        // [number, number]
pair(1, 'a');      // 报错：两个参数必须同类型
```

换成 `any` 就拦不住了。

**细节**：

**约束**：不写约束时 `T` 上什么都访问不到，因为编译器不知道它有什么。

```ts
function prop<T>(obj: T, key: string) {
  return obj[key];      // 报错：T 上没有索引签名
}

function prop2<T extends object, K extends keyof T>(obj: T, key: K) {
  return obj[key];      // OK，返回值类型是 T[K]
}
```

**推断的边界**：大部分情况能自动推断，推不出来时才手写 `<T>`。常见推不出来的场景是「T 只出现在返回值里」。

**运行时不存在**：泛型擦除，所以不能 `new T()`、不能 `T.name`。需要运行时能力就把构造函数当参数传进去。

**代价**：类型检查变慢、报错信息变长、可读性下降。所以「能用具体类型就别用泛型」，泛型是给真正通用的代码用的。

**面经**：

- 字节 · 飞书一面：泛型是什么，解决什么问题。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 美团 · 前端：TypeScript 中的泛型是什么（考察概念、作用、与 any 的差异）。https://www.upcv.tech/mianshi/xuanpai-company-cmlake0rh03p99k42wmyp81vr/q-qbi_question_5fa3ef93122785e632903bda9c6ca352.html
- 字节 · 前端：请解释泛型的概念，并说明它在函数和类中的应用。https://www.upcv.tech/mianshi/xuanpai-company-cmlami120094r9k42nkxfd8j4/q-qbi_question_39fe9c3e67eff1ae4759ee82db4c4f6e.html

### 23.泛型约束

**一句话**：`extends` 限定 `T` 必须满足的形状，`keyof` 把类型参数限制到某个类型的键。

**背景**：

无约束的泛型等于 `unknown`——你能传任何东西进去，但在函数里什么都干不了。约束是让泛型「有用」的关键。

最常见的约束模式是 `K extends keyof T`，它保证「键一定存在」。

**原理**：

```ts
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((x) => x[key]);
}

const users = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
pluck(users, 'name');    // string[]
pluck(users, 'age');     // 报错：'age' 不在 keyof T 里
```

返回值 `T[K]` 是「索引访问类型」，精确到那个键的类型。

**常见约束形态**：

| 形态 | 含义 |
| --- | --- |
| `T extends SomeInterface` | 必须有这些成员 |
| `K extends keyof T` | 必须是 `T` 的键 |
| `T extends string \| number` | 必须是联合中的一种 |
| `T extends (...args: any) => any` | 必须是函数 |
| `T extends object` | 必须是非基本类型 |

**细节**：

**约束的顺序**：多个类型参数互相依赖时，被依赖的放前面。

```ts
// 对
function f<T, K extends keyof T>(obj: T, key: K) {}

// 错：K 用到 T 时 T 还没声明
function g<K extends keyof T, T>(obj: T, key: K) {}
```

**约束和条件类型的交互**：`T extends any` 和 `T extends unknown` 作为约束几乎没区别，但在条件类型里都会触发分发。写工具类型时要注意：

```ts
type Distribute<T> = T extends any ? T[] : never;
type R = Distribute<'a' | 'b'>;    // 'a'[] | 'b'[]，不是 ('a' | 'b')[]
```

**`~` 在 Go 里是什么意思**：Go 的 `~int` 表示「底层类型是 int」，和 TS 的 `extends` 类似但不是一回事。TS 里没有对应的语法，结构兼容本来就不看名字。

**面经**：泛型约束通常作为「泛型是什么」的追问，见上一节的来源。

### 24.协变、逆变、双变

**一句话**：函数返回值位置协变，参数位置逆变，方法参数默认双变。

**背景**：

这个知识点看起来抽象，但它解释了一个很实际的问题：为什么「把 `Animal => void` 赋给 `Dog => void` 是安全的，反过来不安全」。

理解了方向，函数类型的兼容规则就不需要背。

**原理**：

先定义方向：

- **协变**：子类型能赋给父类型（`Dog` → `Animal`），方向一致。
- **逆变**：父类型能赋给子类型（`Animal` → `Dog`），方向相反。
- **双变**：两者都行。
- **不变**：必须完全一致。

```ts
type Animal = { name: string };
type Dog = Animal & { bark(): void };

let f: (a: Animal) => void = () => {};
let g: (d: Dog) => void = f;        // 可以：参数逆变
let h: (a: Dog) => void = (a: Animal) => {};
// 报错：Animal 不一定有 bark
```

**为什么参数要逆变**：调用方按声明的参数类型传值。`g` 声明接受 `Dog`，实际实现是 `f`（接受 `Animal`），传 `Dog` 进去，`f` 完全能处理——它只需要 `name`。反过来，`h` 声明接受 `Animal`，实现却需要 `bark()`，传一个没有 `bark` 的 `Animal` 就炸了。

**细节**：

**方法的双变**：TS 为了兼容老代码，方法参数默认双变（`strictFunctionTypes` 只管函数类型，不管方法）。

```ts
interface A {
  m(x: Animal): void;
}
interface B {
  m(x: Dog): void;
}

declare const a: A;
const b: B = a;    // 方法双变，允许
```

这是个已知的不安全点，是为了让 `Array` 这类老接口能工作。

**数组的协变**：`Dog[]` 能赋给 `Animal[]`，但数组是可变的，所以这也不安全：

```ts
const dogs: Dog[] = [{ name: 'a', bark() {} }];
const animals: Animal[] = dogs;
animals.push({ name: 'b' });    // 往 Dog[] 里塞了 Animal
dogs[1].bark();                  // 运行时炸
```

`readonly T[]` 没有这个问题，因为它禁止 `push`。

**面经**：牛客 · 2023 前端 TS 真题合集专门问了「对协变、逆变、双变和抗变的理解」。https://www.nowcoder.com/discuss/517852889394446336

## 高级类型

### 25.`keyof` 和 `typeof`

**一句话**：`keyof` 拿类型的键联合，`typeof` 在类型位置拿值的类型。

**背景**：

这两个操作符是「类型之间的桥」：`keyof` 从类型到类型，`typeof` 从值到类型。

配合使用能实现「类型跟着实现走」——改了常量，类型自动跟着变，不用维护两份。

**原理**：

```ts
const config = { host: 'a', port: 80 } as const;

type Config = typeof config;    // { readonly host: "a"; readonly port: 80 }
type Keys = keyof Config;       // "host" | "port"

const k: Keys = 'host';         // OK
const k2: Keys = 'unknown';     // 报错
```

`keyof typeof obj` 是最常见的组合，用来拿对象键的联合。

**细节**：

**`typeof` 的两个位置**：

```ts
const x = 1;
type A = typeof x;    // 类型位置：number
const s = typeof x;   // 值位置："number"
```

同一个词，两套机制。类型位置的会被擦除，值位置的会保留。

**`keyof` 遇到索引签名**：会退化成 `string | number`，因为不知道具体有哪些键。

**过滤键的类型**：`keyof T & string` 能去掉 symbol 和 number 键。

**`keyof` 和映射类型配合**：这是所有工具类型的基础：

```ts
type Keys<T> = { [K in keyof T]: K };
type R = Keys<{ a: 1; b: 2 }>;   // { a: 'a'; b: 'b' }
```

**面经**：牛客 · 2023 前端 TS 真题合集单独问了 `keyof` 和 `typeof` 的作用。https://www.nowcoder.com/discuss/517852889394446336

### 26.映射类型

**一句话**：`[K in keyof T]` 遍历 `T` 的每个键，生成新对象类型。

**背景**：

所有内置工具类型（`Partial`、`Readonly`、`Pick`）都是映射类型的应用。理解它，就不需要背工具类型的实现——能自己推出来。

**原理**：

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
```

四个组成部分：

1. `K in keyof T`：遍历所有键。
2. `?` / `-?`：加或去掉可选。
3. `readonly` / `-readonly`：加或去掉只读。
4. `T[K]`：取值类型。

**细节**：

**同态映射**：直接写 `keyof T` 的映射是同态的，会保留原属性的可选性和只读性，也会保留数组和元组的特性。写成 `keyof T & string` 就不同态了，元组会被打散。

**键重映射**：用 `as` 改键名或过滤键：

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K];
};

type G = Getters<{ name: string }>;   // { getName: () => string }
```

返回 `never` 的键会被移除，这是过滤的手段：

```ts
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
```

**面经**：暂无已核对的公开原题。映射类型通常在「工具类型怎么实现」里被追问。

### 27.条件类型与分布式

**一句话**：`T extends U ? X : Y`，当 `T` 是裸类型参数且传入联合时，会分发到每个成员。

**背景**：

条件类型是类型层面的 `if`，它让「根据类型不同给出不同类型」成为可能。分布式是它的一个特殊行为，也是写工具类型时最容易踩的地方。

**原理**：

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<'a'>;        // true
type B = IsString<1>;          // false
type C = IsString<'a' | 1>;    // true | false —— 分发了
```

分发规则：`T` 是「裸」的类型参数（没被包裹）且传入联合时，会对每个成员分别求值，再合并结果。

**细节**：

**阻止分发**：用元组包一层。

```ts
type IsString<T> = [T] extends [string] ? true : false;
type C = IsString<'a' | 1>;    // false —— 不再分发
```

**`never` 是特例**：分发到空联合，结果还是 `never`。

**过滤的经典用法**：

```ts
type ExtractString<T> = T extends string ? T : never;
type R = ExtractString<'a' | 1 | 'b'>;   // 'a' | 'b'

type ExcludeNumber<T> = T extends number ? never : T;
type R2 = ExcludeNumber<'a' | 1>;        // 'a'
```

内置的 `Exclude` 和 `Extract` 就是这么实现的。

**`boolean` 会分发**：因为 `boolean` 本质是 `true | false`。

**面经**：暂无已核对的公开原题。

### 28.`infer`

**一句话**：在条件类型里就地声明一个类型变量，让编译器从结构里推出来。

**背景**：

条件类型能判断「是不是某个形状」，但光判断不够——你还想「如果是，把里面的类型抽出来」。`infer` 就是干这个的。

所有「从容器里取类型」的工具都是 `infer` 的应用：数组元素、Promise 结果、函数参数、函数返回值。

**原理**：

```ts
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;
type E = ElementOf<string[]>;      // string

type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T;
type R = Unwrap<Promise<Promise<number>>>;   // number
```

`infer U` 声明了一个新的类型变量，编译器会尝试用实际类型去匹配 `infer U` 的位置，把匹配到的部分赋给 `U`。

**细节**：

**多个 `infer`**：

```ts
type Pair<T> = T extends [infer A, infer B] ? [B, A] : never;
type R = Pair<[string, number]>;   // [number, string]
```

**`infer` 加约束**：`infer U extends string` 要求推出来的类型满足约束。

**递归**：`Awaited` 就是递归实现的。递归有深度上限，太深会报「类型实例化过深」。

**在函数类型上**：

```ts
type Params<F> = F extends (...args: infer P) => any ? P : never;
type Ret<F> = F extends (...args: any) => infer R ? R : never;
```

**面经**：暂无已核对的公开原题。

### 29.模板字面量类型

**一句话**：在类型层面拼字符串，配合联合类型能枚举出所有组合。

**背景**：

前端有大量「字符串有结构」的场景：事件名 `onClick`、CSS 属性、i18n key `user.name`、路由参数 `/user/:id`。

以前这些只能靠运行时校验或者手写联合。模板字面量类型让编译器能理解字符串的结构。

**原理**：

```ts
type Event = 'click' | 'focus';
type Handler = `on${Capitalize<Event>}`;   // 'onClick' | 'onFocus'

type Route = `/api/${string}`;
const r: Route = '/api/user';              // OK
const r2: Route = 'user';                  // 报错
```

**细节**：

**四个内置字符串工具**：`Uppercase`、`Lowercase`、`Capitalize`、`Uncapitalize`。

**配合 `infer` 做解析**：

```ts
type ParseRoute<T> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ParseRoute<`/${Rest}`>
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};
```

这是很多路由库的类型实现思路。

**笛卡尔积的风险**：联合类型会被展开成所有组合。`\`${'a'|'b'}${'c'|'d'}\`` 是四个类型，组合多了编译会卡。

**能力边界**：只能做前缀、后缀、简单模式匹配。邮箱、URL 这种复杂格式在类型层面表达不出来，还是得运行时校验。

**面经**：暂无已核对的公开原题。

## 工具类型

### 30.🌟常用工具类型有哪些

**一句话**：`Partial`、`Pick`、`Omit`、`Record`、`Exclude`、`Extract` 是最常用的六个。

**背景**：

工具类型是「类型层面的函数」，把常见变换封装好。理解它们的实现（都是映射类型和条件类型的组合），就不需要背清单。

**原理**：

| 工具类型 | 作用 | 实现 |
| --- | --- | --- |
| `Partial<T>` | 全属性可选 | `{ [K in keyof T]?: T[K] }` |
| `Required<T>` | 去掉可选 | `{ [K in keyof T]-?: T[K] }` |
| `Readonly<T>` | 全属性只读 | `{ readonly [K in keyof T]: T[K] }` |
| `Pick<T, K>` | 挑键 | `{ [P in K]: T[P] }` |
| `Omit<T, K>` | 去键 | `Pick<T, Exclude<keyof T, K>>` |
| `Record<K, V>` | 键值映射 | `{ [P in K]: V }` |
| `Exclude<T, U>` | 联合去成员 | 分布式条件类型 |
| `Extract<T, U>` | 联合留成员 | 分布式条件类型 |
| `NonNullable<T>` | 去 null/undefined | `Exclude<T, null \| undefined>` |
| `ReturnType<F>` | 函数返回类型 | `infer` |
| `Parameters<F>` | 函数参数元组 | `infer` |
| `Awaited<P>` | 拆 Promise | 递归 `infer` |

**细节**：

**`Partial` 是浅的**：只加一层可选，嵌套对象仍然是必填。深度可选要自己写递归。

**`Readonly` 也是浅的**：同样只作用于第一层。

**`Record` 和索引签名的区别**：`Record<'a' | 'b', number>` 生成具体的两个键，`{ [k: string]: number }` 是任意字符串键。

**面经**：牛客 · 2023 前端 TS 真题合集列了一整套内置高级类型，包括 `Exclude`、`Omit`、`Readonly`、`Pick`、`NonNullable`，还提到 `Merge`、`Compute`、`Intersection` 这类社区类型。https://www.nowcoder.com/discuss/517852889394446336

### 31.🌟`Omit` 和 `Pick` 哪个更安全

**一句话**：`Pick` 更安全；`Omit` 的键写错时不报错。

**背景**：

这是个很实际的问题：`Omit<User, 'age'>` 里的 `'age'` 如果拼错成 `'aeg'`，会发生什么？

答案是：什么都不发生，你得到一个和 `User` 一样的类型。这个静默失败在重构时很危险。

**原理**：

`Omit` 的定义：

```ts
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

注意 `K` 的约束是 `keyof any`（也就是 `string | number | symbol`），不是 `keyof T`。

所以 `Omit<User, 'notExist'>`：
1. `Exclude<keyof User, 'notExist'>` = `keyof User`（什么都没排除）
2. `Pick<User, keyof User>` = `User`

结果就是原类型，没有任何错误提示。

而 `Pick<T, K extends keyof T>` 的 `K` 受 `keyof T` 约束，写错直接报错。

**细节**：

**为什么 `Omit` 不设计成受约束**：因为它常用于联合类型，而联合的 `keyof` 只取公共键。加约束会限制用法。这是权衡。

**怎么补救**：定义严格版本：

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

**用类型测试兜底**：

```ts
type _Check = Omit<User, 'age'> extends { age: never } ? never : true;
```

这行在 `Omit` 真的删掉了 `age` 时通过，否则报错。

**面经**：字节 · 番茄二面：怎么删掉接口的某个属性。https://www.nowcoder.com/discuss/889546972099584000

### 32.`ReturnType` 和 `Parameters`

**一句话**：用条件类型加 `infer`，从函数类型里抽返回值或参数元组。

**原理**：

```ts
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type MyParameters<T> = T extends (...args: infer P) => any ? P : never;
```

`infer R` 匹配返回值位置，`infer P` 匹配参数位置（参数是元组）。

**细节**：

**重载函数只取最后一个签名**：这是已知限制。

**泛型函数会得到 `unknown`**：

```ts
function identity<T>(x: T): T { return x; }
type R = ReturnType<typeof identity>;   // unknown，不是 T
```

因为泛型还没实例化，编译器不知道 `T` 是什么。

**`Awaited` 是递归版**：

```ts
type MyAwaited<T> = T extends Promise<infer U> ? MyAwaited<U> : T;
```

**面经**：暂无已核对的公开原题。

### 33.`Record` 和索引签名

**一句话**：对 `string | number | symbol` 的键两者等价，但 `Record` 能表达具体的键联合。

**原理**：

```ts
type A = Record<string, number>;          // { [k: string]: number }
interface B { [k: string]: number }       // 一样

type C = Record<'a' | 'b', number>;       // { a: number; b: number }
```

**细节**：

**索引签名的宽松性**：读不存在的键返回 `V`，不是 `V | undefined`。这是历史设计，`noUncheckedIndexedAccess` 就是为了修这个。

**`Record` 不能声明合并**：它是类型别名，`interface` 才能合并。

**`Record` 的键约束**：`K` 必须是 `string | number | symbol` 的子类型，否则报错。

**面经**：暂无已核对的公开原题。

## 数据类型

### 34.数组和元组

**一句话**：数组同类型、长度不定；元组定长、每个位置类型可以不同。

**原理**：

```ts
const arr: number[] = [1, 2, 3];
const tuple: [string, number] = ['a', 1];
const rest: [string, ...number[]] = ['a', 1, 2];
const optional: [string, number?] = ['a'];
```

元组的长度是类型的一部分，`tuple[2]` 直接报错。

**细节**：

**元组的实际用途**：函数返回多值、`useState` 返回 `[value, setValue]`、`Object.entries` 的结果、`Promise.all` 的结果。

**`as const` 生成元组**：`[1, 2] as const` 是 `readonly [1, 2]`。

**可变元组**：`[string, ...number[]]` 表示第一个是 string，后面任意个 number。这在写可变参数函数时有用。

**面经**：牛客 · 2023 前端 TS 真题合集把「数组、元组」列在用户定义类型里。https://www.nowcoder.com/discuss/517852889394446336

### 35.`Map`、`Set` 和对象、数组

**一句话**：键是任意值、需要频繁增删用 `Map`；只需要去重和成员判断用 `Set`；结构化配置用对象。

**对照表**：

| | 键类型 | 顺序 | 查找 | 适用 |
| --- | --- | --- | --- | --- |
| 对象 | `string \| number \| symbol` | 插入序（数字键特殊） | 哈希 | 结构化配置 |
| `Map` | 任意值 | 严格插入序 | 哈希 | 频繁增删 |
| 数组 | 索引 | 有序 | O(n) | 有序列表 |
| `Set` | — | 插入序 | 哈希 | 去重 |

**细节**：

**`Map` 的键按引用比**：两个内容相同的对象是两个不同的键。

**`WeakMap` 是弱引用**：键被回收后条目自动消失，不可遍历、没有 `size`。适合给对象挂私有数据。

**`Set` 去重规则**：SameValueZero，`NaN` 能去重，`-0` 和 `0` 视为同一个。

**面经**：暂无已核对的公开原题。

### 36.`readonly` 数组

**一句话**：`readonly T[]` 禁止所有变异方法，是真正的只读视图。

**原理**：

```ts
function sum(xs: readonly number[]) {
  xs.push(4);        // 报错
}

const a: readonly number[] = [1, 2, 3];
const b: number[] = [1, 2, 3];

const c: readonly number[] = b;   // OK，普通能赋给只读
const d: number[] = a;            // 报错
```

**细节**：

**为什么只读参数更安全**：因为数组是协变的，函数里如果可以 `push`，就会往 `Dog[]` 里塞进 `Animal`。`readonly` 禁止了这条路径。

**浅只读**：`readonly T[][]` 只禁止改外层。

**`ReadonlyArray<T>` 和 `readonly T[]` 完全等价**，后者是语法糖。

**面经**：暂无已核对的公开原题。

### 37.`bigint` 和浮点数

**一句话**：`number` 是双精度浮点，超过 2^53-1 就不精确；要精确大整数用 `bigint`。

**原理**：

```ts
0.1 + 0.2 === 0.3;          // false
Number.MAX_SAFE_INTEGER;    // 9007199254740991
9007199254740993n;          // bigint 字面量
```

浮点误差的根源是二进制无法精确表示 0.1 这类十进制小数。

**细节**：

**金额别用 `number`**：用整数分（`1999` 表示 19.99 元）或者字符串。

**`bigint` 的限制**：不能和 `number` 混算，不能用于 `Math`，`JSON.stringify` 会抛错。

**接口返回大整数 ID**：`JSON.parse` 会丢精度。解法是后端返回字符串，或者用能保留大整数的解析器。

**面经**：字节后端一面出现过类似场景：大整数 ID 用 `map[string]interface{}` 反序列化后再序列化，精度丢失。https://segmentfault.com/a/1190000045455181

## 错误处理

### 38.🌟TS 里怎么做错误处理

**一句话**：`throw` 可以抛任何值，所以 `catch` 是 `unknown`，必须先收窄。

**背景**：

Java 有 checked exception，函数签名里声明抛什么，编译器强制你处理。TS 没有这个机制——函数签名不写异常，调用方也不知道可能抛错。

而且 JS 允许 `throw` 任何值（字符串、数字、对象），所以 `catch` 拿到的类型只能是 `unknown`。

**原理**：

```ts
try {
  await doSomething();
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message, e.stack);
  } else {
    console.error('非 Error 抛出', e);
  }
}
```

`useUnknownInCatchVariables`（TS 4.4 起默认）让 `e` 是 `unknown`，强制你先判断。

**细节**：

**继承 `Error` 时要设 `name`**：

```ts
class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';    // 不设的话 name 还是 'Error'
  }
}
```

**`instanceof` 跨 realm 不可靠**：不同 iframe 的 `Error` 是不同构造函数。要判断用 `e && typeof e === 'object' && 'message' in e`。

**`cause` 字段**：ES2022 支持 `new Error('msg', { cause: original })`，能形成错误链。

**面经**：暂无已核对的公开原题。

### 39.判别联合做错误返回

**一句话**：把错误变成返回值，调用方必须显式处理。

**背景**：

`throw` 的问题是可以被忽略——不写 `try` 也能跑，错误在运行时才暴露。

判别联合把错误变成类型的一部分，编译器强制你处理。

**原理**：

```ts
type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

function parse(s: string): Result<number> {
  const n = Number(s);
  return Number.isNaN(n)
    ? { ok: false, error: new Error('NaN') }
    : { ok: true, data: n };
}

const r = parse('1');
if (r.ok) {
  r.data;      // number
} else {
  r.error;     // Error
}
```

**细节**：

**优势**：错误是值，能组合、能 map、能链式处理。这是 Rust 的 `Result`、Haskell 的 `Either` 的思路。

**劣势**：每层都要手动传递，代码啰嗦；和抛异常的第三方库不兼容。

**实践**：业务上可预期的失败用 `Result`，真正的异常（网络断开、断言失败）用 `throw`。

**面经**：暂无已核对的公开原题。

## 装饰器

### 40.🌟装饰器是什么

**一句话**：挂在类、方法、属性、参数上的元编程钩子，编译期改写成包装调用。

**背景**：

装饰器来自「横切关注点」的需求：日志、鉴权、缓存这些逻辑不该散落在每个方法里。

Java 用 AOP 解决（切点表达式 + 动态代理），TS 用装饰器——在声明处标记，编译时改写。

**原理**：

```ts
function log(target: any, key: string, desc: PropertyDescriptor) {
  const original = desc.value;
  desc.value = function (...args: unknown[]) {
    console.log(`call ${key}`, args);
    return original.apply(this, args);
  };
}

class Service {
  @log
  handle(req: Request) { /* ... */ }
}
```

编译后，`@log` 变成一次函数调用，把原来的方法包起来。

**两套装饰器**：

| | 旧（experimental） | 新（TC39 Stage 3） |
| --- | --- | --- |
| 开关 | `experimentalDecorators: true` | TS 5.0 起默认 |
| 参数装饰器 | 支持 | 不支持 |
| 类型元数据 | `emitDecoratorMetadata` | 不支持 |
| 使用者 | NestJS、TypeORM、Angular 旧版 | 新写法 |

**细节**：

**执行顺序**：同一目标上多个装饰器，求值从上往下、应用从下往上；方法装饰器先于类装饰器；参数装饰器最先。

**TS 没有 Java 那种反射**：它只是按约定发出 `design:paramtypes` 元数据，再由 `reflect-metadata` 读出来。所以「TS 有反射吗」的答案是：语言本身没有，靠装饰器元数据模拟。

**NestJS 为什么还停在旧装饰器**：它的依赖注入靠构造函数参数类型，而参数类型和参数装饰器恰好是 Stage 3 不支持的两样。维护者的公开立场是短期不会换。

**面经**：字节 · 前端一面（75 分钟）问过装饰器。https://www.nowcoder.com/discuss/799382455135293440

## 工程实践

### 41.`strict` 打开了哪些

**一句话**：一组开关的合集，最重要的是 `strictNullChecks` 和 `noImplicitAny`。

**清单**：

| 选项 | 作用 |
| --- | --- |
| `strictNullChecks` | `null` / `undefined` 不能赋给其他类型 |
| `noImplicitAny` | 推断不出类型时不允许默默当 `any` |
| `strictFunctionTypes` | 函数参数逆变检查 |
| `strictPropertyInitialization` | 类属性必须初始化 |
| `strictBindCallApply` | `bind` / `call` / `apply` 参数检查 |
| `alwaysStrict` | 输出 `"use strict"` |
| `useUnknownInCatchVariables` | `catch` 变量是 `unknown` |

**细节**：

**渐进迁移**：先开 `noImplicitAny`（改动最集中），再开 `strictNullChecks`（改动最多但收益最大）。

**`strictPropertyInitialization` 的绕法**：构造函数里赋值、用 `!` 断言、或者给默认值。最稳的是构造函数赋值。

**面经**：牛客 · 2023 前端 TS 真题合集把「ts 配置」列为独立知识点。https://www.nowcoder.com/discuss/517852889394446336

### 42.`d.ts` 文件

**一句话**：只包含类型声明、不含实现，给 JS 代码或外部模块提供类型。

**三种用途**：

1. 给纯 JS 库补类型。
2. 声明全局变量。
3. 声明非代码资源（`.css`、`.svg`、`.png`）。

**原理**：

```ts
// global.d.ts
declare global {
  interface Window {
    __APP_CONFIG__: AppConfig;
  }
}

declare module '*.svg' {
  const content: string;
  export default content;
}
```

**细节**：

**不生效的常见原因**：

- 没在 `include` 里。
- `typeRoots` / `types` 配置排除了它。
- 文件里有 `import` / `export`，导致它变成模块，`declare global` 才能用。

**`declare module` vs `declare global`**：前者声明一个模块的类型，后者扩展全局作用域。

**面经**：牛客 · 2023 前端 TS 真题合集把「声明全局变量、库、.d.ts」列为独立知识点。https://www.nowcoder.com/discuss/517852889394446336

### 43.`import type`

**一句话**：明确表示「只导入类型」，编译后整条 import 消失。

**背景**：

因为类型擦除，纯类型导入在产物里不该存在。但编译器怎么知道一个导入是类型还是值？

`import type` 就是显式标记。配合 `verbatimModuleSyntax`，规则变得明确。

**原理**：

```ts
import type { User } from './types';    // 编译后消失
import { createUser } from './api';     // 编译后保留
import { type User2, createUser2 } from './both';   // 行内标记
```

**细节**：

**不开 `import type` 的风险**：打包器可能保留这条 import，导致「模块不存在」或引入真实的循环依赖。

**和 `isolatedModules` 的关系**：逐文件转译时无法判断导入的性质，只能靠语法标记。所以 `verbatimModuleSyntax` 打开后必须明确写。

**面经**：暂无已核对的公开原题。

### 44.类型测试

**一句话**：用 `expect-type` 或 `@ts-expect-error` 断言类型行为。

**原理**：

```ts
import { expectTypeOf } from 'expect-type';

expectTypeOf<ReturnType<typeof fn>>().toEqualTypeOf<string>();

// @ts-expect-error 这里应该报错
const x: number = 'a';
```

**细节**：

**`@ts-expect-error` vs `@ts-ignore`**：

- `@ts-expect-error`：确实报错时通过，没报错时自己报错。
- `@ts-ignore`：永远通过，测不出东西。

**为什么值得写**：工具类型写错不会报错，只会静默变成 `any` 或 `never`。没有测试兜底，错误会扩散。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应节 |
| --- | --- | --- |
| 美团 · 前端 | 用过 TS 吗，跟 JS 有什么区别 | 1、4 |
| 字节 · 飞书一面 | 平时 JS 多还是 TS 多；TS 常用类型定义 | 1、2 |
| 字节 · 飞书一面 | `interface` 和 `type` 的区别 | 17 |
| 字节 · 飞书一面 | 泛型是什么，解决什么问题 | 22 |
| 字节 · 抖音二面 | `type` 和 `interface` 怎么选 | 17 |
| 字节 · 番茄二面 | 泛型用在哪 | 22 |
| 字节 · 番茄二面 | 怎么删掉接口的某个属性 | 30、31 |
| 字节 · 前端一面（75 分钟） | `keyof` / `typeof` / 装饰器 | 25、40 |
| 字节 · 前端 | 泛型在函数和类中的应用 | 22 |
| 美团 · 前端 | 泛型是什么，与 any 的差异 | 22 |
| 字节 · 剪映一面 | 联合类型和交叉类型 | 13 |
| 字节 · 剪映一面 | `this`、`call` / `apply` / `bind` | 7 |
| 字节 · 剪映二面 | 原型链 | 8 |
| 京东 · 暑期 / 腾讯 · 提前批 | `any` 和 `unknown` 的区别 | 12 |
| 牛客 · 2023 TS 真题合集 | `any` / `unknown` / `never` / `void`、`interface` / `type`、高级类型、`keyof` / `typeof`、协变逆变、类型兼容性、`d.ts` | 9、12、13、17、18、19、20、21、24、25、30、34、41、42 |

来源：

- 27 届前端高频 https://www.nowcoder.com/discuss/889546972099584000
- 字节飞书一面 https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 字节 75 分钟 https://www.nowcoder.com/discuss/799382455135293440
- 剪映一面 https://www.nowcoder.com/discuss/839496349576855552
- 美团 TS 题解析 https://mianshidashi.cn/interview-questions/meituan/frontend-engineer/typescript-vs-javascript-difference
- 牛客 2023 TS 真题合集 https://www.nowcoder.com/discuss/517852889394446336
- 字节泛型题 https://www.upcv.tech/mianshi/xuanpai-company-cmlami120094r9k42nkxfd8j4/q-qbi_question_39fe9c3e67eff1ae4759ee82db4c4f6e.html
- 美团泛型题 https://www.upcv.tech/mianshi/xuanpai-company-cmlake0rh03p99k42wmyp81vr/q-qbi_question_5fa3ef93122785e632903bda9c6ca352.html

## 这一篇没写的东西

- **事件循环**：浏览器篇。
- **`Array` / `Map` / `Set` 的完整 API**：只在第 35 节讲选型。
- **TS 编译器内部实现**：只在第 3 节讲版本分界。
- **React / Vue 的类型集成**：属于框架篇。
- **运行时校验库的具体用法**：属于工具选型。
