---
title: 'Ragent项目7种设计模式深度解析:从源码看设计模式落地实践'
date: '2026-03-25'
category: reading
tags:
  - 阅读
excerpt: >-
  在复杂项目开发中，设计模式是解决共性问题、提升代码可维护性、可扩展性的核心工具。脱离业务场景的设计模式只是“纸上谈兵”，而Ragent项目中，7种设计模式的应用的则完美诠释了“模式服务于业务”的核心思...
readingTime: 48 min
---
在复杂项目开发中，设计模式是解决共性问题、提升代码可维护性、可扩展性的核心工具。脱离业务场景的设计模式只是“纸上谈兵”，而Ragent项目中，7种设计模式的应用的则完美诠释了“模式服务于业务”的核心思想——每个模式都对应具体的业务痛点，每个实现都有完整的源码支撑，可直接复用、可扩展、可测试。

本文将基于Ragent项目源码，逐一对7种设计模式的应用场景、核心实现、源码解析和落地价值进行深度拆解，带你看懂设计模式如何解决实际开发中的问题，以及如何在自己的项目中借鉴这些实践。

## 一、设计模式总览：7种模式，覆盖核心业务场景

Ragent项目中的7种设计模式，分别对应检索、回调、结果处理、组件管理等核心业务场景，每种模式都有明确的应用目标和核心价值，形成了一套完整的“模式应用体系”。先通过一张表格快速总览：

|   |   |   |   |   |
|---|---|---|---|---|
|序号|模式名称|应用场景|核心价值|核心组件|
|1|策略模式 (Strategy)|多通道检索|可插拔的检索算法，灵活切换检索方式|SearchChannel接口、多通道实现类|
|2|工厂模式 (Factory)|StreamCallback 创建|封装复杂对象创建过程，统一创建入口|StreamCallbackFactory|
|3|装饰器模式 (Decorator)|首包探测缓冲|动态增强对象功能，不修改原有代码|ProbeBufferingCallback|
|4|责任链模式 (Chain of Responsibility)|后置处理器链|按序处理请求，解耦处理器与调用者|SearchResultPostProcessor接口、多处理器实现|
|5|注册表模式 (Registry)|自动发现通道/处理器|实现插件化架构，新增组件无需修改核心代码|Spring自动注入的List<SearchChannel>|
|6|模板方法模式 (Template Method)|文本分块策略、并行检索|复用算法骨架，延迟具体实现到子类|AbstractParallelRetriever抽象类|
|7|建造者模式 (Builder)|实体对象构建|链式构造复杂对象，提升代码可读性|IntentNode、ChatRequest等带@Builder注解的实体|

这些模式并非孤立存在，在实际业务中常常组合使用，比如多通道检索模块就同时用到了注册表模式、策略模式和模板方法模式，形成了“插件化、可扩展、可复用”的检索体系。接下来，我们逐一对每种模式进行源码级解析。

## 二、策略模式：多通道检索的“可插拔”实现

### 2.1 模式核心定义

策略模式的核心是“定义一系列算法，将其封装起来，并且使它们可以相互替换”。它的核心价值在于解耦算法的定义与使用，使得算法可以独立于使用它的客户端而变化。

在Ragent项目中，多通道检索是核心业务之一——需要支持意图定向检索、向量全局检索、未来可扩展的ES关键词检索等多种检索方式，且每种检索方式的启用条件、优先级、实现逻辑都不同，这正是策略模式的典型应用场景。

### 2.2 源码解析：策略接口与实现

首先定义检索策略的统一接口`SearchChannel`，所有检索通道都需实现该接口，规范检索策略的核心方法：

```java
// bootstrap/src/main/java/com/nageoffer/ai/ragent/rag/core/retrieve/channel/SearchChannel.java
/**
 * 检索通道接口（策略接口）
 * 每个通道负责一种检索策略，统一规范检索方法
 */
public interface SearchChannel {

    /** 通道名称：用于日志和标识 */
    String getName();

    /** 通道优先级：数字越小优先级越高，用于排序执行 */
    int getPriority();

    /** 是否启用该通道：根据检索上下文动态判断 */
    boolean isEnabled(SearchContext context);

    /** 执行检索：核心策略实现方法 */
    SearchChannelResult search(SearchContext context);

    /** 通道类型：区分不同检索类型（如意图定向、向量全局） */
    SearchChannelType getType();
}
```

