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

def index():
    pass