## 一、JDK1.8 底层数据结构：彻底抛弃分段锁

JDK1.7 的 `ConcurrentHashMap` 采用 **Segment 分段锁**，锁粒度较大；而 JDK1.8 直接摒弃该设计，采用与 HashMap1.8 同源的 **数组 + 链表 + 红黑树** 结构，并发控制升级为 **CAS + synchronized 桶级锁**。

### 1.1 核心结构组成

```
ConcurrentHashMap
    ├── Node[] table (volatile)  // 哈希桶数组（主线存储）
    │    ├── Node (普通链表节点)
    │    ├── TreeBin (红黑树包装节点)
    │    └── ForwardingNode (扩容标记节点)
    ├── Node[] nextTable         // 扩容时的新数组
    ├── LongAdder baseCount      // 基础元素计数
    └── CounterCell[] counterCells // 并发计数单元格（减少竞争）
```

### 1.2 三大关键节点类型

1. **Node**
    
    基础链表节点，存储 `key/val/hash/next`，`val` 和 `next` 都用 `volatile` 修饰，保证并发可见性。
    
2. **TreeBin**
    
    红黑树的**包装节点**，不直接存数据，只维护红黑树的根与平衡，链表长度≥8 且数组≥64 时触发转换。
    
3. **ForwardingNode**
    
    扩容专用标记节点，`hash = MOVED(-1)`，占位在旧数组桶中，引导其他线程**协助扩容**，而非阻塞等待。
    

### 1.3 并发控制三剑客

- **CAS**：无锁操作，用于空桶插入、数组初始化等无冲突场景。
- **synchronized**：仅锁定**当前桶头节点**，锁粒度极小，JDK1.8 后优化效果极佳。
- **volatile**：修饰数组与节点指针，保证多线程间的**可见性**，禁止指令重排。

---

## 二、put () 方法：并发插入全流程

`put()` 是 `ConcurrentHashMap` 最复杂的方法，所有并发精髓都在这里，底层由 ==`putVal()`== 实现。

### 2.1 完整执行流程

1. **参数校验**：`key/value` 不允许为 null，直接抛空指针。
2. **哈希计算**：通过扰动函数 `spread()` 计算 hash，减少冲突。
3. **数组初始化**：`table` 为空时，调用 `initTable()`，CAS 竞争初始化权。
4. **桶定位**：`(n-1) & hash` 计算数组下标。
5. **三大分支处理**
    
    - 桶为空：CAS 直接插入，无锁。
    - 桶为 `ForwardingNode`：当前正在扩容，线程**协助扩容**。
    - 桶有数据：`synchronized` 锁定桶头节点，链表 / 红黑树插入。
    
6. **树化判断**：链表长度≥8 尝试转红黑树。
7. **计数 + 扩容检查**：`addCount()` 更新元素数量，达到阈值触发扩容。

### 2.2 核心源码解析

```java
public V put(K key, V value) {
    return putVal(key, value, false);
}

final V putVal(K key, V value, boolean onlyIfAbsent) {
    // 不允许 key/value 为 null
    if (key == null || value == null) throw new NullPointerException();
    int hash = spread(key.hashCode());
    int binCount = 0;
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        // 1. 数组初始化
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();
        // 2. 桶为空，CAS 无锁插入
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            if (casTabAt(tab, i, null,new Node<K,V>(hash, key, value, null)))
                break;
        }
        // 3. 桶正在扩容，协助迁移数据
        else if ((fh = f.hash) == MOVED)
            tab = helpTransfer(tab, f);
        // 4. 哈希冲突，加锁插入
        else {
            V oldVal = null;
            synchronized (f) { // 仅锁当前桶头节点
                if (tabAt(tab, i) == f) { // 双重检查，防止头节点变化
                    // 链表插入
                    if (fh >= 0) {
                        binCount = 1;
                        for (Node<K,V> e = f;; ++binCount) {
                            K ek;
                            if (e.hash == hash && ((ek = e.key) == key || key.equals(ek))) {
                                oldVal = e.val;
                                if (!onlyIfAbsent) e.val = value;
                                break;
                            }
                            Node<K,V> pred = e;
                            if ((e = e.next) == null) {
                                pred.next = new Node<K,V>(hash, key, value, null);
                                break;
                            }
                        }
                    }
                    // 红黑树插入
                    else if (f instanceof TreeBin) {
                        Node<K,V> p;
                        binCount = 2;
                        if ((p = ((TreeBin<K,V>)f).putTreeVal(hash, key, value)) != null) {
                            oldVal = p.val;
                            if (!onlyIfAbsent) p.val = value;
                        }
                    }
                }
            }
            // 链表转红黑树
            if (binCount != 0) {
                if (binCount >= TREEIFY_THRESHOLD)
                    treeifyBin(tab, i);
                if (oldVal != null) return oldVal;
                break;
            }
        }
    }
    // 更新计数，判断是否扩容
    addCount(1L, binCount);
    return null;
}
```

