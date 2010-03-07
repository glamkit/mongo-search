"use strict";

mft = {
  // CONFIG ITEMS:
  INDEXED_FIELDS_AND_WEIGHTS : {
    'items':  {
        'title': 5,
        'content': 1
    }
  },

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
  var query_terms = mft.process_query_string(search_query_string);
  print("DEBUG: query terms is " + (query_terms.join(',') + " with length " + query_terms.length));
  query_obj[mft.EXTRACTED_TERMS_FIELD] = mft.filter_arg(coll_name, query_terms, require_all);
  print("DEBUG: query_obj=" + tojson(query_obj));
  var filtered = db[coll_name].find(query_obj);
  var scores_and_ids = Array();
  print("DEBUG: num recs found: " + filtered.count());
  filtered.forEach(
    function(record) {
      var score = mft.score_record_against_query(coll_name, record, query_terms);
      scores_and_ids.push([score, record._id]);
    });
  scores_and_ids.sort();
  var scored_records = Array();
  // this is the dodgy way - need to do a cursor in the future
  for (var i = 0; i < scores_and_ids.length; i++) {
    var score_and_id = scores_and_ids[i];
    record = db[coll_name].find_one({_id: score_and_id[1]});
    record.score = score_and_id[0];
    scored_records.push(record);
  }
  return scored_records;
};

mft.score_record_against_query = function(coll_name, record, query_terms) {
  var record_terms = record[mft.EXTRACTED_TERMS_FIELD];
  print("DEBUG: record=" + record);
  var query_terms_set = {};
  var score = 0.0;
  for (var i = 0; i < query_terms.length; i++) {
    query_terms_set[query_terms[i]] = true; // to avoid needing to iterate
  }
  print("DEBUG: query_terms_set=" + tojson(query_terms_set));
  var idf_cache = {};
  for (var j = 0; j < record_terms.length; j++) {
    var term = record_terms[j];
    if (term in query_terms_set) {
      var term_idf = idf_cache[term];
      if (term_idf === undefined) {
        term_idf = mft.get_term_idf(coll_name, term);
        idf_cache[term] = term_idf;
      }
    }
    score += term_idf;
  }
  return score/Math.sqrt(record_terms.length);
  // for cosine similarity, we should be normalizing the document vector against the sqrt of the sums of the sqares of all term
  // but that would require knowing the IDF scores of all terms, rather than just the ones in the query which is potentially
  // expensive unless we precompute (either the IDFs or normalized vector for each doc). 
  /// However that would make updating the index a much bigger can of worms.
  // This should provide a nice approximation that will give decent results at least relative to the query, which is all we care about.
};

mft.get_term_idf = function(coll_name, term) {
  // this currently doesn't have any caching smarts.
  // we could cache the IDF for each doc in the collection, but that would make updating more complicated
  // for the moment I'll gamble on mongodb being quick enough to make it not a problem
  // 
  var term_count = db[coll_name].find(mft.filter_arg(coll_name, [term], true)).count();
  if (term_count === 0) { return 0.0; }
  var num_docs = db[coll_name].find().count(); // TODO: memoize, or find a better method for getting this
  return Math.log(num_docs) - Math.log(term_count);
};

mft.filter_arg = function(coll_name, query_terms, require_all) {
  if (require_all === undefined) {
    require_all = true;
  }
  var filter_obj = {};
  filter_obj[require_all ? '$all' : '$in'] = query_terms;
  return filter_obj;
};

mft.process_query_string = function(query_string) {
  return mft.stem_and_tokenize(query_string); // maybe tokenizing should be different for queries?
};

mft.index_all = function(coll_name) {
  print("DEBUG: indexing all records");
  var cur = db.coll_name.find();
  cur.forEach(function(x) { mft.index_single_record(coll_name, x); });
};

mft.index_single_record = function(coll_name, record) {
  var all_extracted_terms = Array();
  for (var field in mft.INDEXED_FIELDS_AND_WEIGHTS[coll_name]) {
    all_extracted_terms = all_extracted_terms.concat(mft.extract_field_tokens(coll_name, record, field));
  }
  record[mft.EXTRACTED_TERMS_FIELD] = all_extracted_terms;
  db[coll_name].save(record);
};

mft.index_single_record_from_id = function(coll_name, record_id) {
  var rec = db[coll_name].findOne({'_id': record_id});
  mft.index_single_record(coll_name, rec);
};

mft.extract_field_tokens = function(coll_name, record, field) {
  // extracts tokens in stemmed and tokenised form and upweights them as specified in the config if necessary
  var contents = record[field];
  if (!contents) { // eg the field doesn't exist on this particular record, we silently fail
    return;
  }
  var processed_contents = mft.stem_and_tokenize(contents);
  var upweighting = mft.INDEXED_FIELDS_AND_WEIGHTS[coll_name][field];
  if (upweighting == 1) { // special -casing for the common case - may be slightly quicker avoiding the array copy
    return processed_contents;
  } else {
    var upweighted_contents = processed_contents;
    for (var i = 1; i < upweighting; i++) {
      upweighted_contents.concat(processed_contents);
    }
    return upweighted_contents; // this upweighting shouldn't damage our scores as long as we TF IDF, since IDF won't be affect by linear multipliers
  }
};

mft.stem_and_tokenize = function(field_contents) {
  return field_contents.split(' ');
  return mft.tokenize(field_contents); //TODO: actually stem as promised
};

mft.tokenize_basic = function(field_contents) {
  var token_re = /\b(\w[\w'-]*\w|\w)\b/g;
  return field_contents.match(token_re);
};

mft.stem = function(field_tokens) {
  var stem_fn = mft.get_stem_function();
  var stemmed = Array();
  for (var i = 0; i < field_tokens.length; i++) {
    stemmed.push(stem_fn(field_tokens[i]));
  }
  return stemmed;
};

mft.tokenize = function(field_contents) {
  var tokenize_fn = mft.get_tokenize_function();
  return tokenize_fn(field_contents);
};

mft.get_stem_function = function() {
  if (mft._STEM_FUNCTION) {
    return mft._STEM_FUNCTION;
  } else {
    if (mft.STEMMING == 'porter') { // no others available
      return (mft._STEM_FUNCTION = mft_stemming.porterStemmer);
    }
  }
};

mft.get_tokenize_function = function() {
  if (mft._TOKENIZE_FUNCTION) {
    return mft._TOKENIZE_FUNCTION;
  } else {
    if (mft.TOKENIZING == 'basic') { // no others available
      return (mft._TOKENIZE_FUNCTION = mft.tokenize_basic);
    }
  }  
};

_all = {
  mft: mft
};
  