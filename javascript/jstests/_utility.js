//load mongoexport-style newline-separated objects in a file
function load_records_from_file(coll_name, record_file) {
     startMongoProgramNoConnect('mongoimport', '--collection', coll_name, record_file);
};

//load an array of records into the specified collection
function load_records_from_list(coll_name, record_list) {
    record_list.forEach(
        function(record) {
            db[coll_name].save(record);
        }
    );
};
