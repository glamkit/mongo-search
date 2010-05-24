# −*− coding: UTF−8 −*−
"""
This is the python wrapper to the mongo full text search javascript. As such it
has to implement OR CALL all the mapreduce invocations in the javascript
library, plus anything else that we do not wish to block the server upon
executing. That is:

search.mapReduceIndex
search.mapReduceTermScore
search.mapReduceSearch
search.mapReduceNiceSearch
search.stemAndTokenize (and thus search.stem and search.tokenizeBasic )

Optional (if you don't mind calling blocking execution server-wide)
search.processQueryString
search.encodeQueryString
"""
import re

import pymongo
from pymongo.code import Code

import util
import porter

TOKENIZE_BASIC_RE = re.compile(r"\b(\w[\w'-]*\w|\w)\b") #this should match the RE in use on the server
INDEX_NAMESPACE = 'search_.indexes'



def index_collection(collection):
    """Execute all relevant bulk indexing functions
    ie:
        mapReduceIndex , which extracts indexed terms and puts them in a new collection
        mapReduceTermScore , which creates a table of scores for each term.
    which is covered by mapReduceIndexTheLot
    """
    return util.exec_js_from_string(
      "mft.get('search').mapReduceIndexTheLot('%s');" % collection.name,
      collection.database)

def search(collection, search_query_string):
    """
    Re-implmentation of JS function search.mapReduceSearch
    """
    search_query_terms = process_query_string(search_query_string)
    map_js = Code("function() { mft.get('search')._searchMap.call(this) }")
    reduce_js = Code("function(k, v) { return mft.get('search')._searchReduce(k, v) }")
    scope =  {'search_terms': search_query_terms, 'coll_name': collection.name}
    #   lazily assuming "$all" (i.e. AND search) 
    query_obj = {'value._extracted_terms': {'$all': search_query_terms}}
    db = collection.database
    res = db[index_name(collection)].map_reduce(
      map_js, reduce_js, scope=scope, query=query_obj)
    res.ensure_index([('value.score', pymongo.ASCENDING)]) # can't demand backgrounding in python seemingly?
    # should we be returning a verbose result, or just the collection here?
    return res

def nice_search_by_query(collection, search_query_string, query_obj):
    """
    Search, returning full result sets and limiting by the supplied id_list
    A re-implementation of the javascript function search.mapReduceNiceSearch.
    """
    # because we only have access to the index collection later, we have to convert 
    # the query_obj to an id list
    id_list = [rec['_id'] for rec in collection.find(query_obj, ['_id'])]
    return nice_search_by_ids(collection, search_query_string, id_list)

def nice_search_by_ids(collection, search_query_string, id_list=None):
    """
    Search, returning full result sets and limiting by the supplied id_list
    """
    raw_search_results = search(collection, search_query_string)
    search_coll_name = raw_search_results.name
    map_js = Code("function() { mft.get('search')._niceSearchMap.call(this) }")
    reduce_js = Code("function(k, v) { return mft.get('search')._niceSearchReduce(k, v) }")
    scope =  {'coll_name': collection.name}
    db = collection.database
    sorting = {'value.score': pymongo.DESCENDING}
    if id_list is None:
        id_query_obj = {}
    else:
        id_query_obj = {'_id': {'$in': id_list}}
    res_coll = db[search_coll_name].map_reduce(map_js, reduce_js, 
        query=id_query_obj, scope=scope, sort=sorting)
    #should we be ensuring an index here? or just leave it?
    # res_coll.ensure_index([('value.score', pymongo.ASCENDING)])
    return res_coll.find()

def nice_search(collection, search_query_string):
    return nice_search_by_ids(collection, search_query_string, None)
    
def process_query_string(query_string):
    return sorted(stem_and_tokenize(query_string))

def stem_and_tokenize(phrase):
    return stem(tokenize(phrase.lower()))

def stem(tokens):
    """
    now we could do this in python. We coudl also call the same function that
    exists server-side, or even run an embedded javascript interpreter. See
    http://groups.google.com/group/mongodb-user/browse_frm/thread/728c4376c3013007/b5ac548f70c8b3ca
    """
    return [porter.stem(tok) for tok in tokens]

def tokenize(phrase):
    return [m.group(0) for m in TOKENIZE_BASIC_RE.finditer(phrase)]

def index_name(collection):
    return INDEX_NAMESPACE + '.' + collection.name