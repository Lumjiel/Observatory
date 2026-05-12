对于后端开发者、数据库初学者来说，MySQL中的DQL（数据查询语言）是日常工作中最常用、最核心的知识点之一。不同于DML（数据操纵语言）的“增删改”，DQL专注于“查数据”——如何快速、准确地从数据库中提取所需信息，直接决定了系统的性能和开发效率。今天，我们就从概念到实战，一步步拆解DQL的核心用法，帮你彻底吃透MySQL查询技巧。

## 一、先搞懂：DQL到底是什么？

DQL的全称是Data Query Language，即数据查询语言，它的核心作用就是从数据库表中查询符合条件的数据，是MySQL中使用频率最高的语言模块。

这里我们可以用一个简单的类比理解DQL与DML的区别：

- DML（INSERT、UPDATE、DELETE）：相当于“修改数据仓库”，负责往仓库里放数据、改数据、删数据；
    
- DQL（核心是SELECT语句）：相当于“从仓库里找东西”，根据你的需求，精准找到想要的数据，不会对原有数据做任何修改。
    

简单来说，只要你需要从数据库中“查东西”，就离不开DQL，而SELECT语句，就是DQL的灵魂。

## 二、核心框架：SELECT语句的基本结构与执行顺序

很多新手写SELECT语句时容易混乱，不知道先写什么、后写什么，其实只要记住它的基本结构和执行顺序，就能轻松上手。

SELECT语句的完整结构（7个核心部分）：

```sql
SELECT [字段列表]
FROM [表名]
WHERE [筛选条件]
GROUP BY [分组字段]
HAVING [分组后的筛选条件]
ORDER BY [排序字段]
LIMIT [分页限制]
```

这里有一个关键知识点——**SELECT语句的执行顺序**，很多人会误以为执行顺序和书写顺序一致，其实不然，正确的执行顺序是：

FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT

举个通俗的例子：你要从“学生表”中找“18-22岁的计算机系学生，按年龄降序排列，取前10条”，执行逻辑就是：先找到学生表（FROM），筛选出18-22岁的学生（WHERE），再按专业分组（如果有需要），过滤分组后的结果（如果有需要），然后选择要显示的字段（SELECT），按年龄降序排序（ORDER BY），最后取前10条（LIMIT）。

记住这个执行顺序，能帮你快速排查查询语句的错误，也能更精准地优化查询性能。

## 三、基础查询：从零开始写第一个SELECT语句

基础查询是DQL的入门，主要包括查询所有字段、给字段起别名、去重查询三种常见场景，适合新手快速上手。

### 1. 查询所有字段

最简单的查询方式，使用“*”表示查询表中的所有字段：

```sql
SELECT * FROM student;
```

**注意**：这种方式虽然简单，但**不建议在生产环境中使用**。因为“*”会查询表中所有字段，包括不需要的字段，不仅会增加数据库的查询压力、影响性能，还会降低代码的可维护性（比如表结构修改后，查询结果可能出现异常）。

推荐写法：明确写出需要查询的字段名，精准高效：

```sql
SELECT id, name, age, department FROM student;
```

### 2. 给字段起别名

当字段名过于简洁、不直观，或者在多表查询中出现字段名重复时，我们可以给字段起一个别名，方便阅读和使用，使用关键字“AS”（可省略）。

```sql
-- 给name起别名为“姓名”，age起别名为“年龄”
SELECT name AS 姓名, age AS 年龄 FROM student;
-- 省略AS，效果一致
SELECT name 姓名, age 年龄 FROM student;
```

别名的核心作用的是“简化显示”，尤其是在前端展示数据时，用中文别名会更直观，多表查询时，也能避免字段名冲突。

### 3. 去重查询

当表中存在重复数据时，我们可以使用“DISTINCT”关键字去除重复值，只保留唯一的记录。

```sql
-- 查询所有不重复的专业（去除重复的department值）
SELECT DISTINCT department FROM student;
```

**注意**：DISTINCT会对所有指定的字段一起去重，比如“SELECT DISTINCT department, age FROM student”，会去除“专业+年龄”都相同的重复记录，而不是只对department去重。

