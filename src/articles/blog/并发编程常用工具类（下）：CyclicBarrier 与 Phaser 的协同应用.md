在 Java 并发编程中，线程协作是实现高效并行任务的核心，除了上一篇提到的 CountDownLatch 和 Semaphore，CyclicBarrier（循环屏障）和 Phaser（阶段同步器）更是应对多阶段、动态线程场景的“利器”。它们弥补了前两者在多轮同步、动态调整线程数量上的不足，让开发者能构建更灵活、更贴合复杂业务场景的并发模型。

本文作为并发工具类系列的第二篇，将深入拆解 CyclicBarrier 和 Phaser 的核心原理、底层实现逻辑，结合真实业务场景实战案例，对比两者的差异与协同方式，同时补充开发中的易错点和优化技巧，帮助大家真正吃透这两个工具类，在面试和实际开发中灵活运用。

# 一、CyclicBarrier：循环屏障的多阶段协作艺术

CyclicBarrier 直译“循环屏障”，其设计核心是：**让一组固定数量的线程，在到达某个“屏障点”时全部暂停，直至所有线程都抵达该点，再集体唤醒，继续执行后续逻辑**。它最突出的特点是“可循环复用”——与 CountDownLatch 计数器归 0 后就无法复用不同，CyclicBarrier 可通过 reset() 方法重置计数器，支持多轮次的线程同步，这也是“循环”二字的精髓所在。

## 1.1 核心原理与核心方法深度解析

CyclicBarrier 的底层依赖 AQS（AbstractQueuedSynchronizer）实现线程的阻塞与唤醒，其核心机制是“屏障点 + 集体唤醒”：当线程调用 await() 方法时，会进入阻塞状态并加入等待队列，直到最后一个线程调用 await()，触发屏障动作（若有），再唤醒所有等待线程，同时重置计数器（为下一轮同步做准备）。

以下是 CyclicBarrier 的核心方法，结合实际使用场景拆解说明，避免踩坑：

|方法|功能描述|使用注意事项|
|---|---|---|
|CyclicBarrier(int parties)|构造方法，指定参与同步的线程数量（parties）|parties 必须大于 0，否则抛出 IllegalArgumentException；一旦指定，默认不可动态修改（这是与 Phaser 的核心区别之一）|
|CyclicBarrier(int parties, Runnable barrierAction)|带屏障动作的构造方法，所有线程到达屏障点后，会先执行该 Runnable 任务（由最后一个到达的线程执行）|barrierAction 若抛出异常，会导致屏障被打破，所有等待线程抛出 BrokenBarrierException|
|int await()|线程到达屏障点后阻塞等待，返回当前线程的到达顺序（0~parties-1，最后一个到达的线程返回 parties-1）|会响应线程中断，中断后屏障被打破；若等待过程中屏障被 reset()，也会抛出 BrokenBarrierException|
|int await(long timeout, TimeUnit unit)|带超时的等待，超时后屏障被打破，抛出 TimeoutException|超时后，当前线程抛出异常，同时屏障被标记为“打破”，其他等待线程也会被唤醒并抛出异常|
|void reset()|重置屏障至初始状态，所有等待线程将收到 BrokenBarrierException|慎用！若在部分线程等待时调用 reset()，会导致线程协作异常，需确保所有线程都已完成当前轮次同步|
|int getNumberWaiting()|返回当前正在屏障点等待的线程数|多用于调试，判断线程是否正常到达屏障点，避免出现“线程丢失”问题|
|boolean isBroken()|判断屏障是否被打破（如线程中断、超时、屏障动作异常等）|可在异常处理中调用，判断是否需要重置屏障或终止任务|

关键特性总结：CyclicBarrier 的核心是“**所有线程必须同时到达屏障点**”，缺一不可；支持多轮同步，每轮同步完成后计数器自动重置；屏障动作是可选的，用于在所有线程到达后执行统一逻辑（如阶段总结、数据汇总）。

## 1.2 典型场景：分阶段数据处理（实战落地）

在实际开发中，分阶段任务是非常常见的场景——例如大数据处理中的“数据采集→数据清洗→数据分析→结果存储”，每个阶段都需要所有线程完成当前工作后，才能进入下一阶段，避免出现“部分线程已进入下一阶段，部分线程还在处理上一阶段”的混乱。

