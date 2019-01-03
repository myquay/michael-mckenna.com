+++
date = "2016-07-03T20:52:32+12:00"
description = "It turns out Azure App Services have added native Go support."
title = "Running Go on Azure App Services"
url = "/running-go-on-azure-websites"
tags = ["go", "guide", "azure"]
+++

At first I thought I was going to have to go something tricky - [Wade Wegner has a great write up of one method here](http://www.wadewegner.com/2014/12/4-simple-steps-to-run-go-language-in-azure-websites/), but it turns [Azure App Services have now added native Go support](https://azure.microsoft.com/en-gb/blog/running-go-applications-on-azure-app-service/) so we don't need to set up Go on the server any more.

The versions currently supported on the Azure App Service platform are 64bit Go 1.4.2 and Go 1.5.1 and it turns out to be super simple to get going.

##### Setting up the Azure App Service

First we need to create and set up an Azure App Service to serve our new Go app as well as configure deployment.

**1.** Create a new web app. 

**2.** We're going to deploy our website from a local Git repo so configure "Local Git Repository" as your deployment source.

![Set up local Git Repository](/images/go-azure-01.png)

**3.** Then set up some credentials so your Git client can authenticate when deploying to your Azure App Service.

![Set credentials](/images/go-azure-02.png)

**4.** Now grab your Git repository URL that you will push the code to. It's located under _Settings > Properties > GIT URL_, it will be in the format `https://{username}@{app-service-name}.scm.azurewebsites.net:443/{app-service-name}.git`

Great - now we're ready to configure our development environment.

##### Setting up your Go development environment

Typically with Go you will have one workspace and your source will be in the `src` subdirectory. This subdirectory usually contains multiple version control repositories, this is where we're going to set up our Git repository on our Azure App Service.

    src/
        {app-service-name}.azurewebsites.net/

Navigate to this folder and go `git init` to initialise your local repo. Now go `git remote add azure https://{username}@{app-service-name}.scm.azurewebsites.net:443/{app-service-name}.git` to add the remote.

Now we need to write some code!

##### A super simple website

Here's the source to our super simple website - all it's going to do is return a message.

**1.** Create a file called `server.go` in the root of the project folder with the following code. 

````
package main
import (
    "fmt"
    "net/http"
    "os" 
)
func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hi there - this page was served using Go \\o/")
}
func main() {
    http.HandleFunc("/", handler)
    http.ListenAndServe(":"+os.Getenv("HTTP_PLATFORM_PORT"), nil)
}
````

**2.** Add the new file `git add -A`, and commit it `git commit -m "Go go go go!"`

**3.** Push the changes to your Azure App Service `git push azure master`, and you'll see your deployment show up in the Deployments blade on the Azure Portal.

![](/images/go-azure-03.png)

That's it!! Your Go website is live on Azure Websites, you can navigate to your website to check it out. Actually too easy. You can view the Go website we just built and deployed here: [https://go-lang.azurewebsites.net/](https://go-lang.azurewebsites.net/)

![](/images/go-azure-04.png)
