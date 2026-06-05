---
title: Java 多态和接口：我学了三遍才真懂
date: '2026-05-18'
category: blog
tags:
  - Java
  - 多态
  - 接口
excerpt: ''
readingTime: 6 min
order: 0
draft: false
---

说实话，Java 的多态我看了三遍才觉得自己真的理解。

第一次看：哦，就是子类可以当父类用。背下来了，面试能过。
第二次看：不对，为什么要用？什么时候用？感觉和接口有什么区别？
第三次看：原来这俩是绑在一起的，搞懂接口，多态就懂了 80%。

这篇文章，就是我第三遍的总结。给你一个"原来如此"的解释。

![image.png](/img/2026/misc/0324d136-108e-4dd3-b442-dc7053c95efa.png)

### 多态是什么

先说官方定义：同一个方法调用，不同对象产生不同行为。

但说实话，这个定义没什么用。我第一次看完就忘。

后来我找到一个更好记的说法：

**多态就是"干什么"和"谁干"分开。**

你喊一声"来干活"，Dog 过来叼球，Cat 过来抓老鼠——具体谁干什么，取决于谁响应。

```java
class Animal {
    void work() {}
}

class Dog extends Animal {
    @Override
    void work() {
        System.out.println("叼球");
    }
}

class Cat extends Animal {
    @Override
    void work() {
        System.out.println("抓老鼠");
    }
}

// 调用方只认识 Animal
Animal a = new Dog();
a.work(); // 输出：叼球

a = new Cat();
a.work(); // 输出：抓老鼠
```

你发现没有：**调用的代码从来不用改**，换成什么动物都行。

这才是多态的核心——调用方和具体实现解耦了。

![image.png](/img/2026/misc/346befcf-a38d-406b-a6c3-e53bdb5764d2.png)

### 两种多态：编译时和运行时

Java 里实际上存在两种多态，很多人搞混。

| 类型 | 发生时期 | 机制 | 例子 |
|:---|:---|:---|:---|
| **编译时多态** | 编译时 | 方法重载（同名不同参） | `println(int)` vs `println(String)` |
| **运行时多态** | 运行时 | 方法重写 + 向上转型 | 上面那个 Animal/Dog/Cat 的例子 |

面试常问的多态，一般指**运行时多态**。

因为重载在编译时就定了，编译器看参数类型就知道调哪个。但重写不一样——运行前编译器根本不知道 `a` 指向的是 Dog 还是 Cat，所以要等到运行时通过**虚方法表**来确定。

这个机制叫**动态分派**，有兴趣可以深挖，这里不展开。

![image.png](/img/2026/misc/1f19c522-0c3f-4d06-a98d-eb0a906aba73.png)

### 接口：多态的催化剂

光有多态还不够，接口才是真正把它用起来的东西。

其实多态可以不用接口实现——用继承（extends）就够了。但继承的问题是：**一个类只能继承一个类**。

你想让一个类同时"能排序"和"能比较"，单继承根本做不到。

接口来了：**一个类可以实现多个接口**。

```java
// 用接口定义能力
interface Comparable {
    int compareTo(Object o);
}

interface Serializable {
    void serialize();
}

// 一个类实现多个接口
class Student implements Comparable, Serializable {
    @Override
    public int compareTo(Object o) {
        return this.name.compareTo(((Student) o).name);
    }

    @Override
    public void serialize() {
        // 序列化逻辑
    }
}
```

然后你可以这样写：

```java
// 只关心对象有没有"比较"这个能力
void sort(Comparable[] array) {
    // 排序逻辑，调用 compareTo
}
```

调用方不关心数组里是 Student 还是 Teacher，只关心它们**能比较**。

这就是接口的意义：**把"能力"从"类"里抽离出来**，让不同类可以拥有相同的能力。

### 实际场景：为什么你需要这个

说理论不够，说个真实场景。

我之前写一个插件系统，需要加载用户自定义的处理器。

不用多态和接口的话，我得这样写：

```java
if (type.equals("image")) {
    ImageProcessor p = (ImageProcessor) plugin;
    p.processImage();
} else if (type.equals("video")) {
    VideoProcessor p = (VideoProcessor) plugin;
    p.processVideo();
}
```

每加一个类型就要改这段代码，加到 10 种就开始烂了。

用接口重构：

```java
interface Plugin {
    void execute();
}

class ImagePlugin implements Plugin {
    @Override
    public void execute() { /* 处理图片 */ }
}

class VideoPlugin implements Plugin {
    @Override
    public void execute() { /* 处理视频 */ }
}

// 调用方只认 Plugin
void load(Plugin p) {
    p.execute(); // 不用管具体是什么插件
}
```

每加一个新类型，只需新建一个类，实现 Plugin 接口。调用方一行代码不用改。

**这就是多态+接口的威力：开闭原则（对扩展开放，对修改关闭）。**

### 多态的代价

说完美了也要说点坑。

多态有一个副作用：**子类可能丢掉父类没有的属性和方法**。

```java
Animal a = new Dog();
a.work();      // ✅ 能调
a.lick();      // ❌ 编译报错，Animal 没有 lick 方法
```

当你把对象"向上转型"之后，编译器只认父类的能力，子类扩展的东西全藏起来了。

想用的话，要么**向下转型**（强转），要么**设计时就把该有的方法放父类/接口里**。

向下转型有风险：

```java
Animal a = new Cat();
// 如果 a 实际是 Cat，强转成 Dog 会抛 ClassCastException
Dog d = (Dog) a; // 💥 运行时报错
```

安全的做法是先判断：

```java
if (a instanceof Dog) {
    Dog d = (Dog) a;
}
```

但更根本的解法是：设计接口时想清楚需要暴露哪些能力，别让调用方去向下转型。

### 总结

多态和接口是一对，分开学容易迷糊，一起学就通了。

记住三条：

1. **多态 = 干什么和谁干分开**，调用方不关心具体类型
2. **接口 = 能力的抽象**，一个类可以实现多个接口
3. **组合使用 = 扩展灵活 + 代码干净**，遵循开闭原则

下次写代码时，如果你在写一堆 `if (type == X)`，想一想：能不能用多态+接口重构？

发现没有，多态和接口几乎是 Java 里最重要的设计工具，用好这两个，代码质量直接上一个台阶。