CyclicBarrier 能完美管控这种分阶段协作，以下是贴合实际业务的实战案例（优化版，增加异常处理细节和日志打印，可直接复用）：

```java
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;

/**
 * 分阶段数据处理实战：模拟大数据批量处理流程
 * 场景：3个线程并行处理数据，分3个阶段完成，每个阶段需所有线程同步后再进入下一阶段
 */
public class DataProcessDemo {
    // 3个线程参与同步，所有线程到达屏障后执行阶段总结动作（由最后一个到达的线程执行）
    private static final CyclicBarrier barrier = new CyclicBarrier(3, 
        () -> {
            System.out.println("\n=== 【阶段总结】所有线程完成当前阶段，即将进入下一阶段 ===");
            // 可扩展：阶段切换时的资源清理、日志上报等逻辑
        });

    public static void main(String[] args) {
        System.out.println("=== 数据处理任务启动，共3个线程参与 ===");
        // 启动3个数据处理线程（实际开发中可替换为线程池，避免线程创建销毁开销）
        for (int i = 0; i < 3; i++) {
            new Thread(new DataProcessor(i), "数据处理线程-" + i).start();
        }
    }

    /**
     * 数据处理器：实现分阶段处理逻辑
     */
    static class DataProcessor implements Runnable {
        private int threadId;

        public DataProcessor(int threadId) {
            this.threadId = threadId;
        }

        @Override
        public void run() {
            try {
                // 第一阶段：数据采集（模拟从不同数据源获取数据）
                System.out.println("线程" + threadId + "：开始执行【数据采集】阶段");
                // 模拟业务耗时（随机100~1000ms）
                Thread.sleep((long) (Math.random() * 900 + 100));
                System.out.println("线程" + threadId + "：【数据采集】完成，等待其他线程");
                // 到达屏障点，阻塞等待
                barrier.await();

                // 第二阶段：数据清洗（模拟数据去重、格式标准化）
                System.out.println("线程" + threadId + "：开始执行【数据清洗】阶段");
                Thread.sleep((long) (Math.random() * 900 + 100));
                System.out.println("线程" + threadId + "：【数据清洗】完成，等待其他线程");
                barrier.await();

                // 第三阶段：数据存储（模拟将处理后的数据写入数据库）
                System.out.println("线程" + threadId + "：开始执行【数据存储】阶段");
                Thread.sleep((long) (Math.random() * 900 + 100));
                System.out.println("线程" + threadId + "：【数据存储】完成，等待其他线程");
                barrier.await();

                System.out.println("线程" + threadId + "：所有阶段处理完成，任务退出");
            } catch (InterruptedException e) {
                // 线程被中断，标记中断状态，避免中断丢失
                Thread.currentThread().interrupt();
                System.out.println("线程" + threadId + "：任务被中断，异常信息：" + e.getMessage());
            } catch (BrokenBarrierException e) {
                // 屏障被打破（如其他线程中断、超时、屏障动作异常）
                System.out.println("线程" + threadId + "：屏障被打破，无法继续执行，异常信息：" + e.getMessage());
            }
        }
    }
}
    
```

案例解析（重点关注）：

- 每个线程完成当前阶段任务后，必须调用 `barrier.await()`，否则会导致其他线程无限等待（这是开发中最常见的坑）；
    
- 屏障动作由最后一个到达的线程执行，若屏障动作抛出异常，会直接打破屏障，所有等待线程都会收到 BrokenBarrierException；
    
- 异常处理中，需及时标记线程中断状态（`Thread.currentThread().interrupt()`），避免中断信号丢失，导致后续逻辑异常；
    
- CyclicBarrier 的“循环”特性体现在：3 个阶段的同步，复用了同一个 barrier 实例，无需为每个阶段创建新的同步工具，代码更简洁、可维护性更高。
    

## 1.3 与 CountDownLatch 的核心差异（面试高频考点）

很多开发者会混淆 CyclicBarrier 和 CountDownLatch，两者都能实现线程同步，但核心逻辑、适用场景截然不同，也是面试中高频提问的知识点。以下从 5 个核心维度对比，帮大家快速区分：

