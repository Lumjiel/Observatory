在 Java 并发编程的世界里，有一个“隐形基石”——AbstractQueuedSynchronizer（简称 AQS）。它就像一个通用的“同步框架模板”，几乎支撑了 Java 并发包中所有核心同步工具的实现：从我们日常开发中常用的 ReentrantLock（可重入锁），到协调多线程等待的 CountDownLatch（倒计时器）、控制资源访问数量的 Semaphore（信号量），再到线程池 ThreadPoolExecutor 底层的同步控制，其核心逻辑都源自 AQS。

AQS 的神奇之处在于，它通过巧妙的“状态控制”和“队列管理”，将同步器的共性逻辑（如线程排队、唤醒）与个性逻辑（如是否允许线程获取锁）分离，让开发者只需重写少量方法，就能快速实现自定义同步器。本文将从设计定位、内部结构、核心流程、实际应用四个维度，深入拆解 AQS 的底层原理，结合代码示例和实战场景，帮你彻底吃透这个 Java 并发的“灵魂组件”，同时适配面试高频考点，让知识既懂又会用。

# 一、AQS 的设计定位：同步器的通用骨架

AQS 是一个抽象类，位于 java.util.concurrent.locks 包下，其核心设计目标是为各种同步器提供统一的基础框架。它封装了同步状态的管理、线程的排队等待、唤醒等核心操作，开发者无需关注这些复杂的底层细节，只需根据自身需求，重写少量钩子方法，就能实现符合业务场景的同步器。

## 1.1 核心设计思想：状态控制 + 队列管理

AQS 的设计精髓可以用一句话概括：**用一个volatile状态变量控制访问权限，用一个双向队列管理等待线程**，二者协同工作，实现高效的同步控制。

- **状态控制**：AQS 内部维护一个被 volatile 修饰的 int 变量 state，用于表示同步状态。这个状态的具体含义由子类自行定义，AQS 只提供统一的状态操作方法（getState()、setState()、compareAndSetState()），确保状态操作的线程安全性。
    
- **队列管理**：当线程尝试获取同步状态失败时，AQS 会将该线程封装成一个节点（Node），加入到一个双向链表结构的同步队列中，让线程进入等待状态；当同步状态被释放时，AQS 会从队列中唤醒一个或多个等待线程，让它们重新尝试获取同步状态。
    

这种设计的优势在于“解耦”——将“如何实现同步”的共性逻辑（排队、唤醒、状态原子操作）与“是否允许访问”的个性逻辑（如锁的重入、许可数量判断）分离，极大简化了同步器的实现难度。比如，ReentrantLock 关注“锁的重入”，CountDownLatch 关注“计数器是否为0”，它们只需重写判断逻辑，其余的排队、唤醒逻辑都直接复用 AQS 的模板方法。

## 1.2 核心方法与模板模式

AQS 采用**模板模式**定义了同步操作的完整骨架，模板方法负责调用钩子方法，实现统一的同步逻辑；钩子方法由子类重写，定义具体的同步规则。这种模式既能保证同步逻辑的一致性，又能满足不同同步器的个性化需求。

AQS 中需要子类重写的核心钩子方法（默认抛出 UnsupportedOperationException，必须按需重写）如下表所示：

|方法|功能描述|适用场景|
|---|---|---|
|protected boolean tryAcquire(int arg)|独占式获取同步状态，返回true表示获取成功|ReentrantLock（独占锁）|
|protected boolean tryRelease(int arg)|独占式释放同步状态，返回true表示释放成功（完全释放）|ReentrantLock|
|protected int tryAcquireShared(int arg)|共享式获取同步状态，返回值≥0表示成功（返回值为剩余可用资源数），<0表示失败|CountDownLatch、Semaphore|
|protected boolean tryReleaseShared(int arg)|共享式释放同步状态，返回true表示释放成功，且后续线程可继续获取|CountDownLatch、Semaphore|
|protected boolean isHeldExclusively()|判断当前线程是否独占同步状态|ReentrantLock（判断当前线程是否持有锁）|

AQS 提供的模板方法（如 acquire()、release()、acquireShared()、releaseShared()）会调用上述钩子方法，串联起完整的同步逻辑。例如：

