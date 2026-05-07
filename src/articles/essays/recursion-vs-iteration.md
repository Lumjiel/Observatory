---
title: "递归与迭代的思考"
date: 2026-03-20
category: essays
tags:
  - 思考
  - 算法
excerpt: "递归是用栈来保存状态，迭代是显式控制流程。"
readingTime: 5 min
---

# 递归与迭代的思考

今天重新思考了递归和迭代的本质区别。

## 递归

递归将问题分解为子问题，自己调用自己。
- 用系统栈保存状态
- 代码简洁，但可能有栈溢出风险

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

## 迭代

迭代用循环显式控制流程。
- 不需要系统栈，开销更小
- 需要手动管理状态

```python
def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result
```

## 尾递归优化

在尾递归情况下，编译器可以优化为迭代形式，避免栈增长。
但 Python 不支持尾递归优化，而 Scheme 等语言会保证尾递归优化。

## 总结

递归和迭代在表达能力上是等价的。选择哪个取决于场景：
- 问题结构天然递归（如树）→ 递归更清晰
- 需要高性能 → 迭代更安全

#思考 #算法