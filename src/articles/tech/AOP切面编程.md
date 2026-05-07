
# 一、AOP核心认知

## 1.1 什么是AOP？

AOP（Aspect-Oriented Programming，面向切面编程）是一种补充OOP（面向对象编程）的编程思想。OOP以“类/对象”为核心，将功能封装为垂直的模块；而AOP则针对“横切关注点”（贯穿多个模块、与核心业务无关的功能），将其抽离为独立切面，横向贯穿到业务逻辑的各个层级，实现“业务逻辑与横切逻辑解耦”。

形象理解：OOP是“分层搭建积木”，AOP是“给积木整体刷漆”，漆（横切逻辑）贯穿所有积木（业务模块），无需逐个积木处理。

## 1.2 为什么需要AOP？

日志记录、事务管理、性能监控、权限校验等功能，若直接嵌入业务代码，会导致以下问题：

- **代码冗余**：相同逻辑重复出现在多个类/方法中，维护成本高；
    
- **耦合度高**：横切逻辑与核心业务绑定，修改横切逻辑需改动所有关联业务代码；
    
- **可读性差**：业务代码被非核心逻辑穿插，干扰核心逻辑理解。
    

AOP解决方案：将横切关注点集中到“切面”中，通过自动织入机制嵌入业务逻辑，使业务代码仅关注核心功能，实现“高内聚、低耦合”。

# 二、AOP核心概念（Spring AOP）

核心概念串联：**切面（Aspect）**封装**横切关注点**，通过**切入点（Pointcut）**指定拦截哪些**连接点（JoinPoint）**，通过**通知（Advice）**定义拦截后执行的逻辑，最终通过**织入（Weaving）**将切面与业务代码结合。

## 2.1 横切关注点（Cross-Cutting Concern）

与核心业务逻辑无直接关联，但贯穿多个业务模块的功能，是AOP要抽取的对象。

常见场景：

- 日志记录：方法调用前后自动记录日志；
    
- 事务管理：数据库操作自动开启/提交/回滚事务；
    
- 性能监控：统计方法执行耗时；
    
- 权限校验：方法执行前校验用户权限；
    
- 异常处理：统一捕获并处理方法抛出的异常。
    

## 2.2 切面（Aspect）

横切关注点的模块化实现，是包含“切入点+通知”的类。在Spring中，通过**@Aspect**注解标记切面类，同时需用**@Component**交给Spring容器管理。

示例：

```java
@Aspect // 标记为切面类
@Component // 交给Spring管理
public class LoggingAspect {
    // 切入点定义
    @Pointcut("execution(* com.example.UserService.*(..))")
    public void userServiceMethods() {}

    // 通知定义
    @Before("userServiceMethods()")
    public void logBefore(JoinPoint joinPoint) {
        System.out.println("方法执行前记录日志");
    }
}
```

## 2.3 通知（Advice）

切面的具体执行逻辑，定义“在连接点的何时、做什么”。Spring AOP支持5种通知类型，覆盖方法执行的全生命周期：

|通知类型|注解|执行时机|核心特点|
|---|---|---|---|
|前置通知|@Before|目标方法执行前|无法阻止目标方法执行（除非抛异常）|
|后置通知|@After|目标方法执行后（无论成功/异常）|必然执行，无法获取返回值|
|返回通知|@AfterReturning|目标方法成功返回后|可获取方法返回值|
|异常通知|@AfterThrowing|目标方法抛出异常后|可获取异常对象|
|环绕通知|@Around|目标方法执行前后|可控制目标方法是否执行、修改参数/返回值，功能最强|

各通知实现示例：

```java
@Aspect
@Component
public class AdviceDemoAspect {
    // 切入点（复用）
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void serviceMethods() {}

    // 1. 前置通知
    @Before("serviceMethods()")
    public void beforeAdvice(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        System.out.println("前置通知：" + methodName + "方法即将执行");
    }

    // 2. 后置通知
    @After("serviceMethods()")
    public void afterAdvice(JoinPoint joinPoint) {
        System.out.println("后置通知：" + joinPoint.getSignature().getName() + "方法执行结束");
    }

    // 3. 返回通知（获取返回值）
    @AfterReturning(pointcut = "serviceMethods()", returning = "result")
    public void afterReturningAdvice(JoinPoint joinPoint, Object result) {
        System.out.println("返回通知：方法返回值=" + result);
    }

    // 4. 异常通知（获取异常）
    @AfterThrowing(pointcut = "serviceMethods()", throwing = "error")
    public void afterThrowingAdvice(JoinPoint joinPoint, Throwable error) {
        System.out.println("异常通知：方法抛出异常=" + error.getMessage());
    }

    // 5. 环绕通知（控制目标方法执行）
    @Around("serviceMethods()")
    public Object aroundAdvice(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        System.out.println("环绕通知：方法执行前");
        // 执行目标方法（必须调用，否则目标方法不执行）
        Object result = joinPoint.proceed(); 
        // 可修改返回值
        result = "处理后的返回值：" + result;
        long cost = System.currentTimeMillis() - start;
        System.out.println("环绕通知：方法执行后，耗时=" + cost + "ms");
        return result;
    }
}
```

