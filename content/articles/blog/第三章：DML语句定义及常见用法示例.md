上一章我们学习了DDL语句，掌握了数据库和表的“创建、修改、删除”等结构定义操作，相当于搭建好了数据存储的“容器”。今天我们进入更核心的学习——DML语句，它是操作“容器”中数据的关键，学会DML，你才能真正实现数据的增、删、改、查，解锁MySQL的核心使用场景。

## 一、什么是DML？新手必懂的核心定义

DML 的全称是 **Data Manipulation Language（数据操作语言）**，它与上一章的DDL（数据定义语言）核心区别在于：**DDL操作的是“数据库对象的结构”，而DML操作的是“表中的数据”**，不改变表的结构本身。

简单来说，DDL是“建房子”（搭建表结构），DML就是“住人、装修”（操作表中数据）。在MySQL中，DML语句的核心作用是对表中的数据进行增、删、改、查，也是我们日常开发中使用频率最高的SQL语句。

这里有一个新手容易混淆的知识点：严格来说，“查询数据”的SELECT语句属于DQL（Data Query Language，数据查询语言），但在很多书籍、教程以及面试中，SELECT语句通常会被包含在DML的范畴中，我们今天也统一按这个习惯讲解，更贴合实际开发场景。

常见的DML操作及对应SQL语句，用表格总结更清晰，新手建议收藏：

|   |   |   |
|---|---|---|
|操作类型|SQL语句|说明|
|插入数据|INSERT|向表中新增一条或多条数据记录|
|更新数据|UPDATE|修改表中已存在的数据记录|
|删除数据|DELETE|删除表中已有的数据记录|
|查询数据|SELECT|检索表中的数据（严格来说属于DQL）|

✨ 新手注意：DML语句与DDL语句的核心区别——DML语句执行后不会自动提交事务（可回滚），而DDL语句会自动提交事务（不可回滚），这个区别我们在后面会详细讲解。

## 二、INSERT：插入数据（新增记录）

INSERT语句是向表中添加新数据的核心语句，语法简单但有很多细节需要注意，尤其是“列和值的匹配”，新手很容易在这里踩坑。下面我们结合实例，从基础到进阶，一步步掌握INSERT的用法。

### 1. 基本语法（推荐用法）

最规范、最推荐的插入语法，明确指定要插入的列名和对应的值，避免因表结构变更导致插入失败：

```sql
-- 基本语法：INSERT INTO 表名 (列1, 列2, 列3, ...) VALUES (值1, 值2, 值3, ...);
-- 注意：列名和值的顺序必须一一对应，数据类型也要匹配
```

### 2. 基础示例

我们以上一章创建的“学生表（student）”为例（先创建表，新手可直接复制执行）：

```sql
-- 先创建student表（若已存在可跳过）
CREATE TABLE IF NOT EXISTS student (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    age INT CHECK(age >= 0),
    major VARCHAR(100) NOT NULL
);

-- 插入一条学生数据
INSERT INTO student (id, name, age, major)
VALUES (1, '张三', 20, '计算机科学');

-- 插入成功后，可通过SELECT查询验证（后面会详细讲SELECT）
SELECT * FROM student;
```

✨ 新手注意：如果表的主键设置了AUTO_INCREMENT（自动增长），插入时可以不指定id列，MySQL会自动生成递增的主键值，更便捷：

```sql
-- 不指定id（自动增长），仅插入name、age、major
INSERT INTO student (name, age, major)
VALUES ('张三', 20, '计算机科学');
```

### 3. 一次插入多条数据（高效用法）

如果需要插入多条数据，无需多次执行INSERT语句，可在VALUES后拼接多个值列表，执行效率更高，语法如下：

```sql
-- 一次插入多条数据，用逗号分隔多个值列表
INSERT INTO student (name, age, major)
VALUES 
(2, '李四', 21, '软件工程'),  -- 第一条
(3, '王五', 19, '人工智能'),  -- 第二条
(4, '赵六', 22, '网络工程');  -- 第三条
```

