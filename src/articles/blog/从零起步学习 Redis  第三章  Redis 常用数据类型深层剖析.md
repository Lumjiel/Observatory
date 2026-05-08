前言：

在前文中，我们已经初步认识了 Redis 并完成了本地环境配置，接下来将开启 Redis 核心知识点的深入学习 ——Redis 常用数据类型的底层实现。不同于表面的 API 使用，深入底层能让我们理解 Redis 的性能优化逻辑、内存占用原理，更是后端面试中 Redis 相关考点的核心。

本文将整合两章内容，一次性讲解 Redis 中 5 种常用数据类型（String、List、Hash、Set、Zset）的底层实现、编码转换、优缺点及实际应用场景，从底层结构体到项目实战，层层递进，适合零基础入门，也适合巩固核心知识点。

---

## 先掌握：Redis 数据类型的高层共性 ——redisObject

在讲解具体数据类型之前，必须先明确一个核心概念：**Redis 中所有键值对的 value，本质上都是一个 redisObject（简称 robj）** 。

无论是 String、List 还是 Hash，Redis 都会先创建一个 redisObject 对象，通过该对象的字段，指向真正存储数据的底层结构。这也是 Redis 能灵活支持多种数据类型、实现高效内存管理的基础。

### redisObject 结构体（核心字段解析）

```c
typedef struct redisObject {
    unsigned type:4;      // 数据类型（string, list, hash, set, zset）
    unsigned encoding:4;  // 编码方式（底层存储结构，如int, embstr, ziplist等）
    int refcount;         // 引用计数（Redis垃圾回收机制的核心）
    void *ptr;            // 指针，指向实际存储数据的底层结构
} robj;
```

### 关键说明

1. `type`：标识当前 value 的数据类型（5 种常用类型对应 5 种 type 值）；
2. `encoding`：标识当前 value 的底层存储编码（同一数据类型可对应多种编码，Redis 会根据数据量自动切换，目的是节省内存、提升性能）；
3. `refcount`：引用计数，用于内存回收 —— 当引用数为 0 时，Redis 会自动释放该对象占用的内存；
4. `ptr`：核心指针，指向真正的数据（比如 String 类型指向 SDS，List 类型指向 quicklist 等）。

简单来说：我们在 Redis 中看到的 “字符串”“列表”，本质上都是 “redisObject + 底层数据结构” 的组合，Redis 通过这种设计，实现了数据类型的灵活切换和高效管理。

---

## 一、String（字符串）——Redis 最基础的数据类型

String 是 Redis 最常用、最基础的数据类型，支持存储二进制安全数据（如图片、视频片段），最大存储容量为 512MB。无论是缓存用户信息、存储验证码，还是实现计数器，String 都能满足需求。

### 1. 内存组织示意

```plaintext

dictEntry （哈希表节点，存储键值对）
 ├── key -> redisObject(type=string, ptr->SDS("mykey"))  // 键的robj
 └── val -> redisObject(type=string, encoding=embstr, ptr->SDS("hello"))  // 值的robj
```

### 2. 底层实现：SDS（Simple Dynamic String）

Redis 没有使用 C 语言原生的字符串（char*），而是自定义了一种名为 SDS 的动态字符串，用于解决 C 字符串的诸多缺陷。

#### SDS 结构体（以 sdshdr8 为例，最常用）

```c

struct __attribute__ ((__packed__)) sdshdr8 {
    uint8_t len;    // 当前字符串的实际长度（O(1)获取）
    uint8_t alloc;  // 分配给buf的总空间（减去1，预留\0结尾）
    unsigned char flags; // 标记SDS的类型（sdshdr8/sdshdr16等，根据长度选择）
    char buf[];     // 存储实际字符串数据的字节数组（二进制安全）
};
```

#### SDS vs C 字符串（核心优势）

|特性|C 字符串|SDS|
|---|---|---|
|二进制安全|否（以 \0 结尾，无法存储含 \0 的二进制数据）|是（通过 len 标识长度，不依赖 \0）|
|获取长度|O (N)（需遍历到 \0）|O (1)（直接读取 len 字段）|
|动态扩容|繁琐，需手动 realloc，易内存泄漏|自动扩容，预分配空间，减少 realloc 次数|
|缓冲区溢出|易发生（如 strcat 未提前分配足够空间）|不会发生（扩容前检查空间）|

