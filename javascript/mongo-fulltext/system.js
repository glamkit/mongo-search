"use strict";

mft = {
  // CONFIG ITEMS:

  STEMMING: 'porter', // doesn't do anything yet
  TOKENIZING: 'basic',// doesn't do anything yet

  EXTRACTED_TERMS_FIELD: '_extracted_terms',
  SEARCH_ALL_PSEUDO_FIELD: '$search', // magic "field name" that specifies we want a fulltext search 
            // (abusing the '$' notation somewhat, which is often for search operators)
  SEARCH_ANY_PSEUDO_FIELD: '$searchany', // magic "field name" that specifies we want a fulltext search matching any, not all
  
  // WORKHORSE VARS:
  _STEM_FUNCTION: null,
  _TOKENIZE_FUNCTION: null
};

mft.indexedFieldsAndWeights = function(coll_name) {
  // we expect a special collection named '_fulltext_config', with items having elems 'collection_name', and 'fields',
  // with 'fields' having keys being the field name, and the values being the weight.
  //eg:
      // {
      //   collection_name: 'test', 
      //   fields: {
      //     title: 5,
      //     content: 1
      //   }
      // }
  
  //> fc = {collection_name: 'gallery_collection_items', fields: {'title': 10, 'further_information': 1}}// 
  // {
  //         "collection_name" : "gallery_collection_items",
  //         "fields" : {
  //                 "title" : 10,
  //                 "further_information" : 1
  //         }
  // }
  // > db.fulltext_config.save(fc)
  // >
  
  collection_conf = db.fulltext_config.findOne({collection_name: coll_name});
  return collection_conf.fields;
};

mft.search = function(coll_name, query_obj) {
  // check for $search member on query_obj
  // if it doesn't exist, pass through to regular .find
  // if it does, parse the ft query string, and add the appropriate filter
  // clause to the non-ft-search components, execute that, then
  // score every remaining document, and put those sorted IDs and scores in a record in 
  // a private collection (hashed by the whole query obj, which we can check next time around)
  // then iterate through the IDs and scores and return the corrpesponding records with the IDs
  // attached to them, in a way that emulates a cursor object.
  var search_query_string;
  var require_all;
  if (query_obj[mft.SEARCH_ALL_PSEUDO_FIELD]) {
    search_query_string = query_obj[mft.SEARCH_ALL_PSEUDO_FIELD];
    require_all = true;
  } else if (query_obj[mft.SEARCH_ALL_PSEUDO_FIELD]) {
    search_query_string = query_obj[mft.SEARCH_ANY_PSEUDO_FIELD];
    require_all = false;
  } else {
    return db[coll_name].find(query_obj); // no need to call search, you chump
  }
  print("DEBUG: query string is " + search_query_string);
  var query_terms = mft.processQueryString(search_query_string);
  print("DEBUG: query terms is " + (query_terms.join(',') + " with length " + query_terms.length));
  query_obj[mft.EXTRACTED_TERMS_FIELD] = mft.filterArg(coll_name, query_terms, require_all);
  if (require_all) {
    delete(query_obj[mft.SEARCH_ALL_PSEUDO_FIELD]); // need to get rid f pseudo args, as they stop .find() from returning anything
  } else {
    delete(query_obj[mft.SEARCH_ANY_PSEUDO_FIELD]);
  }
  print("DEBUG: query_obj=" + tojson(query_obj));
  var filtered = db[coll_name].find(query_obj);
  var scores_and_ids = Array();
  print("DEBUG: num recs found: " + filtered.count());
  filtered.forEach(
    function(record) {
      var score = mft.scoreRecordAgainstQuery(coll_name, record, query_terms);
      scores_and_ids.push([score, record._id]);
    });
  return new mft.SearchPseudoCursor(coll_name, scores_and_ids);
  // scores_and_ids.sort(mft.sortNumericFirstDescending); // need to provide a custom search function anyway, as JS does sorts alphabetically
  // var scored_records = Array();
  // // this is the dodgy way - need to do a cursor in the future
  // for (var i = 0; i < scores_and_ids.length; i++) {
  //   var score_and_id = scores_and_ids[i];
  //   record = db[coll_name].findOne({_id: score_and_id[1]});
  //   record.score = score_and_id[0];
  //   scored_records.push(record);
  // }
  // return scored_records;
};

mft.sortNumericFirstDescending = function(a, b) {
  return b[0] - a[0];
};

