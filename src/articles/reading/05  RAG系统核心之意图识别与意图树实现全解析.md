---
title: RAG系统核心之意图识别与意图树实现全解析
date: '2026-03-24'
category: reading
tags:
  - 阅读
excerpt: >-
  在大模型时代，RAG（检索增强生成）系统已成为企业级问答、智能客服等场景的核心架构。而支撑RAG系统“精准检索、高效响应”的关键一步，就是**意图识别**——它相当于RAG系统的“导航仪”，能快速判断...
readingTime: 22 min
---
在大模型时代，RAG（检索增强生成）系统已成为企业级问答、智能客服等场景的核心架构。而支撑RAG系统“精准检索、高效响应”的关键一步，就是**意图识别**——它相当于RAG系统的“导航仪”，能快速判断用户问题的所属领域和具体话题，指引系统去对应的知识库中检索信息，避免“大海捞针”式的无效检索。

与此同时，意图识别的基础的是**意图树**——这是一套预先定义好的分类体系，像企业的组织架构一样，将所有可能的用户问题分类整理，让意图识别有章可循。今天，我们就从技术实现角度，全方位拆解意图识别与意图树的核心逻辑、代码细节和实际应用技巧。

# 一、意图识别：RAG系统的“导航核心”

## 1.1 一句话读懂意图识别

意图识别的核心目标，就是将用户的自然语言问题，映射到系统预设的分类中，并给出匹配置信度。举个最直观的例子：

```plain
用户问："年假怎么休？"
意图识别后："这个问题属于 → 人事领域 → 请假类目 → 年假话题（置信度 0.95）"
```

置信度的存在，是为了应对模糊问题——比如用户问“苹果怎么吃？”，系统可能识别出“水果食用”（置信度0.9）和“iPhone使用”（置信度0.7）两个意图，最终选择置信度更高的分类，避免歧义。

## 1.2 意图识别的核心：树形结构设计

意图识别的前提，是系统维护着一棵**意图树**，所有可能的用户问题分类，都被组织成树形结构，分为三个层级：

- 根节点：系统总入口，包含所有领域
    
- 内部节点：领域（如人事、财务）、类目（如请假、考勤），用于分类导航
    
- 叶子节点：最具体的话题（如年假、调休），是意图识别的最终目标，也是后续检索的直接依据
    

用一张可视化图更易理解：

```plain
                        [系统根节点]
                             |
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
   [人事领域]            [财务领域]            [IT领域]
        |                    |                    |
   ┌────┴────┐           ┌────┴────┐           ┌────┴────┐
   ↓         ↓           ↓         ↓           ↓         ↓
[请假]   [考勤]       [报销]   [发票]       [网络]   [设备]
   |         |           |         |           |         |
[年假]   [调休]       [差旅]   [发票]       [WiFi]   [电脑]
```

这种树形结构的优势的是“层级清晰、可扩展”——新增一个分类（如人事领域的“加班”话题），只需在对应类目下添加叶子节点，无需修改整体架构。

## 1.3 代码实现详解：从入口到核心流程

意图识别的代码实现，核心集中在`IntentResolver`（意图解析器）和`DefaultIntentClassifier`（意图分类器）两个类，整体流程分为4步：提取子问题 → 并行识别 → 收集结果 → 数量限制。

### 3.1 入口方法：IntentResolver.resolve()

这是意图识别的总入口，负责接收用户问题（经过改写、拆分后的结果），协调整个识别流程：

```java
public List<SubQuestionIntent> resolve(RewriteResult rewriteResult) {
    // 第1步：从重写结果中提取子问题（若没有子问题，用改写后的单个问题）
    List<String> subQuestions = CollUtil.isNotEmpty(rewriteResult.subQuestions())
            ? rewriteResult.subQuestions()
            : List.of(rewriteResult.rewrittenQuestion());
    
    // 第2步：并行识别每个子问题的意图（提升处理效率）
    List<CompletableFuture<SubQuestionIntent>> tasks = subQuestions.stream()
            .map(q -> CompletableFuture.supplyAsync(
                    () -> new SubQuestionIntent(q, classifyIntents(q)),
                    intentClassifyExecutor
            ))
            .toList();
    
    // 第3步：收集所有并行任务的结果
    List<SubQuestionIntent> subIntents = tasks.stream()
            .map(CompletableFuture::join)
            .toList();
    
    // 第4步：限制意图数量，防止检索过多影响性能
    return capTotalIntents(subIntents);
}
```

这里有两个关键优化点：

- 并行处理：使用`CompletableFuture.supplyAsync`并行处理每个子问题，避免单线程阻塞，尤其适合多子问题场景（如用户一次性问多个相关问题）。
    
- 数量限制：通过`capTotalIntents`方法限制总意图数（默认3个），防止检索过多知识库导致响应变慢。
    

