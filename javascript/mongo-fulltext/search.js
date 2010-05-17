"use strict";
// mft.DEBUG = true;
mft.WARNING = true;

var search = function (){
    var search = {
      // CONFIG ITEMS:
      // accessing these from the server requires several function calls;
      // they should probably be stored in a safely serialisable config object
      // that is stashed in the system.js collection (for server use) and
      // global scope locally (for client/testing use)
      //
      STEMMING: 'porter', // doesn't do anything yet
      TOKENIZING: 'basic',// doesn't do anything yet

      EXTRACTED_TERMS_FIELD: '_extracted_terms',
      INDEX_NAMESPACE: 'search_.indexes',
      RESULT_NAMESPACE: 'search_.results',
      TERM_SCORE_NAMESPACE: 'search_.termscores',
      SEARCH_ALL_PSEUDO_FIELD: '$search', // magic "field name" that specifies we want a fulltext search 
                // (abusing the '$' notation somewhat, which is often for search operators)
      SEARCH_ANY_PSEUDO_FIELD: '$searchany', // magic "field name" that specifies we want a fulltext search matching any, not all
      
      MIN_TERM_SCORE: 0.0, // threshold below which we don't add the score on - set to 0 to include all terms
      
      // WORKHORSE VARS:
      _STEM_FUNCTION: null,
      _TOKENIZE_FUNCTION: null
    };
    
    //
    // this function is designed to be called server side only,
    // by a mapreduce run. it should never be called manually
    //
    search._indexMap = function() {
        //note `this` is bound to a document from the db, not the namespace object
        mft.debug_print('executing indexMap with');        
        mft.debug_print(this);
        var search=mft.get('search');
        var res = {};
        for (var field in indexed_fields) {
            res = {};
            res[search.EXTRACTED_TERMS_FIELD] =  search.extractFieldTokens(
                this, field, indexed_fields[field]
            );
            emit(this._id, res);
        }
    };

    //
    // this function is designed to be called server side only,
    // by a mapreduce run. it should never be called manually
    //    
    search._indexReduce = function(key, valueArray) {
        mft.debug_print('executing indexReduce for key');        
        mft.debug_print(key);
        mft.debug_print('and values');        
        mft.debug_print(valueArray);
        var extracted_terms_field = mft.get('search').EXTRACTED_TERMS_FIELD;
        var all_words_array = [];
        valueArray.forEach(function(doc) {
          all_words_array = all_words_array.concat(
              doc[extracted_terms_field] || []
          );
        });
        var doc = {};
        doc[extracted_terms_field] = all_words_array;
        return doc;
    };
    
    //
    // This JS function should never be called, except from javascript
    // clients. See note at search.mapReduceSearch
    //
    search.mapReduceIndex = function(coll_name) {
        // full_text_index a given coll
        var search = mft.get('search'); //not guaranteed to have been done!
        var index_coll_name = search.indexName(coll_name);
        mft.debug_print(index_coll_name, "index_coll_name");
        var res = db.runCommand(
          { mapreduce : coll_name,
            map : search._indexMap,
            reduce : search._indexReduce,
            out : index_coll_name,
            verbose : true,
            scope: {
                indexed_fields: search.indexedFieldsAndWeights(coll_name)
            }
         }
        );
        var indexes_required = {};
        indexes_required[("value." + search.EXTRACTED_TERMS_FIELD)] =1;
        db[index_coll_name].ensureIndex(
            indexes_required,
            {background:true}
        );
        mft.debug_print(res);
    };
    
    
    
    search._termScoreMap = function() {
      var search = mft.get('search');
      mft.debug_print("Executing _termScoreMap with:");
      mft.debug_print(this);
      emitted_terms = {};
      this.value[search.EXTRACTED_TERMS_FIELD].forEach( function(term) {
        if (! (term in emitted_terms)) { // don't want duplicates for any term in a doc
          emitted_terms[term] = true;
          emit(term, 1);
        }
      });
    };
    
    search._termScoreReduce = function(key, valueArray) {
      var sum = 0;
      mft.debug_print("Executing _termScoreReduce with key:");
      mft.debug_print(key);
      mft.debug_print("and value:");
      mft.debug_print(valueArray);
      valueArray.forEach(function(x) {
        sum += x;
      });
      mft.debug_print("returning:");      
      mft.debug_print(sum);
      return sum;
    };
    
    search._termScoreFinalize = function(key, termSum) {
      mft.debug_print("Executing _termScoreFinalize with key:");
      mft.debug_print(key);
      mft.debug_print("and value:");
      mft.debug_print(termSum);
      mft.debug_print(num_docs_in_coll, "num_docs_in_coll");
      return Math.log(num_docs_in_coll) - Math.log(termSum);
    };


    //
    // This JS function should never be called, except from javascript
    // clients. See note at search.mapReduceSearch
    //
    search.mapReduceTermScore = function(coll_name) {
        // full_text_index a given coll
        var search = mft.get('search'); //not guaranteed to have been done!
        var index_coll_name = search.indexName(coll_name);
        var term_score_name = search.termScoreName(coll_name);
        mft.debug_print(index_coll_name, "index_coll_name");
        mft.debug_print(term_score_name, "term_score_name");
        var res = db.runCommand(
          { mapreduce : index_coll_name,
            map : search._termScoreMap,
            reduce : search._termScoreReduce,
            finalize: search._termScoreFinalize,
            out : term_score_name,
            verbose : true,
            scope: {
                num_docs_in_coll: db[coll_name].find().count()
            }
         }
        );
        mft.debug_print(res);
    };



    
    //
    // this function is designed to be called server side only,
    // by a mapreduce run. it should never be called manually
    //
    search._searchMap = function() {
        mft.debug_print("in searchMap with doc: ");
        mft.debug_print(this);
        mft.debug_print("and search terms: ");
        mft.debug_print(search_terms);
        var search = mft.get('search');
        var score = search.scoreRecordAgainstQuery(this, search_terms);
        // potential optimisation: don't return very low scores
        emit(this._id, score);
    };
    
    //
    // this function is designed to be called server side only,
    // by a mapreduce run. it should never be called manually
    //
    search._searchReduce = function(key, valueArray) {
        // once again, nearly trivial reduce in our case, since record _ids here map onto record _ids proper 1:1
        //
        return valueArray[0];
    };
    
    //
    // This JS function should never be called (except from javascript
    // clients)
    // for e.g. a python application you'll have to reimplement it in python
    // since you want to call the mapreduce "naked" rather than from db.eval
    // since
    // 1) db.eval javascript execution is blocking, and
    // 2) mapreduce isn't supported from db.eval 
    // as such, this is a "reference implementation", and a testing one
    //
    search.mapReduceSearch = function(coll_name, search_query_string, keep_results) {
        // searches a given coll's index
        // return a coll name containing the sorted results - permanent
        // nicely named if keep_results is true
        //
        var search = mft.get('search');
        var search_query_terms = search.processQueryString(search_query_string);
        mft.debug_print("searching using: ");
        mft.debug_print(search_query_terms);
        var index_coll_name = search.indexName(coll_name);
        var params = { mapreduce : index_coll_name,
            map : search._searchMap,
            reduce : search._searchReduce,
            // this is a filter to ignore objects without the right term in the index - generated in a moment...
            query : {},
            // if we wish to keep these results around we'll need to specify a coll name
            // out : "searchfun",
            scope : {search_terms: search_query_terms, coll_name: coll_name},
            verbose : true
        };
        
        // note that I've lazily assumed "$all" (i.e. AND search) here,
        // rather than "$any" (OR). Since premature generalisation leads
        // to herpes. 
        params.query[("value."+search.EXTRACTED_TERMS_FIELD)] = { $all: search_query_terms };
        
        if (keep_results) {
            params.out = search.resultName(coll_name, search_query_terms);
        }
        
        var res = db.runCommand(params);
        mft.debug_print(res);
        
        // this is  a disposable collection, which means reads:writes are
        // in a 1:1 ratio, so indexing it may be pointless, performance-wise
        // however it may only be sorted WITHOUT an index if it is less than
        // 4 megabytes - see http://www.mongodb.org/display/DOCS/Indexes#Indexes-Using%7B%7Bsort%28%29%7D%7DwithoutanIndex
        db[res.result].ensureIndex(
            {"value.score": 1},
            {background:true}
        );
        return res;
    };

    //
    // this function is designed to be called server side only,
    // by a mapreduce run. it should never be called manually
    //
    search._niceSearchMap = function() {
        mft.debug_print(this, "in _niceSearchMap with doc: ");
        mft.debug_print(coll_name, "and coll_name");
        var doc = db[coll_name].findOne({_id: this._id});
        doc.score = this.value;
        emit(this._id, doc);
    };

    //
    // this function is designed to be called server side only,
    // by a mapreduce run. it should never be called manually
    //
    search._niceSearchReduce = function(key, valueArray) {
        // once again, trivial reduce in our case, since record _ids here map onto record _ids proper 1:1
        //
        return valueArray[0];
    };

    //
    // This JS function should never be called, except from javascript
    // clients. See note at search.mapReduceSearch
    // 
    search.mapReduceNiceSearch = function(coll_name, search_coll_name, query_obj) {
        // takes a search collection and a query dict and returns a temporary
        // coll worth of results including whole records.
        // different from the mapReduceSearch in that it 
        // 1) returns whole records, not just ranks
        // 2) can limit results by other criteria than fulltext search
        //
        var search = mft.get('search');
        mft.debug_print(coll_name, 'coll_name');
        mft.debug_print(search_coll_name, 'search_coll_name');
        mft.debug_print(query_obj, 'query_obj');
        
        var params = { mapreduce : search_coll_name,
            map : search._niceSearchMap,
            reduce : search._niceSearchReduce,
            sort : {"value.score": 1},
            scope : {coll_name: coll_name},
            verbose : true
        };
        
        var id_list ;
        if (query_obj) {
            id_list = db[coll_name].find(query_obj, {_id: 1});
            params.query = {_id: {$in: id_list}};
        }
        mft.debug_print(id_list, 'id_list');

        var res = db.runCommand(params);
        mft.debug_print(res);

        // this is  a disposable collection, which means reads:writes are
        // in a 1:1 ratio, so indexing it may be pointless, performance-wise
        // however it may only be sorted WITHOUT an index if it is less than
        // 4 megabytes - see http://www.mongodb.org/display/DOCS/Indexes#Indexes-Using%7B%7Bsort%28%29%7D%7DwithoutanIndex
        // but DOES it need to be sorted is the question?
        //
        db[res.result].ensureIndex(
            {"value.score": 1},
            {background:true}
        );
        return db[res.result].find().sort({"value.score": -1});
    };
    
    //generate a coll name for a collection index
    search.indexName = function(coll_name) {
        //calculate the collection name for the index of a given collection
        var search = mft.get('search');
        return search.INDEX_NAMESPACE + "." + coll_name ;
    };
    //generate a coll for some search results (if we wish to stash them)
    search.resultName = function(coll_name, search_terms) {
        //calculate the collection name for the index of a given collection
        var search = mft.get('search');
        return search.RESULT_NAMESPACE + "." + coll_name +  "." + search.encodeQueryString(search_terms);
    };
    
    search.termScoreName = function(coll_name) {
        //calculate the collection name for the term scores (probably IDF) of a given collection
        var search = mft.get('search');
        return search.TERM_SCORE_NAMESPACE + "." + coll_name;
    };
        
    search.indexedFieldsAndWeights = function(coll_name) {
      // we expect a special collection named 'fulltext_config', with items having elems 'collection_name', 'fields', and 'params'
      // with 'fields' having keys being the field name, and the values being the weight. e.g.:  
      //> fc = {collection_name: 'gallery_collection_items', fields: {'title': 10, 'further_information': 1}}// 
      // {
      //         "collection_name" : "gallery_collection_items",
      //         "fields" : {
      //                 "title" : 10,
      //                 "further_information" : 1
      //         }
      //         "params": {
      //            "full_vector_norm": 0
      //        }
      // }
      // > db.fulltext_config.save(fc)
      // >
      // full_vector_norm is whether to calculate all the doc vector components and normalise properly, or just guess that they're 1
        // saves time if we don't have precomputed vectors, but doesn't get quite the same results
      collection_conf = db.fulltext_config.findOne({collection_name: coll_name});
      return collection_conf.fields;
    };

    
    search.getParams = function(coll_name) {
      collection_conf = db.fulltext_config.findOne({collection_name: coll_name});
      mft.debug_print("retrieved config: " + tojson(collection_conf));
      return collection_conf.params;
    };
    
    
    search.scoreRecordAgainstQuery = function(record, query_terms) {
      mft.debug_print("in scoreRecordAgainstQuery with coll_name: ");
      mft.debug_print(coll_name);
      mft.debug_print("and record: ");
      mft.debug_print(record);
      var search = mft.get("search");
      var record_terms = record.value[search.EXTRACTED_TERMS_FIELD];
      var query_terms_set = {};
      var score = 0.0;
      for (var i = 0; i < query_terms.length; i++) {
        query_terms_set[query_terms[i]] = true; // to avoid needing to iterate
      }
      mft.debug_print("query_terms_set=" + tojson(query_terms_set));
      
      if (typeof idf_cache === 'undefined') {
        idf_cache = {}
      }
      var record_vec_sum_sq = 0;
      mft.debug_print("getParams");
      mft.debug_print(search.getParams(coll_name));
      var full_vector_norm = 1;
      var getCachedTermIdf = function(x) {
        var term_idf = idf_cache[term];
        if (term_idf === undefined) {
          term_idf = search.getTermIdf(coll_name, term);
          idf_cache[term] = term_idf;
        }
        return term_idf;
      };
      for (var j = 0; j < record_terms.length; j++) {
        var term = record_terms[j];
        mft.debug_print(term, "scoring term");
        var term_in_query = (term in query_terms_set);
        var term_idf = 0;
        if (term_in_query || full_vector_norm) {
          term_idf = getCachedTermIdf(term);
          mft.debug_print(term_idf, "term_idf");
        }
        if (term_in_query) {
          score += term_idf;
        }
        record_vec_sum_sq += full_vector_norm ? term_idf * term_idf : 1.0;
      }
      return score/Math.sqrt(record_vec_sum_sq);
      // for cosine similarity, we normalize the document vector against the sqrt of the sums of the sqares of all term
      // we also haven't divided by the magnitude of the query vector, but that is constant across docs
      // could probably take some shortcuts here w/o too much loss of accuracy
    };

    search.getTermIdf = function(coll_name, term) {
      var search = mft.get("search");
      var score_record = db[search.termScoreName(coll_name)].findOne({_id: term});
      mft.debug_print(search.termScoreName(coll_name), "term_score_coll_name");
      mft.debug_print(term, "term");
      mft.debug_print(score_record, "score_record");
      if (score_record === null) {
        mft.warning_print("no score cached for term " + term);
        return 0.0;
      } else {
        var score = score_record.value
        return score > search.MIN_TERM_SCORE ? score : 0.0;
      }
    };

    search.filterArg = function(coll_name, query_terms, require_all) {
      
      if (require_all === undefined) {
        require_all = true;
      }
      var filter_obj = {};
      filter_obj[require_all ? '$all' : '$in'] = query_terms;
      return filter_obj;
    };
    
    // this needs to be implemented client-side
    search.processQueryString = function(query_string) {
        var normalised_query = search.stemAndTokenize(query_string);
        normalised_query.sort();
        return normalised_query; // maybe tokenizing should be different for queries?
    };
    
    // this needs to be implemented client-side
    search.encodeQueryString = function(processed_query_string) {
        return processed_query_string.join('__');
    };

    search.extractFieldTokens = function(record, field, upweighting) {
      // extracts tokens in stemmed and tokenised form and upweights them as specified in the config if necessary
      var contents = record[field];
      if (!contents) { // eg the field doesn't exist on this particular record, we silently fail
        return;
      }
      if (typeof contents == 'object') {
        contents = contents.join(" ");
      }
      var processed_contents = search.stemAndTokenize(contents);  
      if (upweighting == 1) { // special -casing for the common case - may be slightly quicker avoiding the array copy
        return processed_contents;
      } else {
        var upweighted_contents = processed_contents;
        for (var i = 1; i < upweighting; i++) {
          upweighted_contents = upweighted_contents.concat(processed_contents);
        }
        return upweighted_contents; // this upweighting shouldn't damage our scores as long as we TF IDF, since IDF won't be affect by linear multipliers
      }
    };
    
    
    search.stemAndTokenize = function(field_contents) {
      mft.debug_print("stem'n'tokenising: ");
      mft.debug_print(field_contents);
      return search.stem(search.tokenize(field_contents.toLowerCase())); //TODO: actually stem as promised
    };

    search.tokenizeBasic = function(field_contents) {
      
      var token_re = /\b(\w[\w'-]*\w|\w)\b/g;
      return field_contents.match(token_re);
    };
    
    
    search.stem = function(field_tokens) {
        
      var stem_fn = search.getStemFunction();
      var stemmed = [];
      for (var i = 0; i < field_tokens.length; i++) {
        stemmed.push(stem_fn(field_tokens[i]));
      }
      return stemmed;
    };

    search.tokenize = function(field_contents) {
      
      var tokenize_fn = search.getTokenizeFunction();
      return tokenize_fn(field_contents);
    };

    search.getStemFunction = function() {
      
      if (search._STEM_FUNCTION) {
        return search._STEM_FUNCTION;
      } else {
        if (search.STEMMING == 'porter') { // no others available
          //slightly weird invocation here to preserve consistency - get returns
          //a constructor function always
          var stemmer = null;
          stemmer = mft.get('PorterStemmer');
          return (search._STEM_FUNCTION = new stemmer()); 
        } else {
          throw "Invalid stemming function " + tojson(search.STEMMING);
        }
      }
    };

    search.getTokenizeFunction = function() {
      
      if (search._TOKENIZE_FUNCTION) {
        return search._TOKENIZE_FUNCTION;
      } else {
        if (search.TOKENIZING == 'basic') { // no others available
          return (search._TOKENIZE_FUNCTION = search.tokenizeBasic);
        }
      }  
    };
    return search;
};

_all = {
  search: search
};
  