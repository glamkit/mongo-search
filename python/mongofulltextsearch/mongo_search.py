# −*− coding: UTF−8 −*−
"""
This is the python wrapper to the mongo full text search javascript.
As such it has to implement all the mapreduce invocations in the javascript
library, plus anything else that we do not wish to block the server upon
executing. That is:

search.mapReduceIndex
search.mapReduceSearch
search.mapReduceNiceSearch
search.stemAndTokenize (and thus search.stem and search.tokenizeBasic )

Optional:
search.processQueryString
search.encodeQueryString
"""
import pymongo

def map_reduce_index(coll_name):
    db.things.map_reduce(map, reduce, full_response=True)

def map_reduce_search(coll_name, search_query_string):
    pass

def map_reduce_nice_search_by_query(coll_name, search_coll_name, query_obj):
    pass

def map_reduce_nice_search_by_ids(coll_name, search_coll_name, id_list):
    pass
    
def stem_and_tokenize(phrase):
    pass

def stem(word):
    pass

def tokenize(phrase):
    pass