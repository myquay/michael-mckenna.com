---
date: 2023-06-18T10:00:00+12:00
title: 'Automated versioning and publishing of NuGet packages using GitHub Actions'
url: /automated-versioning-and-publishing-nuget-packages-using-github-actions
summary: 'In this article we look at the method of automating the NuGet packaging process using GitHub Actions that we used for JsonPatch.'
tags:
    - GitHub
---

In this article we look at the method of automating the NuGet packaging process using GitHub Actions that we used for [JsonPatch](https://www.nuget.org/packages/JsonPatch). It is[a Non-SDK style project](https://learn.microsoft.com/en-us/nuget/resources/check-project-format) so the process is a but more convoluted than a simple SDK style project and the process we used covers the following points. 

* [Support for multiple .NET versions](https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks)
* [Versioning & release notes using GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
* [Set the repository metadata](https://learn.microsoft.com/en-us/nuget/reference/nuspec#repository)

### Background

I maintain a little open-source library called [JsonPatch](https://www.nuget.org/packages/JsonPatch/) which is primarily distributed through NuGet. Currently I just ad-hoc build the package using the [NuGet Package Explorer](https://github.com/NuGetPackageExplorer/NuGetPackageExplorer) and manually upload the resulting package through the online interface. By automating this process I hope that the package will be updated more frequently so that contributers submissions are published without too much of a delay. I also like that the package will be created in a reliable, repeatable manner; I won't have that niggling worry that I've forgotten something.

### The workflow

The project is built for every pull-request and commit against the main branch, but only packaged and published when a release is created (which defines the version and notes for the published package). Admittedly this was designed with GitHub in mind as it relies on their [Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) feature for versioning but can be adapted to most other build systems with similar concepts. Given releases are defined by esentially tagging the main branch this makes it compatible with most development processes such  as Git Flow, Trunk-based, or Feature-based. 

### Step 1: Build and Test

The first step is to make sure we can build the library that we want to distribute. This includes running all tests and ensuring they are successful. We will run our build and test workflow on every commit or pull-request to the main branch so we know that

1) Any commits to the main branch are valid
2) Any PRs that come through won't break the build

For the library [JsonPatch](https://github.com/myquay/jsonpatch) we need to build two projects, one for .NET 4.8 and another for .NET 6 - here is our workflow file that we place in [_**.github/workflows/build.yml**_](https://github.com/myquay/JsonPatch/blob/master/.github/workflows/build.yml). It's nice and simple so I haven't annotated it and the most interesting bit is setting up MSBuild and VSTest so we can compile and test the legacy .NET Framework version of the library.

``` yml
name: Build JsonPatch library

on:
  push:
    branches:
    - master
  pull_request:
    branches:
    - master
jobs:
  build:
    name: Build JsonPatch library
    runs-on: windows-latest
    steps:

    - name: '📄 Checkout'
      uses: actions/checkout@v3

    - name: 🛠️ Setup MSBuild
      uses: microsoft/setup-msbuild@v1

    - name: 🛠️ Setup NuGet
      uses: nuget/setup-nuget@v1
      with:
        nuget-api-key: ${{ secrets.NUGET_API_KEY }}
        nuget-version: '5.x'

    - name: 🍎 Restore NuGet packages
      run: nuget restore JsonPatch.sln

    - name: 🚀 Build .NET 4.8 JsonPatch.dll Tests
      run: msbuild /p:Configuration=Release /p:IncludeSymbols=true src/JsonPatch.Tests/JsonPatch.Tests.csproj

    - name: 👟 Run .NET 4.8 JsonPatch.dll Tests
      uses: microsoft/vstest-action@v1.0.0
      with:
        testAssembly: JsonPatch.Tests*.dll
        searchFolder: src/JsonPatch.Tests/bin/Release/
        runInParallel: true

    - name: 🚀 Build .NET 4.8 JsonPatch.dll
      run: msbuild /p:Configuration=Release /p:IncludeSymbols=true src/JsonPatch/JsonPatch.csproj

    - name: 🚀 Build .NET 6 JsonPatchCore.dll
      run: dotnet build src/JsonPatchCore/JsonPatchCore.csproj --configuration Release
```

This workflow will ensure the library can be built and runs all of the unit tests, this includes checking all the pull-requests which are submitted to the main branch. 

![](/images/2023/github-pr-check.png)

Cool cool cool, nice green checkmark if all the tests pass, but we're still missing the most important step - packaging and publishing the NuGet package so that others can use all the latest changes.

### Step 2: The .nuspec file

Because one of the projects we're packaging up is .NET Framework, this is [a Non-SDK style project](https://learn.microsoft.com/en-us/nuget/resources/check-project-format) and we're going to be packing it up using the NuGet CLI and a .nuspec file. We also generate two different dlls, one for .NET Framework and the other for .NET which makes for a little more complicated NuGet package as we will be using NuGet's [support for multiple .NET versions](https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks).


```XML
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
    <metadata>
        <id>JsonPatch</id>
        <version>$version$</version>
        <title>JsonPatch</title>
        <authors>Michael McKenna</authors>
        <owners>Michael McKenna</owners>
        <tags>json json-patch jsonpatch minimal api minimal-api patch</tags>
        <requireLicenseAcceptance>false</requireLicenseAcceptance>
        <license type="expression">MIT</license>
        <projectUrl>https://github.com/myquay/JsonPatch</projectUrl>
        <repository type="git" url="https://github.com/myquay/JsonPatch.git" branch="dev" commit="$commit$" />
        <description>
            ... omitted ...
        </description>
        <releaseNotes>
            $releasenotes$
        </releaseNotes>
        <copyright>Copyright 2012-2023  Michael McKenna</copyright>
        <dependencies>
            <group targetFramework="net48">
                <dependency id="Newtonsoft.Json" version="13.0.1" />
                <dependency id="Microsoft.AspNet.WebApi.Client" version="5.2.9" />
            </group>
        </dependencies>
        <frameworkReferences>
            <group targetFramework="net6.0">
                <dependency name="Microsoft.AspNetCore.App"/>
            </group>
        </frameworkReferences>
    </metadata>
</package>
```

The .nuspec file is going to be used in the packaging workflow triggered when we create a new release, not when we commit code, this workflow will build and package the NuGet file. The workflow will replace the tokens such as **$version$** and **$releasenotes$** with information from the release that triggers the workflow. The tokens will be replaced using NuGet's [replacement tokens feature](https://learn.microsoft.com/en-us/nuget/reference/nuspec#replacement-tokens). The .nuspec file itself is kept in source at the root of the solution so any updates to the package metadata are managed and released using the same process as the library source.

### Step 3: The NuGet packaging workflow

We're going to create a new workflow called **release.yml** which is going to be a superset of our previous pipeline, in addition to building and testing the library it will also pack it.

The trigger for this workflow will be on the creation of a new Release in GitHub.

```yml
name: Build, Package & Release JsonPatch library

on:
  release:
    types: [published]
```

Once triggered, build and test the library that's to be packaged up.

``` yml
jobs:
  build:
    name: Build JsonPatch library
    runs-on: windows-latest
    steps:

    - name: '📄 Checkout'
      uses: actions/checkout@v3

    - name: 🛠️ Setup MSBuild
      uses: microsoft/setup-msbuild@v1

    - name: 🛠️ Setup NuGet
      uses: nuget/setup-nuget@v1
      with:
        nuget-api-key: ${{ secrets.NUGET_API_KEY }}
        nuget-version: '5.x'

    - name: 🍎 Restore NuGet packages
      run: nuget restore JsonPatch.sln

    - name: 🚀 Build .NET 4.8 JsonPatch.dll Tests
      run: msbuild /p:Configuration=Release /p:IncludeSymbols=true src/JsonPatch.Tests/JsonPatch.Tests.csproj

    - name: 👟 Run .NET 4.8 JsonPatch.dll Tests
      uses: microsoft/vstest-action@v1.0.0
      with:
        testAssembly: JsonPatch.Tests*.dll
        searchFolder: src/JsonPatch.Tests/bin/Release/
        runInParallel: true

    - name: 🚀 Build .NET 4.8 JsonPatch.dll
      run: msbuild /p:Configuration=Release /p:IncludeSymbols=true src/JsonPatch/JsonPatch.csproj

    - name: 🚀 Build .NET 6 JsonPatchCore.dll
      run: dotnet build src/JsonPatchCore/JsonPatchCore.csproj --configuration Release
```

Then we copy to built DLLs to a staging directory along with the .nuspec file ready to be packaged up.

```yml
    - name: 📄 Copy DLLs and NuSpec to working folder
      run: |
          mkdir \pack\json-patch\lib\net6.0
          mkdir \pack\json-patch\lib\net48
          copy src\JsonPatch.nuspec \pack\json-patch
          copy src\JsonPatch\bin\Release\JsonPatch.Common.dll \pack\json-patch\lib\net48
          copy src\JsonPatch\bin\Release\JsonPatch.Common.pdb \pack\json-patch\lib\net48
          copy src\JsonPatch\bin\Release\JsonPatch.dll \pack\json-patch\lib\net48
          copy src\JsonPatch\bin\Release\JsonPatch.pdb \pack\json-patch\lib\net48
          copy src\JsonPatchCore\bin\Release\net6.0\JsonPatch.Common.dll \pack\json-patch\lib\net6.0
          copy src\JsonPatchCore\bin\Release\net6.0\JsonPatch.Common.pdb \pack\json-patch\lib\net6.0
          copy src\JsonPatchCore\bin\Release\net6.0\JsonPatchCore.dll \pack\json-patch\lib\net6.0
          copy src\JsonPatchCore\bin\Release\net6.0\JsonPatchCore.pdb \pack\json-patch\lib\net6.0
          copy src\JsonPatchCore\bin\Release\net6.0\JsonPatchCore.xml \pack\json-patch\lib\net6.0
```

Then we pack the NuGet package, the secret sauce here is using the [NuGet replacement tokens feature](https://learn.microsoft.com/en-us/nuget/reference/nuspec#replacement-tokens) to automatically update the version, release notes, and commit hash of the .nuspec file. We are assuming that a release triggers the workflow which is how we have access to the version and notes in the GitHub context.

```yml
    - name: 📦 Pack NuGet package
      run: nuget pack \pack\json-patch\JsonPatch.nuspec -p version=${{github.event.release.tag_name}} -p releasenotes="${{github.event.release.body}}" -p commit=${{github.sha}}
      shell: powershell
```

Finally we archive the package and publish it to NuGet

```yml
    - name: 💾 Archive package
      uses: actions/upload-artifact@v3
      with:
        name: nuget-package
        path: \a\JsonPatch\JsonPatch\JsonPatch.*.nupkg

    - name: 🌐 Push NuGet package live
      run: nuget push \a\JsonPatch\JsonPatch\JsonPatch.*.nupkg -src https://api.nuget.org/v3/index.json
      shell: powershell
```

Now whenever we create a release in our GitHub repository it'll be automatically packaged up and pushed to NuGet.

![](/images/2023/packaged-nuget-package.png)
