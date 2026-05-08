
## 一、SQL Server 基础操作

### 1. 新建数据库

在 SQL Server Management Studio（SSMS）的对象资源管理器中：

- 右键 “数据库” 文件夹；
- 选择 “新建数据库”；
- 输入数据库名称，确认默认配置（或自定义数据 / 日志文件），点击 “确定”。

### 2. 启动 SSMS 并连接实例

1. 启动 SSMS：
    
    从 Windows 开始菜单搜索 “SQL Server Management Studio”，点击启动。
2. 连接 SQL Server 实例：
    
    - 启动后弹出 “连接到服务器” 窗口；
    - 服务器名称：选择目标 SQL Server 实例（如`LAPTOP-SEORRIV`）；
    - 身份验证：选择 “Windows 身份验证”（默认）或 “SQL Server 身份验证”（需填写账号密码）；
    - 点击 “连接”，进入对象资源管理器界面。
    

## 二、IDEA 连接 SQL Server 的常见问题及解决

### 问题 1：TCP/IP 连接被拒绝（错误 [08S01]）

- **错误表现**：IDEA 提示 “TCP/IP connection to the host [localhost](https://localhost), port 1433 has failed”。
- **原因**：SQL Server 未启用 TCP/IP 协议、端口 1433 被防火墙拦截、服务未正常运行。
- **解决步骤**：
    
    1. 启用 TCP/IP 协议：
        
        - 打开 “SQL Server 配置管理器”(==SQLServerManager17.msc==)；
        - 展开 “==SQL Server 网络配置==”→选择对应实例的 “协议”；
        - 右键 “TCP/IP”→选择 “启用”，==重启== SQL Server 服务（在 “服务” 中操作）。
        
    2. 开放端口防火墙权限：
        
        - 打开 “Windows Defender 防火墙”→“高级设置”→新建 “入站规则”；
        - 选择 “端口”→输入 “1433”→允许连接→应用到所有网络类型→命名规则（如 “SQL Server 1433”）。
        
    3. 修正 IDEA 连接参数：
        
        - 主机填写 localhost`；
        - 端口填写 “==1433==”（SQL Server 默认端口）；
        - 实例名：默认实例留空，命名实例需填写 “主机名 \ 实例名”。
        
    

### 问题 2：登录失败（错误 [S0001]）

- **错误表现**：IDEA 提示 “无法打开登录所请求的数据库‘student_management’。登录失败”“用户‘sa’登录失败”。
- **原因**：`sa`账号未启用 / 密码错误、目标数据库不存在、`sa`无数据库访问权限。
- **解决步骤**：
    1. 验证`sa`账号状态：
        
        - 打开 SSMS，通过 Windows 身份验证登录；
        - 展开 “安全性→登录名”，右键 “sa”→选择 “属性”；
        - 切换到 “状态” 选项卡，确认 “登录” 为 “已启用”；若密码遗忘，可在 “常规” 选项卡中重置密码。
        
    2. 检查数据库及权限：
        - 在 SSMS 中确认目标数据库（如`student_management`）已存在；
        - 右键目标数据库→“属性→权限”，添加`sa`账号并授予 “连接到数据库”“数据库所有者” 等权限。
        
    3. 修正 IDEA 连接参数：
        - 确认 “密码” 栏填写`sa`的正确密码；
        - 核对 “名称” 栏的数据库名，确保与 SQL Server 中一致。