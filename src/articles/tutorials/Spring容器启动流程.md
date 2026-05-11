---
title: Spring容器启动流程
date: 2026-05-10T01:03:37.995Z
category: tutorials
tags: Spring 源码, Spring 容器启动
---

本文基于Spring Framework源码，以「AnnotationConfigApplicationContext」为入口（Java Config方式），全面拆解Spring容器启动的完整流程，包含初始化、配置类注册、容器刷新三大核心步骤，结合源码逐句分析关键逻辑，补充核心概念、扩展知识点及实战关联，助力深入理解Spring底层原理。

**核心前提**：Spring容器启动的本质是「创建BeanFactory、注册BeanDefinition、初始化Bean、建立依赖关系」的过程。无论是Java Config（AnnotationConfigApplicationContext）还是XML配置（ClassPathXmlApplicationContext），核心流程一致，均继承自AbstractApplicationContext，核心方法refresh()定义于此类中。

# 一、Spring启动核心三步骤总览

Spring容器启动整体可归纳为三大核心步骤，对应AnnotationConfigApplicationContext的构造方法源码，逻辑清晰且层层递进：

```java
// AnnotationConfigApplicationContext构造方法（Java Config入口）
public AnnotationConfigApplicationContext(Class<?>... annotatedClasses) {
    // 步骤1：初始化Spring容器，注册内置BeanPostProcessor的BeanDefinition
    this();
    // 步骤2：将用户配置类（如SpringConfig）的BeanDefinition注册到容器
    register(annotatedClasses);
    // 步骤3：调用refresh()刷新容器，完成Bean初始化、依赖注入等核心操作
    refresh();
}
```

## 核心流程图

暂时无法在豆包文档外展示此内容

# 二、步骤1：容器初始化流程（this()无参构造）

调用无参构造方法this()，核心目的是「初始化容器基础组件，为后续BeanDefinition注册和解析做准备」，具体完成3件核心事，同时注册Spring内置的后置处理器BeanDefinition。

## 1.1 核心操作拆解

1. **实例化BeanFactory工厂**：创建DefaultListableBeanFactory实例，这是Spring核心的Bean工厂，负责Bean的创建、存储、管理，后续所有BeanDefinition都会注册到该工厂中。
    
2. **实例化BeanDefinitionReader注解解析器**：用于解析带有特定注解（@Component、@Service、@Repository、@Controller、@Configuration等）的类，将其转化为BeanDefinition对象。 **补充**：BeanDefinition是Spring核心数据结构，存储Bean的所有元信息（类名、是否单例、是否懒加载、依赖关系、初始化方法、销毁方法等），是Bean创建的“蓝图”。
    
3. **实例化ClassPathBeanDefinitionScanner路径扫描器**：用于扫描指定包路径下的所有类，筛选出带有注解的类，交给BeanDefinitionReader解析为BeanDefinition。
    
4. **注册内置后置处理器BeanDefinition**：通过AnnotationConfigUtils.registerAnnotationConfigProcessors()方法，向容器注册Spring内置的BeanDefinitionRegistryPostProcessor和BeanPostProcessor，核心包括：
    
    1. ConfigurationClassPostProcessor：BeanFactory后置处理器，核心职责是扫描配置类、解析@ComponentScan、@Import、@Bean等注解，完成BeanDefinition的批量注册。
        
    2. AutowiredAnnotationBeanPostProcessor：Bean后置处理器，核心职责是处理@Autowired、@Value注解的自动注入。
        
    3. CommonAnnotationBeanPostProcessor：Bean后置处理器，处理@Resource、@PostConstruct、@PreDestroy等注解。
        

## 1.2 核心源码剖析（AnnotationConfigApplicationContext无参构造）

```java
public AnnotationConfigApplicationContext() {
    // 1. 实例化BeanDefinitionReader，关联当前容器（用于解析注解类为BeanDefinition）
    this.reader = new AnnotatedBeanDefinitionReader(this);
    // 2. 实例化ClassPathBeanDefinitionScanner，关联当前容器（用于扫描包路径）
    this.scanner = new ClassPathBeanDefinitionScanner(this);
}

// AnnotatedBeanDefinitionReader构造方法中，会调用AnnotationConfigUtils注册内置组件
public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry) {
    this(registry, getOrCreateEnvironment(registry));
}

public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry, Environment environment) {
    this.registry = registry;
    this.conditionEvaluator = new ConditionEvaluator(registry, environment, null);
    // 核心：注册Spring内置的后置处理器BeanDefinition
    AnnotationConfigUtils.registerAnnotationConfigProcessors(this.registry);
}
```

