"""
This is the python wrapper to the mongo full text search javascript
functions.

This mirrors the javascript _utils.js in that it provide serverside
script updating and other miscellaneous infrastructure.
"""
_js_root = ''
_connection = None

class MongoFullTextError(Exception):
    pass

class MongoFullTextJSClientError(MongoFullTextError):
    pass

def load_records_from_list(list, collection):
    pass

def get_settings(**mongo_params):
    settings = {
        'host': 'localhost',
        'port': 27017,
    }
    settings.update(mongo_params)
    return settings

def get_connection(**settings):
    """
    get a mongo db connection. with no args, return the current global one, or
    create a new one
    """
    global _connection
    from pymongo import Connection
    if not settings:
        if _connection is not None:
            return _connection
        else:
            settings = get_settings()
    _connection = Connection(
            settings['host'],
            settings['port']
        )
    return _connection

def get_default_database(dbname='test'):
    return get_connection()[dbname]

def get_js_root():
    global _js_root
    if not _js_root:
        import path
        here = path.path(__file__).abspath()
        _js_root = here.parent.parent.parent/'javascript'
    return _js_root

def load_all_server_functions(database=None):
    """
    It might be nice to parse the JS lib in some way to give us a
    semblance of control, and also to use the IMHO superior code
    accessors in pymongo.database.Database.system_js. but srsly,
    let's just run the perfectly good js loader we already have
    """
    return exec_js_from_file(
      'mongo-fulltext/_load.js',
      database=database)

def exec_js_from_file(relative_script_path, database=None):
    """
    Given a js path, run the javascript in it against the given
    mongod database instance
    This and open_mongo_shell could/should be merged
    """
    import subprocess
    if database is None: database = get_default_database()
    js_root = get_js_root()
    db_name = database.name
    host = database.connection.host
    port = database.connection.port
    proc = subprocess.Popen(
      [
        'mongo',
        host + ":" + str(port) + "/" + db_name, 
        relative_script_path
      ], cwd=str(js_root),
      stdout = subprocess.PIPE,
      stderr = subprocess.PIPE
    )
    proc.wait()
    return proc.returncode, proc.stdout.read()

def exec_js_from_string(javascript, database=None):
    """
    Given a js path, run the javascript in it against the given
    mongo database 
    This and open_mongo_shell could possibly be merged
    """
    import subprocess
    if database is None: database = get_default_database()
    js_root = get_js_root()
    db_name = database.name
    host = database.connection.host
    port = database.connection.port
    proc = subprocess.Popen(
      [
        'mongo',
        host + ":" + str(port) + "/" + db_name, 
        '--shell', #can't use --eval since it precedes scripts
        'mongo-fulltext/_load.js'
      ], cwd=str(js_root),
      stdout = subprocess.PIPE,
      stderr = subprocess.PIPE,
      stdin = subprocess.PIPE,
    )
    stdout, stderr = proc.communicate(javascript +"\n")
    if proc.returncode == 0:
        return stdout, stderr
    else:
        raise MongoFullTextJSClientError(
          proc.returncode, stdout, stderr)
        
def load_fixture(relative_fixture_path, collection):
    """
    Given a js path, run the javascript in it against the given
    mongod database instance
    """
    import subprocess
    database = collection.database
    js_root = get_js_root()
    db_name = database.name
    host = database.connection.host
    port = database.connection.port
    proc = subprocess.Popen(
      [
        'mongoimport',
        '--host', host + ":" + str(port),
        '--db', db_name,
        '--collection', collection.name,
        '--file', relative_fixture_path
      ], cwd=str(js_root),
      stdout = subprocess.PIPE,
      stderr = subprocess.PIPE
    )
    stdout, stderr = proc.communicate('')
    if proc.returncode == 0:
        return stdout, stderr
    else:
        raise MongoFullTextJSClientError(
          proc.returncode, stdout, stderr)

def get_js_file_contents(relative_script_path):
    """
    special python access for the javascript files which are stashed
    in some inconvenient place
    """
    # /'mongo-fulltext'
    js_file = get_js_root()/relative_script_path
    return js_file.text('utf8')

def open_mongo_shell(database=None):
    """
    Open an interactive mongo shell in the given db
    """
    import subprocess
    if database is None: database = get_default_database()
    db_name = database.name
    host = database.connection.host
    port = database.connection.port
    proc = subprocess.Popen(
      [
        'mongo',
        host + ":" + str(port) + "/" + db_name,
        '--shell'
      ], cwd=str(get_js_root()),
    )
    proc.wait()

class MongoDaemon(object):
    """
    encapsulates a local mongo server, presumably for testing purposes.
    if you set dbpath=None it will avoid clobbering your data by making a temp
    dir to hold stuff
    """
    
    def __init__(self, dbpath='/data/db', **settings):
        import subprocess
        if dbpath is None:
            import tempfile
            dbpath = tempfile.mkdtemp()
        if settings.has_key('host'):
            #specified w/ different spelling on client and server
            settings['bind_ip'] = settings['host']
        if settings.has_key('db'):
            #only relevant for the client
            del(settings['db'])
        settings['dbpath'] = dbpath
        self.settings = settings
        arg_list = ['mongod']
        for key, val in settings.iteritems():
            arg_list.append('--' + key)
            if val is not None: arg_list.append(str(val))
        # don't share stdout - see http://stackoverflow.com/questions/89228/how-to-call-external-command-in-python/2251026#2251026
        daemon = subprocess.Popen(
          arg_list,
          stdout = subprocess.PIPE,
          stderr = subprocess.PIPE,
          stdin = subprocess.PIPE
        )
        self.daemon = daemon
        
    def destroy(self):
        if self.daemon:
            self.daemon.terminate()
        if self.dbpath:
            import shutil
            shutil.rmtree(dbpath)
        
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