接口定义了检索策略的核心契约：名称、优先级、启用条件、检索逻辑和类型，确保所有检索策略都遵循统一规范。接下来，实现两种核心检索策略：

#### 2.2.1 意图定向检索策略

该策略优先级最高（priority=1），仅在有KB意图时启用，核心逻辑是根据用户意图，在指定的Collection中并行检索，提升检索精准度：

```java
// IntentDirectedSearchChannel.java
@Slf4j
@Component
public class IntentDirectedSearchChannel implements SearchChannel {

    // 注入并行检索器（后续会用到模板方法模式）
    private final ParallelRetriever parallelRetriever;

    @Override
    public String getName() {
        return "IntentDirectedSearch"; // 策略名称
    }

    @Override
    public int getPriority() {
        return 1;  // 最高优先级，优先执行
    }

    @Override
    public boolean isEnabled(SearchContext context) {
        // 策略启用条件：提取到KB意图时才启用
        List<NodeScore> kbIntents = extractKbIntents(context);
        return CollUtil.isNotEmpty(kbIntents);
    }

    @Override
    public SearchChannelResult search(SearchContext context) {
        // 1. 提取用户的KB意图（核心业务逻辑）
        List<NodeScore> kbIntents = extractKbIntents(context);

        // 2. 并行在每个意图对应的Collection中检索（复用并行检索逻辑）
        Map<String, List<RetrievedChunk>> results = 
            parallelRetriever.retrieve(kbIntents, context);

        // 3. 合并多Collection的检索结果，返回统一格式
        return mergeResults(results);
    }

    // 辅助方法：提取KB意图（省略具体实现）
    private List<NodeScore> extractKbIntents(SearchContext context) {
        // ... 从上下文提取用户意图，筛选KB相关意图
    }

    // 辅助方法：合并检索结果（省略具体实现）
    private SearchChannelResult mergeResults(Map<String, List<RetrievedChunk>> results) {
        // ... 合并、去重、排序，返回统一的SearchChannelResult
    }
}
```

#### 2.2.2 向量全局检索策略

该策略优先级较低（priority=10），在没有意图或意图置信度过低时启用，核心逻辑是在所有Collection中进行全局向量检索，确保检索的全面性：

```java
// VectorGlobalSearchChannel.java
@Slf4j
@Component
public class VectorGlobalSearchChannel implements SearchChannel {

    // 注入知识库Mapper，用于获取所有Collection
    private final KnowledgeBaseMapper knowledgeBaseMapper;
    // 意图置信度阈值：低于该阈值则启用全局检索
    private final double confidenceThreshold = 0.5;

    @Override
    public String getName() {
        return "VectorGlobalSearch";
    }

    @Override
    public int getPriority() {
        return 10;  // 较低优先级，意图检索失败后执行
    }

    @Override
    public boolean isEnabled(SearchContext context) {
        // 启用条件1：完全没有意图
        if (context.getIntents().isEmpty()) {
            return true;
        }
        // 启用条件2：所有意图的置信度都低于阈值
        double maxScore = getMaxIntentScore(context);
        return maxScore < confidenceThreshold;
    }

    @Override
    public SearchChannelResult search(SearchContext context) {
        // 核心逻辑：获取所有Collection，执行全局检索
        List<String> collections = knowledgeBaseMapper.getAllCollections();
        return parallelRetriever.retrieveAll(collections, context);
    }

    // 辅助方法：获取意图的最高置信度（省略具体实现）
    private double getMaxIntentScore(SearchContext context) {
        // ... 遍历意图列表，返回最高置信度
    }
}
```

### 2.3 策略选择与执行：多通道并行调度

策略模式的关键的是“策略选择”，Ragent项目中通过`MultiChannelRetrievalEngine`实现策略的筛选、排序和并行执行，无需手动判断使用哪种策略：