## 1.3 扩展知识点

- **BeanFactory与ApplicationContext的区别**：BeanFactory是Spring最基础的Bean容器，仅提供Bean的创建和管理功能；ApplicationContext是BeanFactory的子类，除了BeanFactory的功能，还集成了国际化、事件发布、资源加载等高级功能。
    
- **内置后置处理器的作用**：Spring内置后置处理器是容器正常工作的基础，无需用户手动配置，会自动注册并生效，负责完成注解解析、自动注入、Bean生命周期干预等核心操作。
    

# 三、步骤2：注册配置类到容器（register()方法）

register(annotatedClasses)方法的核心是「将用户传入的配置类（如标注@Configuration的类）解析为BeanDefinition，并注册到BeanFactory中」，为后续refresh()阶段的Bean扫描和初始化做准备。

## 2.1 核心操作拆解

1. **解析配置类为BeanDefinition**：通过AnnotatedGenericBeanDefinition封装配置类，将配置类的元信息（注解、类名、作用域等）存储到BeanDefinition中。
    
2. **条件筛选（@Conditional注解处理）**：通过ConditionEvaluator判断配置类是否满足@Conditional注解的条件，不满足则跳过注册。
    
3. **处理作用域和Bean名称**：解析@Scope注解确定Bean的作用域（默认单例），通过BeanNameGenerator生成Bean的名称（默认首字母小写的类名）。
    
4. **处理通用注解**：通过AnnotationConfigUtils.processCommonDefinitionAnnotations()处理@Primary、@Lazy、@DependsOn等通用注解，设置到BeanDefinition中。
    
5. **注册到容器**：将封装好的BeanDefinitionHolder注册到BeanFactory的BeanDefinitionRegistry中，完成配置类的注册。
    

## 2.2 核心源码剖析（AnnotatedBeanDefinitionReader#doRegisterBean）

```java
// 核心方法：注册单个注解类（配置类或普通Bean）
<T> void doRegisterBean(Class<T> annotatedClass, @Nullable Supplier<T> instanceSupplier, @Nullable String name,
		@Nullable Class<? extends Annotation>[] qualifiers, BeanDefinitionCustomizer... definitionCustomizers) {
	// 1. 解析配置类为AnnotatedGenericBeanDefinition（包含类的注解元信息）
	AnnotatedGenericBeanDefinition abd = new AnnotatedGenericBeanDefinition(annotatedClass);
	// 2. 处理@Conditional注解，判断是否跳过注册
	if (this.conditionEvaluator.shouldSkip(abd.getMetadata())) {
		return;
	}

	// 3. 设置实例提供器（可选，用于自定义Bean实例创建）
	abd.setInstanceSupplier(instanceSupplier);
	// 4. 解析@Scope注解，确定Bean作用域（默认singleton）
	ScopeMetadata scopeMetadata = this.scopeMetadataResolver.resolveScopeMetadata(abd);
	abd.setScope(scopeMetadata.getScopeName());
	// 5. 生成Bean名称（默认类名首字母小写，可通过@Bean指定）
	String beanName = (name != null ? name : this.beanNameGenerator.generateBeanName(abd, this.registry));
	// 6. 处理通用注解：@Primary、@Lazy、@DependsOn等
	AnnotationConfigUtils.processCommonDefinitionAnnotations(abd);
	// 7. 处理自定义限定符注解（如@Qualifier）
	if (qualifiers != null) {
		for (Class<? extends Annotation> qualifier : qualifiers) {
			if (Primary.class == qualifier) {
				abd.setPrimary(true); // 标记为首选Bean
			}
			else if (Lazy.class == qualifier) {
				abd.setLazyInit(true); // 标记为懒加载
			}
			else {
				abd.addQualifier(new AutowireCandidateQualifier(qualifier));
			}
		}
	}
	// 8. 应用自定义BeanDefinition配置（用户扩展）
	for (BeanDefinitionCustomizer customizer : definitionCustomizers) {
		customizer.customize(abd);
	}
	// 9. 封装为BeanDefinitionHolder（包含BeanDefinition和Bean名称）
	BeanDefinitionHolder definitionHolder = new BeanDefinitionHolder(abd, beanName);
	// 10. 处理作用域代理（如@Scope(proxyMode = ScopedProxyMode.INTERFACES)）
	definitionHolder = AnnotationConfigUtils.applyScopedProxyMode(scopeMetadata, definitionHolder, this.registry);
	// 11. 最终注册到BeanDefinitionRegistry（BeanFactory的核心组件）
	BeanDefinitionReaderUtils.registerBeanDefinition(definitionHolder, this.registry);
}
```