✅ 优势：减少与数据库的交互次数，提升插入效率，尤其适合批量插入少量数据（大批量数据建议用LOAD DATA INFILE等方式）。

### 4. 插入全部列（不推荐用法）

如果要给表中的所有字段都插入值，可以省略列名，但这种方式不推荐，因为一旦表结构发生变更（如新增、删除列），插入语句就会报错：

```sql
-- 省略列名，必须按表中字段的顺序插入所有值
INSERT INTO student VALUES (5, '孙七', 20, '信息安全');

-- 错误示例：如果表新增了gender列，省略列名插入就会报错
-- INSERT INTO student VALUES (6, '周八', 21, '大数据');  -- 字段数量不匹配，报错
```

⚠️ 警告：日常开发中，尽量不要省略列名，避免因表结构变更导致插入失败，提升代码的可维护性。

## 三、UPDATE：更新数据（修改记录）

UPDATE语句用于修改表中已存在的数据，是日常开发中高频使用的语句，但也是新手最容易踩坑的语句——**忘记写WHERE条件，会导致整张表的数据被修改**，造成不可逆的损失，一定要格外谨慎！

### 1. 基本语法（必记）

```sql
-- 基本语法：UPDATE 表名 SET 列1 = 值1, 列2 = 值2, ... WHERE 条件;
-- 核心：WHERE条件用于指定要修改的记录，缺一不可！
```

### 2. 基础示例

修改student表中“张三”的年龄和专业，明确指定WHERE条件，确保只修改目标记录：

```sql
-- 修改张三的年龄为22，专业改为大数据技术
UPDATE student
SET age = 22, major = '大数据技术'
WHERE name = '张三';

-- 验证修改结果
SELECT name, age, major FROM student WHERE name = '张三';
```

### 3. 增加条件过滤（多条件修改）

实际开发中，常常需要根据多个条件筛选要修改的记录，可使用AND、OR等逻辑运算符拼接条件：

```sql
-- 修改年龄大于20且专业为计算机科学的学生，将专业改为人工智能
UPDATE student
SET major = '人工智能'
WHERE age > 20 AND major = '计算机科学';

-- 说明：AND表示“同时满足两个条件”，OR表示“满足任意一个条件”
```

### 4. 新手必踩坑点

⚠️ 绝对禁止：在没有WHERE条件的情况下执行UPDATE语句！会修改表中所有记录，比如下面这句：

```sql
-- 错误示例：没有WHERE条件，会将所有学生的年龄改为20
UPDATE student SET age = 20;

-- 后果：整张表的age字段全部被修改，无法撤销（除非有备份或事务回滚）
```

✅ 建议：执行UPDATE语句前，先执行对应的SELECT语句，验证筛选的记录是否正确，再执行UPDATE，比如：

```sql
-- 先验证：查询年龄大于20且专业为计算机科学的学生
SELECT * FROM student WHERE age > 20 AND major = '计算机科学';
-- 确认记录正确后，再执行UPDATE语句
UPDATE student SET major = '人工智能' WHERE age > 20 AND major = '计算机科学';
```

## 四、DELETE：删除数据（移除记录）

DELETE语句用于删除表中已存在的记录，与UPDATE类似，**忘记写WHERE条件会删除表中所有数据**，且删除后的数据若未备份，很难恢复，一定要谨慎操作。

### 1. 基本语法

```sql
-- 基本语法：DELETE FROM 表名 WHERE 条件;
-- 核心：WHERE条件用于指定要删除的记录，不可省略（除非确实要删除所有数据）
```

### 2. 基础示例

删除student表中id为3的学生记录（精准删除，风险最低）：

```sql
-- 删除id=3的学生记录
DELETE FROM student WHERE id = 3;

-- 验证删除结果（查询不到id=3的记录即为删除成功）
SELECT * FROM student WHERE id = 3;
```

