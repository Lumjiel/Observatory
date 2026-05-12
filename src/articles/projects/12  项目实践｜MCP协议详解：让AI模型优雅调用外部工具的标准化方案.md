---
title: '项目实践｜MCP协议详解:让AI模型优雅调用外部工具的标准化方案'
date: '2026-03-31'
category: reading
tags:
  - 阅读
excerpt: >-
  在AI大模型应用日益深入的今天，单纯的模型对话已无法满足复杂业务需求——我们需要让AI能够联动外部工具，获取实时数据（如天气）、操作业务系统（如工单查询）、执行具体指令（如销售数据统计）。在我们的RA...
readingTime: 37 min
---
在AI大模型应用日益深入的今天，单纯的模型对话已无法满足复杂业务需求——我们需要让AI能够联动外部工具，获取实时数据（如天气）、操作业务系统（如工单查询）、执行具体指令（如销售数据统计）。在我们的RAG（检索增强生成）项目中，最初尝试使用传统Function Calling实现工具调用，但过程中发现了诸多痛点：接口不统一、工具注册混乱、参数提取无规范、跨模块调用兼容性差。为解决这些问题，我们引入并实现了MCP（Model Context Protocol）协议，一套专门为AI模型调用外部工具设计的标准化方案。

本文将结合我们的项目实践，从MCP协议简介、项目架构设计、核心接口实现、完整调用流程、源码解析到模块集成，全方位拆解MCP协议在实际项目中的落地细节，希望能为正在做AI工具调用的开发者提供参考。

## 一、什么是MCP？—— 不止于Function Calling的标准化协议

MCP（Model Context Protocol），即模型上下文协议，本质是一套让AI模型高效、标准化调用外部工具的通信协议，其核心定位是“统一工具调用的语言”，与大家熟知的Function Calling相比，它更注重标准化、可扩展性和工程化落地。

在我们的项目中，MCP承担着“AI与外部工具之间的桥梁”角色，其核心价值体现在三点：

- 标准化：统一工具定义、请求/响应格式、调用流程，解决不同工具调用接口混乱的问题，降低多工具集成成本；
    
- 可扩展：支持工具的动态注册、按需调用，新增工具无需修改核心逻辑，只需实现对应接口即可；
    
- 工程化：内置参数提取、工具管理、请求分发机制，适配企业级项目的分层架构，便于维护和迭代。
    

从整体架构来看，MCP采用三层解耦设计，将应用层、协议层与传输层彻底分离——应用层负责业务能力（Agent、Tools等），协议层基于JSON-RPC 2.0定义会话语义，传输层负责消息收发（支持HTTP、WebSocket等多种方式），这种设计让同一套调用逻辑可适配不同部署场景，极大提升了灵活性。

在项目的核心流程中，MCP的定位如下（对应我们项目的实际链路）：

```plain
用户问题 → 意图识别 → 判断类型 → KB（检索知识库）
                              → MCP（调用外部工具）
```

当意图识别为“需要调用外部工具”时，便进入MCP调用流程，这也是我们项目中AI能力延伸的关键环节。

## 二、项目中的MCP架构设计——分层解耦，权责清晰

结合我们的RAG项目架构，MCP相关代码分为两大核心模块：Bootstrap模块（调用方）和MCP Server模块（提供方），采用“调用方-提供方”的分离设计，便于部署和维护，同时符合微服务架构的设计理念。

### 2.1 Bootstrap模块（调用方）—— 发起调用，统筹管理

Bootstrap模块作为MCP调用的发起方，集成在我们的RAG核心服务中，负责工具定义、参数提取、请求构建和结果接收，其核心目录结构如下（对应项目实际代码路径）：

