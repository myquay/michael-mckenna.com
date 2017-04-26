+++
date = "2016-04-23T09:56:32+12:00"
description = "Following most instructions Apple seemed to think my IIS generated CSR was invalud."
title = "Generating an Apple Push Notification Certificate on Windows"
url = "/generating-an-apple-push-notification-certificate-on-windows"
+++

Following [most instructions](https://wiki.scn.sap.com/wiki/display/SAPMOB/How+to+generate+an+APNS+certificate+used+for+sending+push+messages+to+the+custom+Afaria+Client+application) [on the](https://tomasmcguinness.com/2012/06/28/generating-an-apple-ios-certificate-using-windows/) [web make](https://help.landesk.com/Help/kor/mobl/9.0/Content/Mobility/Install/mobl_install_mdm_t_windows.htm) it sound as easy as generating a CSR using IIS. However I ran into a few difficulties - namely Apple seemed to think my brand new CSR was invalid. Probably has something to do with my local setup (IIS 10 on Windows 10) but that shouldn't be a road block.

![Invalid CSR]({{< cdnUrl >}}images/apple-invalid-csr.png)

Why? w-w-w-w-why? [Be more constructive with feedback](https://www.youtube.com/watch?v=29M_VElHoFI).

To be fair most instructions _([including Microsoft Azure documentation](https://azure.microsoft.com/en-us/documentation/articles/notification-hubs-ios-get-started/))_ only show you how to do it on the Mac. However I was able to generate a CSR that Apple liked the look of using [OpenSSL](https://www.openssl.org/).

Here's the process

1. [Download OpenSSL for windows](https://slproweb.com/products/Win32OpenSSL.html) and install it if you haven't got it already.

2.  Generate a private key
`openssl genrsa -out new-ios-app.key 2048`

3.  Generate CSR from the private key
`openssl req -new -sha256 -key new-ios-app.key -out new-ios-app.csr`

4. Now you'll have a CSR that Apple will accept. Upload it to the Apple website and follow the prompts to get your public certificate (.cer file) back.

5. Finally combine the private key and .cer file into a .pfx file
`openssl pkcs12 -export -out new-ios-app.pfx -inkey new-ios-app.key -in new-ios-app.cer`

If you get the error *"unable to load certificates"* for step 5, try these additional steps.

1. Convert the CER downloaded from Apple to a PEM 
`openssl x509 -inform der -in new-ios-app.cer -out new-ios-app.pem`

2. Try combine the private key and .pem file into a .pfx file
`openssl pkcs12 -export -out new-ios-app.pfx -inkey new-ios-app.key -in new-ios-app.pem`

If you need a PEM file instead of a PFX, just run this command `openssl pkcs12 -in new-ios-app.pfx -out new-ios-app.pem`

Woohoo, too easy right. You now have your PFX/PEM file to push notifications to your iOS app from your windows server or where ever.