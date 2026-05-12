## 一、IOC 核心概念：从「手动控制」到「容器托管」

### 1.1 什么是 IOC？

**IOC（Inversion of Control）控制反转** 是 Spring 框架的灵魂，核心是将对象的创建、依赖管理、生命周期控制从业务代码中剥离，交由 Spring 容器统一管理。

**传统开发模式**（无 IOC）：

```java
// 手动创建对象，硬编码依赖
public class UserService {
    private UserRepository userRepository = new UserRepositoryImpl();
    
    public void getUser() {
        userRepository.findUser();
    }
}
```

缺点：耦合度极高，修改实现类需要改代码，无法做到开闭原则。

**Spring IOC 模式**：

```java
// 只声明依赖，创建和注入交给容器
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    
    public void getUser() {
        userRepository.findUser();
    }
}
```

优势：解耦、可配置、易扩展，开发者只需关注业务逻辑。

### 1.2 IOC 与 DI 的关系

- **IOC**：设计思想（控制权反转）
- **DI（Dependency Injection）依赖注入**：IOC 的实现方式
- 核心逻辑：容器在创建 Bean 时，自动将其依赖的 Bean 注入到当前 Bean 中。

---

## 二、IOC 容器工作原理

Spring IOC 容器的核心是 `BeanFactory` 和 `ApplicationContext`，后者是前者的超集，提供更多企业级特性。

### 2.1 容器初始化完整流程

### 2.2 代码示例：XML 配置方式

#### 步骤 1：定义 Bean 类

```java
// 数据访问层
public class UserRepository {
    // 初始化方法
    public void init() {
        System.out.println("UserRepository 初始化方法执行");
    }
    
    // 销毁方法
    public void destroy() {
        System.out.println("UserRepository 销毁方法执行");
    }
    
    public void findUser() {
        System.out.println("查询用户信息");
    }
}

// 业务逻辑层
public class UserService {
    // 依赖的Repository
    private UserRepository userRepository;

    // Setter注入（容器通过setter注入依赖）
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    public void getUser() {
        userRepository.findUser();
    }
}
```

#### 步骤 2：编写 XML 配置文件（applicationContext.xml）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://www.springframework.org/schema/beans
                           http://www.springframework.org/schema/beans/spring-beans.xsd">

    <!-- 配置UserRepository Bean -->
    <bean id="userRepository" class="com.example.UserRepository"
          init-method="init" destroy-method="destroy"/>

    <!-- 配置UserService Bean，并注入UserRepository -->
    <bean id="userService" class="com.example.UserService">
        <property name="userRepository" ref="userRepository"/>
    </bean>
</beans>
```

#### 步骤 3：启动容器并获取 Bean

```java
public class SpringIocTest {
    public static void main(String[] args) {
        // 1. 加载XML配置，初始化容器
        ClassPathXmlApplicationContext context = 
            new ClassPathXmlApplicationContext("applicationContext.xml");
        
        // 2. 从容器获取Bean
        UserService userService = (UserService) context.getBean("userService");
        
        // 3. 调用Bean方法
        userService.getUser();
        
        // 4. 关闭容器（触发销毁方法）
        context.close();
    }
}
```

#### 执行结果：

```plaintext
UserRepository 初始化方法执行
查询用户信息
UserRepository 销毁方法执行
```

### 2.3 代码示例：注解配置方式（SpringBoot 主流）

#### 步骤 1：使用注解定义 Bean

```java
// 配置类（替代XML）
@Configuration
@ComponentScan("com.example") // 扫描指定包下的注解Bean
public class AppConfig {
    // 手动注册Bean（可选，替代@Component）
    @Bean(initMethod = "init", destroyMethod = "destroy")
    public UserRepository userRepository() {
        return new UserRepository();
    }
}

// 业务层Bean
@Service
public class UserService {
    // 字段注入（简单但不推荐，推荐构造器注入）
    @Autowired
    private UserRepository userRepository;
    
    // 构造器注入（推荐，支持final字段，便于测试）
    // public UserService(UserRepository userRepository) {
    //     this.userRepository = userRepository;
    // }
    
