+++
date = "2016-07-01T10:33:32+12:00"
description = "I'm giving this Go-lang thing a whirl, turns out it's dead easy to set up on Windows."
title = "Getting started with Go on Windows"
url = "/getting-started-with-go-on-windows"
+++

I'm giving this Go-lang thing a whirl, turns out it's dead easy to set up on Windows.

1. First [download and install Git](http://git-scm.com/download/win) if you don't have it already - when using Go you'll user a lot of open source!

2. Next download and install the latest 64-bit Go [MSI distributable from https://golang.org/dl](https://golang.org/dl/). Run that hit next, next, next and let it set up all the defaults.

3. Once that's done open up the CMD and type `go version` if everything is running you should get something like `go version go1.6.2 windows/amd64` back.

**Great - now Go is installed!** 

But we're not quite done yet - Go developers normally keep all their [Go code in a single _workspace_](https://golang.org/doc/code.html). The `GOPATH` environment variable specifies the location of this workspace. The workspace should contain 3 folders `bin`, `pkg` and `src`.

4. Set up your workspace, I created my workspace at `C:\Development\Go` ![Go Workspace](/images/go.png)

5. Create the `GOPATH` variable in your Environment settings: _System, Advanced system settings, Environment Variables, New..._. Then add the variable `GOPATH` with the value of your workspace path. ![](/images/go-sys-variable.png)

Now you've installed Go and have your workspace set up - you're practically good to go.

**Now what?**

Have some fun, get started here: https://golang.org/doc/code.html