---

## 三、get () 方法：全程无锁，高性能读取

`ConcurrentHashMap` 的 **get 操作完全无锁**，是高并发读场景的关键优化。

### 3.1 执行流程

1. 计算 hash，定位桶下标。
2. 匹配头节点，直接返回。
3. 节点为 `ForwardingNode`（扩容中）：去新数组 `nextTable` 查询。
4. 节点为 `TreeBin`：红黑树查找。
5. 普通链表：遍历查找。
6. 无结果返回 null。

### 3.2 源码解析

```java
public V get(Object key) {
    Node<K,V>[] tab; Node<K,V> e, p; int n, eh; K ek;
    int h = spread(key.hashCode());
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (e = tabAt(tab, (n - 1) & h)) != null) {
        // 头节点匹配
        if ((eh = e.hash) == h) {
            if ((ek = e.key) == key || (ek != null && key.equals(ek)))
                return e.val;
        }
        // 扩容/红黑树：调用 find 方法
        else if (eh < 0)
            return (p = e.find(h, key)) != null ? p.val : null;
        // 链表遍历
        while ((e = e.next) != null) {
            if (e.hash == h && ((ek = e.key) == key || key.equals(ek)))
                return e.val;
        }
    }
    return null;
}
```

> 无锁原理：依靠 `volatile` 保证数组和节点的可见性，读取到的永远是最新数据。

---

## 四、size () 方法：并发计数机制

JDK1.8 不再维护全局单一计数，而是采用 **LongAdder 思想**，避免高并发计数竞争。

### 4.1 计数结构

- `baseCount`：基础计数值。
- `CounterCell[]`：并发单元格，竞争激烈时，线程分散累加不同单元格。
- 总数量 = `baseCount + 所有 CounterCell 之和`。

### 4.2 核心特点

- `size()` 返回的是**估算值**，非强一致（并发修改可能存在误差）。
- 无需加锁统计，性能远高于加锁求和。
- 超过 `Integer.MAX_VALUE` 时返回最大值。

---

## 五、JDK1.8 核心优化亮点

1. **锁粒度极致细化**
    
    从 JDK1.7 ==分段锁（锁一段）==→ JDK1.8 ==**桶头节点锁**==，仅锁冲突数据。
    
2. **CAS 无锁优化**
    
    空桶插入、数组初始化全程无锁，低并发下性能接近 HashMap。
    
3. **红黑树提升查询**
    
    链表过长时转为红黑树，查询复杂度从 O (n) → O (log n)。
    
4. **多线程协同扩容**
    
    扩容时其他线程不阻塞，直接 `helpTransfer()` 协助迁移，大幅提速。
    
5. **纯无锁读**
    
    get 全程不加锁，读多写少场景并发能力拉满。
    

---

## 六、总结

JDK1.8 `ConcurrentHashMap` 是 Java 并发设计的巅峰之作：

- 结构：**数组 + 链表 + 红黑树**
- 并发：**CAS + 桶级 synchronized + volatile**
- 插入：空桶无锁、冲突加锁、扩容协助
- 读取：全程无锁，高性能
- 计数：分散单元格，减少竞争