```java
// MultiChannelRetrievalEngine.java
@Service
@RequiredArgsConstructor
public class MultiChannelRetrievalEngine {

    // 注册表模式：Spring自动注入所有SearchChannel实现（后续详解）
    private final List<SearchChannel> searchChannels;
    // 线程池：用于并行执行检索通道
    private final ExecutorService ragRetrievalExecutor;

    public List<SearchChannelResult> executeSearchChannels(SearchContext context) {
        // 1. 筛选启用的通道：根据isEnabled()判断，按优先级排序
        List<SearchChannel> enabledChannels = searchChannels.stream()
                .filter(channel -> channel.isEnabled(context))
                .sorted(Comparator.comparingInt(SearchChannel::getPriority))
                .toList();

        // 2. 并行执行所有启用的通道：提升检索效率
        List<CompletableFuture<SearchChannelResult>> futures = enabledChannels.stream()
                .map(channel -> CompletableFuture.supplyAsync(
                        () -> channel.search(context),  // 执行具体策略
                        ragRetrievalExecutor
                ))
                .toList();

        // 3. 等待所有并行任务完成，返回结果列表
        return futures.stream()
                .map(CompletableFuture::join)
                .toList();
    }
}
```

### 2.4 策略模式的落地价值

结合Ragent的源码实践，策略模式带来了4个核心价值，完美解决了多通道检索的痛点：

- 可扩展性：新增检索策略（如ES关键词检索），只需实现`SearchChannel`接口，添加`@Component`注解，无需修改核心调度代码，实现“插件化”扩展。
    
- 可配置性：每个策略通过`isEnabled()`方法动态控制启用状态，通过`getPriority()`控制执行顺序，灵活适配不同业务场景。
    
- 可测试性：每个检索策略独立封装，可单独编写单元测试，无需依赖其他策略，降低测试难度。
    
- 解耦性：检索策略的实现与调度逻辑分离，调度器（MultiChannelRetrievalEngine）只需依赖`SearchChannel`接口，无需关心具体策略的实现细节。
    

## 三、工厂模式：复杂对象创建的“封装者”

### 3.1 模式核心定义

工厂模式的核心是“封装对象的创建过程，根据参数决定创建哪种类型的对象”。当一个对象的创建过程复杂（依赖多、参数多）时，工厂模式可以隐藏创建细节，提供统一的创建入口，降低客户端的使用成本。

在Ragent项目中，`StreamCallback`（流式回调）的创建过程非常复杂，需要依赖多个服务（会话记忆、任务管理等）和配置，因此使用工厂模式封装其创建逻辑。

### 3.2 源码解析：StreamCallback工厂

首先，`StreamChatEventHandler`（`StreamCallback`的具体实现）的构造需要7个依赖参数，直接在客户端创建会导致代码冗余、耦合度高，因此创建`StreamCallbackFactory`统一封装创建过程：

```java
// bootstrap/src/main/java/com/nageoffer/ai/ragent/rag/service/handler/StreamCallbackFactory.java
@Component
@RequiredArgsConstructor
public class StreamCallbackFactory {

    // 依赖的服务和配置（共6个，创建复杂）
    private final AIModelProperties modelProperties;
    private final ConversationMemoryService memoryService;
    private final ConversationGroupService conversationGroupService;
    private final StreamTaskManager taskManager;

    /**
     * 工厂核心方法：创建聊天事件处理器（StreamCallback）
     * 客户端只需传入3个关键参数，无需关心内部依赖
     */
    public StreamCallback createChatEventHandler(SseEmitter emitter,
                                                 String conversationId,
                                                 String taskId) {
        // 1. 使用建造者模式构建参数对象（后续详解建造者模式）
        StreamChatHandlerParams params = StreamChatHandlerParams.builder()
                .emitter(emitter)
                .conversationId(conversationId)
                .taskId(taskId)
                .modelProperties(modelProperties)
                .memoryService(memoryService)
                .conversationGroupService(conversationGroupService)
                .taskManager(taskManager)
                .build();

        // 2. 封装创建逻辑，返回具体的StreamCallback实现
        return new StreamChatEventHandler(params);
    }
}
```

### 3.3 工厂模式的使用场景

客户端（如`RAGChatController`）在需要创建`StreamCallback`时，只需调用工厂的方法，传入必要参数即可，无需关心内部依赖的注入和参数的组装：

```java
// RAGChatController.java
@RestController
@RequestMapping("/rag")
@RequiredArgsConstructor
public class RAGChatController {

    private final StreamCallbackFactory streamCallbackFactory;
    private final LLMService llmService;

    // 流式聊天接口
    @GetMapping(value = "/v3/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@RequestParam String question,
                          @RequestParam(required = false) String conversationId) {
        // 1. 创建SseEmitter（服务端向客户端推送流数据）
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L); // 30分钟超时
        // 2. 生成任务ID（用于任务管理）
        String taskId = UUID.randomUUID().toString();
        // 3. 通过工厂创建StreamCallback，无需关心内部依赖
        StreamCallback callback = streamCallbackFactory.createChatEventHandler(
                emitter, conversationId, taskId
        );

        // 4. 发起流式请求，传入回调
        ChatRequest request = ChatRequest.builder().question(question).build();
        llmService.streamChat(request, callback);

        return emitter;
    }
}
```

