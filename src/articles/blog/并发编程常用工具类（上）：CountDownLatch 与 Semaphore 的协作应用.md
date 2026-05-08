在 Java 并发编程领域，JDK 提供的工具类是简化多线程协作的重要武器，它们就像封装好的“并发组件”，帮我们避开底层同步的复杂陷阱。这些工具类的底层核心，都依赖于 AQS（AbstractQueuedSynchronizer）框架——这个我们上一篇详细拆解过的“并发基石”，通过状态控制和队列管理，为各类同步工具提供了统一的底层支撑。

本文作为并发工具类系列的第一篇，将重点解析 CountDownLatch（倒计时门闩）和 Semaphore（信号量）的核心原理、典型使用场景、实战案例，以及两者的协同方式，同时补充实战中的注意事项和面试高频考点，帮助开发者真正掌握其在多线程协作中的应用技巧，做到“懂原理、会使用、能避坑”。

# 一、CountDownLatch：等待多线程完成的“计数器”

CountDownLatch 直译“倒计时门闩”，是一种经典的线程同步工具，其核心功能非常明确：让一个或多个线程（等待方）阻塞等待，直到其他所有指定线程（执行方）完成各自的操作后，再唤醒等待方继续执行。它的核心实现的是“计数器递减 + 等待唤醒”机制，本质上是 AQS 共享式同步的典型应用——计数器对应 AQS 中的 state 变量，等待线程对应 AQS 同步队列中的节点。

## 1.1 核心原理与方法解析

CountDownLatch 的设计简洁而高效，核心围绕一个不可重置的计数器展开，所有方法的逻辑都服务于“计数器递减”和“线程等待/唤醒”，具体核心方法如下表所示，结合底层 AQS 逻辑帮大家快速理解：

|方法|功能描述|底层 AQS 关联逻辑|
|---|---|---|
|CountDownLatch(int count)|构造方法，初始化计数器值（count 为需要等待的线程操作数，必须≥0；若为0，后续 await() 不会阻塞）|将 AQS 的 state 变量初始化为 count，count 即为需要等待的“完成信号数”|
|void await()|调用线程进入阻塞状态，直至计数器归 0 或被中断；若调用时计数器已为0，直接返回|调用 AQS 的 acquireShared() 方法，尝试获取共享状态（判断 state 是否为0），失败则入队阻塞|
|boolean await(long timeout, TimeUnit unit)|带超时时间的等待，超时后无论计数器是否归 0，线程都会唤醒并返回 false；若超时前计数器归0，返回 true|调用 AQS 的 tryAcquireSharedNanos() 方法，增加超时逻辑，超时后自动唤醒节点|
|void countDown()|将计数器值减 1，当值为 0 时，唤醒所有因 await() 阻塞的线程；若计数器已为0，调用无效果|调用 AQS 的 releaseShared() 方法，通过 CAS 原子递减 state，当 state 归0时，触发状态传播，唤醒所有等待节点|

**关键特性（面试高频）**：CountDownLatch 的计数器是**一次性**的，一旦计数器归 0，后续再调用 countDown() 也不会改变其状态，因此它无法重复使用。这一点与我们后续要讲的 CyclicBarrier 形成核心区别，也是面试中常考的对比点。

## 1.2 典型场景：主线程等待子线程初始化完成

在大型 Java 应用启动过程中，主线程往往需要等待多个初始化任务完成后，才能启动核心业务逻辑——比如加载系统配置文件、初始化数据库连接池、预热缓存、加载第三方服务客户端等。这些初始化任务相互独立，可并行执行，而主线程必须等待所有任务都完成，才能确保后续业务逻辑的正常运行，CountDownLatch 完美适配这种“等待多任务并行完成”的场景。

### 实战案例：系统启动初始化协调