## 2.3 扩展知识点

- **配置类的特殊地位**：配置类本身也是一个Bean，但其核心作用是作为“入口”，后续通过ConfigurationClassPostProcessor解析配置类中的@ComponentScan、@Import、@Bean等注解，批量注册其他Bean。
    
- **@Scope注解的proxyMode属性**：用于设置作用域代理模式，如REQUEST、SESSION作用域的Bean，需要通过代理模式注入到单例Bean中，否则会出现生命周期不匹配问题。
    
- **BeanNameGenerator的作用**：默认使用AnnotationBeanNameGenerator，生成规则为“类名首字母小写”，可通过自定义BeanNameGenerator修改Bean名称生成规则。
    

# 四、步骤3：容器刷新流程（refresh()方法）

refresh()是Spring容器启动的核心方法，定义于AbstractApplicationContext中，贯穿容器启动的整个生命周期，共拆解为12个步骤，完成BeanFactory预处理、后置处理器执行、Bean初始化、组件初始化等所有核心操作。

**核心特征**：refresh()方法是同步方法（synchronized锁），确保容器刷新过程线程安全；无论何种类型的Spring容器（父子容器、Feign隔离容器），都会调用此方法完成初始化。

## 3.1 refresh()方法整体源码

```java
public void refresh() throws BeansException, IllegalStateException {
	synchronized (this.startupShutdownMonitor) {
		// 1. 刷新前的预处理
		prepareRefresh();

		// 2. 获取BeanFactory（DefaultListableBeanFactory）
		ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

		// 3. 预处理BeanFactory，添加核心组件
		prepareBeanFactory(beanFactory);

		try {
			// 4. 子类扩展：BeanFactory预处理后进一步设置
			postProcessBeanFactory(beanFactory);

			// 5. 执行BeanFactory后置处理器（解析配置类、批量注册BeanDefinition）
			invokeBeanFactoryPostProcessors(beanFactory);

			// 6. 注册Bean后置处理器（干预Bean创建流程）
			registerBeanPostProcessors(beanFactory);

			// 7. 初始化国际化组件（MessageSource）
			initMessageSource();

			// 8. 初始化事件派发器（ApplicationEventMulticaster）
			initApplicationEventMulticaster();

			// 9. 子类扩展：容器刷新时自定义逻辑（Web场景常用）
			onRefresh();

			// 10. 注册监听器，派发早期事件
			registerListeners();

			// 11. 初始化所有非懒加载单例Bean（核心步骤）
			finishBeanFactoryInitialization(beanFactory);

			// 12. 容器刷新完成，发布事件
			finishRefresh();
		}

		catch (BeansException ex) {
			if (logger.isWarnEnabled()) {
				logger.warn("Exception encountered during context initialization - " +
						"cancelling refresh attempt: " + ex);
			}

			// 销毁已创建的Bean，避免资源泄漏
			destroyBeans();

			// 重置容器激活状态
			cancelRefresh(ex);

			// 抛出异常，告知启动失败
			throw ex;
		}

		finally {
			// 清除Spring内核中的临时缓存（如类加载器缓存）
			resetCommonCaches();
		}
	}
}
```

## 3.2 逐步骤详细解析

### 步骤1：prepareRefresh()——刷新前预处理

核心目的：初始化容器环境、校验属性合法性、保存早期事件，为后续刷新操作做准备。

1. **initPropertySources()**：初始化属性源，子类可重写此方法自定义属性设置（如添加自定义配置文件）。默认实现为空，留给用户扩展。
    
2. **validateRequiredProperties()**：校验容器环境中的必填属性（通过@Required注解或配置文件指定），若缺失则抛出异常。
    
3. **初始化早期事件集合**：创建LinkedHashSet<ApplicationEvent>存储早期事件（在事件派发器初始化前产生的事件），后续会统一派发。


```java
protected void prepareRefresh() {
	// 记录容器启动时间
	this.startupDate = System.currentTimeMillis();
	// 标记容器为激活状态
	this.closed.set(false);
	this.active.set(true);

	// 初始化属性源（子类扩展）
	initPropertySources();

	// 校验必填属性
	getEnvironment().validateRequiredProperties();

	// 初始化早期事件集合
	if (this.earlyApplicationEvents == null) {
		this.earlyApplicationEvents = new LinkedHashSet<>();
	}
}
```

 ### 步骤2：obtainFreshBeanFactory()——获取BeanFactory

