const fs = require('fs');
const exec = require('child_process').exec;
const git = require('simple-git');
const yaml = require('js-yaml');

let command = '';

/**
 * Action to deploy openwhisk elements from a compliant repository
 *  @param {string} gitUrl - github url containing the manifest and elements to deploy
 *  @param {string} manifestPath - (optional) the path to the manifest file, e.g. "openwhisk/src"
 *  @param {object} envData - (optional) some specific details such as cloudant username or cloudant password
 *  @return {object} Promise
 */
function main(params) {
  return new Promise((resolve, reject) => {
    // Grab optional envData and manifestPath params for wskdeploy
    let {
      envData,
      manifestPath,
      gitUrl
    } = params;

    // confirm gitUrl was provided as a parameter
    if (!gitUrl) {
      reject({
        error: 'Please enter the GitHub repo url in params',
      });
    }

    // if no manifestPath was provided, use current directory
    if (!manifestPath) {
      manifestPath = '.';
    }
    // Grab wsp api host and auth from params, or process.env
    const { wskApiHost, wskAuth } = getWskApiAuth(params);

    // Extract the name of the repo for the tmp directory
    const repoSplit = params.gitUrl.split('/');
    const repoName = repoSplit[repoSplit.length - 1];
    const localDirName = `${__dirname}/tmp/${repoName}`;
    return git()
    .clone(gitUrl, localDirName, ['--depth', '1'], (err, data) => {
      if (err) {
        reject('There was a problem cloning from github.  Does that github repo exist?  Does it begin with http?', err);
      }
      resolve({
        repoDir: localDirName,
        manifestPath,
        manifestFileName: 'manifest.yaml',
        wskAuth,
        wskApiHost,
        envData,
      });
    });
  })
  .then((data) => {
    const {
      manifestPath,
      repoDir,
      envData,
      manifestFileName
    } = data;

    return new Promise((resolve, reject) => {
      // Check if we need to rename the package in the manifest.yaml
      if (envData && envData.PACKAGE_NAME) {
        fs.readFile(`${repoDir}/${manifestPath}/${manifestFileName}`, (err, manifestFileData) => {
          if (err) {
            reject(`Error loading ${manifestFileName} to edit the package name:`, err);
          }

          try {
            // Load the manifest.yaml content and overwrite the name
            const manifestYamlJSON = yaml.safeLoad(manifestFileData);
            manifestYamlJSON.package.name = envData.PACKAGE_NAME;

            fs.writeFile(`${repoDir}/${manifestPath}/manifest-changed-name.yaml`, yaml.safeDump(manifestYamlJSON), (error) => {
              if (error) {
                reject('Error saving new manifest.yaml file', error);
              }

              // Change the manifestFileName so we read the updated manifest
              //  This helps in the case where one user wants to use a changed name
              //  and then wants to use the normal name, but the invoker isn't fresh
              //  and would accidentally use the overwritten manifest with the new name
              data.manifestFileName = 'manifest-changed-name.yaml';
              resolve(data);
            });
          } catch (e) {
            reject('Error converting manifest.yaml to JSON', e);
          }
        });
      } else {
        // Not trying to rename package, continue as normal
        data.envData = {};
        resolve(data);
      }
    });
  })
  .then((data) => {
    const {
      wskAuth,
      wskApiHost,
      manifestPath,
      manifestFileName,
      repoDir,
      envData,
    } = data;

    // Set the cwd of the command to be where the manifest/actions live
    const execOptions = {
      cwd: `${repoDir}/${manifestPath}`,
    };

    // If we were passed environment data (Cloudant bindings, etc.) add it to the options for `exec`
    if (envData) {
      execOptions.env = envData;
    }

    // Send 'y' to the wskdeploy command so it will actually run the deployment
    command = `printf 'y' | ${__dirname}/wskdeploy -m ${manifestFileName} --auth ${wskAuth} --apihost ${wskApiHost}`;

    return new Promise((resolve, reject) => {
      if (fs.existsSync(`${repoDir}/${manifestPath}/${manifestFileName}`)) {
        exec(command, execOptions, (err, stdout, stderr) => {
          if (err) {
            reject('Error running `./wskdeploy`: ', err);
          }
          if (stdout) {
            console.log('stdout from wskDeploy: ', stdout, ' type ', typeof stdout);

            if (typeof stdout === 'string') {
              try {
                stdout = JSON.parse(stdout);
              } catch (e) {
                console.log('Failed to parse stdout, it wasn\'t a JSON object');
              }
            }

            if (typeof stdout === 'object') {
              if (stdout.error) {
                stdout.descriptiveError = 'Could not successfully run wskdeploy. Please run again with the verbose flag, -v.';
                reject(stdout);
              }
            }
          }
          if (stderr) {
            console.log('stderr from wskDeploy: ', stderr);
          }
          //TODO: Delete folder here, need to use fs-extra or some other modules
          var deleteFolderRecursive = function(path) {
            if (fs.existsSync(path)) {
              fs.readdirSync(path).forEach(function(file, index){
                var curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                  deleteFolderRecursive(curPath);
                } else { // delete file
                  fs.unlinkSync(curPath);
                }
              });
              fs.rmdirSync(path);
            }
          };
          deleteFolderRecursive(repoDir);
          console.log('Finished! Resolving now');
          resolve({
            status: 'success',
            success: true,
          });
        });
      } else {
        reject(`Error loading ${repoDir}/${manifestPath}/${manifestFileName}. Does a manifest file exist?`);
      }
    })
  });
}

/**
 * Checks if wsk API host and auth were provided in params, if not, gets them from process.env
 * @param  {[Object]} params    [Params object]
 * @return {[Object]}           [Object containing wskApiHost and wskAuth]
 */
function getWskApiAuth(params) {
  let {
    wskApiHost,
    wskAuth,
  } = params;

  if (!wskApiHost) {
    wskApiHost = process.env.__OW_API_HOST;
  }

  if (!wskAuth) {
    wskAuth = process.env.__OW_API_KEY;
  }

  return {
    wskApiHost,
    wskAuth,
  };
}

exports.main = main;
