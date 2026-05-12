---
title: SSE推送原理与落地实现
date: '2026-03-23'
category: reading
tags:
  - 阅读
excerpt: >-
  在现代Web开发中，实时交互已成为提升用户体验的核心需求之一——从AI流式回答的“打字机效果”，到系统实时通知、股票行情更新，都需要服务端向客户端高效、稳定地推送数据。而SSE（Server-Sent...
readingTime: 24 min
---
在现代Web开发中，实时交互已成为提升用户体验的核心需求之一——从AI流式回答的“打字机效果”，到系统实时通知、股票行情更新，都需要服务端向客户端高效、稳定地推送数据。而SSE（Server-Sent Events，服务端推送事件）作为一种轻量级的实时通信方案，凭借其基于HTTP协议、自动重连、易于实现的优势，在各类实时场景中被广泛应用。本文将结合实际项目代码，详细拆解SSE的实现原理、项目落地细节，并扩展开发中的注意事项与优化方向，帮助开发者快速掌握SSE的实战用法。

## 一、先搞懂：什么是SSE？

SSE是一种基于HTTP协议的服务器向客户端单向推送数据的技术，它打破了传统HTTP“请求-响应”的单向通信模式，允许服务端在没有客户端请求的情况下，主动向客户端发送数据。与其他实时通信方案相比，SSE具有以下核心特点，使其在特定场景下具备不可替代的优势：

- **单向通信**：仅支持服务端向客户端推送数据，客户端无法通过SSE向服务端发送数据，适用于“只需要服务端推送”的场景（如AI流式输出、实时通知）。
    
- **基于HTTP协议**：无需额外搭建独立的通信协议（如WebSocket的WS/WSS协议），可直接复用现有HTTP服务的端口、域名，降低部署和维护成本。
    
- **自动重连机制**：当客户端与服务端的连接意外中断时，浏览器会自动尝试重连（默认间隔3秒），无需开发者手动实现重连逻辑，提升稳定性。
    
- **轻量易用**：客户端仅需通过原生EventSource API即可接收数据，服务端实现简单，无需复杂的握手流程，开发成本低。
    
- **文本协议**：推送的数据以文本格式传输，支持JSON、纯文本等格式，适配大多数Web场景，但不支持二进制数据（若需二进制推送，可考虑WebSocket）。
    

简单来说，SSE就像“服务端给客户端订阅的一份报纸”，客户端订阅后，服务端会持续将新内容推送给客户端，无需客户端反复询问。

## 二、项目实战：SSE的核心实现（基于Spring Boot）

本文结合实际项目（AI对话系统），拆解SSE的落地实现。项目中使用Spring Boot的SseEmitter组件作为底层支撑，封装了SseEmitterSender工具类，用于统一管理SSE连接、发送事件，确保线程安全和连接稳定性。

### 2.1 核心工具类：SseEmitterSender

位置：`/framework/src/main/java/com/nageoffer/ai/ragent/framework/web/SseEmitterSender.java`，该类封装了SSE的发送、关闭、异常处理等核心逻辑，是项目中SSE推送的核心入口。

```java
public class SseEmitterSender {
    
    // Spring提供的SSE核心组件，负责维护连接、发送数据
    private final SseEmitter emitter;           
    // 原子布尔值，用于标记连接状态，保证线程安全（防止并发关闭）
    private final AtomicBoolean closed = new AtomicBoolean(false);  
    
    // 构造方法：初始化SSE连接，可设置超时时间（默认30秒，可根据需求调整）
    public SseEmitterSender() {
        // 无参构造，默认超时时间（可通过SseEmitter(int timeout)设置具体超时时间）
        this.emitter = new SseEmitter();
    }
    
    // 重载构造：支持自定义超时时间（单位：毫秒）
    public SseEmitterSender(long timeout) {
        this.emitter = new SseEmitter(timeout);
    }
    
    /**
     * 发送SSE事件（支持命名事件和无命名事件）
     * @param eventName 事件名称（可为null，null时为无命名事件）
     * @param data 推送的数据（支持JSON、String等格式）
     */
    public void sendEvent(String eventName, Object data) {
        // 校验连接状态，若已关闭则抛出异常
        if (closed.get()) {
            throw new ServiceException("SSE connection has already closed");
        }
        try {
            if (eventName == null || eventName.trim().isEmpty()) {
                // 发送无命名事件，客户端通过onmessage监听
                emitter.send(data);
            } else {
                // 发送命名事件，客户端通过addEventListener(eventName)监听
                emitter.send(SseEmitter.event().name(eventName).data(data));
            }
        } catch (Exception e) {
            // 发送失败时，关闭连接并处理异常
            fail(e);
        }
    }
    
    /**
     * 正常关闭SSE连接（推送完成后调用）
     */
    public void complete() {
        // CAS操作（compareAndSet）：确保连接只被关闭一次，避免并发问题
        if (closed.compareAndSet(false, true)) {
            emitter.complete();
        }
    }
    
    /**
     * 异常关闭SSE连接（发送失败、客户端断开等场景）
     * @param throwable 异常信息
     */
    public void fail(Throwable throwable) {
        closeWithError(throwable);
    }
    
    /**
     * 私有方法：统一处理连接关闭（带异常信息）
     */
    private void closeWithError(Throwable throwable) {
        if (closed.compareAndSet(false, true)) {
            emitter.completeWithError(throwable);
        }
    }
    
    //  getter方法：获取底层SseEmitter，用于Controller层返回给客户端
    public SseEmitter getEmitter() {
        return emitter;
    }
}
```

