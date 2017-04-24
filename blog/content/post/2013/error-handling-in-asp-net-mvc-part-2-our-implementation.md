+++
date = "2013-03-11T02:09:32+12:00"
description = "A simple exception handling strategy that enables detailed logging in MVC context but also provides support for general ASP.NET errors such as page not found exceptions."
title = "Error handling in ASP.NET MVC Part 2: Our implementation"
url = "/error-handling-in-asp-net-mvc-part-2-our-implementation"
+++

[In part 1 of this series](/error-handling-in-asp-net-mvc-part-1-our-options "Michael McKenna's Blog - Error handling in ASP.NET MVC Part 1: Our options") we looked at the options available to us to handle errors in ASP.NET MVC. In this part of the series we will look at our implementation.

Our implementation consists of two components. A custom exception filter that’s registered globally to handle any exceptions while processing filters, actions, and views. The *Application_Error* method in *Global.aspx* to catch any other errors generated while ASP.NET processes the request.

### The custom exception filter

First we’ll create the custom exception filter. This will manage exceptions encountered while we’re processing filters, actions, and views.

First we give every error we log a correlation Id. This helps us track down the error when a user reports a problem to us. We can get the exact details of the error by just asking them to give us the correlation id displayed on the error page.

We then either specify a view result of JSON or HTML depending on if the request was the result of an AJAX call.

We then set the correct HTTP status code, mark the error as handled and return the view.

Here's the code, please note it has been simplified for readability.

    public void OnException(ExceptionContext filterContext)
    {
        //Don't bother if custom errors are turned off or if the exception is already handled
        if (filterContext.ExceptionHandled || !filterContext.HttpContext.IsCustomErrorEnabled)
            return;

        //Get currently logged in user (null if anonymous)
        Guid? loggedInUserId = ...

        //Log the exception and get a correlation id
        Guid? correlationId = Logger.LogException(…)

        var httpException = filterContext.Exception as HttpException;

        //Set the view correctly depending if it's an AJAX request or not
        if (filterContext.HttpContext.Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            filterContext.Result = new JsonResult
            {
                JsonRequestBehavior = JsonRequestBehavior.AllowGet,
                Data = new
                {
                    error = true,
                    correlationId = correlationId
                }
            };
        }
        else
        {
            string view = "~/Views/Error/Index.cshtml";
            if (httpException != null)
            {
                if (httpException.GetHttpCode() == 404)
                {
                    view = "~/Views/Error/NotFound.cshtml";
                }
            }

            filterContext.Result = new ViewResult
            {
                ViewName = view,
                ViewData = new ViewDataDictionary<Guid?>(correlationId)
            };
        }

        //If it's not a httpException, just set the status code as 500
        if (httpException != null)
        {
            filterContext.HttpContext.Response.StatusCode = httpException.GetHttpCode();
        }
        else
        {
            filterContext.HttpContext.Response.StatusCode = 500;
        }
            
        filterContext.Result.ExecuteResult(filterContext.Controller.ControllerContext);
        filterContext.ExceptionHandled = true;
        filterContext.HttpContext.Response.Clear();
        filterContext.HttpContext.Response.TrySkipIisCustomErrors = true;
    }

### The global exception handler

Finally if it's some other general ASP.NET error like if the page doesn't exist then we just do some basic logging and render the error page.

    protected void Application_Error()
    {
        var exception = Server.GetLastError();
        Server.ClearError();
        var httpException = exception as HttpException;

        //Logging goes here

        var routeData = new RouteData();
        routeData.Values["controller"] = "Error";
        routeData.Values["action"] = "Index";

        if (httpException != null)
        {
            if (httpException.GetHttpCode() == 404)
            {
                routeData.Values["action"] = "NotFound";
            }
            Response.StatusCode = httpException.GetHttpCode();
        }
        else
        {
            Response.StatusCode = 500;
        }

        // Avoid IIS7 getting involved
        Response.TrySkipIisCustomErrors = true;

        // Execute the error controller
        IController errorsController = new ErrorController();
        HttpContextWrapper wrapper = new HttpContextWrapper(Context);
        var rc = new RequestContext(wrapper, routeData);
        errorsController.Execute(rc);
    }

### The result

If we hit an exception in the ASP.NET MVC pipeline such as a error in our razor view we’ll now get the following result

![Sample error page](/images/unexpected-error.png)

Not only do we have a nice view but we also return the correct HTTP status code

![HTTP Status code of the sample error page](/images/error-status-code.png)

If it's a ASP.NET error like a page that doesn't exist we’ll get the following result

![Sample page not found page](/images/page-not-found-error.png)

And it also gives us a nice HTTP status code

![HTTP Status code of the sample page not found page](/images/page-not-found-status-code.png)

### Conclusion

Now we have a simple exception handling strategy that enables detailed logging in MVC context but also provides support for general ASP.NET errors such as page not found exceptions. However this approach does require you to add an error controller with two actions called Index and NotFound. This is required to render the views from the *Application_Error* method after we have lost the current MVC context.