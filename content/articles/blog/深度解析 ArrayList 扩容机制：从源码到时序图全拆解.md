---
github_repo: jjmk6|Knowledge_JIE
---
在 Java 开发中，ArrayList 是最常用的集合类之一，但其底层的扩容机制却常常成为面试和开发中的高频考点。本文将从底层数据结构出发，结合源码和时序图，完整拆解 ArrayList 的扩容流程，帮你彻底搞懂这一核心机制。

## 一、ArrayList 底层数据结构

ArrayList 的核心是**动态数组**，所有操作最终都围绕数组的扩容和元素复制展开。先看核心源码结构：

```java
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable {
    
    // 真正存储元素的数组（transient表示不参与序列化）
    transient Object[] elementData;
    
    // 数组中实际元素的个数（≠数组长度）
    private int size;
    
    // 默认初始容量
    private static final int DEFAULT_CAPACITY = 10;
    
    // 空数组常量（区分无参构造和指定容量0的构造）
    private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};
    private static final Object[] EMPTY_ELEMENTDATA = {};
}
```

### 关键属性说明

- `elementData`：底层存储容器，数组长度代表当前容量
- `size`：实际元素数量，扩容判断的核心依据
- `DEFAULT_CAPACITY`：无参构造时的默认初始容量（10）
- 两个空数组常量：区分「无参构造」和「指定容量 0 的构造」，避免扩容逻辑混淆

## 二、完整扩容流程（附时序图）

以「添加第 11 个元素触发扩容」为例，通过时序图 + 源码的方式，分步拆解整个流程：

### 核心时序图（添加第 11 个元素）

### 分步详解（源码级）

#### 步骤 1：调用 add () 方法触发扩容检查

```java
// 客户端代码
ArrayList<String> list = new ArrayList<>();
// 前10次add不触发扩容，第11次触发
for (int i = 0; i < 11; i++) {
    list.add("元素" + (i+1));
}

// ArrayList的add()源码
public boolean add(E e) {
    // 核心：先检查容量，再添加元素
    ensureCapacityInternal(size + 1);  // 传入所需最小容量：size+1
    elementData[size++] = e;           // 元素放入数组，size自增
    return true;
}
```

**关键**：add () 方法的核心逻辑是「先确保容量足够，再添加元素」，避免数组越界。

#### 步骤 2：计算所需最小容量（calculateCapacity）

```java
private static int calculateCapacity(Object[] elementData, int minCapacity) {
    // 无参构造的空数组，返回默认容量10和minCapacity的较大值
    if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        return Math.max(DEFAULT_CAPACITY, minCapacity);
    }
    // 非首次添加/指定容量构造，直接返回minCapacity
    return minCapacity;
}
```

**场景区分**：

- 首次添加（空数组）：返回`max(10, 1)` → 10，保证初始容量为 10
- 第 11 次添加：直接返回 11，进入扩容判断

#### 步骤 3：判断是否需要扩容（ensureExplicitCapacity）

```java
private void ensureExplicitCapacity(int minCapacity) {
    modCount++;  // 修改次数+1，用于fail-fast机制
    
    // 核心判断：所需容量 > 当前数组长度 → 扩容
    if (minCapacity - elementData.length > 0)
        grow(minCapacity);  // 扩容核心方法
}
```

**关键**：

- `modCount`：记录集合修改次数，迭代器遍历期间如果 modCount 变化，会抛出`ConcurrentModificationException`（fail-fast 机制）
- 扩容触发条件：`minCapacity > elementData.length`

#### 步骤 4：扩容核心逻辑（grow 方法）

```java
private void grow(int minCapacity) {
    // 1. 获取旧容量
    int oldCapacity = elementData.length;
    
    // 2. 计算新容量：旧容量 + 旧容量/2（1.5倍扩容，位运算更高效）
    int newCapacity = oldCapacity + (oldCapacity >> 1);
    
    // 3. 处理1.5倍仍不足的情况（如批量添加元素）
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;
    
    // 4. 处理最大容量限制（Integer.MAX_VALUE - 8）
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);
    
    // 5. 数组复制（扩容的核心成本）
    elementData = Arrays.copyOf(elementData, newCapacity);
}

// 处理超大容量的兜底方法
private static int hugeCapacity(int minCapacity) {
    if (minCapacity < 0) // 溢出
        throw new OutOfMemoryError();
    // 超过MAX_ARRAY_SIZE则用Integer.MAX_VALUE
    return (minCapacity > MAX_ARRAY_SIZE) ?
        Integer.MAX_VALUE :
        MAX_ARRAY_SIZE;
}
```

