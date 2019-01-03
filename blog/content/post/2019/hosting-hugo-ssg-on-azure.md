+++
date = "2019-01-03T20:13:11+12:00"
description = "Host your Hugo SSG using Azure Storage and KeyCDN."
title = "Host your Hugo site on Azure Storage"
subtitle = "deployed with VSTS"
url = "/host-your-hugo-site-on-azure-storage-deployed-with-vsts"
tags = ["guide", "azure", "hugo", "static site generator"]
+++

I'm a big fan of Static Site Generators (SSGs) for basic websites like this blog. In this post I'll cover the technology (Hugo, Azure Storage) and process (Githib/ VSTS) I use to manage this blog

* SSG: [Hugo](https://gohugo.io/)
* CI: [Azure DevOps](https://visualstudio.microsoft.com/team-services/)
* Hosting: [Azure Storage (Static Sites)](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website)
* CDN/ SSL: [Cloudflare](https://www.cloudflare.com/)

## The process

A change is made to the blog, on check-in to the main branch the site is generated and deployed.

If you want to check out the source for this blog it's [all hosted here on GitHub](https://github.com/myquay/michaelmckenna.com)

## Set up Azure Storage to serve your static files

First create a new Azure Storage Account and enable "Static website"

![](/images/azure-static-site.png)

Set your default file to index.html - this is what gets served by default if the directory itself is hit, rather than a specific file.

On your DNS provider add the required asverify records and add your domain as a "custom domain" to your Auzre Storage Account.

Once you've successfully added the custom domain, go ahead and the required CNAME record.

![](/images/azure-static-site-custom-domain.png)

_Note: Normally you cannot CNAME from the APEX record, in this case we're using Cloudflare's CNAME flatterning feature to support the APEX domain e.g. https://michael-mckenna.com - [this can be a good or bad idea depending on your use case](/should-i-use-www-or-not/) - other services may have other services that do the same thing such as "ALIAS" records_

## Set up CDN for HTTPS support on your custom domain

Here's we're using Cloudflare but in practice you can use any CDN that supports HTTPS on custom domains e.g. [Microsoft Azure CDN](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-https-custom-domain-cdn)

Once we have delegated our nameservers to Cloudflare all we need to do is add a CNAME record that points to the URL for your static website _(something like `{azure storage account}.z8.web.core.windows.net`)_

Cloudflare will provide a SSL certificate _(for better or worse)_ and you'll be ready to start uploading your static files.

## Set up Azure DevOps to build our site on check-in

We're almost there - now all we need to do is generate the Static Site on checkin and deploy those files to Azure Stroage.

In this process I've decided to [checkin the Hugo binary](https://github.com/myquay/michaelmckenna.com/tree/master/bin), but alternatively you could just add an eariler step to download the binary if you don't want it checked in.

The Hugo source for my site is located [in the `blog` directory](https://github.com/myquay/michaelmckenna.com/tree/master/blog) - if your strucutre is slightly different just update the paths as necessary _(e.g. you probably wouldn't have it in a subdirectory if you were downloading the hugo binary)_.

First create a new pipeline and connect it to the GitHub repository which contains your blog.

![](/images/azure-devops-pipeline.png)

Next add a step that generates our site. Add the `Command Line` task and enter the following to use `hugo.exe` to compile our site `$(Build.SourcesDirectory)\bin\hugo.exe -s $(Build.SourcesDirectory)\blog -d deploy --log -v`.

`$(Build.SourcesDirectory)` is the directory our sources are kept in. `$(Build.ArtifactStagingDirectory)` is the local path build artifacts are kept before being pushed to their destination. We use the `-s` argument to specify the location of the source files for the blog and the `-d` argument to specify the location of the generated site.

![](/images/azure-static-site-vsts-step-one.png)

Next we add the `Publish Build Artifacts` task to publish the compiled website ready for deploy.

![](/images/azure-static-site-vsts-step-two.png)

Finally we enable continious integration so the site is built everytime we change something.

![](/images/azure-static-site-vsts-step-three.png)

Okay - now your blog should be building! All that's left is pushing the release live.

## Set up Azure DevOps to release our site

You could set up a full staging/ production type scenario with sign-off etc, which could be useful if you have a company blog where the site needs proper approval process and it's not realistic to get the editorial team to approve pull requests. 

But we are keeping it super simple where all successful builds go straight to production because realistically the cost of deploying a mistake is small on my little blog compared to the overhead of an intense process.

First create a new release pipline and choose the build we just created as the release artifact. If you want the release to go out automatically remember to enable the continious integration triggger.

![](/images/azure-static-site-vsts-step-four.png)

Finally add the `Azure File Blob Copy` task and copy the files we generated in the `drop` folder and publish them to the special `$web` container which Azure Storage uses to serve static site content from.

![](/images/azure-static-site-vsts-step-five.png)

_Note: Make sure you use the `2.* (preview)` version as that uses AzCopy which supports the special `$web` container: [see this issue](https://github.com/Microsoft/azure-pipelines-tasks/issues/7611)_

## All done!!

Whenever you check in a new blog post or new styles a build will kick off and deploy an update to your site.







