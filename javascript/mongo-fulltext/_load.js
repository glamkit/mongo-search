//
// Load some scripts into the database for server side execution

// First, purge whatever is there
s = db.system.js;
s.remove({});


var files = listFiles("mongo-fulltext");
var mft = {};
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
        for (var key in module) {
          mft[key] = module[key];
        }
    }
);

s.insert( { _id : 'mft', value : mft} ); //this is our global init namespace
s.insert( { _id : '_mft_live', value : {}} );

