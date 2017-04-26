+++
date = "2016-11-03T20:52:32+12:00"
description = "I just needed to quickly run a few Python methods... in Azure"
title = "How to import Python extension modules in Azure Functions"
url = "/how-to-import-python-extension-modules-in-azure-functions"
+++

An awesome feature of Azure Functions is its ability to run a wide range of languages,  [C#, F#, Node.js, Python, PHP, batch, bash, Java, or any executable](https://azure.microsoft.com/en-us/documentation/articles/functions-overview/). So when I wanted to do a bit of work with the Google Eddystone beacon format it was a natural fit as I just needed to quickly run a few Python methods - [given the example code Google provides is in Python](https://github.com/google/eddystone/tree/master/eddystone-eid).

One of the best things about Python is its packaging system - it adds a whole bunch of functionality to the language which in some cases is completely impossible. 

*Wait a minute, how can a Python module add functionality that can't be achieved by writing the Python yourself?!*

Python supports a concept called "extension modules" or "native modules". These modules wrap up native platform specific code rather than Python, most commonly C. Windows users have probably stumbled across the difference when installing modules and run into the super cryptic _"unable to find vcvarsall.bat"_ error if they don't have the capability to compile the native code portion of the module.

**How does this relate to Azure Functions?**

Personally I've found Python packaging to be pretty complex compared to the likes of NuGet or NPM - mainly due to the local compiling steps involved, and probably my inexperience on the platform. This isn't a bad reflection on Python, in the Python universe each machine can be different so a binary compiled on one machine might not run on another which leads to this culture of distributing source code.

However, because local tooling is required for compiling and installing extension modules when you try install a Python extension module on Azure Functions you will get an error. This is because Azure App services does not have the capability to compile the module on install.

**Go on then, how do I install the extension module?**

You precompile it, Python supports a concept called "Wheels". A Wheel is a precompiled extension module which can be uploaded along with the package - if a package doesn't have a Wheel, you can create one yourself on your local machine so your Azure Function instance doesn't have to. 

There's nothing better than a concrete example so I will show you how to get a function from [_eidtools.py_ script](https://github.com/google/eddystone/blob/master/eddystone-eid/tools/eidtools.py) running on Azure Functions. It relies on the popular _[pycrypto](pycrypto.org)_ extension module, so we'll also need to get that installed for the script to run.

#### How to run eidtools.py using pycrypto on Azure Functions

We'll be creating an Azure function to host the [GetAndPrintEid](https://github.com/google/eddystone/blob/master/eddystone-eid/tools/eidtools.py#L265) function in eidtools.py - to do this we need pycrypto.

**[Can't wait? Dive in and get the sample project here](https://github.com/myquay/Sample.Azure.Functions.Python)**

##### Step 1. Be able to responed to HTTP requests

First we create a base Azure Python function that can respond to HTTP requests - lucky for us [Anthony Eden](https://mediarealm.com.au/) has already created a [sample project that does just that](https://github.com/anthonyeden/Azure-Functions-Python-HTTP-Example) so we'll use that as a base.

At this point the project will look a little like this

```
.
+--EDIGenerator
   +--function.json       
   +--run.py              
+--lib                     
   +--AzureHTTPHelper.py
.gitignore
host.json
README.md
```

You can go ahead and upload this to Azure Functions - if you sync from a repo at this point you should see something like this.

![Upload sample]({{< cdnUrl >}}images/edigenerator.png)

If you make a HTTP request to `https://{function app name}.azurewebsites.net/api/{function name}` you should get the message "Azure works :)"

##### Step 2. Add the libraries we are going to need

The preferred method in Python to install modules is a manager called [pip](https://docs.python.org/3/installing/). This is what we're going to use to install our modules on our Azure environment.

We require two libraries, [pycrypto](https://pypi.python.org/pypi/pycrypto) and [hdfk](https://pypi.python.org/pypi/hkdf). hdfk is just a normal Python module so we won't have any problems there, but pycrypto is an extension module. We're going to need to compile this ourselves. Microsoft has a [great write up here](https://blogs.msdn.microsoft.com/azureossds/2015/06/29/install-native-python-modules-on-azure-web-apps-api-apps/) on how to compile the module on your local windows environment. Follow those instructions to generate the pycrypto wheel that you will need in the next steps. Alternatively you can download the [wheels here](http://www.voidspace.org.uk/python/modules.shtml#pycrypto) - but I wouldn't do this for anything serious, don't trust anyone else but yourself to compile such sensitive libraries!

To tell pip what to install we need to add a requirements.txt file to the root of our project, and the compiled wheels - for us this the requirements file looks a little something like this.

```
--find-links wheelhouse
pycrypto==2.6.1
hkdf==0.0.3
```

And the updated project structure now looks a little like this

```
.
+--EDIGenerator
   +--function.json       
   +--run.py              
+--lib                     
   +--AzureHTTPHelper.py
+--wheelhouse
   +--pycrypto-2.6.1-cp27-none-win32.whl
.gitignore
host.json
README.md
requirements.txt
```

We've also updated the run.py to contain our code that generates an eid, you can check the implementation here: https://github.com/myquay/Sample.Azure.Functions.Python/blob/master/EDIGenerator/run.py

*Note: In Azure we're going to install all these modules in a [virtual environment](http://docs.python-guide.org/en/latest/dev/virtualenvs/) so we've got a nice isolated area with all our packages. So Python knows to import our libraries from this location make sure you have `sys.path.append(os.path.abspath(os.path.join(os.path.dirname( __file__ ), '..', 'env/Lib/site-packages')))` in any file that imports these libraries.*

##### Step 3. Install the libraries on our Azure Functions instance

Now for the fun part! We're going to run our Kudu script manually but [Kudu is designed to run custom deployment scripts](https://azure.microsoft.com/en-us/documentation/videos/custom-web-site-deployment-scripts-with-kudu/).

Open up kudu by clicking the "Go to Kudu" button under "Function app settings".

1. Navigate to your function folder
`cd D:\home\site\wwwroot`

2. Set up your python virtual environment, the python executable is just installed in the normal place.
`D:\Python27\Scripts\virtualenv.exe env`

3. Activate your virtual environment
`"env/Scripts/activate.bat"`

3. Install from requirements.txt
`pip install -r requirements.txt`

*If you get the error "Unable to find vcvarsall.bat" it means the wheel you have uploaded isn't compatible so it tried to download and compile it. Make sure the wheel is compiled for the correct version of Python - e.g in this example our wheel is for Python 2.7 and is pycrypto version 2.6.1: pycrypto-**2.6.1**-**cp27**-none-win32.whl*

#### Done!

You've just set up an isolated python function that can be called over HTTP which has multiple dependencies on normal and extension modules. You can call your shiny new Azure Function using the following parameters 


    https://{function app name}.azurewebsites.net/api/EDIGenerator?scaler=12&ik=aaca6ae108054873947e0a8ccc52c881&beaconTime=321


And you should get something like this back


    { eid:YDX9cjr/87A= }
