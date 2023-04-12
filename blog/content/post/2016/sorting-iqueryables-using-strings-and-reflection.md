+++
date = "2016-05-10T09:56:32+12:00"
description = "Wouldn't it be great to be able to specify the property to order on at runtime for a LINQ query?"
title = "Sorting IQueryables using strings and reflection"
url = "/sorting-iqueryables-using-strings-and-reflection"
tags = ["linq", "guide", "csharp"]
+++

Wouldn't it be great to be able to specify the property to order on at runtime for a LINQ query? 

I.e. ``` items = items.OrderBy("SomeProperty");``` rather than ``` items = items.OrderBy(s => s.SomeProperty);```

### How to dynamically sort an IQueryable 

Later on in this post we'll go into depth on how to implement an extension method from first principles to do just that but if you just want to quickly use a string to sort an IQueryable right away- go ahead and install Dynamic LINQ. It's a great little library [Scott Gu mentions here](http://weblogs.asp.net/scottgu/dynamic-linq-part-1-using-the-linq-dynamic-query-library) which is perfect for building up LINQ queries on the fly. Among other things it enables dynamic sorting.

**How to install**

    install-package System.Linq.Dynamic

**How to use**

Reference ```System.Dynamic.Linq``` and then you can order your LINQ queries like this


    using(var ctx = new Entities()){
        return ctx.Items
            .Where(...some expression...)
            .OrderBy("SomeProperty")
            ....
    }

### In depth: How to dynamically sort an IQueryable 

The Dynamic LINQ library is great for getting things done - but how does it actually work?? My favourite thing about the library is that the source code is available so I was able to take a look under the hood. 

Here we'll create our own simplified extension method that allows you to order an IQueryable by a string using a similar method to Dynamic LINQ. It's nowhere near as complete as Dynamic LINQ but it's enough to demonstrate the idea behind the magic.

#### The implementation details

To make things easier on ourselves we have a few limitations, no nested properties, and it only supports public primitive types, etc.

We'll break the process into three steps

**1. Validate the property name**

The first step isn't that exotic, it's just bog-standard reflection to check we won't run into trouble later. Since it's dynamic the compiler hasn't checked this is a valid property or anything.

    var searchProperty = typeof(T).GetProperty(property);

    ...Validate the property can be ordered on...

Once we're happy that we're ordering on a valid property we can go ahead and modify the underlying expression for our IQueryable.

**2. Create the property selector**

In this step we're building up the property selector of the OrderBy method. 
_The parameter in the orderby call: OrderBy(**o => o.SomeProperty**)_

First we define the parameter

    var parameterExpr = Expression.Parameter(typeof(T), "o")

_Result: **o**_

Next we specify the property we want to sort on


    //property = "SomeProperty"
    var propertyExpr = Expression.Property(parameterExpr, property); 

_Result: **o.SomeProperty**_

Finally we compose the property selector


    var selectorExpr = Expression.Lambda(propertyExpr , parameterExpr)

_Result: **o => o.SomeProperty**_

Now we have the dynamic property selector built from a string which will be used in our OrderBy clause.

**3. Update the Expression to OrderBy on our dynamic property selector**

First we get the underlying expression for the IQueryable, we need to modify this expression to tack an "OrderBy" clause on the end. 

You can think of this expression as the current definition of the IQueryable which we are going to modify.


    Expression queryExpr = source.Expression;


Next we specify a call to either "OrderBy" or "OrderByDescending" using our property selector from step 2.


    queryExpr = Expression.Call(
            //type to call method on
            typeof(Queryable), 
            //method to call
            asc ? "OrderBy" : "OrderByDescending", 
            //generic types of the order by method
            new Type[] { 
                    source.ElementType, 
                    searchProperty.PropertyType },
            //existing expression to call method on
            queryExpr,
            //method parameter, in our case which property to order on
            selectorExpr);


Finally we return a new updated IQueryable which is now sorted by the specified property


    return source.Provider.CreateQuery<T>(queryExpr);


Yep - that's it. We're good to go!

#### The example source code

Note: it's not been designed with production use in mind.


    public static IQueryable<T> OrderBy<T>(this IQueryable<T> source, 
    string property, 
    bool asc = true) where T : class
    {
        //STEP 1: Verify the property is valid
        var searchProperty = typeof(T).GetProperty(property);
        
        if (searchProperty == null)
            throw new ArgumentException("property");

        if (!searchProperty.PropertyType.IsValueType &&
            !searchProperty.PropertyType.IsPrimitive &&
            !searchProperty.PropertyType.Namespace.StartsWith("System") &&
            !searchProperty.PropertyType.IsEnum)
            throw new ArgumentException("property");

        if (searchProperty.GetMethod == null || 
            !searchProperty.GetMethod.IsPublic)
            throw new ArgumentException("property");

        //STEP 2: Create the OrderBy property selector
        var parameter = Expression.Parameter(typeof(T), "o");
        var selectorExpr = Expression.Lambda(
                Expression.Property(parameter, property), parameter)        

        //STEP 3: Update the IQueryable expression to include OrderBy
        Expression queryExpr = source.Expression;
        queryExpr = Expression.Call(
            typeof(Queryable), 
            asc ? "OrderBy" : "OrderByDescending",
            new Type[] { 
                source.ElementType, 
                searchProperty.PropertyType },
            queryExpr, 
            selectorExpr);

        return source.Provider.CreateQuery<T>(queryExpr);
    }


It's super easy to use, now you can go


    items = items
        .OrderBy("SomeProperty");


which will have the exact same result as


    items = items
        .OrderBy(s => s.SomeProperty);


Except now the property doesn't need to be hard coded and can be specified at run-time. Enjoy!!