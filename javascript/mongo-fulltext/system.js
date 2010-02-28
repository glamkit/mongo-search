INDEXED_FIELDS_AND_WEIGHTS = {
  'items':  {
      'title': 5,
      'content': 1
  }
}

STEMMING = 'porter'; // doesn't do anything yet
TOKENIZING = 'standard';// doesn't do anything yet

EXTRACTED_TERMS_FIELD = '_extracted_terms';
SEARCH_ALL_PSEUDO_FIELD = '$search'; // magic "field name" that specifies we want a fulltext search 
            // (abusing the '$' notation somewhat, which is often for search operators)
SEARCH_ANY_PSEUDO_FIELD = '$searchany'; // magic "field name" that specifies we want a fulltext search matching any, not all

function mft_search(coll_name, query_obj) {  
  
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
  if (query_obj[SEARCH_ALL_PSEUDO_FIELD]) {
    search_query_string = query_obj[SEARCH_ALL_PSEUDO_FIELD];
    require_all = true;
  } else if (query_obj[SEARCH_ALL_PSEUDO_FIELD]) {
    search_query_string = query_obj[SEARCH_ANY_PSEUDO_FIELD];
    require_all = false;
  } else {
    return db[coll_name].find(query_obj); // no need to call search, you chump
  }
  query_terms = mft_process_query_string(search_query_string);
  query_obj[EXTRACTED_TERMS_FIELD] = mft_filter_arg(query_terms, require_all);
  filtered = db[coll_name].find(query_obj);
  scores_and_ids = Array();
  for (var i in filtered) {
    record = filtered[i];
    score = mft_score_record_against_query(record, query_terms);
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
}

function mft_filter_arg(coll_name, query_terms, require_all) {
  if (require_all === undefined) {
    require_all = true;
  }
  return {(require_all ? '$all' : '$in'): query_terms};
}

function mft_process_query_string(query_string) {
  return mft_stem_and_tokenize(query_string); // maybe tokenizing should be different for queries?
}

function mft_index_all(coll_name) {
  var cur = db.coll_name.find();
  cur.forEach(function(x) { mft_index_single_record(coll_name, x); });
}
  
function mft_index_single_record(coll_name, record) {
  var all_extracted_terms = array();
  for (var field in INDEXED_FIELDS_AND_WEIGHTS[coll_name]) {
    all_extracted_terms = all_extracted_terms.concat(mft_extract_field_tokens(coll_name, record, field));
  }
  record[EXTRACTED_TERMS_FIELD] = all_extracted_terms;
  db[coll_name].save(record);
}

function mft_index_single_record_from_id(coll_name, record_id) {
  var rec = db[coll_name].find_one({'_id': record_id});
  mft_index_single_record(coll_name, rec);
}

function mft_extract_field_tokens(coll_name, record, field) {
  // extracts tokens in stemmed and tokenised form and upweights them as specified in the config if necessary
  var contents = record[field];
  if (!contents) { // eg the field doesn't exist on this particular record, we silently fail
    return;
  }
  var processed_contents = mft_stem_and_tokenize(contents);
  var upweighting = INDEXED_FIELDS_AND_WEIGHTS[coll_name][field];
  if (upweighting == 1) { // special -casing for the common case - may be slightly quicker avoiding the array copy
    return processed_contents;
  } else {
    var upweighted_contents = processed_contents;
    for (var i = 1; i < upweighting; i++) {
      upweighted_contents.concat(processed_contents);
    }
    return upweighted_contents // this upweighting shouldn't damage our scores as long as we TF IDF, since IDF won't be affect by linear multipliers
  }
}

function mft_stem_and_tokenize(field_contents) {
  return field_contents.split(' '); // TODO: stemming and smart tokenising (should look at the config vars above)
}

// function mft_store_postings(coll_name, record_id, field, processed_contents) {
//   // we don't need the postings list to do the search because of mongo magic
//   // however we do want to know how many documents a term appears in
//   // and to make this easy to update, it  makes sense to use a postings list as well
//   var postings_coll = get_postings_collection(coll_name); 
//   for (var i = 0; i < processed_contents.length; i++) {
//     var term = processed_contents[i];
//     store_postings_term(postings_coll, record_id, term)
//   }
// }
// 
// function mft_store_postings_term(postings_collection, record_id, term) {
//   // append to the array if it doesn't already exist
//   postings_collection.upsert({'term': term}, {'term': term, $push: {'document_ids': record_id}});
//   // this is assuming we don't need to do duplicate checking, which will do for now.
// } 
// 
// function mft_get_postings_collection(coll_name) { // we could also split this out on field type but I don't think the use case for it is strong enough
//   var coll = db['_postings_' + coll_name];
//   coll.ensureIndex({'term':1});
//   return coll
// }
  