核心目的：获取步骤1中初始化的DefaultListableBeanFactory，确保BeanFactory处于可用状态。

1. **refreshBeanFactory()**：刷新BeanFactory，设置序列化ID（确保容器可序列化），GenericApplicationContext的实现为重置BeanFactory并重新关联。
    
2. **getBeanFactory()**：返回容器中的BeanFactory实例（DefaultListableBeanFactory），后续所有操作均基于此BeanFactory。
    

**扩展**：此步骤确保BeanFactory是最新状态，避免因容器重复刷新导致的BeanFactory不一致问题。

### 步骤3：prepareBeanFactory()——BeanFactory预处理

核心目的：向BeanFactory添加核心组件、设置基础配置，确保BeanFactory具备Bean创建和管理的基础能力。

1. **基础配置设置**：设置BeanFactory的类加载器、表达式解析器（处理SpEL表达式）、类型转换器等。
    
2. **添加BeanPostProcessor：ApplicationContextAwareProcessor**：用于处理Aware接口（EnvironmentAware、ResourceLoaderAware等），将容器组件注入到Bean中。
    
3. **设置忽略自动装配的接口**：EnvironmentAware、EmbeddedValueResolverAware等接口，避免这些接口被@Autowired自动注入，而是通过ApplicationContextAwareProcessor手动注入。
    
4. **注册可自动装配的组件**：向BeanFactory注册BeanFactory、ResourceLoader、ApplicationEventPublisher、ApplicationContext等组件，允许Bean通过@Autowired自动注入这些容器组件。
    
5. **添加BeanPostProcessor：ApplicationListenerDetector**：检测Bean是否为ApplicationListener类型，若是则注册到容器的事件监听器集合中。
    
6. **支持AspectJ编译时织入**：若存在AspectJ相关类，向BeanFactory添加AspectJWeavingEnabler，支持AOP切面织入。
    
7. **注册系统组件**：向BeanFactory注册environment（环境变量）、systemProperties（系统属性）、systemEnvironment（系统环境变量）三个组件，供Bean获取系统信息。
    

### 步骤4：postProcessBeanFactory()——子类扩展预处理

核心目的：留给子类（如WebApplicationContext）重写，在BeanFactory预处理完成后做进一步定制化配置。例如，Spring MVC的AnnotationConfigWebApplicationContext会重写此方法，注册Spring MVC相关的BeanPostProcessor。

**扩展**：普通Java Config场景下，此方法默认实现为空，无需额外处理。

### 步骤5：invokeBeanFactoryPostProcessors()——执行BeanFactory后置处理器

核心目的：执行BeanFactoryPostProcessor接口的方法，干预BeanFactory的配置，核心是完成「配置类解析、批量注册BeanDefinition」（由ConfigurationClassPostProcessor实现）。

BeanFactoryPostProcessor是Spring的核心扩展点，分为两类：BeanDefinitionRegistryPostProcessor（优先执行，用于注册BeanDefinition）和BeanFactoryPostProcessor（后执行，用于修改BeanDefinition）。

1. **执行BeanDefinitionRegistryPostProcessor**：
    
    1. 获取所有实现BeanDefinitionRegistryPostProcessor接口的Bean。
        
    2. 按优先级执行：先执行实现PriorityOrdered接口的，再执行实现Ordered接口的，最后执行无优先级的。
        
    3. 核心逻辑：ConfigurationClassPostProcessor会解析配置类中的@ComponentScan注解，扫描指定包下的Bean并注册BeanDefinition；解析@Import、@Bean注解，注册对应BeanDefinition。
        
2. **执行BeanFactoryPostProcessor**：
    
    1. 获取所有实现BeanFactoryPostProcessor接口的Bean。
        
    2. 按优先级执行（同上述优先级规则）。
        
    3. 核心逻辑：修改已注册的BeanDefinition（如修改Bean的属性、作用域等）。
        

**扩展**：此步骤是BeanDefinition注册的核心，大部分Bean（如@Service、@Controller标注的类）都是通过此步骤批量注册到容器中的。

### 步骤6：registerBeanPostProcessors()——注册Bean后置处理器

核心目的：将容器中所有BeanPostProcessor注册到BeanFactory中，后续Bean创建时会调用这些后置处理器，干预Bean的初始化流程（如自动注入、代理创建、循环依赖处理）。