### 2.2 核心设计亮点解析

这个封装类看似简单，却包含了实际开发中必须关注的细节，避免了SSE使用过程中的常见问题：

1. **线程安全设计**：使用`AtomicBoolean`标记连接状态，通过CAS（compareAndSet）操作确保连接只被关闭一次，避免多线程并发关闭导致的异常（如重复关闭、连接泄漏）。
    
2. **幂等关闭**：无论调用多少次`complete()`或`fail()`，连接只会被关闭一次，防止因业务逻辑重复调用导致的异常。
    
3. **事件灵活支持**：支持两种事件类型——无命名事件（默认）和命名事件。命名事件可用于区分不同类型的推送（如“message”用于推送消息，“error”用于推送错误信息），客户端可按需监听。
    
4. **异常统一处理**：发送数据时若出现异常（如客户端断开连接、网络异常），会自动调用`fail()`方法关闭连接，避免连接长期占用资源，造成内存泄漏。
    

## 三、实际应用：AI流式对话中的SSE落地

在项目的RAG（检索增强生成）对话模块中，AI生成回答时需要实现“打字机效果”——即AI生成一个字，就向客户端推送一个字，让用户实时看到回答过程，提升交互体验。这正是SSE的典型应用场景，下面结合代码拆解具体实现流程。

### 3.1 业务层调用（RAGChatServiceImpl）

位置：`/bootstrap/src/main/java/com/nageoffer/ai/ragent/rag/service/impl/RAGChatServiceImpl.java`，核心方法`streamChat`负责处理AI对话请求，并通过SSE流式推送回答内容。

```java
/**
 * AI流式对话接口（SSE推送）
 * @param question 用户问题
 * @param conversationId 对话ID（用于关联历史对话）
 * @param deepThinking 是否深度思考
 * @param emitter SSE发射器（由Controller层传入）
 */
public void streamChat(String question, String conversationId, 
                       Boolean deepThinking, SseEmitter emitter) {
    // 1. 前置校验：对话ID、问题非空校验
    if (StringUtils.isBlank(question) || StringUtils.isBlank(conversationId)) {
        throw new BusinessException("Question and conversationId cannot be blank");
    }
    
    // 2. 初始化SSE发送器（封装后的工具类）
    SseEmitterSender sseSender = new SseEmitterSender(60000); // 超时时间设置为60秒
    // 3. 创建回调处理器：用于接收AI生成的流式内容，并通过SSE推送
    StreamCallback callback = callbackFactory.createChatEventHandler(
        sseSender, conversationId, taskId);
    
    try {
        // 4. 调用AI接口，获取流式回答（核心业务逻辑）
        // 此处省略AI调用细节，核心是：AI生成内容时，会逐段调用callback.onContent()
        aiStreamService.generateStream(question, conversationId, deepThinking, callback);
    } catch (Exception e) {
        // 5. 异常处理：推送错误信息，并关闭SSE连接
        sseSender.sendEvent("error", "AI response failed: " + e.getMessage());
        sseSender.fail(e);
    }
}

// 回调处理器核心方法（StreamCallback接口）
public interface StreamCallback {
    // 接收AI生成的流式内容（逐字/逐句）
    void onContent(String content);
    // 推送完成（AI生成结束）
    void onComplete();
    // 推送异常
    void onError(Throwable throwable);
}
```

### 3.2 Controller层暴露接口

Controller层负责接收客户端的SSE订阅请求，创建SseEmitter实例，并将其传入业务层，完成连接建立：