### 3. 删除所有数据（谨慎使用）

如果确实需要删除表中所有数据，可省略WHERE条件，但一定要确认无误后再执行：

```sql
-- 删除student表中所有数据（表结构保留）
DELETE FROM student;

-- 注意：删除后，表结构仍然存在，可重新插入数据
```

### 4. 对比TRUNCATE（与DDL的区别）

上一章我们学习了TRUNCATE语句，它也能清空表数据，很多新手会把它和DELETE混淆，这里用表格明确两者的区别，面试常考，一定要记牢：

|   |   |   |
|---|---|---|
|对比维度|DELETE（DML语句）|TRUNCATE（DDL语句）|
|所属类别|DML（数据操作语言）|DDL（数据定义语言）|
|执行速度|较慢（逐行删除，记录日志，可回滚）|非常快（直接清空表数据，不记录日志）|
|是否可回滚|✅ 可回滚（事务内执行时，未提交可撤销）|❌ 不可回滚（执行即生效，自动提交事务）|
|是否重置自增|❌ 不重置（删除后，自增主键继续从之前的最大值递增）|✅ 重置（清空后，自增主键重新从1开始）|

✅ 总结：日常开发中，若需要清空数据且可能需要回滚，用DELETE；若确定不需要回滚、追求效率，用TRUNCATE（但要格外谨慎）。

## 五、SELECT：查询数据（检索记录）

SELECT语句是MySQL中使用频率最高的语句，没有之一。它的功能非常灵活，可实现简单的全表查询，也能实现复杂的条件筛选、排序、分页、分组统计等操作。下面我们从基础到进阶，逐步掌握SELECT的核心用法。

### 1. 基本语法（通用模板）

SELECT语句的语法可灵活组合，核心模板如下，后续所有用法都是基于这个模板扩展：

```sql
-- 基本语法模板
SELECT 列1, 列2, ...  -- 要查询的列（*表示查询所有列）
FROM 表名             -- 要查询的表
WHERE 条件            -- 筛选条件（可选）
ORDER BY 排序列       -- 排序（可选，ASC升序，DESC降序）
LIMIT 限制条数;       -- 限制查询结果条数（可选，用于分页）
```

### 2. 基础示例（简单查询）

最常用的两种简单查询，适合快速检索数据：

```sql
-- 1. 查询指定列：查询所有学生的姓名和年龄（只返回需要的列，提升效率）
SELECT name, age FROM student;

-- 2. 查询所有列：查询所有学生的全部信息（*表示所有列，不推荐在生产环境使用）
SELECT * FROM student;
```

✨ 建议：生产环境中，尽量不要用*查询所有列，只查询需要的列，可减少数据传输量，提升查询效率。

### 3. 条件过滤（WHERE子句）

通过WHERE子句筛选符合条件的记录，常用的条件运算符有：>（大于）、<（小于）、=（等于）、>=（大于等于）、<=（小于等于）、<>（不等于），以及AND、OR逻辑运算符：

```sql
-- 示例1：查询年龄大于20的学生
SELECT * FROM student WHERE age > 20;

-- 示例2：查询年龄大于等于20且专业为人工智能的学生
SELECT * FROM student WHERE age >= 20 AND major = '人工智能';

-- 示例3：查询年龄小于19或专业为软件工程的学生
SELECT * FROM student WHERE age < 19 OR major = '软件工程';
```

### 4. 模糊查询（LIKE子句）

当不知道具体的查询值，只知道部分内容时，可用LIKE进行模糊查询，常用通配符：%（表示任意长度的字符序列，包括0个字符）、_（表示单个字符）：

```sql
-- 示例1：查询姓名以“张”开头的学生（%匹配“张”后面的任意字符）
SELECT * FROM student WHERE name LIKE '张%';

-- 示例2：查询姓名包含“李”字的学生（%匹配“李”前后的任意字符）
SELECT * FROM student WHERE name LIKE '%李%';

-- 示例3：查询姓名第二个字是“四”的学生（_匹配单个字符）
SELECT * FROM student WHERE name LIKE '_四%';
```