**核心要点**：

1. 扩容倍数：1.5 倍（`oldCapacity >> 1` 等价于 `oldCapacity / 2`，位运算效率更高）
2. 特殊场景：如果 1.5 倍扩容后仍不够（如 addAll 一次性添加大量元素），直接使用所需容量
3. 容量上限：默认最大为`Integer.MAX_VALUE - 8`，避免虚拟机内存分配问题

#### 步骤 5：数组复制（扩容的性能成本）

```java
// Arrays.copyOf底层源码
public static <T> T[] copyOf(T[] original, int newLength) {
    return (T[]) copyOf(original, newLength, original.getClass());
}

public static <T,U> T[] copyOf(U[] original, int newLength, Class<? extends T[]> newType) {
    T[] copy = ((Object)newType == (Object)Object[].class)
        ? (T[]) new Object[newLength]
        : (T[]) Array.newInstance(newType.getComponentType(), newLength);
    // 核心：native方法，高效复制数组
    System.arraycopy(original, 0, copy, 0,
                     Math.min(original.length, newLength));
    return copy;
}
```

**性能关键点**：

- 数组复制是扩容的核心成本，时间复杂度为 O (n)
- `System.arraycopy`是 native 方法，比手动循环复制效率高，但仍需尽量减少扩容次数

## 三、不同场景的扩容差异

### 场景 1：首次添加元素（空数组→容量 10）

**关键**：首次添加时，`calculateCapacity`会返回默认容量 10，直接扩容到 10。

### 场景 2：批量添加触发「按需扩容」

```java
// 示例：一次性添加20个元素，1.5倍扩容不足
ArrayList<String> list = new ArrayList<>(10);
// addAll一次性添加20个元素，所需容量30
list.addAll(Arrays.asList("元素1","元素2",..."元素20"));

// grow方法中：
// oldCapacity=10 → newCapacity=15（1.5倍）
// 15 < 30 → newCapacity=30（直接使用所需容量）
```

**关键**：当 1.5 倍扩容无法满足需求时，直接使用`minCapacity`作为新容量。

## 四、核心总结与性能优化

### 扩容机制核心要点

| 步骤                     | 核心操作   | 时间复杂度 |
| ---------------------- | ------ | ----- |
| add()                  | 触发扩容检查 | O(1)  |
| calculateCapacity      | 计算所需容量 | O(1)  |
| ensureExplicitCapacity | 判断是否扩容 | O(1)  |
| grow                   | 计算新容量  | O(1)  |
| Arrays.copyOf          | 数组复制   | O(n)  |

### 性能优化建议

1. **预估容量初始化**：如果知道元素数量，直接指定初始容量（如`new ArrayList<>(100)`），避免多次扩容
2. **批量添加优先用 addAll**：减少扩容次数（一次扩容 vs 多次扩容）
3. **避免频繁扩容**：扩容的核心成本是数组复制（O (n)），高频添加场景建议提前预留容量

### 面试高频考点

1. ArrayList 扩容倍数？→ 1.5 倍（`old + old/2`）
2. 首次扩容容量？→ 10（无参构造）
3. 扩容的性能成本？→ 数组复制 O (n)，尽量提前初始化容量
4. modCount 的作用？→ 记录修改次数，实现 fail-fast 机制

## 五、总结

ArrayList 的扩容机制是「动态数组」特性的核心体现，其设计思路可总结为：

1. 懒加载：无参构造时初始化为空数组，首次添加才扩容到 10
2. 渐进式扩容：1.5 倍扩容平衡「内存占用」和「扩容次数」
3. 性能兜底：特殊场景（批量添加）直接按需扩容，避免多次扩容

理解这一机制，不仅能应对面试，更能在实际开发中优化 ArrayList 的使用性能，避免因频繁扩容导致的性能损耗。