## 四、条件查询：精准筛选你想要的数据（WHERE）

基础查询只能查询所有或指定字段的全部数据，而实际开发中，我们往往需要筛选出符合特定条件的数据，这就需要用到WHERE子句。WHERE子句的核心是“筛选条件”，由运算符和值组成。

### 1. 常见比较运算符

比较运算符用于判断字段值与指定值之间的关系，是WHERE子句中最常用的运算符，具体如下：

|运算符|含义|示例|
|---|---|---|
|=|等于|WHERE age = 20（查询年龄为20的学生）|
|<> 或 !=|不等于|WHERE department != 'CS'（查询非计算机系学生）|
|>、<、>=、<=|大于、小于、大于等于、小于等于|WHERE age >= 18（查询成年学生）|
|BETWEEN ... AND ...|在某个范围内（包含边界值）|WHERE age BETWEEN 18 AND 22（18≤年龄≤22）|
|IN (...)|在指定集合中|WHERE department IN ('CS', 'Math')（计算机系或数学系）|
|LIKE|模糊匹配|WHERE name LIKE '张%'（查询姓张的学生）|
|IS NULL / IS NOT NULL|判断字段是否为空|WHERE email IS NULL（查询未填写邮箱的学生）|

这里重点说一下模糊匹配“LIKE”的用法：

- %：匹配任意长度的字符（包括0个字符），比如“张%”可以匹配“张三”“张三丰”“张小明”；
    
- _：匹配单个字符，比如“张_”只能匹配“张三”“张伟”（两个字的姓张的名字）。
    

### 2. 逻辑运算符

当需要多个筛选条件同时生效时，就需要用到逻辑运算符，将多个条件连接起来，常用的有3个：

|运算符|含义|示例|
|---|---|---|
|AND|并且（多个条件同时满足）|WHERE age >= 18 AND department = 'CS'（成年的计算机系学生）|
|OR|或者（多个条件满足一个即可）|WHERE age < 18 OR department = 'Math'（未成年或数学系学生）|
|NOT|取反（不满足某个条件）|WHERE NOT age BETWEEN 18 AND 22（年龄不在18-22之间）|

**注意**：逻辑运算符的优先级是 NOT > AND > OR，如果有复杂的条件组合，建议使用括号()明确优先级，避免查询结果出错。

## 五、排序查询：让结果更有规律（ORDER BY）

查询出来的数据默认是无序的，我们可以使用ORDER BY子句对查询结果按指定字段排序，让数据更易读。

排序的核心参数：

- ASC：升序排序（默认值，可省略），比如按年龄从大到小排列；
    
- DESC：降序排序，比如按年龄从大到小排列。
    

```sql
-- 按年龄降序排序（从大到小）
SELECT * FROM student ORDER BY age DESC;
-- 按年龄升序排序（从小到大，省略ASC）
SELECT * FROM student ORDER BY age;
```

实际开发中，我们也可以按多个字段排序，先按第一个字段排序，第一个字段相同的情况下，再按第二个字段排序：

```sql
-- 先按专业升序，同一专业内按年龄降序
SELECT * FROM student ORDER BY department ASC, age DESC;
```

## 六、聚合函数：对数据进行统计分析（Aggregate Functions）

当需要对查询到的数据进行统计（比如计数、求和、求平均值）时，就需要用到聚合函数。聚合函数会对一组数据进行计算，返回一个单一的值，常用的聚合函数有5个：

|函数|功能|示例|
|---|---|---|
|COUNT()|计数（统计符合条件的记录数）|COUNT(*) AS 总人数（统计学生总数）|
|SUM()|求和（计算指定字段的总和）|SUM(score) AS 总分（统计某门课程的总分）|
|AVG()|求平均值|AVG(age) AS 平均年龄（计算学生平均年龄）|
|MAX()|求最大值|MAX(age) AS 最大年龄（查询最大年龄）|
|MIN()|求最小值|MIN(age) AS 最小年龄（查询最小年龄）|

示例：统计学生表中的总人数和平均年龄：

```sql
SELECT COUNT(*) AS 人数, AVG(age) AS 平均年龄 FROM student;
```