```plain
bootstrap/src/main/java/com/nageoffer/ai/ragent/rag/core/mcp/
├── MCPTool.java                    # 工具定义（描述工具ID、参数、服务地址等）
├── MCPToolExecutor.java            # 执行器接口（定义工具执行、获取工具定义的规范）
├── MCPToolRegistry.java            # 注册表接口（工具注册、获取的规范）
├── DefaultMCPToolRegistry.java      # 注册表实现（核心：管理所有工具执行器）
├── MCPRequest.java                  # 调用请求（封装工具ID、用户信息、参数等）
├── MCPResponse.java                 # 调用响应（封装执行结果、错误信息等）
├── MCPParameterExtractor.java       # 参数提取接口（定义从用户问题中提取参数的规范）
├── LLMMCPParameterExtractor.java   # LLM 参数提取（实际实现：用LLM提取参数）
│
└── client/
    ├── MCPClient.java               # 客户端接口（定义MCP调用的规范）
    ├── HttpMCPClient.java          # HTTP 客户端实现（核心：发送HTTP请求到Server）
    └── MCPClientAutoConfiguration.java # 自动配置（SpringBoot自动装配客户端）
```

该模块的核心职责是“统筹调度”：接收意图识别模块的指令，提取用户问题中的参数，构建调用请求，通过HTTP客户端发送到MCP Server，最终接收并处理响应结果。

### 2.2 MCP Server模块（提供方）—— 接收请求，执行工具

MCP Server模块作为工具的提供方，独立部署为微服务，负责工具的实际执行、请求分发，支持多种外部工具的集成，其核心目录结构如下：

```plain
mcp-server/src/main/java/com/nageoffer/ai/ragent/mcp/
├── core/
│   ├── MCPToolDefinition.java      # 工具定义（与调用方对应，描述工具能力）
│   ├── MCPToolRegistry.java         # 工具注册（管理Server端的工具执行器）
│   ├── MCPToolRequest.java         # 请求（接收调用方的请求参数）
│   ├── MCPToolResponse.java        # 响应（返回工具执行结果）
│   └── MCPToolExecutor.java        # 执行器接口（与调用方接口对齐）
│
├── executor/
│   ├── WeatherMCPExecutor.java      # 天气工具（实际调用天气API）
│   ├── TicketMCPExecutor.java       # 工单工具（实际调用工单系统接口）
│   └── SalesMCPExecutor.java       # 销售工具（实际查询销售数据库）
│
└── endpoint/
    ├── MCPEndpoint.java            # HTTP 端点（接收调用方的HTTP请求）
    └── MCPDispatcher.java          # 请求分发（根据工具ID分发到对应执行器）
```

该模块的核心职责是“执行具体工具逻辑”：接收调用方的请求，通过请求分发器找到对应的工具执行器，调用外部接口（如天气API、工单系统），将执行结果封装后返回给调用方。

## 三、核心接口实现——标准化的基石

MCP的标准化核心体现在接口的统一设计上，我们项目中所有MCP相关组件都围绕一套核心接口开发，确保调用方与提供方的兼容性，以下是最关键的4个核心接口及实现细节。

### 3.1 MCPTool：工具定义接口

MCPTool是工具的“身份卡片”，用于描述工具的核心信息，让LLM能够理解工具的能力，同时为调用方提供调用依据。其核心代码实现如下（简化后，保留核心字段）：

```java
// bootstrap/.../mcp/MCPTool.java
@Data
@Builder
public class MCPTool {
    /** 工具唯一标识（与Server端工具ID一致，确保调用准确） */
    private String toolId;
    /** 工具描述（关键：LLM通过该描述理解工具用途，用于参数提取） */
    private String description;
    /** 参数定义（描述工具所需参数的名称、类型、是否必填） */
    private Map<String, ParameterDef> parameters;
    /** 是否需要用户身份（用于权限控制，如工单查询需要用户ID） */
    @Builder.Default
    private boolean requireUserId = true;
    /** MCP Server 地址（调用方发送请求的目标地址） */
    private String mcpServerUrl;
}
```

在我们的项目中，每个工具（如天气查询）都有唯一的toolId（如weather_query），LLM通过description字段理解“该工具用于查询指定城市和日期的天气信息”，进而从用户问题中提取对应的参数（如city、date）。