- ReentrantLock 重写 tryAcquire() 和 tryRelease()，实现独占式锁的获取与释放；
    
- CountDownLatch 重写 tryAcquireShared() 和 tryReleaseShared()，实现共享式同步（多个线程等待计数器归0）；
    
- ReentrantReadWriteLock 则通过重写上述方法，结合 state 位运算，实现读写分离锁。
    

# 二、AQS 的内部结构：状态与队列的协作

AQS 的内部结构主要由两部分组成：**同步状态（state）** 和 **同步队列（CLH 队列）**。这两部分的协同工作，是 AQS 实现同步控制的核心，也是理解 AQS 原理的关键。

## 2.1 同步状态（state）的设计

state 是 AQS 中最核心的变量，被 volatile 修饰，用于存储同步状态，其具体含义由子类定义，不同的同步器对 state 的解读完全不同。

### 2.1.1 state 的常见含义（面试高频）

- **ReentrantLock**：state 表示锁的重入次数。0 表示锁未被持有，≥1 表示锁被持有（值为几表示重入几次）。例如，线程A获取锁后，state=1；再次重入锁，state=2；释放一次，state=1；完全释放，state=0。
    
- **Semaphore**：state 表示可用许可的数量。例如，Semaphore(5) 初始化时 state=5，一个线程获取许可，state=4；释放许可，state=5。
    
- **CountDownLatch**：state 表示计数器的初始值。例如，CountDownLatch(3) 初始化时 state=3，每次调用 countDown()，state 减1；当 state=0 时，所有等待线程被唤醒。
    

### 2.1.2 state 的线程安全性保证

由于 state 被 volatile 修饰，保证了线程间的可见性（一个线程修改 state 后，其他线程能立即看到最新值）；同时，AQS 通过 Unsafe 类的 CAS 操作，保证 state 操作的原子性。AQS 提供了三个核心方法操作 state：

```java
// AQS中state的定义与核心操作
private volatile int state;

// 获取当前同步状态
protected final int getState() {
    return state;
}

// 设置同步状态（无原子性保证，适用于已获取锁的线程，无需CAS）
protected final void setState(int newState) {
    state = newState;
}

// CAS原子性更新state：预期值为expect，更新为update，失败返回false
protected final boolean compareAndSetState(int expect, int update) {
    // 调用Unsafe的CAS操作，保证原子性
    return unsafe.compareAndSwapInt(this, stateOffset, expect, update);
}
```

这里需要注意：setState() 方法没有原子性保证，因为它仅在线程已获取同步状态（如已持有锁）的场景下使用，此时不存在并发修改问题；而 compareAndSetState() 是线程安全的，适用于多个线程竞争同步状态的场景（如锁的获取）。

## 2.2 同步队列（CLH 队列）的结构

当线程尝试获取同步状态失败时，AQS 会将该线程封装成一个 Node（节点），加入到同步队列中。这个同步队列是一个**双向链表**，基于 CLH（Craig, Landin, and Hagersten）锁队列改进而来，核心特点是 FIFO（先进先出）和自旋等待，能高效实现线程的排队与唤醒。

### 2.2.1 节点（Node）的核心结构

每个 Node 节点对应一个等待线程，内部包含多个核心字段，用于记录线程状态、前后节点等信息，源码如下（简化版，保留核心字段）：

```java
static final class Node {
    // 节点模式：独占模式（EXCLUSIVE）、共享模式（SHARED）
    static final Node EXCLUSIVE = null;
    static final Node SHARED = new Node();

    // 节点状态：5种状态，决定节点的行为（面试高频考点）
    volatile int waitStatus;
    // 状态常量：已取消（超时或被中断），不再参与竞争
    static final int CANCELLED = 1;
    // 状态常量：后继节点需要被唤醒，当前节点释放锁时需唤醒后继
    static final int SIGNAL = -1;
    // 状态常量：节点处于条件队列中，等待被唤醒
    static final int CONDITION = -2;
    // 状态常量：共享模式下，状态需向后传播（如CountDownLatch）
    static final int PROPAGATE = -3;

    // 前驱节点（双向链表）
    volatile Node prev;
    // 后继节点（双向链表）
    volatile Node next;
    // 当前节点关联的线程
    volatile Thread thread;
    // 条件队列中的后继节点（用于Condition机制）
    Node nextWaiter;
}
```