```java
public class SystemInitDemo {
    // 初始化计数器，需等待3个核心任务完成（配置加载、数据库初始化、缓存预热）
    private static final CountDownLatch initLatch = new CountDownLatch(3);
    // 模拟系统配置对象
    private static Config config;
    // 模拟数据库连接池
    private static ConnectionPool connectionPool;
    // 模拟缓存对象
    private static Cache cache;

    public static void main(String[] args) throws InterruptedException {
        System.out.println("系统启动：开始等待所有初始化任务完成...");

        // 1. 启动配置加载任务（独立线程）
        new Thread(() -> {
            try {
                System.out.println("[配置线程]：开始加载系统配置文件（application.yml/properties）...");
                Thread.sleep(1500); // 模拟配置加载耗时（实际场景可能涉及文件读取、解析）
                config = new Config(); // 初始化配置对象
                System.out.println("[配置线程]：系统配置加载完成，加载配置项：" + config.getConfigCount());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); // 恢复中断状态，避免中断丢失
                System.err.println("[配置线程]：配置加载被中断");
            } finally {
                // 无论任务是否异常，都必须调用countDown()，避免主线程无限阻塞
                initLatch.countDown();
                System.out.println("[配置线程]：计数器递减，当前剩余：" + initLatch.getCount());
            }
        }, "配置加载线程").start();

        // 2. 启动数据库连接池初始化任务（独立线程）
        new Thread(() -> {
            try {
                System.out.println("[数据库线程]：开始初始化数据库连接池...");
                Thread.sleep(2000); // 模拟连接池初始化耗时（实际场景涉及连接建立、参数配置）
                connectionPool = new ConnectionPool(10); // 初始化10个连接的连接池
                System.out.println("[数据库线程]：数据库连接池初始化完成，可用连接数：" + connectionPool.getAvailableCount());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("[数据库线程]：连接池初始化被中断");
            } finally {
                initLatch.countDown();
                System.out.println("[数据库线程]：计数器递减，当前剩余：" + initLatch.getCount());
            }
        }, "数据库初始化线程").start();

        // 3. 启动缓存预热任务（独立线程）
        new Thread(() -> {
            try {
                System.out.println("[缓存线程]：开始预热热点数据（用户信息、商品库存等）...");
                Thread.sleep(1000); // 模拟缓存预热耗时（实际场景涉及数据库查询、缓存写入）
                cache = new Cache();
                cache.put("hot:goods", "商品库存数据");
                cache.put("hot:user", "高频用户信息");
                System.out.println("[缓存线程]：热点数据预热完成，缓存条目数：" + cache.getSize());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("[缓存线程]：缓存预热被中断");
            } finally {
                initLatch.countDown();
                System.out.println("[缓存线程]：计数器递减，当前剩余：" + initLatch.getCount());
            }
        }, "缓存预热线程").start();

        // 主线程阻塞等待，直到所有初始化任务完成（计数器归0）
        initLatch.await();
        System.out.println("\n=====================================");
        System.out.println("系统启动：所有初始化任务完成，启动核心业务服务...");
        // 后续执行核心业务逻辑（如启动Web服务、接收请求等）
        startCoreService();
    }

    // 模拟核心业务服务启动
    private static void startCoreService() {
        System.out.println("核心业务服务启动成功，可正常处理用户请求！");
    }

    // 模拟配置类
    static class Config {
        private int configCount = 20; // 模拟20个配置项
        public int getConfigCount() { return configCount; }
    }

    // 模拟数据库连接池类
    static class ConnectionPool {
        private int availableCount;
        public ConnectionPool(int availableCount) { this.availableCount = availableCount; }
        public int getAvailableCount() { return availableCount; }
    }

    // 模拟缓存类
    static class Cache {
        private Map<String, String> cacheMap = new HashMap<>();
        public void put(String key, String value) { cacheMap.put(key, value); }
        public int getSize() { return cacheMap.size(); }
    }
}
```

### 运行结果（清晰呈现执行流程）

### 案例解析（重点关注实战细节）

- 计数器初始化：initLatch 初始值为 3，对应 3 个初始化任务，确保主线程会等待所有任务完成后再继续。
    
- 异常处理：每个任务线程的 countDown() 都放在 finally 块中，这是**实战必备**——即使任务执行过程中发生中断或异常，计数器也能正常递减，避免主线程陷入无限阻塞。
    
- 并行效率：3 个初始化任务并行执行，总耗时取决于耗时最长的任务（数据库初始化 2000ms），相比串行执行（1500+2000+1000=4500ms），大幅提升了系统启动效率。
    