### 3.2 MCPToolExecutor：工具执行器接口

MCPToolExecutor是工具执行的“核心逻辑入口”，定义了工具执行的规范，调用方和提供方都需遵循该接口实现。其核心代码如下：

```java
// bootstrap/.../mcp/MCPToolExecutor.java
public interface MCPToolExecutor {
    /** 获取工具定义（返回当前工具的MCPTool对象） */
    MCPTool getToolDefinition();
    /** 执行工具调用（核心方法：接收请求，执行逻辑，返回响应） */
    MCPResponse execute(MCPRequest request);
    /** 是否支持该请求（默认根据toolId判断，可自定义扩展） */
    default boolean supports(MCPRequest request) {
        return getToolId().equals(request.getToolId());
    }
}
```

例如，我们项目中的WeatherMCPExecutor（天气工具执行器）就实现了该接口，在execute方法中调用外部天气API，将返回结果封装为MCPResponse。

### 3.3 MCPRequest & MCPResponse：请求与响应封装

MCPRequest和MCPResponse是调用方与提供方之间的“通信载体”，统一了请求和响应的格式，避免因格式不统一导致的调用失败。

MCPRequest封装了调用所需的所有信息，包括工具ID、用户ID、会话ID、原始问题和参数，核心代码如下（简化）：

```java
// bootstrap/.../mcp/MCPRequest.java
@Data
@Builder
public class MCPRequest {
    private String toolId;          // 目标工具ID
    private String userId;          // 用户ID（自动注入，用于权限控制）
    private String conversationId;  // 会话ID（关联上下文）
    private String userQuestion;    // 原始用户问题（便于参数提取校验）
    private Map<String, Object> parameters; // 调用参数（如{city: "北京", date: "今天"}）
}
```

MCPResponse封装了工具执行的结果，包括是否成功、结构化数据、文本结果、错误信息等，核心代码如下（简化）：

```java
// bootstrap/.../mcp/MCPResponse.java
@Data
@Builder
public class MCPResponse {
    @Builder.Default
    private boolean success = true; // 是否执行成功
    private String toolId;          // 工具ID（与请求对应）
    private Map<String, Object> data; // 结构化数据（便于后续处理）
    private String textResult;      // 文本结果（直接用于返回给用户）
    private String errorMessage;    // 错误信息（执行失败时返回）
    private long costMs;            // 调用耗时（用于性能监控）
    
    // 静态方法：快速创建成功响应
    public static MCPResponse success(String toolId, String textResult) {
        return MCPResponse.builder()
                .success(true)
                .toolId(toolId)
                .textResult(textResult)
                .build();
    }
}
```

这种统一的封装，让我们在项目中能够快速处理不同工具的请求和响应，同时便于日志记录和性能监控。

## 四、完整调用流程——从用户提问到结果返回

结合我们项目的实际场景，以“用户查询北京今天的天气”为例，拆解MCP的完整调用流程，让大家更直观地理解MCP在项目中的作用。整个流程分为5个阶段，全程遵循MCP协议的标准化规范，同时融入了LLM参数提取、请求分发等核心逻辑。

### 4.1 流程概览（结合项目实际链路）

