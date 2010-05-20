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
    params = {
        'map': Code("function() { mft.get('search')._searchMap() }"),
        'reduce': Code("function(k, v) { mft.get('search')._searchReduce(k, v) }"),
        'scope': {'search_terms': search_query_terms, 'coll_name': collection.name},
        'full_response': True
    }
    
    #   lazily assuming "$all" (i.e. AND search) 
    params['query'] = {'value._extracted_terms': {'$all': search_query_terms}}
    db = collection.database
    res = db[index_name(collection)].map_reduce(**params)
    res_coll = pymongo.database.Collection(collection.database, res['result'])
    res_coll.ensure_index([('value.score', pymongo.ASCENDING)]) # can't demand backgrounding in python seemingly?
    return res_coll
    
    # search.mapReduceSearch = function(coll_name, search_query_string, keep_results) {
    #       // searches a given coll's index
    #       // return a coll name containing the sorted results - permanent
    #       // nicely named if keep_results is true
    #       //
    #       var search = mft.get('search');
    #       var search_query_terms = search.processQueryString(search_query_string);
    #       mft.debug_print("searching using: ");
    #       mft.debug_print(search_query_terms);
    #       var index_coll_name = search.indexName(coll_name);
    #       var params = { mapreduce : index_coll_name,
    #           map : search._searchMap,
    #           reduce : search._searchReduce,
    #           // this is a filter to ignore objects without the right term in the index - generated in a moment...
    #           query : {},
    #           // if we wish to keep these results around we'll need to specify a coll name
    #           // out : "searchfun",
    #           scope : {search_terms: search_query_terms, coll_name: coll_name},
    #           verbose : true
    #       };
    # 
    #       // note that I've lazily assumed "$all" (i.e. AND search) here,
    #       // rather than "$any" (OR). Since premature generalisation leads
    #       // to herpes. 
    #       params.query[("value."+search.EXTRACTED_TERMS_FIELD)] = { $all: search_query_terms };
    # 
    #       if (keep_results) {
    #           params.out = search.resultName(coll_name, search_query_terms);
    #       }
    # 
    #       var res = db.runCommand(params);
    #       mft.debug_print(res);
    # 
    #       // this is  a disposable collection, which means reads:writes are
    #       // in a 1:1 ratio, so indexing it may be pointless, performance-wise
    #       // however it may only be sorted WITHOUT an index if it is less than
    #       // 4 megabytes - see http://www.mongodb.org/display/DOCS/Indexes#Indexes-Using%7B%7Bsort%28%29%7D%7DwithoutanIndex
    #       db[res.result].ensureIndex(
    #           {"value.score": 1},
    #           {background:true}
    #       );
    #       return res;
    #   };

def map_reduce_nice_search_by_query(collection, search_coll_name, query_obj):
    """
    Yep, this also ahs to be a re-implementation of the javascript function.
    """
    pass
    # search.mapReduceNiceSearch = function(coll_name, search_coll_name, query_obj) {
    #     // takes a search collection and a query dict and returns a temporary
    #     // coll worth of results including whole records.
    #     // different from the mapReduceSearch in that it 
    #     // 1) returns whole records, not just ranks
    #     // 2) can limit results by other criteria than fulltext search
    #     //
    #     var search = mft.get('search');
    #     mft.debug_print(coll_name, 'coll_name');
    #     mft.debug_print(search_coll_name, 'search_coll_name');
    #     mft.debug_print(query_obj, 'query_obj');
    #     
    #     var params = { mapreduce : search_coll_name,
    #         map : search._niceSearchMap,
    #         reduce : search._niceSearchReduce,
    #         sort : {"value.score": 1},
    #         scope : {coll_name: coll_name},
    #         verbose : true
    #     };
    #     
    #     var id_list ;
    #     if (query_obj) {
    #         id_list = db[coll_name].find(query_obj, {_id: 1});
    #         params.query = {_id: {$in: id_list}};
    #     }
    #     mft.debug_print(id_list, 'id_list');
    # 
    #     var res = db.runCommand(params);
    #     mft.debug_print(res);
    # 
    #     // this is  a disposable collection, which means reads:writes are
    #     // in a 1:1 ratio, so indexing it may be pointless, performance-wise
    #     // however it may only be sorted WITHOUT an index if it is less than
    #     // 4 megabytes - see http://www.mongodb.org/display/DOCS/Indexes#Indexes-Using%7B%7Bsort%28%29%7D%7DwithoutanIndex
    #     // but DOES it need to be sorted is the question?
    #     //
    #     db[res.result].ensureIndex(
    #         {"value.score": 1},
    #         {background:true}
    #     );
    #     return db[res.result].find().sort({"value.score": -1});
    # };
    

def map_reduce_nice_search_by_ids(collection, search_coll_name, id_list):
    pass
    
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