    public void getUser() {
        userRepository.findUser();
    }
}
```

字段注入是在对象创建完之后才注入依赖；
循环依赖时，两个对象都在等对方创建完，互相卡住，Spring 救不了。

因为构造器注入是创建时就必须传入依赖，Spring 能提前发现循环，直接报错，不会卡死。

#### 步骤 2：启动注解容器

```java
public class SpringAnnotationTest {
    public static void main(String[] args) {
        // 1. 加载配置类，初始化容器
        AnnotationConfigApplicationContext context = 
            new AnnotationConfigApplicationContext(AppConfig.class);
        
        // 2. 获取Bean（支持按类型获取）
        UserService userService = context.getBean(UserService.class);
        
        // 3. 调用方法
        userService.getUser();
        
        // 4. 关闭容器
        context.close();
    }
}
```

---

## 三、Bean 生命周期全解析

### 3.1 单例 Bean 完整生命周期

```java
@Component
public class LifeCycleBean implements 
        BeanNameAware,      // 获取Bean名称
        BeanFactoryAware,   // 获取Bean工厂
        InitializingBean,   // 初始化扩展
        DisposableBean {    // 销毁扩展

    // 1. 构造方法（实例化）
    public LifeCycleBean() {
        System.out.println("1. 执行构造方法 - 实例化Bean");
    }

    // 2. Setter注入（依赖注入）
    @Autowired
    public void setUserRepository(UserRepository userRepository) {
        System.out.println("2. 执行Setter方法 - 依赖注入");
    }

    // 3. BeanNameAware接口方法
    @Override
    public void setBeanName(String name) {
        System.out.println("3. 执行BeanNameAware - Bean名称：" + name);
    }

    // 4. BeanFactoryAware接口方法
    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        System.out.println("4. 执行BeanFactoryAware - 获取BeanFactory");
    }

    // 5. 初始化前置处理（BeanPostProcessor）
    // 需单独定义BeanPostProcessor，见下文

    // 6. @PostConstruct注解初始化
    @PostConstruct
    public void postConstruct() {
        System.out.println("6. 执行@PostConstruct注解方法");
    }

    // 7. InitializingBean接口初始化
    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("7. 执行InitializingBean#afterPropertiesSet方法");
    }

    // 8. 自定义init-method初始化
    public void customInit() {
        System.out.println("8. 执行自定义init-method方法");
    }

    // 9. 初始化后置处理（BeanPostProcessor）
    // 需单独定义BeanPostProcessor，见下文

    // 业务方法
    public void doBusiness() {
        System.out.println("9. Bean就绪，执行业务方法");
    }

    // 10. @PreDestroy注解销毁
    @PreDestroy
    public void preDestroy() {
        System.out.println("10. 执行@PreDestroy注解方法");
    }

    // 11. DisposableBean接口销毁
    @Override
    public void destroy() throws Exception {
        System.out.println("11. 执行DisposableBean#destroy方法");
    }

    // 12. 自定义destroy-method销毁
    public void customDestroy() {
        System.out.println("12. 执行自定义destroy-method方法");
    }
}

// 定义BeanPostProcessor（后置处理器）
@Component
public class CustomBeanPostProcessor implements BeanPostProcessor {
    // 初始化前置处理
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof LifeCycleBean) {
            System.out.println("5. 执行BeanPostProcessor#postProcessBeforeInitialization");
        }
        return bean;
    }

    // 初始化后置处理
    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof LifeCycleBean) {
            System.out.println("9. 执行BeanPostProcessor#postProcessAfterInitialization");
        }
        return bean;
    }
}

// 配置类
@Configuration
@ComponentScan("com.example")
public class LifeCycleConfig {
    @Bean(initMethod = "customInit", destroyMethod = "customDestroy")
    public LifeCycleBean lifeCycleBean() {
        return new LifeCycleBean();
    }
}

