
mft = {
  INDEXED_FIELDS_AND_WEIGHTS : {
    'items':  {
        'title': 5,
        'content': 1
    }
  },

  STEMMING: 'porter', // doesn't do anything yet
  TOKENIZING = 'standard',// doesn't do anything yet

  EXTRACTED_TERMS_FIELD = '_extracted_terms',
  SEARCH_ALL_PSEUDO_FIELD = '$search', // magic "field name" that specifies we want a fulltext search 
            // (abusing the '$' notation somewhat, which is often for search operators)
  SEARCH_ANY_PSEUDO_FIELD = '$searchany', // magic "field name" that specifies we want a fulltext search matching any, not all
}

mft.search: function(coll_name, query_obj) {  
  // check for $search member on query_obj
  // if it doesn't exist, pass through to regular .find
  // if it does, parse the ft query string, and add the appropriate filter
  // clause to the non-ft-search components, execute that, then
  // score every remaining document, and put those sorted IDs and scores in a record in 
  // a private collection (hashed by the whole query obj, which we can check next time around)
  // then iterate through the IDs and scores and return the corrpesponding records with the IDs
  // attached to them, in a way that emulates a cursor object.
  // what hsould this do?
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
  query_terms = mft.process_query_string(search_query_string);
  query_obj[mft.EXTRACTED_TERMS_FIELD] = mft.filter_arg(query_terms, require_all);
  filtered = db[coll_name].find(query_obj);
  scores_and_ids = Array();
  for (var i in filtered) {
    record = filtered[i];
    score = mft.score_record_against_query(record, query_terms);
    scores_and_ids.push([score, record._id])
  }
  scores_and_ids.sort();

  scored_records = Array();
  // this is the dodgy way - need to do a cursor in the future
  for (var i = 0; i < scores_and_ids.length; i++) {
    score_and_id = scores_and_ids[i];
    record = db[coll].find_one({_id: score_and_id[1]});
    record.score = score_and_id[0];
    scored_records.push(record);
  }
  return score_records;
};

mft.score_record_against_query: function(coll_name, record, query_terms) {
  var record_terms = record[mft.EXTRACTED_TERMS_FIELD];
  var query_terms_set = {};
  var score = 0.0;
  for (var i = 0; i < query_terms.length; i++) {
    query_terms_set[query_terms[i]] = true; // to avoid needing to iterate
  }
  var idf_cache = {};
  for (var i = 0; i < record_terms.length; i++) {
    var term = record_terms[i]
    if (term in query_terms_set) {
      var term_idf = idf_cache[term];
      if (term_idf === undefined) {
        term_idf = mft.get_term_idf(coll_name, term);
        idf_cache[term] = term_idf;
      }
    }
    score += term_idf;
  }
  return score/record_terms.length
  // for cosine similarity, we should be normalizing the document vector against the sqrt of the sums of the sqares of all term
  // but that would require knowing the IDF scores of all terms, rather than just the ones in the query which is potentially
  // expensive unless we precompute (either the IDFs or normalized vector for each doc). 
  /// However that would make updating the index a much bigger can of worms.
  // This should provide a nice approximation that will give decent results at least relative to the query, which is all we care about.
};

mft.get_term_idf: function(coll_name, term) {
  // this currently doesn't have any caching smarts.
  // we could cache the IDF for each doc in the collection, but that would make updating more complicated
  // for the moment I'll gamble on mongodb being quick enough to make it not a problem
  // 
  var term_count = db[coll_name].find(mft.filter_arg(coll_name, [term], true)).count()
  if (term_count == 0) { return 0.0 };
  var num_docs = db[coll_name].find().count(); // TODO: memoize, or find a better method for getting this
  return log(num_docs) - log(term_count);
};

mft.filter_arg: function(coll_name, query_terms, require_all) {
  if (require_all === undefined) {
    require_all = true;
  }
  return {(require_all ? '$all' : '$in'): query_terms};
};

mft.process_query_string: function(query_string) {
  return mft.stem_and_tokenize(query_string); // maybe tokenizing should be different for queries?
};

mft.index_all: function(coll_name) {
  var cur = db.coll_name.find();
  cur.forEach(function(x) { mft.index_single_record(coll_name, x); });
};

mft.index_single_record: function(coll_name, record) {
  var all_extracted_terms = array();
  for (var field in mft.INDEXED_FIELDS_AND_WEIGHTS[coll_name]) {
    all_extracted_terms = all_extracted_terms.concat(mft.extract_field_tokens(coll_name, record, field));
  }
  record[mft.EXTRACTED_TERMS_FIELD] = all_extracted_terms;
  db[coll_name].save(record);
};

mft.index_single_record_from_id: function(coll_name, record_id) {
  var rec = db[coll_name].findOne({'_id': record_id});
  mft.index_single_record(coll_name, rec);
};

mft.extract_field_tokens: function(coll_name, record, field) {
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

mft.stem_and_tokenize: function(field_contents) {
  return field_contents.split(' '); // TODO: stemming and smart tokenising (should look at the config vars above)
};


_all = {
  mft: mft
}
  