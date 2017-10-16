#!/bin/bash

set -e
set -x

if [ $# -eq 0 ]
then
    echo "Usage: ./uninstall.sh $APIHOST $AUTH $WSK_CLI"
fi

APIHOST="$1"
AUTH="$2"
WSK_CLI="$3"

echo Uninstalling Template Package \

$WSK_CLI --apihost $APIHOST action delete -i --auth $AUTH deploy/wskdeploy

$WSK_CLI --apihost $APIHOST package delete -i --auth $AUTH deploy
