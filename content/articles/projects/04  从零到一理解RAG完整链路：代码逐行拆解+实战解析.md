---
title: '从零到一理解RAG完整链路:代码逐行拆解+实战解析'
date: '2026-03-24'
category: reading
tags:
  - 阅读
excerpt: >-
  在大模型应用爆发的当下，RAG（Retrieval-Augmented
  Generation，检索增强生成）早已不是陌生概念——它解决了大模型“知识过期”“幻觉生成”的核心痛点，让AI能基于实时、精准...
readingTime: 34 min
---

在大模型应用爆发的当下，RAG（Retrieval-Augmented Generation，检索增强生成）早已不是陌生概念——它解决了大模型“知识过期”“幻觉生成”的核心痛点，让AI能基于实时、精准的知识库内容生成回答，广泛应用于智能客服、文档问答、企业知识库等场景。

但很多开发者面对RAG代码时，常常陷入“看得懂单个接口，却串不起完整链路”的困境：为什么要分8个步骤？每段代码在链路中承担什么角色？异步处理、流式输出这些细节到底有什么用？

今天，我们就用最通俗的类比、最细致的代码拆解，带你吃透RAG完整链路，从问题接收到底层输出，每一行代码的作用都讲得明明白白，还会补充实战中的扩展技巧，帮你真正把RAG落地到项目中。

## 一、先搞懂：RAG到底是什么

很多教程一上来就讲代码，容易让人懵圈。其实RAG的核心逻辑特别简单，用两个生活场景就能讲透：

场景1：去图书馆找资料。你想写一篇关于“年假政策”的文章，第一步是去书架上找到相关的书籍、章节（这就是「检索」）；第二步是读完这些内容，用自己的话总结出答案（这就是「生成」）。RAG的本质，就是让AI模仿这个过程，避免“凭记忆答题”（也就是大模型的幻觉）。

场景2：点外卖。这个类比更贴合代码链路，我们可以把RAG的8个步骤对应成点外卖的全流程，先建立整体认知：

```plain
用户下单（提问）→ 商家接单（系统接收问题）→ 骑手取餐（加载对话历史）→ 厨房备菜（问题重写、改写）→ 按菜单炒菜（意图识别）→ 多路送餐（多通道检索）→ 装盘打包（Prompt 构建）→ 骑手送餐（LLM 生成）→ 送到你手上（流式输出）
```

记住这个类比，后续拆解代码时，你就能快速对应到每个步骤的核心作用。先明确核心公式：**RAG = Retrieval（检索）+ Augmented（增强）+ Generation（生成）**——检索是基础，增强是核心，生成是结果。

## 二、RAG完整链路代码拆解

本次拆解基于Java语言（Spring Boot框架），代码是企业级实战版本，包含异步处理、流式输出、故障转移等生产环境必备特性。每个阶段我们遵循「是什么→生活类比→代码逐行解释→扩展补充」的逻辑，确保你不仅懂“代码写了什么”，还懂“为什么这么写”。

### 阶段1：问题接收（入口层）—— 商家接单，建立连接

#### 👉 这是什么？

用户请求的入口，系统接收用户问题，并建立流式传输连接，确保后续回答能实时推送给用户（避免用户长时间等待）。

#### 👉 代码

```java
@GetMapping(value = "/rag/v3/chat", produces = "text/event-stream;charset=UTF-8")
public SseEmitter chat(@RequestParam String question,
                       @RequestParam(required = false) String conversationId,
                       @RequestParam(required = false, defaultValue = "false") Boolean deepThinking) {
    SseEmitter emitter = new SseEmitter(0L);
    ragChatService.streamChat(question, conversationId, deepThinking, emitter);
    return emitter;
}
```

用表格清晰拆解每段代码的作用：

