+++
date = "2016-06-07T22:40:32+12:00"
description = "Don't worry if you haven't noticed the differences, you call them with the exact same syntax."
title = "Func<T> vs. Expression<Func<T>> in LINQ"
url = "/func-t-vs-expression-func-t-in-linq"
+++

Linq is fantastic in that it provides a consistent syntax to query all sorts of data from in-memory collections, SQL databases, XML files, even external APIs. One of it's strengths is that you can write a Linq provider for any data source the you want to support.

Most people know about the "not obvious until it's obvious" difference between `IEnumerable<T>` and `IQueryable<T>` - one represents an in-memory collection and one represents a query which will be executed at some point against a data source. Both have an almost identical set of LINQ extensions, except the `IEnumerable<T>` extensions accept `Func<T>`  and the `IQueryable<T>` extensions accept `Expression<Func<T>>`. 

**Why??** We'll go over that next, the reason as it turns out illustrates the difference between `Func<T>` and `Expression<Func<T>>` really well.

#### Func&lt;T&gt; vs. Expression&lt;Func&lt;T&gt;&gt;

Go ahead - fire up Visual Studio and take a look at the method signatures of an IEnumerable and an IQueryable for the where linq extension.

* The IEnumerable version: `Where(Func<T, bool> predicate)`
* The IQueryable version: `Where(Expression<Func<T, bool>> predicate)`

Don't worry if you haven't noticed the differences, you call them with the exact same syntax.

* IEnumberable version: `.Where(x => x.property == "value")`
* IQueryable version: `.Where(x => x.property == "value")`

**So why the difference in signature if they have the same syntax?**

It boils down to the following difference

* **Func&lt;T&gt;** is just a pointer to an ordinary delegate that has been compiled down to IL (intermediate language) just like any other C# code that you write. There is nothing special about it.

* **Expression&lt;Func&lt;T&gt;&gt;** is a description of a function as an _expression tree_. It can be compiled to IL at run time that generates a Func&lt;T&gt; but it can also be translated to other languages e.g. SQL in LINQ to SQL.

You need an expression for IQueryable because we don't know what we're querying - the specific IQueryable implementation will translate the given expression into whatever language needed to access the data. E.g. SQL in LING to SQL, or a specific HTTP request for a REST API.

You don't need an expression for IEnumerable as it's just an in-memory collection that understands vanilla IL so we can save a whole bunch of overhead and throw compiled queries at it. 

You can convert an `Expression<Func<T>>` to a `Func<T>` by calling the the `Compile` method that compiles the expression tree to IL - this is done at run-time so has a performance overhead compared to dealing with `Func<T>` directly. You cannot convert a `Func<T>` to an `Expression<Func<T>>` as you cannot reverse engineer IL to get the original source code back at run time. Not only is it very difficult to reverse engineer but compiling is a lossy process full of performance tricks so you'll never be able to get the exact source code back even if you were super determined. 

##### Summary

Even if you skimmed the lot - all you really need to know is that `Func<T, bool>` is a pointer to a compiled delegate method and `Expression<Func<T, bool>>` is a description of a function that can be compiled to IL at runtime or translated into whatever language we have a provider for.