1. **获取所有BeanPostProcessor**：从BeanFactory中获取所有实现BeanPostProcessor接口的BeanDefinition。
    
2. **按优先级注册**：
    
    1. 先注册实现PriorityOrdered接口的BeanPostProcessor。
        
    2. 再注册实现Ordered接口的BeanPostProcessor。
        
    3. 最后注册无优先级的BeanPostProcessor。
        
    4. 单独注册MergedBeanDefinitionPostProcessor类型的后置处理器（用于合并BeanDefinition元信息）。
        
3. **注册ApplicationListenerDetector**：确保监听器Bean被正确识别并注册。
    

**扩展**：无代理模式下，容器默认注册6个BeanPostProcessor，分别是：ApplicationContextAwareProcessor、ConfigurationClassPostProcessorsAwareBeanPostProcessor、PostProcessorRegistrationDelegate、CommonAnnotationBeanPostProcessor、AutowiredAnnotationBeanPostProcessor、ApplicationListenerDetector。

### 步骤7：initMessageSource()——初始化国际化组件

核心目的：初始化MessageSource组件，支持国际化消息绑定和解析（如多语言配置文件）。

1. 检查容器中是否存在id为“messageSource”且类型为MessageSource的Bean，存在则直接使用。
    
2. 不存在则创建DelegatingMessageSource（默认实现），作为默认的MessageSource组件。
    
3. 将MessageSource注册到BeanFactory中，供其他Bean通过@Autowired自动注入，用于获取国际化消息。
    

### 步骤8：initApplicationEventMulticaster()——初始化事件派发器

核心目的：初始化事件派发器，负责事件的发布和监听器的管理，支撑Spring的事件驱动模型。

1. 检查容器中是否存在自定义的ApplicationEventMulticaster Bean，存在则直接使用。
    
2. 不存在则创建SimpleApplicationEventMulticaster（默认实现），作为事件派发器。
    
3. 将事件派发器注册到BeanFactory中，供其他组件发布和接收事件。
    

### 步骤9：onRefresh()——子类扩展刷新逻辑

核心目的：留给子类重写，在容器刷新过程中添加自定义逻辑。例如，Spring MVC的WebApplicationContext会重写此方法，初始化DispatcherServlet；Spring Boot的EmbeddedWebApplicationContext会重写此方法，启动嵌入式服务器（Tomcat、Jetty）。

### 步骤10：registerListeners()——注册监听器

核心目的：将容器中的ApplicationListener注册到事件派发器中，并派发早期事件。

1. 获取容器中所有ApplicationListener类型的Bean，注册到事件派发器中。
    
2. 派发步骤1中保存的早期事件（earlyApplicationEvents），确保早期事件被正确处理。
    

### 步骤11：finishBeanFactoryInitialization()——初始化非懒加载单例Bean

核心目的：初始化容器中所有非懒加载的单例Bean，完成Bean的创建、依赖注入、初始化方法执行等核心操作，是refresh()方法中最核心的步骤之一。

1. **获取所有BeanDefinition名称**：遍历BeanFactory中注册的所有BeanDefinition的名称。
    
2. **合并BeanDefinition**：将BeanDefinition与其父类BeanDefinition合并，生成RootBeanDefinition（包含完整的Bean元信息）。
    
3. **筛选单例、非抽象、非懒加载Bean**：仅对满足“单例（singleton）、非抽象（abstract=false）、非懒加载（lazy-init=false）”条件的Bean执行初始化。
    
4. **Bean创建流程**：通过getBean()方法触发Bean创建，核心流程包括：
    
    1. 实例化Bean（通过构造方法创建对象）。
        
    2. 属性注入（@Autowired、@Resource等注解的自动注入，处理循环依赖）。
        
    3. 初始化前（BeanPostProcessor#postProcessBeforeInitialization）：如AOP代理创建。
        
    4. 初始化方法执行（@PostConstruct注解方法、InitializingBean#afterPropertiesSet()、自定义init-method）。
        
    5. 初始化后（BeanPostProcessor#postProcessAfterInitialization）：如AOP代理增强。
        
5. **执行SmartInitializingSingleton#afterSingletonsInstantiated()**：所有单例Bean初始化完成后，执行此方法（扩展点，用于后续处理）。
    

**扩展**：懒加载Bean（@Lazy注解）会在首次调用getBean()时初始化，而非此步骤。

### 步骤12：finishRefresh()——容器刷新完成

核心目的：完成容器刷新的收尾工作，发布容器刷新完成事件，初始化生命周期处理器。