| 代码部分                           | 详细解释                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| @GetMapping                    | 定义GET请求接口，访问地址为`/rag/v3/chat`，是用户提问的入口                                                 |
| produces = "text/event-stream" | **核心关键**：采用SSE（Server-Sent Events）协议，实现“服务器向客户端实时推送数据”，也就是我们常说的“流式输出”，避免一次性返回完整回答导致的等待 |
| String question                | 用户的提问内容，必填参数（比如“入职不满一年有年假吗？”）                                                          |
| String conversationId          | 会话ID，可选参数。新对话可不传，继续对话时传入之前的ID，用于加载历史记录（比如用户追问“那年假怎么申请？”，需要关联上一轮对话）                     |
| Boolean deepThinking           | 是否开启深度思考模式（类似o1模型的推理能力），默认关闭，开启后会调用更擅长推理的模型，适合复杂问题                                     |
| new SseEmitter(0L)             | 创建SSE连接，0L表示连接永不超时（生产环境可根据需求设置超时时间，比如300000L=5分钟）                                      |
| ragChatService.streamChat(...) | 调用服务层方法，传入用户问题、会话ID、深度思考开关和SSE连接，开始处理整个RAG链路                                           |
| return emitter                 | 返回SSE连接，Spring框架会自动维护这个连接，后续有数据就实时推送给客户端                                               |

#### 👉 类比理解

就像打电话：SSE连接就是“电话线路”，streamChat就是“开始通话”，流式输出就是“对方说话你实时听到”，而不是等对方把所有话都说完再一次性听。

### 阶段2：会话记忆补全——骑手取餐，回顾过往

#### 👉 这是什么？

加载用户之前的对话历史，让AI知道上下文，避免“答非所问”。比如用户先问“年假有多少天”，再问“怎么申请”，AI需要知道上一轮问的是年假，才能准确回答申请流程。

#### 👉 生活类比

你找客服投诉：“上次你们说3天内处理，但已经5天了还没处理”。客服需要先查看你之前的投诉记录（对话历史），才能理解你现在的诉求——这就是会话记忆的作用。

#### 👉 代码

```java
public List<ChatMessage> load(String conversationId, String userId) {
    // 步骤1：并行加载摘要和历史记录
    CompletableFuture<ChatMessage> summaryFuture = CompletableFuture.supplyAsync(
            () -> loadSummaryWithFallback(conversationId, userId)
    );
    CompletableFuture<List<ChatMessage>> historyFuture = CompletableFuture.supplyAsync(
            () -> loadHistoryWithFallback(conversationId, userId)
    );

    // 步骤2：等待所有任务完成后合并结果
    return CompletableFuture.allOf(summaryFuture, historyFuture)
            .thenApply(v -> {
                ChatMessage summary = summaryFuture.join();  // 获取摘要
                List<ChatMessage> history = historyFuture.join();  // 获取历史
                return attachSummary(summary, history);  // 合并在一起
            })
            .join();  // 等待所有任务完成
}
```

|代码部分|详细解释|
|---|---|
|CompletableFuture|Java中的异步任务容器，相当于“同时派两个骑手去取货”，不用等一个完成再去做另一个，提升效率|
|summaryFuture|“骑手1”：加载对话摘要（当对话很长时，会将历史压缩成摘要，避免历史记录过多导致模型上下文溢出）|
|historyFuture|“骑手2”：加载完整的对话历史记录（近期的对话，未被压缩的内容）|
|supplyAsync|异步执行任务，两个加载操作同时进行，不用串行等待|
|CompletableFuture.allOf(...)|等待两个异步任务（加载摘要、加载历史）都完成，相当于“等两个骑手都回来”|
|thenApply|任务完成后，执行合并操作，将摘要和历史记录整合在一起|
|summaryFuture.join() / historyFuture.join()|获取两个异步任务的执行结果（摘要和历史记录）|
|attachSummary(...)|将摘要放在历史记录的前面，确保模型先看到整体摘要，再看详细历史，避免上下文混乱|

#### 👉 关键优势：并行加载的意义

为什么要并行加载摘要和历史？看一组对比就懂了：

- 串行加载（慢）：加载摘要2秒 → 加载历史3秒 → 总计5秒
    
- 并行加载（快）：加载摘要2秒（同时加载历史3秒） → 总计3秒
    