```java
@RestController
@RequestMapping("/api/chat")
public class RAGChatController {

    @Autowired
    private RAGChatService ragChatService;

    /**
     * 流式对话接口（SSE推送）
     */
    @GetMapping("/stream")
    public SseEmitter streamChat(@RequestParam String question,
                                 @RequestParam String conversationId,
                                 @RequestParam(required = false, defaultValue = "false") Boolean deepThinking) {
        // 1. 创建SSE发射器（默认超时时间30秒，可根据需求调整）
        SseEmitter emitter = new SseEmitter();
        // 2. 异步调用业务层方法，避免阻塞主线程
        CompletableFuture.runAsync(() -> {
            try {
                ragChatService.streamChat(question, conversationId, deepThinking, emitter);
            } catch (Exception e) {
                try {
                    // 异常时推送错误信息，并关闭连接
                    emitter.send(SseEmitter.event().name("error").data("Service error: " + e.getMessage()));
                    emitter.completeWithError(e);
                } catch (IOException ex) {
                    log.error("SSE send error failed", ex);
                }
            }
        });
        // 3. 返回发射器，建立SSE连接
        return emitter;
    }
}
```

### 3.3 客户端接收实现（前端）

客户端通过原生`EventSource` API订阅SSE连接，监听服务端推送的事件，实现“打字机效果”：

```javascript
// 初始化SSE连接（订阅流式对话接口）
function initSSE(question, conversationId) {
    // 1. 创建EventSource实例，指定SSE接口地址
    const source = new EventSource(`/api/chat/stream?question=${encodeURIComponent(question)}&conversationId=${conversationId}`);
    
    // 2. 监听无命名事件（默认事件）
    source.onmessage = function(event) {
        // 接收服务端推送的内容，追加到页面（打字机效果）
        document.getElementById("chat-content").innerText += event.data;
    };
    
    // 3. 监听命名事件（如error事件）
    source.addEventListener("error", function(event) {
        console.error("SSE error:", event.data);
        // 显示错误信息
        document.getElementById("chat-content").innerText += "\n【错误】" + event.data;
        // 关闭连接
        source.close();
    });
    
    // 4. 监听连接关闭事件
    source.addEventListener("close", function() {
        console.log("SSE connection closed");
        // 可在此处实现重连逻辑（可选，浏览器默认会自动重连）
    });
    
    // 5. 页面关闭时，主动关闭SSE连接
    window.addEventListener("beforeunload", function() {
        source.close();
    });
    
    return source;
}
```

## 四、SSE工作原理详解

结合项目中的实现，我们可以清晰地梳理出SSE的完整工作流程，从连接建立到数据推送，再到连接关闭，每一步都有明确的逻辑：

### 4.1 核心工作流程图

