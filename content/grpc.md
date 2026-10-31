# gRPC

对标微服务里的远程调用。Gin 不单开，收在篇末。

排版约定：每题先给一句能说出口的答案，再展开，再列会被追问什么。题下紧跟已核对的公开原题。

## RPC 基础

### 1.🌟RPC 和 REST 有什么区别？

| | RPC（gRPC） | REST |
| --- | --- | --- |
| 抽象 | 调远程函数 | 操作资源 |
| 协议 | HTTP/2（gRPC） | HTTP/1.1 或 2 |
| 序列化 | Protobuf（二进制） | JSON（文本） |
| 接口定义 | `.proto`，强类型 | OpenAPI（可选） |
| 浏览器支持 | 需要 grpc-web 代理 | 原生 |
| 流式 | 原生支持四种流 | 需要 SSE / WebSocket |
| 调试 | 需要专门工具 | curl 就行 |

**一句话**：RPC 是「像调本地函数一样调远程」，REST 是「操作资源」。内部服务间调用偏向 RPC，对外 API 偏向 REST。

**展开**：

1. gRPC 的强契约让客户端和服务端能独立演进，改字段有明确规则。
2. Protobuf 比 JSON 小，解析快，但不可读，调试要工具。
3. gRPC 的流式能力是 REST 做不到的（虽然有 SSE 和 WebSocket 补）。

**追问：什么时候不该用 gRPC？** 浏览器直接调用（要 grpc-web 代理）、对外公开 API（生态和可调试性差）、团队没有 proto 工具链。

**面经**：暂无已核对的公开原题。

### 2.🌟Protobuf 为什么比 JSON 小？

**一句话**：字段名不传输，只传字段号；整数用变长编码；没有引号、空格、括号这些结构字符。

**展开**：

1. JSON 每个字段都带名字：`{"userName":"x"}` 有 17 字节。
2. Protobuf 只传字段号 + 类型 + 值，字段名在 `.proto` 里定义，双方都知道。
3. 整数用 varint：小数字占 1 字节，大数字才多占。
4. 默认值不传输（proto3），空字段不占空间。

**追问：Protobuf 有什么缺点？** 不可读（要 decode 才能看）、需要 schema（没有 `.proto` 就解不出来）、改字段有兼容规则要遵守、不适合嵌套很深的动态结构。

**追问：`string` 和 `bytes` 在编码上有什么区别？** 都是长度前缀 + 内容，区别只是语义和校验（`string` 要求 UTF-8）。性能上没有区别。

**面经**：暂无已核对的公开原题。

### 3.🌟Protobuf 的字段号有什么讲究？

**一句话**：字段号是契约的一部分，一旦上线不能改、不能复用。1–15 号编码更省空间，留给高频字段。

**展开**：

1. 字段号 1–15 用 1 字节编码，16–2047 用 2 字节。
2. 19000–19999 是保留号，不能用。
3. 删字段要 `reserved`，防止后人复用导致数据错乱。
4. 改类型要谨慎：`int32` 和 `int64` 兼容（varint），但 `fixed64` 和 `string` 不兼容。

```proto
message User {
  reserved 5, 8 to 10;
  reserved "old_field";
  int64 id = 1;
  string name = 2;
}
```

**追问：加了新字段，老客户端会怎样？** 会忽略不认识的字段（存在 unknown fields 里）。所以加字段是安全的后向兼容。

**追问：能把 `int32` 改成 `int64` 吗？** 能，varint 编码兼容。但反过来如果值超过 int32 范围会截断。`string` 改 `bytes` 也兼容（都是长度前缀）。

**面经**：暂无已核对的公开原题。

## HTTP/2 与传输

### 4.🌟为什么 gRPC 用 HTTP/2？

**一句话**：HTTP/2 的多路复用让一个连接上并行多个请求，避免 HTTP/1.1 的队头阻塞；二进制分帧天然适合流式。

**展开**：

