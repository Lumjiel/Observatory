# 引言

在前文中，我们讲解到了 MySQL 中的事务和隔离级别，也知晓了在 MySQL 中默认的隔离级别是可重复读，那么在可重复读的情况下，依然可能会出现“幻读”的问题，那么此时我们又可以怎么解决？

这就引出了我们本文要讲解的重点——MVCC（多版本并发控制）。

# 一、先回顾：什么是幻读（Phantom Read）？

幻读：在同一事务中两次执行相同的查询，第二次比第一次多出（或少了）若干“行”（不是同一行被修改，而是出现/消失了整行记录），通常因为别的已提交事务插入或删除了符合查询条件的新行。

示例：T1 的两次 SELECT COUNT(*) FROM orders WHERE status='PENDING'，中间 T2 插入了 2 条符合条件的新行并提交，T1 第二次看到的数量变多——这就是幻读。

# 二、MySQL（InnoDB）默认隔离级别 REPEATABLE READ 怎么处理幻读？

## 关键点

InnoDB 的默认隔离级别是 REPEATABLE READ（可重复读）。

它通过 MVCC（快照读） + next-key lock / gap lock（针对锁定读）的组合，在大多数场景下避免了幻读：

- 对于快照读：事务使用事务开始时的快照——即不会看到其他事务在之后插入的行，因此重复的普通 SELECT 不会出现幻读。
    
- 对于当前读（SELECT ... FOR UPDATE / LOCK IN SHARE MODE）/ UPDATE / DELETE：InnoDB 使用 next-key locks（行锁 + 间隙锁）对扫描范围上锁，从而阻止其他事务在该范围内插入新行，防止幻读（针对写冲突场景）。
    

也就是说：在 InnoDB 下，REPEATABLE READ 能在常见场景里防止幻读，但并非在所有可能的 SQL 写法/索引/隔离级别下都自动保证——需要注意细节（见后文坑点）。

# 三、MySQL 中的 ReadView 在 MVCC 中是如何工作来解决幻读问题的？

## 结论先到位

ReadView（读视图）是 InnoDB 为快照读创建的一份“事务快照状态”，它记录了在创建时哪些事务处于活跃（未完成）状态，从而决定事务能够“看到”哪些行版本。

快照读（consistent read）通过 ReadView + undo log 实现多版本读取（MVCC）：当最新版本不可见时，InnoDB 沿着 undo 链回溯找到对该 ReadView 可见的旧版本返回。

因此，对于只读或只使用快照读的场景，事务不会看到随后其他事务提交插入的新行——在读端就避免了幻读（在 InnoDB 的 REPEATABLE READ 下，事务从开始到结束使用同一 ReadView）。

但若是读后写（read→modify→write）的场景，不能仅靠快照读——需要加锁（FOR UPDATE / gap locks）来阻止别人插入，从写端避免幻读相关的不一致。

下面先解释 ReadView 的内部结构，再通过时间线演示其工作过程。

# 四、ReadView 的“内容”与产生时机（必须理解）

## 什么时候创建 ReadView？

- 在 REPEATABLE READ 下：事务一旦开始，默认第一次需要快照读时创建一个事务级的 ReadView（也可理解为事务开始时的快照）。该快照在整个事务期间复用，以此保证可重复读。
    
- 在 READ COMMITTED 下：每一次快照读都会创建一个语句级 ReadView（即每次 SELECT 都可能看到最新已提交的数据），所以 REPEATABLE READ 和 READ COMMITTED 在快照语义上行为不同。
    

## ReadView 内包含什么？（概念层面）

一个“活动事务列表”（在创建 ReadView 时刻仍未提交的事务 id 集合），以及边界值（最低未完成事务 id 等信息）。

这些信息共同决定某一行某一版本的可见性：如果修改该版本的事务在 ReadView 创建时已提交且不在活动列表中，则对该 ReadView 可见；否则不可见。

# 五、可见性判断（简化版规则）

当快照读遇到某行的“最新版本”时，InnoDB 按下面顺序判断该版本是否对当前 ReadView 可见：

1. 如果该版本对应的修改事务 trx_id 在 ReadView 创建之前并且已提交→可见（直接返回）。
    
2. 如果该版本对应的事务在 ReadView 创建时仍活跃（未提交）→不可见，引擎会沿 undo log 链回溯到更早版本，直到找到一个对 ReadView 可见的版本（或没有则视为不存在）。
    
3. 如果该版本对应的事务在 ReadView 创建之后才提交→不可见（因为快照只看到创建时之前已提交的版本）。
    

（实现上 ReadView 实际保存的是“哪个事务是活跃的/未完成的”以及边界 id，用这些就能完成上面的判断。）

# 六、Undo Log 在其中的作用（如何得到旧版本）

每次对行做修改，InnoDB 会把修改前的旧版本信息写入 undo log（undo 链上的一个版本节点）。

