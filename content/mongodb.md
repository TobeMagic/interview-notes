# MongoDB

不把 MySQL 的 196 条原题换个库名。两套后端共用这篇。

答案不在这里。

## 文档模型

嵌入还是引用并成一节。

要写的题：

1. BSON 和 JSON 差在类型和长度。
2. 什么时候嵌进一个文档，什么时候拆成引用。
3. 文档变大之后，一次更新要写回多少。

## 存储

「B 树、B+ 树，还是 LSM」并成一节。Journal 并进这里，不单开日志篇。

要写的题：

1. WiredTiger 默认把集合放在什么树上。生产路径不是 LSM。
2. 得物面经里「MySQL 用 B+、MongoDB 用 B 树」这句话哪里含糊。叶子里放的是文档还是指针，要分开说。
3. 写入先到缓存和 journal，检查点再刷数据页。这和 MySQL 的 Buffer Pool 像在哪。
4. 缓存装不下工作集时，延迟出在哪。

面经：

- 得物面经被 javabetter MySQL 篇引用过：MySQL 索引和 MongoDB 为什么用 B 树，二者比较。原题在公开 MySQL 篇的索引一节。https://javabetter.cn/sidebar/sanfene/mysql.html
- 牛客关键词统计里，分片和底层实现是进阶题，存储引擎点名 WiredTiger 和 journal。https://www.nowcoder.com/discuss/799252247212294144

## 副本集

单独一节。

要写的题：

1. Primary、Secondary、Arbiter 各做什么。
2. oplog 像 MySQL 的哪份日志，不像哪份。
3. 主挂了，新主怎么选出来。

## 分片

单独一节。和副本集不要并成一篇，一个是副本，一个是把数据切开。

要写的题：

1. Mongos、Config、Shard 各存什么。
2. 范围分片和哈希分片，谁怕单调递增的片键。
3. 均衡器在搬什么。

面经：

- 牛客关键词统计把分片架构、片键选择、避免单调递增片键标成高频。https://www.nowcoder.com/discuss/799252247212294144

## 追问，挂在存储后面

1. `explain` 里没有索引时长什么样。
2. 大集合删除为什么会拖长。工作集超过缓存时先看什么。
