在 Java 并发编程中，volatile 是一个看似简单却极易被误用的关键字。它常被用来修饰共享变量，以应对多线程环境下的数据可见性问题，但很多开发者仅停留在 “知道它能保证可见性” 的层面，对其底层原理（内存屏障）、适用场景和使用禁忌一知半解，甚至在项目中滥用 volatile 导致线程安全隐患。

本文将从硬件底层的 CPU 缓存机制讲起，层层递进解析 volatile 的核心特性（可见性、禁止指令重排），拆解其底层实现原理，结合可直接运行的实战案例说明其正确用法，同时梳理高频使用误区和面试考点，帮助开发者真正吃透 volatile，避免踩坑。

## 一、从 CPU 缓存谈起：为什么需要 volatile？

要理解 volatile 的作用，首先要搞懂：多线程环境下的“数据可见性问题”到底从何而来？这个问题的根源，并非 Java 语言本身，而是现代计算机的硬件架构设计。

### 1.1 CPU 缓存与内存不一致问题

现代计算机的 CPU 运算速度已经达到了纳秒级，而主内存（RAM）的访问速度仅为毫秒级，两者之间存在着几个数量级的差距。为了缓解这种速度不匹配的问题，硬件设计师在 CPU 与主内存之间引入了**多级缓存（L1、L2、L3）**，形成了“CPU → 缓存 → 主内存”的三层架构。

缓存的工作机制如下：

- 读取数据时：CPU 会先从 L1 缓存查找，若未命中（缓存中没有目标数据），则依次查找 L2、L3 缓存，若都未命中，才会从主内存加载数据，并将数据存入各级缓存，方便后续快速访问；
    
- 写入数据时：CPU 不会直接写入主内存，而是先更新缓存中的数据，再由缓存通过“缓存一致性协议”（如 MESI 协议）异步刷新到主内存。
    

这种机制在单线程环境下完全没有问题，因为只有一个线程操作数据，缓存与主内存的同步延迟不会影响程序正确性。但在多线程场景中，问题就会出现：

假设两个线程运行在不同的 CPU 核心上，它们都需要操作同一份共享变量（比如一个标记位 flag），此时每个 CPU 核心都会在自己的缓存中保存一份 flag 的副本。当线程 1 修改了 flag 的值，它的 CPU 缓存会立即更新，但这个新值可能不会立即刷新到主内存；而线程 2 此时读取 flag，会从自己的缓存中读取旧值，导致线程 2 无法感知线程 1 的修改，最终出现数据不一致。

举个直观的示例（无 volatile 修饰，会出现死循环）：

```java
public class VolatileVisibilityDemo {
    // 未使用volatile修饰共享变量flag
    private static boolean flag = false;

    public static void main(String[] args) throws InterruptedException {
        // 线程1：修改flag的值为true
        new Thread(() -> {
            try {
                Thread.sleep(100); // 模拟业务操作，让线程2先进入循环
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            flag = true;
            System.out.println("线程1已将flag修改为：" + flag);
        }).start();

        // 线程2：循环等待flag变为true
        new Thread(() -> {
            while (!flag) {
                // 循环等待，若flag无volatile修饰，可能永远无法退出
            }
            System.out.println("线程2感知到flag变为：" + flag);
        }).start();
    }
}
```

运行结果：线程1会打印“线程1已将flag修改为：true”，但线程2会一直陷入循环，无法感知flag的变化。原因就是：线程1修改flag后，缓存中的新值未及时刷新到主内存，线程2的缓存中始终是flag的旧值false。

而 volatile 的出现，就是为了解决这种多线程环境下的“缓存一致性”问题，保证共享变量的可见性。

### 1.2 Java 内存模型（JMM）的抽象

为了屏蔽不同硬件架构（如 x86、ARM）的缓存差异，让 Java 程序在不同平台上都能保证并发正确性，Java 虚拟机（JVM）定义了一套抽象规范——**Java 内存模型（JMM）**。

JMM 的核心约定如下：

- 所有共享变量（成员变量、静态变量）都存储在**主内存**中，主内存是所有线程共享的公共区域；
    
- 每个线程都有自己的**工作内存**（类似 CPU 缓存的抽象），工作内存中会保存主内存中共享变量的副本；
    