### 3.2 核心算法：DefaultIntentClassifier.classifyTargets()

这是意图识别的“核心大脑”，负责加载意图树、调用LLM打分、解析结果，分为3个关键步骤：

#### 步骤1：加载意图树（优先缓存，提升性能）

意图树不会每次都从数据库加载，而是优先从Redis缓存读取，缓存未命中时再从数据库加载并缓存，这是企业级应用的性能优化关键：

```java
private IntentTreeData loadIntentTreeData() {
    // 1. 先从Redis读取（高性能，毫秒级响应）
    List<IntentNode> roots = intentTreeCacheManager.getIntentTreeFromCache();

    // 2. Redis没有就从数据库加载
    if (CollUtil.isEmpty(roots)) {
        roots = loadIntentTreeFromDB();
        intentTreeCacheManager.saveIntentTreeToCache(roots);
    }

    // 3. 扁平化成列表，方便LLM处理（只关注叶子节点）
    List<IntentNode> allNodes = flatten(roots);
    List<IntentNode> leafNodes = allNodes.stream()
            .filter(IntentNode::isLeaf)  // 只取叶子节点（最具体分类）
            .collect(Collectors.toList());

    return new IntentTreeData(allNodes, leafNodes, id2Node);
}
```

意图树的加载流程可以总结为：`Redis缓存 → 数据库 → 缓存写入 → 扁平化处理`，既保证了性能，又保证了数据一致性。

#### 步骤2：构造Prompt，让LLM做“选择题”

很多人误以为意图识别是让LLM“自由发挥”，其实更高效的方式是让LLM做“选择题”——将所有叶子节点作为选项，构造清晰的Prompt，让LLM给出每个选项的匹配分数：

```java
// 构建系统提示词，列出所有叶子节点
String systemPrompt = buildPrompt(data.leafNodes);

// 发送给LLM，低温度保证结果确定性
ChatRequest request = ChatRequest.builder()
        .messages(List.of(
                ChatMessage.system(systemPrompt),
                ChatMessage.user(question)
        ))
        .temperature(0.1D)   // 低温度（0.1-0.3），避免随机结果
        .topP(0.3D)
        .thinking(false)
        .build();
```

Prompt的核心结构的是“说明身份 + 列出选项 + 要求格式”，示例如下：

```markdown
你是一个意图分类器，请判断用户问题属于哪个分类。

以下是所有可用的分类：
- id=001，path=人事/请假/年假，description=员工年假政策、计算方法、申请流程
- id=002，path=人事/请假/调休，description=调休政策、加班转调休
- id=003，path=人事/考勤/打卡，description=打卡规则、迟到处理

请返回JSON数组格式：[{"id": "001", "score": 0.95, "reason": "用户问的是年假申请..."}]
```

这种方式的优势是“精准可控”——避免LLM生成无关分类，同时低温度参数（0.1）能保证结果的一致性，减少误判。

#### 步骤3：解析LLM结果，过滤排序

LLM返回JSON格式的打分结果后，需要解析结果、匹配对应的意图节点，并按置信度排序、过滤低分数意图：

```java
String raw = llmService.chat(request);  // 调用LLM获取结果
try {
    JsonArray arr = JsonParser.parseString(cleanedRaw).getAsJsonArray();
    List<NodeScore> scores = new ArrayList<>();
    for (JsonElement el : arr) {
        JsonObject obj = el.getAsJsonObject();
        String id = obj.get("id").getAsString();
        double score = obj.get("score").getAsDouble();
        // 匹配对应的意图节点
        IntentNode node = data.id2Node.get(id);
        scores.add(new NodeScore(node, score));
    }
    // 按分数降序排序
    scores.sort(Comparator.comparingDouble(NodeScore::getScore).reversed());
    return scores;
}
```

## 1.4 置信度过滤：避免误判的“安全阀”

LLM返回的分数并非都有效，需要设置阈值过滤低置信度意图，避免误判影响检索结果。一般的过滤规则如下：

|分数范围|含义|是否保留|
|---|---|---|
|0.9+|高度匹配，用户意图明确|✅ 保留|
|0.6-0.9|中度匹配，意图相关|✅ 保留|
|0.35-0.6|低度匹配，需谨慎判断|⚠️ 可选保留（根据业务场景调整）|
|< 0.35|几乎不匹配，大概率误判|❌ 过滤|

代码层面，通过`classifyIntents`方法实现过滤：

```java
private List<NodeScore> classifyIntents(String question) {
    List<NodeScore> scores = intentClassifier.classifyTargets(question);
    return scores.stream()
            .filter(ns -> ns.getScore() >= INTENT_MIN_SCORE)  // 阈值默认0.35
            .limit(MAX_INTENT_COUNT)  // 最多保留3个
            .toList();
}
```

