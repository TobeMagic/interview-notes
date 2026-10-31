# 第一章 TypeScript

对标 Java SE 和集合里属于语言本身的部分。事件循环的细节在浏览器篇，异步 I/O 在 Node 篇。

排版约定：每题先一句能说出口的答案，再展开，再列追问。题下紧跟已核对的公开原题。章末有汇总索引。带 ⚠️ 的是网上答案普遍过时或写错的地方。

## 1. TypeScript 是什么，`tsc` 到底做了什么

**一句话**：TS 是给 JS 加了一套静态类型系统，编译期把这些类型检查掉，产出的还是普通 JS。

**展开**：

1. 类型只在编译期存在，运行时没有「TS 引擎」这回事。浏览器和 Node 不认 `.ts`。
2. `tsc` 做两件事：类型检查（`tsc --noEmit` 只做这个）+ 生成 JS 和 `.d.ts`。
3. 检查是「结构化」的，不是 Java 那种按类名认身份。看的是形状是否兼容，不看继承自谁。
4. 类型系统是图灵完备的，能在类型层面做计算。所以有 `infer`、条件类型、递归类型。

**⚠️ 版本要说对**：TypeScript 7.0 起编译器是 Go 重写的原生实现，命令还是 `tsc`、还是从 npm 装，官方给的全量构建提速 8–12 倍。被问「TS 编译器是什么写的」，答「原来是自己写的，7.0 起是 Go 原生端口」比答「Node 写的」准确。新编译器对冷门选项的支持范围以官方 release notes 为准，别替它保证。

**类型擦除**：绝大多数类型语法在产物里一点都不剩。`interface`、`type`、类型标注、泛型参数全部消失。运行时拿不到泛型实参，也没法 `instanceof` 一个 interface。

**但不是所有语法都擦除**，这是常被追问的点：

```ts
enum Color { Red, Green }                      // 产物是一个对象
class A { constructor(private x: number) {} }   // 参数属性生成赋值语句
namespace N { export const a = 1 }              // 产物是一个 IIFE
@dec class B {}                                 // 装饰器有运行时调用
```

`const enum` 会被内联成常量，代价是不能跨包安全使用（`isolatedModules` 下直接报错）。这也是为什么很多项目规定「只用 `as const` 对象，不用 `enum`」。

**追问：为什么打包器能直接吃 `.ts`？** 它只「剥类型」，不做类型检查。esbuild、SWC、Vite 都是这个思路，所以快，也所以类型错误不会挡住构建。`isolatedModules` / `verbatimModuleSyntax` 就是为了保证「单文件剥类型」不改变语义。

**追问：和 Java 的编译差别在哪？**

| | Java | TypeScript |
| --- | --- | --- |
| 产物 | 字节码，需要 JVM | 还是 JS，交给 JS 引擎 |
| 类型检查时机 | 编译期，运行时靠反射还能看到 | 只在编译期，运行时全部擦除 |
| 类型等价 | 名义类型（按类名和继承链） | 结构类型（按形状） |
| 泛型 | 擦除，反射能拿到部分信息 | 擦除，运行时完全没有 |

**面经**：暂无已核对的公开原题。这题多半从「为什么用 TS」「TS 和 JS 的区别」起手，见字节一面（2025-10-09）的 ES6 新特性一组。

## 2. 开篇：闭包、`this`、原型链

这三题是 JS 的底，放在 TS 篇开头，因为类型题常从这里起手。只答到能接住下一问，事件循环去浏览器篇。

**面经**：27 届暑期前端汇总把闭包、`this`、原型链列为 JS 基础前几题，字节、百度、快手都问。https://www.nowcoder.com/discuss/889546972099584000

### 2.1 闭包

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
2. 常见用途：私有状态、回调里保留上下文、柯里化、防抖节流里存 timer。
3. 代价：被闭包引用的变量逃逸到堆上，回收不掉就是内存泄漏。典型是监听器持有大对象、监听又没解绑。

**追问：循环里创建闭包，为什么以前打印出来都一样？** `var` 是函数作用域，整个循环共用一个变量；`let` 是块作用域，每轮新建。Go 在 1.22 之前也共用循环变量，1.22 起才改，见 Go 篇。

### 2.2 `this`

