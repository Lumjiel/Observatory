本文针对 MySQL InnoDB 存储引擎默认的 REPEATABLE READ（可重复读）隔离级别，从幻读定义、工作机制、例外场景、实战验证到解决方案进行全面解析，帮助 Java 后端开发者彻底理解其核心逻辑与应用边界，规避并发场景下的数据一致性风险。

# 一、核心结论

MySQL InnoDB 默认的 REPEATABLE READ（可重复读）通过 MVCC（多版本并发控制） + next-key lock（行锁 + 间隙锁）的组合机制，在大多数场景下几乎消除了幻读，但并非完全解决，需结合查询类型、索引情况及操作场景具体判断。具体表现为：

- 普通查询（快照读）：同一事务内始终使用同一个快照，不会看到之后其他事务提交的插入/更新数据，从根源上避免幻读；
    
- 加锁查询（当前读，如 UPDATE / DELETE / SELECT ... FOR UPDATE）：通过 next-key lock 阻止其他事务在查询范围内插入新行，进一步防范幻读；
    
- 例外场景：唯一索引的等值查询在某些情况下不会设置间隙锁，且“快照读后写入”可能产生“读—写不一致”问题，仍存在幻读相关风险。
    

# 二、什么是幻读？

## 2.1 幻读的定义

幻读（phantom read）指同一事务中，两次执行相同条件的查询，第二次查询结果中出现了第一次未查询到的“新行”（或缺失原有行），本质是查询集合级别的一致性问题，关注的是结果集中是否有新记录新增或原有记录删除。

## 2.2 经典示例

以下场景可清晰复现幻读的核心现象（默认 RR 隔离级别）：

1. 事务 A 执行第一次查询：SELECT * FROM user WHERE age > 20; 返回 5 行数据；
    
2. 事务 B 插入一条满足条件的记录并提交：INSERT INTO user(age, name) VALUES (25, '张三'); COMMIT;
    
3. 事务 A 再次执行相同查询：若返回 6 行数据，则发生了幻读。
    

## 2.3 与不可重复读的区别

很多开发者会混淆幻读与不可重复读，两者核心差异在于影响范围和现象本质，具体对比如下：

|现象类型|核心差异|影响范围|
|---|---|---|
|不可重复读|同一行数据被其他事务修改，导致两次查询结果不一致|已有行的更新操作|
|幻读|结果集新增或删除行，导致两次查询行数不一致|结果集的增删操作|

# 三、InnoDB 的核心保障：MVCC 与 Next-Key Lock

RR 隔离级别之所以能有效防范幻读，核心依赖 InnoDB 的两大核心机制，分别对应不同的查询场景，形成互补防护。

## 3.1 MVCC（多版本并发控制）—— 快照读的一致性保障

MVCC 是 InnoDB 实现非阻塞读的核心技术，主要为普通 SELECT 语句（快照读）提供一致性视图，确保同一事务内数据读取的稳定性。

其工作原理如下：

1. 事务启动时，或第一次执行快照读时，InnoDB 会为该事务生成一个一致性视图（read view），该视图记录了当前所有已提交事务的 ID 列表；
    
2. 数据表中的每一行数据，都会额外记录两个隐藏字段：创建事务 ID（DB_TRX_ID）和删除/更新事务 ID（DB_ROLL_PTR），用于判断数据对当前事务的可见性；
    
3. 同一事务内的所有普通 SELECT 查询，都会基于这个固定的一致性视图读取数据，只能看到“事务启动前已提交”的数据，无法感知后续其他事务提交的插入、更新或删除操作。
    

核心效果：快照读通过固定数据版本，确保同一事务内多次相同查询的结果始终一致，从根源上消除了幻读和不可重复读。

## 3.2 Next-Key Lock（临键锁）—— 当前读的幻读防护

Next-Key Lock 是 InnoDB 为当前读（UPDATE、DELETE、SELECT ... FOR UPDATE、SELECT ... LOCK IN SHARE MODE）设计的锁机制，本质是“行锁 + 间隙锁”的组合，核心作用是阻止其他事务在查询范围内插入新行。

其构成与工作原理：

1. 行锁（Record Lock）：锁定查询命中的具体索引记录，防止其他事务修改或删除该记录；
    
2. 间隙锁（Gap Lock）：锁定索引记录之间的间隙，包括“首个记录之前的间隙”和“最后一个记录之后的间隙”，防止其他事务在该间隙中插入符合查询条件的新行；
    
3. 组合效果：Next-Key Lock 会锁定“查询条件匹配的记录 + 对应间隙”，形成一个连续的锁定范围，彻底阻止其他事务插入可能导致幻读的新行。
    

示例：当执行 SELECT * FROM user WHERE age > 20 FOR UPDATE 时，InnoDB 会锁定所有 age > 20 的记录，以及这些记录之间的间隙、最后一条 age > 20 记录之后的间隙，其他事务插入 age=25 的记录时会被阻塞，直到当前事务提交释放锁。

