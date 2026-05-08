
## 一、Maven 简介

Maven 是基于项目对象模型（POM）的项目管理与自动化构建工具，核心功能为**依赖管理**和**项目构建自动化**。

- 主要支持 Java 平台，也兼容其他编程语言（如 Scala、Kotlin 等）
    
- 可通过简单配置完成项目构建、文档生成、报告输出、依赖管理、源代码管理、发布分发等全流程操作
    
- 解决传统项目中依赖包手动导入混乱、版本冲突、构建步骤繁琐等问题
    

## 二、Maven 下载（以 Windows 系统为例）

### 步骤1：进入官方下载页面

1. 打开浏览器，输入 Maven 官方网站地址：[https://maven.apache.org/](https://maven.apache.org/)
    
2. 点击页面左侧导航栏的「Download」选项，进入下载页面
    
3. 页面下滑找到「Files」模块，其中「Binary zip archive」为 Windows 系统对应的压缩包版本（如 apache-maven-3.9.9-bin.zip），点击即可下载（建议选择最新稳定版，避免beta版本）
    

### 步骤2：解压与创建本地仓库文件夹

1. 找到下载完成的压缩包（默认在浏览器「下载」文件夹），右键选择「解压到当前文件夹」或「解压到指定路径」
    
2. 建议将解压后的文件夹放在无中文、无空格的路径下（避免后续配置报错），例如解压到 `E:\Maven\` 路径下，解压后会生成 `apache-maven-3.9.9` 文件夹（文件夹名称随版本号变化）
    
3. 双击进入 `apache-maven-3.9.9` 文件夹，在文件夹空白处右键「新建」→「文件夹」，命名为「repo」（用于存放 Maven 本地仓库依赖包，后续配置需用到此路径）
    
4. 复制「repo」文件夹的完整路径（如 `E:\Maven\apache-maven-3.9.9\repo`），可右键「repo」文件夹→「属性」→「常规」→「位置」，点击「复制」按钮保存路径，后续配置会用到
    

## 三、Maven 配置（核心步骤，需细心操作）

### 3.1 配置环境变量（Windows 系统）

#### 步骤1：打开环境变量配置界面

1. 返回电脑桌面，找到「此电脑」图标，右键点击→选择「属性」
    
2. 在弹出的「系统」窗口中，点击左侧「高级系统设置」（Windows 11 系统需先点击「系统信息」，再点击「高级系统设置」）
    
3. 在「系统属性」窗口中，切换到「高级」选项卡，点击下方「环境变量」按钮，进入环境变量配置界面
    

#### 步骤2：新建 MAVEN_HOME 系统变量

1. 在「环境变量」窗口的「系统变量」模块（注意不是「用户变量」），点击「新建」按钮
    
2. 在「新建系统变量」窗口中，按以下内容填写：
    
    1. 变量名：`MAVEN_HOME`（必须全大写，不可修改）
        
    2. 变量值：粘贴之前解压的 `apache-maven-3.9.9` 文件夹的完整路径（如 `E:\Maven\apache-maven-3.9.9`）
        
3. 点击「确定」保存，返回「环境变量」窗口
    

#### 步骤3：配置 Path 系统变量

1. 在「系统变量」模块中，找到「Path」变量，选中后点击「编辑」按钮
    
2. 在「编辑环境变量」窗口中，点击「新建」按钮，输入 `%MAVEN_HOME%\bin`（此为 Maven 可执行文件路径）
    
3. 为确保优先级，可选中刚添加的 `%MAVEN_HOME%\bin`，点击「上移」按钮，将其移到列表上方
    
4. 依次点击「确定」→「确定」→「确定」，关闭所有环境变量窗口
    

#### 步骤4：验证环境变量配置成功

1. 按下 `Win + R` 组合键，打开「运行」窗口，输入 `CMD`，点击「确定」，打开命令提示符窗口（若普通用户身份打开报错，可右键「命令提示符」→「以管理员身份运行」）
    
2. 在命令提示符窗口中，输入 `mvn --version`（注意中间有空格），按下回车键
    
3. 若出现类似以下内容，说明环境变量配置成功：
    
    ```Plain
    Apache Maven 3.9.9 (c8b52d6d468b04606d155019301cc5ec0340226d)
    Maven home: E:\Maven\apache-maven-3.9.9
    Java version: 17.0.10, vendor: Oracle Corporation, runtime: E:\Java\jdk-17.0.10
    Default locale: zh_CN, platform encoding: GBK
    OS name: "windows 11", version: "10.0", arch: "amd64", family: "windows"
    ```
    
      （若提示「'mvn' 不是内部或外部命令」，需检查环境变量路径是否正确，或重启电脑后重新验证）
    

### 3.2 修改 Maven 核心配置（settings.xml 文件）

#### 步骤1：找到 settings.xml 文件

1. 进入之前解压的 `apache-maven-3.9.9` 文件夹，双击打开「conf」子文件夹
    
2. 在「conf」文件夹中，找到 `settings.xml` 文件（此为 Maven 核心配置文件，建议先复制一份备份，避免修改错误无法恢复）
3. 进入 `apache-maven-3.9.9` 文件夹下的 `repo` 文件夹，将路径复制下来，然后返回 `settings.xml` 文件：
![[Pasted_image_20260109171730.png]]
#### 步骤2：配置本地仓库路径

1. 用记事本或 Notepad++（推荐，可显示行号）打开 `settings.xml` 文件
    
2. 找到文件中==第 56 行==左右的 `<localRepository>` 标签（默认被注释，即包裹在 `<!-- -->` 中）
    
3. 将之前复制的「repo」文件夹路径（如 `E:\Maven\apache-maven-3.9.9\repo`），填入 `<localRepository>` 标签中，示例：
    
    ```XML
    <!-- 本地仓库路径配置 -->
    <localRepository>E:\Maven\apache-maven-3.9.9\repo</localRepository>
    ```
    
      （注意：删除原有的注释符号 `<!-- -->`，确保标签生效，且路径需与实际「repo」文件夹路径一致）
    
![[Pasted_image_20260109171802.png]]
#### 步骤3：配置阿里云镜像（解决依赖下载慢问题）

1. 在 `settings.xml` 文件中，找到 `<mirrors>` 标签（==约第 160 行左右==，不同版本行号可能略有差异）
    
2. 在 `<mirrors>` 标签内部，添加阿里云镜像配置，示例：
    
    ```XML
<!-- 阿里云镜像 -->
<mirror>
  <id>aliyun-maven</id>
  <mirrorOf>central</mirrorOf>
  <url>https://maven.aliyun.com/repository/public</url>
  <blocked>false</blocked>
</mirror>

    ```
    
      （若原有其他镜像配置，可保留或删除，建议优先使用阿里云镜像，稳定性和速度更佳）
    

#### 步骤4：配置 JDK 版本（避免版本兼容问题）

1. 在 `settings.xml` 文件中，找到 `<profiles>` 标签（==约第 192 行左右==）
    
2. 根据自己安装的 JDK 版本，在 `<profiles>` 标签内部添加对应配置，以下为两种常用版本示例：
    

##### 示例1：JDK 17 配置

```XML
<profiles>
    <!-- JDK 17 配置：确保项目使用 JDK 17 编译和运行 -->
    <profile>
        <id>jdk-17</id> <!-- 配置ID，唯一标识 -->
        <activation>
            <activeByDefault>true</activeByDefault> <!-- 默认激活此配置 -->
            <jdk>17</jdk> <!-- 匹配 JDK 17 版本 -->
        </activation>
        <properties>
            <maven.compiler.source>17</maven.compiler.source> <!-- 源码编译版本 -->
            <maven.compiler.target>17</maven.compiler.target> <!-- 目标运行版本 -->
            <maven.compiler.compilerVersion>17</maven.compiler.compilerVersion> <!-- 编译器版本 -->
        </properties>
    </profile>
</profiles>
```
![[Pasted_image_20260109171951.png]]
##### 示例2：JDK 1.8 配置（若安装的是 JDK 8，使用此配置）

```XML
<profiles>
    <!-- JDK 1.8 配置：确保项目使用 JDK 1.8 编译和运行 -->
    <profile>
        <id>jdk-1.8</id> <!-- 配置ID，唯一标识 -->
        <activation>
            <activeByDefault>true</activeByDefault> <!-- 默认激活此配置 -->
            <jdk>1.8</jdk> <!-- 匹配 JDK 1.8 版本 -->
        </activation>
        <properties>
            <maven.compiler.source>1.8</maven.compiler.source> <!-- 源码编译版本 -->
            <maven.compiler.target>1.8</maven.compiler.target> <!-- 目标运行版本 -->
            <maven.compiler.compilerVersion>1.8</maven.compiler.compilerVersion> <!-- 编译器版本 -->
        </properties>
    </profile>
</profiles>
```

（注意：仅需保留与自己 JDK 版本一致的配置，删除另一个版本的配置，避免冲突）

#### 步骤5：完整的 settings.xml 配置（直接替换版）

若不想手动修改，可直接将 `settings.xml` 文件内容替换为以下完整配置（需修改本地仓库路径和 JDK 版本）：

```XML
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.2.0 https://maven.apache.org/xsd/settings-1.2.0.xsd">

    <!-- 本地依赖存放位置 -->
    <localRepository>E:\Maven\apache-maven-3.9.9\repo</localRepository>

    <mirrors>
        <!-- 阿里云镜像 -->
        <mirror>
            <id>aliyun-maven</id>
            <mirrorOf>central</mirrorOf>
            <url>https://maven.aliyun.com/repository/public</url>
            <blocked>false</blocked>
        </mirror>
    </mirrors>

    <profiles>
        <!-- JDK 17 -->
        <profile>
            <id>jdk-17</id>
            <activation>
                <activeByDefault>true</activeByDefault>
                <jdk>17</jdk>
            </activation>

            <properties>
                <maven.compiler.source>17</maven.compiler.source>
                <maven.compiler.target>17</maven.compiler.target>
                <maven.compiler.compilerVersion>17</maven.compiler.compilerVersion>
            </properties>
        </profile>
    </profiles>
</settings>

```

修改完成后，==按 `Ctrl + S` 保存文件==，关闭编辑器。

#### 步骤6：验证 Maven 核心配置成功

1. 打开命令提示符窗口（管理员或普通用户身份均可）
    
2. 输入 `mvn help:system` 命令，按下回车键
    
3. 此时 Maven 会自动从阿里云镜像下载所需的核心依赖包，并存储到之前配置的「repo」文件夹中
    
4. 若命令执行完成后，提示「BUILD SUCCESS」，且「repo」文件夹中出现大量子文件夹（依赖包），说明核心配置成功；若提示「BUILD FAILURE」，需检查 `settings.xml` 文件中的路径、镜像地址是否正确
    

### 3.3 IDEA 中配置 Maven（以 IntelliJ IDEA 2023 版本为例）

#### 步骤1：打开 IDEA 配置界面

1. 打开 IntelliJ IDEA，若已打开项目，点击顶部菜单栏「File」→「Settings」（Windows/Linux）或「IntelliJ IDEA」→「Settings」（Mac）；若未打开项目，==在欢迎界面点击==「Customize」→「All Settings...」
    ![[Pasted_image_20260109172104.png]]
2. 在「Settings」窗口左上角的搜索框中，输入「Maven」，找到「Build, Execution, Deployment」→「Build Tools」→「Maven」选项


#### 步骤2：配置 Maven 路径与设置文件

1. 在「Maven」配置界面中，按以下步骤修改：
    
    1. 「Maven home path」：点击右侧「...」按钮，选择之前解压的 `apache-maven-3.9.9` 文件夹路径（如 `E:\Maven\apache-maven-3.9.9`），不建议使用 IDEA 自带的 Maven
        
    2. 「User settings file」：点击右侧「...」按钮，选择 `apache-maven-3.9.9\conf\settings.xml` 文件路径（如 `E:\Maven\apache-maven-3.9.9\conf\settings.xml`），并勾选下方「Override」选项（表示覆盖 IDEA 默认配置）
        
    3. 「Local repository」：会自动读取 `settings.xml` 中配置的本地仓库路径（如 `E:\Maven\apache-maven-3.9.9\repo`），无需手动修改，若未自动显示，可点击「...」按钮手动选择「repo」文件夹
        
2. 配置完成后，点击窗口下方「Apply」按钮，暂不关闭窗口

![[Pasted_image_20260109172118.png]]
![[Pasted_image_20260109172234.png]]
#### 步骤3：配置 Java Compiler（匹配 JDK 版本）

1. 在「Settings」窗口左上角搜索框中，输入「Java Compiler」，找到「Build, Execution, Deployment」→「Compiler」→「Java Compiler」选项
    
2. 在「Java Compiler」配置界面中：
    
    1. 「Project bytecode version」：选择与自己 JDK 版本一致的选项（如 JDK 17 选择 17，JDK 1.8 选择 1.8）
        
    2. 若已存在模块，在「Module compile output」列表中，确保每个模块的「Target bytecode version」也与 JDK 版本一致（若不一致，点击下拉框修改）
        
3. 点击「Apply」→「OK」按钮，关闭「Settings」窗口，完成 IDEA 中 Maven 配置

![[Pasted_image_20260109172338.png]]

## 四、常见问题与注意事项

1. **环境变量配置后，输入 mvn --version 报错**：
    
    1. 检查 `MAVEN_HOME` 变量值是否为 `apache-maven-3.9.9` 文件夹的根路径，而非「bin」或「conf」子文件夹
        
    2. 检查 Path 变量中是否添加 `%MAVEN_HOME%\bin`，且路径无拼写错误
        
    3. 重启电脑后重新验证（环境变量修改后需重启生效）
        
2. **执行 mvn help:system 下载依赖慢或失败**：
    
    1. 检查 `settings.xml` 中阿里云镜像地址是否正确（确保为 `https://maven.aliyun.com/repository/public`）
        
    2. 检查网络连接，若使用公司网络，可能存在代理限制，需配置代理（可在 `settings.xml` 中添加代理配置）
        
3. **IDEA 中 Maven 配置后，项目编译报错**：
    
    1. 检查「Java Compiler」中「Target bytecode version」是否与 JDK 版本一致
        
    2. 检查 `settings.xml` 中 JDK 配置是否正确，是否激活了对应的 profile
        
    3. 右键项目→「Maven」→「Reload Project」，重新加载 Maven 配置
        
4. **本地仓库路径修改后，原有依赖无法使用**：
    
    1. 若之前使用过其他本地仓库，可将原有仓库中的依赖包复制到新的「repo」文件夹中，避免重新下载
        
    2. 若无需保留原有依赖，执行 `mvn help:system` 重新下载核心依赖即可
        

## 五、结语

本笔记涵盖 Maven 从下载、环境变量配置、核心配置到 IDEA 集成的全流程，每一步均提供详细操作指引，可直接对照复刻。配置过程中需注意路径无中文/空格、JDK 版本与配置一致、镜像地址正确这三个关键点，若遇到问题可参考「常见问题」部分排查，或进一步查询相关资料。