### 3.4 工厂模式的落地价值

- 封装复杂性：隐藏`StreamChatEventHandler`的复杂创建过程，客户端无需关心其依赖的6个服务，只需传入3个关键参数，降低使用成本。
    
- 统一创建入口：所有`StreamCallback`都通过工厂创建，便于后续统一修改创建逻辑（如新增依赖、调整参数），无需修改所有客户端代码。
    
- 易于扩展：如果后续需要创建其他类型的`StreamCallback`（如日志回调、统计回调），只需在工厂中新增方法，客户端无需改动，符合“开闭原则”。
    

## 四、装饰器模式：动态增强对象功能的“魔法”

### 4.1 模式核心定义

装饰器模式的核心是“动态地给对象添加一些额外的职责，比继承更灵活”。它通过“包装”原有对象，在不修改原有对象代码的前提下，增强其功能，且可以叠加多个装饰器，实现功能的组合。

在Ragent项目中，流式调用的首包探测场景需要增强`StreamCallback`的功能——在首包探测阶段，缓存所有输出事件，避免失败模型的内容污染下游输出；首包成功后，再回放缓存的事件，这正是装饰器模式的典型应用。

### 4.2 源码解析：首包探测缓冲装饰器

Ragent项目中，`ProbeBufferingCallback`作为装饰器，包装了原始的`StreamCallback`，新增了“首包探测”和“事件缓冲”功能，且不修改原始回调的代码：

```java
// RoutingLLMService.java 内部类（装饰器实现）
/**
 * 探测缓冲回调（装饰器）
 * 核心功能：
 * 1. 首包探测阶段：缓存所有事件，避免失败模型的内容污染下游
 * 2. 首包成功后：commit() 回放缓存，转实时转发
 */
private static final class ProbeBufferingCallback implements StreamCallback {

    private final StreamCallback downstream;    // 被装饰的原始回调（核心对象）
    private final FirstPacketAwaiter awaiter;   // 首包探测器（新增功能依赖）
    private final List<BufferedEvent> bufferedEvents = new ArrayList<>(); // 事件缓存
    private volatile boolean committed;         // 标记是否已提交（首包是否成功）
    private final Object lock = new Object();   // 线程安全锁

    // 构造方法：传入被装饰的原始回调和探测器
    ProbeBufferingCallback(StreamCallback downstream, FirstPacketAwaiter awaiter) {
        this.downstream = downstream;  // 保存原有回调，后续委托调用
        this.awaiter = awaiter;
        this.committed = false;
    }

    // 增强onContent方法：缓存或转发内容
    @Override
    public void onContent(String content) {
        awaiter.markContent();  // 新增功能：标记收到首包内容
        bufferOrDispatch(BufferedEvent.content(content)); // 缓存或转发
    }

    // 增强onThinking方法：缓存或转发思考过程
    @Override
    public void onThinking(String content) {
        awaiter.markContent();
        bufferOrDispatch(BufferedEvent.thinking(content));
    }

    // 增强onComplete方法：缓存或转发完成事件
    @Override
    public void onComplete() {
        awaiter.markComplete();
        bufferOrDispatch(BufferedEvent.complete());
    }

    // 核心逻辑：判断是缓存事件还是直接转发
    private void bufferOrDispatch(BufferedEvent event) {
        synchronized (lock) {
            if (committed) {
                // 首包成功，已提交：直接转发给下游（委托原始回调）
                dispatch(event);
            } else {
                // 首包未成功：缓存事件，避免污染下游
                bufferedEvents.add(event);
            }
        }
    }

    // 新增方法：首包成功后，回放缓存的事件
    void commit() {
        synchronized (lock) {
            committed = true;
            // 按顺序回放缓存的事件，转发给下游
            for (BufferedEvent event : bufferedEvents) {
                dispatch(event);
            }
            bufferedEvents.clear(); // 清空缓存，释放资源
        }
    }

    // 辅助方法：转发事件到原始回调
    private void dispatch(BufferedEvent event) {
        switch (event.type) {
            case CONTENT -> downstream.onContent(event.content);
            case THINKING -> downstream.onThinking(event.content);
            case COMPLETE -> downstream.onComplete();
        }
    }

    // 内部类：封装缓冲的事件（内容、思考、完成）
    private static class BufferedEvent {
        private final Type type;
        private final String content;

        private BufferedEvent(Type type, String content) {
            this.type = type;
            this.content = content;
        }

        public static BufferedEvent content(String content) {
            return new BufferedEvent(Type.CONTENT, content);
        }

        public static BufferedEvent thinking(String content) {
            return new BufferedEvent(Type.THINKING, content);
        }

        public static BufferedEvent complete() {
            return new BufferedEvent(Type.COMPLETE, null);
        }

        private enum Type { CONTENT, THINKING, COMPLETE }
    }
}
```

