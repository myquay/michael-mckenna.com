+++
date = "2016-11-17T20:52:32+12:00"
description = "Let's write the script - it's super simple. It's designed to be placed in the parent folder of your Git repositories."
title = "Update multiple Git repositories on Windows at once using Powershell"
url = "/update-multiple-git-repositories-on-windows-at-once-using-powershell"
+++

If you've got a bit of time there's plenty of guides on how to set up Git and Powershell but to make things simple we're just going to go ahead and download [GitHub Desktop](https://desktop.github.com/). Phil Haack did a pretty good job at convincing me that even though GitHub Desktop is a GUI app - [it's a great way to get the Git command line set up and kept up to date also](http://haacked.com/archive/2015/10/29/git-shell/). In-fact that single blog post made the whole process ridiculously straight forward.

My favourite things GitHub desktop does is

* Install [Post-Git](https://github.com/dahlbyk/posh-git) for you. Fantastic set of scripts to provide Git/Powershell integration.
* Set itself up as a credential provider (amazingly useful if you have 2FA set up!!)
* Install all the tools as portable versions so it doesn't mess with your computer

#### Okay I'm sold - I've installed GitHub Desktop now what?

We write the script - it's super simple. It's designed to be placed in the parent folder of your Git repositories and it will run `git pull` on all sub folders that contain a `.git` directory. As long as you've granted GitHub Desktop access to your remote repositories you will not have to re-enter your credentials each time you run the script.

Here's the script - I've split it into two parts.

**Part 1: Configure for GitHub Desktop environment**

You need to [have two snippets up the top](http://haacked.com/archive/2015/10/29/git-shell#powershell-configuration) to make sure it's configured to use all the goodness GitHub Desktop set up for us.

```  
#1. Set up all the environment variables
Write-Host "Setting up GitHub Environment"
. (Resolve-Path "$env:LOCALAPPDATA\GitHub\shell.ps1")

#2. Set up Post-Git
Write-Host "Setting up Posh-Git"
. (Resolve-Path "$env:github_posh_git\profile.example.ps1")

git config --global credential.helper wincred
```
**Part 2: Run git pull on all of our repositories**

Now we literally just need to step through all the relevant repositories.

```
Get-ChildItem -Recurse -Depth 2 -Force | 
 Where-Object { $_.Mode -match "h" -and $_.FullName -like "*\.git" } |
 ForEach-Object {
    cd $_.FullName
    cd ../
    git pull
    cd ../
 }
```

**Optional bonus points: Add a .bat file for one-click run**

```
PowerShell -NoProfile -ExecutionPolicy RemoteSigned -Command "& './sync-all-git-repo-script.ps1'"
```

When you run the script using the `sync.bat` you should see something like this.

![](/images/git-cmd.png)

Thanks GitHub Desktop. Too easy :) 