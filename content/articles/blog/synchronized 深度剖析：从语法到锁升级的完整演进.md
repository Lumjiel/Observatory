在 Java 并发编程领域，synchronized 无疑是最基础、最经典的同步机制。从 JDK 1.0 诞生时的“重量级锁”，到 JDK 6 引入的锁升级机制（偏向锁→轻量级锁→重量级锁），synchronized 历经多代优化，从“性能鸡肋”蜕变为“高效可靠”的线程安全保障工具。然而，很多开发者对它的理解仅停留在“加锁关键字”的表层，能熟练使用却不懂底层实现，能应对简单场景却无法优化高并发问题。

本文将从语法使用入手，逐步深入 JVM 底层实现，拆解锁升级的完整流程，对比其他锁机制的差异，梳理常见误区与优化技巧，既是面向新手的入门指南，也是面向开发者的进阶解析，助力大家真正吃透 synchronized，从容应对面试与实战。

# 一、synchronized 的语法使用：锁的三种形态，按需选择更高效

synchronized 的核心作用是实现“临界区互斥访问”，即同一时间只有一个线程能执行被保护的代码块，从而避免多线程并发修改共享资源导致的数据不一致问题。它有三种使用形式，分别对应不同的锁对象和应用场景，掌握其差异是正确使用的前提。

## 1.1 修饰实例方法：锁为当前对象实例

当 synchronized 修饰实例方法时，锁的对象是**调用该方法的对象实例**。这意味着，不同对象实例之间的锁相互独立，互不干扰；而同一个对象实例的所有 synchronized 修饰的实例方法，会共享同一把锁。

实战示例（含详细注释）：

```java
public class SynchronizedDemo {
    // 锁对象为当前SynchronizedDemo实例（this）
    public synchronized void instanceMethod() {
        // 临界区代码：操作实例级共享资源
        System.out.println("实例方法同步，当前线程：" + Thread.currentThread().getName());
        try {
            // 模拟业务执行耗时
            Thread.sleep(500);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    // 同一实例的另一个synchronized实例方法，共享同一把锁
    public synchronized void anotherInstanceMethod() {
        System.out.println("另一实例方法同步，当前线程：" + Thread.currentThread().getName());
    }

    public static void main(String[] args) {
        SynchronizedDemo demo1 = new SynchronizedDemo();
        SynchronizedDemo demo2 = new SynchronizedDemo();
        
        // 线程1调用demo1的instanceMethod
        new Thread(() -> demo1.instanceMethod(), "线程1").start();
        // 线程2调用demo1的anotherInstanceMethod（与线程1互斥，因为锁对象都是demo1）
        new Thread(() -> demo1.anotherInstanceMethod(), "线程2").start();
        // 线程3调用demo2的instanceMethod（与线程1、2不互斥，锁对象是demo2）
        new Thread(() -> demo2.instanceMethod(), "线程3").start();
    }
}
```
核心特点与适用场景：

- 锁粒度为“对象实例”，适合保护**实例级共享资源**（如实例变量、对象的状态）；
    
- 多线程操作同一个实例时，会竞争同一把锁，串行执行；操作不同实例时，无锁竞争，并行执行；
    
- 简洁易用，但锁粒度较粗，若实例中存在多个独立的共享资源，可能导致不必要的锁竞争。
    

## 1.2 修饰静态方法：锁为类的 Class 对象

当 synchronized 修饰静态方法时，锁的对象不再是具体的实例，而是当前类的 **Class 对象**（每个类在 JVM 中只有一个 Class 对象，全局唯一）。这意味着，无论创建多少个类的实例，所有线程调用该静态方法时，都会竞争同一把锁。

实战示例：