### 4.3 装饰器模式的使用场景

在`RoutingLLMService`的流式调用方法中，使用`ProbeBufferingCallback`包装原始`StreamCallback`，实现首包探测和事件缓冲功能：

```java
// RoutingLLMService.streamChat()
@Override
public StreamCancellationHandle streamChat(ChatRequest request, StreamCallback callback) {
    // 1. 获取候选模型列表（策略模式+注册表模式）
    List<ModelTarget> targets = selector.selectChatCandidates(request.getThinking());
    if (CollUtil.isEmpty(targets)) {
        throw new RemoteException("无可用模型");
    }

    // 2. 遍历候选模型，尝试流式调用
    for (ModelTarget target : targets) {
        ChatClient client = resolveClient(target);
        if (client == null) continue;

        // 3. 创建首包探测器
        FirstPacketAwaiter awaiter = new FirstPacketAwaiter();
        
        // 4. 用装饰器包装原始回调：增强首包探测和缓冲功能
        ProbeBufferingCallback wrapper = new ProbeBufferingCallback(callback, awaiter);
        
        // 5. 发起流式请求，传入装饰后的回调
        StreamCancellationHandle handle = client.streamChat(request, wrapper, target);
        
        // 6. 等待首包（60秒超时）
        FirstPacketAwaiter.Result result = awaiter.await(60, TimeUnit.SECONDS);
        
        if (result.isSuccess()) {
            wrapper.commit();  // 首包成功，回放缓存事件
            return handle;     // 返回调用句柄，后续内容实时转发
        }
        
        // 首包失败：取消请求，缓存的事件被丢弃（未commit）
        handle.cancel();
        healthStore.markFailure(target.id()); // 标记模型失败
    }

    // 所有模型都失败，抛出异常
    throw new RemoteException("所有模型调用失败");
}
```

### 4.4 装饰器模式的落地价值

- 动态增强：在运行时给`StreamCallback`新增首包探测和事件缓冲功能，无需修改原始回调的代码，符合“开闭原则”。
    
- 无侵入性：装饰器通过“委托”方式调用原始对象的方法，不改变原始对象的结构和逻辑，降低耦合度。
    
- 可叠加性：如果后续需要新增其他功能（如日志记录、耗时统计），只需再创建一个装饰器，包装在`ProbeBufferingCallback`外层，实现功能组合。
    
- 失败保护：首包探测失败时，缓存的事件不会被转发，避免失败模型的错误内容污染下游，提升用户体验。
    

## 五、责任链模式：后置处理器的“按序执行”机制

### 5.1 模式核心定义

责任链模式的核心是“将请求沿着处理者链传递，直到有一个处理者处理它”。它的核心价值是解耦请求的发送者和处理者，让多个处理者可以按顺序处理请求，且可以灵活调整处理者的顺序和数量。

在Ragent项目中，多通道检索的结果需要经过一系列后处理（去重、排序、过滤等），每个处理步骤独立，且需要按顺序执行，这正是责任链模式的应用场景。

### 5.2 源码解析：处理器接口与实现

首先定义后置处理器的统一接口`SearchResultPostProcessor`，规范处理方法和排序规则：

