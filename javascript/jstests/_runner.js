//
// simple runner to run toplevel tests in jstests
//
// to run: 
//   ./mongo jstests/_runner.js

//run_tests.sh may have injected some command line args
if ((typeof TEST_ARGS == 'undefined') || (TEST_ARGS === null)) {
    var TEST_ARGS = [];
} else {
    TEST_ARGS = TEST_ARGS.split(/\s+/);
}

print('a');
load('mongo-fulltext/_load.js');
print('b');

mft.util.setup_tests();
print('c');

var FILE_MATCH_RE = /\/[^_].*\.js$/ ;
var files = listFiles("jstests");
print('d');

files.forEach(
    function(x) {
        print('e');
        
        if (!FILE_MATCH_RE.test(x.name)) { 
            print(" >>>>>>>>>>>>>>> skipping " + x.name);
            return;
        }
        
        print(" *******************************************");
        print("         Test : " + x.name + " ...");
        print("                " + Date.timeFunc( function() { load(x.name); }, 1) + "ms");
        
    }
);

