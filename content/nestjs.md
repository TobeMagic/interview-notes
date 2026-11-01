# NestJS

对标 Spring 的是模块和依赖注入。岗位定位是接入层（BFF），不是另一套微服务框架。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。

## 模块与依赖注入

### 1.🌟NestJS 是什么，为什么用它？

**一句话**：基于 Node 的服务端框架，用装饰器 + 依赖注入 + 模块化组织代码，底层默认跑 Express（可换 Fastify）。

**展开**：

1. 提供了一套强约定：控制器、服务、模块、管道、守卫、拦截器，每一层职责明确。
2. 依赖注入让测试和替换实现更容易。
3. TypeScript 优先，类型贯穿到装饰器元数据。
4. 适合团队协作的中大型服务，小脚本用不上。

**追问：和 Express 比，多的是什么？** Express 只给你路由和中间件，其余自己搭。Nest 给你架构约束、依赖注入、模块边界、生态集成（TypeORM、GraphQL、微服务传输层）。

**面经**：腾讯微信基础部一面：有没有写过 NestJS；团队接入层用 NestJS。https://www.nowcoder.com/discuss/865669284599513088

### 2.🌟依赖注入是怎么实现的？

**一句话**：靠 `emitDecoratorMetadata` 发出的 `design:paramtypes` 元数据，Nest 在运行时读到构造函数参数类型，据此创建依赖。

```ts
@Injectable()
export class UserService {
  constructor(private readonly repo: UserRepository) {}
}
```

**展开**：

1. 编译后，类的构造函数参数类型被写进元数据。
2. Nest 的 IoC 容器读元数据，递归解析每个依赖，创建实例并注入。
3. 默认单例（`Scope.DEFAULT`），也可配 `REQUEST`（每个请求一个）或 `TRANSIENT`（每次注入都新建）。
4. 循环依赖用 `forwardRef` 打破。

**追问：为什么接口不能直接注入？** 因为接口在运行时不存在（类型擦除），元数据里没有它的类型信息。要用 `@Inject('TOKEN')` 显式指定 token，或者用抽象类（抽象类编译后是真实的值）。

**追问：为什么必须开旧装饰器？** 因为构造函数参数类型和参数装饰器恰好是 TC39 Stage 3 装饰器不支持的两样。NestJS 维护者的公开回复说明短期内不会换，所以 `experimentalDecorators` + `emitDecoratorMetadata` 是必需项，不是遗留包袱。

**面经**：腾讯微信基础部一面：依赖注入是什么；和 Java IoC / Spring 的关系。https://www.nowcoder.com/discuss/865669284599513088

### 3.🌟NestJS 的模块是什么，和 Spring 的 IoC 差在哪？

**一句话**：模块是「一组相关能力的边界」，声明 providers、controllers、imports、exports。Spring 的 IoC 容器是全局的，Nest 的模块是有作用域的。

| | Spring | NestJS |
| --- | --- | --- |
| 容器 | 全局 ApplicationContext | 每个模块一个容器，有 imports/exports 边界 |
| Bean 声明 | `@Component` / `@Bean` | `@Injectable()` + 模块 `providers` |
| 作用域 | singleton / prototype / request | DEFAULT / TRANSIENT / REQUEST |
| 条件装配 | `@Conditional` | 动态模块（`forRoot` / `forRootAsync`） |
| 循环依赖 | 三级缓存 | `forwardRef` |
| AOP | `@Aspect` + 切点表达式 | 拦截器 + 装饰器，没有切点表达式 |

**展开**：

1. 模块的 `exports` 决定什么能给别的模块用，这是 Spring 没有的显式边界。
2. 全局模块用 `@Global()`，但要少用，会失去边界。
3. 动态模块（`forRoot`）相当于 Spring 的 `@Configuration` + `@Bean`。

**追问：Nest 有 Spring 那种三级缓存解决循环依赖吗？** 没有。Nest 用 `forwardRef` 让两个模块/提供者互相引用，本质是延迟解析，不是提前暴露半成品对象。

**面经**：腾讯微信基础部一面问了 NestJS 和 Spring IoC 的关系。https://www.nowcoder.com/discuss/865669284599513088