```java
// bootstrap/src/main/java/com/nageoffer/ai/ragent/rag/core/retrieve/postprocessor/SearchResultPostProcessor.java
/**
 * 检索结果后置处理器接口（责任链节点接口）
 * 对多通道检索结果进行统一后处理，如去重、排序、过滤等
 */
public interface SearchResultPostProcessor {

    /** 处理器名称：用于日志和标识 */
    String getName();

    /** 处理器优先级：数字越小越先执行，用于排序形成责任链 */
    int getOrder();

    /** 是否启用该处理器：根据检索上下文动态判断 */
    boolean isEnabled(SearchContext context);

    /**
     * 核心处理方法：接收上一个处理器的输出，处理后传递给下一个处理器
     * @param chunks  当前的Chunk列表（上一个处理器的输出）
     * @param results 原始的多通道检索结果
     * @param context 检索上下文
     * @return 处理后的Chunk列表（传递给下一个处理器）
     */
    List<RetrievedChunk> process(List<RetrievedChunk> chunks,
                                 List<SearchChannelResult> results,
                                 SearchContext context);
}
```

接口定义了责任链节点的核心契约：名称、执行顺序、启用条件和处理逻辑，确保每个处理器都遵循统一规范。接下来，实现两个核心处理器：

#### 5.2.1 去重处理器（第一个执行）

该处理器优先级最高（order=1），负责去除检索结果中完全相同的Chunk，避免重复内容影响后续处理：

```java
// DeduplicationPostProcessor.java
@Slf4j
@Component
public class DeduplicationPostProcessor implements SearchResultPostProcessor {

    @Override
    public String getName() {
        return "Deduplication"; // 处理器名称：去重
    }

    @Override
    public int getOrder() {
        return 1;  // 第一个执行，先去重再进行其他处理
    }

    @Override
    public boolean isEnabled(SearchContext context) {
        return true;  // 始终启用，所有检索结果都需要去重
    }

    @Override
    public List<RetrievedChunk> process(List<RetrievedChunk> chunks,
                                        List<SearchChannelResult> results,
                                        SearchContext context) {
        // 核心逻辑：去除完全相同的Chunk（依赖RetrievedChunk的equals和hashCode方法）
        int beforeSize = chunks.size();
        List<RetrievedChunk> deduplicatedChunks = chunks.stream()
                .distinct()
                .collect(Collectors.toList());
        log.info("去重处理器完成 - 输入：{}个Chunk，输出：{}个Chunk", beforeSize, deduplicatedChunks.size());
        return deduplicatedChunks;
    }
}
```

#### 5.2.2 Rerank排序处理器（最后执行）

该处理器优先级较低（order=10），负责对去重后的Chunk进行相关性重新排序，提升检索结果的精准度：

```java
// RerankPostProcessor.java
@Slf4j
@Component
@RequiredArgsConstructor
public class RerankPostProcessor implements SearchResultPostProcessor {

    private final RerankService rerankService; // 注入Rerank排序服务

    @Override
    public String getName() {
        return "Rerank"; // 处理器名称：重新排序
    }

    @Override
    public int getOrder() {
        return 10;  // 最后执行，排序是最终处理步骤
    }

    @Override
    public boolean isEnabled(SearchContext context) {
        return true;  // 始终启用，所有检索结果都需要排序
    }

    @Override
    public List<RetrievedChunk> process(List<RetrievedChunk> chunks,
                                        List<SearchChannelResult> results,
                                        SearchContext context) {
        if (chunks.isEmpty()) {
            log.info("Rerank处理器：输入Chunk为空，直接返回");
            return chunks;
        }

        // 核心逻辑：调用Rerank模型，根据用户问题重新排序
        List<RetrievedChunk> rerankedChunks = rerankService.rerank(
                context.getMainQuestion(),  // 用户主问题
                chunks,                     // 去重后的Chunk列表
                context.getTopK()           // 需要返回的TopK数量
        );
        log.info("Rerank处理器完成 - 排序后Chunk数量：{}", rerankedChunks.size());
        return rerankedChunks;
    }
}
```

### 5.3 责任链执行：按序传递处理

在`MultiChannelRetrievalEngine`中，将所有启用的处理器按优先级排序，形成责任链，依次执行处理逻辑，将上一个处理器的输出作为下一个处理器的输入：

