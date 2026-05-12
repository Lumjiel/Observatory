## 一、前置准备：明确依赖与下载工具

### 1. 必备依赖清单

- 操作系统：Windows 10/11（64 位）
- 基础工具：
    - Android Studio（用于 Android SDK、模拟器、开发工具支持）
    - Flutter SDK（核心开发框架）
    - Git（可选，用于版本控制，部分 Flutter 功能依赖）
- 硬件要求：至少 4GB 内存，预留 10GB 以上磁盘空间（存储 SDK、依赖、模拟器镜像）

### 2. 工具下载地址

- Flutter SDK：[官网下载页](https://flutter.dev/docs/get-started/install/windows)（选择稳定版 Stable channel）
- Android Studio：[官网下载页](https://developer.android.com/studio)（默认最新版即可）
- Git：[官网下载页](https://git-scm.com/download/win)（可选，按默认选项安装）

## 二、第一步：安装 Flutter SDK（核心步骤）

### 1. 解压 Flutter SDK

1. 下载 Flutter SDK 压缩包（如`flutter_windows_3.16.9-stable.zip`）；
2. 选择**非中文、无空格**的目录解压（重要！避免后续路径识别错误），示例路径：
    - 推荐：`D:\Develop\Flutter\flutter`（解压后文件夹内包含`bin`、`packages`等子目录）
3. 记住该路径（后续配置环境变量需用到）。

### 2. 配置 Flutter 的 bin 目录到系统环境变量（关键）

目的：让 Windows 命令行能全局识别`flutter`命令，无需每次进入 SDK 目录执行。

步骤：

1. 右键「此电脑」→ 点击「属性」→ 点击「高级系统设置」→ 点击「环境变量」；
2. 在「系统变量」栏中，找到「Path」变量，点击「编辑」；
3. 点击「新建」，粘贴 Flutter SDK 的`bin`目录路径（示例：`D:\Develop\Flutter\flutter\bin`）；
4. 连续点击「确定」保存（需保存所有弹出窗口，不遗漏）；
5. 验证配置：
    - 打开**新的命令行窗口**（旧窗口需重启才生效）；
    - 输入`flutter --version`，若输出 Flutter 版本号（如`Flutter 3.16.9`）和 Dart 版本号，说明环境变量配置成功。

## 三、第二步：安装 Android Studio（Android 开发环境支撑）

### 1. 安装 Android Studio

1. 运行下载的 Android Studio 安装包（如`android-studio-2023.1.1.26-windows.exe`）；
2. 点击「Next」，默认勾选「Android Studio」和「Android Virtual Device」（模拟器支持，必选）；
3. 选择安装路径（推荐非中文、无空格，示例：`D:\Develop\AndroidStudio`）；
4. 等待安装完成（需下载基础组件，耗时视网络而定）；
5. 首次启动 Android Studio：
    - 若提示「Import Android Studio Settings」，选择「Do not import settings」→「OK」；
    - 进入「Welcome to Android Studio」界面，点击「Next」→ 选择「Standard」（标准安装）→「Next」；
    - 选择 UI 主题（按需选择）→「Next」；
    - 确认 SDK 安装路径（默认即可，示例：`C:\Users\你的用户名\AppData\Local\Android\Sdk`，记住此路径，后续配置需用到）；
    - 点击「Finish」，开始下载 Android SDK 基础组件（耐心等待，约 5-10 分钟）。

### 2. 安装 Android SDK Command-line Tools（解决`cmdline-tools missing`问题）

1. 打开 Android Studio，点击顶部菜单栏「Tools」→「SDK Manager」（或快捷键`Ctrl+Alt+S`打开设置，搜索「SDK Manager」）；
2. 切换到「SDK Tools」标签页，勾选「Show Package Details」（显示详细组件）；
3. 展开「Android SDK Command-line Tools (latest)」，勾选该组件（版本号自动匹配最新，无需手动选择）；
4. 确保「Android SDK Build-Tools」「Android Emulator」「Android SDK Platform-Tools」已勾选（默认已选，若未选则勾选）；
5. 点击「Apply」→ 弹出组件下载确认框，点击「OK」→ 等待安装完成（约 2-5 分钟）；
6. 安装完成后点击「OK」关闭 SDK Manager。

### 3. 配置 Android SDK 环境变量（可选，增强兼容性）

目的：让 Flutter 能自动识别 Android SDK 路径，避免后续手动配置。

步骤：

1. 打开「环境变量」（同第一步配置 Flutter 环境变量的入口）；
2. 在「系统变量」栏点击「新建」，添加以下变量：
    - 变量名：`ANDROID_HOME`
    - 变量值：Android SDK 的安装路径（即步骤 1.5 中记住的路径，示例：`C:\Users\你的用户名\AppData\Local\Android\Sdk`）；
3. 编辑「系统变量」中的「Path」，添加以下 2 个路径（基于上面的 SDK 路径）：
    - `%ANDROID_HOME%\platform-tools`
    - `%ANDROID_HOME%\tools`
4. 点击「确定」保存，重启命令行窗口生效。

## 四、第三步：配置 Flutter 国内镜像（解决下载慢 / 超时）

### 1. 为什么需要配置镜像？

Flutter 默认依赖国外站点（如`pub.dev`、`storage.googleapis.com`），国内网络访问慢或超时，导致初始化失败、依赖下载卡住。

### 2. 永久配置镜像（一劳永逸）

步骤：

1. 打开「环境变量」（右键此电脑→属性→高级系统设置→环境变量）；
2. 在「用户变量」栏点击「新建」，依次添加 2 个变量（变量名和值必须完全一致，无空格）：
  查看「用户变量」栏，确认有这 2 个变量（和下面完全一致，无空格、无拼写错误）：

| 变量名                      | 变量值                                                            |
| ------------------------ | -------------------------------------------------------------- |
| PUB_HOSTED_URL           | [https://pub.flutter-io.cn](https://pub.flutter-io.cn)         |
| FLUTTER_STORAGE_BASE_URL | [https://storage.flutter-io.cn](https://storage.flutter-io.cn) |

1. 点击「确定」保存，**重启所有命令行窗口和 Android Studio**（确保变量生效）。

### 3. 验证镜像配置

1. 打开新的命令行窗口；
2. 输入以下 2 条命令，若输出与配置的镜像地址一致，说明配置成功：
    
    
    ```cmd
    echo %PUB_HOSTED_URL%
    echo %FLUTTER_STORAGE_BASE_URL%
    ```
    

## 五、第四步：初始化 Flutter 并解决依赖问题

### 1. 首次运行 Flutter 初始化

1. 打开命令行窗口，输入`flutter`命令（首次运行会自动执行初始化）；
2. 等待流程完成（显示`Got dependencies.`代表依赖下载完成）；
    - 若之前配置了镜像，耗时约 1-3 分钟；
    - 若仍卡住，按`Ctrl+C`终止，重新执行`flutter`（断点续传，已下载文件不重复）。

### 2. 接受 Android SDK 许可协议（解决`license unknown`问题）

1. 在命令行输入以下命令：
    ```cmd
    flutter doctor --android-licenses
    ```
    
2. 此时会弹出一系列许可协议确认，**每次提示时输入`y`并回车**（约 5-8 次确认）；
3. 最终显示`All SDK package licenses accepted`，代表所有协议已接受。

## 六、第五步：使用`flutter doctor`检查并修复环境

### 1. 执行环境检查

在命令行输入`flutter doctor`，该命令会自动检测 Flutter 开发所需的所有环境（Flutter、Windows、Android 工具链、Chrome、Visual Studio 等）。

### 2. 常见问题及解决方案

|问题现象|解决方案|
|---|---|
|`[×] Android toolchain - develop for Android devices` → `cmdline-tools component is missing`|回到第三步 2，重新安装`Android SDK Command-line Tools (latest)`|
|`Android license status unknown`|重新执行`flutter doctor --android-licenses`，确保所有`y`确认完成|
|`Unable to connect to storage.googleapis.com`|检查镜像配置是否生效，重启命令行窗口，重新执行`flutter doctor`|
|`HTTP error when checking GitHub`|属于网络临时问题，不影响基础开发；需访问 GitHub 时切换手机热点或配置 GitHub 加速|
|`[×] Visual Studio - develop for Windows`|若需开发 Windows 桌面应用，安装[Visual Studio 2022](https://visualstudio.microsoft.com/)，勾选「桌面开发使用 C++」组件；无需则可忽略|

### 3. 目标状态

执行`flutter doctor`后，核心组件显示「✓」即可（GitHub 相关错误可忽略），示例：

```plaintext
[✓] Flutter (Channel stable, 3.16.9, on Microsoft Windows [版本 10.0.19045.3930], locale zh-CN)
[✓] Windows Version (Installed version of Windows is version 10 or higher)
[✓] Android toolchain - develop for Android devices (Android SDK version 34.0.0)
[✓] Chrome - develop for the web
[✓] Visual Studio - develop for Windows (Visual Studio Community 2022 17.9.6)
[✓] Android Studio (version 2023.1)
[✓] Connected device (3 available)
[✓] Network resources
```

## 七、第六步：创建第一个 Flutter 项目（验证环境）

### 1. 新建项目

1. 打开 Android Studio，点击「Start a new Flutter project」；
2. 选择「Flutter Application」→「Next」；
3. 填写项目信息：
    - Project name：项目名称（如`first_flutter_app`，只能包含字母、数字、下划线，首字母小写）；
    - Flutter SDK path：选择 Flutter SDK 的解压路径（示例：`D:\Develop\Flutter\flutter`）；
    - Project location：项目保存路径（非中文、无空格）；
    - Description：项目描述（可选）；
4. 点击「Next」→ 选择「AndroidX artifacts」（默认勾选）→「Next」；
5. 选择项目图标（默认即可）→「Finish」；
6. 等待项目初始化（首次会下载项目依赖，约 1-2 分钟，镜像生效后更快）。

### 2. 运行项目（以 Android 模拟器为例）

1. 启动 Android 模拟器：
    - 点击 Android Studio 顶部工具栏的「Device Manager」（设备管理器，图标为手机 + 齿轮）；
    - 点击「Create device」→ 选择一款设备（如「Pixel 7」）→「Next」；
    - 选择系统镜像（推荐 API 33 或 34，点击「Download」下载，约 1-3 分钟）→「Next」；
    - 点击「Finish」创建模拟器，然后点击模拟器右侧的「Play」按钮启动（首次启动约 1 分钟）。
2. 运行项目：
    - 确保顶部工具栏已选择创建的模拟器（如「Pixel 7 - API 33」）；
    - 点击顶部工具栏的「Run」按钮（绿色三角形），或快捷键`Shift+F10`；
3. 验证结果：
    - 模拟器中出现 Flutter 默认的「计数器应用」（显示「0」和「+」按钮），代表环境完全就绪，可正常开发。

## 八、常见避坑点总结

1. 路径禁忌：所有工具（Flutter SDK、Android Studio、项目）的路径**不能有中文、空格或特殊字符**，否则会导致命令识别失败、项目编译报错；
2. 环境变量生效：修改环境变量后，必须重启命令行 / Android Studio，否则配置不生效；
3. 镜像优先级：永久镜像配置在「用户变量」比「系统变量」更稳定，避免权限问题；
4. 模拟器镜像：选择 API 33 + 的系统镜像，兼容性更好，避免部分 Flutter 功能不支持；
5. 网络问题：若所有配置都正确但仍报错，优先切换网络（如手机热点），排除局域网限制。