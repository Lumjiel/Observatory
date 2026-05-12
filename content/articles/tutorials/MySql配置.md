## 0. 卸载旧版 MySQL（关键！80% 安装失败源于此）

如果电脑之前装过 MySQL，必须彻底卸载干净，否则会导致新安装启动失败！

### 检查是否有旧版残留

1. 查看安装路径：默认路径一般是 `C:\Program Files\MySQL` 或 `D:\Program Files\MySQL`，如果存在该文件夹，说明可能有残留
2. 查看数据目录：默认在 `C:\ProgramData\MySQL`（`ProgramData` 是隐藏文件夹，需先显示隐藏文件）

### 彻底卸载步骤（必做）

1. **停止 MySQL 服务**
    
    - 按下 `Win + R`，输入 `services.msc` 回车
    - 在服务列表中找到「MySQL」（可能叫 MySQL80 等），右键选择「停止」
2. **删除注册表**
    
    - 按下 `Win + R`，输入 `regedit` 回车
    - 依次删除以下 3 个路径的注册表项（右键项 → 删除）：
        - `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\MySQL`
        - `HKEY_LOCAL_MACHINE\SOFTWARE\MySQL AB`
        - `HKEY_CURRENT_USER\Software\MySQL AB`
3. **删除安装目录和数据目录**
    
    - 删除前面找到的 `MySQL` 安装文件夹（如 `D:\Program Files\MySQL`）
    - 删除数据目录 `C:\ProgramData\MySQL`（如果里面有重要数据，先备份）
4. **重启电脑**：确保所有残留完全清除，重启后再开始新安装
    