# 四、重要例外：RR 隔离级别下的幻读风险场景

尽管 MVCC + Next-Key Lock 能解决绝大多数幻读问题，但在特定场景下，由于锁策略的调整或读写视图的差异，仍存在幻读相关风险，需重点关注。

## 4.1 例外一：唯一索引的精确等值查询

当查询使用唯一索引（如主键、唯一键）的精确等值条件（例如 WHERE id = 10）时，InnoDB 的锁策略会进行优化，仅对命中的具体记录加行锁，不会添加间隙锁。

原因：唯一索引确保了该条件只能匹配一行数据，不存在“插入相同条件记录”的可能，因此无需通过间隙锁防范幻读。但在极端场景下，若其他事务插入该唯一索引对应的记录（如事务 A 未命中记录，未加间隙锁，事务 B 插入该记录），可能出现看似“幻读”的行为。

示例：

```sql
-- 表结构：id 为唯一主键
CREATE TABLE user (id INT PRIMARY KEY, name VARCHAR(20));

-- 事务 A（RR 隔离级别）
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
-- 唯一索引等值查询，仅加行锁，无间隙锁（未命中记录时，锁范围为空）
SELECT * FROM user WHERE id = 10 FOR UPDATE;

-- 事务 B
START TRANSACTION;
-- 插入 id=10 的记录，无需等待锁，可直接提交
INSERT INTO user(id, name) VALUES (10, '李四');
COMMIT;

-- 事务 A 再次查询
SELECT * FROM user WHERE id = 10 FOR UPDATE; -- 能查询到事务 B 插入的记录，出现类似幻读的现象
```

## 4.2 例外二：快照读后写入 —— 读-写不一致

这是 Java 后端开发者极易踩坑的场景，核心原因是“快照读与当前读的视图不一致”，具体场景描述如下：

1. 事务 A 执行普通 SELECT（快照读），未找到目标行（快照中无该数据）；
    
2. 事务 B 插入该目标行并提交；
    
3. 事务 A 执行 UPDATE 或 DELETE（当前读），此时当前读会访问最新已提交的数据，会匹配并修改事务 B 插入的行。
    

注意：这并非 InnoDB 的 bug，而是设计逻辑——普通 SELECT 是快照读，不加锁，仅读取固定版本数据；UPDATE/DELETE 是当前读，必须读取最新已提交数据并加锁。这种场景会导致“读不到但写成功”的不一致，本质是幻读的延伸问题。

# 五、可复现 SQL 演示（两会话）

通过以下步骤，可清晰复现“快照读后写入”导致的读-写不一致问题：

## 5.1 环境准备

```sql
-- 创建测试表
CREATE TABLE t (id INT, val VARCHAR(20));
```

## 5.2 会话 A（事务 A）

```sql
-- 设置 RR 隔离级别
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- 启动事务
START TRANSACTION;
-- 快照读：未找到 id=1 的记录，返回空
SELECT * FROM t WHERE id = 1;
-- 暂停事务 A（等待事务 B 执行）
```

## 5.3 会话 B（事务 B）

```sql
-- 启动事务
START TRANSACTION;
-- 插入数据并提交
INSERT INTO t(id, val) VALUES (1, 'bob');
COMMIT;
```

## 5.4 回到会话 A（继续执行）

```sql
-- 当前读：UPDATE 会读取事务 B 插入的最新数据并更新
UPDATE t SET val = 'alice' WHERE id = 1;
-- 提交事务
COMMIT;

-- 结果验证：事务 A 第一次 SELECT 未读到行，但 UPDATE 实际更新了事务 B 插入的行，出现读-写不一致
```

# 六、解决方案与实践建议（面向 Java 后端）

针对 RR 隔离级别下的幻读风险，结合业务场景（一致性要求、并发量），给出以下 5 种实践方案，按常用性和适用性排序。

## 6.1 方案一：读时加锁（最直接、最常用）

核心思路：将普通快照读改为加锁读（SELECT ... FOR UPDATE），强制触发 Next-Key Lock，锁定查询范围的记录和间隙，防止其他事务在读写间隙插入冲突数据。

实现示例（SQL）：

```sql
-- 替代普通 SELECT，加锁读锁定目标记录及间隙
SELECT * FROM t WHERE id = 1 FOR UPDATE;
```

Spring 实战示例：

```java
@Transactional(rollbackFor = Exception.class)
public void updateData(Long id, String newVal) {
    // 加锁读，锁定记录及间隙
    T entity = tMapper.selectByIdForUpdate(id);
    if (entity == null) {
        throw new RuntimeException("数据不存在");
    }
    // 执行更新操作
    entity.setVal(newVal);
    tMapper.updateById(entity);
}

// Mapper 接口
public interface TMapper {
    @Select("SELECT * FROM t WHERE id = #{id} FOR UPDATE")
    T selectByIdForUpdate(@Param("id") Long id);
    
    void updateById(T entity);
}
```

优缺点：

