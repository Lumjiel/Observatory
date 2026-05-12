---
title: MCP 工具实现详解
date: '2026-03-31'
category: reading
tags:
  - 阅读
excerpt: 每个 MCP 工具都需要实现 `MCPToolExecutor` 接口，核心就两个方法：
readingTime: 49 min
---
## 🎯 一、现有工具实现解析

### 1.1 工具实现模板

每个 MCP 工具都需要实现 `MCPToolExecutor` 接口，核心就两个方法：

```java
public interface MCPToolExecutor {
    
    /** 获取工具定义（用于 LLM 理解工具能力） */
    MCPToolDefinition getToolDefinition();
    
    /** 执行工具逻辑 */
    MCPToolResponse execute(MCPToolRequest request);
}
```

### 1.2 WeatherMCPExecutor 详解

```java
// mcp-server/.../executor/WeatherMCPExecutor.java
@Slf4j
@Component  // 自动注册到 Spring 容器
public class WeatherMCPExecutor implements MCPToolExecutor {

    private static final String TOOL_ID = "weather_query";  // 工具唯一标识

    @Override
    public MCPToolDefinition getToolDefinition() {
        // 1. 定义参数
        Map<String, MCPToolDefinition.ParameterDef> parameters = new LinkedHashMap<>();
        
        parameters.put("city", MCPToolDefinition.ParameterDef.builder()
                .description("城市名称，如北京、上海、广州等")  // LLM 理解用
                .type("string")
                .required(true)  // 必填参数
                .build());

        parameters.put("queryType", MCPToolDefinition.ParameterDef.builder()
                .description("查询类型：current(当前天气)、forecast(未来预报)")
                .type("string")
                .required(false)
                .defaultValue("current")  // 默认值
                .enumValues(List.of("current", "forecast"))  // 枚举值
                .build());

        // 2. 返回工具定义
        return MCPToolDefinition.builder()
                .toolId(TOOL_ID)
                .description("查询城市天气信息，支持查看当前实时天气...")
                .parameters(parameters)
                .requireUserId(false)  // 是否需要用户 ID
                .build();
    }

    @Override
    public MCPToolResponse execute(MCPToolRequest request) {
        try {
            // 1. 获取参数
            String city = request.getStringParameter("city");
            String queryType = request.getStringParameter("queryType");
            Integer days = request.getParameter("days");

            // 2. 参数校验
            if (city == null || city.isBlank()) {
                return MCPToolResponse.error(TOOL_ID, "INVALID_PARAMS", "请提供城市名称");
            }

            // 3. 执行业务逻辑
            String result = switch (queryType) {
                case "forecast" -> buildForecastResult(city, days);
                default -> buildCurrentResult(city);
            };

            // 4. 返回成功响应
            return MCPToolResponse.success(TOOL_ID, result);
        } catch (Exception e) {
            // 5. 异常处理
            log.error("天气数据查询失败", e);
            return MCPToolResponse.error(TOOL_ID, "EXECUTION_ERROR", "查询失败: " + e.getMessage());
        }
    }
}
```

### 1.3 TicketMCPExecutor 详解