节点状态（waitStatus）是面试中的高频考点，需重点掌握每种状态的含义：

- **CANCELLED（1）**：节点已取消。当线程等待超时或被中断时，节点会被标记为 CANCELLED，不再参与同步竞争，后续会被垃圾回收。
    
- **SIGNAL（-1）**：后继节点需要被唤醒。当前节点释放同步状态后，必须唤醒其后继节点，让后继节点重新尝试获取状态。
    
- **CONDITION（-2）**：节点处于条件队列中。当线程调用 Condition.await() 时，会从同步队列转移到条件队列，节点状态设为 CONDITION，等待被 signal() 唤醒。
    
- **PROPAGATE（-3）**：共享模式下的状态传播。当一个节点获取共享状态成功后，需将状态传播给后续节点，让其他等待的共享线程也能获取状态（如 CountDownLatch 计数器归0后，所有等待线程都需被唤醒）。
    
- **0（初始状态）**：节点刚创建时的默认状态，无特殊含义。
    

### 2.2.2 队列的头节点与尾节点

AQS 通过两个 volatile 指针（head、tail）维护同步队列的头和尾，确保队列操作的线程安全性：

```java
// AQS中队列的头、尾指针（transient表示不序列化）
private transient volatile Node head;
private transient volatile Node tail;
```

队列的初始化与维护规则：

- 队列初始时为空，head 和 tail 均为 null；
    
- 当第一个线程获取同步状态失败时，会创建一个**哨兵节点**（不关联线程）作为头节点，同时将当前线程封装为节点作为尾节点，此时 head = tail = 哨兵节点；
    
- 后续线程获取状态失败时，会通过 CAS 操作将自己的节点加入队列尾部，保证入队的原子性；
    
- 头节点始终表示“当前持有同步状态的线程”（或已成功获取状态的线程），当头节点释放状态后，会唤醒其后继节点，后继节点获取状态成功后，会成为新的头节点（原头节点被垃圾回收）。
    

这里的哨兵节点设计很巧妙：它不关联具体线程，仅作为队列的“占位符”，避免了头节点为空的判断逻辑，简化了队列的操作流程。

# 三、独占式同步：获取与释放的完整流程

独占式同步是 AQS 最常用的模式，核心特点是**同一时间只有一个线程能获取同步状态**，其他线程需排队等待。典型应用是 ReentrantLock（独占锁）。AQS 通过 acquire(int arg)（获取状态）和 release(int arg)（释放状态）两个模板方法，实现独占式同步的完整流程。

## 3.1 独占式获取（acquire）流程

acquire(int arg) 方法的核心逻辑：**尝试获取状态 → 失败则入队 → 自旋等待 → 唤醒后重试**，直至获取状态成功或被中断。具体步骤拆解如下（结合源码分析，易懂好记）：

### 步骤1：尝试获取同步状态

调用子类重写的 tryAcquire(arg) 方法，尝试获取同步状态。如果返回 true，表示获取成功，直接返回，线程继续执行；如果返回 false，表示获取失败，进入下一步。

### 步骤2：获取失败，封装节点入队

将当前线程封装为 Node.EXCLUSIVE（独占模式）节点，通过 addWaiter(Node mode) 方法将节点加入队列尾部。addWaiter 方法会先尝试快速入队（如果尾节点不为 null，直接通过 CAS 设置新尾节点）；如果快速入队失败（如队列未初始化、CAS 竞争失败），则调用 enq(Node node) 方法，通过自旋确保节点成功入队。