**一句话**：`this` 不看函数在哪定义，看它怎么被调用。箭头函数除外，它没有自己的 `this`，用定义时外层的。

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

**追问：React 里为什么以前要 `bind(this)`，现在不用了？** 类组件的方法默认没绑定，回调传出去就丢了 `this`。函数组件没这个问题，但换成了闭包旧值问题，见 React 篇。

**追问：`bind` 之后再 `call` 能改吗？** 不能，新函数的 `this` 已经固定。

### 2.3 原型链

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

## 3. 类型怎么选

这一节是 TS 面试主战场，字节抖音二面、番茄二面、京东暑期、腾讯提前批、飞书一面都在这条链上。

### 3.1 `type` 和 `interface`

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

**追问：`interface` 能继承联合类型吗？** 不能，组合联合只能用 `type` 加交叉。

**追问：什么时候必须用 `type`？** 联合、条件类型、映射类型、模板字面量类型、给已有类型取别名。

**面经**：

- 字节抖音二面：`type` 和 `interface` 怎么选。https://www.nowcoder.com/discuss/889546972099584000
- 字节飞书一面：`interface` 和 `type` 的区别。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 3.2 `any`、`unknown`、`never`

**一句话**：三个词要答出「可赋值方向」，不能只背中文名。

| 类型 | 能接收什么 | 能赋给谁 | 用在哪 |
| --- | --- | --- | --- |
| `any` | 任何值 | 任何类型 | 逃生舱，会污染下游 |
| `unknown` | 任何值 | 只能给 `unknown` / `any`，用前必须收窄 | 外部输入（JSON、`catch`） |
| `never` | 什么都接收不了 | 能赋给任何类型 | 穷尽检查、永不返回的函数 |

```ts
function parse(input: unknown) {
  // input.foo          // 报错，必须先收窄
  if (typeof input === 'string') input.toUpperCase();
}

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

**追问：`never` 为什么能赋给所有类型？** 它是底类型，代表「不可能有值」。函数永远抛错或死循环时返回类型就是 `never`，所以 `throw` 之后能被识别成不可达。

**追问：`catch` 的变量为什么是 `unknown`？** `useUnknownInCatchVariables` 打开后，`catch (e)` 的 `e` 是 `unknown`——JS 里可以 `throw` 任何东西，不一定是 `Error`。

**面经**：京东暑期、腾讯提前批问过 `any` 和 `unknown` 的区别。https://www.nowcoder.com/discuss/889546972099584000

### 3.3 泛型

**一句话**：把类型当参数传，让「同一段逻辑、不同类型」只写一次，并且类型之间的关联不丢。

```ts
function first<T>(arr: readonly T[]): T | undefined {
  return arr[0];
}
const n = first([1, 2, 3]);   // number | undefined，不用手写 <number>
```

要答的点：

1. **约束**：`<T extends { id: string }>`，不写约束时 `T` 上什么都访问不到。
2. **推断**：多数情况不用手写实参，编译器从入参反推。
3. **默认值**：`<T = string>`。
4. **运行时不存在**：擦除，不能 `new T()`、不能 `T.name`。要运行时能力就把构造函数或工厂当参数传进去。

**追问：和 `any` 的本质差别？** `any` 丢掉类型之间的关联，`T` 保留。`function pair<T>(a: T, b: T): [T, T]` 能保证两个参数同类型，换成 `any` 就不能。

**追问：泛型能递归吗？** 能。`type Json = string | number | boolean | null | Json[] | { [k: string]: Json }`。

**面经**：

- 字节番茄二面：泛型用在哪。https://www.nowcoder.com/discuss/889546972099584000
- 字节飞书一面：泛型解决什么问题。https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3

### 3.4 `keyof`、`typeof` 和工具类型

**一句话**：`keyof` 拿键的联合，`typeof` 在类型位置拿一个值的类型，工具类型是在这两者之上做映射。

```ts
const config = { host: 'a', port: 80 } as const;
type Config = typeof config;        // { readonly host: "a"; readonly port: 80 }
type Keys = keyof Config;           // "host" | "port"

