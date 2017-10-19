# Using the Deploy Package

The `/whisk.system/deploy` package offers a convenient way for you to describe and deploy any part of the OpenWhisk programming model using a Manifest file written in YAML.

The package includes the following actions.

| Entity | Type | Parameters | Description |
| --- | --- | --- | --- |
| `/whisk.system/deploy` | package |  | Package to deploy OpenWhisk programming model elements |
| `/whisk.system/deploy/wskdeploy` | action | repo, manifestPath, envData | Deploy from github repositories with the appropriate structure and a defining manifest. |

## wskdeploy Parameters
The `/whisk.system/deploy/wskdeploy` package deploys OpenWhisk assets from a github repository with a defining manifest.  The parameters are as follows:
- `repo`: A string specifying the location of the github repository containing the assets to be deployed.  For example `
https://github.com/ibm-functions/blueprint-cloudant-trigger`

- `manifestPath`: Optional. A string specifying the location of the folder enclosing the manifest.yaml file.  For example `src/openwhisk`. If this parameter is not provided, it will default to the root of the github repo.

- `envData`: Optional. A string with a json object providing any optional enviroment data specified by the manifest.yaml file.  For example: ```"{
          "CLOUDANT_HOSTNAME": "some-hostname-bluemix.cloudant.com",
          "CLOUDANT_USERNAME": "some-username",
          "CLOUDANT_PASSWORD": "my-password",
          "CLOUDANT_DATABASE": "database-name",
        }"```


## Setting up your Repository

A simple hello world example of a deployable github repository can be found [here](https://github.com/ibm-functions/blueprint-hello-world/).

A more complex example of a deployable github repository, including a trigger, a sequence, and cloudant credentials  can be found [here](https://github.com/ibm-functions/blueprint-cloudant-trigger).

1. Create a github repository with a manifest.yaml at its root, and an actions directory containing any source files.
* actions
    * my\_action\_name.js
* manifest.yaml

If you would like the manifest.yaml file to be in a different location, you can do so, but you'll need to pass in the optional manifestPath parameter to let wskdeploy know where the file is.

* src
    * ...
    * manifest.yaml
* test

2. Please see the above referenced repositories for samples of the manifest.yaml.  The manifest.yaml describes the OpenWhisk elements to be created.  There is a great guide for writing manifests [here](https://github.com/apache/incubator-openwhisk-wskdeploy/blob/master/docs/programming_guide.md#wskdeploy-utility-by-example).


## Run the wskdeploy command

With the repository created, you can now deploy from it.

- For the most simple manifests, with no associated services you can run the command with a repo parameter and a manifestPath parameter which tells wskdeploy which language you want from your project.

  ```
  wsk action invoke /whisk.system/deploy/wskdeploy
  -p repo https://github.com/ibm-functions/blueprint-hello-world/
  -p manifestPath "runtimes/node"
  ```

## Create a package binding and then run the wskdeploy command

- For more complex manifests with associated services you will need to provide an envData variable with the required information.  You can create a package binding that is configured with your service information.

  ```
  wsk package bind /whisk.system/deploy myDeploy -p envData
  "{"CLOUDANT_USERNAME":"username",
  "CLOUDANT_PASSWORD":"password",
   "CLOUDANT_HOSTNAME":"hostname",
   "CLOUDANT_DATABASE":"database_name"}"
  ```

- Once your package binding is configured with your service information, you can invoke it with the repo and manifestPath parameters.

  ```
  wsk action invoke myDeploy/wskdeploy
  -p repo https://github.com/ibm-functions/blueprint-hello-world/
  -p manifestPath "runtimes/node"
  ```