生产环境中，对话历史可能很多，并行加载能显著提升响应速度，改善用户体验。

#### 👉 实战扩展

可给异步任务指定专用线程池（比如intentClassifyExecutor），避免占用主线程；同时添加降级策略（loadSummaryWithFallback中的Fallback），当加载摘要失败时，直接加载历史记录，避免整个链路中断。

### 阶段3：问题重写——厨房备菜，规范问题

#### 👉 这是什么？

用户的提问往往是口语化、模糊的（比如“咋整”“怎么弄”），直接用于检索会导致“搜不到相关内容”。问题重写就是把口语化问题，改写成更适合检索的“标准问题”，同时拆分复杂问题（比如“请假和出差有什么区别”拆成两个子问题）。
#### 👉 生活类比

你问朋友：“那个...就是...上次说的那个...怎么弄来着？” 朋友帮你重写：“你问的是上周提到的报销流程怎么申请。” —— 朋友的作用，就是“问题重写”。

#### 👉 代码

```java
public RewriteResult rewriteWithSplit(String userQuestion, List<ChatMessage> history) {
    // 步骤1：检查是否启用了 LLM 重写
    if (!ragConfigProperties.getQueryRewriteEnabled()) {
        // 如果没启用，就用简单的规则处理
        String normalized = queryTermMappingService.normalize(userQuestion);
        List<String> subs = ruleBasedSplit(normalized);
        return new RewriteResult(normalized, subs);
    }

    // 步骤2：使用 LLM 进行智能重写
    String normalizedQuestion = queryTermMappingService.normalize(userQuestion);
    return callLLMRewriteAndSplit(normalizedQuestion, userQuestion, history);
}
```

|代码部分|详细解释|
|---|---|
|queryRewriteEnabled|配置开关，控制是否启用AI（LLM）重写。开发环境可关闭，用简单规则测试；生产环境开启，提升重写效果|
|queryTermMappingService.normalize|术语归一化，把口语化词汇转换成标准词汇（比如“咋整”→“怎么办”“医保咋用”→“医保卡使用”）|
|ruleBasedSplit|基于规则的拆分（比如按标点、“和”“或”等连词拆分），比如“请假和出差有什么区别”拆成“请假制度规定”“出差管理规范”|
|RewriteResult|重写结果对象，包含“改写后的标准问题”和“拆分后的子问题”，供后续意图识别和检索使用|
|callLLMRewriteAndSplit|调用大模型进行智能重写和拆分，结合对话历史，让重写更精准（比如用户之前问过“年假”，现在说“怎么休”，会重写成“年假怎么休”）|

#### 👉 实际效果示例

|用户原始问题|改写后的标准问题|拆分的子问题|
|---|---|---|
|“医保怎么用”|“医保卡的使用方法和报销流程”|["医保卡的使用方法", "医保报销流程"]|
|“报销咋整”|“公司费用报销申请流程”|["公司费用报销申请流程"]|
|“请假和出差有什么区别”|“请假制度和出差规定的区别”|["请假制度规定", "出差管理规范"]|

#### 👉 实战扩展

可维护一个“术语映射表”，把常见的口语化词汇、简称（比如“年假”→“年休假”“OA”→“办公自动化系统”）统一映射，提升归一化效果；同时给LLM重写添加模板，明确重写要求（比如“改写后的问题要简洁、准确，适合检索，不添加多余内容”）。

### 阶段4：意图识别——按菜单炒菜，精准定位

#### 👉 这是什么？

判断用户的问题属于哪个领域、哪个类目，然后去对应的知识库检索（避免“大海捞针”）。比如用户问“年假怎么休”，要识别出属于“人事领域→请假类目→年假话题”，再去人事知识库的请假模块检索，而不是去财务、IT知识库。

#### 👉 生活类比

你去医院挂号：分诊台护士问“你哪里不舒服？”，你说“头疼、发烧”，护士判断“挂内科发烧门诊”——护士的作用，就是RAG系统的“意图识别”。

#### 👉 代码

