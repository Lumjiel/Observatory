## 一、核心定义与基础语法

### 1. 普通 for 循环（Index-based For Loop）

- **定义**：基于「索引 / 计数器」的循环，通过控制索引的起始、终止条件和步长，遍历容器或数组，支持灵活操作索引。
- **核心语法**（数组 / List 通用）：
    
    ```java
    // 数组遍历
    int[] arr = {1,2,3};
    for (int i = 0; i < arr.length; i++) {
        int val = arr[i]; // 通过索引访问元素
    }
    
    // List 遍历
    List<Integer> list = new ArrayList<>(List.of(1,2,3));
    for (int i = 0; i < list.size(); i++) {
        int val = list.get(i); // 通过索引访问元素
    }
    ```
    
- **变体**：倒序遍历（步长为 -1）
    
    ```java
    for (int i = list.size() - 1; i >= 0; i--) {
        System.out.println(list.get(i));
    }
    ```
    

### 2. 增强 for 循环（for-each Loop）

- **定义**：基于「迭代器（Iterator）」的简化遍历语法，无需关心索引，直接遍历容器 / 数组中的每个元素，仅支持 “正向遍历、只读 / 简单修改元素”。
- **核心语法**（数组 / 实现 Iterable 接口的容器通用）：
    
    ```java
    // 数组遍历
    int[] arr = {1,2,3};
    for (int val : arr) {
        System.out.println(val); // 直接获取元素，无需索引
    }
    
    // List 遍历（所有 Collection 子接口都支持，如 Set、Queue）
    List<Integer> list = new ArrayList<>(List.of(1,2,3));
    for (int val : list) {
        System.out.println(val);
    }
    
    // Queue 遍历（之前层级遍历的场景）
    Queue<TreeNode> queue = new LinkedList<>();
    for (TreeNode node : queue) {
        System.out.println(node.val);
    }
    ```
    

## 二、底层实现原理

### 1. 普通 for 循环：直接操作索引 / 容器方法

- **数组场景**：底层通过「数组索引 + 数组对象引用」访问元素（`arr[i]` 本质是 `*(arr + i)`，直接操作内存地址），时间复杂度 O (1)。
- **List 场景**：
    - 若为 `ArrayList`（动态数组）：`list.get(i)` 直接通过索引访问数组元素，O (1) 高效；
    - 若为 `LinkedList`（双向链表）：`list.get(i)` 需要从链表头 / 尾遍历到第 i 个节点，O (n) 低效。
- **核心逻辑**：依赖容器的「索引支持」或「长度获取方法」（`arr.length`/`list.size()`），循环过程中直接通过索引定位元素。

### 2. 增强 for 循环：迭代器（Iterator）的语法糖

增强 for 循环是 **迭代器（`java.util.Iterator`）的简化写法**，编译器会自动将其转换为迭代器遍历代码，核心依赖 `Iterable` 接口（所有支持 for-each 的容器都必须实现 `Iterable`）。

#### 底层转换过程（以 List 为例）

- 原始 for-each 代码：
    
    ```java
    for (Integer val : list) {
        System.out.println(val);
    }
    ```
    
- 编译器自动转换为迭代器代码：
    
    ```java
    Iterator<Integer> iterator = list.iterator();
    while (iterator.hasNext()) { // 判断是否有下一个元素
        Integer val = iterator.next(); // 获取下一个元素
        System.out.println(val);
    }
    ```
    

#### 特殊场景：数组的 for-each 底层

数组没有实现 `Iterable` 接口，但编译器会特殊处理，转换为「普通 for 循环 + 索引」：

```java
// 原始数组 for-each
for (int val : arr) {
    System.out.println(val);
}

// 编译器转换后
for (int i = 0; i < arr.length; i++) {
    int val = arr[i];
    System.out.println(val);
}
```

#### 关键机制：fail-fast（快速失败）

增强 for 循环依赖的迭代器（如 `ArrayList`、`LinkedList` 的迭代器）具有 `fail-fast` 特性：

- 迭代器创建时会记录容器的「修改计数器」；
- 每次调用 `iterator.next()` 时，会检查计数器是否与容器当前修改次数一致；
- 若不一致（遍历中通过容器自身方法增删元素，如 `list.add()`/`queue.poll()`），直接抛出 `ConcurrentModificationException`，避免遍历过程中容器结构破坏导致数据不一致。

## 三、核心区别对比（表格汇总）

|对比维度|普通 for 循环|增强 for 循环（for-each）|
|---|---|---|
|底层实现|数组：索引访问内存；List：`get(i)` 方法|容器：Iterator 迭代器；数组：自动转普通 for 循环|
|依赖条件|需支持「索引访问」和「长度获取」（`length`/`size()`）|容器：实现 `Iterable` 接口；数组：无依赖（编译器特殊处理）|
|索引操作|支持（可获取、修改索引，如倒序、跳步遍历）|不支持（完全隐藏索引，无法直接操作）|
|元素操作|支持「访问、修改、删除」（可通过索引操作元素）|支持「访问、修改元素内容」；不支持「删除元素」（除非用迭代器 `remove()`）|
|遍历灵活性|极高（可正向、倒序、跳步，如 `i += 2`）|极低（仅支持正向顺序遍历，步长固定为 1）|
|容器类型适配|数组、List（`ArrayList` 高效，`LinkedList` 低效）|数组、所有 Collection 子接口（List、Set、Queue 等）|
|异常风险|无 `ConcurrentModificationException` 风险|遍历中通过容器方法增删元素，抛 `ConcurrentModificationException`|
|代码简洁度|较繁琐（需声明索引、条件、步长）|极简洁（仅需声明元素变量）|
|性能表现|- `ArrayList`/ 数组：O (n)（高效）；<br><br>- `LinkedList`：O (n²)（低效）|- 容器（含 `LinkedList`）：O (n)（迭代器遍历高效）；<br><br>- 数组：同普通 for 循环|