// 测试类
public class LifeCycleTest {
    public static void main(String[] args) {
        AnnotationConfigApplicationContext context = 
            new AnnotationConfigApplicationContext(LifeCycleConfig.class);
        
        LifeCycleBean lifeCycleBean = context.getBean(LifeCycleBean.class);
        lifeCycleBean.doBusiness();
        
        context.close();
    }
}
```

#### 执行结果（严格按生命周期顺序）：

```plaintext
1. 执行构造方法 - 实例化Bean
2. 执行Setter方法 - 依赖注入
3. 执行BeanNameAware - Bean名称：lifeCycleBean
4. 执行BeanFactoryAware - 获取BeanFactory
5. 执行BeanPostProcessor#postProcessBeforeInitialization
6. 执行@PostConstruct注解方法
7. 执行InitializingBean#afterPropertiesSet方法
8. 执行自定义init-method方法
9. 执行BeanPostProcessor#postProcessAfterInitialization
10. Bean就绪，执行业务方法
11. 执行@PreDestroy注解方法
12. 执行DisposableBean#destroy方法
13. 执行自定义destroy-method方法
```

注解本质是：写在代码里的「元数据标签」，不是配置文件，也不是 XML。
 
1. 注解到底是什么？
- 注解是 Java 语法层面 的东西
- 本质是一个 接口，继承自  java.lang.annotation.Annotation 
- 它不直接执行逻辑，只是给代码打标记
- 只有被反射 / 框架解析时才生效

### 3.2 单例 vs 原型 Bean 对比示例

```java
// 配置类
@Configuration
public class ScopeConfig {
    // 单例Bean（默认）
    @Bean
    @Scope("singleton")
    public UserRepository singletonRepository() {
        return new UserRepository();
    }

    // 原型Bean
    @Bean
    @Scope("prototype")
    public UserRepository prototypeRepository() {
        return new UserRepository();
    }
}

// 测试类
public class ScopeTest {
    public static void main(String[] args) {
        AnnotationConfigApplicationContext context = 
            new AnnotationConfigApplicationContext(ScopeConfig.class);
        
        // 单例：多次获取同一实例
        UserRepository s1 = context.getBean("singletonRepository", UserRepository.class);
        UserRepository s2 = context.getBean("singletonRepository", UserRepository.class);
        System.out.println("单例Bean是否同一实例：" + (s1 == s2)); // true
        
        // 原型：每次获取新实例
        UserRepository p1 = context.getBean("prototypeRepository", UserRepository.class);
        UserRepository p2 = context.getBean("prototypeRepository", UserRepository.class);
        System.out.println("原型Bean是否同一实例：" + (p1 == p2)); // false
        
        // 关闭容器：单例Bean执行销毁方法，原型Bean不执行
        context.close();
    }
}
```

---

## 四、Bean 自动装配详解

### 4.1 三大注入注解对比示例

#### 1. @Autowired（Spring 原生）

```java
// 定义接口
public interface UserRepository {
    void findUser();
}

// 实现类1
@Repository("userRepository1")
public class UserRepositoryImpl1 implements UserRepository {
    @Override
    public void findUser() {
        System.out.println("UserRepositoryImpl1 查询用户");
    }
}

// 实现类2（标记为Primary）
@Repository("userRepository2")
@Primary // 优先注入
public class UserRepositoryImpl2 implements UserRepository {
    @Override
    public void findUser() {
        System.out.println("UserRepositoryImpl2 查询用户");
    }
}

// 注入示例
@Service
public class AutowiredDemoService {
    // 方式1：按类型注入（有多个实现时，优先@Primary）
    @Autowired
    private UserRepository userRepository;

    // 方式2：指定名称（解决多实现冲突）
    @Autowired
    @Qualifier("userRepository1")
    private UserRepository userRepository1;

    // 方式3：非必需注入（不存在时不报错）
    @Autowired(required = false)
    private UserRepository userRepository3;

    // 方式4：构造器注入（推荐）
    private final UserRepository userRepository4;
    
    @Autowired
    public AutowiredDemoService(@Qualifier("userRepository2") UserRepository userRepository4) {
        this.userRepository4 = userRepository4;
    }
    
    public void test() {
        userRepository.findUser(); // 输出UserRepositoryImpl2
        userRepository1.findUser(); // 输出UserRepositoryImpl1
        userRepository4.findUser(); // 输出UserRepositoryImpl2
    }
}
```

#### 2. @Resource（JSR-250 标准）

```java
@Service
public class ResourceDemoService {
    // 方式1：按名称注入
    @Resource(name = "userRepository1")
    private UserRepository userRepository;

