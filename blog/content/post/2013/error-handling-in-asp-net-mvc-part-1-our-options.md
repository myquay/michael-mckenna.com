+++
date = "2013-03-04T09:13:32+12:00"
description = "This is the first post in a two part series, in this part we will look at the options available to us in ASP.NET MVC for Error Handling."
title = "Error handling in ASP.NET MVC Part 1: Our options"
url = "/error-handling-in-asp-net-mvc-part-1-our-options"
tags = ["asp dot net mvc"]
+++

This blog and most of the web applications we build over at [solve.solutions](http://solve.solutions/ "solve.solutions") are based on Microsoft's ASP.NET MVC framework. We wanted a standardised way to approach error handling across our web applications. 

We had a couple of requirements

1. Super easy to implement
2. Covers the entire ASP.NET request pipeline
3. See friendly error messages in production and see stack traces in development
4. Respects HTTP status codes - we do not want the site returning a 302 redirect on error to redirect to an error page
5. Able to log exceptions

This is the first post in a two part series, in this part we will look at the options available to us in ASP.NET MVC.

### Exception Filters

Exception filters implement the *IExceptionFilter* interface and are applied as attributes on either actions or controllers. They catch exceptions that occur during the MVC pipeline like errors in filters, actions, or views. 
In addition to being applied as an attribute, you can register an *ExceptionFilter* as a global filter in MVC 3 or 4. By default ASP.NET's *HandleErrorAttribute* is registered.

    public class FilterConfig
    {
        public static void RegisterGlobalFilters(GlobalFilterCollection filters)
        {
            filters.Add(new HandleErrorAttribute());
        }
    }

By registering the filter as a global filter you no longer have to decorate every controller with an exception filter to manage exceptions.

ASP.NET MVC comes with an implementation of *IExceptionFilter* called *HandleError*.
[HandleError](http://msdn.microsoft.com/en-us/library/system.web.mvc.handleerrorattribute.aspx "HandleErrorAttribute Class (System.Web.Mvc)") is a great way to quickly get custom error pages working. But is not suitable for our requirements as it does not support logging.

### Controller OnException method

Another option is to create a base controller for all your controllers that overrides the *OnException* method and do all your error handling there.

I'm not a fan of this option as you need to remember to inherit from your base controller for every controller you create. This goes against my first goal of making everything super easy to implement.

### Global.aspx Application_Error

Application_Error will catch all unhandled ASP.NET errors that occur while a request is been processed. That includes errors outside of the scope of exception filters such as a 404 error. However once execution reaches this point we are out of the MVC context so it’s harder to get contextual information about the request.

### The approach we took

We went with a hybrid approach and used both a custom exception filter and the *Application_Error* event.

We use the custom exception filter that is registered globally to capture all exceptions that happen while processing the action and view. This allows us to do highly detailed logging that records a lot of contextual information about the user.

We use the Application_Error method as a fall back to catch any additional errors that occur in our application that may be outside of the exception filters's scope. The most common error we handle at this level is a 404 Page Not Found exception. This allows up to display a custom 404 page with the correct status code.

### How this meets our goals

**Super easy to implement**<br />
Filters are registered globally so there is no per-controller configuration that’s required.

**Covers the entire request pipeline**<br />
The Application_Error method ensures we cover the entire ASP.NET request processing pipeline however we capture additional information when we’re in the MVC context with our custom exception filter.

**See friendly error messages in production and stack traces in development**<br />
Our custom error filter and the Application_Error event will respect the *customErrors* property in the web.config 

**Respects HTTP status codes**<br />
We are able to send back the correct HTTP status codes with the custom error page rather than generic 302 which redirects to a static error page.

**Able to log exceptions**<br />
Our custom exception filter and Application_Error implementation will log exceptions.

### Next: The implementation

This is the first post in a two part series, [next we will look at our implementation of this error handling strategy](/error-handling-in-asp-net-mvc-part-2-our-implementation "Michael McKenna's Blog - Error handling in ASP.NET MVC Part 2: Our implementation").