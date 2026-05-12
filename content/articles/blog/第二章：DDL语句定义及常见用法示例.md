
上一章我们入门了MySQL的基础概念，了解了数据库、表的核心作用，今天我们正式进入SQL语句的学习，首先要掌握的就是DDL语句——它是构建数据库结构的“基石”，学会DDL，你才能真正开始创建属于自己的数据库和表，为后续的数据存储、查询打下基础。

## 一、什么是DDL？新手必懂的核心定义

DDL 的全称是 **Data Definition Language（数据定义语言）**，它是SQL语言的三大分类之一（另外两类是DML数据操纵语言、DCL数据控制语言），核心作用是 **定义和管理数据库对象的结构**。

这里要重点强调一个新手容易踩坑的点：执行DDL语句时，MySQL会自动提交事务，也就是说，语句一旦执行就会立即生效，**无法通过ROLLBACK回滚**。举个例子，如果你不小心用DDL语句删除了一张表，哪怕没有手动提交，这张表也会被永久删除，数据无法恢复，所以执行DDL语句一定要格外谨慎！

常见的DDL操作主要分为5类，用表格总结更清晰，新手建议收藏：

|操作类型|核心关键字|功能说明|
|---|---|---|
|创建|CREATE|创建数据库、数据表、视图、索引等数据库对象|
|修改|ALTER|修改数据库的字符集、排序规则，或数据表的结构（如添加列、修改列类型）|
|删除|DROP|删除数据库、数据表、视图、索引等，删除后结构和数据均会丢失|
|重命名|RENAME|修改数据库、数据表等对象的名称|
|清空|TRUNCATE|仅清空表中的所有数据，保留表的结构，后续可重新插入数据|

## 二、DDL常见语句与实战示例

学习DDL最好的方式就是“边敲边练”，以下所有示例均经过实测，新手可以打开MySQL客户端（如Navicat、DBeaver），跟着步骤一步步执行，加深记忆。所有示例均添加了详细注释，看不懂的地方可以对照注释理解。

### 1. 创建数据库：CREATE DATABASE

创建数据库是所有操作的第一步，我们通常会指定字符集和排序规则，避免出现中文乱码问题。推荐使用utf8mb4字符集（支持所有中文和特殊符号，包括emoji），排序规则默认utf8mb4_general_ci即可。

```sql
-- 创建数据库，判断如果不存在则创建（避免重复创建报错）
CREATE DATABASE IF NOT EXISTS mydb
CHARACTER SET utf8mb4  -- 指定字符集为utf8mb4
COLLATE utf8mb4_general_ci;  -- 指定排序规则
```

补充两个常用关联语句，创建数据库后一定会用到：

```sql
-- 查看MySQL中所有的数据库
SHOW DATABASES;

-- 切换到我们刚刚创建的mydb数据库（后续操作都基于这个数据库）
USE mydb;
```

✨ 新手注意：USE语句不属于DDL，属于DCL，但它是执行后续表操作的前提，必须记住。

### 2. 创建数据表：CREATE TABLE

数据表是存储数据的核心载体，创建表时需要定义表的列名、数据类型、约束条件（如主键、非空、唯一等）。下面以最常用的“用户表（user）”为例，讲解创建表的完整语法：

```sql
-- 创建用户表，包含id、用户名、密码、性别、年龄、创建时间等字段
CREATE TABLE user (
    id INT PRIMARY KEY AUTO_INCREMENT,  -- 主键（唯一标识每条数据），自动增长（无需手动插入）
    username VARCHAR(50) NOT NULL UNIQUE,  -- 用户名，非空（必须填写），唯一（不能重复）
    password VARCHAR(100) NOT NULL,  -- 密码，非空（必须填写）
    gender ENUM('男', '女') DEFAULT '男',  -- 性别，枚举类型（只能选指定值），默认值为男
    age INT CHECK(age >= 0),  -- 年龄，整数类型，约束条件：年龄不能小于0
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 创建时间，默认当前系统时间
);
```

创建完成后，我们可以查看表的结构，确认是否符合预期：

```sql
-- 查看user表的详细结构（字段名、类型、约束等）
DESC user;
```

