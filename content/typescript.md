# TypeScript

对标 Java SE 与集合里属于语言本身的部分。事件循环的细节在浏览器篇，异步 I/O 在 Node 篇。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。带 ⚠️ 的是网上答案普遍过时或写错的地方。

## 概述与编译

### 1.🌟TypeScript 是什么，和 JavaScript 什么关系？

**一句话**：TS 是给 JS 加了一套静态类型系统，编译期把类型检查掉，产出的还是普通 JS。

**展开**：

1. TS 是 JS 的**类型化超集**。任何合法的 JS 都是合法的 TS，只是可能报类型错。所以 JS 项目可以渐进迁移，不用推倒重来。
2. 类型只在编译期存在，运行时没有「TS 引擎」这回事。浏览器和 Node 都不认 `.ts`。
3. 类型检查与代码生成是两件事。`tsc --noEmit` 只检查不产出；打包器能直接吃 `.ts` 也是因为只剥类型、不检查。
4. 设计目标是「大规模 JS 工程的可维护性」，不是「更安全的运行时」。空值、越界、外部数据不可信，这些仍然靠你自己。

**工程收益要说得出四条**，不能只说「能发现类型错误」：

1. **编辑器能力**：自动补全、跳转定义、重命名重构，这些在纯 JS 里靠猜。
2. **接口契约**：函数签名就是文档，调用方和实现方的约定写死在类型里。
3. **重构安全**：改一个字段名，所有引用点立刻报错。
4. **协作成本**：新人读代码不用靠猜参数是什么形状。

**追问：为什么不直接用 JS 加 JSDoc？** JSDoc 能表达的类型有限，写泛型和条件类型非常别扭，而且类型信息散在注释里、和实现分离。TS 的语法更紧凑，工具链支持也更完整。JSDoc 现在的定位是「给还没迁移的 JS 文件补类型」。

**追问：TS 能保证运行时安全吗？** 不能。类型是编译期的承诺，外部数据进来（JSON、接口返回、`localStorage`、URL 参数）不会被校验。`JSON.parse(s) as User` 只是让编译器闭嘴。要运行时安全得靠 schema 校验（zod、valibot）或手写守卫。

**追问：TS 能替代单元测试吗？** 不能。类型约束的是「形状」，测试验证的是「行为」。一个函数类型全对、逻辑全错，TS 拦不住。

**面经**：

- 美团 · 前端：用过 TS 吗，跟 JS 有什么区别。https://mianshidashi.cn/interview-questions/meituan/frontend-engineer/typescript-vs-javascript-difference
- 字节 · 飞书一面：平时 JS 写得多还是 TS 多；TS 里比较常用的类型定义。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 2.🌟`tsc` 到底做了什么？

**一句话**：两件事——类型检查，然后把 `.ts` 转成 `.js` 和 `.d.ts`。

**展开**：

1. 流程：解析成 AST → 绑定符号 → 类型检查 → 生成目标 JS（按 `target` 降级语法）。
2. `target` 决定降级到哪个 ES 版本，`lib` 决定能用哪些内置类型定义，`module` 决定模块格式。
3. `declaration: true` 才会生成 `.d.ts`，库作者需要，业务项目通常不需要。
4. `tsc` 不做打包、不做压缩、不做 tree shaking。那些是 bundler 的活。

**追问：`target` 和 `lib` 有什么区别？** `target` 管「语法能降级到什么程度」，比如箭头函数要不要转成 `function`；`lib` 管「类型定义里有哪些 API」，比如能不能用 `Promise`。两者独立，可以 `target: ES5` 配 `lib: ["ES2022", "DOM"]`。这就是「语法我降级了，但我知道运行环境有 Promise」的写法。

**追问：为什么 `tsc` 编译慢？** 它要构建整个程序的类型图，包含所有依赖的 `.d.ts`。项目大了以后类型检查是瓶颈，所以有了 `skipLibCheck`（跳过 `.d.ts` 检查）、项目引用（project references，增量编译）、以及 TS 7 的 Go 原生实现。

**追问：`include` / `exclude` / `files` 什么关系？** `files` 是精确列表，`include` 是 glob 模式，`exclude` 从 `include` 结果里减掉。`node_modules` 默认被排除，除非显式写进 `files`。

**面经**：字节 · 飞书一面问过 TS 的常用类型定义，属于同一组基础题。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 3.⚠️TypeScript 的编译器是什么写的？

**一句话**：原来是自己写的自举实现，**7.0 起是 Go 重写的原生端口**，命令还是 `tsc`。

**展开**：

1. TS 7.0（2026-07）把编译器移植到 Go，官方给的全量构建提速在 8–12 倍，靠的是原生代码和共享内存多线程。
2. 安装方式没变，还是 `npm i -D typescript`，拿到的还是 `tsc`。
3. 编辑器侧改用 LSP（语言服务器协议），VS Code 有专门的扩展。
4. 移植目标是与旧实现保持行为一致，不是顺手加新特性。

**⚠️ 别答错**：说「TypeScript 编译器是 Node 写的」或者「用 TS 自己写的」都过时了。更稳的说法是「历史上是自举的 TS/JS 实现，7.0 起是 Go 原生端口」。

**追问：新编译器会不会不支持某些旧选项？** 官方在 release notes 里说明支持范围。`emitDecoratorMetadata` 这类依赖旧编译器内部管线的特性是社区最担心的点（NestJS 依赖它），但官方立场是「等 TS 团队明确说了再动」。

**追问：为什么要用 Go 重写？** 类型检查是 CPU 密集型，且可以并行化（不同文件独立检查）。JS 单线程 + GC 是瓶颈，Go 能直接吃多核。

**面经**：暂无已核对的公开原题。这是个时效题，答对版本分界比背历史更加分。

### 4.🌟什么是类型擦除？

**一句话**：绝大多数类型语法在产物里一点都不剩，包括 `interface`、`type`、类型标注、泛型参数。

**展开**：

1. 所以运行时拿不到泛型实参，不能 `new T()`，不能 `T.name`。
2. 也所以 `instanceof` 一个 interface 是不合法的——interface 在运行时不存在。
3. 想保留类型信息只有两条路：手写类型守卫，或者用装饰器元数据 + `reflect-metadata`。
4. 擦除意味着「类型不影响运行时行为」，所以同一个函数传不同类型的参数，产物代码完全一样。

**追问：`typeof` 在类型位置和值位置有什么不同？** 值位置的 `typeof x` 返回字符串，是运行时的；类型位置的 `typeof x` 是查 `x` 的静态类型，编译后就没了。同名不同义，这是初学者最容易混的点。

**追问：擦除对性能有影响吗？** 没有。类型完全不参与运行时，所以 TS 代码和等价的 JS 跑得一样快。所谓「TS 有性能损耗」是误解，损耗在编译期。

**面经**：美团 · 前端那道「TS 和 JS 的区别」的标准答法里就要求说清「编译后类型大多被擦除，运行时执行的仍是 JavaScript」。https://mianshidashi.cn/interview-questions/meituan/frontend-engineer/typescript-vs-javascript-difference

### 5.⚠️有哪些 TS 语法不会被擦除？

**一句话**：`enum`、`namespace`、参数属性、装饰器——这四样会在产物里留下运行时痕迹。

```ts
enum Color { Red, Green }                       // 产物是一个对象
class A { constructor(private x: number) {} }    // 参数属性生成赋值语句
namespace N { export const a = 1 }               // 产物是一个 IIFE
@dec class B {}                                  // 装饰器有运行时调用
```

**追问：为什么很多项目禁用 `enum`？** 三个原因：

1. 它是唯一会生成运行时代码的类型语法，和「类型零成本」的原则冲突。
2. `const enum` 在 `isolatedModules` 下不能跨包用（因为要内联，需要看到定义）。
3. 数值枚举允许任意数字赋值（`Color[99]` 合法），类型不安全。

替代方案：

```ts
const Color = { Red: 'red', Green: 'green' } as const;
type Color = (typeof Color)[keyof typeof Color];   // 'red' | 'green'
```

**追问：`namespace` 现在还该用吗？** 不该。ESM 出来后它就是历史包袱，新代码用模块。它只在给老代码补类型、或写全局声明（`.d.ts` 里的 `declare namespace`）时还会见到。

