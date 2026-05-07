---
title: "终端博客系统搭建记录"
date: 2026-05-12
category: projects
tags:
  - 项目
  - Eleventy
  - Web
excerpt: "基于 Eleventy 的静态博客，终端风格界面。"
readingTime: 30 min
---

# 终端博客系统搭建记录

这个项目从零开始，使用 Eleventy 构建一个终端风格的个人学习监控博客。

## 技术选型

- **Eleventy**: 静态站点生成器，轻量灵活
- **Nunjucks**: 模板引擎
- **原生 CSS/JS**: 无框架依赖，保持轻量

## 核心功能

1. 日志流视图
2. 命令系统（filter/grep/status 等）
3. 多视图切换（仪表盘/技能树/关于）
4. 暗色/亮色主题
5. 响应式设计

## 遇到的坑

- Eleventy 的 collections 和 filters 在初始化时的加载顺序
- CSS 变量在亮色主题下的映射容易遗漏
- 移动端 detail-panel 的 fixed 定位和 z-index 冲突

## 待完成

- [ ] 接入 Git 自动生成日志
- [ ] 文章全文搜索
- [ ] 虚拟滚动优化

#项目 #Eleventy #博客