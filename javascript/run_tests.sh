#!/bin/sh
if [ "f$@" = "f" ] 
then
    echo no args
    TEST_ARGS="null" 
    echo "TEST_ARGS = $TEST_ARGS"
else
    echo $@ args
    TEST_ARGS=$@ 
fi
echo "var TEST_ARGS = $TEST_ARGS;"
mongo --eval "var TEST_ARGS = $TEST_ARGS;" jstests/_lodeRunner.js