```java
@Slf4j
@Component
public class TicketMCPExecutor implements MCPToolExecutor {

    private static final String TOOL_ID = "ticket_query";

    @Override
    public MCPToolDefinition getToolDefinition() {
        Map<String, MCPToolDefinition.ParameterDef> parameters = new LinkedHashMap<>();

        // 地区筛选
        parameters.put("region", MCPToolDefinition.ParameterDef.builder()
                .description("地区筛选：华东、华南、华北、西南、西北")
                .type("string")
                .required(false)
                .enumValues(List.of("华东", "华南", "华北", "西南", "西北"))
                .build());

        // 状态筛选
        parameters.put("status", MCPToolDefinition.ParameterDef.builder()
                .description("工单状态：待处理、处理中、已解决、已关闭")
                .type("string")
                .required(false)
                .enumValues(List.of("待处理", "处理中", "已解决", "已关闭"))
                .build());

        // 优先级筛选
        parameters.put("priority", MCPToolDefinition.ParameterDef.builder()
                .description("优先级：紧急、高、中、低")
                .type("string")
                .required(false)
                .enumValues(List.of("紧急", "高", "中", "低"))
                .build());

        // 查询类型
        parameters.put("queryType", MCPToolDefinition.ParameterDef.builder()
                .description("查询类型：summary(汇总)、list(列表)、stats(统计)")
                .type("string")
                .required(false)
                .defaultValue("summary")
                .enumValues(List.of("summary", "list", "stats"))
                .build());

        return MCPToolDefinition.builder()
                .toolId(TOOL_ID)
                .description("查询客户技术支持工单数据...")
                .parameters(parameters)
                .requireUserId(true)  // 需要用户 ID
                .build();
    }

    @Override
    public MCPToolResponse execute(MCPToolRequest request) {
        // 1. 获取所有参数
        String region = request.getStringParameter("region");
        String status = request.getStringParameter("status");
        String priority = request.getStringParameter("priority");
        String queryType = request.getStringParameter("queryType");
        Integer limit = request.getParameter("limit");

        // 2. 默认值处理
        if (queryType == null) queryType = "summary";
        if (limit == null) limit = 10;

        // 3. 筛选数据
        List<TicketRecord> filtered = filterData(region, status, priority);

        // 4. 根据类型构建不同结果
        String result = switch (queryType) {
            case "list" -> buildListResult(filtered, limit);
            case "stats" -> buildStatsResult(filtered);
            default -> buildSummaryResult(filtered);
        };

        return MCPToolResponse.success(TOOL_ID, result);
    }
}
```

---

## 📊 二、核心数据结构

### 2.1 MCPToolDefinition（工具定义）

```java
@Data
@Builder
public class MCPToolDefinition {
    
    /** 工具唯一标识 */
    private String toolId;
    
    /** 工具描述（LLM 理解用） */
    private String description;
    
    /** 参数定义 */
    private Map<String, ParameterDef> parameters;
    
    /** 是否需要用户 ID */
    @Builder.Default
    private boolean requireUserId = true;
    
    /** 参数定义 */
    @Data
    @Builder
    public static class ParameterDef {
        private String description;      // 参数描述
        private String type;            // 参数类型：string, integer, boolean
        private boolean required;       // 是否必填
        private Object defaultValue;    // 默认值
        private List<String> enumValues; // 枚举值
    }
}
```

### 2.2 MCPToolRequest（请求）

```java
@Data
@Builder
public class MCPToolRequest {
    
    private String toolId;           // 工具 ID
    private String userId;           // 用户 ID（自动注入）
    private String conversationId;   // 会话 ID
    private String userQuestion;     // 原始问题
    private Map<String, Object> parameters;  // 参数
    
    // 便捷方法
    public String getStringParameter(String key);
    public Integer getParameter(String key);
    public String getStringOrDefault(String key, String defaultValue);
}
```

### 2.3 MCPToolResponse（响应）

```java
@Data
@Builder
public class MCPToolResponse {
    
    @Builder.Default
    private boolean success = true;
    private String toolId;
    private Map<String, Object> data;  // 结构化数据
    private String textResult;          // 文本结果
    private String errorMessage;        // 错误信息
    private String errorCode;           // 错误码
    private long costMs;                // 耗时
    
    // 工厂方法
    public static MCPToolResponse success(String toolId, String textResult);
    public static MCPToolResponse error(String toolId, String errorCode, String message);
}
```

---

## 🔧 三、扩展新工具完整指南

