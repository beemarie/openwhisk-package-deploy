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

    return checkIfDirExists(localDirName)
      .then((res) => {
        // The directory does not exist, clone BP from Github
        if (!res.skipClone) {
          return git()
            .clone(gitUrl, localDirName, (err) => {
              if (err) {
                reject('There was a problem cloning from github.  Does that github repo exist?  Does it begin with http://?', err);
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
        } else {
          // The directory exists already, check if there is anything new
          //  and pull if so
          return git(localDirName)
            .pull((err, update) => {
              if (err) {
                reject('Error pulling most recent data ', err);
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
        }
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
    command = `printf 'y' | ${__dirname}/wskdeploy -v -m ${manifestFileName} --auth ${wskAuth} --apihost ${wskApiHost}`;

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

          console.log('Finished! Resolving now');
          resolve({
            status: 'success',
            success: true,
          });
        });
      } else {
        reject(`Error loading ${repoDir}/${manifestPath}/${manifestFileName}. Does a manifest file exist?`);
      }
    });
  });
}

/**
 * Checks if the BP directory already exists on this invoker
 * @TODO: Optimize this to use GH tags so we can see whether or not we still need to pull a new version
 * @param  {[string]} dirname [string of directory path to check]
 * @return {[Promise]}        [Whether or not directory exists]
 */
function checkIfDirExists(dirname) {
  return new Promise((resolve, reject) => {
    fs.stat(dirname, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          console.log(`Directory ${dirname} does not exist`);
          resolve({
            skipClone: false
          });
        } else {
          reject(`Error checking if ${dirname} exists`, err);
        }
      }
      // Directory does exist, skip git clone
      // @TODO: Add optimization/caching here if repo exists on invoker already
      resolve({
        skipClone: true
      });
    });
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

  console.log(`Using wskApiHost: ${wskApiHost} and wskAuth: ${wskAuth}`);

  return {
    wskApiHost,
    wskAuth,
  };
}

exports.main = main;