type User = { id: number; name: string; age: number };
type PublicUser = Omit<User, 'age'>;
type Patch = Partial<Pick<User, 'name'>>;
type ById = Record<number, User>;
```

常问的几个，要能说出定义方式：

- `Partial<T>`：所有属性加 `?`。
- `Required<T>`：去掉 `?`。
- `Readonly<T>`：所有属性加 `readonly`，是浅的。
- `Pick<T, K>` / `Omit<T, K>`：挑键 / 去键，`Omit` 本质是 `Pick<T, Exclude<keyof T, K>>`。
- `Record<K, V>`：键值映射。
- `Exclude<T, U>` / `Extract<T, U>`：联合里的差集 / 交集。
- `NonNullable<T>`：去掉 `null | undefined`。
- `ReturnType<F>` / `Parameters<F>` / `Awaited<P>`：从函数和 Promise 上取类型。

**追问：`Omit` 和 `Pick` 谁更安全？** `Pick` 更安全。`Omit` 的键写错时不报错——`Omit<T, 'notExist'>` 等于 `T` 本身，这是真实踩过的坑。

**追问：`as const` 和 `: readonly` 的区别？** `as const` 把字面量收窄到最窄（`'a'` 而非 `string`），数组变只读元组；类型标注不做这种收窄。

**面经**：

- 字节前端一面（75 分钟）：`keyof` / `typeof` / 泛型 / 装饰器。https://www.nowcoder.com/discuss/799382455135293440
- 字节番茄二面：怎么删掉接口的某个属性（Pick / Omit 一组）。https://www.nowcoder.com/discuss/889546972099584000

## 4. 追问层：条件类型、`infer`、协变逆变

这几样是上一节的追问，不单独成篇。答不上来不影响基础分，答得出来是加分。

### 4.1 条件类型与分布式

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<'a' | 1>;   // true | false —— 联合被拆开逐个判断
```

**一句话**：`T extends U ? X : Y`，当 `T` 是「裸」的类型参数且传入联合时，会分发到每个成员再合并。

**追问：怎么阻止分发？** 用元组包一层：`[T] extends [string] ? ...`。

### 4.2 `infer`

```ts
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T;
type R = Unwrap<Promise<Promise<number>>>;  // number
```

**一句话**：在条件类型的 `extends` 里就地声明一个类型变量，让编译器从结构里推出来。

**追问：`infer` 能加约束吗？** 能，`infer U extends string`；也可以在同一个条件里写多个 `infer` 再交叉。

### 4.3 协变、逆变、双变

**一句话**：`strictFunctionTypes` 打开后，函数参数位置逆变，返回值位置协变，方法参数双变。

```ts
type Animal = { name: string };
type Dog = Animal & { bark(): void };

let f: (a: Animal) => void = () => {};
let g: (d: Dog) => void = f;            // 可以：参数逆变
let h: (a: Dog) => void = (a: Animal) => {};
// 报错：Animal 不一定有 bark
```

**追问：为什么参数要逆变？** 调用方按声明的参数类型传值。`(Dog) => void` 这个位置塞进 `(Animal) => void`，调用方传 `Dog` 是安全的；反过来按 `Animal` 传就会炸。

**追问：数组是协变的吗？** TS 里 `Dog[]` 能赋给 `Animal[]`，但同时又允许 `push` 一个 `Animal`，这在类型层面不安全。这是照顾 JS 生态的妥协；`readonly T[]` 才真正安全。

**面经**：暂无已核对的公开原题。这类题通常作为「手写一个 `Awaited`」「实现 `DeepPartial`」的手撕出现，不进这套正文。

## 5. 两个小题：`satisfies` 和装饰器

### 5.1 `satisfies`

**一句话**：校验值符合某个类型，但**不**把值的类型拓宽成那个类型。

```ts
const routes = {
  home: '/',
  user: '/user/:id',
} satisfies Record<string, `/${string}`>;

routes.home.toUpperCase();       // 仍然是 '/' 这个字面量类型
```

**追问：和 `as` 的区别？** `as` 是断言，只改编译器看到的类型，不做校验；`satisfies` 是校验，值本身类型不变。

**面经**：暂无已核对的公开原题。

### 5.2 装饰器

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

**关键差别**：运行时没有 Java 那种反射。TS 只是按约定发出 `design:paramtypes` 这样的**元数据**，再由 `reflect-metadata` 读出来。所以「TS 有反射吗」的标准答法是：语言本身没有，靠装饰器元数据模拟，且必须开那两个编译选项。