**追问：参数属性（`constructor(private x)`）编译后是什么？** 是构造函数体里的 `this.x = x` 加一个类字段声明。它是 TS 的语法糖，JS 里没有对应语法。

**面经**：牛客 2023 前端 TS 真题合集把「TS 中的类型有哪些」列为必答，其中用户定义类型就包含枚举、类、接口、数组、元组。https://www.nowcoder.com/discuss/517852889394446336

### 6.`isolatedModules` 和 `verbatimModuleSyntax` 是干什么的？

**一句话**：保证「一个文件单独剥类型」不改变语义，让打包器（esbuild/SWC）能放心处理 TS。

**展开**：

1. esbuild 这类工具逐文件转译，不建整个程序的类型图。如果某个语法需要跨文件信息才能正确擦除，就会出问题。
2. `isolatedModules: true` 会禁止这类语法：`const enum` 跨文件、只导出类型的 `export { T }`。
3. `verbatimModuleSyntax` 更严格：强制用 `import type` / `export type` 明确标注类型导入，没标的就当值保留。
4. 它取代了已废弃的 `importsNotUsedAsValues`，解决「运行时 import 了一个不存在的模块」的问题。

**追问：为什么 Vite 项目必须开 `isolatedModules`？** 因为 Vite 开发时不做类型检查，靠 esbuild 逐文件转译。不开的话会出现「本地 `tsc` 能过、Vite 构建报错」或反过来的割裂。

**追问：`verbatimModuleSyntax` 会不会要求我改写所有导入？** 会。开了之后所有纯类型导入必须写 `import type`，这是个不小的迁移量。但它能避免「导入被静默删除导致副作用丢失」和「导入被保留导致运行时找不到模块」两类问题。

**面经**：暂无已核对的公开原题。

## 语言基础：闭包、this、原型链

这三样是 JS 的底，类型题常从这里起手。只答到能接住下一问，事件循环去浏览器篇。

### 7.🌟闭包是什么，用在哪？

**一句话**：函数记住了它被创建时所在的作用域，即使那个作用域已经执行完，里面的变量也还能被访问。

```ts
function counter() {
  let n = 0;              // 被闭包留住，不随函数返回而销毁
  return () => ++n;
}
const c = counter();
c(); c();                 // 1 2
```

**展开**：

1. 闭包不是语法特性，是作用域链的必然结果：函数对象持有对外层环境的引用。
2. 常见用途：私有状态、回调里保留上下文、柯里化、防抖节流里存 timer、React 的 Hooks 全靠闭包。
3. 代价：被引用的变量逃逸到堆上，回收不掉就是内存泄漏。典型是监听器持有大对象、监听又没解绑。

**追问：闭包会造成内存泄漏吗？** 会，但不是闭包本身的错。只要闭包还活着，它引用的变量就回收不掉。所以「用完就解绑监听」「长生命周期的回调里别捕获大对象」是纪律。

**追问：循环里创建闭包，为什么以前打印出来都一样？** `var` 是函数作用域，整个循环共用一个变量；`let` 是块作用域，每轮新建。这个差异在 Go 里也存在：Go 1.22 之前循环变量整个循环一个，1.22 起才改成每轮新建，见 Go 篇。

**追问：闭包和柯里化什么关系？** 柯里化靠闭包实现：每次返回一个新函数，记住之前传的参数。`const add = (a) => (b) => a + b` 里 `a` 就是被闭包留住的。

**面经**：

- 27 届暑期前端汇总把闭包、`this`、原型链列为 JS 基础前几题，字节、百度、快手都问。https://www.nowcoder.com/discuss/889546972099584000
- 字节 · 剪映一面：JS 异步、单线程、事件循环、栈和堆、`this`、`call` / `apply` / `bind` 连着问。https://www.nowcoder.com/discuss/839496349576855552

### 8.🌟`this` 的指向怎么确定？

**一句话**：不看函数在哪定义，看它怎么被调用。箭头函数除外，它没有自己的 `this`，用定义时外层的。

四种绑定，优先级从高到低：

1. `new` 调用：`this` 是新对象。
2. 显式绑定：`call` / `apply` / `bind`。
3. 方法调用：`obj.fn()`，`this` 是 `obj`。
4. 默认绑定：裸调用，严格模式是 `undefined`，非严格是全局对象。

```ts
const obj = { name: 'a', hi() { return this.name } };
const f = obj.hi;
f();            // undefined —— 丢了接收者
obj.hi();       // 'a'
```

**追问：`call`、`apply`、`bind` 有什么区别？** `call` 立即执行、参数逐个传；`apply` 立即执行、参数传数组；`bind` 不执行，返回一个绑定好 `this` 的新函数。三者都能传第一个参数指定 `this`。

**追问：React 里为什么以前要 `bind(this)`，现在不用了？** 类组件的方法默认没绑定，回调传出去就丢了 `this`。函数组件没这个问题，但换成了闭包旧值问题，见 React 篇。

**追问：`bind` 之后再 `call` 能改吗？** 不能，新函数的 `this` 已经固定。`bind` 返回的是一个绑定过的函数。

**追问：箭头函数能当构造函数吗？** 不能。它没有 `[[Construct]]`，`new (() => {})` 会抛错。也没有 `arguments`、没有 `prototype`。

**面经**：字节 · 剪映一面问过 `this`、`call` / `apply` / `bind` 的区别。https://www.nowcoder.com/discuss/839496349576855552

### 9.🌟原型链是什么？

**一句话**：对象有一个内部链接指向它的原型对象，找属性时顺着这条链往上找，直到 `null`。

```ts
function Person(name) { this.name = name }
Person.prototype.say = function () { return this.name };
const p = new Person('x');
p.say();
Object.getPrototypeOf(p) === Person.prototype;  // true
```

**展开**：

1. `new` 做四件事：建空对象 → 原型指向 `F.prototype` → 执行构造函数、`this` 指向新对象 → 构造函数返回对象就用返回值，否则返回新对象。
2. `class` 是语法糖，但三处不同：不能当普通函数调用、方法不可枚举、子类 `super` 有明确规则。
3. `__proto__` 是访问器，`Object.getPrototypeOf` 才是标准 API；`prototype` 是函数才有的属性，别混。
4. `instanceof` 就是沿原型链找 `F.prototype`。

**追问：`Object.create(null)` 有什么用？** 没有原型的字典对象，不会撞上 `toString`、`__proto__`。做映射表更安全。

**追问：怎么实现继承？** ES6 用 `class extends`，底层还是原型链：子类原型的 `__proto__` 指向父类原型，子类本身的 `__proto__` 指向父类。手写的话是「原型链继承 + 构造函数借调」组合，也就是 `Object.create(Super.prototype)` 加 `Super.call(this)`。

**追问：原型链太长有什么问题？** 属性查找变慢（每层都要查）、容易踩原型污染（`Object.prototype` 被改，全站受影响）。所以业务对象尽量用 `Object.create(null)` 或 `Map`。

**面经**：字节 · 剪映二面问过原型链。https://www.nowcoder.com/discuss/839496349576855552

### 10.基本类型和引用类型有什么区别？

**一句话**：基本类型按值存，赋值时复制值；引用类型存的是地址，赋值时复制地址，两个变量指向同一个对象。

**展开**：

1. 七个基本类型：`string`、`number`、`boolean`、`null`、`undefined`、`symbol`、`bigint`。其余都是对象。
2. 判等：基本类型比内容，对象比地址。所以两个内容相同的对象 `===` 是 `false`。
3. 函数传参一律按值，但传对象时「值」是地址，所以函数里改属性外面看得到，重新赋值外面看不到。
4. 基本类型没有方法，`'abc'.toUpperCase()` 是临时装箱。

**追问：`typeof null` 为什么是 `'object'`？** 历史遗留 bug：早期实现用低位标记类型，`null` 的表示是全零，被识别成 object。修不了，会破坏太多现有代码。

**追问：`NaN` 和 `-0` 有什么坑？** `NaN !== NaN`，判断要用 `Number.isNaN`。`Object.is(-0, 0)` 是 `false`，而 `-0 === 0` 是 `true`。所以 React 的 `Object.is` 比较和 `===` 在这些边界上不同。

**面经**：牛客 2023 前端 TS 真题合集把「TypeScript 中的类型有哪些」列为必答，要求区分内置类型和用户定义类型。https://www.nowcoder.com/discuss/517852889394446336

### 11.`==` 和 `===` 的区别？