```java
public class SynchronizedStaticDemo {
    // 锁对象为SynchronizedStaticDemo.class（全局唯一）
    public static synchronized void staticMethod() {
        System.out.println("静态方法同步，当前线程：" + Thread.currentThread().getName());
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) {
        SynchronizedStaticDemo demo1 = new SynchronizedStaticDemo();
        SynchronizedStaticDemo demo2 = new SynchronizedStaticDemo();
        
        // 线程1调用demo1的静态方法
        new Thread(() -> demo1.staticMethod(), "线程1").start();
        // 线程2调用demo2的静态方法（与线程1互斥，锁对象都是Class对象）
        new Thread(() -> demo2.staticMethod(), "线程2").start();
        // 线程3直接调用静态方法（同样与线程1、2互斥）
        new Thread(() -> SynchronizedStaticDemo.staticMethod(), "线程3").start();
    }
}
```

一键获取完整项目代码（含测试用例）

核心特点与适用场景：

- 锁粒度为“类级别”，适合保护**全局共享资源**（如静态变量、工具类的静态方法）；
    
- 所有实例共享同一把锁，锁竞争强度高于实例方法锁；
    
- 注意：静态 synchronized 方法与实例 synchronized 方法，锁对象不同，互不干扰（即使是同一个实例，调用两种方法也不会互斥）。
    

## 1.3 修饰代码块：锁为指定对象，灵活控制锁粒度

synchronized 代码块是最灵活的使用形式，通过显式指定“锁对象”，可以精准控制同步的范围和锁粒度，避免修饰方法时的锁粒度过大问题，是实际开发中最推荐的使用方式。

锁对象可以是任意 Java 对象（推荐使用专门的锁对象，如 `Object lock = new Object()`，避免使用 this 或 Class 对象导致的锁竞争扩大）。

实战示例（优化版计数器，避免锁粒度浪费）：

```java
public class SynchronizedBlockDemo {
    // 显式定义锁对象，推荐使用final，避免锁对象被修改导致锁失效
    private final Object countLock = new Object();
    private int count = 0;

    // 独立的锁对象，保护另一个共享资源
    private final Object infoLock = new Object();
    private String info = "";

    // 同步代码块，仅保护count的修改
    public void increment() {
        // 只对临界区加锁，非临界区代码不参与同步
        synchronized (countLock) {
            count++;
            System.out.println("计数器更新：" + count);
        }
    }

    // 同步代码块，与increment共享同一把锁（countLock）
    public int getCount() {
        synchronized (countLock) {
            return count;
        }
    }

    // 使用另一把锁，保护info，与count的锁互不干扰
    public void setInfo(String newInfo) {
        synchronized (infoLock) {
            this.info = newInfo;
            System.out.println("信息更新：" + info);
        }
    }

    public static void main(String[] args) {
        SynchronizedBlockDemo demo = new SynchronizedBlockDemo();
        // 线程1操作count
        new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                demo.increment();
            }
        }, "线程1").start();
        // 线程2操作info（与线程1不互斥，锁对象不同）
        new Thread(() -> {
            for (int i = 0; i < 5; i++) {
                demo.setInfo("info-" + i);
            }
        }, "线程2").start();
    }
}
```

一键获取完整项目代码（含测试用例）

核心特点与适用场景：

- 锁粒度可自定义，能最大限度减少锁竞争（如用不同锁保护不同的共享资源，实现“细粒度锁”）；
    
- 可灵活控制同步范围，仅对“临界区代码”加锁，避免非临界区代码（如 IO 操作、耗时计算）占用锁资源；
    
- 锁对象必须是“不可变”的（推荐用 final 修饰），否则锁对象被修改后，会导致不同线程持有不同的锁，失去同步效果。
    

# 二、锁升级机制：从偏向锁到重量级锁的演进，读懂 JVM 的性能优化逻辑

JDK 6 之前，synchronized 的实现完全依赖操作系统的“互斥量（Mutex）”，每次加锁、解锁都需要在“用户态”和“内核态”之间切换——这种切换的开销巨大（一次切换约消耗 1000+ CPU 时钟周期），因此当时的 synchronized 被称为“重量级锁”，性能较差，甚至被开发者避而远之。

