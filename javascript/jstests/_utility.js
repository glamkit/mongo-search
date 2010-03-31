// We require the functions in this file to observe slightly different
// conventions than other files - in particular, these objects must all be
// serialisable and need not use the usual initialiser pattern
// we still need the _all business.
// depends upon _mft_live being created in _load.js

mft_util = {
    TEST_DB_HOST : null,
    TEST_DB_PORT : null
};

//load mongoexport-style newline-separated objects in a file
mft_util.load_records_from_file = function(record_file, coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    startMongoProgramNoConnect('mongoimport', '--collection', coll_name, record_file);
};

//load an array of records into the specified collection
mft_util.load_records_from_list = function(record_list, coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    
    record_list.forEach(
        function(record) {
            db[coll_name].save(record);
        }
    );
};

mft_util.init_test_collection = function(coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    db[coll_name].drop();
};

mft_util.load_server_functions = function() {
    load('mongo-fulltext/_load.js');
};

//pump a client shell variable to global scope on the server
mft_util.assign_on_server = function(name, value) {
    // can't use a 'var' scope def here. things explode.
    var servereval = name + " = " + tojson(value)+ ";";
    db.eval(servereval);
};

mft_util.setup_tests = function(coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    mft_util.init_test_collection(coll_name);
    mft_util.load_records_from_file('jstests/_fixture-basic.js');
    mft_util.load_server_functions();
};

mft_util.get = function(name) {
    // objects in the mongod system.js collection lose closures, prototypes etc.
    // we access them  using this thing by pulling them out of 
    // the mft namespace and caching initialised versions in the _mft_live one.
    if (typeof _mft_live[name] == 'undefined') {
        _mft_live[name] = mft(); 
    };
    return _mft_live[name];
};

var _mft_live = {};

_all = {
  mft_util: mft_util,
};
