---
date: 2023-05-07T10:00:00+12:00
title: Linking to the latest commit in the header of your Hugo site on GitHub
summary: .GitInfo is linked to the current page, this is how we accessed the lastest commit information at build
url: /linking-to-the-latest-commit-in-the-footer-of-your-hugo-static-site-on-github
tags:
    - GitHub Actions
    - Hugo
---

In the [Peripheral theme](https://github.com/myquay/hugo-theme-peripheral) we have the option of displaying a link to the lastest commit so that readers of your blog can see what the current published version is and what the latest changes are.

![](/images/2023/pages-commit.png)

It is not related to a particular page [which means the inbuilt](https://gohugo.io/variables/git/) .GitInfo [isn't quite suitable.](https://github.com/gohugoio/hugo/issues/9738)

To get around this we will

1. put some placeholder varibles in the config
2. update the GitHub workflow to update the placeholders before building the site. 

It's not the most seamless solution in the world, but it'll do for now.

### Update the site configuration

The instructions below are the Params for the theme Peripheral, but you can use any custom param defined in `config.toml`

```yml
[Params.Peripheral.GitInfo]
    enabled = true
    repository = "https://github.com/myquay/michaelmckenna.com"
    abbreviatedHash = "{{AbbreviatedHash}}"
    hash = "{{Hash}}"
    subject = "{{Subject}}"
    branch = "main"
```

The GitHub workflow will replace the `{{Hash}}`, `{{AbbreviatedHash}}`, and `{{Subject}}` with the values from the latest check in just before the site is built. If you're not using this theme you can put the `{{Placeholders}}` wherever you want in the `config.toml` to work for you. 

### Update the GitHub workflow

The modified workflow needs two steps additional steps. 

First we generate an abbreviated hash we can use in the UI.

```yml
      - name: ✍️ Set outputs
        id: custom_outputs
        run: echo "sha_short=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT
```

Then we use the stream editor to replace the placeholder values with the actual commit information

```yml
      - name: 🔎 Update GitHub References
        run: | 
          sed -i -e 's/{{AbbreviatedHash}}/${{steps.custom_outputs.outputs.sha_short}}/g' ${{github.workspace}}/quickstart/config/github-pages/config.toml
          sed -i -e 's/{{Hash}}/${{github.sha}}/g' ${{github.workspace}}/quickstart/config/github-pages/config.toml
          sed -i -e 's/{{Subject}}/${{github.event.commits[0].message}}/g' ${{github.workspace}}/quickstart/config/github-pages/config.toml
```

One thing to watch out for is that this is [set up for the theme example website](https://github.com/myquay/hugo-theme-peripheral-example), so you will need to update the paths to work with your file structure. 

### That's it

Build the site like normal and your templates will have access to the latest commit information so you can put a little commit message in the footer or header of your Hugo website like this one, or [the Peripheral example site](https://github.com/myquay/hugo-theme-peripheral-example).