JDK 6 为了解决这个问题，引入了“锁升级”机制：JVM 会根据“锁的竞争强度”，自动将锁从“偏向锁”升级为“轻量级锁”，最终升级为“重量级锁”，实现“按需分配”性能开销，让 synchronized 在不同竞争场景下都能保持高效。

核心原则：**锁升级是不可逆的**（偏向锁→轻量级锁→重量级锁），一旦升级为重量级锁，就不会再降级为轻量级锁或偏向锁——这是因为锁升级的触发条件是“竞争加剧”，而竞争缓解后，降级的收益远小于实现成本。

## 2.1 偏向锁：无竞争场景的最优解，“偷懒”的高效策略

设计初衷：JVM 统计发现，在多数实际场景中，锁不仅不存在多线程竞争，还会由**同一线程多次获取**（比如单线程操作同步代码块、循环调用同步方法）。偏向锁的核心就是“偏向”第一个获取锁的线程，消除无竞争场景下的锁开销。

### 2.1.1 实现原理（结合对象头 Mark Word）

要理解偏向锁，首先要明确：Java 中每个对象都有一个“对象头”（Object Header），其中最关键的部分是“Mark Word”（标记字），它存储了对象的锁状态、哈希码、线程 ID 等信息。64 位 JVM 中，Mark Word 的默认结构如下（无锁状态）：

偏向锁的实现流程：

1. 加锁：线程第一次获取锁时，JVM 会将对象头 Mark Word 的“锁状态标记”设为 01（偏向锁），“偏向锁标志”设为 1，同时记录当前线程的 ID（3~12 位）和 epoch（偏向锁时间戳，13~17 位）；
    
2. 重入锁：后续该线程再次获取锁时，只需检查 Mark Word 中的线程 ID 是否为当前线程——如果是，直接获取锁，无需任何 CAS 操作（几乎零开销）；
    
3. 解锁：偏向锁**不会主动释放**，只有当其他线程尝试获取该锁时，持有偏向锁的线程才会释放锁（触发“偏向锁撤销”）。
    

64 位 JVM 中，偏向锁状态下 Mark Word 的结构：

|位信息|含义|
|---|---|
|0~1 位|锁状态标记（01 表示偏向锁）|
|2 位|偏向锁标志（1 表示处于偏向模式）|
|3~12 位|偏向线程 ID（持有偏向锁的线程 ID）|
|13~17 位|epoch（偏向锁时间戳，用于批量重偏向）|
|18~23 位|未使用|
|24~63 位|对象哈希码（无竞争时延迟计算，偏向锁释放时才生成）|

### 2.1.2 适用场景与优缺点

适用场景：

- 单线程重复获取锁的场景（如单线程操作集合、循环调用同步方法）；
    
- 几乎无竞争的环境（如线程私有的同步代码块、低并发场景）。
    

优势：除第一次获取锁时有轻微的 CAS 操作开销，后续获取锁几乎无需成本，性能接近无锁状态。

劣势：存在“偏向锁撤销”的开销——当其他线程尝试获取锁时，JVM 需要暂停持有偏向锁的线程，检查其状态（是否还在执行同步代码），若线程已退出同步代码，则撤销偏向锁，升级为轻量级锁；若线程仍在执行，则直接升级为重量级锁。

补充：JDK 6+ 默认开启偏向锁，可通过 JVM 参数控制：`-XX:+UseBiasedLocking`（开启，默认）、`-XX:-UseBiasedLocking`（关闭）；偏向锁默认有延迟（约 4 秒），可通过 `-XX:BiasedLockingStartupDelay=0` 取消延迟，适合单线程启动后立即使用同步的场景。

## 2.2 轻量级锁：轻度竞争的折中方案，用自旋换效率

当有其他线程尝试获取偏向锁时，偏向锁会被撤销，锁升级为“轻量级锁”。轻量级锁适用于“线程交替执行同步代码块”的场景（轻度竞争），核心是通过“自旋等待”避免进入重量级锁的内核态切换。

### 2.2.1 实现原理（结合栈帧锁记录）