### 3.1 扩展步骤概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        扩展新工具步骤                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: 创建执行器类                                                │
│          新建 XxxMCPExecutor.java 实现 MCPToolExecutor              │
│                                                                     │
│  Step 2: 定义工具元信息                                              │
│          getToolDefinition() 返回工具名称、参数、描述                 │
│                                                                     │
│  Step 3: 实现执行逻辑                                                │
│          execute() 方法实现具体业务逻辑                              │
│                                                                     │
│  Step 4: 自动注册                                                   │
│          添加 @Component 注解，Spring 自动扫描注册                   │
│                                                                     │
│  Step 5: 配置意图树                                                  │
│          数据库 t_intent_node 表添加 MCP 类型节点                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Step 1: 创建执行器类

在 `mcp-server/src/main/java/com/nageoffer/ai/ragent/mcp/executor/` 目录下创建：

```java
package com.nageoffer.ai.ragent.mcp.executor;

import com.nageoffer.ai.ragent.mcp.core.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class BookMCPExecutor implements MCPToolExecutor {

    private static final String TOOL_ID = "book_search";  // 工具 ID

    @Override
    public MCPToolDefinition getToolDefinition() {
        // 定义参数
        Map<String, MCPToolDefinition.ParameterDef> parameters = new LinkedHashMap<>();

        parameters.put("bookName", MCPToolDefinition.ParameterDef.builder()
                .description("书名关键字，支持模糊匹配")
                .type("string")
                .required(false)
                .build());

        parameters.put("author", MCPToolDefinition.ParameterDef.builder()
                .description("作者名称")
                .type("string")
                .required(false)
                .build());

        parameters.put("category", MCPToolDefinition.ParameterDef.builder()
                .description("图书分类")
                .type("string")
                .required(false)
                .enumValues(List.of("小说", "科技", "历史", "儿童", "经济"))
                .build());

        parameters.put("limit", MCPToolDefinition.ParameterDef.builder()
                .description("返回数量限制，默认5本")
                .type("integer")
                .required(false)
                .defaultValue(5)
                .build());

        return MCPToolDefinition.builder()
                .toolId(TOOL_ID)
                .description("搜索图书信息，支持按书名、作者、分类查询，返回图书详情")
                .parameters(parameters)
                .requireUserId(false)
                .build();
    }

    @Override
    public MCPToolResponse execute(MCPToolRequest request) {
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. 获取参数
            String bookName = request.getStringParameter("bookName");
            String author = request.getStringParameter("author");
            String category = request.getStringParameter("category");
            Integer limit = request.getParameter("limit");
            
            if (limit == null || limit <= 0) limit = 5;

            // 2. 校验（业务规则）
            if ((bookName == null || bookName.isBlank()) 
                && (author == null || author.isBlank())) {
                return MCPToolResponse.error(TOOL_ID, "INVALID_PARAMS", 
                    "请提供书名或作者名称");
            }

            // 3. 执行业务逻辑（调用外部 API / 数据库）
            List<Map<String, Object>> books = searchBooks(bookName, author, category, limit);

            // 4. 构建结果
            String result = formatBooksResult(books);

            long costMs = System.currentTimeMillis() - startTime;
            return MCPToolResponse.builder()
                    .success(true)
                    .toolId(TOOL_ID)
                    .data(Map.of("books", books, "total", books.size()))
                    .textResult(result)
                    .costMs(costMs)
                    .build();

        } catch (Exception e) {
            log.error("图书搜索失败", e);
            return MCPToolResponse.error(TOOL_ID, "EXECUTION_ERROR", 
                "搜索失败: " + e.getMessage());
        }
    }

    private List<Map<String, Object>> searchBooks(String bookName, String author, 
                                                   String category, int limit) {
        // TODO: 实现实际的搜索逻辑
        // 可以调用外部 API、查询数据库等
        return new ArrayList<>();
    }

    private String formatBooksResult(List<Map<String, Object>> books) {
        if (books.isEmpty()) {
            return "未找到相关图书";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("【图书搜索结果】共 ").append(books.size()).append(" 本\n\n");

        for (int i = 0; i < books.size(); i++) {
            Map<String, Object> book = books.get(i);
            sb.append(String.format("%d. 《%s》\n", i + 1, book.get("name")));
            sb.append(String.format("   作者: %s\n", book.get("author")));
            sb.append(String.format("   分类: %s\n", book.get("category")));
            sb.append(String.format("   价格: ¥%s\n\n", book.get("price")));
        }

        return sb.toString().trim();
    }
}
```