### 3. String 的 3 种编码方式（自动切换）

Redis 会根据 String 的内容和长度，自动选择 3 种编码方式，核心目的是**节省内存**。

|编码方式|适用场景|存储特点|备注|
|---|---|---|---|
|int|存储整数（如 123、456）|直接将整数存到 redisObject 的 ptr 字段（无需额外分配 SDS）|最节省内存，当整数超出 long 范围，自动转为 raw|
|embstr|存储短字符串（长度≤44 字节）|一块连续内存：[robj + sdshdr + buf]|少一次内存分配，缓存友好，**不可修改**（修改后自动转为 raw）|
|raw|存储长字符串（长度 > 44 字节）|两块独立内存：[robj] 和 [sdshdr + buf]|灵活，支持任意修改，但多一次内存分配|

### 4. 核心总结

String 的本质是**二进制安全的动态字节数组**，底层由 SDS 实现，通过 3 种编码方式的自动切换，在内存占用和操作性能之间达到平衡。

---

## 二、List（列表）—— 有序可重复的字符串集合

Redis List 是一个**有序、可重复**的字符串集合，支持在列表的头部（left）和尾部（right）进行插入、删除操作（O (1) 复杂度），也支持通过索引访问元素（O (N) 复杂度），适合实现队列、栈、消息列表等场景。

List 的底层实现并非固定不变，而是随着数据量的变化动态演变，经历了 “ziplist → linkedlist → quicklist” 三个阶段，当前 Redis（3.2+）的主流实现是 quicklist。

### 1. 早期实现：ziplist（压缩列表）

ziplist 是一种紧凑的连续内存结构，设计目标是**最大程度节省内存**，适合存储少量小元素。

#### 核心特点

- 内存紧凑：所有元素连续存储，无指针开销；
- 变长编码：每个元素前缀记录长度，支持不同长度的字符串和整数；
- 双向遍历：通过每个元素记录上一个元素的长度，实现双向遍历；
- 缺点：增删改性能差（需移动大量内存）、存在连锁更新问题、不适合存储大元素或大量元素。

### 2. 早期实现：linkedlist（双向链表）

当 ziplist 的元素数量或元素大小超过阈值，List 会转为 linkedlist（Redis 内部实现为 adlist），一种传统的双向链表。

#### 结构体示意

```c
// 链表节点
typedef struct listNode {
    struct listNode *prev; // 前驱节点指针
    struct listNode *next; // 后继节点指针
    void *value;           // 节点存储的值（指向robj）
} listNode;

// 链表本身
typedef struct list {
    listNode *head;        // 链表头节点
    listNode *tail;        // 链表尾节点
    unsigned long len;     // 链表长度
    // 其他辅助字段（如排序函数、释放函数）
} list;
```

#### 核心特点

- 节点独立：每个节点单独分配内存，通过指针连接；
- 优点：头部 / 尾部增删 O (1)、适合存储大元素；
- 缺点：内存开销大（每个节点需两个指针）、缓存不友好（节点内存不连续）。

### 3. 当前主流实现：quicklist（快速列表）

Redis 3.2 版本后，quicklist 成为 List 的默认底层实现，它**结合了 ziplist 的内存效率和 linkedlist 的操作效率**，是两者的最优结合。

#### 核心结构（结构体示意）

```c

// 快速列表本身
typedef struct quicklist {
    quicklistNode *head; // 链表头节点
    quicklistNode *tail; // 链表尾节点
    unsigned long len;   // 所有ziplist包含的元素总数
    unsigned int count;  // quicklistNode的数量
    int fill : 16;       // ziplist填充因子（配置项：list-max-ziplist-size）
    unsigned int compress : 16; // 压缩深度（配置项：list-compress-depth）
} quicklist;

// 快速列表节点（每个节点对应一个ziplist）
typedef struct quicklistNode {
    struct quicklistNode *prev; // 前驱节点
    struct quicklistNode *next; // 后继节点
    unsigned char *zl;          // 指向当前节点的ziplist
    unsigned int sz;            // ziplist的字节大小
    unsigned int count : 16;    // ziplist中的元素数量
    // 其他辅助字段（编码、压缩状态等）
} quicklistNode;
```