```plain
用户: "帮我查下北京今天的天气"
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  阶段1: 意图识别                                                │
│  IntentResolver → DefaultIntentClassifier                       │
│  → 识别出 MCP 意图: weather_query (0.92分)                     │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  阶段2: 判断意图类型                                             │
│  意图类型 = MCP → 走 MCP 调用流程                               │
│  意图类型 = KB  → 走向量检索流程                                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  阶段3: 参数提取 (LLMMCPParameterExtractor)                      │
│  LLM 根据工具描述，从用户问题中提取参数                          │
│  问题: "帮我查下北京今天的天气"                                 │
│  提取: { "city": "北京", "date": "今天" }                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  阶段4: 工具执行 (MCPToolExecutor)                               │
│  HttpMCPClient → 发送 JSON-RPC 请求 → MCP Server                │
│  Server: WeatherMCPExecutor → 调用天气 API                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  阶段5: 结果处理                                                  │
│  MCPResponse → 格式化 → 追加到 Prompt 上下文                    │
│  最终返回给用户: "北京今天晴，28度，适合出行"                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 关键环节解析

#### 环节1：意图识别与类型判断

用户提问后，我们的意图识别模块（IntentResolver）会对问题进行分类，通过DefaultIntentClassifier计算意图置信度。当识别出意图为MCP类型（如weather_query，置信度0.92分，高于我们设定的阈值0.8），则进入MCP调用流程；若为KB类型（需要检索知识库），则走向量检索流程。这一步确保了我们的系统能够根据不同意图选择正确的处理路径。

#### 环节2：LLM参数提取

参数提取是MCP调用的关键环节，我们通过LLMMCPParameterExtractor实现——利用LLM的理解能力，根据工具定义（MCPTool的description和parameters），从用户问题中自动提取参数。例如，用户问“帮我查下北京今天的天气”，LLM会根据天气工具的描述（“查询指定城市和日期的天气信息”），提取出city=北京、date=今天。

为了保证参数提取的准确性，我们在调用LLM时设置了temperature=0.1（低温度），避免LLM生成歧义性参数，这也是我们项目中经过多次测试得出的最优参数配置。

#### 环节3：工具执行与请求分发

调用方（Bootstrap模块）通过HttpMCPClient发送JSON-RPC格式的请求到MCP Server（遵循MCP协议的传输规范）。MCP Server接收请求后，由MCPDispatcher（请求分发器）根据请求中的toolId，从工具注册表中找到对应的执行器（如WeatherMCPExecutor），执行具体的工具逻辑——调用外部天气API，获取天气数据。

这里需要注意的是，MCP协议通过初始化握手机制确保通信安全：客户端先发送initialize请求，与服务端交换协议版本和能力集，确认握手完成后再进行正常调用，避免非法请求和版本不兼容问题。

#### 环节4：结果处理与上下文融合

MCP Server执行完成后，将结果封装为MCPResponse返回给调用方。调用方接收响应后，通过ContextFormatter格式化结果（如“工具：查天气，结果：北京今天晴，28度”），并将其追加到Prompt上下文，最终由LLM生成自然语言回答，返回给用户。

### 4.3 时序图（直观理解各组件交互）

```plain
用户        系统           LLM          Registry       Executor       MCP Server
 │           │             │              │              │              │
 │ 发送问题   │             │              │              │              │
 │──────────→│             │              │              │              │
 │           │ 意图识别    │              │              │              │
 │           │────────────→│              │              │              │
 │           │ 识别为MCP   │              │              │              │
 │           │←────────────│              │              │              │
 │           │             │              │              │              │
 │           │ 参数提取请求 │              │              │              │
 │           │────────────→│              │              │              │
 │           │ 返回参数    │              │              │              │
 │           │ {city:北京} │              │              │              │
 │           │←────────────│              │              │              │
 │           │             │              │              │              │
 │           │ 获取执行器   │              │              │              │
 │           │──────────────────────────────────────────→│              │
 │           │←──────────────────────────────────────────│              │
 │           │             │              │              │              │
 │           │ 执行工具     │              │              │              │
 │           │──────────────┼──────────────┼─────────────→│              │
 │           │             │              │              │────HTTP────→│
 │           │             │              │              │←────────────│
 │           │←─────────────┼──────────────┼──────────────┤              │
 │           │             │              │              │              │
 │           │ 调用结果    │              │              │              │
 │           │ "北京晴,28度"│              │              │              │
 │           │             │              │              │              │
 │ 返回结果   │             │              │              │              │
 │←──────────│             │              │              │              │
