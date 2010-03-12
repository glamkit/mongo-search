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

mft_util.setup_tests = function(coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    mft_util.init_test_collection(coll_name);
    mft_util.load_records_from_file('jstests/_fixture-basic.js');
    mft_util.load_server_functions();
};
