**前言**：

在 MySQL 数据库中，很多时候 SQL 的 CRUD 性能极差，并不是因为数据量真的大到无法处理，而是开发者对索引底层实现不够透彻，写出了让索引 “失效” 的 SQL。本文就带你一次性搞懂：MySQL 中最常见的 6 类索引失效场景，从**本质原因**到**检测方式**，再到**可直接落地的解决方案**，无论是日常开发优化，还是后端面试，都能直接用上。

---

## 1）左 / 左右模糊匹配（LIKE 的 % 在左侧或两侧）

### 示例

```sql
SELECT * FROM users WHERE name LIKE '%smith';
SELECT * FROM users WHERE name LIKE '%smi%';
```

### 为什么失效（本质）

InnoDB 的 B+ 树索引是**按字段值有序存储**的，只有前缀匹配才能利用索引的有序性做快速范围查找。

当 `LIKE` 以 `%` 开头时，查询需要匹配 “任意前缀 + 目标串”，B+ 树无法定位到连续的有序区间，只能走**全表扫描**或**全索引扫描**，索引直接失效。

### 如何检测

执行 `EXPLAIN` 查看执行计划：

- `type = ALL`（全表扫描）
- 或 `type = index`（全索引扫描）
- 不会出现 `range / ref / const`

### 解决办法

1. **尽量避免前导 %**
    
    能改成 `name LIKE 'smith%'` 就一定可以走索引。
2. **后缀匹配：使用反向索引**
    
    对字符串反转后建立索引，适合 “以 xx 结尾” 的查询。
3. **包含匹配：使用全文索引 / ElasticSearch**
    
    `%xxx%` 这种模糊包含查询，不适合用普通索引，优先用 `FULLTEXT` 或专业搜索中间件。

---

## 2）在索引列上使用函数

### 示例

```sql
SELECT * FROM orders WHERE DATE(create_time) = '2025-11-02';
SELECT * FROM users WHERE UPPER(email) = 'ABC@X.COM';
```

### 为什么失效（本质）

B+ 树索引存储的是**字段原始值**，而不是函数计算后的值。

==当你写成 `函数(col) = 常量`，数据库无法在索引树上直接定位，只能逐行计算函数再比较，索引完全用不上。==

### 如何检测

- `EXPLAIN` 显示**未使用索引**
- `key = NULL`
- WHERE 条件中索引列被函数包裹

### 解决办法

1. **改写为范围查询（最推荐）**
    
    ```sql
    DATE(create_time) = '2025-11-02'
    →
    create_time >= '2025-11-02 00:00:00'
    AND create_time < '2025-11-03 00:00:00'
    ```
    
2. **使用生成列 + 生成列索引**（MySQL 5.7+）
    
    对函数结果建索引，从根源解决问题。
3. **永远不要在索引列上直接套函数**。

---

## 3）在索引列上做表达式计算

### 示例

```sql
SELECT * FROM people WHERE age + 1 = 30;
SELECT * FROM product WHERE price * discount = 100;
```

### 为什么失效（本质）

索引存的是 `age`、`price` 这些**原始字段值**。

数据库**不会自动反向推导表达式**，例如 `age + 1 = 30` 等价于 `age = 29`，但 MySQL 不会帮你算，只能全表扫描。

### 如何检测

- `EXPLAIN` 不走索引
- WHERE 中出现算术 / 拼接等表达式

### 解决办法

1. **手工代数变换**
    
    把运算挪到常量一侧：
    
    ```sql
    age + 1 = 30 → age = 29
    ```
    
2. **复杂表达式使用生成列索引**
3. **禁止在 WHERE 中对列做计算**

---

## 4）隐式类型转换（列类型与常量类型不匹配）

### 示例

假设 `phone` 是 `VARCHAR(20)` 且建有索引，但你写成：

```sql
SELECT * FROM users WHERE phone = 13800138000; -- 常量是数字
```

### 为什么失效（本质）

类型不一致时，MySQL 会做**隐式转换**。

常见情况：字符串列 vs 数字常量 → MySQL 会把**索引列转成数字**，导致索引有序性被破坏，无法走索引。

### 如何检测

- `EXPLAIN` 走全表扫描
- 执行 `SHOW WARNINGS` 可看到隐式转换提示

### 解决办法

1. **保证类型完全一致**
    
    ```sql
    phone = '13800138000'
    ```
    
2. 代码层统一类型，使用 `PreparedStatement` 正确指定类型。
3. 表结构设计时统一字段类型。

---

## 5）联合索引不满足最左前缀原则

### 示例

建有联合索引：`INDEX idx_abc (a, b, c)`

```sql
-- 失效：只查 b，跳过最左列 a
SELECT * FROM t WHERE b = 2;

-- 失效：a + c，跳过中间列 b
SELECT * FROM t WHERE a = 1 AND c = 3;
```

### 为什么失效（本质）

联合索引 B+ 树是**从左到右依次排序**的：

先按 a 排序 → a 相同按 b → b 相同按 c。

不满足**最左、连续**匹配，就无法利用索引快速定位。

### 如何检测

- `EXPLAIN` 中 `key = NULL`
- `type` 不是 `ref / range`

### 解决办法

1. **遵循最左前缀原则设计查询**
2. **按业务高频查询设计索引**
    
    经常单独查 b，就建 `INDEX(b)` 或 `INDEX(b,a)`。
3. 联合索引字段顺序：**过滤性强 → 区分度高 → 排序 / 分组**。

---

## 6）WHERE 中使用 OR（无合适索引）

### 示例

```sql
SELECT * FROM t WHERE a = 1 OR b = 2;
```

### 为什么失效（本质）

- OR 两边列**都没有索引** → 全表扫描
- 只有一边有索引 → MySQL 大概率仍选择全表
- 即使触发索引合并，成本也很高

### 如何检测

- `EXPLAIN type = ALL`
- `Extra` 只显示 `Using where`，无 `Using index`

### 解决办法

**最优方案：改写成 UNION / UNION ALL**

```sql
SELECT * FROM t WHERE a = 1
UNION ALL
SELECT * FROM t WHERE b = 2;
```

- 各自走索引，效率大幅提升
- 无重复数据用 `UNION ALL`，避免去重开销

---

# 辅助技能：用 EXPLAIN 快速判断索引是否失效

执行：

```sql
EXPLAIN SELECT ...
```

重点看 4 个字段：

1. **type**
    
    好：`const / eq_ref / ref / range`
    
    坏：`ALL`（全表）、`index`（全索引）
2. **key**
    
    显示索引名 = 用到索引
    
    `NULL` = 索引失效
3. **rows**
    
    扫描行数越少越好
4. **Extra**
    
    `Using index` = 覆盖索引（极佳）
    
    `Using filesort / Using temporary` = 需要优化

---

# 小结

1. **最左前缀**：联合索引必须从左到右连续使用
2. **列上不变形**：不做函数、算术、表达式计算
3. **避免前导 %**：`LIKE '%xx'` 必失效
4. **类型必一致**：杜绝隐式类型转换
5. **OR 要小心**：优先改写成 `UNION / UNION ALL`
6. **EXPLAIN 必看**：`type=ALL`、`key=NULL` 就是失效

只要避开这 6 种场景，你的 MySQL 查询性能至少提升一个量级。