### 3.3 Step 2: 核心要点

#### 2.1 参数定义要点

```java
parameters.put("参数名", MCPToolDefinition.ParameterDef.builder()
    .description("描述（LLM 用）")      // 必须清晰，LLM 根据这个理解
    .type("string/integer/boolean")   // 参数类型
    .required(true/false)              // 是否必填
    .defaultValue("默认值")            // 可选
    .enumValues(List.of("A", "B"))     // 可选，限制枚举值
    .build());
```

#### 2.2 错误处理

```java
// 参数错误
return MCPToolResponse.error(TOOL_ID, "INVALID_PARAMS", "错误信息");

// 业务错误
return MCPToolResponse.error(TOOL_ID, "BUSINESS_ERROR", "错误信息");

// 系统异常
return MCPToolResponse.error(TOOL_ID, "EXECUTION_ERROR", "系统错误: " + e.getMessage());
```

#### 2.3 成功响应

```java
// 纯文本结果
return MCPToolResponse.success(TOOL_ID, "查询结果文本");

// 带结构化数据
return MCPToolResponse.builder()
    .success(true)
    .toolId(TOOL_ID)
    .data(Map.of("key", value))       // 结构化数据
    .textResult("格式化文本")          // 人类可读文本
    .costMs(costMs)
    .build();
```

---

## 🗄️ 四、配置意图树

工具创建后，需要在数据库中配置意图树，让系统知道何时调用：

### 4.1 数据库表结构

```sql
-- t_intent_node 表
INSERT INTO t_intent_node (
    intent_code,      -- 意图编码
    name,             -- 节点名称
    level,            -- 层级: DOMAIN/CATEGORY/TOPIC
    kind,             -- 类型: KB/KB_AND_MCP/MCP/SYSTEM
    description,      -- 描述
    mcp_tool_id,      -- MCP 工具 ID（重要！）
    status,           -- 状态: 0-禁用, 1-启用
    version           -- 版本
) VALUES (
    'system-book-search',
    '图书搜索',
    'TOPIC',
    'MCP',
    '搜索图书信息、查询书籍详情',
    'book_search',    -- 对应 MCPToolDefinition.toolId
    1,
    1
);
```

### 4.2 kind 类型说明

| 类型 | 说明 | 触发条件 |
|------|------|----------|
| `KB` | 知识库检索 | 只检索知识库 |
| `KB_AND_MCP` | 混合模式 | 同时检索知识库 + 调用 MCP |
| `MCP` | 仅 MCP 调用 | 只调用 MCP 工具 |
| `SYSTEM` | 系统功能 | 特殊系统处理 |

---

## 📋 五、完整示例：创建新闻搜索工具

### 5.1 NewsMCPExecutor.java