轻量级锁的实现依赖“栈帧中的锁记录（Lock Record）”和 CAS 操作，流程如下：

#### 加锁流程：

1. 线程获取锁时，先在自己的栈帧中创建一个“锁记录（Lock Record）”，存储当前对象头 Mark Word 的副本（称为 Displaced Mark Word）；
    
2. 通过 CAS 操作，将对象头的 Mark Word 替换为“指向当前锁记录的指针”；
    
3. 若 CAS 操作成功，说明当前线程获取到轻量级锁，继续执行同步代码；
    
4. 若 CAS 操作失败，说明存在其他线程竞争锁（轻度竞争），当前线程会进入“自旋等待”（默认自旋 10 次），尝试再次执行 CAS 操作。
    

#### 解锁流程：

1. 线程执行完同步代码后，通过 CAS 操作，将对象头的 Mark Word 恢复为 Displaced Mark Word；
    
2. 若 CAS 操作成功，说明解锁完成，没有其他线程竞争锁；
    
3. 若 CAS 操作失败，说明锁已被其他线程竞争，当前锁已升级为重量级锁，此时需要唤醒等待队列中的线程。
    

64 位 JVM 中，轻量级锁状态下 Mark Word 的结构：

|位信息|含义|
|---|---|
|0~1 位|锁状态标记（00 表示轻量级锁）|
|2 位及以上|指向栈中锁记录（Lock Record）的指针|

### 2.2.2 适用场景与优缺点

适用场景：

- 线程交替执行同步代码块（如两个线程轮流获取锁，无同时争抢）；
    
- 竞争持续时间短（自旋等待能在短时间内获取到锁）。
    

优势：避免了重量级锁的内核态切换开销，通过自旋在用户态解决轻度竞争，性能远高于重量级锁。

劣势：自旋会消耗 CPU 资源——如果竞争激烈（自旋多次仍无法获取锁），会导致 CPU 使用率飙升，此时锁会升级为重量级锁，反而增加整体开销。

补充：轻量级锁的自旋次数可通过 JVM 参数控制：`-XX:PreBlockSpin=10`（默认 10 次）；JDK 1.7 后引入“自适应自旋”，JVM 会根据历史自旋成功率，动态调整自旋次数（如自旋成功次数多，则增加自旋次数；失败次数多，则减少或直接升级为重量级锁）。

## 2.3 重量级锁：重度竞争的最终方案，依赖操作系统保障安全

当轻量级锁的自旋失败（超过最大自旋次数，或已有多个线程自旋），说明锁的竞争进入“重度阶段”（多线程同时争抢锁），此时锁会升级为“重量级锁”。重量级锁依赖操作系统的“互斥量（Mutex）”实现，线程会进入内核态阻塞，彻底解决并发争抢问题。

### 2.3.1 实现原理（结合操作系统互斥量）

重量级锁的核心是“将线程阻塞到内核态”，由操作系统负责线程的调度和唤醒，流程如下：

1. 加锁：线程获取重量级锁时，若锁已被其他线程占用，当前线程会被阻塞，并放入操作系统维护的“等待队列”（阻塞队列），从用户态切换到内核态，不再消耗 CPU 资源；
    
2. 解锁：持有锁的线程执行完同步代码后，释放锁，并通过操作系统唤醒等待队列中的一个或多个线程，被唤醒的线程重新竞争锁（非公平锁，默认）。
    

64 位 JVM 中，重量级锁状态下 Mark Word 的结构：

|位信息|含义|
|---|---|
|0~1 位|锁状态标记（10 表示重量级锁）|
|2 位及以上|指向操作系统互斥量（Mutex）的指针|

### 2.3.2 适用场景与优缺点

适用场景：

- 多线程同时竞争锁（如高并发场景下的资源争抢）；
    
- 同步代码块执行时间长（自旋等待得不偿失，阻塞线程更节省 CPU 资源）。
    

优势：适合重度竞争场景，线程阻塞时不消耗 CPU 资源，能稳定保障线程安全。