1. **多路复用**：一个 TCP 连接上多个 stream，互不阻塞。
2. **二进制分帧**：帧有类型和 stream id，容易做流式。
3. **头部压缩**（HPACK）：重复的头只传一次。
4. **服务器推送**（gRPC 没怎么用）。

**追问：HTTP/2 还有队头阻塞吗？** TCP 层还有：一个包丢了，整条连接的所有 stream 都等重传。QUIC（HTTP/3）解决了这个。

**追问：gRPC 能跑在 HTTP/1.1 上吗？** 不能直接用。grpc-web 是「用 HTTP/1.1 模拟」的兼容方案，性能损失明显。

**面经**：暂无已核对的公开原题。

### 5.🌟gRPC 有哪四种流？

| 类型 | 客户端 | 服务端 | 典型场景 |
| --- | --- | --- | --- |
| 一元（Unary） | 1 个请求 | 1 个响应 | 普通 RPC |
| 服务端流 | 1 个请求 | N 个响应 | 订阅、大结果分页推送 |
| 客户端流 | N 个请求 | 1 个响应 | 上传、批量写 |
| 双向流 | N 个请求 | N 个响应 | 实时对话、协同编辑 |

**一句话**：按「哪一边要发多条」分四种，双向流的两个方向是独立的，不互相等。

**展开**：

1. 服务端流用 `stream` 关键字修饰返回值：`rpc List(Req) returns (stream Item)`。
2. 客户端流修饰参数：`rpc Upload(stream Chunk) returns (Ack)`。
3. 双向流两边都修饰。
4. 流的生命周期由客户端关闭发送方向（`CloseSend`）或服务端关闭来结束。

**追问：双向流的两个方向真的独立吗？** 在协议层是独立的（各自的 stream），但业务上可能互相依赖。实现时要避免「双方都在等对方先发」的死锁。

**追问：流式传输怎么处理错误？** 流开始后 HTTP 状态码已经发了（200），错误要通过 trailer 里的 `grpc-status` 传。客户端要在流结束后检查。

**面经**：暂无已核对的公开原题。

### 6.gRPC 的消息大小有限制吗？

**一句话**：默认接收上限 4MB，发送上限不限制（但受底层限制）。可以用 `MaxRecvMsgSize` 调。

```go
grpc.NewServer(grpc.MaxRecvMsgSize(16 * 1024 * 1024))
```

**展开**：

1. 4MB 是保守默认值，防止大消息打爆内存。
2. 超过限制会返回 `ResourceExhausted`。
3. 大文件不应该走普通 RPC，应该用流式分块。
4. 调大限制要配合内存评估，别设成无限制。

**追问：为什么要有这个限制？** 因为消息要整个解码到内存。不受限的话，一个恶意或异常的大消息就能 OOM。这是防御性设计。

**面经**：暂无已核对的公开原题。

## 超时、取消、重试

### 7.🌟deadline 是怎么传播的？

**一句话**：客户端的 deadline 会随请求头传到服务端，服务端拿到的是「剩余时间」，不是重新计时。

**展开**：

1. gRPC 用 `grpc-timeout` 头传剩余时间。
2. 服务端应该用这个 deadline 创建子 context，传给下游。
3. 下游再往下传，时间持续递减。
4. 任何一层超时，整条链路一起取消。

**追问：为什么不设 deadline 很危险？** 一次卡住的调用会一直占着连接、goroutine、内存。下游慢会沿着调用链向上放大，最终拖垮整个服务。所以生产环境应该强制设 deadline。

**追问：deadline 和超时有什么区别？** deadline 是绝对时间点（在链路上传递），超时是相对时长（每层各自算）。gRPC 用 deadline 是为了让整条链路共享同一个终止时间。

**面经**：腾讯 C++ 一面：deadline、取消和重试怎么互相影响。https://www.nowcoder.com/discuss/907356052906131456

### 8.🌟重试要注意什么？

**一句话**：重试吃的是同一段剩余 deadline，且只有幂等方法能重试。

**展开**：