### 5. 排序（ORDER BY子句）

查询结果默认是无序的，可通过ORDER BY子句对结果进行排序，ASC表示升序（默认，可省略），DESC表示降序：

```sql
-- 示例1：按年龄升序排序（从大到小，默认ASC，可省略）
SELECT * FROM student ORDER BY age;
-- 等价于：SELECT * FROM student ORDER BY age ASC;

-- 示例2：按年龄降序排序（从小到大）
SELECT * FROM student ORDER BY age DESC;

-- 示例3：多列排序：先按专业升序，再按年龄降序
SELECT * FROM student ORDER BY major ASC, age DESC;
```

### 6. 限制条数（LIMIT子句，分页查询）

当查询结果较多时，可用LIMIT限制返回的条数，常用于分页查询（比如每页显示5条数据），语法有两种：

```sql
-- 语法1：LIMIT 条数（返回前N条记录）
SELECT * FROM student LIMIT 5;  -- 返回前5条学生记录

-- 语法2：LIMIT 偏移量, 条数（从第N+1条开始，返回M条记录）
SELECT * FROM student LIMIT 5, 5;  -- 从第6条开始，返回5条（第6-10条）

-- 分页场景示例：第1页（1-5条）、第2页（6-10条）、第3页（11-15条）
-- 第1页：LIMIT 0, 5（偏移量0，返回5条）
-- 第2页：LIMIT 5, 5（偏移量5，返回5条）
-- 第3页：LIMIT 10, 5（偏移量10，返回5条）
```

### 7. 聚合函数（统计查询）

聚合函数用于对数据进行统计计算，常用的聚合函数有：COUNT（统计条数）、AVG（求平均值）、SUM（求和）、MAX（求最大值）、MIN（求最小值），通常与AS配合使用，给统计结果起别名：

```sql
-- 示例1：统计学生总人数（COUNT(*) 统计所有记录，包括NULL值）
SELECT COUNT(*) AS 总人数 FROM student;

-- 示例2：统计学生的平均年龄（AVG(列名) 求指定列的平均值）
SELECT AVG(age) AS 平均年龄 FROM student;

-- 示例3：统计学生的最大年龄和最小年龄
SELECT MAX(age) AS 最大年龄, MIN(age) AS 最小年龄 FROM student;

-- 示例4：统计某专业的学生总人数
SELECT COUNT(*) AS 计算机专业人数 FROM student WHERE major = '计算机科学';
```

### 8. 分组查询（GROUP BY + HAVING）

当需要按某个字段分组统计时，可用GROUP BY子句，搭配HAVING子句过滤分组后的结果（注意：HAVING用于过滤分组，WHERE用于过滤行）：

```sql
-- 示例：按专业分组，统计每个专业的学生人数，且只显示人数大于2的专业
SELECT major, COUNT(*) AS 人数
FROM student
GROUP BY major  -- 按major字段分组
HAVING 人数 > 2;  -- 过滤分组结果，只保留人数>2的专业

-- 注意：WHERE和HAVING的区别：
-- WHERE：分组前过滤行（比如先过滤年龄>20的学生，再分组）
-- HAVING：分组后过滤分组（比如先分组，再过滤人数>2的分组）
```

## 六、DML操作与事务（Transaction）

在Java后端开发中，事务控制是非常关键的知识点，尤其是DML语句（INSERT、UPDATE、DELETE）会改变数据，必须通过事务保证数据的一致性（比如转账操作，扣款和到账必须同时成功或同时失败）。

核心原则：DML语句执行后，不会自动提交事务，需手动执行COMMIT提交；若执行过程中出现错误，可执行ROLLBACK回滚，撤销所有未提交的修改。

### 1. 开启与提交事务（基础用法）