#### 工作原理

1. quicklist 是一个双向链表，每个节点（quicklistNode）不直接存储元素，而是存储一个完整的 ziplist；
2. 每个 ziplist 内部存储多个实际的 List 元素，实现局部内存连续；
3. 通过配置参数控制 ziplist 的大小和压缩深度，平衡内存和性能。

#### 关键配置参数

- `list-max-ziplist-size`：控制每个 quicklistNode 中 ziplist 的大小（正数 = 元素个数，负数 = 字节大小，默认 - 2=8KB）；
- `list-compress-depth`：控制 quicklist 的压缩深度（0 = 不压缩，1 = 头尾各 1 个节点不压缩，其余压缩）。

#### 核心优点

- 内存效率高：继承 ziplist 的紧凑存储，减少指针开销；
- 操作效率高：头尾增删 O (1)，中间增删开销可控（ziplist 大小有限）；
- 缓存友好：ziplist 内部连续内存，提升 CPU 缓存命中率。

### 4. 核心总结

List 的底层实现是 “空间与性能的平衡”：少量小元素用 ziplist 节省内存，大量或大元素用 linkedlist 保证操作效率，当前通过 quicklist 实现了两者的最优结合，兼顾内存和性能。

---

## 三、Hash（哈希）—— 适合存储对象的数据类型

Redis Hash 是一个**键值对的集合**，可以理解为 “哈希表中的哈希表”，适合存储对象（如用户信息、商品信息），支持单独操作对象的某个字段，无需修改整个对象，比用 String 存储 JSON 更高效。

Hash 的底层实现同样是双结构，根据元素数量和大小自动切换：ziplist（3.2 + 后为 listpack）和 hashtable。

### 1. 底层实现 1：ziplist/listpack（压缩列表）

当 Hash 中的键值对数量少、field 和 value 都较小时，Redis 会使用 ziplist（3.2 + 后优化为 listpack，解决 ziplist 的连锁更新问题）存储。

#### 存储方式

field 和 value 交替存储在连续内存中，按 “field1 → value1 → field2 → value2” 的顺序紧凑排列。

#### 触发条件（默认配置）

- `hash-max-ziplist-entries`：默认 512，Hash 中键值对数量≤512；
- `hash-max-ziplist-value`：默认 64 字节，单个 field/value 的长度≤64 字节；
    
    超过任一阈值，自动转为 hashtable。

#### 优点 & 缺点

- 优点：内存紧凑、缓存友好，适合小对象存储；
- 缺点：查找效率 O (N)（需线性扫描），数据量大会导致性能下降。

### 2. 底层实现 2：hashtable（哈希表）

当 Hash 中的键值对数量多、或 field/value 较大时，自动转为 hashtable 存储，本质是 Redis 内部的 dict（字典）结构。

#### 核心原理

hashtable 底层采用 “数组 + 链地址法” 实现，解决哈希冲突：

- 数组（哈希桶）：存储链表的头节点；
- 链表：当多个 field 哈希值相同时，通过链表连接，避免冲突；
- 支持 rehash（扩容 / 缩容），保证查找效率接近 O (1)。

#### 优点 & 缺点

- 优点：查找、插入、删除的平均复杂度 O (1)，适合大数据量；
- 缺点：内存开销大（哈希桶、链表指针占用额外内存）。

### 3. Hash vs String（存储对象对比）

|存储方式|优点|缺点|
|---|---|---|
|String（JSON）|实现简单，适合小对象|修改单个字段需覆盖整个 JSON，内存浪费|
|Hash|可单独操作字段，内存占用少，效率高|实现稍复杂，不适合存储嵌套对象|

### 4. 项目应用场景（高频）

1. 缓存对象数据（首选）：存储用户信息、商品信息等，支持单独更新字段；
    
    ```bash
    # 存储用户1001的信息
    HSET user:1001 name "Tom" age "18" gender "male"
    # 获取单个字段
    HGET user:1001 name
    # 获取所有字段
    HGETALL user:1001
    ```
    
1. 多维度计数器：存储文章浏览量、点赞数、商品销量等；
    ```bash
    # 文章1001的浏览量+1、点赞数+1
    HINCRBY article:1001:stats views 1
    HINCRBY article:1001:stats likes 1
    ```
    