劣势：线程阻塞和唤醒需要在用户态和内核态之间切换，开销巨大——一次切换的开销约为轻量级锁自旋的 10~100 倍，是三种锁中性能最差的。

## 2.4 锁升级的完整流程示例（实战验证）

通过一个示例，直观感受偏向锁→轻量级锁→重量级锁的完整升级过程，结合日志分析锁状态变化：

```java
public class LockUpgradeDemo {
    // 锁对象（初始为无锁状态）
    private static final Object lock = new Object();

    public static void main(String[] args) throws InterruptedException {
        // 阶段1：单线程获取锁，使用偏向锁
        Thread thread1 = new Thread(() -> {
            synchronized (lock) {
                System.out.println("线程1获取锁（当前锁状态：偏向锁）");
                try {
                    // 模拟业务执行，让线程1持有锁一段时间
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }, "线程1");
        thread1.start();
        thread1.join(); // 等待线程1执行完毕，释放锁

        // 阶段2：线程2尝试获取锁，偏向锁撤销，升级为轻量级锁
        Thread thread2 = new Thread(() -> {
            synchronized (lock) {
                System.out.println("线程2获取锁（当前锁状态：轻量级锁）");
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }, "线程2");
        thread2.start();

        // 阶段3：线程2未释放锁时，线程3尝试获取，轻量级锁升级为重量级锁
        Thread.sleep(50); // 确保线程2已获取锁
        Thread thread3 = new Thread(() -> {
            synchronized (lock) {
                System.out.println("线程3获取锁（当前锁状态：重量级锁）");
            }
        }, "线程3");
        thread3.start();
    }
}
```

一键获取完整项目代码（含锁状态监控工具）

流程解析（结合 JVM 监控工具验证）：

1. 线程1首次获取锁：lock 对象从“无锁状态”变为“偏向锁”，Mark Word 记录线程1的 ID；
    
2. 线程1释放锁：偏向锁未主动释放，Mark Word 仍记录线程1的 ID；
    
3. 线程2尝试获取锁：JVM 检测到有其他线程竞争，撤销偏向锁，lock 对象升级为“轻量级锁”，线程2通过 CAS 操作获取锁；
    
4. 线程3尝试获取锁：此时线程2仍持有轻量级锁，线程3自旋等待失败，轻量级锁升级为“重量级锁”，线程3进入内核态阻塞；
    
5. 线程2释放锁：操作系统唤醒线程3，线程3获取重量级锁，执行同步代码。
    

补充：可通过 JDK 自带的 `jvisualvm` 工具，监控锁状态变化（查看“线程”→“锁”标签页），直观观察锁升级的过程。

# 三、synchronized 与其他锁的对比：实战场景如何选择？

在 Java 并发包中，除了 synchronized，还有 ReentrantLock、ReadWriteLock 等锁机制，它们各有优势，了解其差异才能在实际开发中做出合理选择。以下重点对比 synchronized 与最常用的 ReentrantLock（可重入锁）：

|特性|synchronized|ReentrantLock|
|---|---|---|
|锁实现层面|JVM 层面（C++ 底层实现）|API 层面（Java 代码实现，基于 AQS 框架）|
|锁升级机制|支持（偏向锁→轻量级锁→重量级锁），自适应调整|不支持，始终是重量级锁（但可通过公平性设置优化）|
|可中断性|不可中断（获取锁时会一直阻塞，除非线程被中断）|可中断（通过 tryLock(long timeout, TimeUnit unit) 实现超时中断，或 lockInterruptibly() 实现可中断）|
|公平性|非公平锁（默认，无法设置为公平锁）|支持公平锁和非公平锁（通过构造函数参数控制：new ReentrantLock(true) 为公平锁）|
|条件变量|不支持（无法实现多条件等待）|支持（通过 Condition 接口实现多条件等待，可唤醒指定条件的线程）|
|性能表现|低竞争时接近 ReentrantLock，高竞争时略差（锁升级后仍有内核态切换开销）|高竞争时性能更稳定（基于 AQS 框架，避免不必要的内核态切换）|
|易用性|语法简洁，无需手动释放锁（JVM 自动释放），不易出错|语法复杂，需手动释放锁（必须在 finally 块中释放），否则会导致死锁|