- 线程对变量的所有操作（读取、赋值、修改），都必须在自己的工作内存中进行，不能直接操作主内存；
    
- 线程要修改共享变量时，需先修改工作内存中的副本，再将副本同步回主内存；线程要读取共享变量时，需先从主内存加载最新值到工作内存，再从工作内存读取。
    

JMM 通过定义 8 种内存间交互操作（lock、unlock、read、load、use、assign、store、write），规范了共享变量的读写流程，确保线程间的数据交互有序。而 volatile 关键字的作用，就是通过特殊的内存语义，约束这些操作的执行顺序，强制工作内存与主内存同步，从而解决可见性问题。

## 二、volatile 的核心特性一：保证可见性

volatile 最核心、最基础的功能，就是**保证共享变量的可见性**。其具体语义为：当一个线程修改了被 volatile 修饰的共享变量，新值会立即刷新到主内存；而其他线程在读取该变量时，会直接从主内存加载最新值，而非从自己的工作内存（缓存）中读取旧值。

### 2.1 可见性的实现原理：内存屏障

volatile 的可见性，并非 JVM 层面的“魔法”，而是通过**内存屏障（Memory Barrier）**实现的。内存屏障是一种 CPU 指令，它的核心作用有两个：

- 阻止 CPU 对指令进行重排序；
    
- 强制将缓存中的数据同步到主内存（写入操作），或从主内存加载最新数据到缓存（读取操作）。
    

JVM 会为 volatile 变量的读写操作插入特定的内存屏障，具体规则如下：

#### （1）写入 volatile 变量时

当线程写入一个 volatile 变量时，JVM 会在写入指令后插入两个内存屏障：

- **StoreStore 屏障**：禁止在当前 volatile 写入操作之前，所有普通变量的写入操作被重排到当前写入操作之后。简单说，就是确保所有之前的普通变量修改，都已刷新到主内存，再执行当前 volatile 变量的写入。
    
- **StoreLoad 屏障**：禁止在当前 volatile 写入操作之后，所有读取操作被重排到当前写入操作之前。同时，它会强制将当前 volatile 变量的新值刷新到主内存，确保其他线程能立即读取到最新值。
    

#### （2）读取 volatile 变量时

当线程读取一个 volatile 变量时，JVM 会在读取指令前插入两个内存屏障：

- **LoadLoad 屏障**：禁止在当前 volatile 读取操作之前，所有普通变量的读取操作被重排到当前读取操作之后。确保先读取 volatile 变量的最新值，再读取其他普通变量。
    
- **LoadStore 屏障**：禁止在当前 volatile 读取操作之后，所有写入操作被重排到当前读取操作之前。确保 volatile 变量的读取完成后，再执行后续的写入操作。
    

补充说明：不同 CPU 架构对内存屏障的支持不同（如 x86 架构只支持 StoreLoad 屏障），JVM 会根据底层 CPU 架构，自动优化插入的内存屏障，确保语义一致的同时，尽可能减少性能损耗。

### 2.2 可见性的局限性：不保证原子性

这是 volatile 最容易被误用的点——**volatile 只保证可见性和禁止重排，不保证操作的原子性**。对于单个原子操作（如直接赋值：flag = true），volatile 可以保证线程安全；但对于复合操作（如 i++、i += 1），即使变量被 volatile 修饰，依然会出现线程安全问题。

为什么？因为复合操作并非原子操作，它包含多个步骤。以 i++ 为例，它本质上分为 3 个步骤：

1. 读取 i 的当前值（从主内存加载到工作内存）；
    
2. 将读取到的值加 1（工作内存中修改）；
    
3. 将加 1 后的值写回主内存（刷新到主内存）。
    

在多线程环境下，线程切换可能发生在这三个步骤之间。比如，线程 A 和线程 B 同时读取到 i = 0，线程 A 加 1 后（i=1）还未写回主内存，线程 B 已经完成了加 1 操作（i=1），最终两个线程都将 1 写回主内存，导致 i 的最终值为 1，而非预期的 2。

反例代码（volatile 无法保证原子性）：