1. **initLifecycleProcessor()**：初始化生命周期处理器（LifecycleProcessor），默认创建DefaultLifecycleProcessor，用于管理Bean的生命周期（start、stop方法）。
    
2. **触发LifecycleProcessor#onRefresh()**：回调所有实现Lifecycle接口的Bean的start()方法。
    
3. **发布ContextRefreshedEvent事件**：告知所有监听器容器已刷新完成，Bean可正常使用。
    
4. **注册容器到LiveBeansView**：用于监控容器中的Bean状态（仅开发环境生效）。
    

## 3.3 扩展知识点

- **循环依赖处理**：Spring通过“三级缓存”解决单例Bean的循环依赖，核心是提前暴露未初始化完成的Bean实例，在步骤11的属性注入阶段使用。 **1. 什么是循环依赖**：两个或多个Bean相互依赖形成闭环，如A依赖B，B又依赖A；或A依赖B、B依赖C、C依赖A。 **2. 支持范围**：仅支持单例Bean的循环依赖，原型（Prototype）Bean不支持（每次获取都新建实例，无法提前暴露），构造方法注入的单例Bean也不支持（实例化前就需要依赖对象）。 **3. 三级缓存核心机制**： 一级缓存（singletonObjects）：存储完全初始化完成的单例Bean，供外部获取。
    
- 二级缓存（earlySingletonObjects）：存储提前暴露的、未完成属性注入和初始化的单例Bean实例，用于解决循环依赖时的临时获取。
    
- 三级缓存（singletonFactories）：存储Bean的实例工厂（ObjectFactory），用于延迟创建Bean的早期实例（若Bean需要AOP代理，可通过工厂生成代理实例后暴露）。
    

1. A开始实例化（通过构造方法创建对象），未完成属性注入和初始化，将A的实例工厂存入三级缓存。
    
2. A需要注入B，容器尝试获取B，发现B未实例化，开始实例化B。
    
3. B实例化后，需要注入A，容器从三级缓存获取A的实例工厂，生成A的早期实例（若有AOP代理则生成代理实例），存入二级缓存，删除三级缓存中的A工厂。
    
4. B注入A的早期实例，完成属性注入、初始化，成为完整Bean，存入一级缓存。
    
5. A获取到一级缓存中的完整B实例，注入完成，继续执行初始化流程，最终成为完整Bean，存入一级缓存，删除二级缓存中的A早期实例。
    

- **AOP的触发时机**：AOP代理的创建发生在Bean初始化前（postProcessBeforeInitialization），增强逻辑在初始化后（postProcessAfterInitialization）完成。
    
- **事件驱动模型**：Spring的事件派发基于观察者模式，通过ApplicationEventMulticaster连接事件发布者和监听器，支持同步/异步事件派发。
    

# 五、整体总结与实战关联

## 5.1 核心流程梳理

Spring容器启动的本质是「从配置到Bean实例化的全链路流程」：通过初始化容器组件（BeanFactory、解析器、扫描器）搭建基础环境，注册配置类和内置组件的BeanDefinition，再通过refresh()方法的12个步骤完成BeanDefinition解析、后置处理器执行、Bean初始化、组件装配，最终形成可用的Spring容器。

## 5.2 实战关联场景

- **自定义BeanPostProcessor**：可通过实现BeanPostProcessor接口，干预Bean的创建流程（如日志记录、属性修改、代理增强），需在步骤6中注册生效。
    
- **自定义BeanFactoryPostProcessor**：可通过实现BeanFactoryPostProcessor接口，修改BeanDefinition（如动态设置Bean属性），在步骤5中执行。
    
- **Spring Boot启动关联**：Spring Boot的启动本质是初始化Spring容器（AnnotationConfigServletWebServerApplicationContext），refresh()方法触发嵌入式服务器启动（onRefresh()步骤），实现自动装配。
    
- **面试高频考点**：refresh()方法的12个步骤、BeanFactory与ApplicationContext的区别、BeanPostProcessor与BeanFactoryPostProcessor的区别、循环依赖解决机制、AOP触发时机等。
    

## 5.3 核心原则提炼

Spring容器启动流程始终围绕「解耦、扩展、复用」三大原则，通过大量扩展点（后置处理器、Aware接口、事件机制）允许用户定制化开发，同时通过统一的流程管理确保容器的稳定性和一致性。理解Spring启动流程，是掌握Spring底层原理、排查启动故障、进行高级定制化开发的基础。