## 2.4 切入点（Pointcut）

定义“拦截哪些连接点”，即筛选需要增强的方法。通过**@Pointcut**注解+切入点表达式实现，表达式支持多种匹配规则，可精准定位目标方法。

核心作用：复用拦截范围，多个通知可引用同一个切入点。

## 2.5 连接点（JoinPoint）

程序执行过程中可插入横切逻辑的“位置”，Spring AOP中仅支持“方法调用”作为连接点（即所有业务方法都是潜在连接点）。

通过`JoinPoint`对象可获取连接点信息（方法名、参数、目标对象等），环绕通知需用其子类`ProceedingJoinPoint`（支持控制目标方法执行）。

`JoinPoint`常用方法：

- `getArgs()`：获取目标方法参数（Object[]数组）；
    
- `getSignature()`：获取方法签名（含方法名、返回类型、参数类型）；
    
- `getTarget()`：获取目标对象（被代理的原始对象）；
    
- `getThis()`：获取代理对象（Spring生成的代理类实例）。
    

`ProceedingJoinPoint`额外方法：

- `proceed()`：执行目标方法，返回方法返回值；
    
- `proceed(Object[] args)`：传入新参数执行目标方法，可修改方法参数。
    

## 2.6 织入（Weaving）

将切面逻辑与目标业务代码结合的过程。Spring AOP默认采用“运行时织入”，通过动态代理机制生成代理对象，在代理对象中嵌入切面逻辑。

织入流程：

1. Spring容器启动时，扫描并识别切面类（@Aspect+@Component）；
    
2. 根据切入点表达式，确定需要代理的目标对象；
    
3. 为目标对象生成代理对象（JDK动态代理或CGLIB代理）；
    
4. 调用目标方法时，实际执行代理对象方法，自动触发切面通知逻辑。
    

# 三、切入点表达式（Spring AOP核心）

切入点表达式用于定义“拦截哪些方法”，Spring AOP支持多种表达式类型，其中`execution`最常用，可精细化匹配方法签名。

## 3.1 常用表达式类型

### 3.1.1 execution表达式（最常用）

匹配方法执行，语法格式：

`execution([修饰符模式] 返回类型 [类全路径].方法名(参数列表) [异常模式])`

各部分说明：

- 修饰符模式（可选）：如public、private，不指定则匹配所有修饰符；
    
- 返回类型（必填）：具体类型（如String）或`*`（任意返回类型）；
    
- 类全路径（可选）：具体类路径（如com.example.UserService）或通配符（如com.example..*表示包及其子包所有类）；
    
- 方法名（必填）：具体方法名或`*`（任意方法）；
    
- 参数列表（必填）：具体参数类型（如(int, String)）、`..`（任意数量/类型参数）、空括号（无参数）；
    
- 异常模式（可选）：匹配方法抛出的异常类型，如throws Exception。
    

示例：

- `execution(* com.example.UserService.*(..))`：匹配UserService类所有方法（任意返回值、任意参数）；
    
- `execution(public String com.example.UserService.get*(String))`：匹配UserService中public修饰、返回String、方法名以get开头、参数为String的方法；
    
- `execution(* com.example..*.*(..))`：匹配com.example包及其子包所有类的所有方法。
    

### 3.1.2 其他常用表达式