```java
public class VolatileAtomicDemo {
    // 用volatile修饰count
    private volatile int count = 0;

    // 多线程同时调用该方法，执行count++
    public void increment() {
        count++; // 复合操作，非原子性，仍会出现线程安全问题
    }

    public static void main(String[] args) throws InterruptedException {
        VolatileAtomicDemo demo = new VolatileAtomicDemo();
        // 启动1000个线程，每个线程执行1000次increment
        for (int i = 0; i < 1000; i++) {
            new Thread(() -> {
                for (int j = 0; j < 1000; j++) {
                    demo.increment();
                }
            }).start();
        }

        // 等待所有线程执行完成
        Thread.sleep(2000);
        // 预期结果：1000 * 1000 = 1000000，实际结果往往小于1000000
        System.out.println("最终count值：" + demo.count);
    }
}
```

运行结果：多次运行后，count 的值始终小于 1000000，证明 volatile 无法保证复合操作的原子性。

解决方案：若要保证复合操作的线程安全，需结合锁机制（synchronized、ReentrantLock）或原子类（AtomicInteger、AtomicLong），不能单独依赖 volatile。

## 三、volatile 的核心特性二：禁止指令重排

除了可见性，volatile 还有一个关键特性——**禁止指令重排**。这一特性在多线程环境中，对保证程序执行顺序、避免逻辑错误至关重要。

### 3.1 什么是指令重排？

为了提高程序的执行效率，编译器（Java 编译器）和 CPU 会在不改变程序“单线程语义”的前提下，对指令的执行顺序进行重新排序。这种优化在单线程环境下是安全的，因为它不会影响程序的最终结果，但在多线程环境下，可能会导致逻辑错误。

举个简单的例子（单线程下安全，多线程下可能出问题）：

```java
// 单线程环境下，指令重排不影响结果
int a = 1; // 操作1
int b = 2; // 操作2
int c = a + b; // 操作3
```

编译器可能将操作 1 和操作 2 的顺序调换（变成先执行操作 2，再执行操作 1），因为操作 1 和操作 2 之间没有依赖关系（互不影响），重排后执行效率更高，且最终 c 的值依然是 3。

但在多线程场景中，指令重排可能导致严重的逻辑错误。最经典的案例就是“初始化与状态标记”的场景：

```java
public class VolatileReorderDemo {
    // 未使用volatile修饰initialized
    private boolean initialized = false;
    private int data;

    // 线程1：初始化数据
    public void init() {
        data = 100;        // 操作A：初始化数据
        initialized = true; // 操作B：标记初始化完成
    }

    // 线程2：读取数据
    public void read() {
        if (initialized) { // 操作C：判断是否初始化完成
            System.out.println(data); // 操作D：读取数据，可能读取到0（默认值）
        }
    }
}
```

分析：单线程下，操作 A 一定会在操作 B 之前执行，线程 2 读取时，data 必然是 100。但多线程下，编译器或 CPU 可能将操作 A 和操作 B 重排——先执行 initialized = true（操作 B），再执行 data = 100（操作 A）。此时，线程 2 可能在操作 A 未执行完成时，就判断 initialized 为 true，进而读取到 data 的默认值 0，导致逻辑错误。

### 3.2 volatile 如何禁止重排？

volatile 禁止指令重排的核心，依然是**内存屏障**。JVM 通过在 volatile 变量的读写操作前后插入特定的内存屏障，限制编译器和 CPU 的重排行为，确保指令的执行顺序与代码逻辑顺序一致。

具体重排规则（基于 JMM 的 happens-before 原则）：

- 对 volatile 变量的写入操作，happens-before 于后续对该变量的读取操作（即写入操作一定在读取操作之前执行）；
    
- volatile 变量的写入操作，禁止将后续的指令重排到写入操作之前；
    
- volatile 变量的读取操作，禁止将前面的指令重排到读取操作之后；
    
- 普通变量的操作，不能跨越 volatile 变量的读写操作进行重排。
    

回到上面的初始化案例：若用 volatile 修饰 initialized，那么操作 A（data = 100）和操作 B（initialized = true）的重排会被禁止，确保操作 A 完全执行完成后，才会执行操作 B。这样一来，线程 2 只有在 data 初始化完成后，才能判断 initialized 为 true，从而读取到正确的 data 值（100）。

修改后的正确代码：

```java
public class VolatileReorderDemo {
    // 用volatile修饰initialized，禁止指令重排
    private volatile boolean initialized = false;
    private int data;

    public void init() {
        data = 100;        // 操作A：必须在操作B之前执行
        initialized = true; // 操作B：标记初始化完成
    }

    public void read() {
        if (initialized) {
            System.out.println(data); // 必然读取到100
        }
    }
}
```