- 状态可见性：通过打印计数器剩余值，清晰呈现任务执行进度，便于调试和问题定位（实际生产环境可结合日志框架输出）。
    

## 1.3 反向应用：子线程等待主线程指令

CountDownLatch 不仅能实现“主线程等待子线程”，还能通过反向设计，实现“多个子线程等待主线程发出信号后，再同时开始执行”。这种场景在并发测试中非常常用——比如我们需要模拟 100 个线程同时访问某个接口，测试接口的并发承载能力，此时就需要让所有线程先准备就绪，等待主线程发出“开始”指令，确保所有线程在同一时间点发起请求，消除线程启动顺序带来的测试误差。

### 示例代码：并发测试同步控制

```java
public class ConcurrentTestDemo {
    // 计数器初始化为1，代表主线程的"开始"信号（只有1个信号，所有子线程等待这个信号）
    private static final CountDownLatch startSignal = new CountDownLatch(1);
    // 记录并发执行结果（原子类保证线程安全，避免计数错误）
    private static final AtomicInteger result = new AtomicInteger(0);
    // 模拟需要测试的接口方法
    private static final TestService testService = new TestService();

    public static void main(String[] args) throws InterruptedException {
        int threadCount = 5; // 并发线程数（实际测试可改为100、1000）

        // 启动5个测试线程，所有线程先准备就绪
        for (int i = 0; i < threadCount; i++) {
            new Thread(() -> {
                try {
                    System.out.println(Thread.currentThread().getName() + "：准备就绪，等待主线程开始信号");
                    // 阻塞等待主线程的信号（计数器归0）
                    startSignal.await();
                    // 收到信号后，同时执行测试操作（模拟接口调用）
                    boolean success = testService.doTest();
                    if (success) {
                        result.incrementAndGet(); // 执行成功，计数+1
                    }
                    System.out.println(Thread.currentThread().getName() + "：测试执行完成，执行结果：" + success);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.err.println(Thread.currentThread().getName() + "：测试被中断");
                }
            }, "测试线程-" + i).start();
        }

        // 主线程准备3秒（确保所有测试线程都已启动并进入等待状态）
        Thread.sleep(3000);
        System.out.println("\n主线程：所有测试线程准备就绪，发出开始信号！");
        startSignal.countDown(); // 计数器归0，唤醒所有等待的测试线程

        // 等待所有测试线程完成（实际场景可再用一个CountDownLatch，更精准）
        Thread.sleep(1000);
        System.out.println("\n所有测试线程执行完成，最终执行成功次数：" + result.get()); // 预期结果为5
    }

    // 模拟测试接口服务
    static class TestService {
        // 模拟接口执行（耗时50ms）
        public boolean doTest() {
            try {
                Thread.sleep(50);
                return true; // 模拟执行成功
            } catch (InterruptedException e) {
                return false;
            }
        }
    }
}
```

### 核心价值

通过 startSignal 计数器的反向使用，确保了所有子线程在“同一时间点”开始执行测试操作，真实模拟了高并发场景下的接口访问压力，避免了因线程启动顺序不同导致的测试结果偏差（比如部分线程先执行、部分后执行，无法体现真实的并发峰值）。这种方式在性能测试、压力测试中非常实用，是并发测试的常用技巧。

# 二、Semaphore：控制资源并发访问的“信号量”

Semaphore（信号量）是另一种常用的并发工具类，其核心功能与 CountDownLatch 完全不同——它用于控制**同时访问某个资源的线程数量**，本质上是一种“资源限流”工具。Semaphore 通过维护一组“许可”（permit）来实现限流：线程需要先获取许可才能访问资源，访问结束后释放许可，供其他线程重复使用。它同样基于 AQS 共享式同步实现，许可数量对应 AQS 中的 state 变量，线程获取许可对应获取共享状态，释放许可对应释放共享状态。

## 2.1 核心原理与方法解析

Semaphore 的核心是“许可管理”，通过控制许可的数量，限制并发访问资源的线程数，核心方法如下表所示，结合实战场景说明其用法：

