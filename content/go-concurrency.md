# Go 并发

对标 Java 并发。GMP 已经在运行时篇，这里不再讲调度器结构。

答案不在这里。

## channel 和 select

有缓冲、无缓冲、关闭、nil、panic、`select` 并成一节。

要写的题：

1. 无缓冲和有缓冲在发送时等不等对方。
2. 关闭之后，发送、接收、再关闭分别怎样。
3. 对 nil channel 发送或接收会怎样。`select` 里的 nil channel 呢。
4. 什么情况 panic。

面经：

- channel 底层和 panic，出现率约 5.32%。channel 的作用约 4.33%。https://www.nowcoder.com/discuss/789864350730162176
- 关键词统计里 channel 约占 6.24%。https://www.nowcoder.com/discuss/752654728466534400
- 字节搜索后端二面：对已关闭的 channel 读写。https://www.nowcoder.com/discuss/668776138512052224
- 字节秋招一面：channel 是否并发安全；和 Mutex 的差别、各自用在哪。https://www.nowcoder.com/feed/main/detail/71e75505e34f43689ce98e20f78f3ed8
- 腾讯校招一面：有缓冲和无缓冲的区别。https://juejin.cn/post/7434352545870184485

## 锁，以及什么时候改用 channel

`Mutex`、`RWMutex`、`Once`、`WaitGroup`、`Pool`、`Map` 并成一节。data race 和 `-race` 并进这里。

要写的题：

1. 互斥锁和读写锁怎么选。
2. `sync.Once` 保证的是什么。
3. `sync.Pool` 里的对象为什么会消失。
4. 什么逻辑用锁，什么逻辑用 channel。
5. 数据竞争长什么样。`-race` 能报出什么。

## context

单独一节。要讲清它是不是并发安全。

要写的题：

1. 取消和超时怎么传下去。
2. context 本身是不是并发安全。值为什么不要拿来传业务参数。

面经：

- context 的实现、场景、是否并发安全，出现率约 3.33%，字节等。https://www.nowcoder.com/discuss/789864350730162176