mft.scoreRecordAgainstQuery = function(coll_name, record, query_terms) {
  var record_terms = record[mft.EXTRACTED_TERMS_FIELD];
  print("DEBUG: record=" + record);
  var query_terms_set = {};
  var score = 0.0;
  for (var i = 0; i < query_terms.length; i++) {
    query_terms_set[query_terms[i]] = true; // to avoid needing to iterate
  }
  print("DEBUG: query_terms_set=" + tojson(query_terms_set));
  var idf_cache = {};
  var record_vec_sum_sq = 0;
  for (var j = 0; j < record_terms.length; j++) {
    var term = record_terms[j];
    var term_idf = idf_cache[term];
    if (term_idf === undefined) {
      term_idf = mft.getTermIdf(coll_name, term);
      idf_cache[term] = term_idf;
    }
    if (term in query_terms_set) {
      score += term_idf;
    }
    record_vec_sum_sq += term_idf * term_idf;
  }
  return score/Math.sqrt(record_vec_sum_sq);
  // for cosine similarity, we normalize the document vector against the sqrt of the sums of the sqares of all term
  // we also haven't divided by the magnitude of the query vector, but that is constant across docs
  // could probably take some shortcuts here w/o too much loss of accuracy
};

mft.calcTermIdf = function(coll_name, term) {
  // this currently doesn't have any caching smarts.
  // we could cache the IDF for each doc in the collection, but that would make updating more complicated
  // for the moment I'll gamble on mongodb being quick enough to make it not a problem
  // 
  var term_filter_obj = {};
  term_filter_obj[mft.EXTRACTED_TERMS_FIELD] = mft.filterArg(coll_name, [term], true);
  var term_count = db[coll_name].find(term_filter_obj).count();
  if (term_count === 0) { return 0.0; }
  var num_docs = db[coll_name].find().count(); // TODO: memoize, or find a better method for getting this
  return Math.log(num_docs) - Math.log(term_count);
};

mft.getTermIdf = function(coll_name, term) {
  var score_record = db.fulltext_term_scores.findOne({collection_name: coll_name, term: term});
  print("DEBUG: score_record=" + tojson(score_record));
  if (score_record === null) {
    print("WARNING: no score cached for term " + term);
    return 0.0;
  } else {
    if (score_record.dirty) {
      print("WARNING: score for term " + term + " may be incorrect");
    }
    return score_record.score;
  }
};

mft.calcAndStoreTermIdf = function(coll_name, term) {
  idf_score = mft.calcTermIdf(coll_name, term);
  // print("DEBUG: calculated IDF for term " + term + " as " + idf_score);
  db.fulltext_term_scores.update({collection_name: coll_name, term: term}, {$set: {score: idf_score, dirty: false}}, {upsert: true});
};

mft.storeEmptyTermIdf = function(coll_name, term) {
  // adds the term into the index if it's not already there, but marks it as dirty
  db.fulltext_term_scores.update({collection_name: coll_name, term: term}, {$set: {dirty: true}}, {upsert: true});
};

mft.filterArg = function(coll_name, query_terms, require_all) {
  if (require_all === undefined) {
    require_all = true;
  }
  var filter_obj = {};
  filter_obj[require_all ? '$all' : '$in'] = query_terms;
  return filter_obj;
};

mft.processQueryString = function(query_string) {
  return mft.stemAndTokenize(query_string); // maybe tokenizing should be different for queries?
};

mft.indexAll = function(coll_name) {
  print("DEBUG: indexing all records in " + coll_name);
  var cur = db[coll_name].find();
  indexed_fields = mft.indexedFieldsAndWeights(coll_name);
  print("DEBUG: indexed fields and weights: " + tojson(indexed_fields));
  recs_indexed = 0;
  mft.checkTermScoreIndex(coll_name);
  cur.forEach(function(x) { 
    mft.indexSingleRecord(coll_name, x, indexed_fields, false); 
    recs_indexed++;
    if (recs_indexed % 100 === 0) {
      print(recs_indexed);
    }
  });
  mft.checkExtractedTermIndex(coll_name); // maybe delete this before populating to make it quicker?
  print("Calculating IDF scores");
  mft.fillDirtyIdfScores(coll_name);
};

mft.checkTermScoreIndex = function(coll_name) {
  db.fulltext_term_scores.ensureIndex({collection_name: 1, term: 1});
};

mft.checkExtractedTermIndex = function(coll_name) {
  ext_terms_idx_criteria = Array();
  ext_terms_idx_criteria[mft.EXTRACTED_TERMS_FIELD] = 1;
  db[coll_name].ensureIndex(ext_terms_idx_criteria);
};