当快照读碰到最新版本不可见时，InnoDB 就沿着该行的 undo 链回退，查找更早的已提交版本，直到找到对当前 ReadView 可见的版本为止。

这就是 MVCC 的“多版本”含义：数据库通过保存历史版本（undo）来让读请求看到事务开始时的一致状态，而不需要阻塞写。

# 七、逐步时间线示例（带事务 id、说明为什么不会看到幻读）

假设：有一张 orders(status) 表，并且在 status 上有索引（方便后续讨论 gap lock）。

初始：表里有 5 条 status='PENDING' 的行。

我们给事务一个简化的 id：T1、T2。

## 情况 A：REPEATABLE READ（事务级 ReadView），只用快照读

会话 A（T1）

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;               -- T1 开始，尚未建立 ReadView 直到第一次快照读
SELECT COUNT(*) FROM orders WHERE status='PENDING';  -- 触发创建 ReadView（快照），返回 5
-- 此时 T1 的 ReadView 记下：在创建时刻哪些事务是活跃的（比如 none）
```

会话 B（T2）并发插入

```sql
START TRANSACTION;               -- T2 开始
INSERT INTO orders (status) VALUES ('PENDING'), ('PENDING');
COMMIT;                          -- T2 提交，这时表物理上增加了 2 条记录（最新版本）
```

会话 A（T1）再次查询

```sql
SELECT COUNT(*) FROM orders WHERE status='PENDING';  -- 仍然返回 5（使用 T1 的快照）
COMMIT;
```

## 为什么？内部发生了什么：

当 T1 第一次执行 SELECT 时，InnoDB 为 T1 创建了一个 ReadView，记录了“在这个时刻哪些事务还未提交”。

T2 后来插入并提交的两条记录的修改 trx_id 大于 T1 的 ReadView 创建时间，所以对 T1 的 ReadView 来说这些版本都是不可见。

因此 T1 的第二次 SELECT 仍然基于原始快照返回相同结果——没有幻读（因为快照读“屏蔽”了后来插入的行）。

# 八、对比：READ COMMITTED 下的行为（每语句都新建 ReadView）

如果把隔离级别改成 READ COMMITTED，则每一条 SELECT 会创建新的 ReadView（语句级）。在上面场景中：

- T1 的第一次 SELECT 返回 5（创建 RV1）。
    
- T2 插入并提交 2 条。
    
- T1 的第二次 SELECT 会创建新的 ReadView（RV2），看到 T2 已提交的行 -> 返回 7。
    

所以在 REPEATABLE READ 下快照读防幻读，而在 READ COMMITTED 下快照语义是“每次看到最新已提交”，因此重复查询可能看到新行（幻变）。

# 九、为何快照读“读端”能避免幻读，但不够用于读后写场景

快照读避免了“读端”的幻读：在事务期间你连续的普通 SELECT 看到的是同一快照，看到的行集不会被后来提交的事务改变（新增/删除）——因此重复读不会出现幻影行。

但如果事务要基于读到的集合再做写（例如“查询到未处理订单并把它们标记为处理中”），只靠快照不够：你可能基于快照读到 5 条并准备处理，但在你处理期间别人可向表插入新的符合条件的行并提交——这会导致并发逻辑漏洞。

解决办法是：当前读 + 加锁（SELECT ... FOR UPDATE 或 UPDATE），InnoDB 会在扫描的索引范围上使用 next-key / gap locks 阻止后续插入，从写端避免幻读。

也就是说：快照读在读端避免幻读，锁在写端防止插入，两者配合才能保证读写一致性。

# 十、实现细节和工程注意点

- long-running transactions 的风险：如果事务太久，undo log 必须保留更长时间以供其它事务的 ReadView 回溯，会导致 undo 表增长，影响性能；因此尽量短事务。
    
- 快照建立时机差异：REPEATABLE READ 下是事务级（第一次需要时创建并重用），READ COMMITTED 下是语句级（每条 SELECT 都新建）。这直接影响“是否看到后来提交的插入”。
    
- 索引很重要：如果查询不走索引，InnoDB 的行为（尤其 gap lock 的行为）会不同；而快照读是否能高效回退到旧版本也受 undo log 大小影响。
    
- 快照读不会加锁：因此它不阻塞写（写会产生最新版本），但读不会看到写后版本；这能极大提高并发性。
    
- 对于需要“读出集合并修改集合”这类业务，千万别只用快照读：要么用 SELECT ... FOR UPDATE（悲观锁）；要么用乐观锁 + 重试策略，并在提交前再校验一次一致性。
    

# 总结

在快照读中，ReadView 提供了事务开始（或语句开始）时的一致性视图；结合 undo log，InnoDB 可以为每个 ReadView“回溯”到对其可见的行版本，从而使同一事务的连续普通 SELECT 总是看到一致的结果——这在读端上阻止了幻读的出现。

但若要防止“写端”带来的幻读问题（别人插入新行影响你后续写逻辑），必须使用锁（FOR UPDATE / gap locks）或更严格的隔离策略。