**一句话**：`===` 要求类型和值都相同，`==` 会先做类型转换再比。日常一律用 `===`。

**展开**：

1. `==` 的转换规则：`null == undefined` 为 `true`，其他情况倾向转成数字再比。
2. 经典的坑：`[] == false` 为 `true`，`'' == 0` 为 `true`，`null == 0` 为 `false`。
3. 唯一推荐用 `==` 的场景是 `x == null`，它同时覆盖 `null` 和 `undefined`。

**追问：对象比较时 `==` 和 `===` 一样吗？** 一样，都比地址。因为对象转基本类型需要 `valueOf` / `toString`，而 `===` 不转换，直接比引用。

**追问：TS 里 `==` 会被 lint 拦住吗？** 会，`eqeqeq` 规则默认禁 `==`，只允许 `== null`（配 `smart` 或 `allow-null` 选项）。这是团队规范问题，不是语言问题。

**面经**：暂无已核对的公开原题。

### 12.深浅拷贝怎么实现，各有什么坑？

**一句话**：浅拷贝只复制第一层，嵌套对象还是共享的；深拷贝要递归到底，最稳的是 `structuredClone`。

```ts
const shallow = { ...obj };              // 浅
const deep = structuredClone(obj);       // 深，支持循环引用
const json = JSON.parse(JSON.stringify(obj));  // 深，但有损
```

**展开**：

1. `JSON` 方案的坑：丢 `undefined`、丢函数、`Date` 变字符串、`Map` / `Set` 变空对象、`NaN` 变 `null`、循环引用直接抛错、`bigint` 直接抛错。
2. `structuredClone` 是浏览器内置，支持 `Map`、`Set`、`Date`、`ArrayBuffer`、循环引用，但不支持函数和原型链。
3. `Object.assign` 和展开都是浅的，只能复制可枚举自有属性。
4. 需要保留原型链和方法的场景，只能手写递归或者用专门的库。

**追问：为什么 `Object.assign` 复制不到原型上的方法？** 因为它只复制自有可枚举属性。类的方法在 `prototype` 上，不可枚举，所以复制丢了。

**追问：`structuredClone` 有兼容性问题吗？** 有，它是 2022 年才普及的，老浏览器要 polyfill 或者用 `lodash.cloneDeep`。

**面经**：暂无已核对的公开原题。

## 类型系统基础

### 13.🌟`any`、`unknown`、`never` 分别什么时候用？

**一句话**：要答可赋值方向，不能只背中文名。

| 类型 | 能接收什么 | 能赋给谁 | 用在哪 |
| --- | --- | --- | --- |
| `any` | 任何值 | 任何类型 | 逃生舱，会污染下游 |
| `unknown` | 任何值 | 只能给 `unknown` / `any`，用前必须收窄 | 外部输入（JSON、`catch`） |
| `never` | 什么都接收不了 | 能赋给任何类型 | 穷尽检查、永不返回的函数 |
| `void` | — | — | 函数无返回值 |

**展开**：

1. `any` 会「传播」：任何碰到 `any` 的运算结果还是 `any`，整条链路失去检查。这是它最大的危害，比「不检查」更糟——它让下游也失去检查。
2. `unknown` 是类型安全的 `any`：能装任何值，但用之前必须证明它是什么。
3. `never` 是底类型，代表「不可能有值」。它出现在两个地方：永不返回的函数，和条件类型的分支。
4. `void` 和 `never` 的区别：`void` 是「有返回，但值是 undefined 或调用方不该用」；`never` 是「根本没有返回值」。

```ts
function assertNever(x: never): never { throw new Error(String(x)) }

type Shape = { kind: 'circle' } | { kind: 'square' };
function area(s: Shape) {
  switch (s.kind) {
    case 'circle': return 1;
    case 'square': return 2;
    default: return assertNever(s);   // 以后加了新形状，这里编译不过
  }
}
```

**追问：`catch` 的变量为什么是 `unknown`？** `useUnknownInCatchVariables` 打开后，`catch (e)` 的 `e` 是 `unknown`——JS 里可以 `throw` 任何东西，不一定是 `Error`。

**追问：怎么把 `unknown` 收窄成具体类型？** 用 `typeof`、`instanceof`、`in`、类型谓词、或者用 schema 校验库（zod）直接 parse。断言（`as`）也能过编译，但运行时出错它不负责。

**面经**：

- 牛客 2023 前端 TS 真题合集：`any` 和 `unknown` 有什么区别；`never` 和 `void` 的区别。https://www.nowcoder.com/discuss/517852889394446336
- 京东 · 暑期 / 腾讯 · 提前批：`any` 和 `unknown` 的区别。https://www.nowcoder.com/discuss/889546972099584000

### 14.🌟类型收窄有哪几种手段？

**一句话**：`typeof`、`instanceof`、`in`、判别联合的字面量字段、`Array.isArray`、类型谓词、断言函数、真值判断。

```ts
function f(x: string | number) {
  if (typeof x === 'string') x.toUpperCase();     // typeof
}

type Result = { ok: true; data: string } | { ok: false; error: Error };
function handle(r: Result) {
  if (r.ok) return r.data;                         // 判别联合
  return r.error;
}

function isString(x: unknown): x is string {       // 类型谓词
  return typeof x === 'string';
}

function assertNum(x: unknown): asserts x is number {  // 断言函数
  if (typeof x !== 'number') throw new TypeError('not a number');
}
```

**展开**：

1. `!= null` 同时排除 `null` 和 `undefined`，比 `!== undefined` 更实用。
2. `in` 适合区分有不同字段的对象，但要注意它会查到原型链。
3. 判别联合最好用一个字面量字段（`kind` / `type` / `ok`），比 `in` 更稳。
4. `instanceof` 只对类有效，对 interface 和 type 无效（运行时不存在）。

**追问：类型谓词是安全的吗？** 不安全。`x is string` 只是你对编译器的承诺，写错了不报错。所以谓词函数体要老实检查，不能 `return true as any`。

**追问：收窄在哪些位置失效？** 回调函数里、`setTimeout` 里、`await` 之后——因为编译器无法保证收窄的条件在异步执行时仍然成立。解法是把收窄后的值存进变量，或者重新判断。

**面经**：牛客 2023 前端 TS 真题合集问了「如何将 unknown 类型指定为一个更具体的类型」，标准答法是 `typeof` 判断或类型断言（并提醒断言错了运行时才报错）。https://www.nowcoder.com/discuss/517852889394446336

### 15.字面量类型和 `as const` 有什么用？

**一句话**：`as const` 把值收窄到最窄的字面量，同时把对象变只读、数组变只读元组。

```ts
const a = { kind: 'circle' };        // kind: string
const b = { kind: 'circle' } as const;  // kind: 'circle'

const arr = [1, 2] as const;  // readonly [1, 2]
```

**展开**：

1. 不加 `as const`，对象的属性会被拓宽成 `string`，判别联合就失效了。
2. 数组不加会推成 `number[]`，加了是只读元组，长度和每个位置都固定。
3. 它和类型标注的区别：标注是「告诉编译器这是什么」，`as const` 是「让它保持最窄」。

**追问：`as const` 和 `readonly` 有什么区别？** `as const` 是值层面的断言，同时收窄字面量和加只读；`readonly` 是类型层面的修饰，只加只读，不收窄。

**追问：`as const` 之后还能改吗？** 编译期不能，运行时的对象也没冻结（`Object.freeze` 才冻结）。所以它只是类型约束，不防运行时篡改。

**面经**：暂无已核对的公开原题。

### 16.`satisfies` 解决什么问题？

**一句话**：校验值符合某个类型，但**不**把值的类型拓宽成那个类型。

```ts
const routes = {
  home: '/',
  user: '/user/:id',
} satisfies Record<string, `/${string}`>;

routes.home.toUpperCase();       // 仍然是 '/' 这个字面量类型
// 写成 const routes: Record<string, string> = {...}
// 键就丢了，routes.home 变成 string
```

**追问：和 `as` 的区别？** `as` 是断言，只改编译器看到的类型，不做校验；`satisfies` 是校验，值本身类型不变。

**追问：什么时候必须用它？** 想「既校验形状、又保留具体键和字面量」时。典型是路由表、配置对象、主题色板、i18n 的 key 表。

**面经**：暂无已核对的公开原题。