```

## 五、核心源码解析——项目中的关键实现

以下结合我们项目中的核心源码，解析MCP协议落地过程中的关键逻辑，包括工具注册、参数提取、HTTP客户端实现和MCP调用集成，让大家了解实际开发中的细节和考量。

### 5.1 工具注册：DefaultMCPToolRegistry

工具注册是MCP可扩展的核心，我们通过DefaultMCPToolRegistry实现工具的自动注册和管理，利用Spring的依赖注入特性，自动扫描所有MCPToolExecutor实现类，启动时完成注册。核心源码如下：

```java
// bootstrap/.../mcp/DefaultMCPToolRegistry.java
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultMCPToolRegistry implements MCPToolRegistry {
    /** 工具执行器存储: toolId → executor（线程安全，支持多线程调用） */
    private final Map<String, MCPToolExecutor> executorMap = new ConcurrentHashMap<>();
    /** 自动注入所有 MCPToolExecutor Bean（Spring扫描所有实现类） */
    private final List<MCPToolExecutor> autoDiscoveredExecutors;

    /** 启动时自动注册（PostConstruct注解：Spring初始化Bean后执行） */
    @PostConstruct
    public void init() {
        for (MCPToolExecutor executor : autoDiscoveredExecutors) {
            register(executor);  // 注册到ConcurrentHashMap
        }
        log.info("MCP 工具自动注册完成, 共注册 {} 个工具", autoDiscoveredExecutors.size());
    }

    @Override
    public void register(MCPToolExecutor executor) {
        String toolId = executor.getToolId();
        executorMap.put(toolId, executor);  // 线程安全，避免并发问题
        log.info("MCP 工具注册成功, toolId: {}", toolId);
    }

    @Override
    public Optional<MCPToolExecutor> getExecutor(String toolId) {
        return Optional.ofNullable(executorMap.get(toolId));
    }
}
```

关键设计考量：

- 使用ConcurrentHashMap存储执行器，保证多线程环境下的线程安全（项目中存在并发调用工具的场景）；
    
- 通过@PostConstruct注解，在Spring启动时自动完成工具注册，无需手动注册，降低开发成本；
    
- 提供getExecutor方法，根据toolId快速获取对应的执行器，支撑请求分发逻辑。
    

### 5.2 LLM参数提取：LLMMCPParameterExtractor

参数提取的核心是利用LLM理解用户问题和工具定义，自动提取符合要求的参数。我们的实现如下：

```java
// bootstrap/.../mcp/LLMMCPParameterExtractor.java
@Slf4j
@Service
@RequiredArgsConstructor
public class LLMMCPParameterExtractor implements MCPParameterExtractor {
    private final LLMService llmService;

    @Override
    public Map<String, Object> extractParameters(String userQuestion, MCPTool tool) {
        // 1. 构建Prompt，引导LLM提取参数
        List&lt;ChatMessage&gt; messages = new ArrayList<>();
        messages.add(ChatMessage.system(
            "你是一个参数提取助手，根据工具定义从用户问题中提取参数。" +
            "要求：只提取工具定义中存在的参数，不存在的参数不提取；" +
            "格式：返回JSON字符串，key为参数名，value为参数值，不要多余内容。"
        ));
        messages.add(ChatMessage.user("工具定义:\n" + buildToolDefinition(tool)));
        messages.add(ChatMessage.user("用户问题:\n" + userQuestion));

        // 2. 调用LLM提取参数（低温度，保证结果稳定）
        ChatRequest request = ChatRequest.builder()
                .messages(messages)
                .temperature(0.1D)
                .build();
        String raw = llmService.chat(request);
        
        // 3. 解析LLM返回的JSON，转换为Map
        return parseJsonResponse(raw, tool);
    }
}
```

关键设计考量：

- Prompt设计：明确引导LLM只提取工具定义中存在的参数，避免提取无关参数，同时指定返回格式（JSON），便于后续解析；
    
- 温度设置：temperature=0.1，让LLM生成更确定、更贴合实际需求的参数，减少歧义；
    
- 容错处理：parseJsonResponse方法中加入异常处理，若LLM返回格式错误，会返回空参数并记录日志，避免整个调用流程失败。
    

### 5.3 MCP调用集成：RetrievalEngine

RetrievalEngine是我们RAG项目的核心组件，负责整合KB检索和MCP调用，构建完整的上下文。其中，MCP调用的集成逻辑如下：

```java
// bootstrap/.../retrieve/RetrievalEngine.java
@Service
@RequiredArgsConstructor
public class RetrievalEngine {
    private final MCPToolRegistry mcpToolRegistry;
    private final MCPParameterExtractor parameterExtractor;
    private final ContextFormatter contextFormatter;