## 最佳实践建议：

1. 简单同步场景（如单例模式、简单计数器、少量共享资源修改）：优先使用 synchronized——语法简洁，不易出错，JVM 自动优化，性能足够满足需求；
    
2. 复杂场景（如需要中断、超时等待、多条件唤醒、公平锁）：使用 ReentrantLock——灵活性更高，能应对更复杂的并发场景；
    
3. 高并发且竞争激烈的场景：先通过测试对比两者性能，通常 ReentrantLock 表现更优，但也可通过 synchronized 的锁优化技巧（如细粒度锁）提升性能；
    
4. 读写分离场景（读多写少）：使用 ReadWriteLock（ReentrantReadWriteLock），读操作共享锁，写操作独占锁，提升并发效率。
    

# 四、常见误区与性能优化：避开坑，提效率

很多开发者使用 synchronized 时，容易陷入一些误区，导致性能下降或线程安全问题。以下梳理最常见的 3 个误区，并给出对应的优化技巧。

## 4.1 误区一：过度使用 synchronized，扩大同步范围

很多开发者为了“图省事”或“保证安全”，盲目将 synchronized 修饰整个方法，导致同步范围过大，锁竞争加剧，性能下降。尤其是当方法中包含无需同步的耗时操作（如 IO 操作、网络请求）时，会严重浪费锁资源。

错误示例：

```java
// 错误：同步整个方法，包含无需同步的IO操作
public synchronized void processData() {
    // 1. 无需同步的IO操作（耗时较长，占用锁资源）
    String data = readFile("data.txt");
    // 2. 需要同步的共享变量修改（仅这一行需要同步）
    sharedCount++;
    // 3. 无需同步的耗时计算
    process(data);
}
```

优化方案：**缩小同步范围**，仅对“临界区代码”（修改共享资源的代码）加锁，非临界区代码放在锁外执行：

```java
public void processData() {
    // 无需同步的操作在锁外执行，不占用锁资源
    String data = readFile("data.txt");
    process(data);
    
    // 仅同步临界区代码，最小化锁持有时间
    synchronized (lock) {
        sharedCount++;
    }
}
```

## 4.2 误区二：认为 synchronized 会导致死锁

很多开发者误以为“使用 synchronized 就会导致死锁”，其实不然——synchronized 本身不会导致死锁，**多把锁的无序获取**才是死锁的根源。当多个线程持有不同的锁，且相互等待对方释放锁时，就会陷入死锁。

死锁示例（synchronized 多锁无序获取）：

```java
public class DeadLockDemo {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    // 线程1：先获取lockA，再获取lockB
    public static void thread1() {
        synchronized (lockA) {
            System.out.println("线程1持有lockA，尝试获取lockB");
            try { Thread.sleep(100); } catch (InterruptedException e) {}
            synchronized (lockB) {
                System.out.println("线程1获取lockB，执行完毕");
            }
        }
    }

    // 线程2：先获取lockB，再获取lockA
    public static void thread2() {
        synchronized (lockB) {
            System.out.println("线程2持有lockB，尝试获取lockA");
            try { Thread.sleep(100); } catch (InterruptedException e) {}
            synchronized (lockA) {
                System.out.println("线程2获取lockA，执行完毕");
            }
        }
    }

    public static void main(String[] args) {
        new Thread(DeadLockDemo::thread1, "线程1").start();
        new Thread(DeadLockDemo::thread2, "线程2").start();
    }
}
```

避免死锁的方案：

1. 所有线程按**固定顺序**获取锁（如先获取 lockA，再获取 lockB），打破“相互等待”的条件；
    
2. 使用 ReentrantLock 的 tryLock 方法设置超时时间，避免线程无限等待（如 tryLock(100, TimeUnit.MILLISECONDS)，超时则放弃获取锁）；
    
