---
publishDate: 2014-05-28T13:51:32+12:00
title: Implementing XML-RPC services in ASP.NET MVC
summary: We'll look at how we implemented XML-RPC services in ASP.NET MVC by creating a custom model binder.
url: /implementing-xml-rpc-services-in-asp-net-mvc
tags:
    - asp dot net mvc
---

Earlier this month I moved my blog to a brand new design to improve the readability of the posts.

The admin section was also in desperate need of an upgrade but it would have taken a lot of development effort to create something decent. I ended up just nuking it in favour of using a desktop blogging client. To support various 3rd party blogging clients we just need to implement the [MetaWeblog API](https://codex.wordpress.org/XML-RPC_MetaWeblog_API).

In this post we'll look at how we implemented XML-RPC services in ASP.NET MVC by creating a custom model binder.

## XML-RPC recap

It's a way to make remote method calls over HTTP using XML. Super lightweight. 

```xml
<?xml version='1.0'?> 
<methodCall> 
    <methodName>metaWeblog.newPost</methodName>  
    <params> 
        <param><value><string>BLOG_ID</string></value> </param> 
        ...other params... 
    </params> 
</methodCall>
```

Doesn't look too bad, one problem is that this format isn't key-value based so it doesn't lend itself to been interpreted through a value provider. Unfortunately this means we cannot use the default model provider.

## Existing options

There wasn't much in the way of MVC integration. The best library out there which I could find is [XML-RPC.NET](https://github.com/marcosbozzani/xmlrpcnet) developed by [Charles Cook](https://github.com/charlescook). Scott Hanselman has a [great write up on the topic](https://www.hanselman.com/blog/TheWeeklySourceCode55NotABlogALocalXMLRPCMetaWebLogEndpointThatLiesToWindowsLiveWriter.aspx) and he even mentions support with ASP.NET MVC 1.

> (Actually, as a curiosity back in the ASP.NET MVC 1.0 timeframe both Phil and I write XmlRpcRoutes and supporting samples just to see if it was possible. It is.)
  \
  \
  -- Scott Hanselman


However this follow up post *(Blog post no longer available)* on Charles' website indicates that we just hard code a route to the service. 

```csharp
using System.Web;
using System.Web.Routing;

public class StateNameRouteHandler : IRouteHandler
{
    public IHttpHandler GetHttpHandler(RequestContext requestContext)
    {
        return new StateNameService();
    }
}
```

This works perfectly but isn't really the MVC Way™. I want to route to a controller based on the 'methodCall' parameter.

Jono gets a lot closer with his blog post 'Implementing XML-RPC services with ASP.NET MVC' *(Blog post no longer available)* and gets routing implemented but then deserialises the data by using a filter. 

I don't think there's much wrong with using filter but I wanted to use a model binder. It shouldn't actually matter what format the request is in, we should be able to route and bind it. So for example, if I wanted to move from XML-RPC to json then I'd just support an alternative model binder.

## My approach

Jono had a pretty good reason for using a filter; he didn't want to implement an entire model binder. A model binder also has a few problems with non-dictionary sources as we'll find out. 

I briefly looked at using the default model binder with a custom value provider but since XML-RPC isn't key-value based we're stuck at the model binder level of abstraction.

### Step 1: Routing the request

A route in ASP.NET MVC maps a request to a handler, here we will just do something similar to Jono's implementation.

```csharp
public class XmlRpcRoute : Route //Extend the base route class
{

    ...omitted...
    
    public override RouteData GetRouteData(HttpContextBase httpContext){
        RouteData routeData = base.GetRouteData(httpContext);
        
        if (routeData == null) return null;
        if (httpContext.Request.InputStream == null || httpContext.Request.InputStream.Length == 0) return null;

        var xml = XDocument.Load(httpContext.Request.InputStream);

        var rootElement = xml.Document.Element("methodCall");
        if (rootElement == null) throw new HttpException(400, @"The ""methodCall"" element is missing.");

        var methodNameElement = rootElement.Element("methodName");
        
        ...omitted...

        var methodNameParts = methodNameElement.Value.Split('.');
            routeData.Values["controller"] = methodNameParts[0];
            routeData.Values["action"] = methodNameParts[1];
            
        return routeData;
        
    }
}
```

Here we read in the XML-RPC request payload and set the controller and action of the method that we wish to call based on the 'methodCall' element. Note that the above code isn't very error safe so be careful with the ol' ctrl+c, ctrl+v. Get the source from the [project on Github instead](https://github.com/myquay/Chq.XmlRpc.Mvc).

Then to use the above route, just add it to the routes collection. I'd map it to something like **api/xml-rpc**.

### Step 2: The Model Binding Provider

Now that we are routing the request to the correct controller we want to be able to detect if this is an XML-RPC request before we try bind to it with a XML-RPC model binder.

We will do this by checking that the content type is **text/xml** and that the root element is **methodCall**.

```csharp
public class XmlRpcModelBinderProvider : IModelBinderProvider
{
    public IModelBinder GetBinder(Type modelType)
    {
        var httpContext = HttpContext.Current;
        if (httpContext == null) return null;

        public class XmlRpcModelBinderProvider : IModelBinderProvider

        var contentType = httpContext.Request.ContentType;
        if (string.Compare(contentType, @"text/xml", StringComparison.OrdinalIgnoreCase) != 0) return null;

        if (httpContext.Request.InputStream == null || httpContext.Request.InputStream.Length == 0) return null;

        XDocument xml = XDocument.Load(httpContext.Request.InputStream);
        if (xml.Document.Element("methodCall") == null) return null;

        return new XmlRpcModelBinder();
    }
}
```

### Step 3: The Model Binder

Before we can bind parameters to the request we need to deserialise it. I really wanted to use XML-RPC.NET for this, but I couldn't find a way to use it to parse only the XML-RPC request without having a service contract defined. So unfortunately we had to roll our own.

I'm the first to say that the implementation below isn't at all ideal, one of the biggest points of contention is that we must parse the whole request for each binding parameter. Secondly because XML-RPC relies on ordering rather than keys, we have to reflect the parameters of the calling action method to discover their position in the method signature. This is so that we can decided which value in the request to bind to the parameter. 

A little hacky... but it's a start right?

```csharp
public object BindModel(ControllerContext controllerContext, ModelBindingContext bindingContext)
{
    //Get access to the list of parameters in the calling action.
    var controllerDescriptor = new ReflectedControllerDescriptor(controllerContext.Controller.GetType()).FindAction(controllerContext, controllerContext.RouteData.GetRequiredString("action"));
    var parameters = controllerDescriptor.GetParameters().ToList();
    
    //XML-RPC relies on the ordering of the elements, get the position of the current parameter that we're binding
    var parameterOfInterest = parameters.Single(p => bindingContext.ModelName == p.ParameterName);
    var paramNumber = parameters.IndexOf(parameterOfInterest);

    XDocument xDoc = XDocument.Load(controllerContext.HttpContext.Request.InputStream);
    var inputParameters = xDoc.Descendants("params").Elements().ToArray();

    if (inputParameters.Length <= paramNumber) return null; //No data for this parameter, return null

    var model = XmlRpcData.DecodeValue(inputParameters[paramNumber].Elements("value").Single(), bindingContext.ModelType);
    controllerContext.HttpContext.Request.InputStream.Seek(0, System.IO.SeekOrigin.Begin); //Reset the stream for the next pass
    return model;
}
```

You might have noticed that we're magically  decoding the value of the parameter using the static method 'XmlRpcData.DeserialiseValue'. That's one that we've created and you can grab the code in the [project on Github](https://github.com/myquay/Chq.XmlRpc.Mvc).

### Step 4: The Response

The last step is to pipe back the response, in the XML-RPC format. To to this we will be creating a custom "XmlRpcActionResult" that extends "ActionResult". Our custom action result will be responsible for returning our object as an XML-RPC response.

```csharp
public class XmlRpcResult : ActionResult
{
    private XDocument _responseObject;

    public XmlRpcResult(object data)
    {
        _responseObject = new XDocument(new XElement("methodResponse"));

        ...omitted...
        
        //Encode as params
        _responseObject.Element("methodResponse").Add(
            new XElement("params",
                new XElement("param",
                    XmlRpcData.SerialiseValue(data))));
    }

    public override void ExecuteResult(ControllerContext context)
    {
        if (_responseObject != null)
        {
            var response = _responseObject.ToString();
            context.HttpContext.Response.ContentType = "text/xml";

            context.HttpContext.Response.Headers["content-length"] = ASCIIEncoding.UTF8.GetBytes(response).Length.ToString();
            context.HttpContext.Response.Output.Write(response);
        }
    }
}
```


## The result

Now instead of defining a service interface and hard-coding a routing to it [like originally mentioned here](http://cookcomputing.com/blog/archives/Implementing%20an%20xml-rpc-service-with-asp-net-mvc) we can have normal MVC controllers that pick up the service calls. Even though [Jono's implementation](http://tech-journals.com/jonow/2012/01/25/implementing-xml-rpc-services-with-asp-net-mvc) gave me the inspiration to write this library we no longer need to add additional plumbing to the controllers to get them to work with XML-RPC formatted requests. 

Since this looks like any other controller you can call it using a form post or any other binding method that you decide to support, the only problem is that the response is always in XML-RPC due to our XmlRpcResult method.

To be honest this probably would have fit a little more nicely into the WebAPI model with its [media formatters ](http://www.asp.net/web-api/overview/formats-and-model-binding/media-formatters) but maybe we'll look at that some other time.

### Usage

It's pretty simple to set up. First wire up the routing.

```csharp
routes.MapXmlRpcRoute("xml-rpc", "api/xml-rpc");
```

Then wire up the model binder

```csharp
ModelBinderProviders.BinderProviders.Add(new XmlRpcModelBinderProvider());
```
    
Create a controller that matches the methodCall parameter on the XML-RPC Request. For example here's a controller that supports the newPost method of the MetaWeblog API.  

```csharp
public class MetaWeblogController : Controller
{
    public XmlRpcResult NewPost(string blogid, string username, string password, Post post, bool publish)
    {
            ...omitted, logic to create a new post...
            return new XmlRpcResult(id.ToString());
    }
}
```

### The source code

Check out the [source on Github here](https://github.com/myquay/Chq.XmlRpc.Mvc). 

I haven't exactly "battle tested" the code and I have my doubts regarding performance and stability so use it at your own risk. Please help me fix any bugs you come across and feel free to use it in your own works as it's released under the [MIT License](http://opensource.org/licenses/mit-license.html) just like the awesome [XML-RPC.NET library](https://github.com/marcosbozzani/xmlrpcnet).