```java
public List<SubQuestionIntent> resolve(RewriteResult rewriteResult) {
    // 步骤1：从重写结果中提取子问题
    List<String> subQuestions = CollUtil.isNotEmpty(rewriteResult.subQuestions())
            ? rewriteResult.subQuestions()  // 有子问题就用子问题
            : List.of(rewriteResult.rewrittenQuestion());  // 没有就用改写后的问题

    // 步骤2：并行识别每个子问题的意图
    List<CompletableFuture<SubQuestionIntent>> tasks = subQuestions.stream()
            .map(q -> CompletableFuture.supplyAsync(
                    () -> new SubQuestionIntent(q, classifyIntents(q)),
                    intentClassifyExecutor
            ))
            .toList();

    // 步骤3：收集所有识别结果
    List<SubQuestionIntent> subIntents = tasks.stream()
            .map(CompletableFuture::join)
            .toList();
    
    // 步骤4：限制意图数量，防止检索太多
    return capTotalIntents(subIntents);
}
```

|代码部分|详细解释|
|---|---|
|rewriteResult.subQuestions()|上一步拆分出的子问题列表（比如“请假和出差有什么区别”拆成两个子问题）|
|CollUtil.isNotEmpty|判断子问题列表是否为空（Apache Commons Collections工具类，简化空判断）|
|并行识别子问题意图|用CompletableFuture异步并行处理每个子问题的意图识别，提升效率（比如两个子问题同时识别，不用串行）|
|classifyIntents(q)|调用AI或规则模型，识别单个子问题的意图（比如“年假怎么休”识别为“人事领域→请假→年假”）|
|intentClassifyExecutor|意图识别专用线程池，避免占用主线程，提升系统并发能力|
|capTotalIntents|限制意图数量（比如最多保留3个），避免识别出太多意图，导致后续检索范围过大、效率降低|

#### 👉 树形意图分类示意

```plain
                    [系统根节点]
                         |
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
    [人事领域]       [财务领域]       [IT领域]
         |               |               |
    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
    ↓         ↓     ↓         ↓     ↓         ↓
[请假]   [考勤]   [报销]   [发票]   [网络]   [设备]

用户问："年假怎么请"
系统识别：人事领域 → 请假类目 → 年假话题（置信度 0.95）
```

#### 👉 置信度过滤（关键优化）

识别意图时，会给每个意图打一个“置信度分数”，过滤掉匹配度太低的意图，避免检索无关内容：

```java
private List<NodeScore> classifyIntents(String question) {
    List<NodeScore> scores = intentClassifier.classifyTargets(question);
    return scores.stream()
            .filter(ns -> ns.getScore() >= INTENT_MIN_SCORE)  // 过滤低于 0.35 分的
            .limit(MAX_INTENT_COUNT)  // 最多保留 3 个
            .toList();
}
```

|分数范围|含义|处理方式|
|---|---|---|
|0.95+|高度匹配|✅ 精准检索，优先匹配该意图对应的知识库|
|0.6-0.95|中度匹配|✅ 参与检索，作为补充|
|0.35-0.6|低度匹配|⚠️ 可选参与，根据业务需求调整|
|< 0.35|几乎不匹配|❌ 直接过滤，不参与检索|

### 阶段5：多通道检索——多路送餐，广泛召回

#### 👉 这是什么？

根据意图识别结果，从知识库中找到与问题相关的文档片段（核心步骤，检索的质量直接决定AI回答的准确性）。采用“多通道”检索，兼顾“精准匹配”和“广泛召回”，避免漏检或误检。

#### 👉 生活类比

你在图书馆找书：① 精准检索：知道是《哈利波特》，直接去J.K.罗琳的书架找；② 模糊检索：不知道书名，只记得“魔法师戴眼镜”，在所有书架搜索——多通道检索就是结合这两种方式，确保能找到所有相关书籍。

#### 👉 检索架构图