**⚠️ 别踩**：NestJS 至今仍依赖旧装饰器和 `emitDecoratorMetadata`，因为它的依赖注入靠构造函数参数类型，而构造函数参数类型和参数装饰器恰好是 Stage 3 不支持的两样。看到项目里还开着 `experimentalDecorators`，不是没升级，是升不了。NestJS 维护者的公开回复就是这个立场。

**面经**：字节前端一面（75 分钟）问过装饰器。https://www.nowcoder.com/discuss/799382455135293440

## 6. 常被连带问的两题

### 6.1 结构类型 vs 名义类型

**一句话**：TS 看形状不看身份，Java 看身份。

```ts
interface Point { x: number; y: number }
class Vec { constructor(public x: number, public y: number) {} }
const p: Point = new Vec(1, 2);   // 可以，形状一样
```

**追问：怎么模拟名义类型？** 加一个私有品牌字段：

```ts
type UserId = string & { readonly __brand: 'UserId' };
const id = 'abc' as UserId;
```

也可以直接用类的 `#private` 字段——私有字段会让两个结构相同的类互不兼容。

**追问：为什么对象字面量多写一个字段会报错，变量赋值却不报？** 那是「多余属性检查」，只对新鲜的字面量生效。先赋给变量再传进去就绕过了。它不是类型安全的一部分，是防手滑的。

**面经**：暂无已核对的公开原题。

### 6.2 类型收窄与断言

```ts
function f(x: string | number) {
  if (typeof x === 'string') x.toUpperCase();
}

type Result = { ok: true; data: string } | { ok: false; error: Error };
function handle(r: Result) {
  if (r.ok) return r.data;      // 判别联合
  return r.error;
}

function isString(x: unknown): x is string {   // 类型谓词
  return typeof x === 'string';
}
```

收窄手段要能列全：`typeof`、`instanceof`、`in`、判别联合的字面量字段、`Array.isArray`、类型谓词 `x is T`、断言函数 `asserts x is T`、`!= null`（同时排除 `null` 和 `undefined`）。

**追问：`as` 危险在哪？** 它不做运行检查。`JSON.parse(s) as User` 只是让编译器闭嘴，数据不合法照样运行时炸。所以外部输入要先过 schema 校验（zod 之类），再谈类型。

**面经**：字节剪映一面问过联合类型和交叉类型。https://www.nowcoder.com/discuss/839496349576855552

## 7. 面经汇总索引

| 公司 / 轮次 | 原题 | 对应节 |
| --- | --- | --- |
| 字节抖音二面 | `type` 和 `interface` 怎么选 | 3.1 |
| 字节飞书一面 | `interface` 和 `type` 的区别 | 3.1 |
| 京东暑期 / 腾讯提前批 | `any` 和 `unknown` 的区别 | 3.2 |
| 字节番茄二面 | 泛型用在哪 | 3.3 |
| 字节飞书一面 | 泛型解决什么问题 | 3.3 |
| 字节前端一面（75 分钟） | `keyof` / `typeof` / 装饰器 | 3.4、5.2 |
| 字节番茄二面 | 怎么删掉接口的某个属性 | 3.4 |
| 字节剪映一面 | 联合类型和交叉类型 | 6.2 |
| 字节 / 百度 / 快手 | 闭包、`this`、原型链 | 2 |
| 字节一面（2025-10-09） | ES6 新特性；`import` 和 `require` | 1、工程化篇 |

来源：27 届汇总 https://www.nowcoder.com/discuss/889546972099584000 ；飞书一面 https://www.nowcoder.com/feed/main/detail/80e34a524e7e48fdae24556cd50dc3c3 ；字节 75 分钟 https://www.nowcoder.com/discuss/799382455135293440 ；剪映一面 https://www.nowcoder.com/discuss/839496349576855552 ；字节一面 2025-10-09 https://www.kuazhi.com/post/716286102.html

## 8. 这一章没写的东西

- 事件循环、宏任务微任务：浏览器篇，因为输出题和浏览器放在一起考。
- `Array` / `Map` / `Set` 的 API 细节：不单独成节。被追问「TS 的集合和 Java 集合差在哪」时补一句「JS 没有泛型容器，`Map` 的键可以是对象，Java 的 `HashMap` 不行」。
- 枚举、命名空间、`declare` 合并：只在「类型擦除」那节里作为反例出现。