```java
package com.nageoffer.ai.ragent.mcp.executor;

import com.nageoffer.ai.ragent.mcp.core.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Component
public class NewsMCPExecutor implements MCPToolExecutor {

    private static final String TOOL_ID = "news_search";

    @Override
    public MCPToolDefinition getToolDefinition() {
        Map<String, MCPToolDefinition.ParameterDef> parameters = new LinkedHashMap<>();

        parameters.put("keyword", MCPToolDefinition.ParameterDef.builder()
                .description("新闻关键词，用于搜索新闻标题和内容")
                .type("string")
                .required(true)
                .build());

        parameters.put("category", MCPToolDefinition.ParameterDef.builder()
                .description("新闻分类：科技、财经、体育、娱乐、社会")
                .type("string")
                .required(false)
                .enumValues(List.of("科技", "财经", "体育", "娱乐", "社会"))
                .build());

        parameters.put("timeRange", MCPToolDefinition.ParameterDef.builder()
                .description("时间范围：today、week、month、year")
                .type("string")
                .required(false)
                .defaultValue("week")
                .enumValues(List.of("today", "week", "month", "year"))
                .build());

        parameters.put("limit", MCPToolDefinition.ParameterDef.builder()
                .description("返回新闻数量，默认5条")
                .type("integer")
                .required(false)
                .defaultValue(5)
                .build());

        return MCPToolDefinition.builder()
                .toolId(TOOL_ID)
                .description("搜索新闻资讯，获取指定关键词的最新新闻报道")
                .parameters(parameters)
                .requireUserId(false)
                .build();
    }

    @Override
    public MCPToolResponse execute(MCPToolRequest request) {
        long startTime = System.currentTimeMillis();

        try {
            // 获取参数
            String keyword = request.getStringParameter("keyword");
            String category = request.getStringParameter("category");
            String timeRange = request.getStringParameter("timeRange");
            Integer limit = request.getParameter("limit");

            // 参数校验
            if (keyword == null || keyword.isBlank()) {
                return MCPToolResponse.error(TOOL_ID, "INVALID_PARAMS", "请提供搜索关键词");
            }

            // 默认值
            if (timeRange == null) timeRange = "week";
            if (limit == null || limit <= 0) limit = 5;
            if (limit > 20) limit = 20;

            // 搜索新闻
            List<NewsItem> newsList = searchNews(keyword, category, timeRange, limit);

            // 格式化结果
            String result = formatNewsResult(newsList, keyword);

            long costMs = System.currentTimeMillis() - startTime;
            return MCPToolResponse.builder()
                    .success(true)
                    .toolId(TOOL_ID)
                    .textResult(result)
                    .costMs(costMs)
                    .build();

        } catch (Exception e) {
            log.error("新闻搜索失败", e);
            return MCPToolResponse.error(TOOL_ID, "EXECUTION_ERROR", 
                "搜索失败: " + e.getMessage());
        }
    }

    private List<NewsItem> searchNews(String keyword, String category, 
                                       String timeRange, int limit) {
        // TODO: 调用实际新闻 API
        // 例如: 聚合新闻 API、RSS 订阅、自有新闻库等
        return new ArrayList<>();
    }

    private String formatNewsResult(List<NewsItem> newsList, String keyword) {
        if (newsList.isEmpty()) {
            return String.format("未找到与「%s」相关的新闻", keyword);
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("【%s 相关新闻】共 %d 条\n\n", keyword, newsList.size()));

        for (int i = 0; i < newsList.size(); i++) {
            NewsItem news = newsList.get(i);
            sb.append(String.format("%d. %s\n", i + 1, news.title));
            sb.append(String.format("   来源: %s | 时间: %s\n", 
                news.source, news.publishTime));
            sb.append(String.format("   摘要: %s\n\n", news.summary));
        }

        return sb.toString().trim();
    }

    // 内部类
    private static class NewsItem {
        String title;
        String source;
        String publishTime;
        String summary;
        String url;
    }
}
```

### 5.2 数据库配置

```sql
-- 添加意图节点
INSERT INTO t_intent_node (
    intent_code, name, level, kind, description, mcp_tool_id, status, version
) VALUES (
    'system-news-search',
    '新闻搜索',
    'TOPIC',
    'MCP',
    '搜索最新新闻、查询资讯报道',
    'news_search',
    1,
    1
);

-- 添加问法示例（提高识别准确率）
INSERT INTO t_intent_node_example (node_id, example_text)
VALUES 
    ((SELECT id FROM t_intent_node WHERE intent_code = 'system-news-search'), 
     '最近有什么科技新闻'),
    ((SELECT id FROM t_intent_node WHERE intent_code = 'system-news-search'), 
     '帮我搜索一下人工智能相关的新闻'),
    ((SELECT id FROM t_intent_node WHERE intent_code = 'system-news-search'), 
     '今天有什么财经新闻');
```

