# Observatory

我把每天的编码、阅读、调试和思考都当作信号记录下来。这里是公开的日志，也是一场持续的自我实验。

## 如何添加文章

### 1. 创建文章文件

在 `src/articles/{category}/` 下创建 `.md` 文件，分类为 `tech`、`reading`、`essays`、`projects`。

frontmatter 只需指定三个字段，其余由扫描脚本自动补全：

```yaml
---
title: 文章标题
date: 2026-05-08
category: tech
---
```

### 2. 添加插图

在文章同目录下建 `img/` 文件夹，放入图片。

插入图片支持两种语法：

**Obsidian 风格（推荐）**
```
![[Pasted_image_xxx.png]]
```

**标准 Markdown**
```
![](img/xxx.png)
```

两种写法都会被转为绝对路径 `/img/xxx.png`。

### 3. 运行扫描

```bash
npm run scan:articles
```

文章页面路径：`/articles/tech/slug/`