|对比维度|CyclicBarrier|CountDownLatch|
|---|---|---|
|复用性|可通过 reset() 重置计数器，支持多轮同步（循环复用）|计数器归 0 后不可复用，一次性使用|
|同步逻辑|所有线程相互等待（线程→线程），属于“对等同步”|一组线程等待另一组线程完成任务（线程组→线程组），属于“不对等同步”|
|核心动作|线程到达屏障点后阻塞，需所有线程到齐后集体唤醒|线程完成任务后递减计数器，无需等待其他线程，计数器归 0 后唤醒等待线程|
|异常影响|单个线程中断、超时或屏障动作异常，会打破屏障，影响所有线程|单个线程中断，仅影响自身，不影响计数器和其他线程|
|典型场景|分阶段任务的各阶段同步（如数据处理、测试用例执行）|初始化等待（如主线程等待所有子线程初始化完成）、事件通知（如任务完成后通知主线程）|

示例对比（直观感受差异）：

若用 CountDownLatch 实现上述分阶段数据处理，需为每个阶段创建一个新的 CountDownLatch 实例（3 个阶段需 3 个计数器），且无法复用；而 CyclicBarrier 仅用一个实例，就能完成所有阶段的同步，代码量减少、逻辑更清晰。

# 二、Phaser：动态调整的高级阶段同步器

CyclicBarrier 虽能实现多轮同步，但有一个明显的局限性：**参与同步的线程数量固定**，一旦初始化时指定了 parties，就无法动态增减（除非调用 reset() 重置，但会打破当前同步）。而在实际开发中，很多场景的线程数量是动态变化的——例如分布式计算中，部分线程完成任务后退出，新的线程因任务新增而加入，此时 CyclicBarrier 就无法满足需求。

Phaser 是 Java 7 引入的高级同步工具，完美解决了这个问题。它兼具 CountDownLatch 和 CyclicBarrier 的功能，支持**动态注册/注销参与者（线程）**，还能自定义阶段切换逻辑，适用于线程数量动态变化的多阶段任务，灵活性远超 CyclicBarrier。

## 2.1 核心原理与核心方法解析

Phaser 的核心设计理念是“阶段（phase）”和“参与者（party）”：

- 阶段（phase）：任务的执行阶段，从 0 开始递增，每轮所有参与者到达阶段终点后，阶段号自动加 1，溢出后重置为 0；
    
- 参与者（party）：参与同步的线程，可通过 register() 动态注册、deregister() 动态注销，参与者数量可随时变化；
    
- 核心机制：每个参与者完成当前阶段任务后，调用 arriveAndAwaitAdvance() 等待其他参与者，所有参与者到达后，触发阶段切换，进入下一阶段；若参与者完成所有任务，可调用 arriveAndDeregister() 注销自身，不再参与后续阶段。
    

Phaser 的核心方法如下，结合使用场景和易错点详细说明：

|方法|功能描述|使用注意事项|
|---|---|---|
|Phaser(int parties)|构造方法，指定初始参与者数量|parties 可设为 0，后续通过 register() 动态添加参与者|
|int register()|注册一个参与者，返回当前阶段号|可在任何阶段注册，注册后会参与当前阶段的同步（若当前阶段已开始，需等待下一轮）|
|boolean deregister()|注销一个参与者，返回是否为最后一个参与者|注销后，该参与者不再参与后续阶段；若当前有线程等待，会重新计算“所有参与者到达”的条件|
|int arriveAndAwaitAdvance()|当前参与者到达阶段终点，等待其他参与者后进入下一阶段，返回当前阶段号|若 Phaser 已终止，返回负数；响应线程中断，中断后会导致自身退出，不影响其他参与者|
|int arriveAndDeregister()|到达阶段终点并注销自身，适用于完成所有任务的参与者|注销后，无需再参与后续阶段，避免资源浪费|
|int getPhase()|返回当前阶段号（从 0 开始，溢出后重置为 0）|常用于判断当前任务所处阶段，执行不同的业务逻辑|
|int getRegisteredParties()|返回当前注册的参与者数量|动态监控参与者变化，用于调试和业务逻辑判断|
|boolean isTerminated()|判断 Phaser 是否终止|当 onAdvance() 方法返回 true 时，Phaser 终止，后续所有方法调用均无效|

