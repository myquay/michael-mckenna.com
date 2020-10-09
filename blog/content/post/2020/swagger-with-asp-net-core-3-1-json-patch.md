+++
date = "2020-10-07T13:11:12+12:00"
description = "Generate the correct request schema for Patch operations in ASP.NET Core 3.1 which use JsonPatchDocument"
title = "JSON Patch Support with Swagger and ASP.NET Core 3.1"
subtitle = "Getting Swagger and JsonPatchDocument to play nice"
url = "/swagger-with-asp-net-core-3-1-json-patch"
tags = ["swagger","dot net core", "json-patch"]
summary = "By default the schema generated is that of JsonPatchDocument and not an array of operations. This is how I generated an accurate Swagger speficiation for my .NET Core API Project."
+++

## Introduction

.NET Core has great support for JsonPatch which looks a little something like this

```csharp

public async Task<ActionResult> UpdateUser(string id, 
    [FromBody] JsonPatchDocument<UserUpdateModel> patchDoc)
{
   ...
}

```

And we expect a request to come in with a body like

```json

[{
    "value": "Gordon",
    "path": "/name",
    "op": "replace"
},
{
    "value": "Freeman",
    "path": "/surname",
    "op": "replace"
}]

```

However if you're using the [Swashbuckle.AspNetCore.Swagger](https://www.nuget.org/packages/swashbuckle.aspnetcore.swagger/) library it will generate a description for the parameter type which is normally fine, but in this case it's `JsonPatchDocument<UserUpdateModel>` which doesn't represent the expected patch request doument.

![](/images/2020-json-patch-swagger-issue.png)

The example value is a bit random and not at all helpful - something about a `contractResolver`? API Clients don't care about that!

![](/images/2020-json-patch-swagger-issue-example.png)

Not ideal, but we can fix it. 

In this post we'll look at how to generate the correct schema as well as making sure the documentation has a good example value.

### Generating a correct request schema

To fix up the generated swagger document we will create a document filter to modify the generated specification.

```csharp
/// <summary>
/// Schema filter
/// </summary>
public class JsonPatchDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        //TODO...
    }
}

```

We need to make three updates to the swagger doc

 1. Remove the internal types for `JsonPatchDocument` and the internal operations
 2. Register a schema to represent the expected Patch request payload
 3. Update the operations to reference the newly registered schema


#### Step 1: Remove the internal types

The parameter `JsonPatchDocument<...> patchDoc` on the patch operation will cause a whole bunch of JsonPatchDocumentOf... and OperationOf... schemas to be registered. These don't accurately represent an expected request payload so we will remove them.


```csharp

//Remove irrelevent schemas
var schemas = swaggerDoc.Components.Schemas.ToList();
foreach (var item in schemas)
{
    if (item.Key.StartsWith("OperationOf") || item.Key.StartsWith("JsonPatchDocumentOf"))
        swaggerDoc.Components.Schemas.Remove(item.Key);
}

```

#### Step 2: Add a schema representing the expected PatchDocument payload

Now we've removed all the automatically generated patchdocument schemas, we need to add one which represents the expected JsonPatchDocument format which is an array of operations.

```csharp

//Add accurate PatchDocument schema
swaggerDoc.Components.Schemas.Add("Operation", new OpenApiSchema
{
    Type = "object",
    Properties = new Dictionary<string, OpenApiSchema>
    {
        {"op", new OpenApiSchema{ Type = "string" } },
        {"value", new OpenApiSchema{ Type = "object", Nullable = true } },
        {"path", new OpenApiSchema{ Type = "string" } }
    }
});

swaggerDoc.Components.Schemas.Add("JsonPatchDocument", new OpenApiSchema
{
    Type = "array",
    Items = new OpenApiSchema
    {
        Reference = new OpenApiReference { Type = ReferenceType.Schema, Id = "Operation" }
    },
    Description = "Array of operations to perform"
});

```

####  Step 3: Fix up the patch operation schema references

JSONPatch is unique in that the content-type of the patch document is not the same as the resource. [RFC 6902](https://tools.ietf.org/html/rfc6902) specifies the `application/json-patch` format which is the one we're using here. For completeness we will remove all content types except for `application/json-patch+json` from our swagger doc while updating the references.

```csharp

 //Fix up the patch references
foreach(var path in swaggerDoc.Paths.SelectMany(p => p.Value.Operations)
    .Where(p => p.Key == OperationType.Patch))
{
    foreach (var item in path.Value.RequestBody.Content.Where(c => c.Key != "application/json-patch+json"))
        path.Value.RequestBody.Content.Remove(item.Key);
    var response = path.Value.RequestBody.Content.Single(c => c.Key == "application/json-patch+json");
    response.Value.Schema = new OpenApiSchema
    {
        Reference = new OpenApiReference { Type = ReferenceType.Schema, Id = "JsonPatchDocument" }
    };
}

```

#### Register the filter

Now we've created our filter it just needs to be registered in the Startup class

```csharp

services.AddSwaggerGen(c =>
{

    ...

    c.DocumentFilter<JsonPatchDocumentFilter>();
}

```

At this point if you hit the swagger endpoint the schema should look something like this.

![](/images/2020-json-patch-swagger-issue-fixed.png)

### Registering a good example value

At this point everything should be in place from a code-gen perspective, but for us humans it's nice to have an annotated example. Especially if not all the properties on the resource are patchable. 

#### The Operation Class

First we need to make a class which represents a patch operation and needs to match what we specificed in our Schema eariler.

```csharp

    public class Operation
    {
        public object Value { get; set; }

        public string Path { get; set; }

        public string Op { get; set; }
    }

```

#### Registering an example

To add good examples we will use ExamplesProviders. 

First we need to let Swagger know to register any providers we create in this assembly.

```csharp

services.AddSwaggerExamplesFromAssemblyOf<JsonPatchUserRequestExample>();

```

Then for each operation we wish to provide custom example values for just implement the `IExamplesProvider`. 

We will create an example provider for our update user endpoint.

```csharp

public class JsonPatchUserRequestExample : IExamplesProvider<Operation[]>
{
    public Operation[] GetExamples()
    {
        return new[]
        {
            new Operation
            {
                Op = "replace",
                Path = "/name",
                    Value = "Gordon"
            },
            new Operation
            {
                Op = "replace",
                Path = "/surname",
                    Value = "Freeman"
            }
        };
    }
}

```

Then annotate the endpoint which uses this example


```csharp

...
[SwaggerRequestExample(typeof(Operation), typeof(JsonPatchUserRequestExample))]
public async Task<ActionResult> UpdateUser(string id, 
    [FromBody] JsonPatchDocument<UserUpdateModel> patchDoc)
{
    ...

```

And that's all there is to it, the generated documentation will now have a nice example.

![](/images/2020-json-patch-swagger-issue-example-fixed.png)



## We're done

That wraps up how to make Swagger and .NET Core Patch operations play nicely.

We've been able to

* Generate the correct schema for a PatchDocument
* Update the Patch Operation to reference the new schema
* Remove the old incorrect schemas
* Remove incorrect ContentTypes from the Patch operation
* Register a friendly example for a PatchDocument on a particular operation

Until next time!