    // 方式2：默认按属性名注入（属性名=userRepository2）
    @Resource
    private UserRepository userRepository2;
    
    public void test() {
        userRepository.findUser(); // 输出UserRepositoryImpl1
        userRepository2.findUser(); // 输出UserRepositoryImpl2
    }
}
```

#### 3. @Inject（JSR-330 标准）

```xml
<!-- 需引入依赖 -->
<dependency>
    <groupId>javax.inject</groupId>
    <artifactId>javax.inject</artifactId>
    <version>1</version>
</dependency>
```

```java
@Service
public class InjectDemoService {
    // 方式1：按类型注入
    @Inject
    private UserRepository userRepository;

    // 方式2：指定名称
    @Inject
    @Named("userRepository1")
    private UserRepository userRepository1;
    
    public void test() {
        userRepository.findUser(); // 输出UserRepositoryImpl2（@Primary）
        userRepository1.findUser(); // 输出UserRepositoryImpl1
    }
}
```

### 4.2 @Autowired 实现原理

@Autowired 的核心实现类是 `AutowiredAnnotationBeanPostProcessor`，核心流程：

```java
// 核心方法：解析@Autowired注解
private InjectionMetadata buildAutowiringMetadata(final Class<?> clazz) {
    LinkedList<InjectionMetadata.InjectedElement> elements = new LinkedList<>();
    Class<?> targetClass = clazz;

    do {
        final LinkedList<InjectionMetadata.InjectedElement> currElements = new LinkedList<>();

        // 1. 扫描字段上的@Autowired
        ReflectionUtils.doWithLocalFields(targetClass, field -> {
            AnnotationAttributes ann = findAutowiredAnnotation(field);
            if (ann != null) {
                // 排除静态字段
                if (Modifier.isStatic(field.getModifiers())) {
                    return;
                }
                // 判断是否必需注入
                boolean required = determineRequiredStatus(ann);
                currElements.add(new AutowiredFieldElement(field, required));
            }
        });

        // 2. 扫描方法上的@Autowired
        ReflectionUtils.doWithLocalMethods(targetClass, method -> {
            Method bridgedMethod = BridgeMethodResolver.findBridgedMethod(method);
            AnnotationAttributes ann = findAutowiredAnnotation(bridgedMethod);
            if (ann != null) {
                // 排除静态方法
                if (Modifier.isStatic(method.getModifiers())) {
                    return;
                }
                boolean required = determineRequiredStatus(ann);
                PropertyDescriptor pd = BeanUtils.findPropertyForMethod(bridgedMethod, clazz);
                currElements.add(new AutowiredMethodElement(method, required, pd));
            }
        });

        elements.addAll(0, currElements);
        targetClass = targetClass.getSuperclass();
    } while (targetClass != null && targetClass != Object.class);

    return new InjectionMetadata(clazz, elements);
}
```

核心逻辑：

1. 遍历目标类及其父类的所有字段和方法
2. 查找标注 @Autowired 的元素
3. 封装为 InjectionMetadata（注入元数据）
4. 在 Bean 初始化时，通过反射注入依赖

---

## 五、Spring 底层扩展组件实战

### 5.1 Aware 接口示例（感知容器）

```java
@Component
public class AwareDemo implements ApplicationContextAware, BeanNameAware {
    private ApplicationContext context;
    private String beanName;

    // 获取ApplicationContext（容器上下文）
    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.context = applicationContext;
        // 可以通过上下文获取所有Bean名称
        String[] beanNames = context.getBeanDefinitionNames();
        System.out.println("容器中Bean数量：" + beanNames.length);
    }

    // 获取Bean名称
    @Override
    public void setBeanName(String name) {
        this.beanName = name;
        System.out.println("当前Bean名称：" + name);
    }

    // 业务方法：通过上下文获取其他Bean
    public void getOtherBean() {
        UserService userService = context.getBean(UserService.class);
        userService.getUser();
    }
}
```

### 5.2 BeanPostProcessor 实战（自定义注解处理）

```java
// 自定义注解
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface MyAnnotation {
    String value() default "";
}

