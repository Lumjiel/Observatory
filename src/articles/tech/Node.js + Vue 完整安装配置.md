
## 一、前置知识：Node.js 和 Vue 是什么？有什么用？

### 1. Node.js

- **是什么**：简单说，Node.js 是一个能让 JavaScript 脱离浏览器运行的环境（基于 Chrome 的 V8 引擎）。原本 JS 只能在网页里写交互效果，有了 Node.js 后，能直接在电脑上跑 JS 代码，还能用来开发服务器、后端程序。
- **有什么用**：
    - 给前端项目提供 “运行环境”（比如 Vue 项目需要 Node.js 才能启动、打包）；
    - 自带的 `npm`（包管理工具）能快速下载 / 管理各种代码库（比如 Vue、React、webpack 等）；
    - 开发后端接口、搭建小型服务器（前端开发者不用学其他语言也能写接口）。

### 2. Vue

- **是什么**：Vue 是一套用于构建用户界面的 “前端框架”（JavaScript 库），核心是让前端开发更简单、高效，尤其适合做单页面应用（比如手机 App 式的网页、管理系统）。
- **有什么用**：
    - 简化页面交互逻辑（比如点击按钮切换内容、表单验证）；
    - 实现数据和页面的 “双向绑定”（数据变了页面自动更，页面改了数据自动更）；
    - 拆分代码为 “组件”（比如导航栏、表格、弹窗可重复使用，减少重复代码）；
    - 配合 Vue 脚手架（vue-cli）能快速搭建完整的项目结构，不用自己配置复杂工具。

## 二、Node.js 安装和配置（必做：Vue 依赖 Node.js 环境）

### 1. 下载安装 Node.js

#### 步骤 1：下载安装包

