---
publishDate: 2014-12-04T15:56:32+12:00
title: Migrating an Azure VM to a different region
summary: Even though you can't do it from the online interface it, it's actually pretty simple.
url: /migrating-an-azure-vm-to-a-different-region
tags:
    - azure
    - guide
---

Microsoft just launched Azure cloud services in Australia, given the proximity to New Zealand where the majority of our customers are based it made sense to migrate our various azure hosted services there.

The majority of the services run on hosted platforms such as Azure Websites which were super simple to migrate, however there were a few legacy systems running on VMs which needed to be migrated. 

Even though you can't do it from the online interface it, it's actually pretty simple.

## Step 1: Set up your storage account

You need a storage account in the region that you're migrating your VM to. Once you have created your storage account create a container in it called "vhds".

## Step 2: Get ready to copy the VHD

Unfortunately you need to shut down the VM to copy the VHD. This is Azure and machines are cheap, so you have a redundant set up and this shouldn't be a problem right... right? In any case if it is a problem, just do it when most of your customers are offline, it doesn't take too long.

Once you've shut down the VM find out where the VHD is located and copy it to the new storage container. The dashboard for the VM you're migrating has the locations of the disks listed.

## Step 3: Copy the VHD

We use the [tool AzCopy ](https://azure.microsoft.com/en-us/documentation/articles/storage-use-azcopy/) to move things around our Azure storage account.

To migrate the VHD use the following command.

```shell
AzCopy 
	/Source:{container your VHD is located} 
	/Dest:{container you're copying the VHD to} 
	/sourceKey:{storage access key} 
	/destkey:{storage access key}  
	/Pattern:{VHD file name} 
	/S
```

## Step 4: Create a disk from the copied VHD

At this point our newly copied VHD is just a blob in the storage account. To make it bootable we need to create an Azure Disk from it. Navigate to "Virtual Machines" and select the "Disks" sub-nav item then click "create".

## Step 5: Create the Virtual Machine

Just create a VM and choose the Disk you just created. 

Woohoo! Migration complete!

Note: This migration process only works for a "specialised" VM. If you can't create an image from the VHD, you'll need to do the sysprep rigmarole.