|方法|功能描述|实战使用场景|
|---|---|---|
|Semaphore(int permits)|构造方法，初始化许可数量（permits 为允许同时访问的线程数，≥0），默认非公平模式|无需保证线程访问顺序的场景（如普通接口限流）|
|Semaphore(int permits, boolean fair)|带公平性参数的构造方法，fair=true 时，按线程请求许可的顺序分配许可（FIFO）；fair=false 时，线程可插队获取许可|需要避免线程饥饿的场景（如核心业务线程访问资源）|
|void acquire()|获取 1 个许可，若暂时无可用许可，线程会阻塞等待，直到有许可被释放|必须获取资源才能执行的场景（如数据库连接获取）|
|boolean tryAcquire()|尝试获取 1 个许可，立即返回结果（成功返回 true，失败返回 false），不阻塞线程|非核心业务，失败可直接返回的场景（如非关键接口限流）|
|boolean tryAcquire(long timeout, TimeUnit unit)|超时尝试获取许可，在指定时间内获取到返回 true，超时未获取则返回 false，不阻塞线程|需要设置等待时限，避免线程长期阻塞的场景|
|void release()|释放 1 个许可，将其归还给信号量，供其他线程使用；可在未获取许可的情况下调用（谨慎使用）|资源使用完成后，释放许可（如数据库连接归还）|
|int availablePermits()|返回当前可用的许可数量，可用于监控资源使用情况|系统监控、日志输出，查看资源占用情况|

**关键特性（面试高频）**：与 CountDownLatch 的一次性计数器不同，Semaphore 的许可可以**重复获取和释放**，许可数量也可以通过 release() 方法动态调整（比如在未获取许可的情况下调用 release()，会增加总许可数），但这种动态调整需谨慎使用，避免导致许可数量失控。

## 2.2 典型场景：资源池的并发访问控制

在实际开发中，很多资源都是有限的——比如数据库连接池、线程池、文件句柄、网络连接等，这些资源的创建和销毁成本较高，通常会维护一个固定大小的资源池。此时，Semaphore 就可以用于限制同时访问资源池的线程数，防止因线程过多导致资源耗尽，从而避免系统崩溃或性能急剧下降。

### 实战案例：数据库连接池的并发控制

```java
public class ConnectionPoolDemo {
    // 数据库连接池大小（模拟10个可用连接）
    private static final int POOL_SIZE = 10;
    // 模拟数据库连接池（线程不安全，需加同步控制）
    private static final List<Connection> connectionPool = new ArrayList<>(POOL_SIZE);
    // 信号量控制并发访问，许可数等于连接池大小，公平模式（避免线程饥饿）
    private static final Semaphore semaphore = new Semaphore(POOL_SIZE, true);
    // 锁对象，保证连接池操作的线程安全
    private static final Object poolLock = new Object();

    // 静态初始化：初始化连接池，创建10个模拟连接
    static {
        for (int i = 0; i < POOL_SIZE; i++) {
            connectionPool.add(new MockConnection("数据库连接-" + (i + 1)));
        }
        System.out.println("数据库连接池初始化完成，总连接数：" + POOL_SIZE);
    }

    // 获取数据库连接（核心方法）
    public static Connection getConnection() throws InterruptedException {
        // 1. 获取许可（若无可用许可，线程阻塞等待）
        semaphore.acquire();
        // 2. 从连接池取出连接（同步操作，避免并发修改异常）
        synchronized (poolLock) {
            return connectionPool.remove(0);
        }
    }

    // 释放数据库连接（核心方法）
    public static void releaseConnection(Connection connection) {
        if (connection != null) {
            // 1. 将连接放回连接池（同步操作）
            synchronized (poolLock) {
                connectionPool.add(connection);
            }
            // 2. 释放许可，供其他线程使用
            semaphore.release();
        }
    }

    // 模拟数据库连接类（简化版）
    static class MockConnection {
        private String name;
        // 模拟连接是否可用
        private boolean available = true;

        MockConnection(String name) {
            this.name = name;
        }

        public String getName() {
            return name;
        }

        public boolean isAvailable() {
            return available;
        }

        public void setAvailable(boolean available) {
            this.available = available;
        }

        @Override
        public String toString() {
            return name;
        }
    }

    // 测试：模拟20个线程并发请求数据库连接
    public static void main(String[] args) {
        // 启动20个业务线程，并发获取连接
        for (int i = 0; i < 20; i++) {
            new Thread(() -> {
                Connection conn = null;
                try {
                    // 获取连接
                    conn = getConnection();
                    MockConnection mockConn = (MockConnection) conn;
                    mockConn.setAvailable(false); // 标记连接为正在使用
                    System.out.println(Thread.currentThread().getName() + " 获取到" + mockConn + 
                                       "，当前可用许可：" + semaphore.availablePermits());
                    // 模拟数据库操作（耗时1000ms）
                    Thread.sleep(1000);
                    mockConn.setAvailable(true); // 标记连接为可用
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.err.println(Thread.currentThread().getName() + " 获取连接被中断");
                } finally {
                    // 释放连接和许可
                    releaseConnection(conn);
                    if (conn != null) {
                        System.out.println(Thread.currentThread().getName() + " 释放了" + conn + 
                                           "，当前可用许可：" + semaphore.availablePermits());
                    }
                }
            }, "业务线程-" + i).start();
        }
    }
}
```