```java
// MultiChannelRetrievalEngine.java
@Service
@RequiredArgsConstructor
public class MultiChannelRetrievalEngine {

    // 注册表模式：Spring自动注入所有后置处理器
    private final List<SearchResultPostProcessor> postProcessors;

    /**
     * 执行后置处理器链：按order排序，依次处理检索结果
     */
    private List<RetrievedChunk> executePostProcessors(
            List<SearchChannelResult> results,
            SearchContext context) {
        
        // 1. 初始Chunk列表：合并所有检索通道的结果
        List<RetrievedChunk> chunks = results.stream()
                .flatMap(r -> r.getChunks().stream())
                .collect(Collectors.toList());
        log.info("后置处理器链开始 - 初始Chunk数量：{}", chunks.size());

        // 2. 筛选启用的处理器，按order排序，形成责任链
        List<SearchResultPostProcessor> enabledProcessors = postProcessors.stream()
                .filter(processor -> processor.isEnabled(context))
                .sorted(Comparator.comparingInt(SearchResultPostProcessor::getOrder))
                .toList();

        // 3. 执行责任链：依次处理，传递结果
        for (SearchResultPostProcessor processor : enabledProcessors) {
            int beforeSize = chunks.size();
            // 上一个处理器的输出 → 当前处理器的输入
            chunks = processor.process(chunks, results, context);
            int afterSize = chunks.size();
            log.info("处理器 {} 完成 - 输入：{}，输出：{}",
                    processor.getName(), beforeSize, afterSize);
        }

        return chunks;
    }
}
```

### 5.4 责任链模式的落地价值

- 解耦性：每个处理器独立封装，只关注自己的处理逻辑，不关心上一个处理器的输入和下一个处理器的输出，解耦处理器与调用者。
    
- 灵活性：可以随时新增、删除处理器，或调整处理器的执行顺序（修改order值），无需修改核心执行代码。
    
- 可扩展性：新增后处理逻辑（如关键词过滤、权限校验），只需实现`SearchResultPostProcessor`接口，添加`@Component`注解，即可自动加入责任链。
    
- 可测试性：每个处理器独立，可单独编写单元测试，验证其处理逻辑的正确性，降低测试难度。
    

## 六、注册表模式：组件自动发现的“插件化”基石

### 6.1 模式核心定义

注册表模式的核心是“通过注册表自动收集和存储组件实例，便于查找和使用”。它的核心价值是实现组件的自动发现和管理，无需手动注册组件，降低组件集成的成本，实现插件化架构。

在Ragent项目中，检索通道（SearchChannel）和后置处理器（SearchResultPostProcessor）的数量可能会不断扩展，手动注册每个组件会导致代码冗余、维护成本高，因此使用注册表模式，借助Spring的自动注入功能，实现组件的自动发现。

### 6.2 源码解析：Spring自动注入实现注册表

Ragent项目中，注册表模式的实现非常简洁，借助Spring的`@Component`注解和`List`注入功能，自动收集所有实现了指定接口的组件，形成注册表：

```java
// MultiChannelRetrievalEngine.java
@Service
@RequiredArgsConstructor
public class MultiChannelRetrievalEngine {

    // 注册表模式核心：Spring自动注入所有SearchChannel实现
    // 相当于一个“检索通道注册表”，新增通道无需手动注册
    private final List<SearchChannel> searchChannels;
    
    // 注册表模式核心：Spring自动注入所有SearchResultPostProcessor实现
    // 相当于一个“后置处理器注册表”，新增处理器无需手动注册
    private final List<SearchResultPostProcessor> postProcessors;
    
    // ... 其他方法（策略选择、责任链执行等）
}
```

### 6.3 原理揭秘：Spring如何实现自动注册

注册表模式的实现依赖Spring的组件扫描和依赖注入机制，具体流程如下：

1. Spring启动时，会扫描项目中所有带有`@Component`（及其衍生注解，如`@Service`、`@Controller`）的类。
    
2. 对于实现了`SearchChannel`接口的类（如`IntentDirectedSearchChannel`、`VectorGlobalSearchChannel`），Spring会自动创建其实例，并将所有实例收集到`List<SearchChannel>`中。
    
3. `MultiChannelRetrievalEngine`通过构造方法注入`List<SearchChannel>`，即可获取所有检索通道实例，无需手动注册任何通道。
    
4. 新增检索通道时，只需创建类实现`SearchChannel`接口，添加`@Component`注解，Spring会自动将其加入注册表，`MultiChannelRetrievalEngine`无需任何修改。
    

### 6.4 扩展示例：新增ES检索通道

借助注册表模式，新增一个ES关键词检索通道，只需3步，无需修改核心代码：

