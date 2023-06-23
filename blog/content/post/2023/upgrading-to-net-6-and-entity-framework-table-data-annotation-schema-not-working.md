---
date: 2023-06-23T10:00:00+12:00
title: Upgrading to .NET 6 and Entity Framework table data annotation schema not working
summary: After upgrading a .NET 3.1 ASP.NET Web Application to .NET 6 and Entity Framework from 3.1.1 to 7.0.8 the schema applied using the table data annotation was no longer respected
url: /upgrading-to-net-6-and-entity-framework-table-data-annotation-schema-not-working
tags:
    - Entity Framework
    - Migration Stories
---

### Background

I was updating a ASP.NET 3.1 app to ASP.NET 6 and updating the NuGet dependencies to keep everything under support. Once all the breaking changes where fixed I hit run and immediately hit a database exception.

```
SqlException: Invalid object name 'Users'.
```

### The problem

On closer inspection the SQL generated was no longer using the correct schema.

```
Microsoft.EntityFrameworkCore.Database.Command: Error: 
Failed executing DbCommand (6ms) [Parameters=[], CommandType='Text', CommandTimeout='30']

SELECT ...
FROM [Users] AS [u]
```

In the database, we had that under a schema called "Identity" - why is that no longer recognised by Entity Framework? In the code the schema was specified as a Table Data Annotation.

```c#
/// <summary>
/// User in the visitor system
/// </summary>
[Table("Users", Schema = "Identity")]
public class User
{
  ...  
}
```

Why is the schema no longer being respected when generating a SQL query? There was nothing I could see in the breaking changes for [EF Core 5.0](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-5.0/breaking-changes), [EF Core 6.0](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-6.0/breaking-changes) or [EF Core 7.0 (EF7)](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-7.0/breaking-changes) regarding the attribute, it should still be supported. So what's going on?

### How to fix it

After inspecting the data context I found additional table mappings for User using the ToTable method which had the schema omitted.

```c#
modelBuilder.Entity<User>().ToTable("Users");
```

I just added the schema to these mappings and removed the table attributes; everything started working again. Since this wasn't an issue until now I'm guessing somewhere down the line the order of precedence when evaluating these mappings changed between the different versions of EF Core.

I think throwing an exception where a table has two different mappings provided is useful. [Failing fast would have made the issue easier to debug.](https://www.martinfowler.com/ieeeSoftware/failFast.pdf)