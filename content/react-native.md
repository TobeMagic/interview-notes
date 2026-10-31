# React Native

国内面经里它多半是项目追问，不是人人必问。三节够用。

答案不在这里。

## 架构

旧 Bridge、JSI、Fabric、TurboModules 并成一节。

要写的题：

1. 旧 Bridge 上一次调用要经过什么。为什么快输入会丢字。
2. JSI 拿掉了哪一步序列化。
3. Fabric 和 TurboModules 各管渲染和原生模块的什么。
4. 0.82 起不能再关掉新架构，这句话在面试里怎么说。

依据是 React Native 官方对新架构和 0.82 的说明，不是某一份中文题解。https://reactnative.dev/blog/2025/10/08/react-native-0.82

面经：

- 腾讯微信基础部一面追问简历里的 React 转 RN：两端适配、样式、打包。https://www.nowcoder.com/discuss/865669284599513088
- 字节一面（2025-10-09）：RN 开发的坑。https://www.kuazhi.com/post/716286102.html

## 列表

ScrollView、FlatList、FlashList 并成一节：全量渲染、窗口渲染、cell 复用。

要写的题：

1. 长列表为什么不能把子节点一次性放进 ScrollView。
2. FlatList 的 `keyExtractor`、`getItemLayout`、窗口大小各挡住什么。
3. FlashList 复用的是什么。

## 启动、Hermes、图片

并成一节。导航和热更新各留一小题，不展开成篇。

要写的题：

1. Hermes 改变的是启动、内存还是包体积。
2. 图片解码发生在哪一侧。
3. 热更新能换什么，不能换什么。
