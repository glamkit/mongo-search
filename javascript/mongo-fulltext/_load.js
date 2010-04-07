//
// Load some scripts into the database for server OR side execution
// The system is initialised here
//

// This should create the mft namespace object and helper functions
load('mongo-fulltext/_base.js');

// First, purge whatever is there
s = db.system.js;
s.remove({});


var all_files = listFiles("mongo-fulltext");
var FILE_MATCH_RE = /\/[^_].*\.js$/; // Notice that leading slash in that RE.
                                     // would need changing if not a subdir
var files_to_load = new Array();         
                            
for (var i = 0; i < all_files.length; i++) {
  var this_file = all_files[i];
  if (!FILE_MATCH_RE.test(this_file.name)) { 
      //Ignore non-js and things with underscore prefixes
      print(" >>>>>>>>>>>>>>> skipping " + this_file.name);
  } else {
      if (this_file.name == 'util.js') { //util is used by other files.
          files_to_load.unshift(this_file);
      } else {
          files_to_load.push(this_file);
      }
  }
}
// load all functions in to an object
files_to_load.forEach(
    function(x) {
        print(" *******************************************");
        print("         Loading : " + x.name + " ...");
        load(x.name);
        var module = _all;  // this symbol should be defined in x
                            // load() seems to execute in global scope
                            // making this very dirty code indeed
        for (var key in module) {
          mft._sleeping[key] = module[key];
        }
    }
);

s.insert( { _id : 'mft', value : mft} ); //this is our global init namespace