2. 系统配置 / 元数据：存储系统参数，支持单独修改某个配置；
3. 购物车：存储用户购物车信息，高效支持单个商品的增删改查。

### 5. 核心总结

Hash 是存储对象的最优选择，通过 ziplist/listpack 和 hashtable 的自动切换，兼顾小数据量的内存效率和大数据量的操作效率，是项目中最常用的 Redis 数据类型之一。

---

## 四、Set（集合）—— 无序去重的字符串集合

Redis Set 是一个**无序、不重复**的字符串集合，支持交集、并集、差集等集合运算，适合实现去重、标签、关注关系等场景。

Set 的底层实现同样是双结构：intset（整数集合）和 hashtable，根据元素类型和数量自动切换。

### 1. 底层实现 1：intset（整数集合）

当 Set 中的所有元素都是整数，且数量较少时，Redis 会使用 intset 存储，本质是一个紧凑的有序整数数组。

#### 触发条件（默认配置）

- `set-max-intset-entries`：默认 512，元素数量≤512；
- 所有元素都是整数（int16_t/int32_t/int64_t）；
    
    超过阈值或包含非整数元素，自动转为 hashtable。

#### 核心特点

- 内存紧凑：有序存储，无重复元素，节省内存；
- 查找高效：支持二分查找，复杂度 O (log N)；
- 缺点：只支持整数，增删元素可能需要扩容（移动内存）。

### 2. 底层实现 2：hashtable（哈希表）

当 Set 中包含非整数元素，或元素数量超过阈值时，自动转为 hashtable 存储。

#### 存储方式

每个元素作为 hashtable 的 key，value 设为 NULL（仅用 key 保证去重），利用 hashtable 的特性实现 O (1) 的增删改查。

#### 优点 & 缺点

- 优点：支持任意字符串元素，增删改查平均复杂度 O (1)；
- 缺点：内存开销比 intset 大（哈希桶、指针占用内存）。

### 3. 项目应用场景（高频）

1. 去重功能：存储每日访问 IP、用户 UV 统计；
    
    ```bash
    # 存储今日访问IP（自动去重）
    SADD ip:today "192.168.1.1" "192.168.1.2"
    # 统计今日独立IP数
    SCARD ip:today
    ```
    
1. 用户标签 / 兴趣匹配：存储用户的兴趣标签，求共同兴趣；
    
    ```bash
    # 给用户1001添加兴趣标签
    SADD user:1001:tags "sports" "music" "travel"
    # 求用户1001和1002的共同兴趣
    SINTER user:1001:tags user:1002:tags
    ```
    
2. 关注 / 粉丝关系：存储用户的关注列表和粉丝列表；
3. 黑名单 / 白名单：存储封禁用户 ID、允许访问的 IP 等；
4. 抽奖系统：随机抽取元素，支持抽出后删除。

### 4. 核心总结

Set 的核心价值是 “去重” 和 “集合运算”，通过 intset 和 hashtable 的自动切换，兼顾整数元素的内存效率和字符串元素的灵活性，是实现去重、标签等场景的最优选择。

---

## 五、Zset（有序集合）—— 有序去重的 “排行榜” 神器

Redis Zset（Sorted Set）是一个**有序、不重复**的字符串集合，每个元素都关联一个 score（分数），Redis 通过 score 对元素进行排序，支持按 score 范围查询、按排名查询，是实现排行榜、延时队列的核心数据类型。

Zset 的底层实现同样是双结构：ziplist/listpack 和 skiplist（跳表）+ dict，根据元素数量和大小自动切换。

### 1. 底层实现 1：ziplist/listpack（压缩列表）

当 Zset 中的元素数量少、member 和 score 都较小时，使用 ziplist（3.2 + 后为 listpack）存储。

#### 存储方式

元素按 score 升序排列，每个元素按 “score → member” 的顺序紧凑存储在连续内存中。

#### 触发条件（默认配置）

- `zset-max-ziplist-entries`：默认 128，元素数量≤128；
- `zset-max-ziplist-value`：默认 64 字节，单个 member/score 的长度≤64 字节；
    
    超过任一阈值，自动转为 skiplist + dict。

#### 优点 & 缺点