## 1.5 完整流程：从用户问题到意图结果

整合以上所有步骤，意图识别的完整流程如下，以用户问“年假怎么休？”为例：

```plain
用户问题："年假怎么休？"
    ↓
1. 加载意图树：从Redis/数据库获取人事、财务、IT等所有分类节点
    ↓
2. 构造Prompt：将所有叶子节点作为选项发给LLM
    ↓
3. LLM打分：返回匹配分数 [年假:0.95, 调休:0.3, 打卡:0.1]
    ↓
4. 过滤排序：过滤<0.35分的，按分数排序保留年假（0.95）
    ↓
识别结果：人事/请假/年假（0.95分）
    ↓
进入下一阶段：检索该分类下的知识库文档
```

# 二、意图树：意图识别的“基础骨架”

如果说意图识别是RAG的“导航仪”，那么意图树就是“导航地图”——它定义了所有可能的用户意图分类，是意图识别能够正常工作的基础。接下来，我们拆解意图树的实现细节。

## 2.1 意图树的核心数据结构：IntentNode

意图树的每个节点，都由`IntentNode`类定义，包含了节点的所有关键信息，支持不同类型、不同层级的节点配置：

```java
@Data
@Builder
public class IntentNode {
    /** 唯一标识，如 "group-hr"、"group-hr-leave-annual" */
    private String id;
    
    /** 知识库ID（KB类型节点用） */
    private String kbId;
    
    /** 展示名称，如「人事」「年假」 */
    private String name;
    
    /** 语义说明，帮助LLM理解分类范围 */
    private String description;
    
    /** 层级：DOMAIN(领域) / CATEGORY(类目) / TOPIC(话题) */
    private IntentLevel level;
    
    /** 父节点ID，根节点为null */
    private String parentId;
    
    /** 示例问题，帮助LLM更精准识别 */
    private List<String> examples;
    
    /** 子节点列表，无子女则为叶子节点 */
    private List<IntentNode> children;
    
    /** 类型：KB(知识库) / MCP(工具调用) / SYSTEM(系统) */
    private IntentKind kind;
    
    /** 向量数据库集合名称（KB类型用） */
    private String collectionName;
    
    /** MCP工具ID（工具调用类型用） */
    private String mcpToolId;
    
    // 其他配置：节点级TopK、Prompt模板等
    private Integer topK;
    private String promptTemplate;
}
```

这里有两个关键枚举，决定了节点的用途：

- `IntentLevel`（层级）：DOMAIN（领域）→ CATEGORY（类目）→ TOPIC（话题），从宏观到具体。
    
- `IntentKind`（类型）：KB（知识库检索）、MCP（工具调用）、SYSTEM（系统内置回复），决定了识别意图后该做什么。
    

## 2.2 意图树的数据来源：两种实现方式

意图树的数据源有两种，分别适用于不同场景，企业级应用中更推荐数据库方式。

### 方式1：硬编码方式（IntentTreeFactory）

通过代码直接构建意图树，适用于演示项目、节点数量少、不常变更的场景：

```java
public static List<IntentNode> buildIntentTree() {
    List<IntentNode> roots = new ArrayList<>();
    
    // 根节点：集团信息化（领域层）
    IntentNode group = IntentNode.builder()
            .id("group")
            .name("集团信息化")
            .level(IntentLevel.DOMAIN)
            .kind(IntentKind.KB)
            .build();
    
    // 子节点：人事（类目层）
    IntentNode hr = IntentNode.builder()
            .id("group-hr")
            .name("人事")
            .level(IntentLevel.CATEGORY)
            .parentId("group")  // 关联父节点
            .kind(IntentKind.KB)
            .description("招聘、入职、请假等人力资源相关问题")
            .examples(List.of("请假流程是怎样的？", "试用期多久转正？"))
            .build();
    
    // 继续添加子节点...
    return roots;
}
```

### 方式2：数据库方式（推荐）

将意图树节点存储在数据库中，支持动态添加、修改节点，适用于节点数量多、需要频繁扩展的企业级场景。核心步骤分为3步：

1. 数据库表设计：存储节点的所有属性，关键字段包括`intent_code`（节点ID）、`parent_code`（父节点ID）、`level`（层级）、`kind`（类型）等。
    
2. 读取数据：从数据库查询所有节点（扁平结构），转换为`IntentNode`对象。
    
3. 组装成树：通过`parentId`建立父子关系，将扁平列表组装成树形结构。
    

核心代码实现：

