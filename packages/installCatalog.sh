#!/bin/bash
#
# use the command line interface to install standard actions deployed
# automatically
#
# To run this command
# ./installCatalog.sh <authkey> <edgehost> <apihost> <workers>

set -e
set -x

: ${OPENWHISK_HOME:?"OPENWHISK_HOME must be set and non-empty"}
WSK_CLI="$OPENWHISK_HOME/bin/wsk"

if [ $# -eq 0 ]
then
echo "Usage: ./installCatalog.sh <authkey> <edgehost> <dburl> <dbprefix> <apihost> <workers>"
fi

AUTH="$1"
EDGEHOST="$2"
DB_URL="$3"
DB_NAME="${4}deploy"
APIHOST="$3"
WORKERS="$4"

# If the auth key file exists, read the key in the file. Otherwise, take the
# first argument as the key itself.
if [ -f "$AUTH" ]; then
    AUTH=`cat $AUTH`
fi

# Make sure that the EDGEHOST is not empty.
: ${EDGEHOST:?"EDGEHOST must be set and non-empty"}

# Make sure that the DB_URL is not empty.
: ${DB_URL:?"DB_URL must be set and non-empty"}

# Make sure that the DB_NAME is not empty.
: ${DB_NAME:?"DB_NAME must be set and non-empty"}

# Make sure that the APIHOST is not empty.
: ${APIHOST:?"APIHOST must be set and non-empty"}

PACKAGE_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export WSK_CONFIG_FILE= # override local property file to avoid namespace clashes

echo Installing Deploy2 package.

$WSK_CLI -i --apihost "$EDGEHOST" package update --auth "$AUTH" --shared yes deploy2 \
     -a description 'Alarms and periodic utility' \
     -a parameters '[ {"message":"theMessage", "required":true} ]' \
     -p apihost "$APIHOST" \
     -p trigger_payload ''

$WSK_CLI -i --apihost "$EDGEHOST" action update --auth "$AUTH" deploy2/wskdeploy "$PACKAGE_HOME/actions/deploy.js" \
     -a description 'Creates an action that allows you to run wskdeploy from OpenWhisk' \
     -a parameters '[ {"name":"repo", "required":true, "bindTime":true, "description": "The GitHub repository of the Blueprint"}, {"name":"manifestPath", "required":false, "bindTime":true, "description": "The relative path to the manifest file from the GitHub repo"},{"name":"wskApiHost", "required":false, "description": "The URL of the OpenWhisk api host you want to use"}, {"name":"envData", "required":false, "description": "Blueprint-specific environment data object"} ]' \
     -a sampleInput '{"repo":"github.com/my_blueprint", "manifestPath":"runtimes/swift", "wskApiHost":"openwhisk.stage1.ng.bluemix.net", "envData": "{\"KAFKA_ADMIN_URL\":\"https://my_kafka_service\", \"MESSAGEHUB_USER\":\"MY_MESSAGEHUB_USERNAME\"}"}' \
     --docker "openwhisk/wskdeploy:0.8.9.1"

if [ -n "$WORKERS" ];
then
    $WSK_CLI -i --apihost "$EDGEHOST" package update --auth "$AUTH" --shared no wskdeployWeb \
        -p DB_URL "$DB_URL" \
        -p DB_NAME "$DB_NAME" \
        -p apihost "$APIHOST" \
        -p workers "$WORKERS"
else
    $WSK_CLI -i --apihost "$EDGEHOST" package update --auth "$AUTH" --shared no wskdeployWeb \
        -p DB_URL "$DB_URL" \
        -p DB_NAME "$DB_NAME" \
        -p apihost "$APIHOST"
fi

# make alarmWebAction.zip
# cd action
# npm install
#
# if [ -e alarmWebAction.zip ];
# then
#     rm -rf alarmWebAction.zip
# fi

# zip -r alarmWebAction.zip package.json alarmWebAction.js node_modules

# $WSK_CLI -i --apihost "$EDGEHOST" action update --kind nodejs:6 --auth "$AUTH" alarmsWeb/alarmWebAction "$PACKAGE_HOME/actions/alarmWebAction.zip" \
#     -a description 'Create/Delete a trigger in alarms provider Database' \
#     --web true
