//load mongoexport-style newline-separated objects in a file
function load_records_from_file(record_file, coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    startMongoProgramNoConnect('mongoimport', '--collection', coll_name, record_file);
}

//load an array of records into the specified collection
function load_records_from_list(record_list, coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    
    record_list.forEach(
        function(record) {
            db[coll_name].save(record);
        }
    );
}

function init_test_collection(coll_name) {
    if (typeof coll_name == 'undefined') {
        coll_name = 'test';
    }
    db[coll_name].drop();
}

function load_server_functions() {
    load('mongo-fulltext/_load.js');
}

function setup_tests(coll_name) {
    if (typeof coll_name == 'undefined') {
        var coll_name = 'test';
    }
    init_test_collection(coll_name);
    load_records_from_file('jstests/_fixture-basic.js');
    load_server_functions();
}