```java
// 独占式获取状态的核心模板方法
public final void acquire(int arg) {
    // 1. 尝试获取状态；2. 失败则入队；3. 入队后自旋等待，若被中断则记录
    if (!tryAcquire(arg) && acquireQueued(addWaiter(Node.EXCLUSIVE), arg)) {
        selfInterrupt(); // 若线程在等待过程中被中断，恢复中断状态
    }
}

// 将线程封装为节点，加入队列尾部
private Node addWaiter(Node mode) {
    Node node = new Node(Thread.currentThread(), mode);
    Node pred = tail;
    // 快速入队：如果尾节点不为null，直接CAS设置新尾节点
    if (pred != null) {
        node.prev = pred;
        if (compareAndSetTail(pred, node)) {
            pred.next = node;
            return node;
        }
    }
    // 快速入队失败，自旋入队（确保入队成功）
    enq(node);
    return node;
}

// 自旋入队，初始化队列并确保节点入队
private Node enq(final Node node) {
    for (;;) { // 自旋（死循环），直到入队成功
        Node t = tail;
        if (t == null) { // 队列未初始化，创建哨兵节点作为头节点
            if (compareAndSetHead(new Node())) {
                tail = head;
            }
        } else { // 队列已初始化，CAS设置新尾节点
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```

### 步骤3：自旋等待，阻塞线程

节点入队后，调用 acquireQueued(Node node, int arg) 方法，让节点进入自旋状态，不断尝试获取同步状态，具体逻辑：

- 如果当前节点的前驱是头节点，说明当前节点是队列中的第一个等待线程，再次尝试调用 tryAcquire(arg) 获取状态；
    
- 如果获取成功，将当前节点设为新的头节点（原头节点被垃圾回收），返回 false（表示未被中断），自旋结束；
    
- 如果获取失败，判断前驱节点的状态：若前驱节点状态为 SIGNAL（表示会唤醒后继节点），则通过 LockSupport.park(this) 阻塞当前线程；若前驱节点状态为 CANCELLED，则移除该前驱节点，继续自旋；
    
- 线程被阻塞后，会等待被唤醒（前驱节点释放状态时会唤醒它）。
    

### 步骤4：唤醒后处理

线程被唤醒后，会继续重复步骤3的自旋逻辑，直至获取同步状态成功；如果线程在等待过程中被中断，会记录中断状态，待获取状态成功后，调用 selfInterrupt() 恢复中断状态（保证中断机制的正确性）。

## 3.2 独占式释放（release）流程

release(int arg) 方法的核心逻辑：**尝试释放状态 → 成功则唤醒后继节点**，具体步骤如下：

### 步骤1：尝试释放同步状态

调用子类重写的 tryRelease(arg) 方法，尝试释放同步状态。如果返回 true，表示释放成功（完全释放，如 ReentrantLock 的 state 减至 0）；如果返回 false，表示释放失败（如未完全释放重入锁），直接返回 false。

### 步骤2：唤醒后继节点

如果释放成功，获取当前头节点：若头节点不为 null 且状态不为 0（表示有等待线程），调用 unparkSuccessor(Node node) 方法，唤醒头节点的后继节点。

unparkSuccessor 方法的逻辑的是：先清除头节点的状态（将 SIGNAL 设为 0），然后查找头节点的后继节点；如果后继节点为 null 或已被取消（waitStatus > 0），则从队列尾部向前查找第一个有效节点（waitStatus ≤ 0），最后通过 LockSupport.unpark(s.thread) 唤醒该节点对应的线程。

```java
// 独占式释放状态的核心模板方法
public final boolean release(int arg) {
    if (tryRelease(arg)) { // 尝试释放状态，成功则唤醒后继节点
        Node h = head;
        if (h != null && h.waitStatus != 0) {
            unparkSuccessor(h); // 唤醒后继节点
        }
        return true;
    }
    return false;
}

// 唤醒当前节点的后继节点
private void unparkSuccessor(Node node) {
    int ws = node.waitStatus;
    if (ws < 0) { // 清除节点状态（SIGNAL → 0）
        compareAndSetWaitStatus(node, ws, 0);
    }
    // 查找后继节点
    Node s = node.next;
    if (s == null || s.waitStatus > 0) { // 后继节点为空或已取消
        s = null;
        // 从尾节点向前查找第一个有效节点（避免遗漏有效节点）
        for (Node t = tail; t != null && t != node; t = t.prev) {
            if (t.waitStatus <= 0) {
                s = t;
            }
        }
    }
    if (s != null) {
        LockSupport.unpark(s.thread); // 唤醒线程
    }
}
```

这里有一个关键细节：为什么要从尾节点向前查找有效节点？因为在多线程并发入队时，可能存在“节点的 next 指针还未更新”的情况（CAS 设置尾节点成功，但前驱节点的 next 指针未及时赋值），从尾部向前查找，能确保找到真正的后继有效节点，避免遗漏。

