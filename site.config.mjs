// 站点元数据：模块顺序、分组、对标关系、完稿状态。
// 新增一篇 = 在 content/ 放一个 md + 这里加一条。

export const SITE = {
  title: '八股志',
  subtitle: 'Interview Notes',
  description:
    '前端、Node、Go、PostgreSQL、MongoDB 的开源八股文笔记。每题先给一句能说出口的答案，公司原题挂在题下，过时的答案标出版本分界。',
  repo: 'https://github.com/TobeMagic/interview-notes',
  base: '/interview-notes/',
  license: 'MIT',
};

/**
 * 顺序即目录顺序。
 * status: 'done' 有正文；'outline' 只有题目大纲。
 * counterpart: 对标的 Java 侧模块，用于目录副标题。
 */
export const MODULES = [
  { slug: 'typescript',    group: '前端',   title: 'TypeScript',    counterpart: 'Java SE + 集合', status: 'done' },
  { slug: 'browser',       group: '前端',   title: '浏览器',         counterpart: 'JVM 的运行模型', status: 'outline' },
  { slug: 'react',         group: '前端',   title: 'React',         counterpart: 'Spring 的渲染模型', status: 'outline' },
  { slug: 'tooling',       group: '前端',   title: '工程化',         counterpart: '源站无对标篇', status: 'outline' },
  { slug: 'react-native',  group: '前端',   title: 'React Native',  counterpart: 'Spring 的端上版本', status: 'outline' },

  { slug: 'node-runtime',  group: 'Node',  title: 'Node 运行时',    counterpart: 'JVM + 并发', status: 'outline' },
  { slug: 'nestjs',        group: 'Node',  title: 'NestJS',        counterpart: 'Spring', status: 'outline' },

  { slug: 'go-language',   group: 'Go',    title: 'Go 语言',        counterpart: 'Java SE + 集合', status: 'done' },
  { slug: 'go-runtime',    group: 'Go',    title: 'Go 运行时',      counterpart: 'JVM', status: 'outline' },
  { slug: 'go-concurrency',group: 'Go',    title: 'Go 并发',        counterpart: 'Java 并发', status: 'outline' },
  { slug: 'grpc',          group: 'Go',    title: 'gRPC',          counterpart: '微服务远程调用', status: 'outline' },

  { slug: 'postgresql',    group: '数据库', title: 'PostgreSQL',    counterpart: 'MySQL 的章节，机制换掉', status: 'outline' },
  { slug: 'mongodb',       group: '数据库', title: 'MongoDB',       counterpart: '同一骨架，删掉纯 SQL 题', status: 'outline' },
];

export const GROUPS = ['前端', 'Node', 'Go', '数据库'];