**注意**：聚合函数默认对整个表的数据进行计算，如果需要按分组统计，需要结合GROUP BY子句使用。

## 七、分组查询：按指定规则分组统计（GROUP BY / HAVING）

分组查询的核心是“GROUP BY”子句，它可以将数据按指定字段分组，然后对每个分组进行聚合统计。而“HAVING”子句则用于对分组后的结果进行筛选，相当于“分组后的WHERE”。

### 1. 基本用法

示例：按专业分组，统计每个专业的学生人数：

```sql
SELECT department, COUNT(*) AS 人数
FROM student
GROUP BY department;
```

这里的逻辑是：先按department（专业）分组，将相同专业的学生归为一组，然后对每个组执行COUNT(*)计数，最终得到每个专业的学生人数。

### 2. HAVING与WHERE的核心区别

很多新手会混淆HAVING和WHERE，其实两者的核心区别在于“筛选时机不同”：

- WHERE：在**分组前**筛选记录，筛选的是原始数据，不能使用聚合函数；
    
- HAVING：在**分组后**筛选结果，筛选的是分组后的统计结果，可以使用聚合函数。
    

示例：按专业分组，统计学生人数大于10的专业：

```sql
SELECT department, COUNT(*) AS 人数
FROM student
GROUP BY department
HAVING COUNT(*) > 10;
```

如果把这里的HAVING换成WHERE，会报错——因为WHERE不能使用聚合函数COUNT(*)，而HAVING可以筛选分组后的统计结果。

## 八、分页查询：解决大数据量查询问题（LIMIT）

当表中的数据量很大时，一次性查询所有数据会占用大量的数据库资源，也会导致前端加载缓慢，这时就需要用到分页查询——只查询当前页需要的数据，减少数据传输量。

MySQL中分页的语法是：

```sql
LIMIT [偏移量], [行数]
```

参数说明：

- 偏移量：从第几条数据开始查询（默认从0开始，即第一条数据的偏移量是0）；
    
- 行数：本次查询要返回的记录数。
    

示例：

```sql
-- 查询前10条数据（偏移量0，取10条）
SELECT * FROM student LIMIT 0, 10;
-- 查询第11到20条数据（偏移量10，取10条）
SELECT * FROM student LIMIT 10, 10;
```

在Java后端开发中（比如Spring Boot + MyBatis），分页查询非常常见，通常会将偏移量和行数封装成参数，动态拼接SQL：

```sql
SELECT * FROM student LIMIT #{offset}, #{pageSize};
```

其中，offset（偏移量）=（当前页码-1）× pageSize（每页行数），比如第2页、每页10条，偏移量就是10。

## 九、连接查询：多表关联查询（JOIN）

实际开发中，数据往往分散在多个表中（比如学生表、课程表、成绩表），我们需要通过表与表之间的关联关系，查询出跨表的数据，这就需要用到连接查询。MySQL中最常用的连接查询有3种：内连接、左连接、右连接。

为了方便理解，我们假设存在两个表：student（学生表，包含id、name、department）和course（课程表，包含id、course_name、student_id），其中course表的student_id与student表的id关联。

### 1. 内连接（INNER JOIN）

内连接是最常用的连接方式，它只返回两个表中“匹配的行”——即两个表中关联字段相等的记录，不匹配的记录会被过滤掉。

```sql
SELECT s.name, c.course_name
FROM student s  -- 给student表起别名s
INNER JOIN course c  -- 给course表起别名c
ON s.id = c.student_id;  -- 关联条件：学生id等于课程表中的学生id
```

上述语句会查询出“有课程记录的学生”及其对应的课程名称，没有选课的学生、没有对应学生的课程，都不会被查询出来。

### 2. 左连接（LEFT JOIN）

左连接会返回“左表（LEFT JOIN左边的表）的所有行”，即使右表没有匹配的行，右表的字段会显示为NULL。

```sql
SELECT s.name, c.course_name
FROM student s
LEFT JOIN course c
ON s.id = c.student_id;
```

上述语句会查询出所有学生的信息，即使某个学生没有选课（右表course没有匹配的记录），该学生的name会显示，course_name会显示为NULL。

### 3. 右连接（RIGHT JOIN）