- 优点：实现简单、直观，能有效防范幻读和读-写不一致，一致性保障强；
    
- 缺点：属于阻塞锁，会降低并发性能，长时间持有锁可能导致死锁，需控制事务时长。
    

## 6.2 方案二：乐观锁（高并发场景首选）

核心思路：基于“版本号”或“时间戳”实现冲突检测，无需加锁，通过业务逻辑避免幻读和并发冲突，适合读多写少、高并发场景。

实现步骤：

1. 表结构新增版本号字段：ALTER TABLE t ADD COLUMN version INT DEFAULT 0 COMMENT '版本号';
    
2. 读取数据时，同时获取版本号；
    
3. 写入数据时，通过版本号匹配，仅当版本号一致时才执行更新，若影响行数为 0，说明存在并发冲突，进行重试或报错。
    

Java 实战示例：

```java
@Transactional(rollbackFor = Exception.class)
public void updateWithOptimisticLock(Long id, String newVal) {
    int retryCount = 3; // 重试次数
    while (retryCount > 0) {
        // 读取数据及版本号（快照读）
        T entity = tMapper.selectById(id);
        if (entity == null) {
            throw new RuntimeException("数据不存在");
        }
        // 乐观锁更新：版本号匹配才执行
        int affectedRows = tMapper.updateByVersion(id, newVal, entity.getVersion());
        if (affectedRows > 0) {
            return; // 更新成功，退出重试
        }
        retryCount--; // 版本冲突，重试
    }
    throw new RuntimeException("并发冲突，更新失败");
}

// Mapper 接口
public interface TMapper {
    @Select("SELECT * FROM t WHERE id = #{id}")
    T selectById(@Param("id") Long id);
    
    @Update("UPDATE t SET val = #{newVal}, version = version + 1 WHERE id = #{id} AND version = #{version}")
    int updateByVersion(@Param("id") Long id, @Param("newVal") String newVal, @Param("version") Integer version);
}
```

优缺点：

- 优点：无锁阻塞，高并发下性能优异，适合大规模并发场景；
    
- 缺点：需实现重试逻辑，增加代码复杂度，不适用于强一致性要求极高的场景。
    

## 6.3 方案三：先 UPDATE 再 INSERT（插入竞争场景）

核心思路：针对“插入冲突”场景，先尝试更新数据，若更新影响行数为 0，说明数据不存在，再执行插入操作；配合唯一索引捕获竞态冲突，避免重复插入和幻读。

实战示例：

```java
@Transactional(rollbackFor = Exception.class)
public void insertOrUpdate(Long id, String val) {
    // 先尝试更新，若数据存在则更新
    int updateCount = tMapper.updateValById(id, val);
    if (updateCount == 0) {
        // 数据不存在，执行插入
        try {
            tMapper.insert(new T(id, val));
        } catch (DuplicateKeyException e) {
            // 捕获唯一键冲突，说明其他事务已插入，可重试或报错
            throw new RuntimeException("数据已存在，插入失败");
        }
    }
}
```

## 6.4 方案四：使用 SERIALIZABLE 隔离级别（极端场景）

核心思路：将事务隔离级别提升为 SERIALIZABLE（串行化），InnoDB 会强制对所有查询加锁，事务串行执行，彻底杜绝幻读、脏读、不可重复读等所有并发异常。

实现方式（SQL）：

```sql
-- 设置会话级隔离级别为串行化
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- 启动事务
START TRANSACTION;
-- 执行查询/更新操作
SELECT * FROM t WHERE id = 1;
UPDATE t SET val = 'alice' WHERE id = 1;
COMMIT;
```

优缺点：

- 优点：强一致性，完全避免所有并发异常，适合金融、资金等核心场景；
    
- 缺点：并发性能极差，事务排队等待，仅在一致性要求绝对严格时使用。
    

## 6.5 方案五：业务层设计优化（根本解决方案）

核心思路：从业务设计层面规避幻读风险，减少对数据库隔离级别的依赖，具体建议：

- 将“读—处理—写”逻辑封装在同一个短事务内，减少跨事务并发冲突；
    
- 避免在事务内混合使用快照读和加锁读，若需强一致性，统一使用加锁读；
    
- 采用幂等设计和重试机制，处理并发插入/更新导致的冲突；
    
- 合理设计索引（如唯一索引），减少锁范围，平衡一致性与并发性能。
    

# 七、总结

MySQL InnoDB 的 REPEATABLE READ 隔离级别，通过 MVCC 与 Next-Key Lock 的组合，在绝大多数业务场景下有效解决了幻读问题，是平衡数据一致性与并发性能的最优选择。

但不能笼统地说“完全解决”幻读：唯一索引等值查询的锁策略优化、快照读后写入的读-写不一致，是两大核心例外场景。作为 Java 后端开发者，需深刻理解这些边界情况，结合业务的一致性要求和并发量，选择合适的解决方案（加锁读、乐观锁、串行化级别等），才能在实际开发中规避并发风险，保障数据一致性。