高级特性：Phaser 允许重写 `onAdvance(int phase, int registeredParties)` 方法，自定义阶段切换逻辑——该方法在所有参与者到达当前阶段后调用，返回 true 则终止 Phaser，返回 false 则继续进入下一阶段。这一特性让 Phaser 能灵活适配不同的业务场景（如完成指定阶段后终止、参与者为 0 时终止等）。

## 2.2 典型场景：动态线程的多阶段任务（实战落地）

以“动态任务分发与处理”为例：初始有 3 个线程处理任务，在第二阶段，有新的任务加入（新增 1 个线程），在第三阶段，有 1 个线程完成任务后退出，最终所有阶段完成后终止 Phaser。这种动态变化的场景，只有 Phaser 能完美应对。

实战案例（优化版，增加日志监控和资源释放，贴合实际开发）：

```java
import java.util.concurrent.Phaser;

/**
 * 动态线程多阶段任务实战：模拟动态任务分发与处理
 * 场景：初始3个线程，阶段1新增1个线程，阶段2减少1个线程，完成3个阶段后终止
 */
public class DynamicTaskDemo {
    public static void main(String[] args) throws InterruptedException {
        // 初始3个参与者，重写onAdvance方法，自定义阶段切换逻辑
        Phaser phaser = new Phaser(3) {
            @Override
            protected boolean onAdvance(int phase, int registeredParties) {
                // 阶段切换时的日志打印（可扩展：阶段总结、数据上报、资源清理）
                System.out.println("\n=== 阶段" + phase + "完成，当前参与者数量：" + registeredParties + " ===");
                // 终止条件：完成3个阶段（phase从0开始，0、1、2共3个阶段）或参与者为0
                return registeredParties == 0 || phase >= 2;
            }
        };

        System.out.println("=== 动态任务启动，初始3个参与者 ===");
        // 启动3个初始任务线程
        for (int i = 0; i < 3; i++) {
            new Thread(new DynamicWorker(phaser, i), "初始线程-" + i).start();
        }

        // 主线程等待Phaser终止（避免主线程提前退出，无法监控任务完成情况）
        while (!phaser.isTerminated()) {
            Thread.sleep(100); // 每隔100ms检查一次，降低CPU占用
        }
        System.out.println("\n所有阶段完成，Phaser终止，任务全部结束");
    }

    /**
     * 动态工作线程：支持阶段任务执行、动态注册/注销
     */
    static class DynamicWorker implements Runnable {
        private Phaser phaser;
        private int workerId;

        public DynamicWorker(Phaser phaser, int workerId) {
            this.phaser = phaser;
            this.workerId = workerId;
        }

        @Override
        public void run() {
            try {
                // 阶段0：数据准备（所有初始线程参与）
                System.out.println("线程" + workerId + "：执行阶段0（数据准备），当前阶段号：" + phaser.getPhase());
                Thread.sleep((long) (Math.random() * 900 + 100)); // 模拟业务耗时
                // 到达阶段终点，等待其他参与者
                phaser.arriveAndAwaitAdvance();

                // 阶段1：数据处理（线程0动态注册新参与者）
                // 仅线程0在阶段1开始后注册新线程（模拟新任务加入）
                if (workerId == 0 && phaser.getPhase() == 1) {
                    phaser.register(); // 注册新参与者
                    new Thread(new DynamicWorker(phaser, 3), "新增线程-3").start();
                    System.out.println("线程0：注册新参与者，当前参与者数：" + phaser.getRegisteredParties());
                }
                System.out.println("线程" + workerId + "：执行阶段1（数据处理），当前阶段号：" + phaser.getPhase());
                Thread.sleep((long) (Math.random() * 900 + 100));
                phaser.arriveAndAwaitAdvance();

                // 阶段2：结果汇总（线程1完成任务后注销）
                if (workerId == 1) {
                    // 线程1完成所有任务，注销自身，不再参与后续逻辑
                    phaser.deregister();
                    System.out.println("线程1：完成所有任务，已注销，当前参与者数：" + phaser.getRegisteredParties());
                    return; // 线程退出，避免执行后续代码
                }
                System.out.println("线程" + workerId + "：执行阶段2（结果汇总），当前阶段号：" + phaser.getPhase());
                Thread.sleep((long) (Math.random() * 900 + 100));
                // 完成所有任务，到达阶段终点并注销
                phaser.arriveAndDeregister();
                System.out.println("线程" + workerId + "：完成所有任务，已注销");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.out.println("线程" + workerId + "：任务被中断，异常信息：" + e.getMessage());
            }
        }
    }
}
    
```


