+++
date = "2014-12-13T15:56:32+12:00"
description = "Wouldn't it be amazing if we could have dependency management in xcode also?"
title = "Cocoapods: package management in xcode for iOS apps"
url = "/cocoapods-package-management-in-xcode-for-ios-apps"
tags = ["ios"]
+++

I've just started building my first iPhone app and one of the biggest things I missed from .NET land was package management. Visual studio has amazing support for NuGet - even Microsoft distribute some of their core libraries on the platform. 

Wouldn't it be amazing if we could have dependency management in xcode also?

Turns out there's a third party solution which is pretty fantastic despite the lack for first class support in xcode.

### Cocoapods

It's super easy to install, only two commands.

#### First install the cocoapods gem and set it up

    $ sudo gem install cocoapods
    $ pod setup
    
If you don't run setup you'll get an error along the lines of

    Cocoapods "pod install" fails due to "No such file or directory @ dir_initialize - /Users/{username}/.cocoapods/repos (Errno::ENOENT)"

whenever you try run any pod commands.

#### Next create the 'podfile' for the project.

This tells cocoapods which libraries to download and include in your workspace. The podfile should be in the same directory of your .xcodeproj file.

You can find details on the [cocapods website](http://guides.cocoapods.org/syntax/podfile.html) about the format of the file.

#### Install the pods

To install the pods run install in the same directory as the pdfile. Cocoapods will look at the podfile and download any libraries specified.

    $ pod install

Easy as.