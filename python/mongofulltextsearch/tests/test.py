# −*− coding: UTF−8 −*−
"""
actual tests for the mongo-full-text-search 
"""

from nose import with_setup
from nose.tools import assert_true, assert_equals, assert_raises
from mongofulltextsearch import mongo_search, util
import time

_daemon = None
_settings = {
    'dbpath': util.MongoDaemon.TEST_DIR, #i.e. a temporary folder, system-wide
    'port': 29017,
    'host': '127.0.0.1',
    'network_timeout': 5
}
_connection = None
_database = None
_collection = None

def setup_module():
    """
    Instantiate a new mongo daemon and corresponding connection and 
    then insert the appropriate test fixture.
    """
    from pymongo.connection import AutoReconnect
    import time
    daemon = _setup_daemon()
    conn_tries = 0
    while True:
        try:
            _connection = util.get_connection(**_settings)
            break
        except AutoReconnect:
            conn_tries += 1 # sometimes the daemon doesn't set up straight away
            if conn_tries > 5: 
                raise #but if we've waited 5 secs, let's give up
            time.sleep(1)
    _setup_fixture(_connection)
    
def _setup_daemon():
    """
    Instantiate a new mongo daemon and corresponding connection.
    """
    global _daemon
    global _connection
    
    _daemon = util.MongoDaemon(**_settings)
    return _daemon

def _setup_fixture(connection=None):
    """
    setup a test collection on a server
    set up, then index, content.
    
    TODO: purge *all* collections from db to avoid clashes
    
    Call directly if you don't want to use the one-off test server
    """
    global _collection
    global _database
    global _connection
    
    if connection is None: connection = _connection
    
    _database = connection['test']
    _database['system.js'].remove()    
    _collection = _database['items']
    _collection.remove()
    util.load_all_server_functions(_database)
    util.load_fixture('jstests/_fixture-basic.json', _collection)

def teardown_module():
    if _connection:
        _connection.disconnect()
    if _daemon:
        _daemon.destroy()

def test_simple_search():
    collection = _database['search_works']
    collection.remove()
    stdout, stderr = util.load_fixture('jstests/_fixture-basic.json', collection)
    conf = _database['fulltext_config']
    conf.remove()
    conf.insert({
      'collection_name' : 'search_works',
      'fields': {
        'title': 5, 'content': 1},
      'params': {
        'full_vector_norm': True}
    })
    
    stdout, stderr = mongo_search.index_collection(collection)
    
    results = mongo_search.search(collection, u'fish')
    print results
    print list(results.find())
    
    nice_results = mongo_search.nice_search(collection, u'fish')
    print list(nice_results)
    # assert len(results) == 1

# def test_stemming():
#     analyze = whoosh_searching.search_engine().index.schema.analyzer('content')
#     assert list(analyze(u'finally'))[0].text == u'final' # so porter1 right now
#     assert list(analyze(u'renegotiation'))[0].text == u'renegoti' # so porter1 right now
#     assert list(analyze(u'cat'))[0].text == u'cat' # so porter1 right now
# 
# def test_stemmed_search():
#     se = whoosh_searching.search_engine()
#     results = list(se.search(u'distinguished')) # should be stemmed to distinguish
#     assert len(results) == 1
#     assert results[0]['id'] == u'24455'
#     
# def greater_than(a, b):
#     """
#     test helper assertion
#     """
#     assert a>b
# 
# def test_get_field():
#     """
#     does our dict traverser descend just how we like it?
#     """
#     #fail loudly for nonsense schemata
#     # yield assert_raises, KeyError, get_field, {}, 'nonexistent_field'
#     yield assert_equals, get_field({}, 'nonexistent_field'), None
#     #but find members if they exist
#     yield assert_equals, get_field({'a': 5}, 'a'), [5]
#     yield assert_equals, get_field({'a': [5, 6, 7]}, 'a'), [5, 6, 7]
#     yield assert_equals, get_field({'a': {'b': [5, 6, 7]}}, 'a.b'), [5, 6, 7]
#     yield assert_equals, get_field({'a': [
#       {'b': 5},
#       {'b': 1},
#       ]}, 'a.b'), [5, 1]
#     yield assert_equals, get_field({'a': [
#       {'b': [5, 6, 7]},
#       {'b': [1, 2, 3]},
#       ]}, 'a.b'), [5, 6, 7, 1, 2, 3]
#     yield assert_equals, get_field(
#       {'artist': [
#         {'name': ['brett', 'bretto', 'brettmeister']},
#         {'name': ['tim', 'timmy']},
#       ]}, 'artist.name'), ['brett', 'bretto', 'brettmeister', 'tim', 'timmy']
#     yield assert_equals, get_field(
#       {'artist': [
#         {'name': ['brett', 'bretto', 'brettmeister']},
#         {'quality': 'nameless'},
#       ]}, 'artist.name'), ['brett', 'bretto', 'brettmeister']
