//
// Load some scripts into the database for server side execution

// First, purge whatever is there
s = db.system.js;
s.remove({});


var files = listFiles("mongo-fulltext");
var libs = {};
var FILE_MATCH_RE = /\/[^_].*\.js$/; // Notice that leading slash in that RE.
                                     // would need changing if not a subdir
// load all functions in to an object
files.forEach(
    function(x) {
        //Ignore non-js and things with underscore prefixes
        if (!FILE_MATCH_RE.test(x.name)){ 
            print(" >>>>>>>>>>>>>>> skipping " + x.name);
            return;
        }
        
        
        print(" *******************************************");
        print("         Loading : " + x.name + " ...");
        load(x.name);
        var module = _all;  // this symbol should be defined in x
                            // load() seems to execute in global scope
                            // making this very dirty code indeed
        libs[x.name] = module;
    }
);

// examples of storing functions for later use
// from storefunc.js
s = db.system.js;

assert( s.getIndexKeys().length > 0 , "no indexes" );
assert( s.getIndexKeys()[0]._id , "no _id index" );

// check the "jstests" dir of the mongodb source for some exciting examples of 
// stuff being done - such as mr*.js for mapreduce, and group* for
// grouping



// examples of storing functions for later use
// from storefunc.js
s = db.system.js;

for (var filename in libs) {
  var module = libs[filename];
  print("= file " + filename);
  for (var funcname in module) {
    print("== function " + funcname);
    s.insert( { _id : funcname , value : module[funcname]} );
  }
}