# 四、共享式同步：多线程共享资源的实现

共享式同步与独占式同步的核心区别在于：**允许多个线程同时获取同步状态**，只要资源充足，多个线程可以同时成功获取。典型应用有 CountDownLatch（倒计时器）、Semaphore（信号量）、CyclicBarrier（循环屏障）等。AQS 通过 acquireShared(int arg)（获取状态）和 releaseShared(int arg)（释放状态）两个模板方法，实现共享式同步。

## 4.1 共享式获取（acquireShared）流程

acquireShared(int arg) 方法的核心逻辑与独占式类似，但允许多个线程同时获取状态，具体步骤：

### 步骤1：尝试获取共享状态

调用子类重写的 tryAcquireShared(arg) 方法，尝试获取共享状态。返回值 ≥ 0 表示获取成功（返回值为剩余可用资源数）；返回值 < 0 表示获取失败，进入下一步。

### 步骤2：获取失败，封装节点入队

调用 doAcquireShared(arg) 方法，将当前线程封装为 Node.SHARED（共享模式）节点，通过 addWaiter(Node.SHARED) 方法加入队列尾部（入队逻辑与独占式一致）。

### 步骤3：自旋等待，阻塞线程

节点入队后，进入自旋状态，具体逻辑：

- 如果当前节点的前驱是头节点，再次尝试调用 tryAcquireShared(arg) 获取状态；
    
- 如果获取成功（返回值 ≥ 0），调用 setHeadAndPropagate(node, r) 方法，将当前节点设为新头节点，并传播状态（唤醒后续共享节点）；
    
- 如果获取失败，判断前驱节点的状态，若符合条件则阻塞当前线程，等待被唤醒；
    
- 线程被唤醒后，重复上述步骤，直至获取状态成功或被中断。
    

```java
// 共享式获取状态的核心模板方法
public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0) { // 获取失败，入队等待
        doAcquireShared(arg);
    }
}

// 共享式入队后自旋等待
private void doAcquireShared(int arg) {
    final Node node = addWaiter(Node.SHARED);
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            final Node p = node.predecessor(); // 获取前驱节点
            if (p == head) { // 前驱是头节点，再次尝试获取
                int r = tryAcquireShared(arg);
                if (r >= 0) {
                    // 设为头节点，并传播状态（唤醒后续共享节点）
                    setHeadAndPropagate(node, r);
                    p.next = null; // 帮助GC，断开与原头节点的关联
                    if (interrupted) {
                        selfInterrupt(); // 恢复中断状态
                    }
                    failed = false;
                    return;
                }
            }
            // 阻塞当前线程，直至被唤醒
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt()) {
                interrupted = true;
            }
        }
    } finally {
        if (failed) {
            cancelAcquire(node); // 获取失败，取消当前节点
        }
    }
}
```

### 关键：状态传播（setHeadAndPropagate）

共享模式与独占模式的核心区别之一就是“状态传播”。当一个共享节点获取状态成功后，不仅要将自己设为头节点，还要唤醒后续的共享节点，让其他等待的共享线程也能获取状态。例如，CountDownLatch 的计数器归 0 后，所有等待的线程都应被唤醒，这就是通过状态传播实现的。

setHeadAndPropagate 方法的逻辑：先将当前节点设为头节点，然后判断是否需要传播状态（如剩余资源充足、节点是共享模式），如果需要，调用 doReleaseShared() 方法唤醒后继节点，实现状态的链式传播。

## 4.2 共享式释放（releaseShared）流程

releaseShared(int arg) 方法的核心逻辑：**尝试释放状态 → 成功则唤醒后继节点，且支持状态传播**，具体步骤：

### 步骤1：尝试释放共享状态

调用子类重写的 tryReleaseShared(arg) 方法，尝试释放共享状态。返回 true 表示释放成功，且后续线程可继续获取；返回 false 表示释放失败，直接返回 false。

### 步骤2：唤醒后继节点，传播状态

如果释放成功，调用 doReleaseShared() 方法，唤醒队列中的后继节点，且支持状态传播（即唤醒一个节点后，该节点获取状态成功后，会继续唤醒下一个共享节点）。