### 17.`null` 和 `undefined` 在严格模式下怎么处理？

**一句话**：`strictNullChecks` 打开后，`null` 和 `undefined` 不再能赋给其他类型，必须显式写进联合。

**展开**：

1. `strictNullChecks` 是 `strict` 的一部分。关掉时 `null` 能赋给 `string`，等于放弃了空值检查。
2. 可选属性 `a?: T` 实际类型是 `T | undefined`，不是「不存在」。
3. 可选链 `a?.b` 遇到 `null` / `undefined` 返回 `undefined`；空值合并 `a ?? b` 只在 `null` / `undefined` 时取右边（`||` 会把 `0`、`''`、`false` 也当假值）。

**追问：`!` 非空断言危险在哪？** 它只是让编译器闭嘴，运行时该是 `undefined` 还是 `undefined`。团队里应该限制使用，或者配 ESLint 规则（`no-non-null-assertion`）。

**追问：可选属性 `a?: T` 和 `a: T | undefined` 一样吗？** 不完全一样。`a?: T` 允许**不写**这个属性，`a: T | undefined` 要求写、但值可以是 undefined。在 `exactOptionalPropertyTypes` 打开后区别更明显。

**面经**：暂无已核对的公开原题。

## 结构类型：interface、type 与类

### 18.🌟`type` 和 `interface` 怎么选？

**一句话**：能描述对象形状就用 `interface`，需要联合、交叉、映射、条件类型时用 `type`。多数场景可互换。

四条差别：

1. **声明合并**：同名 `interface` 自动合并，适合给第三方库补类型；同名 `type` 直接报错。
2. **能表达什么**：`interface` 只能描述对象/函数/类形状；`type` 还能是联合、元组、字面量、条件类型。
3. **报错位置**：`interface` 的错更接近声明处；`type` 的联合出错会摊开一大片。
4. **编译性能**：极深的递归类型用 `interface` 更容易被缓存，`type` 的组合可能变慢。这是实践结论，不是语言规定。

```ts
interface A { a: string }
interface A { b: number }               // 合并成 { a, b }
type B = { a: string } & { b: number };  // 交叉，语义相近但不可合并
```

**相同点也要说**：

1. 都能描述对象和函数。
2. 都能扩展：`interface extends`，`type` 用 `&`。
3. 都能被类 `implements`。

**追问：`interface` 能继承联合类型吗？** 不能，组合联合只能用 `type` 加交叉。

**追问：什么时候必须用 `type`？** 联合、条件类型、映射类型、模板字面量类型、给已有类型取别名、`typeof` 取值的类型。

**追问：为什么团队里要统一风格？** 因为混用会让「这段代码为什么用 type 不用 interface」变成无意义的讨论。约定是「对象形状用 interface，其余用 type」，例外时写注释说明。

**面经**：

- 字节 · 抖音二面：`type` 和 `interface` 怎么选。https://www.nowcoder.com/discuss/889546972099584000
- 字节 · 飞书一面：`interface` 或者 `type` 去定义类型，这两者有什么区别。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 牛客 2023 前端 TS 真题合集：相同点 + 不同点完整对比。https://www.nowcoder.com/discuss/517852889394446336

### 19.🌟什么是结构类型，和 Java 的名义类型差在哪？

**一句话**：TS 看形状不看身份，Java 看身份。

```ts
interface Point { x: number; y: number }
class Vec { constructor(public x: number, public y: number) {} }
const p: Point = new Vec(1, 2);   // 可以，形状一样
```

**展开**：

1. 结构类型意味着「只要长得像就算」，不需要 `implements`。
2. 好处：第三方类型能直接当你的接口用，不用包一层。
3. 坏处：两个语义完全不同但形状相同的类型可以互串，编译器拦不住。比如 `UserId` 和 `OrderId` 都是 `string`，传错了不报错。

**追问：怎么模拟名义类型？** 加一个私有品牌字段：

```ts
type UserId = string & { readonly __brand: 'UserId' };
const id = 'abc' as UserId;
```

也可以直接用类的 `#private` 字段——私有字段会让两个结构相同的类互不兼容。

**追问：为什么对象字面量多写一个字段会报错，变量赋值却不报？** 那是「多余属性检查」，只对新鲜的字面量生效。先赋给变量再传进去就绕过了。它不是类型安全的一部分，是防手滑的。

**追问：函数类型的兼容规则和对象一样吗？** 不完全一样。对象是「属性多的能赋给属性少的」；函数是「参数少的能赋给参数多的」（配合逆变），返回值多的能赋给少的。

**面经**：牛客 2023 前端 TS 真题合集专门问了「聊聊你对 TypeScript 类型兼容性的理解」，包括接口兼容性和函数兼容性的差别。https://www.nowcoder.com/discuss/517852889394446336

### 20.类里的访问修饰符有哪些？

**一句话**：`public`（默认）、`protected`、`private`，加上 `readonly`；TS 还有编译期的 `private` 和运行时的 `#private` 两套。

| 修饰符 | 谁能访问 | 编译后 |
| --- | --- | --- |
| `public` | 任何地方 | 不变 |
| `protected` | 自己和子类 | 不变 |
| `private` | 只有自己 | **不变，运行时可访问** |
| `#field` | 只有自己 | 真私有，运行时也拦 |
| `readonly` | 任何地方读 | 只是编译期约束 |
| `static` | 通过类名访问 | 挂在构造函数上 |

**追问：TS 的 `private` 能真正隐藏吗？** 不能。它只在类型检查时生效，编译出来的 JS 里还是普通属性，`obj['secret']` 照样能拿到。要真隐藏用 `#field`。

**追问：`readonly` 是深度的吗？** 不是，只作用于那一层。`readonly items: string[]` 只禁止重新赋值 `items`，`items.push()` 仍然可以，要深度只读得用 `readonly string[]` 或 `ReadonlyArray`。

**追问：`protected` 和 `private` 在继承里有什么区别？** `protected` 子类能访问，`private` 子类不能。但要注意：TS 的 `private` 检查是结构性的，两个类都有同名 private 字段时互不兼容。

**面经**：牛客 2023 前端 TS 真题合集把「类」列为独立知识点，包含访问修饰符、抽象类、静态属性、接口实现。https://www.nowcoder.com/discuss/517852889394446336

### 21.抽象类和接口有什么区别？

**一句话**：接口只描述形状、没有实现；抽象类可以带实现和状态，只能单继承。

**展开**：

1. `abstract class` 里可以有抽象方法（不写实现，子类必须实现），也可以有具体方法和字段。
2. `interface` 在 TS 里可以被多个类 `implements`，一个类也能实现多个接口。
3. 抽象类编译后是真实的类，会出现在运行时；接口完全擦除。
4. 抽象类可以有构造函数，接口不能。

**追问：什么时候用抽象类？** 需要共享实现或状态时。比如「所有 Repository 都有 `findById` 的通用实现」，那抽象类合适。只定义契约、多个不相关的类都要满足时用接口。

**追问：抽象类能被实例化吗？** 不能，`new AbstractClass()` 编译报错。但运行时它就是个普通类，JS 里能 new。

**面经**：牛客 2023 前端 TS 真题合集列了「抽象类」和「接口实现」两个子知识点。https://www.nowcoder.com/discuss/517852889394446336

### 22.函数重载和可选参数怎么写？

```ts
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  return typeof input === 'string' ? Number(input) : String(input);
}
```

**一句话**：TS 的重载只是「签名声明 + 一个实现」，没有 Java 那种按参数类型分派，运行时只有一个函数。

**展开**：

1. 重载签名对调用方可见，实现签名对外不可见。
2. 实现签名必须兼容所有重载签名，否则报错。
3. 运行时靠函数体内自己判断类型，所以重载只是给调用方更好的提示。
4. 可选参数 `a?: T` 和默认值 `a: T = x` 也能减少重载的数量。

**追问：重载和联合类型参数怎么选？** 参数组合简单时直接用联合类型加条件返回类型更省事；返回值类型跟参数走、组合多时用重载更清楚。

**追问：`this` 参数是什么？** 函数的第一个参数可以声明 `this: Type`，用来约束调用时的 `this`。它不占实际参数位，编译后被擦除。

**面经**：牛客 2023 前端 TS 真题合集把「函数」列为独立知识点，包含函数类型、可选参数、默认参数、Rest 参数、函数重载。https://www.nowcoder.com/discuss/517852889394446336