```plain
用户问题
    ↓
┌─────────────────────────────────────────┐
│         MultiChannelRetrievalEngine      │
│              多通道检索引擎               │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────┐  ┌─────────────────┐
│  │ 意图定向检索通道 │  │ 向量全局检索通道  │
│  │  (精准匹配)      │  │  (广泛召回)      │
│  └────────┬────────┘  └────────┬────────┘
│           │                   │
│           └─────────┬─────────┘
│                       ↓
│           ┌───────────────────────┐
│           │     后置处理器链      │
│           │  ① 去重              │
│           │  ② Rerank 重排序      │
│           └───────────────────────┘
│                       ↓
│               检索结果列表
└─────────────────────────────────────────┘
```

#### 👉 代码

```java
public RetrievalContext retrieve(List<SubQuestionIntent> subIntents, int topK) {
    // 步骤1：确定最终返回的数量
    int finalTopK = topK > 0 ? topK : DEFAULT_TOP_K;  // 默认返回 10 条

    // 步骤2：并行处理每个子问题的检索
    List<CompletableFuture<SubQuestionContext>> tasks = subIntents.stream()
            .map(si -> CompletableFuture.supplyAsync(
                    () -> buildSubQuestionContext(
                            si,
                            resolveSubQuestionTopK(si, finalTopK)
                    ),
                    ragContextExecutor  // 专门的线程池
            ))
            .toList();

    // 步骤3：等待所有检索完成并合并结果
    List<SubQuestionContext> contexts = tasks.stream()
            .map(CompletableFuture::join)
            .toList();
    
    return mergeContexts(contexts);
}
```

|代码部分|详细解释|
|---|---|
|finalTopK|检索结果的数量，用户传入topK就用传入的值，否则用默认值10（DEFAULT_TOP_K为常量），避免返回太多结果导致模型上下文溢出|
|并行处理子问题检索|每个子问题对应一个检索任务，异步并行处理（比如两个子问题同时检索），提升检索效率|
|buildSubQuestionContext|为单个子问题构建检索上下文，结合意图信息，确定检索的知识库和范围|
|resolveSubQuestionTopK|计算每个子问题应返回的检索结果数量（比如重要子问题返回更多结果，次要子问题返回更少）|
|ragContextExecutor|检索专用线程池，避免检索操作（可能耗时）阻塞主线程|
|mergeContexts|合并所有子问题的检索结果，去重、重排序后，形成最终的检索上下文|

#### 👉 检索流程补充（核心细节）

```java
private KbResult retrieveAndRerank(SubQuestionIntent intent, 
                                   List<NodeScore> kbIntents, 
                                   int topK) {
    // 步骤1：使用多通道检索
    List<RetrievedChunk> chunks = multiChannelRetrievalEngine
            .retrieveKnowledgeChannels(subIntents, topK);
    
    if (CollUtil.isEmpty(chunks)) {
        return KbResult.empty();  // 没找到任何相关文档
    }
    
    // 步骤2：按意图节点分组
    Map<String, List<RetrievedChunk&gt;&gt; intentChunks = new ConcurrentHashMap<>();
    for (NodeScore ns : kbIntents) {
        intentChunks.put(ns.getNode().getId(), chunks);
    }
    
    // 步骤3：格式化上下文
    String groupedContext = contextFormatter.formatKbContext(
            kbIntents, intentChunks, topK);
    
    return new KbResult(groupedContext, intentChunks);
}
```

关键细节：多通道检索后，会经过“去重”（避免重复的文档片段）和“Rerank重排序”（根据与问题的相似度，重新排序检索结果，把最相关的放在前面），确保后续模型能优先使用最精准的文档。

#### 👉 检索结果示例

|文档 ID|文档内容|相似度分数|
|---|---|---|
|doc_001|“员工年假标准：入职满1年享受5天年假，满3年享受10天，满5年享受15天”|0.92|
|doc_002|“年假申请流程：员工通过OA系统提交年假申请，部门负责人审批后生效”|0.88|
|doc_003|“请假制度包括：事假、病假、年假、婚假等，其中年假需满足入职年限要求”|0.75|
|doc_004|“法定节假日安排：根据国家规定，春节放假7天，国庆节放假7天”|0.45|