### 4.Provider 有哪些注册方式？

**一句话**：类提供者、值提供者、工厂提供者、别名提供者，都用 `providers` 数组声明。

```ts
@Module({
  providers: [
    UserService,                                        // 类
    { provide: 'CONFIG', useValue: { port: 3000 } },    // 值
    { provide: 'DB', useFactory: (cfg) => create(cfg), inject: ['CONFIG'] },  // 工厂
    { provide: 'ALIAS', useExisting: UserService },     // 别名
  ],
})
```

**展开**：

1. 工厂提供者可以异步（返回 Promise），Nest 会等它 resolve。
2. `useClass` 用于「同一个 token，按环境换实现」。
3. 自定义 token 用字符串或 `Symbol`，避免命名冲突。

**追问：异步工厂什么时候用？** 初始化数据库连接、读取远程配置、预热缓存。它会让应用启动等待，所以别放太慢的操作。

**面经**：暂无已核对的公开原题。

### 5.作用域有哪几种？

| 作用域 | 实例数 | 场景 |
| --- | --- | --- |
| `DEFAULT` | 单例，全应用一个 | 无状态服务 |
| `REQUEST` | 每个请求一个 | 请求上下文（当前用户、traceId） |
| `TRANSIENT` | 每次注入都新建 | 有状态的工具类 |

**一句话**：默认单例，需要请求级上下文才用 `REQUEST`，而且它会向上传染——依赖它的 provider 也变成请求级。

**追问：`REQUEST` 作用域有什么性能代价？** 每个请求都要创建实例，且依赖链上的所有 provider 都不能是单例，内存和 GC 压力更大。能用 `AsyncLocalStorage` 就别用请求作用域。

**面经**：暂无已核对的公开原题。

## 请求生命周期

### 6.🌟一个请求在 Nest 里经过哪些环节？

**一句话**：中间件 → 守卫 → 拦截器（前）→ 管道 → 控制器方法 → 拦截器（后）→ 异常过滤器。

| 环节 | 能做什么 | 拿得到什么 |
| --- | --- | --- |
| 中间件 | 改 req/res、日志、cors | 原始 req/res，不知道路由处理函数 |
| 守卫 | 鉴权、权限判断 | `ExecutionContext`，知道将要执行的方法 |
| 拦截器 | 前后包裹、改返回值、计时 | `ExecutionContext` + `CallHandler` |
| 管道 | 参数转换和校验 | 单个参数的值和元数据 |
| 异常过滤器 | 统一错误格式 | 异常对象 + `ArgumentsHost` |

**展开**：

1. 中间件等价于 Express 中间件，是最外层。
2. 守卫返回 false 会抛 `ForbiddenException`。
3. 拦截器用 RxJS 的 `Observable` 包裹，能改流。
4. 管道在参数进入方法前做校验（`class-validator`）和转换（`ParseIntPipe`）。
5. 过滤器捕获异常，返回统一格式。

**追问：鉴权为什么用守卫不用中间件？** 因为守卫能拿到「将要执行哪个控制器方法」的元信息，可以读装饰器上的权限标记。中间件拿不到。

**面经**：暂无已核对的公开原题。

### 7.拦截器和中间件有什么区别？

**一句话**：中间件只处理请求，拦截器能同时处理请求和响应，还能改返回值、做超时和重试。

**展开**：

1. 拦截器基于 RxJS，`next.handle()` 返回 Observable，可以用 `map`、`tap`、`timeout`、`catchError`。
2. 拦截器能拿到方法返回值，中间件不能。
3. 拦截器能访问 `ExecutionContext`，读取 handler 上的元数据。
4. 中间件更适合 CORS、body parser 这类纯请求处理。

**追问：拦截器能做缓存吗？** 能，读缓存命中就直接返回，不调 `next.handle()`。但要小心和 `@CacheKey` 这类装饰器配合。

**面经**：暂无已核对的公开原题。

### 8.管道怎么用，和守卫有什么区别？

