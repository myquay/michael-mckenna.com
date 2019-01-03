+++
date = "2013-08-14T11:51:32+12:00"
description = "If you're currently working on a project where all developers are using the same centralized development database, then chances are that's the way the project has been run since the beginning."
title = "You probably don't want your development team to share a single database"
url = "/you-probably-dont-want-your-development-team-to-share-a-single-database"
tags = ["article"]
+++

The shared database model has the developers building and running the web application on their own machine locally, but connecting remotely to the shared database. It's a super simple way to get started, and on the surface it has a few benefits:

* Changes are reflected instantly so all developers are working on the latest version of the database.

* Large data sets do not need to be replicated to each developer's machine.

But in reality there are quite a few problems with this model.

### Database is not under source control

When making updates to the database, there is no conflict/ merge management. When someone updates the database, they win. The last developer will always get his changes in. You could get your developers to talk to each other but communication costs rise exponentially with team size, and will fail at some point due to human error.

Your database needs to be in source control. That's [non-negotiable now](http://www.codinghorror.com/blog/2008/02/get-your-database-under-version-control.html "Coding Horror: Get Your Database Under Version Control"), you would never edit your code without version control, why your database? You can manage changes from a [versioning strategy](http://odetocode.com/blogs/scott/archive/2008/02/02/versioning-databases-change-scripts.aspx "Versioning Databases – Change Scripts") to [idempotent change scripts](http://haacked.com/archive/2006/07/05/bulletproofsqlchangescriptsusinginformation_schemaviews.aspx "Bulletproof Sql Change Scripts Using INFORMATION_SCHEMA Views").

### The developers can't try new things as easily

If a developer makes a destructive change to the database, then it affects all developers. A developer shouldn't be required to force their changes/ experiment on the entire team. This has an effect of ossifying the solution at a much earlier stage and ties developers to decisions made when they didn't know as much about the domain of the problem that they are solving.

### It's hard to restore old versions of the software

What if a customer reports a serious bug in the current production release of your software. You'd probably want to release a hot fix. To do that you'd need to restore the current production version in your development machine. That's the easy part, but you'll also need the database to be at the same version if a destructive change has been made. If you're using a shared database all your developers must be using the same version, usually the latest version. This can make fixing the serious bug quite difficult.

### Everyone needs to share the same data

A developer needs to test some edge cases for a new feature they're developing, they want to delete all the data in a particular table. They have to hope that no one else in their team is relying on some data in that particular table.

### Developers need to be connected

If a developer loses connectivity to the database server then they can no longer work on the solution. This means all that commute time on the train or bus end up as just wasted hours. Also if the user is located quite a geographical distance from the database and the application is quite chatty, then the developer will experience really slow page load times while developing.

### Increased friction from system engineers

Whenever a developer wants access to a particular database on the shared server then they need to get a sysadmin to grant them permissions. Not only that but if you want to do profiling then you need [ALTER TRACE permissions](http://www.troyhunt.com/2011/02/unnecessary-evil-of-shared-development.html "Troy Hunt: The unnecessary evil of the shared development database") on the master database level. If it were a local DB the developer would have no trouble granting whatever identity is calling the database these permissions.

## Wow, that's a lot of problems, what's another way?

Get developers to use a local database, that way they can:

* Place any change scripts from the [baseline version](http://odetocode.com/blogs/scott/archive/2008/01/31/versioning-databases-the-baseline.aspx "Versioning Databases – The Baseline") under source control

* Restore the database to any version locally

* Have their own sandbox that they can experiment in

* Reduced friction as they are the "sysadmin" of their own local database

### Summary

If you're currently working on a project where all developers are using the same centralized development database, then chances are that's the way the project has been run since the beginning. If you're a developer, ask why the project is structured that way, maybe it's the best way to get things done in that particular situation. Or is it because that's just the way it's always been?

If you're a team lead, ask yourself the real reason the project is set up the way it is. Remember, it's easy to move your team to their own isolated environment. Just create a [baseline](http://odetocode.com/blogs/scott/archive/2008/01/31/versioning-databases-the-baseline.aspx "Versioning Databases – The Baseline") script for the current centralised database and slowly move your team to a local database one at a time.