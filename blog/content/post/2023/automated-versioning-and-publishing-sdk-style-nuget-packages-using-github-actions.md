---
date: 2023-06-26T10:00:00+12:00
title: 'Automated versioning and publishing of a SDK-style NuGet packages using GitHub Actions'
url: /automated-versioning-and-publishing-sdk-style-nuget-packages-using-github-actions
summary: 'In this article we look at the method of automating the NuGet packaging process using GitHub Actions that we used for GuidOne.'
tags:
    - GitHub
series: nuget
concludeSeries: true
---

This is a series of two articles looking at how I implemented automated packaging and building of NuGet packages in GitHub actions for two open-source libraries; [JsonPatch](https://www.nuget.org/packages/JsonPatch) and [GuidOne](https://github.com/myquay/GuidOne). One was a SDK style project, and the other was a Non-SDK style project which made for a good look the the differences between the packaging processes.

In this second article we look at the process that we used for [GuidOne](https://github.com/myquay/GuidOne). It is [a SDK style project](https://learn.microsoft.com/en-us/nuget/resources/check-project-format) using .NET Standard 2.0 so the process is nice and simple, we cover [versioning & release notes using GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

### Background

I maintain a little open-source library called [GuidOne](https://github.com/myquay/GuidOne) which started life as a fun little investigation into guids but I think is useful enough for others to use with the more granular control over the types of Guids to generate. So I would like to publish it to NuGet. Instead of manually building the package I'd like to automate it to reduce the burden of future updates.

### The workflow

The workflow will be similar to the approach used for JsonPatch where the project is built for every pull-request and commit against the main branch, but only packaged and published when a release is created.

### Step 1: Build and Test

This first workflow is run on every commit or pull-request to main. It will make sure we can build our library and validate the changes against the suite of unit tests.

There are two projects, one in .NET Standard 2.0 (the library) and one in .NET 6 (the unit tests). Here is our workflow file that we place in [_**.github/workflows/build.yml**_](https://github.com/myquay/GuidOne/blob/master/.github/workflows/build.yml). It's nice and simple, just a bit of dotnet restore, build, test.

``` yml
nname: Build GuidOne library

on:
  push:
    branches:
    - master
  pull_request:
    branches:
    - master
jobs:
  build:
    name: Build GuidOne library
    runs-on: ubuntu-latest
    steps:

    - name: 📄 Checkout
      uses: actions/checkout@v3

    - name: 🛠️ Setup .NET SDK
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: '6.0.x'

    - name: 🛠️ Restore NuGet packages
      run: dotnet restore
      
    - name: 🚀 Build Solution
      run: dotnet build --configuration Release
      
    - name: 👟 Run tests
      run: dotnet test
```

Excellent, now we get that nice green checkmark if all the tests pass, but we're still missing the most important step - packaging and publishing the NuGet package.

### Step 2: The .csproj file

Since this is a SDK style project we don't need a seperate .nuspec file, we're able to use 'dotnet pack' directly against the .csproj. One big advantage is that you don't need to manually update all the dependencies in the .nuspec file, this process will automatically add all the correct dependencies to the generated .nuspec file.


 Because one of the projects we're packaging up is .NET Framework, this is [a Non-SDK style project](https://learn.microsoft.com/en-us/nuget/resources/check-project-format) and we're going to be packing it up using the NuGet CLI and a .nuspec file. We also generate two different dlls, one for .NET Framework and the other for .NET which makes for a little more complicated NuGet package as we will be using NuGet's [support for multiple .NET versions](https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks).

 We will configure all of our static information in the Visual Studio project editor, and place property placeholders for the dynamic information such as package version and release notes.

![](/images/2023/csproj-nuget-package-information.png)

The .csproj file is going to be used in the packaging workflow triggered when we create a new release, not when we commit code, this workflow will build and package the NuGet file. The workflow will replace the tokens such as **$(VersionPrefix)** and **$(ReleaseNotes)** with information from the release that triggers the workflow.

### Step 3: The NuGet packaging workflow

We're going to create a new workflow called **release.yml** which is going to be a superset of our previous pipeline, in addition to building and testing the library it will also pack it.

The trigger for this workflow will be on the creation of a new Release in GitHub.

```yml
name: Build, Package & Release GuidOne library

on:
  release:
    types: [published]
```

Once triggered, build and test the library that's to be packaged up.

``` yml
jobs:
  build:
    name: Build GuidOne library
    runs-on: ubuntu-latest
    steps:

    - name: 📄 Checkout
      uses: actions/checkout@v3

    - name: 🛠️ Setup .NET SDK
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: '6.0.x'

    - name: 🛠️ Restore NuGet packages
      run: dotnet restore
      
    - name: 🚀 Build Solution
      run: dotnet build --configuration Release
      
    - name: 👟 Run tests
      run: dotnet test
```

Then we pack the NuGet package, we will use the [global properties feature](https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild-properties?view=vs-2022#global-properties) to automatically update the version, release notes. 

```yml
    - name: 📦 Pack NuGet package
      run: dotnet pack -p VersionPrefix=${{github.event.release.tag_name}} -p ReleaseNotes="${{github.event.release.body}}"
```

Finally we archive the package and publish it to NuGet

```yml
    - name: 💾 Archive package
      uses: actions/upload-artifact@v3
      with:
        name: nuget-package
        path: /home/runner/work/GuidOne/GuidOne/src/GuidOne/bin/Release/GuidOne.*.nupkg

    - name: 💾 Archive symbols package
      uses: actions/upload-artifact@v3
      with:
        name: nuget-package
        path: /home/runner/work/GuidOne/GuidOne/src/GuidOne/bin/Release/GuidOne.*.snupkg

    - name: 🛠️ Setup NuGet
      uses: nuget/setup-nuget@v1
      with:
        nuget-api-key: ${{ secrets.NUGET_API_KEY }}
        nuget-version: '5.x'
    
    - name: 🌐 Push NuGet package live
      run: nuget push/home/runner/work/GuidOne/GuidOne/src/GuidOne/bin/Release/GuidOne.*.nupkg -src https://api.nuget.org/v3/index.json
      shell: powershell
    
    - name: 🌐 Push NuGet symbol package live
      run: nuget push /home/runner/work/GuidOne/GuidOne/src/GuidOne/bin/Release/GuidOne.*.snupkg -src https://api.nuget.org/v3/index.json
      shell: powershell
```

Now whenever we create a release in the GuidOne project it'll be automatically packaged up and pushed to NuGet.