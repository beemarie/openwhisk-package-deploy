# Build script for Travis-CI.

SCRIPTDIR=$(cd $(dirname "$0") && pwd)
ROOTDIR="$SCRIPTDIR/../.."
WHISKDIR="$ROOTDIR/../openwhisk"

echo SCRIPTDIR
echo WHISKDIR
echo ROOTDIR

cd $WHISKDIR

cp $WHISKDIR/../tests/src/* $WHISKDIR/tests/src/packages/

tools/build/scanCode.py .

cd $WHISKDIR/ansible

ANSIBLE_CMD="ansible-playbook -i environments/travis"

$ANSIBLE_CMD setup.yml
$ANSIBLE_CMD prereq.yml
$ANSIBLE_CMD couchdb.yml
$ANSIBLE_CMD initdb.yml

cd $WHISKDIR

./gradlew distDocker

cd $WHISKDIR/ansible

$ANSIBLE_CMD openwhisk.yml

cd $WHISKDIR

VCAP_SERVICES_FILE="$(readlink -f $WHISKDIR/../tests/credentials.json)"

#update whisk.properties to add tests/credentials.json file to vcap.services.file, which is needed in tests
WHISKPROPS_FILE="$WHISKDIR/whisk.properties"
sed -i 's:^[ \t]*vcap.services.file[ \t]*=\([ \t]*.*\)$:vcap.services.file='$VCAP_SERVICES_FILE':'  $WHISKPROPS_FILE
cat whisk.properties

WSK_CLI=$WHISKDIR/bin/wsk
AUTH_KEY=$(cat $WHISKDIR/ansible/files/auth.whisk.system)
EDGE_HOST=$(grep '^edge.host=' $WHISKPROPS_FILE | cut -d'=' -f2)

cd ${ROOTDIR}
TERM=dumb ./gradlew :tests:test
# # Install the package
# source $WHISKDIR/../install.sh $EDGE_HOST $AUTH_KEY $WSK_CLI

# #Test only the test cases classes in tests/src (Openwhisk dependencies are needed)
# X="./gradlew :tests:test "
# for f in $(ls $WHISKDIR/../tests/src | sed -e 's/\..*$//'); do X="$X --tests \"packages.$f\""; done
# eval $X