```java
// 共享式释放状态的核心模板方法
public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) { // 释放成功，唤醒后继节点并传播状态
        doReleaseShared();
        return true;
    }
    return false;
}

// 共享式唤醒，支持状态传播
private void doReleaseShared() {
    for (;;) {
        Node h = head;
        if (h != null && h != tail) { // 队列不为空
            int ws = h.waitStatus;
            if (ws == Node.SIGNAL) { // 后继节点需要唤醒
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0)) {
                    continue; // CAS失败，重试
                }
                unparkSuccessor(h); // 唤醒后继节点
            } else if (ws == 0 &&
                       !compareAndSetWaitStatus(h, 0, Node.PROPAGATE)) {
                continue; // 设为PROPAGATE，确保状态传播
            }
        }
        if (h == head) { // 头节点未变化，退出循环（避免无限自旋）
            break;
        }
    }
}
```

doReleaseShared() 方法通过自旋确保唤醒操作成功：如果头节点状态为 SIGNAL，唤醒后继节点；如果头节点状态为 0，将其设为 PROPAGATE，确保后续节点获取状态后能继续传播状态。这种设计能保证共享模式下，所有等待的线程都能被唤醒，实现资源的高效共享。

# 五、条件队列：线程间协作的补充机制

AQS 除了同步队列，还提供了**条件队列（Condition）**机制，用于实现线程间的精准协作，类似于 synchronized 中的 wait()/notify()，但比其更灵活——一个同步器可以对应多个条件队列，不同的条件队列可以实现不同的等待/唤醒逻辑。

Condition 的实现依赖于 AQS 的 Node 结构，与同步队列形成互补：同步队列用于管理“获取同步状态失败”的线程，条件队列用于管理“等待特定条件”的线程。

## 5.1 条件队列的结构

每个 Condition 对象对应一个**单向链表**的条件队列，节点类型为 Node.CONDITION（节点状态为 CONDITION）。当线程调用 Condition.await() 时，会从同步队列转移到条件队列并阻塞；当调用 Condition.signal() 或 Condition.signalAll() 时，会将条件队列中的节点转移到同步队列，等待获取同步状态。

## 5.2 核心操作：await() 与 signal()

### 5.2.1 await() 方法（线程等待）

线程调用 Condition.await() 方法的流程：

1. 释放当前持有的同步状态（调用 release() 方法）；
    
2. 将当前线程封装为 Node.CONDITION 节点，加入到条件队列尾部；
    
3. 通过 LockSupport.park(this) 阻塞当前线程，等待被唤醒；
    
4. 线程被唤醒后，从条件队列转移到同步队列，重新尝试获取同步状态，成功后继续执行。
    

### 5.2.2 signal() 方法（唤醒线程）

线程调用 Condition.signal() 方法的流程：

1. 获取条件队列的头节点；
    
2. 将该头节点从条件队列中移除，转移到同步队列尾部；
    
3. 将节点状态从 CONDITION 改为 0，唤醒该节点对应的线程，让其重新尝试获取同步状态。
    

signalAll() 方法与 signal() 类似，区别在于：signal() 只唤醒条件队列的头节点，而 signalAll() 唤醒条件队列的所有节点，将它们全部转移到同步队列。

## 5.3 实战示例：Condition 的应用

以下示例通过 ReentrantLock 和 Condition，实现“线程A等待某个条件满足，线程B触发条件后唤醒线程A”的场景，直观理解条件队列与同步队列的交互：

```java
public class ConditionExample {
    // 基于AQS实现的ReentrantLock
    private final Lock lock = new ReentrantLock();
    // 基于AQS实现的Condition（条件队列）
    private final Condition condition = lock.newCondition();
    // 自定义条件：flag为true时，线程A可继续执行
    private boolean flag = false;

    // 线程A：等待flag为true
    public void waitForFlag() throws InterruptedException {
        lock.lock(); // 先获取同步状态（锁）
        try {
            // 循环判断条件（避免虚假唤醒，面试高频考点）
            while (!flag) {
                condition.await(); // 释放锁，加入条件队列并阻塞
            }
            System.out.println("Flag is true, continue working");
        } finally {
            lock.unlock(); // 确保释放锁
        }
    }

    // 线程B：设置flag为true，唤醒线程A
    public void setFlag() {
        lock.lock(); // 获取同步状态（锁）
        try {
            flag = true;
            condition.signal(); // 将条件队列的头节点转移到同步队列，唤醒线程A
        } finally {
            lock.unlock(); // 释放锁，唤醒同步队列中的线程A
        }
    }

    // 测试
    public static void main(String[] args) throws InterruptedException {
        ConditionExample example = new ConditionExample();
        // 线程A：等待flag
        new Thread(() -> {
            try {
                example.waitForFlag();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }, "Thread-A").start();

        // 线程B：延迟1秒，设置flag并唤醒线程A
        Thread.sleep(1000);
        new Thread(example::setFlag, "Thread-B").start();
    }
}
```

