//load mongoexport-style newline-separated objects in a file
var util = function(){
var util = {};

util.load_records_from_file = function(record_file, coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    startMongoProgramNoConnect('mongoimport', '--collection', coll_name, record_file);
};

//load an array of records into the specified collection
util.load_records_from_list = function(record_list, coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    
    record_list.forEach(
        function(record) {
            db[coll_name].save(record);
        }
    );
};

util.init_test_collection = function(coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    db[coll_name].drop();
};

util.load_server_functions = function() {
    load('mongo-fulltext/_load.js');
};

//pump a client shell variable to global scope on the server
util.assign_on_server = function(name, value) {
    // can't use a 'var' scope def here. things explode.
    var servereval = name + " = " + tojson(value)+ ";";
    db.eval(servereval);
};

util.setup_tests = function(coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    util.init_test_collection(coll_name);
    util.load_records_from_file('jstests/_fixture-basic.js');
    util.load_server_functions();
};
return util};

_all = {
  util: util
};