### 运行结果片段（关键流程呈现）

### 案例解析（实战重点）

- 许可与资源池匹配：Semaphore 的许可数（10）与连接池大小（10）完全一致，确保同时使用连接的线程数不超过连接池容量，避免连接耗尽。
    
- 公平模式的作用：fair=true 保证线程按请求顺序获取许可，避免某些线程长期无法获取连接（线程饥饿），适合核心业务场景；若追求更高吞吐量，可使用非公平模式（默认）。
    
- 线程安全保证：连接池的 remove 和 add 操作通过同步块（synchronized (poolLock)）实现线程安全，避免多线程并发操作导致的连接丢失或重复获取。
    
- 许可释放的必要性：release() 放在 finally 块中（间接，通过 releaseConnection 方法），确保无论数据库操作是否异常，连接都会被归还，许可都会被释放，避免许可泄漏（一旦许可泄漏，会导致可用许可越来越少，最终系统无法获取资源）。
    

## 2.3 扩展场景：接口限流与流量控制

除了资源池控制，Semaphore 另一个常用场景是**接口限流**——通过控制单位时间内的请求数，保护后端服务稳定，避免因突发高流量导致服务过载、响应变慢甚至崩溃。例如，限制某 API 每秒最多处理 100 个请求，超出部分直接拒绝或排队等待，这种限流方式简单高效，适合中小型系统的接口保护。

### 示例代码：API 接口限流实现