右连接与左连接相反，会返回“右表（RIGHT JOIN右边的表）的所有行”，即使左表没有匹配的行，左表的字段会显示为NULL。

```sql
SELECT s.name, c.course_name
FROM student s
RIGHT JOIN course c
ON s.id = c.student_id;
```

上述语句会查询出所有课程的信息，即使某门课程没有对应的学生（左表student没有匹配的记录），该课程的course_name会显示，name会显示为NULL。

## 十、子查询：嵌套查询（Subquery）

子查询是指“一个SELECT语句嵌套在另一个查询语句中”，嵌套的SELECT语句称为“子查询”，外层的SELECT语句称为“主查询”。子查询的核心作用是“用子查询的结果作为主查询的条件或数据源”。

### 1. 作为条件使用

示例：查询“计算机系（CS）的学生姓名”，其中计算机系的id需要从department表中查询：

```sql
SELECT name
FROM student
WHERE department_id = (
    -- 子查询：查询计算机系的id
    SELECT id FROM department WHERE name = 'CS'
);
```

这里的子查询会先执行，得到计算机系的id，然后主查询根据这个id，查询出对应的学生姓名。

### 2. 作为虚拟表使用

子查询的结果可以作为一个“虚拟表”，供主查询使用，这种情况下需要给子查询起一个别名。

```sql
-- 查询男生的平均年龄，先通过子查询筛选出男生，再计算平均年龄
SELECT AVG(age) AS 男生平均年龄
FROM (SELECT * FROM student WHERE gender='M') AS male_students;
```

这里的子查询“SELECT * FROM student WHERE gender='M'”会筛选出所有男生，作为虚拟表male_students，主查询再对这个虚拟表计算平均年龄。

## 十一、DQL与Java后端结合：实战落地

对于后端开发者来说，学会DQL不仅要会写SQL，还要知道如何在Java项目中使用DQL查询数据。常见的Java后端框架（Spring Boot、MyBatis、JDBC）中，DQL主要用于实现“查询接口”（比如/user/list、/student/getById），通过ORM框架执行SQL，并将查询结果封装成Java对象。

示例（MyBatis Mapper接口）：

```java
// 通过年龄查询用户列表，参数为age，返回List<User>对象
@Select("SELECT id, name, age, email FROM user WHERE age > #{age}")
List<User> findUsersByAge(@Param("age") int age);
```

当后端接口被调用时（比如传入age=20），MyBatis会执行对应的SQL：

```sql
SELECT id, name, age, email FROM user WHERE age > 20;
```

并将查询结果自动封装成User对象的列表，返回给前端。

## 十二、DQL实战建议：避坑+优化

掌握了DQL的基础用法后，想要写出高效、规范的查询语句，还需要注意以下几点：

1. 多练习组合查询：实际开发中，很少有单一的查询场景，多练习“WHERE + GROUP BY + HAVING + ORDER BY”的组合用法，熟悉执行顺序，提升查询逻辑能力；
    
2. 避免使用SELECT *：尤其是在大表中，SELECT *会查询多余字段，增加数据库压力，建议明确写出需要的字段名；
    
3. 牢记执行顺序：FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT，排查SQL错误时，按执行顺序分析，能快速找到问题；
    
4. 合理使用分页：大数据量查询时，必须使用LIMIT分页，避免一次性查询所有数据；
    
5. 连接查询避坑：多表连接时，一定要写清楚关联条件（ON子句），避免出现笛卡尔积（查询结果暴增）；
    
6. 子查询优化：简单的子查询可以使用，但复杂的子查询（比如多层嵌套）建议替换为连接查询，提升查询性能。
    

## 总结

DQL是MySQL中最核心、最常用的语言，从基础的SELECT查询，到条件、排序、分组、分页，再到多表连接、子查询，每一个知识点都对应着实际开发中的场景。对于新手来说，建议先掌握基础用法，多写SQL练习，再逐步学习优化技巧，理解执行顺序和底层逻辑。

其实DQL并不难，只要多练、多思考，就能熟练运用，写出高效、规范的查询语句，为后端开发打下坚实的基础。后续我也会分享更多DQL优化技巧和实战案例，欢迎持续关注～