1. 每次重试都消耗剩余时间，不会重置 deadline。
2. 非幂等操作（创建订单、扣款）重试会造成重复副作用。
3. gRPC 有内置重试策略（`service config`），也可以用拦截器自己实现。
4. 要加退避（backoff），否则重试风暴会压垮下游。

```json
{
  "methodConfig": [{
    "name": [{"service": "UserService"}],
    "retryPolicy": {
      "maxAttempts": 3,
      "initialBackoff": "0.1s",
      "maxBackoff": "1s",
      "backoffMultiplier": 2,
      "retryableStatusCodes": ["UNAVAILABLE"]
    }
  }]
}
```

**追问：哪些错误码该重试？** `UNAVAILABLE`、`DEADLINE_EXCEEDED`（如果还有剩余时间）、`RESOURCE_EXHAUSTED`（限流）。`INVALID_ARGUMENT`、`NOT_FOUND`、`PERMISSION_DENIED` 不该重试。

**追问：重试会不会放大故障？** 会。下游已经过载时，重试会加剧。所以要配「重试预算」（重试请求不超过总请求的 10%）和熔断。

**面经**：腾讯 C++ 一面：deadline、取消和重试怎么互相影响。https://www.nowcoder.com/discuss/907356052906131456

### 9.服务端怎么感知客户端取消？

**一句话**：监听 `ctx.Done()`，客户端取消时 ctx 会被取消，服务端应该停止计算并释放资源。

```go
func (s *Server) LongTask(ctx context.Context, req *Req) (*Resp, error) {
    for {
        select {
        case <-ctx.Done():
            return nil, status.FromContextError(ctx.Err()).Err()
        default:
            // 继续计算
        }
    }
}
```

**追问：不监听会怎样？** 客户端早就断了，服务端还在跑，白烧 CPU 和内存。长任务、流式处理尤其要注意。

**追问：流式 RPC 怎么检测取消？** `stream.Context().Done()`。发送时也会返回错误（`io.EOF` 或 `Canceled`），可以作为信号。

**面经**：暂无已核对的公开原题。

## 连接与负载均衡

### 10.🌟gRPC 的连接复用是怎么做的？

**一句话**：一个 `ClientConn` 复用底层 HTTP/2 连接，多路复用多个并发 RPC。

**展开**：

1. `grpc.Dial` 创建 `ClientConn`，应该长期持有，不要每次调用都建。
2. 底层连接由 gRPC 管理，断了会自动重连。
3. `WithBlock()` 让 Dial 阻塞到连接就绪，否则是懒连接。
4. 连接数不是越多越好，一个连接就能跑很多并发流。

**追问：什么时候需要多个连接？** 单连接带宽成为瓶颈时（比如大流量传输），或者需要连接到不同后端实例做负载均衡时。

**追问：`Dial` 返回错误代表连接失败吗？** 默认不是，它是懒连接，返回的 `ClientConn` 会在后台重连。要立即验证用 `WithBlock()` + `WithTimeout()`。

**面经**：暂无已核对的公开原题。

### 11.gRPC 的负载均衡怎么做？

**一句话**：客户端侧负载均衡（gRPC 内置）或服务端侧（通过代理/网关）。

**展开**：

1. **客户端侧**：`ClientConn` 通过 resolver 拿到后端地址列表，按 `pick_first` / `round_robin` 等策略选择。
2. **服务端侧**：用 Envoy / Nginx 做代理，客户端连代理，代理分发。
3. K8s 里常见做法是 headless service + 客户端 LB，或者用 service mesh（Istio）。
4. 客户端 LB 需要服务发现（DNS、etcd、Consul）。

**追问：K8s 默认的 Service 负载均衡对 gRPC 有什么问题？** Service 是 L4 负载均衡，一个 TCP 连接固定到一个 Pod。gRPC 复用一个长连接，结果所有请求都打到同一个 Pod。解法是用 headless service + 客户端 LB，或者用 L7 代理。

**面经**：暂无已核对的公开原题。

### 12.怎么优雅关闭 gRPC 服务？

```go
srv := grpc.NewServer()
// ... 注册服务
go srv.Serve(lis)

// 收到退出信号
srv.GracefulStop()   // 停止接受新连接，等已有 RPC 完成
```