```java
private List<IntentNode> loadIntentTreeFromDB() {
    // 1. 从数据库查询所有节点（扁平结构）
    List<IntentNodeDO> intentNodeDOList = intentNodeMapper.selectList(
            Wrappers.lambdaQuery(IntentNodeDO.class)
                    .eq(IntentNodeDO::getDeleted, 0)
    );
    
    // 2. 转换为IntentNode对象，存入Map（便于通过ID查找父节点）
    Map<String, IntentNode> id2Node = new HashMap<>();
    for (IntentNodeDO each : intentNodeDOList) {
        IntentNode node = BeanUtil.toBean(each, IntentNode.class);
        node.setId(each.getIntentCode());
        node.setParentId(each.getParentCode());
        id2Node.put(node.getId(), node);
    }
    
    // 3. 组装树形结构
    List<IntentNode> roots = new ArrayList<>();
    for (IntentNode node : id2Node.values()) {
        String parentId = node.getParentId();
        if (parentId == null || parentId.isBlank()) {
            roots.add(node);  // 无父节点 → 根节点
        } else {
            IntentNode parent = id2Node.get(parentId);
            if (parent != null) {
                parent.getChildren().add(node);  // 挂到父节点下
            }
        }
    }
    return roots;
}
```

## 2.3 性能优化：Redis缓存机制

意图树的结构相对稳定，不会频繁变更，因此可以通过Redis缓存来提升加载速度。缓存策略如下：

- 首次请求：检查Redis缓存 → 缓存未命中 → 从数据库加载 → 存入Redis → 返回结果。
    
- 后续请求：直接从Redis读取，毫秒级响应，避免频繁操作数据库。
    

需要注意的是，当意图树节点发生变更（如新增、修改节点）时，要及时更新Redis缓存，避免缓存与数据库数据不一致。

## 2.4 意图树的扩展与维护

企业级应用中，意图树需要根据业务需求不断扩展，常见的扩展场景有两种：

### 场景1：新增普通KB节点（如人事领域的“加班”话题）

只需在数据库中插入一条记录，指定父节点ID、层级、类型等信息即可：

```sql
-- 新增“加班”话题节点，父节点为“人事”（group-hr）
INSERT INTO intent_node (intent_code, parent_code, name, level, kind)
VALUES ('group-hr-overtime', 'group-hr', '加班', 3, 1);
```

插入后，重启服务或触发缓存更新，新节点就会被加载到意图树中。

### 场景2：新增MCP工具节点（如天气查询）

MCP类型节点用于调用外部工具（如天气API），需要配置`mcpToolId`关联工具：

```java
IntentNode weatherNode = IntentNode.builder()
        .id("biz-weather")
        .name("天气查询")
        .level(IntentLevel.TOPIC)
        .parentId("biz")
        .kind(IntentKind.MCP)
        .mcpToolId("weather-tool-id")  // 关联外部天气工具
        .description("查询指定城市的当前天气")
        .examples(List.of("今天天气怎么样？", "北京明天会下雨吗？"))
        .build();
```

# 三、意图识别与意图树的核心价值

理解了意图识别和意图树的实现后，我们再回顾它们在RAG系统中的核心价值，这也是为什么企业级RAG必须重视这两个模块：

## 3.1 精准检索，提升用户体验

没有意图识别时，用户问“年假怎么休？”，系统会搜索整个知识库，不仅效率低，还可能召回无关文档；有了意图识别后，系统能直接定位到“人事/请假/年假”分类，只检索该分类下的文档，精准命中用户需求。

## 3.2 避免歧义，降低误判率

对于模糊问题（如“苹果怎么吃？”），意图识别通过置信度打分，选择最匹配的分类，避免系统返回无关结果，提升回答的准确性。

## 3.3 性能优化，提升响应速度

通过意图树的层级过滤和Redis缓存，系统无需加载所有知识库，只需检索相关分类，同时并行处理子问题，大幅提升响应速度，支撑高并发场景。

## 3.4 灵活扩展，适配业务变化

意图树支持动态添加、修改节点，无论是新增业务领域（如供应链），还是新增话题（如产假），都能快速适配，无需重构整个意图识别模块。

# 四、总结与实践建议

意图识别与意图树，是RAG系统“精准、高效”的核心支撑，其核心逻辑可以总结为：

- 意图识别：让LLM做“选择题”，通过置信度过滤和排序，找到最匹配的用户意图。
    
- 意图树：用树形结构组织所有分类，通过数据库+Redis缓存，实现高效加载和灵活扩展。
    

最后，给大家两个实践建议：

1. 企业级应用优先选择“数据库+Redis缓存”的意图树实现方式，便于维护和扩展。
    
2. Prompt设计要清晰，给LLM提供足够的节点描述和示例问题，同时设置低温度参数，保证意图识别的一致性。
    

掌握了意图识别与意图树的实现，你就能搭建出更精准、更高效的RAG系统，为用户提供更优质的问答体验。后续我们还会讲解意图识别的优化技巧（如动态意图树、多模态意图识别），敬请关注！
