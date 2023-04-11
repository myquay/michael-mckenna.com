+++
date = "2014-07-24T15:56:32+12:00"
description = "We’re going to create a formatter that understands JSON Patch."
title = "How to add JSON Patch support to ASP.NET Web API"
url = "/how-to-add-json-patch-support-to-asp-net-web-api"
tags = ["asp dot net mvc", "json patch"]
+++

In this post we'll look at how to introduce support for the [JSON Patch content type (RFC 6902)](https://tools.ietf.org/html/rfc6902) to ASP.NET Web API.

There's an unlimited number of ways to introduce HTTP Patch support into your API as there's no single specification on how to represent the set of changes to make to a resource.

> The PATCH method requests that a set of changes described in the request entity be applied to the resource identified by the Request- URI. The set of changes is represented in a format called a "patch document" identified by a media type.

The only way I could find to introduce HTTP Patch support was through adding a dependency on the Microsoft ODATA library. Unfortunately OData library does updates using a partial entity, [rather than a change document](https://www.odata.org/documentation/odata-version-3-0/odata-version-3-0-core-protocol#differentialupdate).

> A PATCH or MERGE indicates a differential update. The service MUST replace exactly those property values that are specified in the request body. Missing properties, including dynamic properties, MUST NOT be altered.

[I'm not that much of a fan](http://michael-mckenna.com/the-great-confusion-about-http-patch) of representing a set of changes as a partial entity. I don't want to introduce a dependency on the entire OData library just for their Patch support. I want to use the JSON Patch standard. 

So we're going to build it ourselves™

**TL;DR**: Not interested in the details, [grab the source on Github](https://github.com/myquay/JsonPatch), otherwise stick around for the implementation details.


### Getting started

I'm a huge fan of the concept of formatters in ASP.NET Web API, they allow you to provide first class support for your own media types. It gives a single point of entry for serialising and deserialising a model in a format expressed by a particular media type. This is a step up from ASP.NET MVC where only HTML or JSON were fully supported throughout the entire stack.

We're going to create a formatter that understands JSON Patch, it will bind the request to a "JsonPatchDocument" model which will encapsulate all the information required to modify an entity. Then we will be able to create some code to apply the changes in this model to an entity.

For this approach we'll need to do two things:

* Create our own media formatter to bind the JSON Patch request
* Implement a way to map those changes onto an entity

### The formatter

First we need to tell ASP.NET which content type our formatter should be invoked for.

    SupportedMediaTypes.Add(new MediaTypeHeaderValue("application/json-patch+json"));
    
We're binding our model the type JsonPatchDocument&lt;EntityToUpdate&gt;. By making our JsonPatchDocument generic we'll be able to validate the paths we wish to operate on at the formatter level, before we get to the controller.

This binding type means our CanReadType implementation looks something like this.

    public override bool CanReadType(Type type)
        {
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(JsonPatchDocument<>))
            {
                return true;
            }
            else
            {
                return false;
            }
        }

A JSON Patch document is essentially an array of operations that looks something like this

    [
     { "op": "test", "path": "/a/b/c", "value": "foo" },
     ... more operations ...
     { "op": "copy", "from": "/a/b/d", "path": "/a/b/e" }
    ]

All our formatter needs to do is deserialise this set of instructions and construct a JsonPatchDocument

    public override object ReadFromStream(Type type, System.IO.Stream readStream, System.Net.Http.HttpContent content, IFormatterLogger formatterLogger)
    {
        var entityType = type.GetGenericArguments()[0];

        using (StreamReader reader = new StreamReader(readStream))
        {
            var jsonPatchDocument = (IJsonPatchDocument)typeof(JsonPatchDocument<>)
                .MakeGenericType(entityType)
                .GetConstructor(Type.EmptyTypes)
                .Invoke(null);

            var jsonString = reader.ReadToEnd();
            var operations = JsonConvert.DeserializeObject<PatchOperation[]>(jsonString);

            foreach (var operation in operations)
            {
                if (operation.op == Constants.Operations.ADD)
                {
                    jsonPatchDocument.Add(operation.path, operation.value);
                }
                else if (operation.op == Constants.Operations.REMOVE)
                {
                    jsonPatchDocument.Remove(operation.path);
                }
                else if (operation.op == Constants.Operations.REPLACE)
                {
                    jsonPatchDocument.Replace(operation.path,  operation.value);
                }
                else
                {
                    throw new JsonPatchParseException(String.Format("The operation '{0}' is not supported.", operation.op));
                }
            }

            return jsonPatchDocument;

        }
    }

That's it, that's all you need to do to introduce support for additional media types. However we won't cover the implementation details of our "JsonPatchDocument" here. It's the second piece of the puzzle that maps those operations to updates on an existing entity.

### Usage

Now we have the formatter we can use it to bind the request.

First add it to the formatters available

    public static void ConfigureApis(HttpConfiguration config)
    {
        config.Formatters.Add(new JsonPatchFormatter());
    }

Now the JsonPatchDocument will be available in our controller. With the default routing the PATCH verb matches the Patch action on a Web API controller.

    public void Patch(Guid id, JsonPatchDocument<SomeDto> patchData)
    {
        //Remember to do some validation and all that fun stuff
        var objectToUpdate = repository.GetById(id);
        patchData.ApplyUpdatesTo(objectToUpdate);
        repository.Save(objectToUpdate);
    }
    
Notice the .ApplyUpdatesTo method? That's where all the details about how we translate those operations into changes on the entity.


### The library

All the source code is available and licensed under the [MIT license](https://github.com/myquay/JsonPatch/blob/master/LICENSE). [It is hosted on GitHub, have a poke around](https://github.com/myquay/JsonPatch). 

If you have any suggestions or want to contribute, I'd love to hear from you.