    /** 构建子问题上下文（包含 KB 和 MCP 结果） */
    private SubQuestionContext buildSubQuestionContext(SubQuestionIntent intent, int topK) {
        // 1. 过滤MCP类型意图（置信度达标、有工具ID）
        List<NodeScore> mcpIntents = filterMCPIntents(intent.nodeScores());
        
        // 2. 执行MCP调用，获取结果并格式化
        String mcpContext = CollUtil.isNotEmpty(mcpIntents)
                ? executeMcpAndMerge(intent.subQuestion(), mcpIntents)
                : "";
        
        // 3. 结合KB检索结果，构建完整上下文
        return new SubQuestionContext(intent.subQuestion(), kbContext, mcpContext);
    }

    /** 执行MCP工具调用，并行处理多个MCP意图 */
    private String executeMcpAndMerge(String question, List<NodeScore> mcpIntents) {
        // 1. 构建多个MCP请求（每个意图对应一个请求）
        List<MCPRequest> requests = mcpIntents.stream()
                .map(ns -> buildMcpRequest(question, ns.getNode()))
                .toList();

        // 2. 并行执行多个工具调用（提升效率）
        List<MCPResponse> responses = executeMcpTools(requests);

        // 3. 格式化结果，用于追加到Prompt上下文
        return contextFormatter.formatMcpContext(responses, mcpIntents);
    }

    /** 构建单个MCP请求 */
    private MCPRequest buildMcpRequest(String question, IntentNode node) {
        MCPTool tool = node.getToolDefinition();
        // 提取参数
        Map<String, Object> params = parameterExtractor.extractParameters(question, tool);
        // 构建请求（自动注入userId、conversationId等信息）
        return MCPRequest.builder()
                .toolId(node.getMcpToolId())
                .userId(userId)
                .userQuestion(question)
                .parameters(params)
                .build();
    }
}
```

关键设计考量：

- 并行调用：多个MCP意图（如同时查询天气和工单）可并行执行，提升响应速度；
    
- 上下文融合：将MCP调用结果格式化后，与KB检索结果结合，为LLM提供完整的上下文，确保回答的准确性和丰富性；
    
- 自动注入：userId、conversationId等信息自动注入，无需手动传递，提升开发效率，同时保证权限控制的统一性。
    

## 六、MCP与项目其他模块的集成

MCP并非独立存在，而是与我们项目的意图树、RAG流程、前端展示等模块深度集成，形成完整的业务闭环。以下重点介绍两个核心集成场景。

### 6.1 与意图树的集成

我们的项目通过意图树管理所有用户意图，其中MCP类型的意图（如查天气、查工单）通过数据库配置关联对应的工具ID，便于统一管理和动态调整。

#### 数据库配置（t_intent_node表）

```sql
-- t_intent_node 表：存储意图节点信息
INSERT INTO t_intent_node (intent_code, name, level, kind, description, mcp_tool_id)
VALUES 
    ('system-weather', '查天气', 'TOPIC', 'MCP', 
     '查询天气预报、气温、空气质量等信息', 'weather_query'),
    ('system-ticket', '查工单', 'TOPIC', 'MCP',
     '查询用户提交的IT工单状态', 'ticket_query');