```java
public class ApiRateLimiter {
    private final Semaphore semaphore;
    private final int maxRequestsPerSecond; // 每秒最大请求数（限流阈值）
    private final ScheduledExecutorService scheduler; // 定时任务线程池，用于重置许可

    // 构造方法：初始化限流阈值
    public ApiRateLimiter(int maxRequestsPerSecond) {
        this.maxRequestsPerSecond = maxRequestsPerSecond;
        this.semaphore = new Semaphore(maxRequestsPerSecond);
        // 初始化定时任务线程池（单线程，避免资源浪费）
        this.scheduler = Executors.newScheduledThreadPool(1);
        // 定时任务：每秒重置许可数量（补充许可至限流阈值）
        startPermitResetTask();
    }

    // 定时任务：每秒重置许可，实现固定速率限流
    private void startPermitResetTask() {
        // 延迟1秒后，每秒执行一次
        scheduler.scheduleAtFixedRate(() -> {
            try {
                // 计算需要补充的许可数（当前可用许可与阈值的差值）
                int permitsToRelease = maxRequestsPerSecond - semaphore.availablePermits();
                if (permitsToRelease > 0) {
                    semaphore.release(permitsToRelease); // 补充许可
                    System.out.println("【限流器】补充许可：" + permitsToRelease + "，当前可用许可：" + semaphore.availablePermits());
                }
            } catch (Exception e) {
                System.err.println("【限流器】许可重置失败：" + e.getMessage());
            }
        }, 1, 1, TimeUnit.SECONDS);
    }

    // 尝试访问API（非阻塞，失败直接返回）
    public boolean tryAccess() {
        // 尝试获取1个许可，立即返回结果
        return semaphore.tryAcquire();
    }

    // 关闭限流器（释放资源）
    public void shutdown() {
        scheduler.shutdown();
    }

    // 测试：模拟高并发请求
    public static void main(String[] args) {
        // 限制每秒最多5个请求（限流阈值=5）
        ApiRateLimiter limiter = new ApiRateLimiter(5);

        // 模拟10个并发请求（超出限流阈值）
        for (int i = 0; i < 10; i++) {
            new Thread(() -> {
                String threadName = Thread.currentThread().getName();
                if (limiter.tryAccess()) {
                    System.out.println(threadName + "：API访问成功（当前时间：" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")) + "）");
                    // 模拟API处理耗时（500ms）
                    try {
                        Thread.sleep(500);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                } else {
                    System.out.println(threadName + "：API访问被限流（当前时间：" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss")) + "）");
                }
            }, "请求线程-" + i).start();
        }

        // 延迟3秒后关闭限流器
        try {
            Thread.sleep(3000);
            limiter.shutdown();
            System.out.println("\n【限流器】已关闭");
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

### 限流原理与运行结果

限流核心逻辑：通过定时任务每秒补充许可，使 Semaphore 的可用许可数始终维持在 maxRequestsPerSecond（每秒5个），从而实现“每秒最多处理5个请求”的限流效果。超出部分的请求会通过 tryAcquire() 直接返回 false，实现快速拒绝，避免阻塞线程。

注意：这种限流方式是“固定窗口限流”，存在一定的临界问题（比如每秒5个请求，前1秒的最后100ms和后1秒的前100ms，可能会有10个请求通过），但对于中小型系统的接口限流，已经足够使用；若需要更精准的限流（如滑动窗口），可结合其他工具（如 Guava 的 RateLimiter）实现。

# 三、CountDownLatch 与 Semaphore 的对比与协同

CountDownLatch 和 Semaphore 都是基于 AQS 实现的并发工具类，但它们的核心功能、使用场景完全不同，很多开发者容易混淆。下面通过对比表格清晰区分两者，同时介绍它们的协同使用方式，帮助大家在实际场景中灵活运用。

## 3.1 核心特性对比（面试高频）

|特性|CountDownLatch|Semaphore|
|---|---|---|
|核心功能|等待多个线程完成指定操作（同步协调）|控制并发访问资源的线程数（限流控制）|
|计数器/许可特性|一次性递减，归0后不可重置，无法重复使用|可重复获取和释放，许可数量可动态调整，可重复使用|
|线程协作方向|多线程→主线程（或主线程→多线程），侧重“同步等待”|线程间竞争资源，侧重“限流控制”|
|典型场景|系统初始化、并发测试同步、多任务协调|资源池控制、接口限流、流量控制|
|底层 AQS 模式|共享式同步（多个线程可同时被唤醒）|共享式同步（多个线程可同时获取许可）|
|核心关键词|等待、完成、唤醒|许可、限流、并发控制|

## 3.2 协同应用案例：分布式任务调度的“先同步、后限流”

在实际开发中，CountDownLatch 和 Semaphore 并非孤立使用，很多场景下需要两者协同，实现更复杂的线程协作逻辑。例如，在分布式任务调度系统中，我们需要先让所有任务节点（子线程）准备就绪，然后再控制同时执行任务的节点数，避免因节点过多导致系统负载过高——这就是“先同步准备，再限流执行”的典型场景，正好可以结合两者的优势实现。

### 协同逻辑说明

1. 使用 CountDownLatch 等待所有任务节点准备就绪（比如节点加载配置、连接服务、初始化任务）；
    
2. 所有节点准备完成后，主线程发出“开始执行”信号，唤醒所有节点；
    
3. 使用 Semaphore 控制同时执行任务的节点数（限流），避免节点并发过多导致资源耗尽；
    
4. 所有任务执行完成后，主线程可再次使用 CountDownLatch 等待所有节点执行完毕，汇总执行结果。
    

### 协同示例代码（简化版）

```java
public class TaskScheduleDemo {
    // 1. 用于等待所有任务节点准备就绪（假设有5个节点）
    private static final CountDownLatch readyLatch = new CountDownLatch(5);
    // 2. 用于控制同时执行任务的节点数（限流：最多3个节点同时执行）
    private static final Semaphore taskSemaphore = new Semaphore(3, true);
    // 3. 用于等待所有任务节点执行完毕
    private static final CountDownLatch finishLatch = new CountDownLatch(5);
    // 任务结果汇总
    private static final List<String> taskResults = new CopyOnWriteArrayList<>();

