+++
date = "2014-06-12T20:51:32+12:00"
description = "This post looks at performing dependency injection on a WebAPI ActionFilter using Unity."
title = "Dependency injection for ASP.NET Web API action filters in 3 easy steps"
url = "/dependency-injection-for-asp-net-web-api-action-filters-in-3-easy-steps"
tags = ["asp dot net mvc"]
+++

This post looks at performing dependency injection on a WebAPI ActionFilter using Unity. Since we're looking at WebAPI we'll be looking at classes which implement the `ActionFilterAttribute` base class under the `System.Web.Http.Filters` namespace. 

We will be using the [Unity Application Block (Unity)](https://github.com/unitycontainer/unity) to do most of the heavy lifting. It's a lightweight dependency injection container.

### 1) The ActionFilter

First you need to implement your shiny new ActionFilter that requires a dependency to be injected.

    public class MyCustomActionFilterAttribute : ActionFilterAttribute
    {
        [Dependency]
        public ISomeRepository SomeRepository { get; set; }

        public override void OnActionExecuting(HttpActionContext actionContext)
        {
            base.OnActionExecuting(actionContext);

            //do something amazing using that repository...
        }
    }

But now there's a problem, Web API no longer knows how to instantiate the ActionFilter as Web API knows nothing about ISomeRepository. We will fix this by modifying the default `ActionDescriptorFilterProvider`.

### 2) A unity aware ActionDescriptorFilterProvider

The IFilterProvider is where the magic happens, it provides an interface for finding filters.

We could implement IFilterProvider from scratch but we're not going to. In our implementation we're just going to create a new instance of the default filter provider (`ActionDescriptorFilterProvider`) and use its 'GetFilters' method to do most of the work. We just need to step in at the last moment and inject the dependencies.

    public class UnityFilterProvider : IFilterProvider
    {
        private IUnityContainer _container;
        private readonly ActionDescriptorFilterProvider _defaultProvider = new ActionDescriptorFilterProvider();

        public UnityFilterProvider(IUnityContainer container)
        {
            _container = container;
        }

        public IEnumerable&lt;FilterInfo&gt; GetFilters(HttpConfiguration configuration, HttpActionDescriptor actionDescriptor)
        {
            var attributes = _defaultProvider.GetFilters(configuration, actionDescriptor);

            foreach (var attr in attributes)
            {
                _container.BuildUp(attr.Instance.GetType(), attr.Instance);
            }
            return attributes;
        }
    }

We use the `ActionDescriptorFilterProvider`'s GetFilters to get all of the filters that would normally be returned, then we iterate over the collection and inject all of the dependencies. Lastly we return all of the newly injected filters.

There's only one piece left in the puzzle, telling Web API to use out new filter provider.

### 3) Configuring Web API to use the new filter provider

I like to register the filter provider at the same time I register Unity because it makes use of the container. I create a static class called `UnityConfig` and place it in the `App_Start` folder along with the other configuration classes.

    public static class UnityConfig
    {
        public static void Register(HttpConfiguration config)
        {
            //Register unity
            var container = new UnityContainer();

            container.RegisterType&lt;ISomeRepository, SomeRepository&gt;(new HierarchicalLifetimeManager());

            config.DependencyResolver = new UnityResolver(container);

            //Register the filter injector
            var providers = config.Services.GetFilterProviders().ToList();

            var defaultprovider = providers.Single(i =&gt; i is ActionDescriptorFilterProvider);
            config.Services.Remove(typeof(IFilterProvider), defaultprovider);

            config.Services.Add(typeof(IFilterProvider), new UnityFilterProvider(container));
        }
    }

Then in the Global.asax file we just add this one liner to kick everything off.

    UnityConfig.Register(GlobalConfiguration.Configuration);

Now we're ready to go, properties in your ActionFilters will now be injected by Unity.