✨ 新手重点：主键（PRIMARY KEY）是表的核心，每条数据的主键值都是唯一的，用于区分不同的数据；AUTO_INCREMENT仅适用于整数类型的主键，能自动生成递增的主键值，大大简化插入操作。

### 3. 修改表结构：ALTER TABLE

实际开发中，表结构往往不是一成不变的，比如需要新增字段、修改字段类型、删除字段等，这时候就需要用到ALTER TABLE语句。以下是最常用的6种修改场景，覆盖90%的开发需求：

#### （1）给表添加新列

示例：给user表添加“邮箱（email）”字段，用于存储用户邮箱：

```sql
-- 给user表添加email列，类型为VARCHAR(100)
ALTER TABLE user ADD email VARCHAR(100);
```

#### （2）修改列的数据类型

示例：将user表的age列（原本是INT类型）修改为SMALLINT类型（节省存储空间，因为年龄范围通常在0-150之间，SMALLINT足够）：

```sql
-- 修改age列的类型为SMALLINT
ALTER TABLE user MODIFY age SMALLINT;
```

#### （3）重命名表中的列

示例：将user表的username列重命名为user_name（符合Java开发中的命名规范，下划线命名）：

```sql
-- 重命名列：旧列名username → 新列名user_name，同时指定新列的类型（必须指定）
ALTER TABLE user CHANGE username user_name VARCHAR(50);
```

✨ 注意：CHANGE和MODIFY的区别：CHANGE可以重命名列，同时修改列类型；MODIFY只能修改列类型，不能重命名。

#### （4）删除表中的列

示例：删除user表中的gender列（假设后续不需要存储性别信息）：

```sql
-- 删除user表的gender列
ALTER TABLE user DROP COLUMN gender;
```

#### （5）给列添加约束

示例：给user表的email列添加唯一约束（确保每个用户的邮箱都不重复）：

```sql
-- 给email列添加唯一约束，约束名uq_email（自定义，便于后续删除约束）
ALTER TABLE user ADD CONSTRAINT uq_email UNIQUE(email);
```

#### （6）重命名数据表

示例：将user表重命名为users（通常表名用复数形式，符合开发规范）：

```sql
-- 将user表重命名为users
ALTER TABLE user RENAME TO users;
```

### 4. 删除表：DROP TABLE

删除表是非常危险的操作，删除后表的结构和所有数据都会被永久删除，无法恢复。因此，一定要加上IF EXISTS判断，避免删除不存在的表报错。

```sql
-- 删除users表，判断如果存在则删除
DROP TABLE IF EXISTS users;
```

⚠️ 警告：新手在测试时，建议先备份数据，再执行DROP语句，避免误删重要数据。

### 5. 清空表数据：TRUNCATE TABLE

如果我们只想清空表中的所有数据，保留表的结构（后续可以重新插入数据），就可以使用TRUNCATE TABLE语句。很多新手会把它和DELETE语句混淆，这里用表格明确两者的区别，新手一定要记牢：

|特点|DELETE（DML语句）|TRUNCATE（DDL语句）|
|---|---|---|
|是否为DDL|否（属于DML）|是（属于DDL）|
|是否可回滚|✅ 可回滚（在事务内执行时）|❌ 不可回滚（执行即生效）|
|是否重置自增|❌ 否（删除数据后，自增主键会继续从之前的最大值递增）|✅ 是（清空数据后，自增主键重新从1开始）|
|执行速度|较慢（逐行删除数据，会记录日志）|非常快（直接清空表数据，不记录日志）|

示例：清空user表（假设表已重新创建）的数据：

```sql
-- 清空user表的数据，保留表结构
TRUNCATE TABLE user;
```

## 三、DDL的执行特性

结合前面的内容，我们总结一下DDL语句的4个核心执行特性，这也是新手容易出错的地方，一定要牢记：

1. 自动提交事务：DDL语句执行后，MySQL会自动提交事务，无需手动执行COMMIT，且无法通过ROLLBACK回滚。
    
2. 不可逆性：大部分DDL操作（如DROP、TRUNCATE）都是不可逆的，删除或修改后无法恢复，一定要谨慎操作。
    
