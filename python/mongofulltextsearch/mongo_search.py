# −*− coding: UTF−8 −*−
"""
This is the python wrapper to the mongo full text search javascript. As such it
has to implement OR CALL all the mapreduce invocations in the javascript
library, plus anything else that we do not wish to block the server upon
executing. That is:

search.mapReduceIndex
search.mapReduceSearch
search.mapReduceNiceSearch
search.stemAndTokenize (and thus search.stem and search.tokenizeBasic )

Optional (if you don't mind calling blocking execution server-wide)
search.processQueryString
search.encodeQueryString
"""
import pymongo
import util

def map_reduce_index(collection):
    return util.exec_js_from_string(
      "mft.get('search').mapReduceIndexTheLot('%s');" % collection.name,
      collection.database)

def map_reduce_search(collection, search_query_string):
    db.things.map_reduce(map, reduce, full_response=True)

def map_reduce_nice_search_by_query(collection, search_coll_name, query_obj):
    pass

def map_reduce_nice_search_by_ids(collection, search_coll_name, id_list):
    pass
    
def stem_and_tokenize(phrase):
    pass

def stem(word):
    pass

def tokenize(phrase):
    pass