```plain
┌─────────────────────────────────────────────────────────────┐
│                     SSE 推送流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  前端: const source = new EventSource("/api/chat/stream")   │
│                                                             │
│         ↓  建立连接（HTTP GET请求，携带参数）                 │
│  ┌─────────────────────────────────────┐                   │
│  │     HTTP 连接 (Keep-Alive)          │                   │
│  │     请求头：Accept: text/event-stream                    │
│  │     响应头：Content-Type: text/event-stream              │
│  └─────────────────────────────────────┘                   │
│         ↓  服务端创建SseEmitter，返回200状态码（连接建立）    │
│  后端: SseEmitter emitter = new SseEmitter();               │
│        SseEmitterSender sseSender = new SseEmitterSender(emitter);
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │  循环发送数据块（AI逐字生成，逐字推送）                   │
│  │  sseSender.sendEvent(null, "你")    │                   │
│  │  sseSender.sendEvent(null, "好")    │                   │
│  │  sseSender.sendEvent(null, "！")    │                   │
│  └─────────────────────────────────────┘                   │
│         ↓  客户端接收数据，渲染打字机效果                     │
│  前端收到: 你好！                                            │
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │  推送完成（AI生成结束）              │                   │
│  │  sseSender.complete()               │                   │
│  └─────────────────────────────────────┘                   │
│         ↓  服务端发送结束标识，关闭连接                       │
│  前端: source.onclose() 触发，连接关闭                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 关键细节补充

- **连接建立**：客户端通过`EventSource`发起HTTP GET请求，请求头中会携带`Accept: text/event-stream`，告知服务端“我要接收SSE推送”；服务端返回响应头`Content-Type: text/event-stream`，并保持HTTP连接（Keep-Alive），不立即关闭响应流。
    
- **数据格式**：SSE推送的数据有固定格式（每行以`\n`结尾），格式为`data: 内容\n\n`；若为命名事件，格式为`event: 事件名\ndata: 内容\n\n`。Spring的SseEmitter会自动封装该格式，开发者无需手动拼接。
    
- **超时处理**：SseEmitter默认超时时间为30秒，若30秒内无数据推送，连接会自动关闭。项目中可根据业务场景调整超时时间（如AI流式回答可能需要更长时间，设置为60秒）。
    
- **自动重连**：若连接意外中断（如网络波动、服务端重启），浏览器会自动尝试重连，默认间隔3秒。若需自定义重连间隔，可在客户端监听`error`事件，手动实现重连逻辑。
    

## 五、SSE与WebSocket对比

很多开发者会混淆SSE和WebSocket，两者都是实时通信方案，但适用场景不同。结合项目实际，我们整理了两者的核心对比，帮助大家在选型时做出正确决策：

|对比维度|SSE|WebSocket|
|---|---|---|
|通信方向|单向（服务端→客户端）|双向（服务端↔客户端）|
|底层协议|HTTP协议（复用现有HTTP服务）|WS/WSS协议（独立于HTTP）|
|自动重连|✅ 浏览器原生支持，无需手动实现|❌ 需手动实现重连逻辑|
|数据类型|仅支持文本（JSON、String等）|支持文本、二进制数据（如图片、文件）|
|连接数限制|无特殊限制（复用HTTP连接池）|有浏览器限制（单域名默认6个连接）|
|开发成本|低（客户端原生API，服务端Spring封装）|高（需处理握手、心跳、重连等）|
|适用场景|AI流式输出、实时通知、行情推送（单向推送）|实时聊天、在线游戏、协同编辑（双向交互）|

项目中选择SSE而非WebSocket，核心原因是：AI流式对话仅需服务端向客户端推送数据，无需客户端反向发送数据，SSE的轻量、自动重连特性更贴合需求，且无需额外搭建WebSocket服务，降低了开发和部署成本。

## 六、开发注意事项与优化方向

在实际项目落地SSE时，除了核心实现，还需要关注以下细节，避免出现连接泄漏、推送延迟、并发问题等：

### 6.1 连接管理与资源释放

- **避免连接泄漏**：客户端关闭页面时，需主动调用`source.close()`关闭SSE连接；服务端在推送完成、异常时，必须调用`complete()`或`fail()`关闭连接，避免连接长期占用内存和端口。
    
- **连接池管理**：若系统并发量较高（如大量用户同时使用AI流式对话），可引入SSE连接池，统一管理连接的创建、复用和销毁，避免频繁创建SseEmitter导致的资源浪费。
    

### 6.2 超时与重连优化

- **超时时间设置**：根据业务场景调整SSE超时时间，避免因超时导致连接提前关闭（如AI生成回答耗时较长，可设置为60~120秒）。
    
- **自定义重连逻辑**：浏览器默认的重连间隔为3秒，可在客户端监听`error`事件，实现自定义重连间隔（如指数退避重连：3秒、6秒、12秒...），避免频繁重连给服务端带来压力。
    

### 6.3 并发与线程安全

- **异步处理**：服务端处理SSE推送时，需使用异步线程（如`CompletableFuture.runAsync`），避免阻塞主线程，影响其他接口的响应速度。
    
- **并发控制**：若多个线程同时操作同一个SseEmitterSender实例，需确保发送数据的原子性（可通过`synchronized`或分布式锁实现），避免数据推送错乱。
    

### 6.4 异常监控与排查

- **日志记录**：在SSE发送、关闭、异常时，记录详细日志（如连接ID、推送内容、异常信息），便于排查问题（如客户端接收不到数据、连接频繁断开等）。
    
- **健康监控**：新增SSE连接状态监控接口，实时统计当前活跃连接数、异常连接数，及时发现服务端压力和异常。
    

## 七、总结

SSE作为一种轻量级的实时推送方案，凭借其基于HTTP、自动重连、易于实现的优势，在单向推送场景（如AI流式对话、实时通知）中表现出色。本文结合实际项目代码，从SSE的核心概念、项目实现、工作原理、选型对比，到开发注意事项与优化方向，完整拆解了SSE的落地过程。

核心要点回顾：

- SSE是基于HTTP的单向实时推送技术，适用于无需客户端反向通信的场景。
    
- 项目中通过Spring SseEmitter封装SseEmitterSender工具类，确保线程安全和连接稳定性。
    
- AI流式对话中，通过SSE逐字推送AI生成内容，实现“打字机效果”，提升用户体验。
    
- 选型时需区分SSE与WebSocket，根据通信方向、数据类型、并发需求选择合适的方案。
    

希望本文能帮助开发者快速掌握SSE的实战用法，在实际项目中灵活运用SSE实现实时推送功能，提升系统的交互体验和稳定性。如果你的项目中也有实时推送需求，不妨试试SSE，它可能会给你带来意想不到的便捷！