## 四、volatile 的实际应用场景（附可运行代码）

volatile 的适用场景有严格限制——它仅能保证可见性和禁止重排，不保证原子性，因此不能用于复杂的线程安全控制。以下是它最适合的 3 个实战场景，每个场景都附可直接运行的代码，方便大家在项目中参考。

### 4.1 场景一：状态标记量（最经典用法）

用于标记线程的运行状态（如是否需要停止）、初始化是否完成、任务是否执行完毕等，这类场景的核心特点是：变量的修改是原子操作（直接赋值），不需要复合操作，仅需保证其他线程能立即感知到变量的变化。

实战案例：优雅关闭线程（生产环境常用）

```java
public class VolatileFlagDemo {
    // 用volatile修饰状态标记量，保证可见性
    private volatile boolean isRunning = true;

    // 启动线程执行任务
    public void start() {
        new Thread(() -> {
            // 循环执行任务，直到isRunning变为false
            while (isRunning) {
                try {
                    // 模拟业务任务：每秒执行一次
                    Thread.sleep(1000);
                    System.out.println("线程运行中...");
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
            System.out.println("线程已优雅停止");
        }).start();
    }

    // 关闭线程：修改状态标记量
    public void stop() {
        isRunning = false;
        System.out.println("已触发线程停止指令");
    }

    public static void main(String[] args) throws InterruptedException {
        VolatileFlagDemo demo = new VolatileFlagDemo();
        demo.start();
        // 让线程运行3秒后，触发停止
        Thread.sleep(3000);
        demo.stop();
    }
}
```

运行结果：线程会打印 3 次“线程运行中...”，之后收到停止指令，打印“线程已优雅停止”。这里 volatile 的作用是：stop() 方法修改 isRunning 后，线程能立即感知到变化，从而退出循环，避免线程无法停止的问题。

### 4.2 场景二：双重检查锁定（DCL）单例模式

在单例模式中，双重检查锁定（DCL）是一种高效的实现方式，而 volatile 在这里的作用是禁止实例化过程中的指令重排，避免其他线程获取到“未完全初始化的对象”。

先看错误的 DCL 实现（无 volatile 修饰）：

```java
// 错误示例：instance未用volatile修饰，可能获取到未完全初始化的对象
public class SingletonError {
    private static SingletonError instance; // 无volatile

    private SingletonError() {}

    public static SingletonError getInstance() {
        if (instance == null) { // 第一次检查（无锁，提高效率）
            synchronized (SingletonError.class) { // 加锁，保证原子性
                if (instance == null) { // 第二次检查，避免多线程竞争
                    // 可能发生指令重排：分配内存 → 引用指向内存 → 初始化对象
                    // 重排后，引用可能先指向内存，而对象未初始化
                    instance = new SingletonError();
                }
            }
        }
        return instance;
    }
}
```

问题分析：instance = new SingletonError() 看似是一个原子操作，实则分为 3 个步骤：

1. 为对象分配内存空间；
    
2. 将 instance 引用指向该内存空间；
    
3. 初始化对象（调用构造方法）。
    

若 instance 未被 volatile 修饰，编译器可能将步骤 2 和步骤 3 重排——先执行步骤 2（instance 指向内存），再执行步骤 3（初始化对象）。此时，若有其他线程进入 getInstance() 方法，第一次检查会发现 instance 不为 null，直接返回该引用，但此时对象还未初始化，使用时会出现空指针异常。

正确的 DCL 实现（volatile 修饰 instance）：

```java
// 正确示例：volatile修饰instance，禁止指令重排
public class Singleton {
    // 必须用volatile修饰，禁止实例化过程中的指令重排
    private static volatile Singleton instance;

    private Singleton() {}

    public static Singleton getInstance() {
        if (instance == null) { // 第一次检查：无锁，提高并发效率
            synchronized (Singleton.class) { // 加锁，保证只有一个线程进入实例化逻辑
                if (instance == null) { // 第二次检查：避免多线程竞争导致重复实例化
                    // volatile禁止重排，确保对象完全初始化后，instance才会指向内存
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }

    // 测试：多线程获取单例，验证是否唯一
    public static void main(String[] args) {
        for (int i = 0; i < 100; i++) {
            new Thread(() -> {
                System.out.println(Singleton.getInstance().hashCode());
            }).start();
        }
    }
}
```

