+++
date = "2013-02-17T20:31:32+12:00"
description = "If you don't bother with correct pluralisation your users will be less likely to appreciate the care you put into the rest of your application."
title = "Simple pluralisation in ASP.NET MVC"
url = "/simple-pluralisation-in-asp-net-mvc"
tags = ["asp dot net mvc"]
+++

Your software application is like an iceberg. Your users only see a small fraction of the application, the parts that they interact with. Your application can be a mess under the covers but as long as you have a beautiful, quick interface that's super usable, your uses will think your app is designed really well.

If you don't bother with correct pluralisation your users will be less likely to appreciate the care you put into the rest of your application.

For something that can be achieved pretty easily (in English at least) it's surprisingly common to see this pattern

!["Missing pluralisation example in Visual Studio"](/images/visual-studio-git-message.png)

where the "s" is surrounded in parentheses to indicate that it is optional. Not only does this look a little untidy but the sentence still doesn't make sense, "these" should also be changed to "this".

### Ruby on Rails has a cool helper method for pluralisation

Ruby [has a TextHelper](http://api.rubyonrails.org/classes/ActionView/Helpers/TextHelper.html#method-i-pluralize "ActionView::Helpers::TextHelper") called pluralize for this very purpose.

It lets you specify the count and the singular version of the noun, it then uses the Inflector to determine the plural form. However you can override the Inflector by specifying the plural yourself.

> pluralize(1, 'person') <br />
> \# => 1 person
>
> pluralize(2, 'person') <br />
> \# => 2 people
>
> pluralize(3, 'person', 'users') <br />
> \# => 3 users

### Let's port this to MVC

First we need to decide how we are going to pluralise words. Luckily for us [Entity Framework has a pluralisation service](http://www.hanselman.com/blog/FunWithNounPluralizationLibrariesAndTheNETFramework.aspx "Fun with Noun Pluralization libraries and the .NET Framework - Scott Hanselman") that we can in place of the "Inflector" that Ruby on Rails uses.

Secondly we need to decide on how the library is going to be used. I only really want to use this in my razor views and [I love the @helper syntax](http://weblogs.asp.net/scottgu/archive/2011/05/12/asp-net-mvc-3-and-the-helper-syntax-within-razor.aspx "ASP.NET MVC 3 and the @helper syntax within Razor - ScottGu's Blog") that was introduced in ASP.NET MVC 3 so we'll go with that. We'll also stick with the same method signature from the RoR TextHelper. However the code is simple so you can easily pull out the implementation and use it in your own way.

### The implementation

1\. Add the reference **System.Data.Entity.Design** to your project.

2\. Reference the assembly in our Web.config so it can be found when the razor helper is compiled

    <system.web>
        <compilation debug="true" targetFramework="4.5">
            <assemblies>
                <add assembly="System.Data.Entity.Design, Version=4.0.0.0, Culture=neutral"/>
              </assemblies>
        </compilation>
        ...

3\. Create a folder called App_Code and place a file called StringHelper.cshtml in it

4\. StringHelper.cshtml has the following code to enabled the pluralisation functionality

    @using System.Data.Entity.Design.PluralizationServices
    @using System.Threading

    @helper Pluralise(int count, string singular)
    {
        @(count == 1 ? singular : PluralizationService.CreateService(Thread.CurrentThread.CurrentUICulture).Pluralize(singular));
    }

    @helper Pluralise(int count, string singular, string plural)
    {
        @(count == 1 ? singular : plural);
    }

### You're done! 

It is now available in all your razor views and can be used like this

     @StringHelper.Pluralise(2, "penguin") 
     @* will output penguins *@

A sample web project with this code is [available on GitHub](https://github.com/myquay/Chq.PluralisationSample "myquay/Chq.PluralisationSample · GitHub")

Getting pluralisation right is an easy way to make your application look that little bit better to the end user.