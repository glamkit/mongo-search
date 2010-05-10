"""
This is the python wrapper to the mongo full text search javascript
functions.

This mirrors the javascript _utils.js in that it provide serverside
script updating and other miscellaneous infrastructure.
"""
_js_root = ''

def load_records_from_list(list, collection):
    pass

def get_database(**mongo_params):
    """
    get a mongo connection, falling back to the settings in a
    settings file
    """
    from pymongo import Connection
    defaults = {
        'MONGO_HOST': 'localhost',
        'MONGO_PORT': 27017,
        'MONGO_DB': 'test',
    }
    try:
        import settings
        for k in defaults.keys():
            defaults[k]=getattr(settings, k, defaults[k])
    except ImportError:
        pass
    connection = Connection(
            defaults['MONGO_HOST'],
            defaults['MONGO_PORT']
        )
    return connection[defaults['MONGO_DB']]
    
def load_all_server_functions(database=None):
    """
    It would be nice to parse the JS lib in some way to give us a
    semblance of control, and also to use the IMHO superior code
    accessors in pymongo.database.Database.system_js. but srsly,
    let's just run the perfectly good js loader we already have
    """
    return exec_js_from_file(
      'mongo-fulltext/_load.js',
      database=database)

def get_js_root():
    global _js_root
    if not _js_root:
        import path
        here = path.path(__file__).abspath()
        _js_root = here.parent.parent.parent/'javascript'
    return _js_root

def exec_js_from_file(relative_script_path, database=None):
    """
    Given a js path, run the javascript in it against the given
    mongod database instance
    How does this work with "load"?
    """
    import subprocess
    if database is None: database = get_database()
    js_root = get_js_root()
    db_name = database.name
    host = database.connection.HOST
    port = database.connection.PORT
    proc = subprocess.Popen(
      [
        'mongo',
        host + ":" + str(port) + "/" + db_name, 
        relative_script_path
      ], cwd=str(js_root),
      stdout = subprocess.PIPE,
      stderr = subprocess.STDOUT
    )
    proc.wait()
    return proc.returncode, proc.stdout.read()
    
def get_js_file_contents(relative_script_path):
    """
    special python access for the javascript files which are stashed
    in some inconvenient place
    """
    # /'mongo-fulltext'
    js_file = get_js_root()/relative_script_path
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