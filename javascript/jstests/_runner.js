//
// simple runner to run toplevel tests in jstests
//
// to run: 
//   ./mongo jstests/_runner.js
load('jstests/_utility.js');
setup_tests();

var FILE_MATCH_RE = /\/[^_].*\.js$/ ;
var files = listFiles("jstests");

files.forEach(
    function(x) {
        if (!FILE_MATCH_RE.test(x.name)) { 
            print(" >>>>>>>>>>>>>>> skipping " + x.name);
            return;
        }
        
        print(" *******************************************");
        print("         Test : " + x.name + " ...");
        print("                " + Date.timeFunc( function() { load(x.name); }, 1) + "ms");
        
    }
);

