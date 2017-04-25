+++
date = "2014-08-22T15:56:32+12:00"
description = "For sites that are read heavy but get updated quite infrequently (like a blog, or marketing site) a static site is ideal."
title = "Setting up a Jekyll workflow on windows"
url = "/setting-up-a-jekyll-workflow-on-windows"
+++

Static site generators are in at the moment, and for good reason. They remove a whole bunch of complexity from deploying and maintaining a site by creating a static representation of it, which you just upload to a web server.

For sites that are read heavy but get updated quite infrequently (like a blog, or marketing site) a static site is ideal.

Personally I love [GitHub pages](https://pages.github.com/), it provides first class support for Jekyll which builds all your markdown content, templates, and other site assets into a static website.

The only problem is that Jekyll isn't officially supported on Windows; I was using it for a a start up running the .NET stack [called Slipspace](http://slipspace.co/). The good news is that it's super simple to get up an running.

In this post we'll look at how we integrated [Jekyll](http://jekyllrb.com/) into our work flow using [Grunt](http://gruntjs.com/) to glue all the moving pieces together.

### First you need to install Jekyll

This post isn't about setting up your first Jekyll site, there's already [great resources](http://jekyllbootstrap.com/lessons/jekyll-introduction.html) out there to help with that. I'm going to assume you're familiar with the basics and have Jekyll installed. If you don't have Jekyll yet, [follow this guide here](http://jekyll-windows.juthilo.com/). It's the one I used, and I had no problems.

We'll look at how we develop the [Slipspace public site](http://slipspace.co/) on Windows. 

### The set up

If you want to checkout the source of the website that we're talking about, you can grab it here: [https://github.com/slipspace/slipspace.github.io](https://github.com/slipspace/slipspace.github.io).

#### Visual Studio

First we point a Visual Studio website at our Jekyll project, this allows us to edit the files with all that intellisense goodness.

![Visual studio solution](https://dl.dropboxusercontent.com/u/88845372/slipspace.github.io-solution.PNG)

You'll notice from the file layout that this is just a standard Jekyll site. 

>Warning: if there is a BOM (Byte order mark) header in your files Jekyll will implode. In my experience adding a file through VS will include this header, add blank files directly through windows explorer.

#### Grunt

We don't want to have to manually run _jekyll build_ every time we change a file. I like to use Grunt to watch files for changes and kick off a jekyll build on change. In addition you can minify all your JavaScript and CSS.

Check out the [Slipspace site source](https://github.com/slipspace/slipspace.github.io) to see the full Gruntfile.js definition but here are the important bits.

The task **shell** will kick off a Jekyll build

    shell: {
      jekyllBuild: {
        command: 'jekyll build --source ../ --destination ../_site'
      }
    },

The task **watch** will monitor the filesystem for changes then kick off any grunt tasks needed to build the Jekyll site.

    watch: {
      files: [
        '../_includes/*.html',
        
        ..other directories..
       
        '../_config.yml',
        '../index.html'
      ],
      tasks: ['concat', 'uglify', 'cssmin', 'shell:jekyllBuild'],
      options: {
        interrupt: true,
        atBegin: true
      }
    }

Set _watch_ as the default task, so that you can just type "grunt" to kick it all off.

    grunt.registerTask('default', ['watch']);

#### IIS

Great, now we can edit our Jekyll site and have it build automatically, but what about hosting it on our development machine?

Sure you can use the Jekyll command _jekyll serve_ but I don't want to introduce a secondary hosting tool.

All you need to do to host the site using IIS is to create a new website and point it at the _site directory. If you want to serve the pages without a .html extension just use the IIS rewrite module. Here's how we configured ours:

    <rewrite>
      <rules>
        <rule name="RedirectUserFriendlyURL1" stopProcessing="true">
          <match url="^(.*)\.html$" />
          <conditions>
            <add input="{REQUEST_METHOD}" pattern="^POST$" negate="true" />
          </conditions>
          <action type="Redirect" url="{R:1}" appendQueryString="false" />
        </rule>
        <rule name="RewriteUserFriendlyURL1" stopProcessing="true">
          <match url="^(.*)$" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="{R:1}.html" />
        </rule>
      </rules>
    </rewrite>

#### Now you're all set!

Once your site is ready to show the world you can host it on [GitHub pages](https://pages.github.com/) because it's a Jekyll site, but since it compiles down to a static site you can host anywhere you want! There is nothing more flexible or easier to scale than a bunch of files.
