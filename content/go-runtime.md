# Go 运行时

对标 JVM。GMP 和 GC 各一节，不要拆成十个小点。

答案不在这里。

## GMP

G、M、P、work stealing、本地队列、协程和线程的差别并成一节。

要写的题：

1. G、M、P 各是什么。M 没有 P 时为什么不能跑 Go 代码。
2. 本地队列空了去哪拿。work stealing 偷的是什么。
3. 系统调用把 M 堵住时，P 怎么办。
4. 协程和线程差在栈和切换上。100 个 I/O 协程会不会拖死计算协程，用这个模型说。

面经：

- GMP 出现率约 8.65%，腾讯音乐、百度、Shopee 等。GC 相关两题合计更高，见下一节。https://www.nowcoder.com/discuss/789864350730162176
- 协程调度底层约 3.83%，协程和线程的区别约 3.83%。同上。
- 字节搜索后端一面：GMP，work stealing 的作用；协程和线程的区别。二面又问了一遍 GMP。https://www.nowcoder.com/discuss/668776138512052224
- 字节秋招一面：GMP；P 的本地队列空或者不空时怎么调度。https://www.nowcoder.com/feed/main/detail/71e75505e34f43689ce98e20f78f3ed8
- 腾讯校招一面：GMP；什么时候把 G 放进全局队列。https://juejin.cn/post/7434352545870184485

## GC

三色标记、混合写屏障、STW、`GOGC` 并成一节。

要写的题：

1. 白、灰、黑各表示什么。
2. 并发标记时用户改了指针，写屏障挡住哪种漏标。
3. 现在还有哪些很短的停顿。`GOGC` 和 `GOMEMLIMIT` 调的是什么。

面经：

- 三色标记和写屏障，出现率约 8.99%，百度、字节、腾讯音乐等。另一题「简述 GC」约 6.66%，字节、滴滴等。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯校招一面：GC 扫描是不是并发的；根对象有哪些。https://juejin.cn/post/7434352545870184485

## 排查

逃逸分析和 pprof、goroutine 泄漏并成一节。

要写的题：

1. 什么写法会逃到堆上。用什么命令看。
2. goroutine 泄漏长什么样。pprof 里先看哪。

面经：

- 内存逃逸的排查，出现率约 3.83%，小米、深信服等。https://www.nowcoder.com/discuss/789864350730162176
- 腾讯校招一面：说说逃逸分析。https://juejin.cn/post/7434352545870184485