```java
// ESSearchChannel.java
@Component  // 1. 添加@Component注解，Spring自动扫描注册
public class ESSearchChannel implements SearchChannel {  // 2. 实现SearchChannel接口

    // 注入ES客户端（省略）
    private final RestHighLevelClient esClient;

    @Override
    public String getName() {
        return "ElasticsearchKeywordSearch";
    }

    @Override
    public int getPriority() {
        return 5;  // 优先级介于意图检索和全局检索之间
    }

    @Override
    public boolean isEnabled(SearchContext context) {
        // 自定义启用条件：配置启用且问题包含关键词
        return properties.isEsSearchEnabled() 
            && containsKeyword(context.getMainQuestion());
    }

    @Override
    public SearchChannelResult search(SearchContext context) {
        // 3. 实现ES关键词检索逻辑（省略）
        return esClient.search(context.getMainQuestion(), context.getTopK());
    }

    // 辅助方法：判断问题是否包含关键词（省略）
    private boolean containsKeyword(String question) {
        // ...
    }
}
```

运行结果：Spring启动时，会自动将`ESSearchChannel`实例加入`List<SearchChannel>`，`MultiChannelRetrievalEngine`会自动筛选、排序并执行该通道，无需修改任何核心代码。

### 6.5 注册表模式的落地价值

- 插件化架构：新增组件（检索通道、处理器）只需实现接口、添加注解，无需修改核心代码，实现“即插即用”。
    
- 自动管理：Spring自动完成组件的创建、注入和管理，减少手动注册的冗余代码，降低维护成本。
    
- 动态发现：运行时可以根据配置启用/禁用组件，组件的新增、删除不影响核心逻辑，提升系统的可扩展性。
    
- 降低耦合：核心模块（如MultiChannelRetrievalEngine）无需依赖具体的组件实现，只需依赖接口，降低耦合度。
    

## 七、模板方法模式：算法骨架复用的“高效工具”

### 7.1 模式核心定义

模板方法模式的核心是“定义算法骨架，将某些步骤延迟到子类中实现”。它的核心价值是复用算法的公共逻辑，将可变的具体实现延迟到子类，提升代码复用性，同时保证算法的结构一致。

在Ragent项目中，并行检索是一个通用场景——无论是意图定向检索，还是集合并行检索，其核心流程（获取目标、并行执行、合并结果）都是相同的，只有“获取目标”和“单个目标检索”这两个步骤不同，因此使用模板方法模式封装公共逻辑。

### 7.2 源码解析：抽象模板类

定义抽象基类`AbstractParallelRetriever`，封装并行检索的核心骨架（模板方法），将可变步骤定义为抽象方法，延迟到子类实现：

```java
// bootstrap/src/main/java/com/nageoffer/ai/ragent/rag/core/retrieve/channel/strategy/AbstractParallelRetriever.java
/**
 * 并行检索器抽象基类（模板类）
 * 定义并行检索的完整算法骨架，可变步骤延迟到子类实现
 */
public abstract class AbstractParallelRetriever {

    // 公共依赖：检索服务和线程池（所有子类共享）
    private final RetrieverService retrieverService;
    private final Executor executor;

    // 构造方法：注入公共依赖（子类通过super调用）
    public AbstractParallelRetriever(RetrieverService retrieverService, Executor executor) {
        this.retrieverService = retrieverService;
        this.executor = executor;
    }

    /**
     * 模板方法：定义并行检索的完整流程（算法骨架）
     * 步骤固定：获取目标 → 并行执行 → 合并结果
     */
    public Map<String, List<RetrievedChunk>> retrieve(SearchContext context) {
        // Step 1: 获取要检索的目标（可变步骤，子类实现）
        List<String> targets = getTargets(context);
        
        if (targets.isEmpty()) {
            log.info("并行检索：无检索目标，返回空结果");
            return Map.of();
```

## 📚 相关源码文件

| 模式 | 文件路径 |
|------|----------|
| 策略模式 | `rag/core/retrieve/channel/SearchChannel.java` |
| 策略模式 | `rag/core/retrieve/channel/IntentDirectedSearchChannel.java` |
| 工厂模式 | `rag/service/handler/StreamCallbackFactory.java` |
| 装饰器模式 | `infra-ai/.../chat/RoutingLLMService.java` (内部类) |
| 责任链模式 | `rag/core/retrieve/postprocessor/SearchResultPostProcessor.java` |
| 注册表模式 | `rag/core/retrieve/MultiChannelRetrievalEngine.java` |
| 模板方法 | `rag/core/retrieve/channel/strategy/AbstractParallelRetriever.java` |
| 建造者模式 | `rag/core/intent/IntentNode.java` |
