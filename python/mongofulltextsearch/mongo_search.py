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



def map_reduce_index(collection):
    """Execute all relevant bulk indexing functions
    ie:
        mapReduceIndex , which extracts indexed terms and puts them in a new collection
        mapReduceTermScore , which creates a table of scores for each term.
    which is covered by mapReduceIndexTheLot
    """
    return util.exec_js_from_string(
      "mft.get('search').mapReduceIndexTheLot('%s');" % collection.name,
      collection.database)

def map_reduce_search(collection, search_query_string):
    """
    we can cheat with the indexing, but this has to be a full re-implementation
    of mapreduce functions on the javascript side. Woo.
    """
    search_query_terms = process_query_string(search_query_string)
    map_js = Code("function() { mft.get('search')._searchMapExt(this) }")
    reduce_js = Code("function(k, v) { return mft.get('search')._searchReduce(k, v) }")
    scope =  {'search_terms': search_query_terms, 'coll_name': collection.name}
    #   lazily assuming "$all" (i.e. AND search) 
    query_obj = {'value._extracted_terms': {'$all': search_query_terms}}
    db = collection.database
    res = db[index_name(collection)].map_reduce(
      map_js, reduce_js, full_response=True, scope=scope, query=query_obj)
    db[res['result']].ensure_index([('value.score', pymongo.ASCENDING)]) # can't demand backgrounding in python seemingly?
    return res

def map_reduce_nice_search_by_query(collection, search_query_string, query_obj=None):
    """
    Yep, this also ahs to be a re-implementation of the javascript function.
    """
    
    id_list = collection.find(query_obj, {_id: pymongo.ASCENDING}) if query_obj else None
    return map_reduce_nice_search_by_ids(collection, search_query_string, id_list)


def map_reduce_nice_search_by_ids(collection, search_query_string, id_list):
    raw_search_results = map_reduce_search(collection, search_query_string)
    search_coll_name = raw_search_results['result']
    
    map_js = Code("function() { mft.get('search')._niceSearchMapExt(this) }")
    reduce_js = Code("function(k, v) { return mft.get('search')._niceSearchReduce(k, v) }")
    scope =  {'coll_name': collection.name}
    db = collection.database
    query_obj = {'_id': {'$in': id_list}} if id_list is not None else {}
    sorting = {'value.score': pymongo.ASCENDING}
    res_coll = db[search_coll_name].map_reduce(map_js, reduce_js, 
        query=query_obj, scope=scope, sort=sorting)
    res_coll.ensure_index([('value.score', pymongo.ASCENDING)])
    return res_coll.find().sort([('value.score', pymongo.DESCENDING)])

def map_reduce_nice_search(collection, search_query_string):
    return map_reduce_nice_search_by_ids(collection, search_query_string, None)
    
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