// 自定义BeanPostProcessor处理注解
@Component
public class MyAnnotationBeanPostProcessor implements BeanPostProcessor {
    // 初始化前处理
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        // 判断Bean是否标注了自定义注解
        MyAnnotation annotation = bean.getClass().getAnnotation(MyAnnotation.class);
        if (annotation != null) {
            System.out.println("Bean[" + beanName + "]标注了自定义注解，值：" + annotation.value());
            // 可以在这里对Bean进行增强处理
        }
        return bean;
    }
}

// 使用自定义注解的Bean
@Component
@MyAnnotation("测试自定义注解")
public class MyAnnotationBean {
    public void test() {
        System.out.println("自定义注解Bean执行方法");
    }
}
```

---

## 六、SpringBoot 自动配置原理（核心重点）

### 6.1 自动配置核心思想

SpringBoot 自动配置的本质是：**基于约定大于配置的思想，根据类路径下的依赖、配置文件等条件，自动向容器中注册 Bean，无需手动配置**。

### 6.2 自动配置核心流程

### 6.3 核心注解详解

#### 1. @SpringBootApplication（入口注解）

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration // 等价于@Configuration
@EnableAutoConfiguration // 开启自动配置
@ComponentScan(excludeFilters = { // 组件扫描
    @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class)
})
public @interface SpringBootApplication {
    // 排除指定的自动配置类
    Class<?>[] exclude() default {};
    
    // 根据类名排除自动配置类
    String[] excludeName() default {};
    
    // 组件扫描路径
    String[] scanBasePackages() default {};
}
```

**核心拆解**：

- `@SpringBootConfiguration`：标记当前类为配置类，等价于 `@Configuration`
- `@EnableAutoConfiguration`：开启自动配置（核心）
- `@ComponentScan`：扫描当前包及其子包下的 @Component 注解类

#### 2. @EnableAutoConfiguration（自动配置核心）

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage // 自动配置包扫描
@Import(AutoConfigurationImportSelector.class) // 导入自动配置选择器
public @interface EnableAutoConfiguration {
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";

    Class<?>[] exclude() default {};

    String[] excludeName() default {};
}
```

**核心逻辑**：

- `@AutoConfigurationPackage`：将当前主类所在包及子包作为自动配置的基础包
- `@Import(AutoConfigurationImportSelector.class)`：加载所有自动配置类

#### 3. AutoConfigurationImportSelector（自动配置加载器）

核心方法：`selectImports()`，加载 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 文件中的所有自动配置类全限定名。

### 6.4 条件注解（自动配置的开关）

自动配置不是无条件生效的，而是通过**条件注解**控制：

|注解|作用|
|---|---|
|@ConditionalOnClass|类路径下存在指定类时生效|
|@ConditionalOnMissingClass|类路径下不存在指定类时生效|
|@ConditionalOnBean|容器中存在指定 Bean 时生效|
|@ConditionalOnMissingBean|容器中不存在指定 Bean 时生效|
|@ConditionalOnProperty|配置文件中存在指定属性时生效|
|@ConditionalOnWebApplication|当前是 Web 应用时生效|
|@ConditionalOnNotWebApplication|当前不是 Web 应用时生效|

#### 示例：DataSourceAutoConfiguration 自动配置类

```java
@AutoConfiguration
@ConditionalOnClass({DataSource.class, EmbeddedDatabaseType.class}) // 存在数据源类时生效
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory") // 不存在R2DBC连接工厂时生效
@EnableConfigurationProperties(DataSourceProperties.class) // 绑定配置属性
@Import({ DataSourcePoolMetadataProvidersConfiguration.class, DataSourceInitializationConfiguration.class })
public class DataSourceAutoConfiguration {
    // 数据源自动配置逻辑
    @Bean
    @ConditionalOnMissingBean // 容器中没有数据源Bean时才注册
    public DataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }
}
```

### 6.5 自定义自动配置（实战示例）

#### 步骤 1：创建自动配置类

```java
// 自定义自动配置类
@Configuration
@ConditionalOnClass(MyService.class) // 存在MyService类时生效
@ConditionalOnProperty(prefix = "my.service", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MyServiceProperties.class) // 绑定配置属性
public class MyServiceAutoConfiguration {