## 泛型

### 23.🌟泛型解决什么问题？

**一句话**：把类型当参数传，让「同一段逻辑、不同类型」只写一次，并且类型之间的关联不丢。

```ts
function first<T>(arr: readonly T[]): T | undefined {
  return arr[0];
}
const n = first([1, 2, 3]);   // number | undefined，不用手写 <number>
```

**展开**：

1. **约束**：`<T extends { id: string }>`，不写约束时 `T` 上什么都访问不到。
2. **推断**：多数情况不用手写实参，编译器从入参反推。
3. **默认值**：`<T = string>`。
4. **运行时不存在**：擦除，不能 `new T()`、不能 `T.name`。要运行时能力就把构造函数或工厂当参数传进去。
5. 泛型能用在哪：函数、接口、类、类型别名。

**追问：和 `any` 的本质差别？** `any` 丢掉类型之间的关联，`T` 保留。`function pair<T>(a: T, b: T): [T, T]` 能保证两个参数同类型，换成 `any` 就不能。

**追问：泛型能递归吗？** 能。`type Json = string | number | boolean | null | Json[] | { [k: string]: Json }`。

**追问：泛型有什么代价？** 类型检查变慢、报错信息变长、对不熟悉的人可读性下降。所以「能用具体类型就别用泛型」，泛型是给「真正通用」的代码用的。

**面经**：

- 字节 · 飞书一面：泛型是什么，解决什么问题。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 美团 · 前端：TypeScript 中的泛型是什么（考察概念、作用、函数/接口/类中的应用、与 any 的差异）。https://www.upcv.tech/mianshi/xuanpai-company-cmlake0rh03p99k42wmyp81vr/q-qbi_question_5fa3ef93122785e632903bda9c6ca352.html
- 字节 · 前端：请解释泛型的概念，并说明它在函数和类中的应用。https://www.upcv.tech/mianshi/xuanpai-company-cmlami120094r9k42nkxfd8j4/q-qbi_question_39fe9c3e67eff1ae4759ee82db4c4f6e.html
- 字节 · 番茄二面：泛型用在哪。https://www.nowcoder.com/discuss/889546972099584000

### 24.泛型约束怎么写，`extends` 有什么讲究？

```ts
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((x) => x[key]);
}
```

**一句话**：`K extends keyof T` 把 `K` 限制成 `T` 的键，返回值 `T[K]` 就能精确到那个键的类型。

**展开**：

1. 不写约束时 `T` 是「未知类型」，只能当值传，不能访问任何属性。
2. 约束可以是接口、联合、另一个类型参数，也可以是条件类型。
3. 多个类型参数之间可以互相约束，`<K extends keyof T, T>` 顺序有讲究，被依赖的放前面。

**追问：`T extends any` 和 `T extends unknown` 有区别吗？** 作为约束几乎没区别，都允许任意类型。但在条件类型里，`T extends any ? X : Y` 会触发分发，`T extends unknown ? X : Y` 也会。写工具类型时要小心。

**追问：约束能用 `infer` 吗？** 不能直接写在 `extends` 后面，但可以在条件类型里用：`T extends Promise<infer U> ? U : never`。

**面经**：泛型约束通常在「泛型是什么」之后追问，作为同一组。见上一题的面经来源。

### 25.⭐协变、逆变、双变是什么？

**一句话**：`strictFunctionTypes` 打开后，函数参数位置逆变，返回值位置协变，方法参数双变。

```ts
type Animal = { name: string };
type Dog = Animal & { bark(): void };

let f: (a: Animal) => void = () => {};
let g: (d: Dog) => void = f;            // 可以：参数逆变
let h: (a: Dog) => void = (a: Animal) => {};
// 报错：Animal 不一定有 bark
```

**展开**：

1. **协变**：`Dog` 能当 `Animal` 用，方向一致。返回值、数组、对象属性都是协变的。
2. **逆变**：`(Animal) => void` 能当 `(Dog) => void` 用，方向相反。函数参数是逆变的。
3. **双变**：两者都行。TS 里方法参数默认双变（为了兼容老代码），函数类型参数严格逆变。
4. **抗变**（不变）：两者都不行，必须完全一致。

**追问：为什么参数要逆变？** 调用方按声明的参数类型传值。`(Dog) => void` 这个位置塞进 `(Animal) => void`，调用方传 `Dog` 是安全的；反过来按 `Animal` 传就会炸。

**追问：数组是协变的吗？** TS 里 `Dog[]` 能赋给 `Animal[]`，但同时又允许 `push` 一个 `Animal`，这在类型层面不安全。这是照顾 JS 生态的妥协；`readonly T[]` 才真正安全。

**面经**：牛客 2023 前端 TS 真题合集专门问了「对协变、逆变、双变和抗变的理解」。https://www.nowcoder.com/discuss/517852889394446336

## 高级类型

### 26.`keyof` 和 `typeof` 怎么配合用？

```ts
const config = { host: 'a', port: 80 } as const;
type Config = typeof config;        // { readonly host: "a"; readonly port: 80 }
type Keys = keyof Config;           // "host" | "port"
```

**一句话**：`keyof` 拿键的联合，`typeof` 在类型位置拿一个值的类型，两者常连用来「从值推出类型」。

**展开**：

1. `keyof T` 得到 `T` 所有键的联合。索引签名会让它退化成 `string | number`。
2. `typeof x` 在类型位置拿 `x` 的静态类型，前提是 `x` 是个值（变量、属性、import）。
3. 组合起来能实现「类型跟着实现走」：改常量，类型自动跟着变。
4. `keyof typeof obj` 是最常见的组合，用来拿对象键的联合。

**追问：`keyof any` 是什么？** `string | number | symbol`，因为任何值都能当键。

**追问：`keyof` 拿到的是字符串吗？** 大部分情况是，但如果对象有 symbol 键或数字键，联合里会有对应类型。`keyof T & string` 能过滤掉非字符串的部分。

**面经**：牛客 2023 前端 TS 真题合集单独问了 `keyof` 和 `typeof` 关键字的作用。https://www.nowcoder.com/discuss/517852889394446336