- Node.js 官网：[https://nodejs.org/en/download/](https://nodejs.org/en/download/)（推荐下载 **LTS 版本**，长期支持更稳定，比如 v20.x 系列）
- VS Code 下载（写代码的工具）：[https://code.visualstudio.com/download](https://code.visualstudio.com/download)（根据系统选 Windows/macOS/Linux 版本）

#### 步骤 2：安装 Node.js

1. 双击下载好的 Node.js 安装包，开始安装；
2. 勾选 “I accept the terms...”（同意协议），点击 Next；
3. 选择安装路径（默认是 C 盘，也可以改到 D 盘，比如 `D:\Program Files\nodejs`，记住这个路径，后面要用）；
4. 后续步骤全部 “无脑 Next”，直到出现 “Install”，点击后等待安装完成；
5. 安装结束后，取消勾选 “Automatically install...”，点击 Finish。

#### 步骤 3：验证安装是否成功（关键！）

1. 按 `Win + R` 打开运行窗口，输入 `cmd`，**右键以管理员身份运行命令提示符**（必须管理员，否则后续配置可能报错）；
2. 在命令行输入以下命令，查看版本号（能显示则安装成功）：
    - 查看 Node.js 版本：`node -v`（示例输出：v20.10.0）
    - 查看 npm 版本（npm 是 Node.js 自带的包管理工具）：`npm -v`（示例输出：10.2.3）

### 2. 配置 npm 全局目录和缓存目录（避免权限问题）

默认情况下，npm 下载的包会存在 C 盘（占用系统空间），且可能出现权限报错，所以手动配置到 D 盘。

#### 步骤 1：手动创建目录

1. 打开电脑文件管理器，在 D 盘创建以下两个文件夹（路径可自定义，建议和 Node.js 安装路径一致）：
    - 全局安装目录：`D:\Program Files\nodejs\node_global`（存放 npm 全局下载的包）
    - 缓存日志目录：`D:\Program Files\nodejs\node_cache`（存放下载缓存，加快后续下载速度）
2. 给两个文件夹设置 “写入权限”：
    - 右键文件夹 → 属性 → 安全 → 编辑 → 选中当前用户（比如 admin）→ 勾选 “完全控制”“修改”“写入”→ 确定。

#### 步骤 2：用命令配置 npm 路径

1. 继续用==管理员身份打开命令提示符==；
2. 输入以下命令（路径要和你创建的文件夹一致，复制时注意引号是英文的）：
    - 配置全局目录：`npm config set prefix "D:\Program Files\nodejs\node_global"`
    - 配置缓存目录：`npm config set cache "D:\Program Files\nodejs\node_cache"`
执行下面的命令，将npm的全局模块目录和缓存目录配置到刚刚创建的那两个目录中：
#### 步骤 3：验证配置是否成功
![[Pasted_image_20260109173458.png]]

在命令行输入以下命令，查看配置结果：

- 查看全局目录：`npm config get prefix`（输出你设置的 node_global 路径）
- 查看缓存目录：`npm config get cache`（输出你设置的 node_cache 路径）
- 查看所有 npm 配置：`npm config list`（能看到 prefix 和 cache 对应的路径）
- 查看全局已安装包（刚配置完可能为空，后续装包后会显示）：`npm list -global`
![[Pasted_image_20260109173544.png]]
### 3. 配置 Node.js 环境变量（关键！否则全局包无法使用）

环境变量的作用是让电脑在任何目录下都能找到 Node.js 和 npm 命令。

#### 步骤 1：配置 “用户变量”（当前用户生效）

1. 右键 “此电脑” → 属性 → 高级系统设置 → 环境变量；
2. 在 “用户变量” 栏（上半部分）找到 “Path”，双击编辑；
3. 删除 Path 中原来的 `C:\Users\admin\AppData\Roaming\npm`（旧的 npm 全局路径）；
4. 点击 “新建”，添加两个路径（和你创建的目录一致）：
    - `D:\Program Files\nodejs\node_global`
    - `D:\Program Files\nodejs\node_cache`
5. 点击 “确定” 保存。
![[Pasted_image_20260109173642.png]]
#### 步骤 2：配置 “系统变量”（所有用户生效）

1. 在 “系统变量” 栏（下半部分）点击 “新建”；
2. 变量名：`NODE_PATH`，变量值：`D:\Program Files\nodejs\node_global\node_modules`（全局包的模块目录）；
![[Pasted_image_20260109173707.png]]
3. 找到系统变量中的 “Path”，双击编辑；
4. 点击 “新建”，添加 Node.js 安装路径：`D:\Program Files\nodejs`（就是你安装 Node.js 时的路径）；或==％NODE_PATH%==
![[Pasted_image_20260109173727.png]]
5. 所有窗口都点击 “确定” 保存，关闭命令提示符（环境变量生效需要重启命令行）。

### 4. 配置淘宝镜像源（加快下载速度）

npm 默认的下载源在国外，国内下载慢、容易失败，换成淘宝镜像（国内镜像源，速度快）。

#### 步骤 1：查看当前下载源

打开管理员命令提示符，输入：`npm config get registry`（默认输出：`https://registry.npmjs.org/`）

#### 步骤 2：配置淘宝镜像

输入命令：`npm config set registry https://registry.npmmirror.com`（淘宝镜像最新地址，之前的 [taobao.org](https://taobao.org/) 已停用）

#### 步骤 3：验证配置成功

再次输入：`npm config get registry`（输出 `https://registry.npmmirror.com` 则成功）

或输入 `npm config list`，能看到 registry 对应的淘宝地址。

## 三、安装 Vue 及相关工具

### 1. 安装 Vue.js（全局）

1. 管理员命令提示符中输入：`npm install vue -g`（`-g` 表示全局安装，能在任何项目中使用）；
2. 验证安装：
    - 查看 Vue 信息：`npm info vue`（会显示 Vue 的版本、依赖等详细信息）；
    - 查看 Vue 版本：`npm list vue -global`（输出 Vue 的版本号，比如 ^3.3.11）。
![[Pasted_image_20260109173912.png]]
### 2. 安装 webpack（打包工具）

webpack 是前端项目的 “打包工具”，能把 Vue 项目的代码、图片、CSS 等整合压缩，方便部署。

1. 安装 webpack 全局：`npm install webpack -g`；
2. 安装 webpack 命令行工具（必须装，否则无法使用 webpack 命令）：`npm install --global webpack-cli`；
3. 验证安装：输入 `webpack -v`（输出版本号，比如 webpack 5.90.0，webpack-cli 5.1.4 则成功）。

### 3. 安装 Vue 脚手架（vue-cli）

vue-cli 是 Vue 官方的项目脚手架，能快速搭建 Vue 项目结构（不用自己手动配置 webpack、路由等），分为 2.x 和 3.x+ 版本（3.x+ 更简洁，推荐用 3.x+）。

#### （可选）卸载旧版本脚手架

如果之前装过旧版本，先卸载：

- 卸载 2.x 版本：`npm uninstall vue-cli -g`；
- 卸载 3.x+ 版本：`npm uninstall @vue/cli -g`。

#### 安装 3.x+ 版本脚手架

1. 管理员命令提示符输入：`npm install @vue/cli -g`（注意 3.x+ 是 `@vue/cli`，不是 `vue-cli`）；
2. 验证安装：输入 `vue --version` 或 `vue -V`（大写 V），输出版本号（比如 5.0.8 则成功）。

#### 安装 Vue Router（路由工具）

Vue Router 是 Vue 项目的路由插件，能实现页面跳转（比如点击导航栏切换不同页面）：

- 输入命令：`npm install -g vue-router`。

### 4. 用 vue-cli 3.x+ 创建 Vue 项目（关键步骤）

#### 步骤 1：选择项目存放目录

1. 打开电脑文件管理器，找到你想放项目的文件夹（比如 `D:\VueProjects`）；
2. 在该文件夹空白处，**按住 Shift 键 + 右键**，选择 “在此处打开命令窗口”（或 “在此处打开 PowerShell 窗口”），确保是管理员身份（否则可能没权限创建文件）。

#### 步骤 2：创建项目

1. 在命令行输入：`vue create 项目名`（项目名只能是英文、数字、下划线，比如 `vue-demo`）；
2. 按回车后，选择项目配置方式：
    - 用键盘上下键选择 **Manually select features**（自定义配置），按回车；
3. 选择项目需要的功能（按空格键勾选 / 取消，选完按回车）：
    - 必选：`Babel`（ES6 转 ES5，兼容旧浏览器）、`Router`（路由）、`CSS Pre-processors`（CSS 预处理器）；
    - 可选：`Linter / Formatter`（代码规范检查，新手可暂时不选，避免报错）；
4. 选择 Vue 版本：
    - 上下键选择 **3.x**（推荐，最新稳定版），按回车；
5. 是否启用路由的 history 模式（URL 中没有 # 号）：
    - 输入 `y`（是），按回车；
6. 选择 CSS 预处理器（选一个即可）：
    - 上下键选择 **Sass/SCSS (with dart-sass)**，按回车；
7. 后续配置全部按回车（默认选项即可）：
    - 选择配置文件存放位置：默认 “In dedicated config files”（单独的配置文件）；
    - 是否保存当前配置为模板：输入 `n`（不保存），按回车；
8. 等待项目创建（会自动下载依赖包，耐心等 1-3 分钟，出现 “Successfully created project” 则创建成功）。

#### 步骤 3：启动项目

1. 进入项目目录：在命令行输入 `cd 项目名`（比如 `cd vue-demo`），按回车；
2. 启动项目：输入 `npm run serve`（3.x+ 用 `serve`，2.x 用 `dev`）；
3. 启动成功后，命令行会显示访问地址（比如 `http://localhost:8080/` 或 `http://192.168.1.2:8080/`）；
4. 打开浏览器，输入显示的地址，能看到 Vue 的默认页面，则项目启动成功！

#### 步骤 4：停止项目

在命令行按 `Ctrl + C`，会提示是否终止，输入 `y` 按回车，即可停止项目运行。

## 四、关键注意事项（避坑重点）

1. 全程必须用 **管理员身份** 打开命令提示符 / PowerShell，否则会出现 “权限不足”“无法写入” 等报错；
2. 目录路径必须一致：创建的 `node_global`、`node_cache` 路径，和 npm 配置、环境变量中的路径要完全一样（包括大小写、空格）；
3. 环境变量配置后，要重启命令行才能生效；
4. 淘宝镜像源用最新的 `https://registry.npmmirror.com`，旧的 `taobao.org` 已废弃，会导致下载失败；
5. 创建 Vue 项目时，项目名不能有中文、特殊字符，否则创建失败；
6. 如果启动项目报错 “端口被占用”，可以修改 `package.json` 中的 `scripts` 字段，添加端口参数：`"serve": "vue-cli-service serve --port 8081"`（改为 8081 或其他未被占用的端口）。