    public static void main(String[] args) throws InterruptedException {
        System.out.println("分布式任务调度：开始等待所有节点准备就绪...");

        // 启动5个任务节点（模拟分布式节点）
        for (int i = 0; i < 5; i++) {
            int nodeId = i + 1;
            new Thread(() -> {
                try {
                    // 模拟节点准备工作（加载配置、连接服务）
                    System.out.println("节点" + nodeId + "：开始准备...");
                    Thread.sleep(1000 + new Random().nextInt(1000)); // 模拟准备耗时差异
                    System.out.println("节点" + nodeId + "：准备就绪");
                    readyLatch.countDown(); // 准备完成，计数器递减

                    // 等待主线程发出“开始执行”信号（所有节点准备就绪后）
                    readyLatch.await();

                    // 2. 获取许可，限流执行任务（最多3个节点同时执行）
                    taskSemaphore.acquire();
                    System.out.println("节点" + nodeId + "：获取执行许可，开始执行任务");
                    // 模拟任务执行耗时
                    Thread.sleep(2000);
                    String result = "节点" + nodeId + "任务执行成功";
                    taskResults.add(result);
                    System.out.println("节点" + nodeId + "：任务执行完成，结果：" + result);
                    taskSemaphore.release(); // 释放许可

                    // 任务执行完成，通知主线程
                    finishLatch.countDown();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.err.println("节点" + nodeId + "：任务执行被中断");
                }
            }, "任务节点-" + nodeId).start();
        }

        // 主线程等待所有节点准备就绪
        readyLatch.await();
        System.out.println("\n所有任务节点准备就绪，开始执行任务（限流：最多3个节点同时执行）");

        // 主线程等待所有任务节点执行完毕
        finishLatch.await();
        System.out.println("\n所有任务节点执行完毕，汇总结果：");
        taskResults.forEach(result -> System.out.println("- " + result));
    }
}
```

### 协同价值

通过 CountDownLatch 实现“所有节点准备就绪”的同步协调，确保任务执行的一致性；通过 Semaphore 实现“并发执行节点数”的限流控制，避免系统负载过高。两者协同，既保证了任务执行的有序性，又保证了系统的稳定性，是分布式任务调度、批量任务执行等场景的常用解决方案。

# 四、总结与后续预告

CountDownLatch 和 Semaphore 是 Java 并发编程中最常用的两个工具类，它们基于 AQS 框架，封装了复杂的同步逻辑，让开发者无需深入底层，就能快速实现线程同步和资源限流。

- CountDownLatch：核心是“等待多线程完成”，通过一次性计数器实现线程间的同步协调，适合系统初始化、并发测试、多任务协同等场景；
    
- Semaphore：核心是“控制并发访问数量”，通过许可管理实现资源限流，适合资源池控制、接口限流、流量控制等场景。
    

掌握这两个工具类的核心原理和使用技巧，能显著提升并发编程的效率和可靠性，同时也是面试中的高频考点（比如两者的区别、底层实现、实战场景等）。

下一篇，我们将继续讲解并发编程常用工具类——CyclicBarrier（循环屏障）和 Phaser（阶段同步器），它们与 CountDownLatch 有相似之处，但又有独特的功能和使用场景，敬请期待！

最后，留给大家一个思考问题：CountDownLatch 和 CyclicBarrier 都能实现线程等待，它们的核心区别是什么？欢迎在评论区留言讨论～