通过START TRANSACTION开启事务，执行完所有DML操作后，用COMMIT提交事务，事务提交后，修改会永久生效：

```sql
-- 示例：模拟转账操作（id=1的账户扣款100，id=2的账户到账100）
START TRANSACTION;  -- 开启事务
UPDATE account SET balance = balance - 100 WHERE id = 1;  -- 扣款
UPDATE account SET balance = balance + 100 WHERE id = 2;  -- 到账
COMMIT;  -- 提交事务，所有修改永久生效
```

### 2. 回滚事务（撤销修改）

若执行DML操作后发现错误，在未提交事务前，可执行ROLLBACK回滚，撤销所有未提交的修改，数据恢复到事务开启前的状态：

```sql
START TRANSACTION;
UPDATE account SET balance = balance - 100 WHERE id = 1;
-- 假设这里出现错误（比如id=2不存在），执行回滚
ROLLBACK;  -- 撤销扣款操作，id=1的账户余额恢复原样
```

### 3. 与Java结合（实战场景）

实际Java后端开发中，很少直接手动执行事务相关的SQL语句，通常通过Spring框架的@Transactional注解控制事务，简化开发：

```java
import org.springframework.transaction.annotation.Transactional;

// 转账服务类
public class TransferService {

    // 注入账户Mapper（用于操作数据库）
    private AccountMapper accountMapper;

    // @Transactional注解：开启事务，方法内所有DML操作要么同时成功，要么同时失败
    @Transactional
    public void transfer(int fromId, int toId, int amount) {
        // 扣款：从fromId账户减去amount
        accountMapper.decreaseBalance(fromId, amount);
        // 到账：给toId账户增加amount
        accountMapper.increaseBalance(toId, amount);
    }
}

// 说明：如果方法执行过程中出现异常（比如SQL错误、业务异常），Spring会自动执行ROLLBACK
// 如果方法正常执行完毕，Spring会自动执行COMMIT
```

## 七、DML语句的执行顺序（面试常问）

很多新手会疑惑：SQL语句的书写顺序和执行顺序不一样，为什么？其实SQL是声明式语言，我们只需要告诉MySQL“要查什么”，MySQL会按照内部逻辑顺序执行，这个顺序也是面试高频考点，一定要记牢：

```sql
-- 书写顺序（我们写SQL的顺序）
SELECT 列名 FROM 表名 WHERE 条件 GROUP BY 列名 HAVING 条件 ORDER BY 列名 LIMIT 条数;

-- 执行顺序（MySQL内部实际执行顺序）
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

✅ 简单理解：先找到要查询的表（FROM），再筛选符合条件的行（WHERE），然后分组（GROUP BY），过滤分组结果（HAVING），再选择要返回的列（SELECT），接着排序（ORDER BY），最后限制返回条数（LIMIT）。

## ✅ 本章总结

本章我们掌握了DML语句的核心用法，重点记住“增、删、改、查”四大操作，以及事务控制和执行顺序，用表格快速回顾核心要点：

|   |   |   |
|---|---|---|
|操作类型|核心SQL语句|关键注意点|
|插入|INSERT INTO ... VALUES ...|列和值的顺序、类型要匹配，推荐指定列名|
|更新|UPDATE ... SET ... WHERE ...|必写WHERE条件，避免修改整张表|
|删除|DELETE FROM ... WHERE ...|谨慎省略WHERE，删除前建议先查询验证|
|查询|SELECT ... FROM ...|支持条件、分组、排序、分页，避免用*查询所有列|
|事务|START TRANSACTION / COMMIT / ROLLBACK|保证DML操作的一致性，未提交可回滚|

最后提醒：DML语句是日常开发的核心，建议大家多敲代码练习，尤其是SELECT语句的复杂用法（分组、聚合、分页），以及事务的控制，这些都是面试和工作中的重点。下一章我们将学习DCL语句，掌握数据库的权限管理，继续加油！