| 表达式类型       | 语法                  | 作用                          | 示例                                                                                           |
| ----------- | ------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| within      | within(类全路径)        | 匹配类/包下所有方法（粗粒度，无法匹配具体方法）    | within(com.example.service..*)：匹配service包及其子包所有类的方法                                          |
| args        | args(参数类型列表)        | 匹配参数类型符合的方法（运行时匹配实际参数类型）    | args(String, ..)：第一个参数为String，后续参数任意                                                         |
| @annotation | @annotation(注解全路径)  | 匹配标注了特定注解的方法                | @annotation(org.springframework.transaction.annotation.Transactional)：匹配带@Transactional注解的方法 |
| @within     | @within(注解全路径)      | 匹配标注了特定类级注解的所有方法            | @within(org.springframework.stereotype.Service)：匹配带@Service注解的类的所有方法                         |
| bean        | bean(bean名称)        | 匹配特定Bean名称的类的所有方法           | bean(userService)：匹配名称为userService的Bean的所有方法                                                 |
| this/target | this(类型)/target(类型) | this匹配代理对象类型，target匹配目标对象类型 | this(com.example.service.UserService)：匹配代理对象为UserService接口的方法                                |

## 3.2 表达式组合使用

通过逻辑运算符`&`&（且）、`||`（或）、`!`（非）组合表达式，实现更精准的匹配。

示例：

- `execution(* com.example.service.*.*(..)) && @annotation(com.example.annotation.MonitorPerformance)`：匹配service包下带@MonitorPerformance注解的方法；
    
- `execution(* com.example.service.*.add*(..)) || execution(* com.example.service.*.delete*(..))`：匹配service包下方法名以add或delete开头的方法。
    

# 四、AOP实操场景（Spring Boot）

## 4.1 环境准备

Spring Boot项目无需额外引入AOP依赖（spring-boot-starter-web已包含），若为纯Spring项目，需引入：

```xml
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-aop</artifactId>
    <version>5.3.20</version>
</dependency>
<dependency>
    <groupId>org.aspectj</groupId>
    <artifactId>aspectjweaver</artifactId>
    <version>1.9.9.1</version>
</dependency>
```

启动类添加注解（默认已开启，可显式指定）：

```java
@SpringBootApplication
@EnableAspectJAutoProxy // 开启AOP自动代理（默认开启）
public class AopDemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AopDemoApplication.class, args);
    }
}
```

## 4.2 场景1：日志记录（基础场景）

需求：自动记录service层所有方法的调用日志（方法名、参数、执行时间）。

### 实现步骤：

1. 创建切面类，定义切入点和环绕通知（统计耗时需环绕通知）；
    
2. 通过JoinPoint获取方法信息，记录日志。
    

代码实现：

```java
@Aspect
@Component
@Slf4j // Lombok日志注解
public class LoggingAspect {
    // 切入点：匹配service包及其子包所有方法
    @Pointcut("execution(* com.example.service..*.*(..))")
    public void serviceLogPointcut() {}

    // 环绕通知：记录日志+统计耗时
    @Around("serviceLogPointcut()")
    public Object logAround(ProceedingJoinPoint joinPoint) throws Throwable {
        // 1. 方法执行前：记录方法名、参数
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        log.info("【日志记录】方法{}开始执行，参数：{}", methodName, Arrays.toString(args));

        // 2. 执行目标方法，记录耗时
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed(); // 执行目标方法
        long cost = System.currentTimeMillis() - start;

        // 3. 方法执行后：记录返回值、耗时
        log.info("【日志记录】方法{}执行结束，返回值：{}，耗时：{}ms", methodName, result, cost);
        return result;
    }
}
```

## 4.3 场景2：性能监控（自定义注解+阈值报警）

需求：通过自定义注解标记需要监控的方法，超过指定耗时阈值（如500ms）时输出警告日志。

### 实现步骤：

1. 定义自定义注解`@MonitorPerformance`；
    
2. 创建切面类，以注解为切入点，实现环绕通知；
    
3. 设置耗时阈值，超过阈值输出警告日志。
    

代码实现：

```java
// 1. 自定义注解
@Retention(RetentionPolicy.RUNTIME) // 运行时保留，允许反射获取
@Target(ElementType.METHOD) // 仅作用于方法
public @interface MonitorPerformance {
    long threshold() default 500; // 耗时阈值（默认500ms）
}

// 2. 切面类
@Aspect
@Component
@Slf4j
public class PerformanceMonitorAspect {
    // 切入点：匹配带@MonitorPerformance注解的方法
    @Around("@annotation(monitor)")
    public Object monitorPerformance(ProceedingJoinPoint joinPoint, MonitorPerformance monitor) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long cost = System.currentTimeMillis() - start;

        // 对比阈值，输出日志
        long threshold = monitor.threshold();
        if (cost > threshold) {
            log.warn("【性能警告】方法{}执行耗时{}ms，超过阈值{}ms", 
                    joinPoint.getSignature().getName(), cost, threshold);
        } else {
            log.info("【性能监控】方法{}执行耗时{}ms", joinPoint.getSignature().getName(), cost);
        }
        return result;
    }
}

// 3. 业务方法使用注解
@Service
public class UserService {
    @MonitorPerformance(threshold = 300) // 自定义阈值300ms
    public String getUserDetails(String userId) {
        // 模拟耗时操作
        try {
            Thread.sleep(400);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return "用户ID：" + userId;
    }
}
```

