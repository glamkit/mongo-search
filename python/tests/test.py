# −*− coding: UTF−8 −*−
"""
actual tests for the mongo-full-text-search 
"""

from nose import with_setup
from nose.tools import assert_true, assert_equals, assert_raises
from mongofulltextsearch import mongo_search, util

_daemon = None
_settings = {
    'dbpath': None, #i.e. a temporary folder
    'port': 29017,
    'host': 'localhost'
}
_connection = None
_database = None
_collection = None

def setup_module():
    """
    setup a test collection on a server
    set up, then index, content.
    """
    global _daemon
    global _connection
    global _database
    global _collection
    
    _daemon = util.MongoDaemon(**_settings)
    _connection = util.get_connection(**_settings)
    _database = _connection['test']
    _collection = _database['items']
    util.load_all_server_functions(_database)
    util.load_fixture('jstests/_fixture-basic.json', _collection)

def teardown_module():
    if _connection:
        _connection.disconnect()
    if _daemon:
        _daemon.destroy()

def test_simple_search():
    se = whoosh_searching.search_engine()
    results = list(se.search(u'francesco'))
    assert len(results) == 1

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