注：相似度分数越高，说明文档与问题的相关性越强，后续会优先作为模型生成回答的依据。

### 阶段6：Prompt 构建——装盘打包，清晰呈现

#### 👉 这是什么？

把检索到的文档、对话历史、用户问题，组装成一个完整的“Prompt（提示词）”，让大模型能清晰了解“上下文+问题+参考资料”，从而生成准确、不跑偏的回答。

#### 👉 生活类比

你去问老师问题：只说“年假怎么休？”，老师可能不清楚你是哪个公司、入职多久；但你说“老师好，我是XX公司新入职员工，想了解公司年假政策，比如入职满一年有多少天年假？申请流程是怎样的？”，老师就能精准回答——Prompt构建就是做这种“说清楚上下文”的工作。

#### 👉 代码

```java
public List<ChatMessage> buildStructuredMessages(PromptContext context,
                                                 List<ChatMessage> history,
                                                 String question,
                                                 List<String> subQuestions) {
    List<ChatMessage> messages = new ArrayList<>();
    
    // 步骤1：添加系统提示词（告诉 AI 怎么回答）
    String systemPrompt = buildSystemPrompt(context);
    if (StrUtil.isNotBlank(systemPrompt)) {
        messages.add(ChatMessage.system(systemPrompt));
    }

    // 步骤2：添加 MCP 工具调用的结果（如有）
    if (StrUtil.isNotBlank(context.getMcpContext())) {
        messages.add(ChatMessage.system(
            formatEvidence(MCP_CONTEXT_HEADER, context.getMcpContext())
        ));
    }
    
    // 步骤3：添加知识库检索结果
    if (StrUtil.isNotBlank(context.getKbContext())) {
        messages.add(ChatMessage.user(
            formatEvidence(KB_CONTEXT_HEADER, context.getKbContext())
        ));
    }

    // 步骤4：添加历史对话
    if (CollUtil.isNotEmpty(history)) {
        messages.addAll(history);
    }
    
    // 步骤5：添加用户问题
    messages.add(ChatMessage.user(question));
    
    return messages;
}
```

|代码部分|详细解释|
|---|---|
|systemPrompt（系统提示词）|告诉大模型“怎么回答”，比如“你是XX公司的HR助手，请根据提供的文档内容准确回答用户问题，文档中没有的信息请明确告知，不要编造”，避免模型生成幻觉|
|MCP_CONTEXT|MCP工具调用的实时数据（比如实时查询员工的入职年限、考勤记录），补充知识库中没有的动态信息|
|KB_CONTEXT|上一步检索到的知识库文档内容，格式化后添加到Prompt中，作为模型回答的参考依据|
|formatEvidence|格式化检索结果和工具结果，加上标题（比如“## 知识库文档”“## 动态数据”），让Prompt结构清晰，模型更容易识别|
|添加历史对话|将之前的对话历史添加到Prompt中，确保模型了解上下文（比如用户上一轮问了“年假有多少天”，这一轮问“怎么申请”，模型能关联起来）|
|添加用户问题|最后添加用户当前的问题，让模型明确“需要回答什么”，避免答非所问|

#### 👉 最终Prompt结构（示例）

```plain
【消息 1 - 系统提示词】
你是XX公司的HR助手，请根据提供的文档内容准确回答用户问题。如果文档中没有相关信息，请明确告知用户，不要编造。

【消息 2 - 知识库文档】
## 文档内容
doc_001：员工年假标准：入职满1年享受5天年假，满3年享受10天，满5年享受15天。
doc_002：年假申请流程：员工通过OA系统提交年假申请，部门负责人审批后生效。

【消息 3 - 历史对话】
用户：年假有多少天？
助手：根据公司规定，入职满1年享受5天年假，满3年享受10天，满5年享受15天。

【消息 4 - 当前问题】
用户：入职不满一年有年假吗？
```

这样的Prompt结构清晰，模型能快速找到参考资料、理解上下文，生成准确的回答。

### 阶段7：模型调用——骑手送餐，生成回答

#### 👉 这是什么？