运行结果：所有线程打印的 hashCode 完全一致，证明单例唯一，且不会出现未初始化的对象。这里 volatile 的核心作用，就是禁止 instance = new Singleton() 的指令重排，保证对象完全初始化后，才会被其他线程访问。

### 4.3 场景三：与 CAS 操作配合实现无锁并发

volatile 常与 CAS（Compare-And-Swap，比较并交换）操作结合，实现高效的无锁并发控制。CAS 是一种原子操作，它能保证对共享变量的修改具有原子性，而 volatile 则保证共享变量的可见性，两者结合，既能避免锁的开销，又能保证线程安全。

最典型的应用就是 JDK 中的原子类（如 AtomicInteger、AtomicLong），其底层就是 volatile + CAS 实现的。

示例：模拟 AtomicInteger 的核心实现（简化版）

```java
import sun.misc.Unsafe;
import java.lang.reflect.Field;

public class MyAtomicInteger {
    // 用volatile修饰共享变量value，保证可见性
    private volatile int value;
    // Unsafe类提供CAS操作的底层支持
    private static final Unsafe unsafe;
    // value变量的内存偏移量（用于CAS操作定位变量）
    private static final long valueOffset;

    static {
        try {
            // 通过反射获取Unsafe实例
            Field field = Unsafe.class.getDeclaredField("theUnsafe");
            field.setAccessible(true);
            unsafe = (Unsafe) field.get(null);
            // 获取value变量的内存偏移量
            valueOffset = unsafe.objectFieldOffset(MyAtomicInteger.class.getDeclaredField("value"));
        } catch (Exception e) {
            throw new Error(e);
        }
    }

    public MyAtomicInteger(int initialValue) {
        value = initialValue;
    }

    // 模拟getAndIncrement()：CAS保证原子性，volatile保证可见性
    public final int getAndIncrement() {
        // CAS操作：比较value当前值与预期值，若一致则更新为新值，返回旧值
        while (true) {
            int current = value; // 读取volatile变量，保证获取最新值
            int next = current + 1; // 计算新值
            // CAS操作：若当前value == current，将其更新为next
            if (unsafe.compareAndSwapInt(this, valueOffset, current, next)) {
                return current;
            }
        }
    }

    // 获取当前value值
    public final int get() {
        return value;
    }

    // 测试：多线程自增，验证线程安全
    public static void main(String[] args) throws InterruptedException {
        MyAtomicInteger atomicInteger = new MyAtomicInteger(0);
        // 1000个线程，每个线程自增1000次
        for (int i = 0; i < 1000; i++) {
            new Thread(() -> {
                for (int j = 0; j < 1000; j++) {
                    atomicInteger.getAndIncrement();
                }
            }).start();
        }
        Thread.sleep(2000);
        System.out.println("最终值：" + atomicInteger.get()); // 预期1000000
    }
}
```

运行结果：最终值始终为 1000000，证明线程安全。这里的核心逻辑：volatile 保证 value 的可见性，确保线程能读取到最新值；CAS 操作保证自增的原子性，避免多线程竞争导致的数据不一致。这种无锁方案，比使用 synchronized 更高效，适用于高并发场景。

## 五、volatile 的使用误区与禁忌（面试高频）

很多开发者因为对 volatile 的特性理解不透彻，容易陷入使用误区，甚至导致线上 bug。以下是 3 个最常见的误区和禁忌，也是面试中高频考察的点。

### 5.1 误区一：用 volatile 替代锁保证原子性

这是最常见的误区——认为只要用 volatile 修饰共享变量，就能保证所有操作的线程安全。但前文已经多次强调：**volatile 不保证复合操作的原子性**，仅能保证可见性和禁止重排。

错误示例（试图用 volatile 保证 i++ 的线程安全）：

```java
// 错误示例
private volatile int i = 0;

// 多线程同时调用，仍会出现线程安全问题
public void increment() {
    i++; // 复合操作，volatile无法保证原子性
}
```

正确做法：根据场景选择合适的方案：

- 简单复合操作（如自增、自减）：使用 AtomicInteger、AtomicLong 等原子类；
    
