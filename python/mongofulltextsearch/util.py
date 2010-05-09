"""
This is the python wrapper to the mongo full text search javascript
functions.

This mirrors the javascript _utils.js in that it provide serverside
script updating and other miscellaneous infrastructure.
"""
js_path = ''

def load_records_from_list(list, collection):
    pass

def load_server_functions(code, connection):
    """
    It woudl be nice to parse the JS lib in some way to give us a
    semblance of control, and also to use the IMHO superior code
    accessors in pymongo.database.Database.system_js. but srsly,
    let's jsut run the perfectly good js loader we already have
    """
    pass

def get_js_file_contents(rel_path):
    """
    special python access for the javascript files which are stashed
    in some inconvenient place
    """
    global js_path
    if not js_path:
        import path
        here = path.path(__file__)
        js_path = here.abspath().parent.parent.parent/'javascript'/'mongo-fulltext'
    js_file = js_path/rel_path
    return js_file.text('utf8')
    
    
# //load an array of records into the specified collection
# util.load_records_from_list = function(record_list, coll_name) {
#     if (typeof coll_name == 'undefined') {
#         coll_name = 'test';
#     }
# 
#     record_list.forEach(
#         function(record) {
#             db[coll_name].save(record);
#         }
#     );
# };
# 
# util.init_test_collection = function(coll_name) {
#     if (typeof coll_name == 'undefined') {
#         coll_name = 'test';
#     }
#     db[coll_name].drop();
# };
# 
# util.load_server_functions = function() {
#     load('mongo-fulltext/_load.js');
# };