**一句话**：管道管「参数」，守卫管「能不能进」。管道做转换和校验，失败抛 `BadRequestException`。

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}
```

**展开**：

1. 内置管道：`ParseIntPipe`、`ParseBoolPipe`、`ParseUUIDPipe`、`ValidationPipe`、`DefaultValuePipe`。
2. `ValidationPipe` 配合 `class-validator` 做 DTO 校验，`whitelist: true` 会剥掉多余字段。
3. 自定义管道实现 `PipeTransform`。
4. 管道可以全局、控制器级、方法级、参数级注册，优先级从细到粗。

**追问：`ValidationPipe` 为什么要配合 class 而不是 interface？** 因为 interface 在运行时不存在，`class-transformer` 和 `class-validator` 需要真实的类来做元数据反射。

**面经**：暂无已核对的公开原题。

### 9.异常过滤器怎么统一错误格式？

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const status = exception instanceof HttpException
      ? exception.getStatus() : 500;
    res.status(status).json({ code: status, message: '...' });
  }
}
```

**一句话**：`@Catch()` 捕获异常，转成统一的响应结构。全局注册用 `app.useGlobalFilters()` 或模块 providers。

**展开**：

1. 不捕获的异常会走 Nest 默认的 500 响应。
2. 过滤器能区分 HTTP、RPC、WebSocket 上下文（`host.getType()`）。
3. 业务异常建议自定义 `BusinessException`，带错误码。

**追问：过滤器能拿到原始异常堆栈吗？** 能，但要小心别把堆栈返回给客户端（泄露内部信息）。日志里记录完整堆栈，响应里只给错误码和友好消息。

**面经**：暂无已核对的公开原题。

## 与 Express / Koa 对比

### 9.🌟Express、Koa、Nest 有什么区别？

| | Express | Koa | Nest |
| --- | --- | --- | --- |
| 中间件模型 | 线性，`next()` 往下 | 洋葱模型，`await next()` 前后都能处理 | 分层：中间件 / 守卫 / 拦截器 / 管道 / 过滤器 |
| 异步支持 | 回调，错误要手动 `next(err)` | 原生 async/await | 原生 async/await |
| 架构约束 | 无 | 无 | 强约定（模块、DI、装饰器） |
| 生态 | 最大 | 小一些 | 建立在 Express/Fastify 之上 |
| 上手成本 | 低 | 低 | 中高 |

**一句话**：Express 最自由也最松，Koa 用洋葱模型改进了中间件，Nest 在 Koa/Express 之上加了架构约束。

**展开**：

1. Express 的中间件是「一条线走到底」，`next()` 之后的代码在响应发出后执行，容易乱。
2. Koa 的 `await next()` 让「请求前」和「响应后」对称，错误处理更自然。
3. Nest 默认用 Express 适配器，可以换成 Fastify 提升性能。

**追问：Nest 能换 Fastify 吗，有什么代价？** 能，`NestFactory.create(AppModule, new FastifyAdapter())`。代价是部分 Express 中间件不兼容，要换成 Fastify 插件。

**面经**：暂无已核对的公开原题。

### 10.Koa 的洋葱模型是怎么实现的？

**一句话**：把中间件数组组合成一个函数，每个中间件拿到 `next` 函数，`await next()` 就是执行下一个中间件。

```js
function compose(middlewares) {
  return (ctx) => {
    function dispatch(i) {
      const fn = middlewares[i];
      if (!fn) return Promise.resolve();
      return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
    }
    return dispatch(0);
  };
}
```

**展开**：

1. 关键是 `next` 是一个返回 Promise 的函数，`await` 它就等于「执行完后续所有中间件」。
2. 所以 `await next()` 之前是「请求阶段」，之后是「响应阶段」。
3. Express 的 `next()` 不是 Promise，所以没法自然地在响应后做事。

**追问：洋葱模型的好处是什么？** 能对称地做「前处理 + 后处理」，比如计时、错误捕获、响应头注入。Express 只能用 `res.on('finish')` 绕。

**面经**：暂无已核对的公开原题。

## BFF 与工程实践

### 11.🌟BFF 是什么，为什么需要它？

**一句话**：Backend for Frontend，为特定前端服务的中间层，做接口聚合、字段裁剪、协议转换。

**展开**：