3. 减少锁的数量，避免同时持有多把锁（如通过拆分资源，减少锁的依赖）。
    

## 4.3 性能优化技巧：最大化发挥 synchronized 的性能

除了缩小同步范围，还有以下 3 个实用技巧，可进一步提升 synchronized 的性能：

### 技巧1：减少锁竞争，实现“细粒度锁”

将一个“大锁”拆分为多个“小锁”，让不同的共享资源使用不同的锁，减少线程间的锁竞争。最典型的例子是 ConcurrentHashMap（JDK 1.7）的“分段锁”——将 HashMap 分为多个段，每个段对应一把锁，不同段的操作互不干扰，提升并发效率。

示例（拆分锁优化）：

```java
// 优化前：一个锁保护多个共享资源，竞争激烈
public class BigLockDemo {
    private final Object lock = new Object();
    private int count1 = 0;
    private int count2 = 0;

    public void incrementCount1() {
        synchronized (lock) { count1++; }
    }

    public void incrementCount2() {
        synchronized (lock) { count2++; }
    }
}

// 优化后：拆分锁，每个共享资源对应一把锁，减少竞争
public class SmallLockDemo {
    private final Object lock1 = new Object();
    private final Object lock2 = new Object();
    private int count1 = 0;
    private int count2 = 0;

    public void incrementCount1() {
        synchronized (lock1) { count1++; }
    }

    public void incrementCount2() {
        synchronized (lock2) { count2++; }
    }
}
```

### 技巧2：合理利用偏向锁，优化单线程场景

在单线程场景下，确保偏向锁未被禁用（JDK 6+ 默认开启），避免频繁创建线程导致偏向锁频繁撤销。如果程序启动后立即需要使用同步，可通过 JVM 参数 `-XX:BiasedLockingStartupDelay=0` 取消偏向锁的延迟，减少首次获取锁的开销。

注意：如果程序中存在大量多线程竞争场景，可禁用偏向锁（`-XX:-UseBiasedLocking`），避免偏向锁撤销的开销。

### 技巧3：控制轻量级锁自旋次数，适配 CPU 场景

轻量级锁的自旋次数会影响性能：高 CPU 场景下，适当增加自旋次数（如 `-XX:PreBlockSpin=20`），让线程有更多机会获取锁，避免升级为重量级锁；低 CPU 场景下，减少自旋次数（如 `-XX:PreBlockSpin=5`），避免自旋浪费 CPU 资源。

JDK 1.7 后的“自适应自旋”已能自动适配场景，一般无需手动调整，但在高并发、高 CPU 场景下，可手动优化自旋次数。

# 五、总结：synchronized 的进化与未来

从 JDK 1.0 的重量级锁，到 JDK 6 的锁升级机制，synchronized 的进化史，就是 Java 并发性能优化的缩影。它的核心价值在于“简单可靠”——即使是新手，也能通过它快速写出线程安全的代码；而锁升级机制，则为它在高并发场景下的性能提供了保障，让它从“被嫌弃”的重量级锁，成为“性价比极高”的同步工具。

理解 synchronized 的关键，不仅在于掌握其三种语法形态，更在于吃透锁升级的底层逻辑：

- 偏向锁是“无竞争时的偷懒策略”，最大化减少无竞争开销，适配单线程场景；
    
- 轻量级锁是“轻度竞争时的折中方案”，用自旋换取内核态切换成本，适配线程交替执行场景；
    
- 重量级锁是“重度竞争时的无奈之举”，通过操作系统机制保证线程安全，适配多线程同时争抢场景。
    

在实际开发中，没有“最优”的锁，只有“最合适”的锁。根据业务场景的竞争强度，选择合适的同步机制，才能在“线程安全”和“性能”之间找到最佳平衡。

下一篇文章，我们将深入探讨 Lock 接口及其实现类（ReentrantLock、ReadWriteLock），对比其与 synchronized 的设计差异，揭示 Java 并发工具的更多可能性。关注专栏，获取更多 Java 并发实战干货！