```

#### 意图过滤逻辑

在RetrievalEngine中，通过过滤逻辑筛选出符合条件的MCP意图（置信度达标、类型为MCP、有工具ID），避免无效调用：

```java
// RetrievalEngine.java
private List<NodeScore> filterMCPIntents(List<NodeScore> nodeScores) {
    return nodeScores.stream()
            .filter(ns -> ns.getScore() >= INTENT_MIN_SCORE)  // 置信度阈值（如0.8）
            .filter(ns -> ns.getNode().getKind() == IntentKind.MCP)  // MCP类型
            .filter(ns -> StrUtil.isNotBlank(ns.getNode().getMcpToolId()))  // 有工具ID
            .toList();
}
```

### 6.2 与RAG完整流程的集成

MCP是RAG流程的重要补充，解决了RAG无法处理实时数据、动态业务操作的痛点，其在RAG完整流程中的位置如下：

```plain
┌─────────────────────────────────────────────────────────────────────┐
│                     RAG 完整流程                                     │
├─────────────────────────────────────────────────────────────────────┤
│  1. 问题接收: 用户发送 "帮我查下北京天气"                           │
│  2. 会话记忆: 加载历史对话                                          │
│  3. 问题重写: "北京今天天气如何"                                    │
│  4. 意图识别: 识别为MCP意图（weather_query，0.92分）               │
│  5. 多通道检索: 无KB意图，跳过检索                                  │
│  6. MCP 调用: 提取参数→调用工具→获取结果                           │
│  7. Prompt 构建: 融合MCP结果、历史对话、用户问题                   │
│  8. 模型调用: 生成最终回答                                          │
│  9. 流式输出: SSE 推送给前端                                        │
└─────────────────────────────────────────────────────────────────────┘
```

可以看到，MCP调用位于意图识别之后、Prompt构建之前，为LLM提供了实时的外部数据，让RAG系统不仅能“检索已有知识”，还能“调用外部工具获取新信息”，极大提升了系统的实用性。

## 七、项目实践总结与扩展方向

在我们的RAG项目中，MCP协议的落地的核心价值在于“标准化”和“可扩展”——通过统一的接口、规范的流程，解决了多工具集成的混乱问题，同时让新增工具变得简单高效（只需实现MCPToolExecutor接口，无需修改核心逻辑）。截至目前，我们的项目已通过MCP集成了天气查询、工单查询、销售数据统计3个工具，后续可快速扩展更多工具（如物流查询、支付查询等）。

### 7.1 核心收获

- 标准化带来的效率提升：统一的请求/响应格式、工具定义规范，降低了开发和维护成本，不同开发者开发的工具可无缝集成；
    
- LLM与工具的高效协同：通过LLM自动提取参数，无需用户手动输入参数，提升了用户体验；
    
- 工程化落地的合理性：分层架构（调用方-提供方）、自动注册、请求分发等设计，适配企业级项目的迭代需求。
    

### 7.2 扩展方向

- 工具权限控制：在MCPTool中增加权限字段，结合用户角色，实现不同用户只能调用对应权限的工具；
    
- 调用监控与告警：新增MCP调用监控模块，统计工具调用成功率、耗时，当调用失败或耗时过长时触发告警；
    
- 多传输方式支持：目前我们使用HTTP传输，后续可扩展WebSocket传输，支持实时工具调用（如实时消息推送）；
    
- 资源扩展：引入MCP的Resources原语，将知识库、日志等静态/动态资源纳入管理，为LLM提供更丰富的上下文支撑。
    

## 八、最后

MCP协议并非复杂的新技术，而是一套“标准化的工具调用解决方案”，其核心是通过统一的接口和流程，让AI模型能够优雅、高效地调用外部工具。在AI大模型向“Agent”演进的趋势下，工具调用能力将成为核心竞争力，而MCP这种标准化的方案，无疑能为项目的长期迭代提供有力支撑。

本文结合我们的RAG项目实践，详细拆解了MCP的设计、实现和集成细节，希望能为正在做AI工具调用的开发者提供一些参考。如果你的项目也面临多工具集成、调用不规范的问题，不妨尝试引入MCP协议，让工具调用变得更简单、更高效。
