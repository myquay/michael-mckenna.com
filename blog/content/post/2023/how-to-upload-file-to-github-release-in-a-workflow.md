---
date: 2023-07-05T10:00:00+12:00
title: 'How to upload a file to a GitHub release in a workflow'
summary: "Spoiler alert: you don't need an Action contributed by a third party."
url: /how-to-upload-file-to-github-release-in-a-workflow
tags:
    - GitHub Actions
    - Hugo
---

## Background

I built a little [CLI utility for converting RSS/Atom feeds to Markdown files called FeedMD](https://github.com/myquay/feedmd). I wanted to create a workflow that builds FeedMD for each of the supported platforms and then uploads the compiled binaries to the release I just created like this.

![](/images/2023/release-binaries.png)

## The research

My superpower isn't remembering everything off the top of my head so the first thing I did was to search for the details on how to do this using 'that big search engine that shall not be named'. And oh my gosh, I came across so many third party actions.

* [Upload To Github Release](https://github.com/marketplace/actions/upload-to-github-release)
* [Upload files to a GitHub release](https://github.com/marketplace/actions/upload-files-to-a-github-release)
* [GH Release](https://github.com/marketplace/actions/gh-release)
* [upload file on release](https://github.com/marketplace/actions/upload-file-on-release)
* [upload-release-asset](https://github.com/actions/upload-release-asset) _(Obsolete)_

Honestly I was expecting some more GitHub CLI, I only found one reference [buried in a StackOverflow answer](https://stackoverflow.com/questions/75274866/adding-an-asset-to-a-release-through-github-action-triggered-on-release-creation?noredirect=1&lq=1). Third party actions have their place, but they're not for doing routine work - [they're a lot to use securely](https://devopsjournal.io/blog/2021/02/06/GitHub-Actions-Forking-Repositories). You'll need to fork, code review, and actively keep your fork up to date etc...

## The approach I took

I just used the GitHub CLI. I try to avoid pulling in actions from the marketplace if practical, especially is it's for something simple supported by GitHub CLI. [GitHub CLI is pre-installed on all GitHub runners](https://docs.github.com/en/actions/using-workflows/using-github-cli-in-workflows) and allow you to run any [GitHub CLI command](https://cli.github.com/manual/gh). Including `gh release upload <tag> <files>...` which uploads files to a release with a specifc tag. Perfect.

Here's the important parts of the deployment file

```yaml
# Trigger this workflow on release
on:
  release:
    types: [published]

# Make sure the GITHUB_TOKEN has permission to upload to our releases
permissions:
  contents: write

... SOME OTHER STUFF GOES HERE ...

# Build the FeedMD CLI utility, and upload to the release that triggered the workflow 
- name: '📦 Package windows x64'
    run: |
        cd ${{github.workspace}}
        dotnet publish feedmd.csproj -r win-x64 -c Release -o bin/win-x64
        zip -r feedmd-win-x64.zip bin/win-x64 -j
        gh release upload ${{github.event.release.tag_name}} feedmd-win-x64.zip
    env:
      GITHUB_TOKEN: ${{ github.TOKEN }}
    shell: bash

```

You can view the [full deployment file here](https://github.com/myquay/feedmd/blob/main/.github/workflows/buildrelease.yml).

### Summary

Maybe this should have been a blog post about the problems of blindly trusting GitHub Actions in the marketplace. Who knows, at least we know how to simply and safely upload to our GitHub releases now.