mft.indexSingleRecord = function(coll_name, record, indexed_fields, calculate_idf) {
  if (typeof indexed_fields === 'undefined') {// we can pass this in to save CPU in bulk indexing, but might not
    indexed_fields = mft.indexedFieldsAndWeights(coll_name);
  }
  if (typeof calculate_idf === 'undefined') {
    calculate_idf = true; // assume we're just indexing this one doc - so we probably want to cal at the time
  }
  var all_extracted_terms = Array();
  for (var field in indexed_fields) {
    all_extracted_terms = all_extracted_terms.concat(mft.extractFieldTokens(coll_name, record, field, indexed_fields[field]));
  }
  record[mft.EXTRACTED_TERMS_FIELD] = all_extracted_terms;
  // print("DEBUG: record is now: " + tojson(record));
  db[coll_name].save(record);
  if (calculate_idf) { // if we're doing just one doc
    all_extracted_terms.forEach(function(x) {mft.calcAndStoreTermIdf(coll_name, x);});
  } else { // we're doing it in bulk, so defer calcs until later
    all_extracted_terms.forEach(function(x) {mft.storeEmptyTermIdf(coll_name, x);});
  }
};

mft.indexSingleRecordFromId = function(coll_name, record_id) {
  var rec = db[coll_name].findOne({'_id': record_id});
  mft.indexSingleRecord(coll_name, rec);
};

mft.fillDirtyIdfScores = function(coll_name) {
  mft.checkExtractedTermIndex(coll_name);
  var cur = db.fulltext_term_scores.find({collection_name: coll_name, dirty: true});
  cur.forEach( function(x) { mft.calcAndStoreTermIdf(coll_name, x.term); });
};

mft.extractFieldTokens = function(coll_name, record, field, upweighting) {
  // extracts tokens in stemmed and tokenised form and upweights them as specified in the config if necessary
  var contents = record[field];
  if (typeof contents == 'object') {
    contents = contents.join(" ");
  }
  if (!contents) { // eg the field doesn't exist on this particular record, we silently fail
    return;
  }
  var processed_contents = mft.stemAndTokenize(contents);
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

mft.stemAndTokenize = function(field_contents) {
  return mft.stem(mft.tokenize(field_contents.toLowerCase())); //TODO: actually stem as promised
};

mft.tokenizeBasic = function(field_contents) {
  var token_re = /\b(\w[\w'-]*\w|\w)\b/g;
  return field_contents.match(token_re);
};

mft.stem = function(field_tokens) {
  var stem_fn = mft.getStemFunction();
  var stemmed = Array();
  for (var i = 0; i < field_tokens.length; i++) {
    stemmed.push(stem_fn(field_tokens[i]));
  }
  return stemmed;
};

mft.tokenize = function(field_contents) {
  var tokenize_fn = mft.getTokenizeFunction();
  return tokenize_fn(field_contents);
};

mft.getStemFunction = function() {
  if (mft._STEM_FUNCTION) {
    return mft._STEM_FUNCTION;
  } else {
    if (mft.STEMMING == 'porter') { // no others available
      return (mft._STEM_FUNCTION = mft_stemming.porterStemmerCreator()); // porterStemmer() returns a porter stemming fn when called
    }
  }
};

mft.getTokenizeFunction = function() {
  if (mft._TOKENIZE_FUNCTION) {
    return mft._TOKENIZE_FUNCTION;
  } else {
    if (mft.TOKENIZING == 'basic') { // no others available
      return (mft._TOKENIZE_FUNCTION = mft.tokenizeBasic);
    }
  }  
};

mft.SearchPseudoCursor = function(coll_name, scores_and_ids) {
  // class to vaguely efficiently act as a store for the the retrived records while not chewing up lots of
  // memory, and not taking lots of time to sort results we may not need - hence the heap
  this.coll_name = coll_name;
  var scores_and_ids_heap = new mft_heap.BinaryHeap(function(x) { return -x[0]; });
  // print("DEBUG: score functino running: " + scores_and_ids_heap.scoreFunction([[1, 2], [3,1]]);
  scores_and_ids.forEach( function(x) {
    scores_and_ids_heap.push(x); // in-place would be better, but let's leave that unless we think it would be useful
  });
  this.scores_and_ids_heap = scores_and_ids_heap;

  
  this.hasNext = function() {
    return this.scores_and_ids_heap.size() > 0;
  };
  
  this.next = function() {
    return this.fetchScoredRecord(this.scores_and_ids_heap.pop());
  };
  
  this.toArray = function() {
    output = [];
    while (this.hasNext()) {
      output.push(this.next());
    }
    return output;
  };
  
  this.fetchById = function(record_id) {
    return db[this.coll_name].findOne({_id: record_id});
  };
  
  this.fetchScoredRecord = function(score_and_id) {
    rec = this.fetchById(score_and_id[1]);
    rec.score = score_and_id[0];
    return rec;
  };

};






_all = {
  mft: mft
};
  