- 优点：内存紧凑、缓存友好，适合小数据量；
- 缺点：查找、排序效率 O (N)，不适合大数据量。

### 2. 底层实现 2：skiplist（跳表）+ dict（哈希表）

当 Zset 的数据量较大或元素较复杂时，Redis 会使用 “跳表 + 哈希表” 的双结构，兼顾排序和查找效率。

#### 双结构分工

- 跳表（skiplist）：按 score 升序存储所有元素，支持范围查询、按排名查询（核心用于排序）；
- 哈希表（dict）：存储 member → score 的映射，支持 O (1) 的查找、修改 score 操作（核心用于快速定位）。

#### 跳表（skiplist）核心原理（简化）

跳表是一种有序数据结构，通过 “多层索引” 实现快速查找，本质是 “多层有序链表”：

1. 底层（Level 0）是完整的有序链表，每个节点包含 member 和 score；
2. 上层索引是底层链表的 “跳跃采样”，用于快速定位；
3. 查找时，从最高层索引开始，快速跳过无效节点，最终定位到目标元素（复杂度 O (log N)）。

#### 跳表的核心操作（简化）

- 查找：从高层到低层，逐步缩小范围，最终找到目标元素；
- 插入：先查找定位，记录每层前驱节点，随机生成节点高度，插入到对应层级；
- 删除：先查找定位，记录每层前驱节点，修改指针跳过目标节点。

#### 优点 & 缺点

- 优点：范围查询效率高、排序灵活，查找、插入、删除复杂度 O (log N)；
- 缺点：内存开销大（多层索引占用额外内存）。

### 3. 项目应用场景（高频）

1. 排行榜（经典场景）：游戏积分榜、热门内容排名、用户贡献榜；
    
    ```bash
    # 存储用户积分
    ZADD rank 100 user1 200 user2 150 user3
    # 获取积分榜前三名（降序）
    ZREVRANGE rank 0 2 WITHSCORES
    ```
    
1. 延时队列 / 定时任务：用 score 存储任务执行时间戳，获取到期任务；
    
    ```bash
    # 存储延时任务（score为时间戳）
    ZADD delay_queue 1690000000 "task1" 1690000050 "task2"
    # 获取到期任务（时间戳≤当前时间）
    ZRANGEBYSCORE delay_queue 0 1690000000
    ```
    
2. 优先级队列：用 score 存储任务优先级，按优先级取任务；
3. 时间序列数据：用 score 存储时间戳，存储用户行为日志、访问记录；
4. 有序去重：存储最近登录用户、热门商品，保证有序且不重复。

### 4. 核心总结

Zset 的核心价值是 “有序性”，通过双结构（ziplist/listpack + skiplist+dict）的自动切换，兼顾小数据量的内存效率和大数据量的排序、查找效率，是实现排行榜、延时队列的首选数据类型。

---

## 全文总结：Redis5 种数据类型底层实现速记

|数据类型|底层实现（双结构 / 多结构）|核心优势|核心应用场景|
|---|---|---|---|
|String|SDS（int/embstr/raw）|二进制安全、动态扩容|缓存、计数器、验证码|
|List|quicklist（ziplist+linkedlist）|有序可重复、头尾操作高效|队列、栈、消息列表|
|Hash|ziplist/listpack + hashtable|适合存储对象、单独操作字段|用户信息、购物车、计数器|
|Set|intset + hashtable|无序去重、集合运算|去重、标签、关注关系|
|Zset|ziplist/listpack + skiplist+dict|有序去重、范围查询|排行榜、延时队列、优先级队列|

### 核心规律

1. 所有数据类型的底层实现，都围绕 “**内存效率**” 和 “**操作性能**” 的平衡；
2. 小数据量用紧凑结构（ziplist/listpack/intset）节省内存，大数据量用高效结构（hashtable/quicklist/skiplist）保证性能；
3. 同一数据类型的编码 / 结构会自动切换，无需手动干预，由 Redis 内部根据配置和数据量决定。

后续我们会补充 Redis 中特殊数据类型（bitmap、hyperloglog 等）的底层实现，以及 Redis 的高级特性（持久化、集群、缓存策略等）。

学习过程中有任何问题，都可以在评论区留言，我会及时为大家解答，感谢大家的支持！