> 若卸载中遇到问题，参考这两篇博客：
> 
> - [安装 MySQL 时出现 starting the server 失败](https://blog.csdn.net/BigData_C/article/details/124597947)
> - [MySQL 安装 starting the server 失败的解决办法](https://www.cnblogs.com/csq111/p/14872194.html)

## 1. 下载 MySQL 安装包

推荐用官方图形化安装器（无需手动配置文件，新手首选）：

1. 官方下载地址（需忽略登录，直接下载）：[MySQL Installer for Windows](https://dev.mysql.com/downloads/installer/)
    - 进入页面后，拉到最下方，点击「No thanks, just start my download」直接下载
2. 备用高速链接（2023.7.13 更新，版本 8.0.33）：
    - 安装包：`mysql-installer-community-8.0.33.0.msi`
    - MD5 校验码：`9b4ce33ab05ae7e0aa30a6c4f1a4d1c2`（确保文件完整）

### 安装包优势

- 图形化界面配置，无需手动写配置文件
- 可一键更新 MySQL 到最新版本
- 自动配置部分依赖，减少报错

## 2. 前期准备工作

2023 年 7 月 13 日更新：现在无需额外准备，下载完安装包直接双击安装即可！

## 3. 开始安装（一步步点击即可）

1. 双击下载好的 `mysql-installer-community-8.0.33.0.msi`，弹出安装界面，选择「Custom（自定义安装）」→ 点击「Next」
    
    - 自定义安装可只选需要的服务，避免安装无用组件
2. 选择要安装的服务：
    
    - 在左侧「Available Products」中，展开「MySQL Server 8.0」，选中「MySQL Server 8.0.33 - X64」（64 位系统）
    - 点击中间的「→」箭头，将其添加到右侧「Products/Features To Install」中
    - 其他组件（如 Workbench、Connector）可按需添加，新手建议先只装 Server
3. 修改安装路径（重要！避免装在 C 盘）：
    
    - 选中右侧已添加的「MySQL Server 8.0.33 - X64」，点击下方的「Advanced Options」（很小的按钮，仔细找）
    - 在弹出的窗口中，修改「Installation Path」（安装路径）：把默认的 `C:\Program Files\MySQL\MySQL Server 8.0` 中的「C」改成「D」，即 `D:\Program Files\MySQL\MySQL Server 8.0`（简单易记，后续好找）
    - 点击「OK」→ 回到上一界面，点击「Next」
4. 解决依赖缺失（可选，没报错直接跳过）：
    
    - 如果弹出「Check Requirements」提示，说明系统缺少 MySQL 需要的 C++ 运行库
    - 点击提示框中的「Execute」（执行），会自动下载并安装依赖
    - 安装依赖时，勾选「我接受许可条款」→ 点击「安装」，完成后点击「Close」
    - 回到 MySQL 安装界面，点击「Next」
5. 开始安装：
    
    - 点击「Execute」（执行），等待进度条走完（期间不要关闭窗口）
    - 安装完成后，点击「Next」

## 4. 配置 MySQL Server（核心步骤）

1. 配置类型选择：默认「Development Computer（开发计算机）」→ 点击「Next」
    
    - 适合本地学习、开发使用，无需修改
2. 连接方式配置：默认即可（TCP/IP 端口 3306，开启防火墙例外）→ 点击「Next」
    
3. 密码策略选择（关键！影响后续工具连接）：
    
    - 推荐选择「Use Legacy Authentication Method (Retain MySQL 5.x Compatibility)」（兼容旧版认证方式）
        - 原因：如果后续用 Navicat 11 等旧版本图形化工具，新版认证方式会连接失败；如果用新版工具（如 Navicat 16、MySQL Workbench），选第一种也可以
    - 点击「Next」
4. 设置 root 密码（一定要记牢！）：
    
    - 在「Root Account Password」中，输入密码（如 `123456`，新手选简单好记的，后续可修改）
    - 再次输入确认密码 → 点击「Next」
5. 配置服务名称和启动方式：
    
    - 「Windows Service Name」可改成「MySQL」（默认是 MySQL80，改后更易记）
    - 勾选「Start the MySQL Server at System Startup」（开机自动启动服务，省心）
    - 选择「Standard System Account」（标准系统账户）→ 点击「Next」
6. 应用配置：
    
    - 点击「Execute」（执行），等待配置完成（会自动启动 MySQL 服务）
    - 配置成功后，点击「Finish」
7. 退出安装：回到初始安装界面，点击「Finish」，安装完成！
    

## 5. 配置环境变量（让 cmd 能直接用 mysql 命令）

安装后直接在 cmd 输入`mysql`会报错，需配置环境变量：

1. 找到 MySQL 的 bin 目录：
    
    - 进入之前设置的安装路径：`D:\Program Files\MySQL\MySQL Server 8.0\bin`（复制这个完整路径）
2. 打开环境变量设置：
    
    - 右键「此电脑」→ 「属性」→ 「高级系统设置」（Win11 在右侧，Win10 在左侧）
    - 在弹出的窗口中，点击「环境变量」
3. 编辑系统变量 PATH：
    
    - 在「系统变量」中，找到「Path」→ 双击打开编辑
    - 点击「新建」→ 粘贴刚才复制的 bin 目录路径（`D:\Program Files\MySQL\MySQL Server 8.0\bin`）
    - 点击「确定」→ 再点击上一级窗口的「确定」→ 最后点击「系统属性」窗口的「确定」（一定要层层确定，否则不生效）


### 图形化界面

这个时候大家打开命令行, 直接输入  mysql
![(Pasted_image_20260109163843.png)](/img/2026/MySql配置/Pasted_image_20260109163843.png)

应该是会报错的, 因为我们还没有配置环境变量, 没办法直接使用 mysql命令

打开我们的安装目录, 来到  MySQL Server 8.0\bin  目录下,
![(Pasted_image_20260109163959.png)](/img/2026/MySql配置/Pasted_image_20260109163959.png)
复制这一整行地址![(Pasted_image_20260109164044.png)](/img/2026/MySql配置/Pasted_image_20260109164044.png)1. 此电脑右键属性
![(Pasted_image_20260109164108.png)](/img/2026/MySql配置/Pasted_image_20260109164108.png)

2 打开高级系统设置(我是win11, win10 应该在左边或右边)
3.环境变量
![(Pasted_image_20260109164245.png)](/img/2026/MySql配置/Pasted_image_20260109164245.png)
 4.找到系统变量的PATH, **双击进入编辑**
 ![(Pasted_image_20260109164315.png)](/img/2026/MySql配置/Pasted_image_20260109164315.png)
  5.新建, 把你刚刚复制的那个路径粘贴即可
  ![(Pasted_image_20260109164349.png)](/img/2026/MySql配置/Pasted_image_20260109164349.png)
  6. 注意, 一定要一层层点确定退出去 !

一直点到这个页面为止
![(Pasted_image_20260109164415.png)](/img/2026/MySql配置/Pasted_image_20260109164415.png)


## 6. 更改时区（可选，Java 学习者必做）

Java 使用 JDBC 连接 MySQL 时会有时区报错，需改成东八区（UTC+8）：

1. 显示隐藏文件夹：
    
    - 打开「此电脑」→ 点击顶部「查看」→ 勾选「隐藏的项目」（显示 ProgramData 文件夹）
2. 找到 MySQL 配置文件：
    
    - 进入路径：`C:\ProgramData\MySQL\MySQL Server 8.0`（注意：ProgramData 在 C 盘，不是安装目录）
    - 找到文件「my.ini」（或 my-default.ini），右键用「记事本」打开
3. 添加时区配置：
    
    - 在文件中找到「[mysqld]」这一行（往下翻就能找到）
    - 在「[mysqld]」下方添加一行：`default-time_zone='+8:00'`
    - 保存文件并关闭
4. 重启 MySQL 服务生效：
    
    - 按下 `Win + R`，输入 `services.msc` → 找到「MySQL」服务 → 右键「重启」

> 若找不到 my.ini 文件：
> 
> - 下载 Everything 工具（高速搜索）：[Everything-1.4.1.1024.x64.zip](https://www.voidtools.com/Everything-1.4.1.1024.x64.zip)
> - 安装后打开，搜索「my.ini」，即可找到文件路径

## 7. 验证安装（确保安装成功）

1. 打开命令行（管理员模式）：
    
    - 按下 `Win + S`，搜索「cmd」→ 右键「命令提示符」→ 「以管理员身份运行」
2. 登录 MySQL：
    
    - 输入命令：`mysql -uroot -p` → 回车
    - 提示「Enter password:」，输入第 4 步设置的 root 密码（如 123456）→ 回车
    - 若出现 `mysql>` 提示符，说明登录成功！
3. 额外验证（可选）：
    
    - 查看 MySQL 服务：在开始菜单中，搜索「服务」→ 找到「MySQL」，状态为「正在运行」即正常
    - 使用自带工具：开始菜单中找到「MySQL Command Line Client」，点击后输入密码，能登录则成功
    - 使用 GUI 工具：如果安装了 MySQL Workbench，打开后点击「Local instance MySQL」，输入密码即可连接

## 8. MySQL 更新教程（后续可升级版本）

安装包支持一键更新，无需重新安装：

1. 打开 MySQL Installer（开始菜单中搜索即可找到）
2. 点击左侧「Updates」→ 点击「Check for Updates」（检查更新）
3. 找到要升级的版本（如 MySQL Server 8.0.xx），勾选后点击「Next」
4. 点击「Execute」下载并安装更新（期间会自动停止服务，更新完成后重启）
5. 更新完成后，点击「Finish」即可，数据不会丢失