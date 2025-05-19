---
publishDate: 2025-05-18T13:12:11+12:00
title: Authentication failed when copying files to Azure Blob Storage in DevOps with auto-provisioned service connection
summary: I needed to configure a pipeline to copy some build artefacts to Azure Blob storage, however after setting up the AzureBlob File Copy task I kept getting an Authentication Failed error.
url: /azureblob-file-devops-copy-info-authentication-failed
tags:
    - devops
    - azure
---

I needed to configure a pipeline to copy some build artefacts to Azure Blob storage, however after setting up the AzureBlob File Copy task I had a problem with the connection DevOps set up automatically for me.

I kept getting an Authentication Failed error.

```powershell

INFO: Scanning...
INFO: Login with Powershell context succeeded
INFO: Authenticating to destination using Azure AD
INFO: Any empty folders will not be processed, because source and/or destination doesn't have full folder support

Job ... has started
Log file is located at: ...

0.0 %, 0 Done, 0 Failed, 1 Pending, 0 Skipped, 1 Total, 
INFO: Authentication failed, it is either not correct, or expired, or does not have the correct permission PUT ...

```

### How I fixed it

The service connection type was `Azure Resource Manager using App registration (automatic)`

1. Went to the service connection details in Azure DevOps and clicked `Manage App registration` to find out the name of the App registration that was provisioned for the service connection.
2. Back on the service connection details page, I clicked `Manage service connection roles` with the intention to assign the `Storage Blob Data Contributor` role.
3. On the `Manage service connection roles` page in Azure, I clicked `Add role assignment`, selected the `Storage Blob Data Contributor` role and then searched for the App registration using the name I copied in step 1.

Once that was done, I triggered the pipeline again and it worked as expected.

``` powershell

0.0 %, 0 Done, 0 Failed, 1 Pending, 0 Skipped, 1 Total, 
100.0 %, 1 Done, 0 Failed, 0 Pending, 0 Skipped, 1 Total, 2-sec Throughput (Mb/s): ...

```