### 关键差异补充说明

1. **LinkedList 遍历性能差异**：
    - 普通 for 循环：`list.get(i)` 每次都要从链表头遍历到第 i 个节点，n 个元素需遍历 n (n+1)/2 次，O (n²) 低效；
    - 增强 for 循环：迭代器通过链表的 `next` 指针遍历，每个节点仅访问一次，O (n) 高效。
2. **删除元素的差异**：
    - 普通 for 循环：可通过索引删除（如 `list.remove(i)`），但需注意「索引移位」（倒序删除可避免）；
    - 增强 for 循环：禁止用 `list.remove(val)`（抛异常），仅能通过迭代器 `iterator.remove()` 删除当前元素（需显式获取迭代器，而非 for-each 语法）。
3. **跳步遍历的差异**：
    - 普通 for 循环：支持跳步（如 `i += 2` 遍历偶数索引元素）；
    - 增强 for 循环：不支持跳步，只能逐个遍历所有元素。

## 四、适用场景与不适用场景

### 1. 普通 for 循环适用场景

- 需操作索引的场景（如获取元素位置、倒序遍历、跳步遍历）；
- 需在遍历中修改 / 删除元素，且需要控制索引的场景（如数组去重、List 倒序删除）；
- `ArrayList`/ 数组的高效遍历（索引访问 O (1)）；
- 层级遍历中「固定层级大小」的场景（如之前的二叉树 BFS，`for (int i=0; i<levelSize; i++)`）。

#### 典型示例：List 倒序删除指定元素（避免索引移位）

```java
List<Integer> list = new ArrayList<>(List.of(1,2,3,2,4));
// 倒序删除值为 2 的元素（不会因删除导致后续元素索引移位）
for (int i = list.size() - 1; i >= 0; i--) {
    if (list.get(i) == 2) {
        list.remove(i);
    }
}
System.out.println(list); // 输出：[1,3,4]
```

### 2. 增强 for 循环适用场景

- 仅需「正向遍历、读取元素」的场景（如打印容器内容、元素校验）；
- 遍历 `LinkedList`、Set、Queue 等不支持高效索引访问的容器（迭代器遍历更高效）；
- 代码简洁性优先，无需关心索引的场景。

#### 典型示例：遍历 Queue 读取元素（不修改队列结构）

```java
Queue<TreeNode> queue = new LinkedList<>();
// 仅读取当前层节点，不修改队列（安全，无异常）
for (TreeNode node : queue) {
    System.out.println(node.val);
}
```

### 3. 增强 for 循环不适用场景

- 遍历中需要修改容器结构（增删元素）的场景（如层级遍历中 `queue.poll()`）；
- 需获取元素索引的场景（如统计元素位置）；
- 需跳步、倒序遍历的场景。

## 五、常见问题与避坑指南

### 1. 增强 for 循环遍历中修改容器结构抛异常

- **问题**：如之前的层级遍历代码，在 for-each 中调用 `queue.poll()`，抛 `ConcurrentModificationException`；
- **原因**：迭代器的 `fail-fast` 机制检测到容器被修改（`poll()` 是队列自身方法，未通过迭代器）；
- **解决方案**：改用普通 for 循环（固定层级大小）或显式迭代器（需删除元素时）。

### 2. LinkedList 用普通 for 循环遍历低效

- **问题**：`LinkedList` 用 `for (int i=0; i<size; i++)` 遍历，`get(i)` 每次都要从头遍历，性能极差；
- **解决方案**：改用增强 for 循环（迭代器遍历，O (n) 高效）或显式迭代器。

### 3. 普通 for 循环删除元素导致索引移位

- **问题**：正向遍历 List 并删除元素，后续元素索引前移，导致漏删；
- **示例**：
    
    ```java
    List<Integer> list = new ArrayList<>(List.of(1,2,2,3));
    // 错误：正向删除，i=1 删了第一个 2，后续元素移位，i=2 跳过第二个 2
    for (int i = 0; i < list.size(); i++) {
        if (list.get(i) == 2) {
            list.remove(i);
        }
    }
    System.out.println(list); // 输出：[1,2,3]（漏删第二个 2）
    ```
    
- **解决方案**：倒序遍历删除（如之前的示例）或删除后 `i--` 回退索引。

### 4. 增强 for 循环遍历数组与容器的差异

- **数组**：底层转普通 for 循环，无 `fail-fast` 机制，遍历中修改数组元素（如 `val = 10`）不会影响原数组（值传递）；
- **容器**：底层是迭代器，遍历中修改元素内容（如 `node.val = 10`）会影响原容器（引用传递），但修改容器结构（增删）会抛异常。

## 六、总结

1. **核心选择逻辑**：
    - 需索引、灵活遍历（倒序 / 跳步）、修改容器结构 → 普通 for 循环；
    - 仅正向读取元素、代码简洁优先、遍历非 ArrayList 容器（如 LinkedList、Queue） → 增强 for 循环。
2. **性能优先原则**：
    - `ArrayList`/ 数组：普通 for 循环与增强 for 循环性能一致，按需选择；
    - `LinkedList`/Set/Queue：优先用增强 for 循环（迭代器高效）；
3. **避坑关键**：
    - 增强 for 循环中禁止用容器自身方法增删元素；
    - `LinkedList` 避免用普通 for 循环遍历；
    - 普通 for 循环删除元素需处理索引移位问题。