    private final MyServiceProperties properties;

    // 构造器注入配置属性
    public MyServiceAutoConfiguration(MyServiceProperties properties) {
        this.properties = properties;
    }

    // 注册MyService Bean
    @Bean
    @ConditionalOnMissingBean // 用户未自定义时才注册
    public MyService myService() {
        MyService myService = new MyService();
        myService.setName(properties.getName());
        myService.setTimeout(properties.getTimeout());
        return myService;
    }
}
```

#### 步骤 2：创建配置属性类

```java
// 配置属性绑定
@ConfigurationProperties(prefix = "my.service")
public class MyServiceProperties {
    private String name = "defaultName";
    private int timeout = 5000;

    // getter/setter
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getTimeout() {
        return timeout;
    }

    public void setTimeout(int timeout) {
        this.timeout = timeout;
    }
}
```

#### 步骤 3：创建核心服务类

```java
// 核心服务类
public class MyService {
    private String name;
    private int timeout;

    public void doSomething() {
        System.out.println("MyService: name=" + name + ", timeout=" + timeout);
    }

    // getter/setter
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getTimeout() {
        return timeout;
    }

    public void setTimeout(int timeout) {
        this.timeout = timeout;
    }
}
```

#### 步骤 4：注册自动配置类

在 `resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 文件中添加：

plaintext

```
com.example.autoconfig.MyServiceAutoConfiguration
```

#### 步骤 5：测试自定义自动配置

```java
// SpringBoot主类
@SpringBootApplication
public class AutoConfigDemoApplication {
    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(AutoConfigDemoApplication.class, args);
        
        // 从容器获取自动配置的MyService
        MyService myService = context.getBean(MyService.class);
        myService.doSomething(); // 输出：MyService: name=defaultName, timeout=5000
        
        // 修改配置文件application.properties
        // my.service.name=customName
        // my.service.timeout=10000
        // 重启后输出：MyService: name=customName, timeout=10000
    }
}
```

### 6.6 自动配置生效优先级

1. 用户自定义 Bean > 自动配置 Bean（@ConditionalOnMissingBean 保证）
2. 配置文件属性 > 默认属性（@ConfigurationProperties 绑定）
3. 可以通过 `spring.autoconfigure.exclude` 排除指定自动配置类

---

## 七、核心总结

### 7.1 IOC 核心要点

1. **IOC 核心**：将对象创建和依赖管理交给 Spring 容器，实现解耦。
2. **Bean 生命周期**：实例化 → 依赖注入 → Aware → 前置处理 → 初始化 → 后置处理 → 使用 → 销毁。
3. **依赖注入**：
    
    - @Autowired：Spring 原生，按类型注入，支持 @Primary/@Qualifier
    - @Resource：JSR-250，按名称注入，兼容 JavaEE
    - @Inject：JSR-330，标准注解，跨框架兼容
    
4. **扩展点**：
    
    - Aware 接口：让 Bean 感知容器
    - BeanPostProcessor：Bean 初始化前后自定义处理
    - InitializingBean/DisposableBean：生命周期扩展
    

### 7.2 SpringBoot 自动配置核心要点

1. **核心注解**：`@SpringBootApplication` = `@SpringBootConfiguration` + `@EnableAutoConfiguration` + `@ComponentScan`
2. **自动配置加载**：`AutoConfigurationImportSelector` 加载 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 中的配置类
3. **条件控制**：通过 `@ConditionalOnXxx` 注解控制自动配置是否生效
4. **自定义配置**：
    
    - 自定义自动配置类 + 配置属性类
    - 通过 `@ConditionalOnMissingBean` 保证用户自定义 Bean 优先级更高
    - 配置文件属性通过 `@ConfigurationProperties` 绑定
    

**最佳实践**：

- 依赖注入优先使用**构造器注入**
- 单例 Bean 注意线程安全
- 多实现注入使用 @Qualifier 指定名称
- 自定义自动配置遵循 SpringBoot 约定，使用条件注解和配置属性绑定
- 排除不需要的自动配置类：`@SpringBootApplication(exclude = XxxAutoConfiguration.class)`