案例解析（核心亮点）：

- 动态注册：线程 0 在阶段 1 动态注册新参与者（线程 3），参与者数量从 3 变为 4，新注册的线程直接参与当前阶段的同步，无需等待下一轮；
    
- 动态注销：线程 1 在阶段 2 完成后注销，参与者数量从 4 变为 3，注销后线程直接退出，不再参与后续逻辑，避免资源浪费；
    
- 自定义阶段切换：重写 onAdvance() 方法，设置“完成 3 个阶段或参与者为 0”时终止 Phaser，灵活适配业务需求；
    
- 线程安全：Phaser 的所有方法均为线程安全，无需额外加锁，可放心在多线程环境中动态注册/注销参与者。
    

## 2.3 高级特性：分层 Phaser（高并发优化）

当参与同步的线程数量非常多（如 1000 个）时，若使用单个 Phaser，所有线程都会竞争同一个同步节点，会导致线程阻塞、唤醒的效率降低，影响系统性能。此时，Phaser 的**分层机制**就能发挥作用。

分层 Phaser 的核心思想：将大量线程分为多个小组，每个小组由一个子 Phaser 管理（负责组内线程的同步），所有子 Phaser 再注册到一个父 Phaser 中（负责全局同步），形成“局部同步→全局同步”的层级协作模式，从而减少单个 Phaser 的竞争压力，提升高并发场景下的性能。

实战代码示例（模拟 6 个线程，分为 3 组，实现分层同步）：

```java
import java.util.concurrent.Phaser;

/**
 * 分层Phaser实战：模拟高并发场景下的分层同步
 * 场景：6个线程分为3组，每组2个线程，组内同步完成后，再进行全局同步
 */
public class HierarchicalPhaserDemo {
    public static void main(String[] args) {
        // 父Phaser：负责全局同步，初始0个参与者（仅注册子Phaser）
        Phaser rootPhaser = new Phaser(0) {
            @Override
            protected boolean onAdvance(int phase, int registeredParties) {
                System.out.println("\n【全局同步】全局阶段" + phase + "完成，参与子Phaser数量：" + registeredParties);
                // 完成2个全局阶段后终止（对应组内2个阶段）
                return phase >= 1;
            }
        };

        // 创建3个子Phaser，父Phaser为rootPhaser，每个子Phaser管理2个线程
        Phaser[] childPhasers = new Phaser[3];
        for (int i = 0; i< 3; i++) {
            // 子Phaser的父Phaser设为rootPhaser，初始2个参与者（每组2个线程）
            childPhasers[i] = new Phaser(rootPhaser, 2);
        }

        System.out.println("=== 分层Phaser任务启动，共3组6个线程 ===");
        // 启动6个线程（3组×2个）
        for (int i = 0; i < 3; i++) {
            int groupId = i; // 组ID，用于关联子Phaser
            for (int j = 0; j < 2; j++) {
                new Thread(() -> {
                    // 每个线程执行2个阶段的任务（组内同步）
                    for (int phase = 0; phase < 2; phase++) {
                        System.out.println("组" + groupId + "线程" + Thread.currentThread().getId() + 
                                           "：完成组内阶段" + phase + "，等待组内其他线程");
                        // 组内同步：等待同组的另一个线程完成当前阶段
                        childPhasers[groupId].arriveAndAwaitAdvance();
                    }
                    // 所有组内阶段完成后，注销自身（子Phaser的参与者数量减1）
                    childPhasers[groupId].arriveAndDeregister();
                    System.out.println("组" + groupId + "线程" + Thread.currentThread().getId() + "：所有任务完成，已注销");
                }).start();
            }
        }
    }
}
    
```

核心价值解析：

- 减少竞争：6 个线程分为 3 组，每组内的同步由子 Phaser 负责，父 Phaser 仅负责子 Phaser 的全局同步，避免了 6 个线程同时竞争同一个 Phaser 的情况；
    