调用大语言模型（LLM），传入构建好的Prompt，让模型基于检索到的文档和上下文，生成回答。同时实现“多模型路由”和“故障转移”，确保模型调用稳定（一个模型失败，自动切换到下一个）。

#### 👉 代码

```java
public StreamCancellationHandle streamChat(ChatRequest request, 
                                           StreamCallback callback) {
    // 步骤1：选择合适的模型
    List<ModelTarget> targets = selector.selectChatCandidates(
            request.getThinking());
    
    if (CollUtil.isEmpty(targets)) {
        throw new RemoteException("无可用大模型提供者");
    }

    // 步骤2：尝试每个模型
    for (ModelTarget target : targets) {
        ChatClient client = resolveClient(target, label);
        
        if (client == null) {
            continue;  // 这个模型不可用，跳过
        }
        
        try {
            // 步骤3：调用模型
            return client.streamChat(request, callback, target);
        } catch (Exception e) {
            // 步骤4：失败了，标记并尝试下一个
            healthStore.markFailure(target.id());
            log.warn("模型 {} 调用失败，切换下一个", target.id());
            continue;
        }
    }
    
    // 所有模型都失败了
    throw new RemoteException("大模型调用失败，请稍后再试");
}
```

|代码部分|详细解释|
|---|---|
|ModelTarget|目标模型对象，包含模型名称、提供商、调用地址等信息（比如DeepSeek、阿里云百炼、Ollama本地模型）|
|selectChatCandidates|根据请求特性选择候选模型（比如开启深度思考模式，优先选择DeepSeek-o1；普通问答优先选择阿里云百炼）|
|resolveClient|根据模型对象，获取对应的模型调用客户端（不同模型的调用方式不同，比如DeepSeek有专属客户端，阿里云百炼有对应的SDK）|
|client.streamChat(...)|调用模型的流式生成接口，传入请求、回调函数和模型对象，模型会实时返回生成的内容（流式输出）|
|故障转移逻辑|如果当前模型调用失败（比如网络异常、模型服务宕机），标记失败状态，自动尝试下一个候选模型，确保整个链路不中断|

#### 👉 故障转移机制（生产环境必备）

```plain
请求进来 → 尝试 DeepSeek → 成功✅→ 返回结果
                          ↓ 失败❌
                    尝试 阿里云百炼 → 成功✅→ 返回结果
                                  ↓ 失败❌
                            尝试 Ollama 本地模型 → 成功✅→ 返回结果
                                              ↓ 失败❌
                                        返回错误信息
```

#### 👉 模型选择策略（实战参考）

|场景|首选模型|备选模型|说明|
|---|---|---|---|
|深度思考（复杂问题）|DeepSeek-o1|-|擅长推理，适合需要分析、计算的复杂问题（比如“年假和事假的薪资区别”）|
|普通问答（简单问题）|阿里云百炼|DeepSeek|响应速度快、成本低，适合简单的政策查询（比如“年假怎么申请”）|
|本地部署（无外网）|Ollama|-|可本地部署，无外网需求，适合涉密场景|

### 阶段8：流式输出——送到手上，实时反馈

#### 👉 这是什么？

把模型生成的回答，通过之前建立的SSE连接，实时推送给用户，就像“打字机”一样，逐字逐句显示，避免用户长时间等待（尤其是复杂问题，模型生成回答需要几秒，流式输出能提升用户体验）。

#### 👉 代码

```java
@Override
public void onContent(String chunk) {
    // 步骤1：检查是否被用户取消
    if (taskManager.isCancelled(taskId)) {
        return;  // 用户取消了，直接返回
    }
    
    // 步骤2：过滤空内容
    if (StrUtil.isBlank(chunk)) {
        return;  // 空内容，不处理
    }
    
    // 步骤3：累积回答内容
    answer.append(chunk);
    
    // 步骤4：分块发送
    sendChunked(TYPE_RESPONSE, chunk);
}

@Override
public void onComplete() {
    // 步骤1：保存回答到历史记录
    Long messageId = memoryService.append(
        conversationId, 
        UserContext.get
```