代码说明：

- 线程A调用 waitForFlag() 时，先获取锁（同步状态），发现 flag 为 false，调用 condition.await()，释放锁并加入条件队列，进入阻塞状态；
    
- 线程B调用 setFlag()，获取锁后将 flag 设为 true，调用 condition.signal()，将条件队列中的线程A节点转移到同步队列；
    
- 线程B释放锁后，唤醒同步队列中的线程A，线程A重新尝试获取锁，获取成功后，再次判断 flag 为 true，继续执行。
    

这里有一个面试高频考点：为什么要用 while (!flag) 判断条件，而不是 if？因为线程可能会被“虚假唤醒”（没有调用 signal()，线程也可能被唤醒），用 while 循环可以确保线程被唤醒后，再次检查条件，避免条件不满足时继续执行。

# 六、AQS 的应用：并发工具的底层依赖

理解 AQS 的核心价值，不仅在于掌握其底层原理，更在于能看透 Java 并发工具的实现逻辑。以下介绍几个常用并发工具如何基于 AQS 实现，帮你打通“底层原理”与“实战应用”的关联。

## 6.1 ReentrantLock 与 AQS（独占式应用）

ReentrantLock 是 AQS 最典型的应用，实现了独占式可重入锁，支持公平锁和非公平锁两种模式，其核心逻辑就是重写 AQS 的独占式钩子方法。

### 核心实现逻辑：

- **tryAcquire(int arg)**：通过 CAS 尝试获取锁，支持重入和公平性判断。
    
    - 非公平锁（默认）：直接尝试 CAS 将 state 从 0 改为 1，成功则获取锁；失败则检查当前线程是否是持有锁的线程（重入），若是则 state 加 1；否则入队。
        
    - 公平锁：获取锁前，先检查同步队列中是否有前驱节点（是否有线程排队），若无则尝试 CAS 获取锁；若有则入队，保证线程按 FIFO 顺序获取锁。
        
- **tryRelease(int arg)**：释放锁，将 state 减 1，当 state 减至 0 时，表示完全释放锁，返回 true，唤醒后继节点；否则返回 false（未完全释放）。
    
- **isHeldExclusively()**：判断当前线程是否是持有锁的线程，用于 Condition 机制的判断。
    

### 公平锁与非公平锁的性能差异（面试高频）：

- 非公平锁：吞吐量更高。因为省去了“检查队列”的步骤，线程可以直接尝试获取锁，减少了队列操作的开销，适合高并发场景；但可能导致线程饥饿（某些线程长期无法获取锁）。
    
- 公平锁：安全性更高。保证线程按排队顺序获取锁，避免饥饿；但频繁的队列检查和操作会增加开销，吞吐量低于非公平锁。
    

## 6.2 CountDownLatch 与 AQS（共享式应用）

CountDownLatch 用于实现“一个线程等待多个线程完成操作后再继续执行”，其核心是基于 AQS 的共享式同步，state 表示计数器的初始值。

### 核心实现逻辑：

- **初始化**：创建 CountDownLatch 时，传入计数器值 N，AQS 的 state 被设为 N。
    
- **tryAcquireShared(int arg)**：判断 state 是否为 0，若是则返回 0（获取成功），否则返回 -1（获取失败，进入队列等待）。
    
- **tryReleaseShared(int arg)**：通过 CAS 将 state 减 1，当 state 减至 0 时，返回 true，触发 doReleaseShared() 方法，唤醒所有等待的共享节点（所有等待线程被唤醒）；否则返回 false。
    