- 复杂业务逻辑（多个操作需要原子性）：使用 synchronized 或 ReentrantLock 锁。
    

### 5.2 误区二：过度使用 volatile

有些开发者认为“只要是共享变量，就用 volatile 修饰”，这种做法是错误的。volatile 虽然是轻量级同步机制，但它的内存屏障会限制编译器和 CPU 的优化，带来一定的性能损耗（虽然很小，但高并发场景下会被放大）。

只有当共享变量满足以下所有条件时，才需要用 volatile 修饰：

- 变量被多个线程共享；
    
- 变量的修改操作是原子性的（直接赋值，如 flag = true、count = 10）；
    
- 需要确保其他线程能立即感知到变量的修改（即需要可见性）。
    

如果变量仅被单线程修改，或修改操作不需要其他线程立即感知，就不需要用 volatile 修饰。

### 5.3 禁忌：volatile 修饰引用类型的局限性

当 volatile 修饰**对象引用**时，需要注意一个关键问题：它仅保证引用本身的可见性，不保证对象内部字段的可见性。

示例（volatile 修饰引用类型的陷阱）：

```java
class Data {
    int value; // 非volatile字段，内部字段
}

public class VolatileReferenceDemo {
    // volatile修饰Data引用
    private volatile Data data = new Data();

    // 线程1：修改data的内部字段value
    public void updateValue() {
        data.value = 100; // 修改的是对象内部字段，volatile无法保证其可见性
    }

    // 线程2：读取data的内部字段value
    public void readValue() {
        // data引用的可见性由volatile保证，但data.value的可见性无法保证
        System.out.println(data.value); // 可能读取到旧值0
    }

    public static void main(String[] args) throws InterruptedException {
        VolatileReferenceDemo demo = new VolatileReferenceDemo();
        new Thread(demo::updateValue).start();
        Thread.sleep(100);
        new Thread(demo::readValue).start();
    }
}
```

问题分析：volatile 修饰的是 data 引用，它能保证线程 2 读取到 data 引用的最新值（即线程 1 没有重新赋值 data，所以引用本身不变），但无法保证 data 内部字段 value 的可见性。线程 1 修改 data.value 后，新值可能未刷新到主内存，线程 2 读取到的依然是旧值 0。

解决方案：将对象内部的共享字段也声明为 volatile，或者使用锁机制保证内部字段的可见性。

修改后的正确代码：

```java
class Data {
    volatile int value; // 内部字段也用volatile修饰，保证可见性
}

public class VolatileReferenceDemo {
    private volatile Data data = new Data();

    public void updateValue() {
        data.value = 100;
    }

    public void readValue() {
        System.out.println(data.value); // 必然读取到100
    }
}
```

## 六、总结：volatile 的正确定位与面试重点

volatile 是 Java 并发编程中的**轻量级同步机制**，它的核心价值的是“保证可见性、禁止指令重排”，但它并非万能药，不能替代锁解决原子性问题。我们可以用一句话总结它的定位：

**volatile 适用于“单写多读”或“状态标记”的简单场景，复杂的线程安全控制仍需依赖锁或原子类。**

### 核心要点回顾（面试高频）

1. volatile 的两大核心特性：可见性（通过内存屏障强制缓存与主内存同步）、禁止指令重排（通过内存屏障限制编译器/CPU 优化）；
    
2. volatile 的局限性：不保证原子性，无法解决复合操作的线程安全问题；
    
3. 三大经典应用场景：状态标记量、DCL 单例模式、与 CAS 配合实现无锁并发；
    
4. 底层原理：通过内存屏障实现，不同 CPU 架构会有优化，但语义一致；
    
5. 常见误区：用 volatile 替代锁、过度使用、忽视引用类型的局限性。
    

理解 volatile 的底层原理（内存屏障、JMM 规范），不仅能帮助我们正确使用它，更能深入理解多线程环境下数据交互的本质。下一篇文章，我们将探讨另一个核心同步机制——synchronized 关键字，解析其从偏向锁、轻量级锁到重量级锁的进化之路，以及它与 volatile 的区别和联系。

最后，留一个面试高频问题供大家思考：volatile 和 synchronized 的区别是什么？欢迎在评论区留下你的答案，我们下一篇文章一起拆解！