- 提升性能：局部同步和全局同步分离，线程阻塞、唤醒的效率更高，尤其适合高并发场景（如大数据并行处理、分布式任务调度）；
    
- 可扩展性强：可根据线程数量动态调整子 Phaser 的数量，例如 1000 个线程可分为 10 组，每组 100 个线程，灵活适配不同规模的任务。
    

# 三、四大并发工具类综合对比与选型指南（实战必备）

结合上一篇的 CountDownLatch 和 Semaphore，以及本文的 CyclicBarrier 和 Phaser，这四类工具类基本覆盖了 Java 并发编程中所有常见的线程协作场景。掌握它们的选型技巧，能大幅提升并发代码的编写效率和可靠性，也是面试中的核心考点。

|工具类|核心能力|灵活性|典型场景|适用线程数|核心优势|
|---|---|---|---|---|---|
|CountDownLatch|等待多线程完成任务|低（一次性，不可复用）|初始化等待、事件通知、任务完成汇总|固定|简单易用，性能高，适合一次性同步场景|
|Semaphore|控制资源并发访问数量|中（动态调整许可数量）|资源池（如连接池、线程池）、限流、并发访问控制|不固定|灵活控制并发数，可实现资源的合理分配|
|CyclicBarrier|多阶段线程同步（循环复用）|中（可重置，线程数固定）|分阶段任务（数据处理、测试用例执行）|固定|支持多轮同步，代码简洁，适合固定线程的分阶段协作|
|Phaser|动态阶段同步（支持参与者增减）|高（动态注册/注销，自定义阶段逻辑）|动态线程任务、分层同步、复杂多阶段任务|动态变化|灵活性最高，适配复杂场景，支持高并发优化|

选型建议（实战落地，避免踩坑）：

1. 简单等待场景：若只需等待一组线程完成任务（如主线程等待所有子线程初始化），用 **CountDownLatch**；
    
2. 资源限流场景：若需控制并发访问的线程数量（如连接池最多允许 10 个线程同时访问），用 **Semaphore**；
    
3. 固定线程分阶段场景：若线程数量固定，且需要多轮同步（如分阶段数据处理），用 **CyclicBarrier**；
    
4. 动态线程或复杂场景：若线程数量动态变化，或需要分层同步、自定义阶段逻辑，用 **Phaser**；
    
5. 性能优先：高并发场景下，若线程数量多，优先使用 **分层 Phaser**，减少同步竞争；
    
6. 避坑提醒：不要用 CyclicBarrier 处理动态线程场景，不要用 Phaser 处理简单同步场景（避免过度设计，增加代码复杂度）。
    

# 四、总结与进阶思考

CyclicBarrier 和 Phaser 作为 Java 并发编程中的高级工具类，各自承载着不同的场景价值：

- CyclicBarrier 以“循环复用”为核心，解决了固定线程的多阶段同步问题，代码简洁、易用，适合场景相对简单的分阶段任务；
    
- Phaser 以“动态灵活”为核心，弥补了 CyclicBarrier 的局限性，支持动态注册/注销参与者、分层同步和自定义阶段逻辑，是复杂并发场景的首选。
    

结合上一篇的 CountDownLatch 和 Semaphore，这四类工具类构成了 Java 并发协作的“工具箱”——它们底层都依赖 AQS 实现，但封装了不同的同步逻辑，适配不同的业务场景。在实际开发中，无需追求“最强大”的工具，而是要根据线程数量是否固定、是否多阶段任务、是否需要动态调整等因素，选择最贴合需求的工具，才能实现高效、可靠的并发控制。

进阶思考（面试延伸）：

- CyclicBarrier 的 reset() 方法会打破屏障，如何避免因 reset() 导致的线程协作异常？
    
- Phaser 的 onAdvance() 方法返回 true 后，已注册的参与者还能继续执行吗？
    
- 分层 Phaser 中，子 Phaser 终止后，父 Phaser 会受到影响吗？
    

这些问题的答案，大家可以结合本文的原理和案例自行思考，下一篇我们将深入解析 AQS 的底层实现，帮大家彻底吃透并发工具类的核心逻辑。

掌握这些并发工具类的核心原理和适用场景，不仅能简化并发代码的编写，更能提升系统在高并发场景下的稳定性和性能，也是 Java 后端开发者必备的核心技能之一。