### 典型场景：

主线程等待 3 个子线程完成初始化，子线程全部执行 countDown() 后，主线程从 await() 返回，继续执行后续逻辑。

## 6.3 Semaphore 与 AQS（共享式应用）

Semaphore（信号量）用于控制同时访问某个资源的线程数量，其核心是基于 AQS 的共享式同步，state 表示可用许可的数量。

### 核心实现逻辑：

- **初始化**：创建 Semaphore 时，传入许可数量 N，AQS 的 state 被设为 N。
    
- **tryAcquireShared(int arg)**：尝试获取 arg 个许可，通过 CAS 减少 state 的值，若剩余许可 ≥ 0，则返回剩余许可（获取成功）；否则返回 -1（获取失败，入队等待）。
    
    - 非公平模式：直接尝试 CAS 减少 state；
        
    - 公平模式：先检查队列，无等待线程再尝试 CAS。
        
- **tryReleaseShared(int arg)**：通过 CAS 增加 state 的值（释放 arg 个许可），返回 true，唤醒后续等待线程。
    

### 典型场景：

Semaphore(5) 允许 5 个线程同时获取许可，访问某个资源；第 6 个线程获取许可时，会进入队列等待，直到有线程释放许可。

# 七、AQS 的设计智慧与局限

AQS 的设计堪称 Java 并发编程的典范，但其也存在一定的局限性。理解这些，能帮助我们更合理地使用 AQS 及其衍生的并发工具。

## 7.1 设计亮点（面试高频）

- **模板模式的极致应用**：将同步器的共性逻辑（排队、唤醒、状态原子操作）抽象为模板方法，个性逻辑（状态判断）通过钩子方法留给子类实现，极大降低了同步器的实现难度，实现了“代码复用”与“灵活扩展”的平衡。
    
- **高效的队列管理**：基于 CLH 队列改进的双向链表，结合 CAS 操作实现无锁入队，避免了线程阻塞带来的上下文切换开销；哨兵节点的设计简化了队列操作逻辑。
    
- **多模式支持**：同时支持独占式和共享式同步，满足不同的业务场景（如锁的独占访问、资源的共享访问）。
    
- **内存可见性与原子性保证**：state 被 volatile 修饰，保证线程间的可见性；通过 Unsafe 类的 CAS 操作，保证 state 操作的原子性，避免并发安全问题。
    

## 7.2 局限性

- **单一状态变量**：AQS 只维护一个 int 类型的 state 变量，对于复杂的同步器（如 ReentrantReadWriteLock），需要通过位运算拆分 state（如高 16 位表示读锁，低 16 位表示写锁），增加了实现复杂度。
    
- **线程唤醒的不确定性**：线程唤醒依赖 LockSupport.unpark()，但线程何时被操作系统调度执行，是不确定的，可能存在唤醒延迟，影响并发性能。
    
- **自定义难度高**：开发者需要深入理解 AQS 的底层逻辑（队列管理、状态传播、阻塞唤醒），才能正确重写钩子方法，否则易出现死锁、线程饥饿、并发安全等问题。
    

# 八、总结：AQS 在并发体系中的地位

AQS 是 Java 并发编程的“基础设施”，是连接底层同步机制与上层并发工具的桥梁。它的核心价值不在于自身能实现某种同步功能，而在于提供了一个通用的同步框架，让开发者无需重复实现复杂的排队、唤醒逻辑，只需专注于业务层面的同步规则。

理解 AQS，不仅能让我们看透 ReentrantLock、CountDownLatch、Semaphore 等常用并发工具的底层实现，更能帮助我们领会 Java 并发编程的核心思想——“用状态控制访问权限，用队列管理等待线程”。这种思想不仅适用于 Java，也适用于其他语言的并发编程，是解决复杂并发问题的通用思路。

对于开发者而言，掌握 AQS 不仅是面试加分项，更是提升并发编程能力的关键。只有深入理解底层原理，才能在实际开发中合理选择并发工具，规避并发风险，写出高效、安全的并发代码。

最后，留给大家一个思考问题：ReentrantReadWriteLock 是如何通过 AQS 的 state 位运算，实现读写锁分离的？欢迎在评论区留言讨论～