## 4.4 场景3：权限校验（自定义注解+AOP）

需求：通过自定义注解`@HasPermission`标记需要权限校验的方法，校验当前用户是否拥有指定权限。

### 实现步骤：

1. 定义注解`@HasPermission`（存储权限标识）；
    
2. 切面类拦截注解方法，提取权限标识；
    
3. 获取当前用户权限，与注解要求的权限对比，无权限则抛异常。
    

代码实现：

```java
// 1. 自定义权限注解
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface HasPermission {
    String value(); // 权限标识（如"user:edit"）
}

// 2. 切面类（权限校验逻辑）
@Aspect
@Component
@Slf4j
public class PermissionAspect {
    // 模拟获取当前用户权限的服务
    @Autowired
    private UserPermissionService permissionService;

    @Around("@annotation(hasPermission)")
    public Object checkPermission(ProceedingJoinPoint joinPoint, HasPermission hasPermission) throws Throwable {
        // 2.1 获取注解指定的权限
        String requiredPerm = hasPermission.value();
        // 2.2 获取当前用户ID（实际项目从Token/SecurityContext获取）
        Long userId = SecurityContextUtil.getCurrentUserId();
        if (userId == null) {
            throw new UnauthorizedException("用户未登录");
        }
        // 2.3 校验权限
        boolean hasPerm = permissionService.hasPermission(userId, requiredPerm);
        if (!hasPerm) {
            log.error("【权限校验失败】用户{}无权限{}，无法执行方法{}", 
                    userId, requiredPerm, joinPoint.getSignature().getName());
            throw new ForbiddenException("权限不足，无法执行操作");
        }
        // 2.4 权限通过，执行目标方法
        return joinPoint.proceed();
    }
}

// 3. 业务方法使用注解
@RestController
@RequestMapping("/user")
public class UserController {
    @HasPermission("user:edit") // 要求"user:edit"权限
    @PostMapping("/edit")
    public String editUser(@RequestBody User user) {
        // 编辑用户逻辑
        return "编辑成功";
    }
}
```

# 五、AOP底层代理机制（Spring AOP）

Spring AOP通过“动态代理”实现织入，根据目标对象是否实现接口，自动选择代理方式：

## 5.1 JDK动态代理（默认，优先使用）

### 适用场景：目标对象实现了至少一个接口。

### 实现原理：

1. 通过`java.lang.reflect.Proxy`类，在运行时生成一个“实现目标接口”的代理类；
    
2. 代理类持有`InvocationHandler`接口实现类，所有接口方法调用都会转发到`invoke`方法；
    
3. 在`invoke`方法中嵌入切面逻辑，再调用目标对象的原始方法。
    

核心代码示例：

```java
// 目标接口
public interface UserService {
    void addUser();
}

// 目标对象（接口实现类）
public class UserServiceImpl implements UserService {
    @Override
    public void addUser() {
        System.out.println("执行新增用户业务");
    }
}

// InvocationHandler实现类（增强逻辑）
public class MyInvocationHandler implements InvocationHandler {
    private Object target; // 目标对象

    public MyInvocationHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("JDK代理：方法执行前增强");
        Object result = method.invoke(target, args); // 调用目标方法
        System.out.println("JDK代理：方法执行后增强");
        return result;
    }
}

// 生成代理对象并调用
public class JdkProxyDemo {
    public static void main(String[] args) {
        UserService target = new UserServiceImpl();
        // 生成代理对象（实现UserService接口）
        UserService proxy = (UserService) Proxy.newProxyInstance(
                target.getClass().getClassLoader(),
                target.getClass().getInterfaces(),
                new MyInvocationHandler(target)
        );
        proxy.addUser(); // 调用代理对象方法，触发增强逻辑
    }
}
```

### 局限性：

- 仅能代理接口方法，无法代理类中自定义的非接口方法；
    
- 无法代理private、final方法（接口方法默认public，无此问题）。
    

## 5.2 CGLIB动态代理

### 适用场景：目标对象未实现接口，或强制指定使用CGLIB代理。