**一句话**：用 `GracefulStop()` 停止接受新调用并等待进行中的 RPC 完成，超时后再 `Stop()` 强制关闭。

**展开**：

1. `GracefulStop` 会等所有活跃 RPC 结束，可能等很久。
2. 要配超时：`GracefulStop` 放 goroutine，超时后 `Stop()`。
3. 客户端要处理 `UNAVAILABLE`，配合重试。
4. K8s 里要配 `preStop`，等 Service 摘除后再关。

**追问：为什么不能直接 `Stop()`？** 会中断进行中的 RPC，客户端收到 `Unavailable`，用户体验差。优雅关闭是发布不抖动的前提。

**面经**：暂无已核对的公开原题。

## 工程实践

### 13.拦截器能做什么？

**一句话**：在 RPC 前后插入逻辑，做日志、鉴权、超时、重试、指标、链路追踪。

```go
func loggingInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
    start := time.Now()
    resp, err := handler(ctx, req)
    log.Printf("%s %v %v", info.FullMethod, time.Since(start), err)
    return resp, err
}
```

**展开**：

1. 分一元拦截器和流拦截器，流拦截器要包 `ServerStream`。
2. 客户端也有拦截器，可以做统一的重试、鉴权头注入。
3. 拦截器顺序有讲究：鉴权要在业务之前，日志要包住全部。
4. 用 `grpc.ChainUnaryInterceptor` 组合多个。

**追问：拦截器里能改请求体吗？** 能，但要小心。改 `req` 会影响后续拦截器。通常只读或者改 metadata。

**面经**：暂无已核对的公开原题。

### 14.gRPC 怎么做鉴权？

**一句话**：通过 metadata 传 token，服务端拦截器校验。传输层用 TLS。

**展开**：

1. 客户端：`metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)`。
2. 服务端：`metadata.FromIncomingContext(ctx)` 读出来校验。
3. 传输层安全用 `credentials.NewTLS()`，别用明文。
4. 服务间鉴权可以用 mTLS，或者签名的 JWT。

**追问：metadata 和 HTTP header 是什么关系？** metadata 就是 HTTP/2 的 header，只是 gRPC 封装了一层。`authorization`、`content-type` 这些是保留的，自定义的通常加 `x-` 前缀。

**面经**：暂无已核对的公开原题。

### 15.`net/http` 和 Gin 差在哪？

| | `net/http` | Gin |
| --- | --- | --- |
| 路由 | Go 1.22 起支持方法和路径参数 | 更丰富的路由组、通配 |
| 参数绑定 | 手动 | `ShouldBindJSON` 等 |
| 中间件 | `http.Handler` 包装 | `gin.HandlerFunc` + 路由组 |
| 性能 | 标准库，够用 | 基于 radix tree，略快 |
| 生态 | 标准 | 中间件丰富 |

**一句话**：Go 1.22 之后标准库的路由已经够用，Gin 多的是参数绑定、路由组、中间件生态这些便利。

**追问：Kratos、go-zero、Hertz 多的是什么？** 服务治理：服务发现、配置中心、链路追踪、限流熔断、代码生成。HTTP 语义本身没有变，它们是在标准库之上加了一层骨架。

**面经**：暂无已核对的公开原题。

## 面经汇总索引

| 公司 / 轮次 | 原题 | 对应题号 |
| --- | --- | --- |
| 腾讯 · C++ 一面 | deadline、取消、重试怎么互相影响 | 7、8 |

来源：腾讯 C++ 一面 https://www.nowcoder.com/discuss/907356052906131456

## 这一篇没写的东西

- **Protocol Buffers 的完整语法**：只讲编码和兼容性，语法查官方文档。
- **grpc-web 的具体配置**：属于前端集成，面试很少深问。
- **服务网格（Istio、Linkerd）**：基础设施层，不属于 gRPC 本身。
- **具体的服务治理框架**：Kratos、go-zero 只点一句，不展开。
