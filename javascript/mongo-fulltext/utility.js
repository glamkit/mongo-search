var mft_util = mft_util || {};

//load mongoexport-style newline-separated objects in a file
mft_util.load_records_from_file = function(coll_name, record_file) {
     startMongoProgramNoConnect('mongoimport', '--collection', coll_name, record_file);
};

//load an array of records into the specified collection
mft_util.load_records_from_list = function(coll_name, record_list) {
    record_list.forEach(
        function(record) {
            db[coll_name].save(record);
        }
    );
};

var _all = {
  load_records_from_file: mft_util.load_records_from_file,
  load_records_from_list: mft_util.load_records_from_list
};