### 实现原理：

1. 通过CGLIB（Code Generation Library）在运行时生成目标对象的“子类”；
    
2. 子类重写目标对象的非final方法，在重写方法中嵌入切面逻辑；
    
3. 调用子类方法时，先执行增强逻辑，再调用父类（目标对象）的原始方法。
    

核心代码示例：

```java
// 目标对象（无接口）
public class OrderService {
    public void createOrder() {
        System.out.println("执行创建订单业务");
    }
}

// CGLIB方法拦截器（增强逻辑）
public class MyMethodInterceptor implements MethodInterceptor {
    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        System.out.println("CGLIB代理：方法执行前增强");
        Object result = proxy.invokeSuper(obj, args); // 调用父类（目标对象）方法
        System.out.println("CGLIB代理：方法执行后增强");
        return result;
    }
}

// 生成代理对象并调用
public class CglibProxyDemo {
    public static void main(String[] args) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(OrderService.class); // 设置父类（目标对象）
        enhancer.setCallback(new MyMethodInterceptor()); // 设置拦截器
        OrderService proxy = (OrderService) enhancer.create(); // 生成代理对象（子类）
        proxy.createOrder(); // 调用代理对象方法，触发增强逻辑
    }
}
```

### 局限性：

- 无法代理final类（无法继承）和final方法（无法重写）；
    
- 无法代理private方法（子类无法访问）。
    

## 5.3 Spring代理选择策略与配置

### 默认策略：

- 目标对象实现接口 → 优先使用JDK动态代理；
    
- 目标对象无接口 → 使用CGLIB代理。
    

### 强制使用CGLIB代理：

在启动类/配置类添加注解，设置`proxyTargetClass = true`：

```java
@SpringBootApplication
@EnableAspectJAutoProxy(proxyTargetClass = true) // 强制所有代理使用CGLIB
public class AopDemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AopDemoApplication.class, args);
    }
}
```

适用场景：目标对象实现接口，但需要代理类中自定义的非接口方法。

# 六、AOP注意事项与常见问题

## 6.1 仅增强public方法

Spring AOP出于设计约定，仅对public方法生效：

- JDK代理：仅能代理接口的public方法；
    
- CGLIB代理：虽可重写protected/private方法，但Spring默认不增强，仅处理public方法。
    

## 6.2 内部方法调用不触发AOP

问题：同一类中，方法A调用方法B，若方法B被切面拦截，AOP增强不生效。

原因：内部调用是`this.方法名()`，直接调用目标对象方法，绕过代理对象，无法触发增强。

解决方案：

1. 通过Spring容器获取代理对象，再调用方法（@Autowired自身代理对象）；
    
2. 使用`AopContext.currentProxy()`获取当前代理对象，再调用方法。
    

示例：

```java
@Service
public class UserService {
    // 方案1：Autowired自身代理对象
    @Autowired
    private UserService userServiceProxy;

    public void methodA() {
        // 错误：内部调用，不触发AOP
        this.methodB();
        // 正确：通过代理对象调用，触发AOP
        userServiceProxy.methodB();

        // 方案2：通过AopContext获取代理对象
        UserService proxy = (UserService) AopContext.currentProxy();
        proxy.methodB();
    }

    @MonitorPerformance
    public void methodB() {
        System.out.println("方法B执行");
    }
}
```

注意：方案2需在@EnableAspectJAutoProxy中添加`exposeProxy = true`。

## 6.3 环绕通知必须调用proceed()

环绕通知中，若未调用`joinPoint.proceed()`，目标方法将不会执行；若多次调用，目标方法会重复执行。

## 6.4 切入点表达式精准度问题

避免使用过于宽泛的表达式（如`execution(* *.*(..))`），否则会拦截所有方法，影响性能。建议精准到包/类级别。

# 七、总结

AOP的核心价值是“解耦横切逻辑与核心业务”，通过切面封装重复功能，实现代码复用与易维护。Spring AOP基于动态代理，提供了灵活的切入点表达式和通知机制，覆盖日志、事务、权限等常见场景。

关键要点：

- 核心概念：切面=切入点+通知，连接点是方法调用，织入通过动态代理实现；
    
- 实操核心：掌握切入点表达式编写、5种通知类型的使用场景；
    
- 底层机制：JDK代理（接口）与CGLIB代理（子类）的区别与选择；
    
- 避坑重点：内部调用不触发AOP、仅增强public方法、环绕通知需调用proceed()。