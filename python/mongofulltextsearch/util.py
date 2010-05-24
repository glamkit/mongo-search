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
    connection_settings = dict(
      [(key, settings[key]) for key in [
        'host', 'port', 'network_timeout'
      ] if key in settings]
    )
    _connection = Connection(**connection_settings)
    return _connection

def get_default_database(dbname='test'):
    return get_connection()[dbname]

def get_js_root():
    global _js_root
    if not _js_root:
        import path
        here = path.path(__file__).realpath()
        _js_root = here.parent/'javascript'
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
    Given a json fixture path, import the objects in it to the given collection.
    Note that the json here is not true json, but json in the mongo sense, one 
    object/document per line, linefeed- rather than comma-separated
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
    
    TODO: support with_statement Context stuff.
    """
    class TEST_DIR:pass
    class PRIVATE_TMP_DIR:pass
    
    def __getattr__(self, attribute):
        """
        instead of outright subclassing subprocess.POpen we provide convenince
        accessors on this wrapper.
        """
        return getattr(self.daemon, attribute)
        
    def __init__(self, dbpath='/data/db', capture_output=False, **settings):
        import subprocess
        import time
        import tempfile
        import errno
        
        if dbpath is self.PRIVATE_TMP_DIR:
            dbpath = tempfile.mkdtemp()
        elif dbpath is self.TEST_DIR:
            #TODO: find the path prefic in an OS-sensitive version
            dbpath = '/tmp/mongodbtest'
            import os
            try:
                os.makedirs(dbpath)
            except OSError, e:
                if e.errno == errno.EEXIST: # path exists
                    pass
                else:
                    raise
        settings['dbpath'] = dbpath
        if 'host' in settings:
            #specified w/ different spelling on client and server
            settings['bind_ip'] = settings['host']
            del(settings['host'])
        if 'db' in settings:
            #only relevant for the client
            del(settings['db'])
        if 'network_timeout' in settings:
            del(settings['network_timeout'])
        self.settings = settings
        arg_list = ['mongod']
        for key, val in settings.iteritems():
            arg_list.append('--' + key)
            if val is not None: arg_list.append(str(val))
        # don't share stdout - see http://stackoverflow.com/questions/89228/how-to-call-external-command-in-python/2251026#2251026
        if capture_output:
            subproc_args = {
              'stdout': subprocess.PIPE,
              'stderr': subprocess.PIPE,
              'stdin': subprocess.PIPE
            }
        else:
            subproc_args = {}
        daemon = subprocess.Popen(
          arg_list,
          **subproc_args
        )
        if capture_output:
            #AFAICT we only get to check for termination if we don't
            #capture output. is it really that lame?
            time.sleep(1)
            daemon.poll()
            if daemon.returncode:
                #uh oh, server has died already
                raise Exception("mongo server has died")
        self.daemon = daemon
        self.dbpath = dbpath
        
    def destroy(self):
        if self.daemon:
            self.daemon.terminate()
        if self.settings['dbpath']:
            import shutil
            shutil.rmtree(self.settings['dbpath'])
        
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