### 27.映射类型怎么写？

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type Nullable<T> = { [K in keyof T]: T[K] | null };
```

**一句话**：`[K in keyof T]` 遍历 `T` 的每个键，生成新对象类型。这是所有工具类型的底层机制。

**展开**：

1. `+` / `-` 修饰符能加或去掉 `?` 和 `readonly`：`-readonly [K in keyof T]`。
2. 键重映射用 `as`：`[K in keyof T as \`get${Capitalize<K & string>}\`]`。
3. 映射类型会保留原属性的可选性和只读性，除非显式改写。

**追问：映射类型是「同态」的，什么意思？** 同态（homomorphic）指直接遍历 `keyof T`，这种映射会保留原类型的修饰符和数组/元组的特性。如果写成 `[K in keyof T & string]` 就不同态了，元组会被打散成对象。

**追问：怎么在映射里过滤掉某些键？** 用 `as` 加条件：`[K in keyof T as T[K] extends string ? K : never]`。返回 `never` 的键会被移除。

**面经**：暂无已核对的公开原题。

### 28.条件类型和分布式条件类型？

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<'a' | 1>;   // true | false —— 联合被拆开逐个判断
```

**一句话**：`T extends U ? X : Y`，当 `T` 是「裸」的类型参数且传入联合时，会分发到每个成员再合并。

**展开**：

1. 「裸」指 `T` 没有被包裹，比如 `T[]` 就不分发。
2. 分发在 `never` 上是特例：结果还是 `never`，因为空联合没有成员可分。
3. 分发常被用来做过滤：`type ExtractString<T> = T extends string ? T : never`。
4. `Exclude` 和 `Extract` 就是基于这个机制实现的。

**追问：怎么阻止分发？** 用元组包一层：`[T] extends [string] ? ...`。

**追问：`boolean` 分发吗？** 分发，因为 `boolean` 本质是 `true | false`，所以 `IsString<boolean>` 会得到 `false | false`，也就是 `false`。

**面经**：暂无已核对的公开原题。

### 29.`infer` 怎么用？

```ts
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T;
type R = Unwrap<Promise<Promise<number>>>;  // number
```

**一句话**：在条件类型的 `extends` 里就地声明一个类型变量，让编译器从结构里推出来。

**展开**：

1. 常用来拆容器：数组元素、Promise 结果、函数参数、函数返回值。
2. 可以加约束：`infer U extends string`。
3. 同一个条件里能写多个 `infer`，再交叉或联合。
4. 函数参数用元组接：`T extends (...args: infer P) => any ? P : never`。

**追问：`infer` 能写在协变位置和逆变位置吗？** 能。逆变位置（参数）上的 `infer` 会推到最宽的类型，TS 有专门规则处理，写库时要注意。

**追问：`infer` 能配合递归吗？** 能，`Awaited` 就是递归实现：`T extends Promise<infer U> ? Awaited<U> : T`。递归深度有上限，太深会报「类型实例化过深」。

**面经**：暂无已核对的公开原题。

### 30.模板字面量类型能做什么？

```ts
type Event = 'click' | 'focus';
type Handler = `on${Capitalize<Event>}`;   // 'onClick' | 'onFocus'

type Route = `/api/${string}`;
```

**一句话**：在类型层面拼字符串，配合联合类型能枚举出所有组合。

**展开**：

1. 内置的四个字符串工具：`Uppercase`、`Lowercase`、`Capitalize`、`Uncapitalize`。
2. 配合 `infer` 能做路由参数解析：`'/user/:id'` 推出 `{ id: string }`。
3. 联合类型会被展开成笛卡尔积，组合爆炸时要小心编译时间。

**追问：能用来校验字符串格式吗？** 只能做很粗的校验（前缀、后缀、简单模式）。复杂格式（邮箱、URL）在类型层面表达不出来，还是得运行时校验。

**追问：有什么实际用途？** 事件名的类型安全、CSS 属性名、i18n key 校验、API 路径参数提取。这些都是「字符串字面量有结构」的场景。

**面经**：暂无已核对的公开原题。

## 工具类型

### 31.🌟常用的工具类型有哪些？

| 工具类型 | 作用 | 实现方式 |
| --- | --- | --- |
| `Partial<T>` | 所有属性变可选 | 映射 + `?` |
| `Required<T>` | 去掉可选 | 映射 + `-?` |
| `Readonly<T>` | 所有属性只读（浅） | 映射 + `readonly` |
| `Pick<T, K>` | 挑几个键 | 映射 + `K` |
| `Omit<T, K>` | 去掉几个键 | `Pick<T, Exclude<keyof T, K>>` |
| `Record<K, V>` | 键值映射 | 映射 |
| `Exclude<T, U>` | 联合里去掉某些成员 | 分布式条件类型 |
| `Extract<T, U>` | 联合里留下某些成员 | 分布式条件类型 |
| `NonNullable<T>` | 去掉 `null \| undefined` | `Exclude<T, null \| undefined>` |
| `ReturnType<F>` | 函数返回值类型 | `infer` |
| `Parameters<F>` | 函数参数元组 | `infer` |
| `Awaited<P>` | 拆 Promise | 递归 `infer` |

**展开**：

1. `Omit` 本质是 `Pick<T, Exclude<keyof T, K>>`。
2. `Exclude` 和 `Extract` 都基于分布式条件类型。
3. `Awaited` 是递归的，能拆多层 Promise。
4. 这些工具类型都是「类型层面的函数」，运行时不存在。

**面经**：牛客 2023 前端 TS 真题合集列了一整套内置高级类型，包括 `Exclude`、`Omit`、`Readonly`、`Pick`、`NonNullable`，还提到 `Merge`、`Compute`、`Intersection`、`Overwrite` 这类社区常用类型。https://www.nowcoder.com/discuss/517852889394446336

### 32.🌟`Omit` 和 `Pick` 哪个更安全？

**一句话**：`Pick` 更安全。`Omit` 的键写错时不会报错——`Omit<T, 'notExist'>` 等于 `T` 本身。

**展开**：

1. 原因：`Exclude<keyof T, 'notExist'>` 什么也没排除，`Pick<T, 全部键>` 就是 `T`。
2. `Pick` 的 `K` 受 `keyof T` 约束，写错键直接编译失败。
3. 团队里如果必须用 `Omit`，补一行类型测试兜住。

```ts
// 类型测试兜底
type _Check = Omit<User, 'age'> extends { age: never } ? never : true;
```

**追问：为什么 `Omit` 不设计成受约束？** 因为它的第一个参数常是联合类型（联合的 `keyof` 只取公共键），加约束会限制用法。这是权衡，不是疏忽。

**追问：怎么安全地删属性？** 定义一个自己的严格版本：

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

**面经**：字节 · 番茄二面：怎么删掉接口的某个属性。https://www.nowcoder.com/discuss/889546972099584000

### 33.`ReturnType` 和 `Parameters` 怎么实现的？

```ts
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type MyParameters<T> = T extends (...args: infer P) => any ? P : never;
```

**一句话**：用条件类型加 `infer`，从函数类型里把返回值或参数元组抽出来。

**追问：能处理重载函数吗？** 只取最后一个重载签名，这是已知限制。要处理全部重载得用别的技巧，日常遇不到。

**追问：能处理泛型函数吗？** `ReturnType<typeof identity>` 会得到 `unknown`，因为泛型还没实例化。这是常见坑。

**面经**：暂无已核对的公开原题。

### 34.`Record` 和索引签名有什么区别？

```ts
type A = Record<string, number>;    // 等价于 { [k: string]: number }
interface B { [k: string]: number }
```

**一句话**：`Record<K, V>` 是映射类型，`{[k: string]: V}` 是索引签名；对 `string | number | symbol` 的键两者等价。

**展开**：

1. `Record` 的 `K` 可以是字面量联合，`Record<'a' | 'b', number>` 会生成具体的两个键。
2. 索引签名更宽松，任何字符串键都允许，读不存在的键返回 `V`（不是 `V | undefined`），这是类型不严谨的地方。
3. `Record` 在 `noUncheckedIndexedAccess` 打开后行为一致，都会加上 `| undefined`。
4. 索引签名能出现在 `interface` 里，`Record` 是类型别名，不能合并。

**追问：为什么索引签名读不存在的键不报错？** 因为 TS 默认假设任意键都存在。这是历史设计，`noUncheckedIndexedAccess` 就是为了修这个。

**面经**：暂无已核对的公开原题。

## 集合、字符串与数字

### 35.数组和元组有什么区别？

**一句话**：数组是同类型、长度不定；元组是定长、每个位置类型可以不同。

```ts
const arr: number[] = [1, 2, 3];
const tuple: [string, number] = ['a', 1];
const rest: [string, ...number[]] = ['a', 1, 2, 3];
```

**展开**：

1. 元组的长度是类型的一部分，`tuple[2]` 直接报错。
2. 可变元组用 `...T[]`，可选元素用 `?`。
3. `as const` 能把数组字面量推成只读元组。
4. 元组支持解构，类型会精确对应。

**追问：元组实际用在哪些地方？** 函数返回多个值、`useState` 的返回值、`Object.entries` 的结果、`Parameters` 的类型、`Promise.all` 的结果。

**追问：`readonly` 元组和普通元组有什么区别？** 只读元组不能改元素、不能 `push`，但能赋给需要 `readonly` 的位置。函数参数用只读元组更安全。

**面经**：牛客 2023 前端 TS 真题合集把「数组、元组」列在用户定义类型里。https://www.nowcoder.com/discuss/517852889394446336

### 36.`Map`、`Set` 和对象、数组怎么选？

| | 键类型 | 顺序 | 查找 | 适用 |
| --- | --- | --- | --- | --- |
| 对象 | `string \| number \| symbol` | 插入序（数字键会排前面） | 哈希 | 结构化配置 |
| `Map` | 任意值 | 严格插入序 | 哈希 | 频繁增删、键是对象 |
| 数组 | 索引 | 有序 | O(n) | 有序列表 |
| `Set` | — | 插入序 | 哈希 | 去重、成员判断 |

**展开**：

1. `Map` 的键是对象时按引用比，两个内容相同的对象是两个键。
2. `Map` 有 `size`，对象要 `Object.keys().length`。
3. `Set` 去重用的是 SameValueZero，`NaN` 能去重，`-0` 和 `0` 视为同一个。
4. 对象有原型链，遍历时会考虑 `hasOwnProperty`；`Map` 没有这个问题。

**追问：`WeakMap` 和 `Map` 差在哪？** `WeakMap` 的键必须是对象，且是弱引用——键被回收后条目自动消失。适合给对象挂私有数据，不会阻止 GC。它不可遍历、没有 `size`。

**追问：TS 里怎么给 `Map` 写泛型？** `new Map<string, User>()`，或者声明 `Map<string, User>` 类型。`Map` 是泛型类，两个类型参数分别是键和值。

**面经**：暂无已核对的公开原题。

### 37.`readonly` 数组和普通数组有什么区别？

```ts
function sum(xs: readonly number[]) { ... }

const a: readonly number[] = [1, 2, 3];
a.push(4);   // 报错
```

**一句话**：`readonly T[]`（等价 `ReadonlyArray<T>`）禁止所有变异方法，是真正的只读视图。

**展开**：

1. 普通 `number[]` 能赋给 `readonly number[]`，反过来不行。这叫「安全的单向兼容」。
2. `readonly` 是浅的：`readonly T[][]` 只禁止改外层。
3. 函数参数写 `readonly T[]` 是最佳实践，调用方能传普通数组，你也不会误改。

**追问：为什么 `readonly` 参数更安全？** 因为数组本身是协变的（`Dog[]` 能赋给 `Animal[]`），如果函数里能 `push`，就会往 `Dog[]` 里塞进 `Animal`。`readonly` 禁止了这条路径。

**追问：`ReadonlyArray<T>` 和 `readonly T[]` 一样吗？** 完全等价，后者是前者的语法糖。写库时用 `ReadonlyArray` 更表意，业务代码用 `readonly T[]` 更简洁。

**面经**：暂无已核对的公开原题。

### 38.`bigint` 和浮点数有哪些坑？

**一句话**：`number` 是双精度浮点，超过 2^53-1 就不精确；要精确大整数用 `bigint`。

```ts
0.1 + 0.2 === 0.3;          // false
Number.MAX_SAFE_INTEGER;    // 9007199254740991
9007199254740993n;          // bigint 字面量
```

**展开**：

1. 浮点误差的根源是二进制无法精确表示 0.1。金额别用 `number`，用整数分或字符串。
2. `bigint` 不能和 `number` 混算，`1n + 1` 直接抛错。
3. `bigint` 不能用于 `Math` 的方法，`JSON.stringify` 也不支持（会抛错）。
4. `typeof 1n` 是 `'bigint'`。

**追问：怎么比较两个浮点数？** 用误差范围：`Math.abs(a - b) < Number.EPSILON`。或者干脆全程用整数。

**追问：接口返回大整数 ID 怎么处理？** 后端可能返回 `321789788912372911233` 这种超过安全整数的 ID，`JSON.parse` 会丢精度。解法是后端返回字符串，或者用能保留大整数的解析器。

**面经**：字节后端一面出现过类似场景：`{"id":321789788912372911233}` 用 `map[string]interface{}` 反序列化后再序列化，大整数精度丢失。https://segmentfault.com/a/1190000045455181

## 错误处理

### 39.🌟TS 里怎么做错误处理？

**一句话**：`throw` 可以抛任何值，所以 `catch` 里的类型是 `unknown`，必须先收窄再判断。

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

**展开**：

1. `Error` 有 `message`、`name`、`stack`，自定义错误继承它。
2. 继承 `Error` 时 `name` 要手动设，否则 `instanceof` 对了但 `name` 还是 `'Error'`。
3. TS 5.5 起 `catch` 变量默认 `unknown`，因为 `throw` 什么都能抛。
4. `cause` 字段（ES2022）能挂原始错误，形成错误链。

**追问：怎么区分业务错误和系统错误？** 自定义错误类加一个标记字段，或者用判别联合的 `Result` 类型代替 `throw`。

**追问：`instanceof Error` 在跨 iframe 时可靠吗？** 不可靠。不同 realm 的 `Error` 是不同的构造函数。要跨 realm 判断，检查 `e && typeof e === 'object' && 'message' in e`。

**面经**：暂无已核对的公开原题。

### 40.用判别联合做错误返回，和 `throw` 比各有什么优劣？

```ts
type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

function parse(s: string): Result<number> {
  const n = Number(s);
  return Number.isNaN(n) ? { ok: false, error: new Error('NaN') } : { ok: true, data: n };
}
```

**一句话**：判别联合把错误变成返回值，调用方必须显式处理；`throw` 可以被忽略（不 `try` 也能跑）。

**展开**：

1. 优点：类型系统强制你处理错误分支，不会漏；错误也是值，能组合、能 map。
2. 缺点：每层都要手动传递，代码啰嗦；和第三方库（抛异常）不兼容。
3. 实践里常混用：业务上可预期的失败用 `Result`，真正的异常（网络断开、断言失败）用 `throw`。

**追问：TS 有没有类似 `never` 的「错误类型」？** 没有 checked exception。TS 的函数签名不声明抛什么，所以编译器不知道调用点可能抛错。

**追问：`Result` 模式在哪些生态里流行？** Rust 的 `Result`、Haskell 的 `Either`、以及 TS 的 neverthrow 库。它本质是「用类型系统表达可预期的失败」。

**面经**：暂无已核对的公开原题。

## 装饰器与元数据

### 41.🌟装饰器是什么，TS 里有几套？

**一句话**：装饰器是挂在类、方法、属性、参数上的元编程钩子，编译期改写成包装调用。TS 里现在有**两套**，互不兼容。

| | 旧（experimental） | 新（TC39 Stage 3） |
| --- | --- | --- |
| 开关 | `experimentalDecorators: true` | TS 5.0 起默认，无需开关 |
| 参数装饰器 | 支持 | 不支持 |
| 类型元数据 | `emitDecoratorMetadata` 发 `design:paramtypes` | 不支持 |
| 谁在用 | NestJS、TypeORM、Angular 旧版 | 新写法 |

```ts
function log(target: any, key: string, desc: PropertyDescriptor) {
  const old = desc.value;
  desc.value = function (...args: unknown[]) {
    console.log(key, args);
    return old.apply(this, args);
  };
}
```

**追问：TS 有反射吗？** 语言本身没有。TS 只是按约定发出 `design:paramtypes` 这样的**元数据**，再由 `reflect-metadata` 读出来。所以标准答法是：没有 Java 那种反射，靠装饰器元数据模拟，且必须开那两个编译选项。

**追问：⚠️为什么 NestJS 还停在旧装饰器？** 因为它的依赖注入靠构造函数参数类型，而构造函数参数类型和参数装饰器恰好是 Stage 3 不支持的两样。NestJS 维护者的公开回复就是这个立场，短期不会换。

**追问：装饰器的执行顺序是怎样的？** 同一个目标上的多个装饰器，表达式从上往下求值，应用从下往上；方法装饰器先于类装饰器；参数装饰器最先。

**面经**：字节 · 前端一面（75 分钟）问过装饰器。https://www.nowcoder.com/discuss/799382455135293440

### 42.装饰器的执行顺序是怎样的？

**一句话**：同一个目标上的多个装饰器，表达式从上往下求值，应用从下往上；类装饰器最后跑。

```ts
@a
@b
class C {}     // 求值 a、b；应用 b、a
```

**展开**：

1. 方法装饰器先于类装饰器执行。
2. 参数装饰器最先，然后是方法装饰器，最后是类装饰器。
3. 属性装饰器和参数装饰器只能拿到定义，不能改描述符。
4. 多个同类型装饰器在同一个位置上，也是从上到下求值、从下到上应用。

**追问：为什么是倒序应用？** 因为语义上是「嵌套包裹」：`@a` 包在 `@b` 外面，所以 `@b` 先接触原始方法。

**追问：方法装饰器能改方法体吗？** 能，通过 `PropertyDescriptor.value` 替换函数。也能改 `enumerable`、`configurable`，但不能改 `writable`（那是数据描述符的属性，改它不会生效）。

**面经**：暂无已核对的公开原题。

## 工程实践

### 43.`strict` 打开了哪些选项？

**一句话**：`strict` 是一组开关的合集，最重要的是 `strictNullChecks` 和 `noImplicitAny`。

**展开**：

1. `strictNullChecks`：`null` / `undefined` 不再能赋给其他类型。
2. `noImplicitAny`：推断不出类型时不允许默默当 `any`。
3. `strictFunctionTypes`：函数参数逆变检查。
4. `strictPropertyInitialization`：类属性必须在构造函数里初始化。
5. `strictBindCallApply`：`bind` / `call` / `apply` 的参数类型检查。
6. `alwaysStrict`：输出 `"use strict"`。
7. `useUnknownInCatchVariables`：`catch` 变量是 `unknown`。

**追问：老项目怎么渐进迁移？** 先开不影响运行时行为的（`noImplicitAny` 可能改动多），然后逐目录开。也可以用「`// @ts-strict-ignore` 之类的注释临时豁免」，但这需要额外的工具支持（TS 本身不支持）。

**追问：`strictPropertyInitialization` 怎么绕？** 用 `!` 断言、在构造函数里赋值、或者给默认值。最稳的是「构造函数里赋值」，`!` 会丢掉检查。

**面经**：牛客 2023 前端 TS 真题合集把「ts 配置」列为独立知识点。https://www.nowcoder.com/discuss/517852889394446336

### 44.`const` 类型参数（`const T`）是什么？

```ts
function tuple<const T extends readonly unknown[]>(...args: T): T {
  return args;
}
const t = tuple('a', 'b');   // ['a', 'b']，不是 string[]
```

**一句话**：TS 5.0 的特性，让调用处传的字面量保持最窄类型，相当于在函数签名里自动加 `as const`。

**展开**：

1. 不加 `const`，`tuple('a', 'b')` 推成 `string[]`。
2. 加了，推成 `readonly ['a', 'b']`。
3. 常用于写库：路由、事件名、配置对象这类需要保留字面量的场景。

**追问：和用户自己写 `as const` 有什么区别？** 库作者写 `const T`，调用方不用再手动加，API 更好用。

**面经**：暂无已核对的公开原题。

### 45.`d.ts` 文件是干什么的？

**一句话**：只包含类型声明、不含实现，用来给 JS 代码或外部模块提供类型。

**展开**：

1. 三种用途：给纯 JS 库补类型、声明全局变量、声明非代码资源（`.css`、`.svg`、`.png`）。
2. `declare module 'x'` 可以给没有类型的包写声明。
3. `@types/*` 包就是社区维护的 `.d.ts`。
4. 用 `declare global` 扩展全局类型（比如给 `window` 加字段）。

**追问：为什么我的 `.d.ts` 不生效？** 常见原因：没在 `include` 里、`typeRoots` / `types` 配置把它排除了、模块解析路径对不上、或者 `.d.ts` 里用了 `import` 导致它变成模块（模块内的声明不会自动全局）。

**追问：`declare module` 和 `declare global` 有什么区别？** `declare module` 声明一个模块的类型，`declare global` 扩展全局作用域。后者只能用在模块文件里（有 import / export 的文件）。

**面经**：牛客 2023 前端 TS 真题合集把「声明全局变量、库、.d.ts」列为独立知识点。https://www.nowcoder.com/discuss/517852889394446336

### 46.`import type` 和普通 `import` 有什么区别？

**一句话**：`import type` 明确表示「只导入类型」，编译后整条 import 消失，不会产生运行时依赖。

```ts
import type { User } from './types';   // 编译后没有这行
import { createUser } from './api';    // 编译后保留
```

**展开**：

1. `verbatimModuleSyntax` 打开后必须明确区分，否则可能引入不存在的运行时模块。
2. 只导入类型却写了普通 `import`，打包器可能保留这行，导致「模块不存在」或循环依赖。
3. `export type` 同理。
4. `import { type User, createUser }` 这种行内写法也能混合。

**追问：`isolatedModules` 下为什么必须区分？** 因为逐文件转译时无法判断一个导入是类型还是值，只能靠语法标记。没有标记时，工具只能保守处理（保留或删除），两种都可能出错。

**追问：类型导入会影响循环依赖吗？** 不会，因为编译后就没了。但如果写成普通 `import`，可能引入真实的循环依赖，运行时拿到未初始化的模块。

**面经**：暂无已核对的公开原题。

### 47.类型测试怎么写？

**一句话**：用 `expect-type` 这类库，或者手写「赋值能过 / 应该报错用 `@ts-expect-error`」的断言。

```ts
import { expectTypeOf } from 'expect-type';

expectTypeOf<ReturnType<typeof fn>>().toEqualTypeOf<string>();
// @ts-expect-error 这里应该报错
const x: number = 'a';
```

**展开**：

1. `@ts-expect-error` 在「确实报错」时通过，「没报错」时自己报错，正好用来测「该拒绝的输入」。
2. `@ts-ignore` 不管有没有错都通过，测不出东西。
3. 类型测试通常放在 `*.test-d.ts`，用 `tsd` 或 `vitest` 的 typecheck 模式跑。
4. Vitest 的 `expectTypeOf` 是内置的，不用额外装库。

**追问：为什么类型测试值得写？** 工具类型写错时不会报错，只会静默变成 `any` 或 `never`。没有测试兜底，错误会扩散到调用方。

**追问：`@ts-expect-error` 和 `@ts-ignore` 在 CI 里有什么区别？** `@ts-ignore` 会静默吞掉所有错误，包括意料之外的；`@ts-expect-error` 在「本来不该报错的地方」会报错，所以能发现「修复后忘了删注释」这类问题。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 美团 · 前端 | 用过 TS 吗，跟 JS 有什么区别 | 1、4 |
| 字节 · 飞书一面 | 平时 JS 多还是 TS 多；TS 常用类型定义 | 1、2 |
| 字节 · 飞书一面 | `interface` 和 `type` 的区别 | 18 |
| 字节 · 飞书一面 | 泛型是什么，解决什么问题 | 23 |
| 字节 · 抖音二面 | `type` 和 `interface` 怎么选 | 18 |
| 字节 · 番茄二面 | 泛型用在哪 | 23 |
| 字节 · 番茄二面 | 怎么删掉接口的某个属性 | 31、32 |
| 字节 · 前端一面（75 分钟） | `keyof` / `typeof` / 泛型 / 装饰器 | 26、41 |
| 字节 · 前端（泛型题） | 泛型在函数和类中的应用 | 23 |
| 美团 · 前端（泛型题） | 泛型是什么，与 any 的差异 | 23 |
| 字节 · 剪映一面 | 联合类型和交叉类型 | 14 |
| 字节 · 剪映一面 | `this`、`call` / `apply` / `bind` | 8 |
| 字节 · 剪映二面 | 原型链 | 9 |
| 京东 · 暑期 / 腾讯 · 提前批 | `any` 和 `unknown` 的区别 | 13 |
| 牛客 · 2023 TS 真题合集 | `any` / `unknown` / `never` / `void`、`interface` / `type`、高级类型、`keyof` / `typeof`、协变逆变、类型兼容性、`d.ts` | 10、13、14、18、19、20、21、22、25、26、31、35、43、45 |

来源汇总：

- 26 届/27 届前端高频 https://www.nowcoder.com/discuss/889546972099584000
- 字节飞书一面 https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3
- 字节 75 分钟 https://www.nowcoder.com/discuss/799382455135293440
- 剪映一面 https://www.nowcoder.com/discuss/839496349576855552
- 美团 TS 题解析 https://mianshidashi.cn/interview-questions/meituan/frontend-engineer/typescript-vs-javascript-difference
- 牛客 2023 前端 TS 真题合集 https://www.nowcoder.com/discuss/517852889394446336
- 字节泛型题 https://www.upcv.tech/mianshi/xuanpai-company-cmlami120094r9k42nkxfd8j4/q-qbi_question_39fe9c3e67eff1ae4759ee82db4c4f6e.html
- 美团泛型题 https://www.upcv.tech/mianshi/xuanpai-company-cmlake0rh03p99k42wmyp81vr/q-qbi_question_5fa3ef93122785e632903bda9c6ca352.html

## 这一篇没写的东西

- **事件循环、宏任务微任务**：浏览器篇。输出题和浏览器放在一起考。
- **`Array` / `Map` / `Set` 的完整 API**：只在第 36 题点到选型，不做方法清单。
- **`enum` 的完整用法**：只在第 5 题作为「不擦除的语法」出现，因为现在主流项目在弃用它。
- **TS 编译器内部实现**：只在第 3 题讲版本分界，不展开 AST、checker 的实现。
- **与 React / Vue 的类型集成**：组件类型、`JSX`、`defineComponent` 属于框架篇。
- **运行时校验库（zod / valibot）的具体用法**：属于工具选型，面试问到再答。
