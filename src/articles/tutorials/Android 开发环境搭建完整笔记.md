## 一、安装 JDK（Java 开发工具包）

### 1. 提前准备：创建专用文件夹

- **操作步骤**：
    
    1. 在非 C 盘（如 F 盘）创建多层文件夹，示例路径：`F:\Chengxusheji\Android`
    2. 在该文件夹下再创建 3 个子文件夹：`software`（存安装包）、`jdk-17.0.13`（存 JDK）、`sdk`（存 Android SDK）
    3. 确保所有文件夹名称**无空格、无中文**，且初始状态为空
- **步骤作用**：
    
    - 非 C 盘存放可避免系统盘空间不足，减少系统重装时环境丢失风险
    - 无空格 / 中文文件夹可避免后续工具（如 Gradle、Android Studio）识别路径报错
    - 分类文件夹便于后续维护和查找

### 2. 下载 JDK17

- **操作步骤**：
    
    1. 访问 JDK 官方下载地址：[Oracle JDK17 下载页](https://www.oracle.com/java/technologies/downloads/#jdk17-windows)（需注册 Oracle 账号，或搜索 “JDK17 国内镜像下载” 选择华为 / 阿里云镜像，无需注册）
    2. 选择 Windows 系统对应的安装包（建议下载`.zip`压缩包，无需安装，直接解压更便捷）
- **步骤作用**：JDK 是 Java 开发的基础，Android Studio 依赖 JDK 运行，必须安装对应版本（JDK17 兼容 Android Studio 2025）
    

### 3. 配置 JDK 环境变量

- **操作步骤**：
    
    1. 解压下载的 JDK 压缩包，将解压后的所有文件复制到之前创建的`F:\Chengxusheji\Android\jdk-17.0.13`文件夹中
    2. 复制该文件夹路径（示例：`F:\Chengxusheji\Android\jdk-17.0.13`）
    3. 配置环境变量：
        - 右键 “此电脑” → 选择 “属性” → 点击 “高级系统设置” → 点击 “环境变量”
        - 在 “系统变量” 栏点击 “新建”：
            - 变量名：`JAVA_HOME`
            - 变量值：粘贴刚才复制的 JDK 路径（如`F:\Chengxusheji\Android\jdk-17.0.13`）
        - 找到 “系统变量” 中的`Path`，双击打开 → 点击 “新建” → 输入`%JAVA_HOME%\bin` → 一路点击 “确定” 保存
- **步骤作用**：
    
    - `JAVA_HOME`告诉系统 JDK 的安装位置，供其他依赖 Java 的工具（如 Android Studio）识别
    - `%JAVA_HOME%\bin`将 JDK 的可执行文件（如 java、javac）添加到系统路径，让电脑在任意位置都能调用 JDK 命令

### 4. 验证 JDK 配置成功

- **操作步骤**：
    
    1. 按下`Win+R`组合键，输入`cmd`打开命令提示符
    2. 在命令行中输入`java -version`，按下回车
    3. 若显示类似`java version "17.0.13" 2024-10-15 LTS`的信息，说明配置成功；若提示 “不是内部或外部命令”，需重新检查环境变量配置
- **步骤作用**：确认 JDK 已正确安装并能被系统识别，避免后续 Android Studio 启动报错
    

## 二、安装 Android Studio 2025（安卓开发 IDE）

### 1. 下载 Android Studio

- **操作步骤**：
    
    1. 访问官方下载地址：[Android Studio 官网](https://developer.android.google.cn/studio?hl=en)
    2. 下拉页面找到 “Download Options”，选择 Windows 系统的`android-studio-2024.2.1.28-windows.zip`（带 zip 的压缩包，无需安装）
    3. 下载完成后，将压缩包保存到之前创建的`F:\Chengxusheji\Android\software`文件夹
- **步骤作用**：Android Studio 是谷歌官方的安卓开发工具，集成了代码编辑、编译、调试等功能，是安卓开发的核心 IDE
    

### 2. 解压并创建快捷方式

- **操作步骤**：
    
    1. 右键下载的压缩包，选择 “解压到” → 选择路径`F:\Chengxusheji\Android\studio`（解压后会自动生成`android-studio`子文件夹）
    2. 进入路径`F:\Chengxusheji\Android\studio\android-studio\bin`，找到`studio64.exe`文件
    3. 右键`studio64.exe` → 选择 “显示更多选项” → “发送到” → “桌面快捷方式”
- **步骤作用**：解压后直接使用，无需安装，简化流程；创建桌面快捷方式方便后续快速启动

### 3. 安装 Android Studio 并配置 SDK

- **操作步骤**：
    
    1. 双击桌面的`studio64.exe`快捷方式，启动 Android Studio
    2. 首次启动会提示 “导入设置”，选择 “不导入设置” → 点击 “OK”
    3. 弹出 “Android Studio Setup Wizard”，点击 “Next” → 选择 “Custom”（自定义安装）→ 点击 “Next”
    4. 配置 SDK 路径：在 “Android SDK Location” 中，选择之前创建的`F:\Chengxusheji\Android\sdk` → 点击 “Next”
    5. 保持默认的 SDK 组件（无需修改）→ 点击 “Next” → 点击 “Finish”，开始下载 SDK 组件
    6. 注意：下载时建议用手机热点（校园网可能限速或无法访问国外资源），等待下载完成后点击 “Finish”
- **步骤作用**：
    
    - 自定义 SDK 路径可避免默认安装到 C 盘，同时和 JDK 路径统一管理
    - 下载 SDK 组件是为了支持安卓项目开发（如系统 API、工具链等）

### 4. 新建项目验证安装

- **操作步骤**：
    
    1. 点击 “Start a new Android Studio project”（新建项目）
    2. 选择 “Empty Views Activity”（空视图项目）→ 点击 “Next”
    3. 项目配置：
        - Name：项目名称（如 “MyApplication”，无空格中文）
        - Package name：默认即可（如 “com.example.myapplication”）
        - Save location：选择非 C 盘路径（如`F:\Chengxusheji\Android\projects`）
        - Language：选择 “Java”（新手友好）
        - Minimum SDK：选择 “API 24: Android 7.0 (Nougat)”（兼容大部分设备）
    4. 点击 “Finish” 创建项目，此时会自动下载 Gradle（首次下载较慢，后续会优化）
- **步骤作用**：通过新建空项目，验证 Android Studio 能否正常创建和加载项目，同时触发 Gradle 和依赖下载
    

## 三、设置 Gradle 国内镜像（加速下载）

### 1. 找到 Gradle 配置文件

- **操作步骤**：
    1. 在 Android Studio 中，展开项目左侧目录，找到`gradle/wrapper/gradle-wrapper.properties`文件（双击打开）

### 2. 替换仓库配置

- **操作步骤**：
    
    1. 删除原文件中的所有内容，复制粘贴以下配置（使用阿里云镜像，国内加速）：
        
        
         ```kotlin
        pluginManagement {
            repositories {
                maven { url = uri("https://maven.aliyun.com/nexus/content/repositories/google") }
                maven { url = uri("https://maven.aliyun.com/nexus/content/groups/public") }
                maven { url = uri("https://maven.aliyun.com/nexus/content/repositories/jcenter") }
                maven { url = uri("https://plugins.gradle.org/m2/") }
                google {
                    content {
                        includeGroupByRegex("com\\.android.*")
                        includeGroupByRegex("com\\.google.*")
                        includeGroupByRegex("androidx.*")
                    }
                }
                mavenCentral()
                gradlePluginPortal()
            }
        }
        dependencyResolutionManagement {
            repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
            repositories {
                maven { url = uri("https://maven.aliyun.com/nexus/content/repositories/google") }
                maven { url = uri("https://maven.aliyun.com/nexus/content/groups/public") }
                maven { url = uri("https://maven.aliyun.com/nexus/content/repositories/jcenter") }
                maven { url = uri("https://plugins.gradle.org/m2/") }
                google()
                mavenCentral()
            }
        }
        
        rootProject.name = "My Application"
        include(":app")
        ```
        
    2. 保存文件（`Ctrl+S`）
- **步骤作用**：
    
    - 项目依赖（如 AndroidX、第三方库）默认从谷歌、mavenCentral 等国外仓库下载，速度慢
    - 阿里云镜像包含大部分常用依赖，加速依赖下载，避免项目编译时卡在 “Download dependencies”

### 3. 同步项目

- **操作步骤**：
    
    1. 再次点击 “Sync Project with Gradle Files”（小象图标）
    2. 等待同步完成，若右下角无报错，说明配置成功
- **步骤作用**：应用新的仓库配置，重新下载项目依赖，确保项目能正常编译运行
    

## 五、重新启动项目（确保配置生效）

### 操作步骤

1. 点击 Android Studio 顶部菜单栏 “File” → “Close Project”（关闭当前项目）
2. 重新双击桌面的`studio64.exe`，打开之前的项目
3. 等待项目自动同步（右下角小象图标停止转动，无报错）

### 步骤作用

- 让 Gradle 镜像和 Maven 仓库的配置完全生效，避免因缓存导致配置未应用

## 六、调试方式配置（虚拟机 / 真机）

### 1. 虚拟机调试（无需真实手机，适合新手）

#### （1）创建设备

- **操作步骤**：
    1. 点击 Android Studio 顶部工具栏的 “Device Manager”（手机图标，右侧边栏也可找到）
    2. 点击 “Create Device”（创建设备）→ 选择设备类型（如 “Small Phone” 小屏手机，适合测试）→ 点击 “Next”

#### （2）下载系统镜像

- **操作步骤**：
    1. 选择一个 Android 版本（建议选择 “API 33: Android 13”，兼容性好）
    2. 若该版本右侧显示 “Download”，点击下载（需等待镜像下载完成，用热点加速）
    3. 下载完成后，点击 “Next” → 保持默认配置（如设备名称、屏幕方向）→ 点击 “Finish”

#### （3）启动虚拟机

- **操作步骤**：
    1. 在 “Device Manager” 中，找到刚创建的设备，点击右侧的 “启动” 按钮（绿色三角形）
    2. 等待虚拟机启动（首次启动较慢，需 1-3 分钟，启动后会显示安卓系统界面）

#### （4）运行项目到虚拟机

- **操作步骤**：
    1. 确保虚拟机已启动，点击顶部工具栏的 “Run”（绿色三角形）或按下`Shift+F10`
    2. 等待项目编译并安装到虚拟机，安装完成后会自动打开 App

#### 步骤作用

- 虚拟机无需真实手机，随时可测试项目，适合前期开发调试

### 2. 真机调试（体验更真实，适合最终测试）

#### （1）准备工作

- **操作步骤**：
    1. 查看手机的 Android 版本（如红米：设置 → 我的设备 → 全部参数 → Android 版本，假设是 Android 13）
    2. 打开 Android Studio，点击 “Tools” → “SDK Manager” → 勾选 “API 33: Android 13” 对应的 “SDK Platform” 和 “Sources for Android SDK” → 点击 “Apply” 下载（确保 SDK 版本和手机一致）

#### （2）开启手机开发者模式

- **操作步骤**：
    1. 打开手机 “设置” → 找到 “关于手机” → 连续点击 “版本号” 7 次（会提示 “已进入开发者模式”）
    2. 返回设置，找到 “更多设置” → “开发者选项”（不同品牌手机路径可能不同，可搜索 “XX 手机 开发者模式开启”）

#### （3）开启 USB 调试

- **操作步骤**：
    1. 在 “开发者选项” 中，找到 “USB 调试” 并开启（弹出提示点击 “允许”）
    2. 用原装数据线将手机连接到电脑（非原装线可能仅支持充电，不支持数据传输）
    3. 手机弹出 “USB 用途” 选择框，选择 “仅限充电”（部分手机需选择 “传输文件”，可尝试切换）
    4. 电脑会自动安装手机 USB 驱动（若设备管理器中显示黄色感叹号，右键选择 “更新驱动程序” → “自动搜索驱动”）

#### （4）运行项目到真机

- **操作步骤**：
    1. 在 Android Studio 顶部工具栏，点击 “设备选择框”（默认显示虚拟机名称），会看到已连接的真机（显示手机型号）
    2. 选择真机，点击 “Run”（绿色三角形）或按下`Shift+F10`
    3. 手机会弹出 “是否允许安装应用”，点击 “允许”
    4. 等待项目安装完成，手机会自动打开 App，桌面会出现 App 图标

#### 步骤作用

- 真机调试能真实反映 App 在实际设备上的运行效果，避免虚拟机和真机的兼容性问题

## 总结

按照以上步骤，可完成从 JDK 安装、Android Studio 配置到调试环境搭建的全流程。核心要点：

1. 文件夹路径无空格 / 中文，避免路径报错
2. 国内镜像（Gradle+Maven）是加速下载的关键，必须配置
3. 虚拟机适合前期开发，真机适合最终测试
4. 若遇到报错，优先查看右下角提示，大概率是依赖未下载完成或配置错误，重新同步即可