1. 前端一个页面要调 5 个后端接口时，BFF 聚合成一个，减少往返。
2. 后端返回 50 个字段，前端只用 5 个，BFF 裁剪。
3. 后端是 gRPC，前端要 HTTP/JSON，BFF 转换。
4. 不同端（Web / App / 小程序）需求不同，各有一个 BFF，不互相污染。

**追问：BFF 会不会变成「又一层微服务」？** 会，如果它开始承载业务逻辑。定位要清楚：BFF 只做聚合和适配，业务逻辑留在后端服务。

**追问：为什么 BFF 常用 Node？** 因为前端团队熟悉 JS，能自己维护；I/O 密集型场景 Node 表现好；和前端共享类型定义方便。

**面经**：腾讯微信基础部一面：团队接入层用 NestJS，C++ 微服务在后面。https://www.nowcoder.com/discuss/865669284599513088

### 12.BFF 里怎么调 gRPC 服务？

**一句话**：用 `@grpc/grpc-js` 或 `@nestjs/microservices` 的 gRPC 传输层，把 proto 编译成客户端。

```ts
// Nest 微服务方式
app.connectMicroservice({
  transport: Transport.GRPC,
  options: { package: 'user', protoPath: join(__dirname, 'user.proto') },
});
```

**展开**：

1. proto 文件是契约，前后端共享。
2. 客户端要处理 deadline、重试、连接复用。
3. 错误码要从 gRPC status 映射到 HTTP status。
4. 大响应要流式返回，避免一次性加载。

**追问：gRPC 的错误怎么转成 HTTP？** 建一张映射表：`NOT_FOUND` → 404，`INVALID_ARGUMENT` → 400，`UNAUTHENTICATED` → 401，`PERMISSION_DENIED` → 403，`DEADLINE_EXCEEDED` → 504。

**面经**：暂无已核对的公开原题。

### 13.Nest 的配置怎么管理？

**一句话**：用 `@nestjs/config`，支持 `.env` 文件、环境变量、配置校验和类型化访问。

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({ PORT: Joi.number().default(3000) }),
    }),
  ],
})
```

**展开**：

1. `isGlobal: true` 让所有模块都能注入 `ConfigService`，不用重复 import。
2. `validationSchema` 在启动时校验，配置缺失直接启动失败，比运行时才发现好。
3. 敏感配置用 secret 管理器（Vault、K8s Secret），不要写进 `.env` 提交。
4. 分环境用 `.env.development` / `.env.production`。

**追问：配置什么时候读取？** 模块初始化时。所以不要在模块顶层直接读 `process.env`，要用 `ConfigService` 注入，保证顺序正确。

**面经**：暂无已核对的公开原题。

### 14.Nest 怎么测试？

**一句话**：用 `@nestjs/testing` 的 `Test.createTestingModule` 构建测试模块，替换 provider 为 mock。

```ts
const module = await Test.createTestingModule({
  providers: [
    UserService,
    { provide: UserRepository, useValue: mockRepo },
  ],
}).compile();
```

**展开**：

1. 单元测试：只测 service，mock 掉 repository。
2. 集成测试：起完整模块，用 `supertest` 打 HTTP。
3. E2E：起整个应用，连真实数据库（或 testcontainers）。
4. `overrideProvider` 可以替换任意 provider，方便打桩。

**追问：为什么 Nest 的测试比 Express 容易？** 因为依赖注入让替换实现变成配置问题，不用 mock 模块系统（`jest.mock`）。Express 里要替换依赖通常得靠模块 mock 或全局变量。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 腾讯 · 微信基础部一面 | 有没有写过 NestJS；依赖注入和 Spring IoC 的关系 | 1、2、3 |
| 腾讯 · 微信基础部一面 | 团队接入层用 NestJS、后面是 C++ 微服务 | 11 |

来源：腾讯微信基础部一面 https://www.nowcoder.com/discuss/865669284599513088

## 这一篇没写的东西

- **GraphQL / WebSocket 网关**：属于集成层，面试问到再答。
- **TypeORM / Prisma 的具体用法**：ORM 属于数据库篇的延伸。
- **微服务传输层（Kafka、Redis、RabbitMQ）**：分布式篇的内容。
- **部署和容器化**：DevOps，不属于框架本身。
