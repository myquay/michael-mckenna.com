---
publishDate: 2016-08-15T20:52:32+12:00
title: Optional arguments in C# interfaces
summary: In the interest of code-safety I don't put default values on implementing classes any more.
url: /optional-arguments-in-c-sharp-interfaces
tags:
    - csharp
---

Optional arguments are a nice feature in C# that have been around for a while now, they were [introduced back in 2010 with C# 4](http://weblogs.asp.net/scottgu/optional-parameters-and-named-arguments-in-c-4-and-a-cool-scenario-w-asp-net-mvc-2). They are often mentioned in the same breath as named arguments but are two completely different concepts.

The great thing with development is that there's always something new to learn, this week it for me it was the behaviour of optional arguments on interfaces that don't match the optional argument on the implementing class even though the feature has been around for what? _6 years now?!_

**Let's take a look at the example below**

```csharp
public interface IDefaultArgDemo
{
    void Write(string message = "hello!");
}

public class DefaultArgDemo : IDefaultArgDemo
{
    void Write(string message = "bye");
}

class Program
{
    static void Main(){
        DefaultArgDemo one = new DefaultArgDemo();
        IDefaultArgDemo two = new DefaultArgDemo();

        one.Write();
        two.Write();
    }
}

```

What do you think the output is? Which default parameter is chosen? Turns out the answer is simple - depends on what your reference is cast as, if it's the interface it'll use the interface default, if it's the class it will use the class default. This makes sense as the compiler [re-writes the caller, not the callee](https://ericlippert.com/2011/05/19/optional-argument-corner-cases-part-four/) and something cast as an interface wouldn't know what implementation to pick up.

Soooo... the output will be

```
bye
hello
```

This isn't a problem when the default parameters are the same but can provide some funny edge cases regarding code-safety when you're using dependency injection and dealing with a bunch of interfaces because it's not clear which default is being used when people look through your code. 

And _(at least for me)_ the first port of call when debugging a run-time issue is to run through the actual implementation so any bugs this introduces can be quite non-intuitive to find!

**Best practice recommendation**

I still like to put defaults on interfaces as it makes my code a lot more readable, and with IoC you're generally dealing in interfaces so get the benefits of optional arguments  in most cases. However, in the interest of code-safety I don't put default values on implementing classes any more - if you're dealing with an implementation directly, tough, you're going to have to be explicit. 

That way there's no chance of them actually getting out of sync 🙂