---

## 🔄 六、工具注册机制

### 6.1 Spring 自动扫描

```java
// MCPToolRegistry 实现类
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultMCPToolRegistry implements MCPToolRegistry {

    private final Map<String, MCPToolExecutor> executorMap = new ConcurrentHashMap<>();
    
    // 自动注入所有 MCPToolExecutor Bean
    private final List<MCPToolExecutor> autoDiscoveredExecutors;

    @PostConstruct
    public void init() {
        // 启动时自动注册
        for (MCPToolExecutor executor : autoDiscoveredExecutors) {
            register(executor);
        }
        log.info("MCP 工具自动注册完成, 共注册 {} 个工具", 
                 autoDiscoveredExecutors.size());
    }

    @Override
    public void register(MCPToolExecutor executor) {
        String toolId = executor.getToolId();
        executorMap.put(toolId, executor);
    }
}
```

### 6.2 注册流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        工具注册流程                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Spring Boot 启动                                                    │
│       │                                                             │
│       ▼                                                             │
│  ComponentScan 扫描                                                  │
│  → 找到所有 @Component 的 MCPToolExecutor                          │
│       │                                                             │
│       ▼                                                             │
│  DefaultMCPToolRegistry 构造函数注入                                  │
│  → List<MCPToolExecutor> autoDiscoveredExecutors                   │
│       │                                                             │
│       ▼                                                             │
│  @PostConstruct init() 执行                                          │
│  → for executor : autoDiscoveredExecutors                          │
│  → executorMap.put(toolId, executor)                               │
│       │                                                             │
│       ▼                                                             │
│  工具注册完成 ✓                                                       │
│                                                                     │
│  用户提问时：                                                         │
│  → MCPToolRegistry.getExecutor(toolId)                              │
│  → 执行 executor.execute(request)                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 七、文件位置速查

| 文件 | 位置 | 说明 |
|------|------|------|
| 工具执行器接口 | `mcp-server/.../core/MCPToolExecutor.java` | 定义接口 |
| 工具定义 | `mcp-server/.../core/MCPToolDefinition.java` | 工具元信息 |
| 请求 | `mcp-server/.../core/MCPToolRequest.java` | 请求参数 |
| 响应 | `mcp-server/.../core/MCPToolResponse.java` | 返回结果 |
| 天气工具 | `mcp-server/.../executor/WeatherMCPExecutor.java` | 示例1 |
| 工单工具 | `mcp-server/.../executor/TicketMCPExecutor.java` | 示例2 |
| 注册表 | `mcp-server/.../core/DefaultMCPToolRegistry.java` | 自动注册 |

---

## 💡 八、总结

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP 工具开发要点                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 实现接口                                                         │
│     MCPToolExecutor → getToolDefinition() + execute()              │
│                                                                     │
│  2. 工具定义                                                         │
│     - toolId: 唯一标识                                               │
│     - description: LLM 理解用描述                                   │
│     - parameters: 参数定义（类型、是否必填、默认值、枚举）           │
│     - requireUserId: 是否需要用户 ID                                 │
│                                                                     │
│  3. 执行逻辑                                                         │
│     - 参数获取: request.getStringParameter()                        │
│     - 参数校验: 必填检查、值域检查                                    │
│     - 业务处理: 调用外部 API / 数据库                                 │
│     - 结果构建: MCPToolResponse.success() / error()                 │
│                                                                     │
│  4. 自动注册                                                         │
│     添加 @Component → Spring 自动扫描注册                            │
│                                                                     │
│  5. 意图配置                                                         │
│     数据库 t_intent_node 添加 MCP 类型节点                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