3. 适用场景：DDL语句主要用于数据库初始化（如创建数据库、表）、表结构变更（如新增列、修改约束）阶段，日常数据操作（如插入、删除数据）不使用DDL。
    
4. 项目中的使用方式：在Java后端项目中，很少直接手动执行DDL语句，通常通过数据库迁移工具（如Flyway、Liquibase）管理DDL，避免多人开发时出现表结构不一致的问题。
    

## 四、综合实战示例：创建电商系统产品表

为了让大家更好地掌握DDL的综合用法，我们结合实际开发场景，创建一个电商系统中常用的“产品表（product）”，包含产品id、名称、价格、库存、分类关联等字段，涵盖主键、外键、约束、默认值等核心知识点：

```sql
-- 先创建产品分类表（因为产品表需要关联分类表，外键依赖）
CREATE TABLE IF NOT EXISTS category (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,  -- 分类名称，唯一
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建产品表，关联分类表（外键约束）
CREATE TABLE product (
    id INT PRIMARY KEY AUTO_INCREMENT,  -- 产品主键，自动增长
    name VARCHAR(100) NOT NULL,  -- 产品名称，非空
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),  -- 产品价格，精确到2位小数，约束价格不能为负
    stock INT DEFAULT 0,  -- 产品库存，默认值为0
    category_id INT,  -- 分类id，关联分类表的主键
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 产品创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- 产品更新时间，修改数据时自动更新
    FOREIGN KEY (category_id) REFERENCES category(id)  -- 外键约束，关联分类表的id
);
```

要点说明：

- DECIMAL(10,2)：用于存储价格、金额等需要精确计算的数据，10表示总长度，2表示小数位数，避免浮点数精度丢失问题。
    
- ON UPDATE CURRENT_TIMESTAMP：当修改产品表中的数据时，updated_at字段会自动更新为当前系统时间，无需手动修改。
    
- FOREIGN KEY（外键）：用于建立表与表之间的关联（产品表与分类表），保证数据的完整性，比如不能添加不存在的分类id。
    

## 五、在Java中如何使用DDL（简单示例）

对于Java后端开发者来说，了解如何在代码中执行DDL语句也很重要（虽然实际开发中多使用迁移工具，但基础用法需要掌握）。下面通过JDBC示例，演示如何在Java代码中创建数据表：

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class DdlDemo {
    public static void main(String[] args) {
        // 数据库连接信息（请替换为自己的数据库地址、用户名、密码）
        String url = "jdbc:mysql://localhost:3306/mydb?useSSL=false&serverTimezone=UTC";
        String user = "root";
        String password = "123456";

        // 定义DDL语句，创建user表
        String sql = """
            CREATE TABLE IF NOT EXISTS user (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) NOT NULL,
                password VARCHAR(100) NOT NULL
            )
        """;

        // 执行DDL语句
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(sql);
            System.out.println("数据表创建成功！");
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("数据表创建失败！");
        }
    }
}
```

✨ 说明：JDBC中执行DDL语句使用executeUpdate()方法，执行查询语句（如SELECT）使用executeQuery()方法；try-with-resources语法会自动关闭连接和Statement，避免资源泄露。

## ✅ 本章总结

本章我们掌握了DDL语句的核心用法，重点记住“创建、修改、删除、清空、重命名”五大操作，以及它们对应的关键字和使用场景，用表格快速回顾：

|操作类型|核心语句|核心功能|
|---|---|---|
|创建|CREATE DATABASE / TABLE|定义数据库或数据表的结构|
|修改|ALTER TABLE|修改数据表的结构（添加列、修改列等）|
|删除|DROP DATABASE / TABLE|删除数据库或数据表（结构+数据）|
|清空|TRUNCATE TABLE|清空表数据，保留表结构|
|重命名|RENAME TABLE|修改数据表的名称|

最后再强调一句：DDL语句执行后不可回滚，新手练习时一定要谨慎，建议先在测试环境操作，熟悉后再应用到实际项目中。下一章我们将学习DML语句，掌握数据的插入、删除、修改操作，继续加油！