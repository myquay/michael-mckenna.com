---
date: 2023-05-01T10:00:00+12:00
title: 'Host your Hugo Generated site on GitHub'
summary: GitHub Pages are are a great way to host a blog, share your résumé, or even host a website about one of your projects.
url: /host-your-hugo-generated-site-on-github
tags:
    - GitHub Actions
    - Hugo
---

GitHub Pages are are a great way to host a blog, share your résumé, or even host a website about one of your projects. GitHub provides [first class support for Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll) but what if you wanted to use a different Static Site Generator like Hugo?

Thankfully it's super easy to set up. Follow along as [we configure the example site](https://github.com/myquay/hugo-theme-peripheral-example) for the [Peripheral theme](https://github.com/myquay/hugo-theme-peripheral) to deploy to GitHub Pages automatically using GitHub actions.

## Configure the repository

The repository hosting the content of your GitHub site needs to be configured to support customising the build process.

Change the deployment source to GitHub Actions, you will find this under Settings > Pages.

![](/images/2023/pages-source.png)


## Configure GitHub actions

Create a new workflow called something nice like `hugo.yml` and place it in the [wellknown workflow folder](https://docs.github.com/en/actions/using-workflows/about-workflows) `.github/workflows`.

This files will contain our workflow definition to deploy the site to GitHub pages. The workflow doesn't use any third party actions for security.

Then add the following sections

### Workflow name

This is the name of the workflow which will appear in the GitHub UI

```yml
# Deploying Hugo site to GitHub Pages
name: Build and deploy to Pages
```

### Run triggers

This defines how the workflow is triggered, we'll trigger it when new code is pushed or manually.

```yml
on:
  # Runs on push to main branch
  push:
    branches: ["main"]

  # Allow to be manually started from the Action tab
  workflow_dispatch:
```

### Permissions

This section grants permission to the jobs in the workflow to interact with GitHub pages

```yml
# Allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write
```

### Concurrency

This section is optional, we are disabling concurrent deployments but not cancelling in progress jobs so we don't interrupe the build

```yml
# Allow only one concurrent deployment
concurrency:
  group: "pages"
  cancel-in-progress: false
```

### The build and deploy jobs

This is the core part of the workflow where we specify how our hugo site is built and deployed

```yml
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
```

#### Preparing the workflow

The first few steps are to checkout the code,  set up pages, and download Hugo.

```yml
      - name: 💾 Checkout
        uses: actions/checkout@v3
        with:
          submodules: true #Themes in Hugo are usually submodules

      - name: 📄 Setup Pages
        uses: actions/configure-pages@v3

      - name: ✨ Setup Hugo
        env:
          HUGO_VERSION: 0.111.3
        run: |
          mkdir ~/hugo
          cd ~/hugo
          curl -L "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_Linux-64bit.tar.gz" --output hugo.tar.gz
          tar -xvzf hugo.tar.gz
          sudo mv hugo /usr/local/bin
```

#### Build the static site

Next we generate our static website using Hugo. Use the `-s` parameter to define where the website is in relation to the source root. Use the `-d` parameter to define where the generated site should be saved to. The `--environment` parameter is used to specify the configuration to use. For this example this sets up the Base URL correctly to deploy to GitHub pages.

```yml
      - name: 🛠️ Build website
        run: hugo -s ${{github.workspace}}/quickstart -d ${{github.workspace}}/dist  --environment github-pages --log -v
```

#### Deploy to pages

Finally upload the generated files to GitHub pages.

```yml
      - name: 📦 Upload artifact
        uses: actions/upload-pages-artifact@v1
        with:
          path: '${{github.workspace}}/dist'
      - name: 🚀 Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

That's it! You can see the [final file here](https://github.com/myquay/hugo-theme-peripheral-example/blob/main/.github/workflows/hugo.yml), and see the [deployed example site here](https://myquay.github.io/hugo-theme-peripheral-example/).

In the next installment we'll look at how we update some Hugo Configration parameters at build time.