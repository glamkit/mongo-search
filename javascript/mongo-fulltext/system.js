INDEXED_FIELDS_AND_WEIGHTS = {
  'items':  {
      'title': 5,
      'content': 1
  }
}

STEMMING = 'porter'; // doesn't do anything yet
TOKENIZING = 'standard';// doesn't do anything yet

function mft_search() {
  // what hsould this do?
}

function mft_filtered(coll_name, query_string, require_all) {
  var query_terms = mft_process_query_string(query_string);
}

function mft_process_query_string(query_string) {
  return mft_stem_and_tokenize(query_string); // maybe tokenizing should be different for queries?
}

function mft_index_all(coll_name) {
  var cur = db.coll_name.find();
  cur.forEach(function(x) { mft_index_single_record(coll_name, x); });
}
  
function mft_index_single_record(coll_name, record) {
  for (var field in INDEXED_FIELDS_AND_WEIGHTS[coll_name]) {
    extract_and_store_field_tokens(coll_name, record, field);
  }
}

function mft_index_single_record_from_id(coll_name, record_id) {
  var rec = db[coll_name].find_one({'_id': record_id});
  mft_index_single_record(coll_name, rec);
}

function mft_extract_and_store_field_tokens(coll_name, record, field) {
  var contents = record[field];
  if (!contents) { // eg the field doesn't exist on this particular record, we silently fail
    return;
  }
  var processed_contents = mft_stem_and_tokenize(contents);
//  mft_store_postings(coll_name, record, field, processed_contents); // we want it in postings list -- or maybe not - will leave out for now
  record['_extracted_' + field] = processed_contents; // but also in the record, for various reasons.
}

function mft_stem_and_tokenize(field_contents) {
  return field_contents.split(' '); // TODO: stemming and smart tokenising (should look at the config vars above)
}

function mft_store_postings(coll_name, record_id, field, processed_contents) {
  // we don't need the postings list to do the search because of mongo magic
  // however we do want to know how many documents a term appears in
  // and to make this easy to update, it  makes sense to use a postings list as well
  var postings_coll = get_postings_collection(coll_name); 
  for (var i = 0; i < processed_contents.length; i++) {
    var term = processed_contents[i];
    store_postings_term(postings_coll, record_id, term)
  }
}

function mft_store_postings_term(postings_collection, record_id, term) {
  // append to the array if it doesn't already exist
  postings_collection.upsert({'term': term}, {'term': term, $push: {'document_ids': record_id}});
  // this is assuming we don't need to do duplicate checking, which will do for now.
} 

function mft_get_postings_collection(coll_name) { // we could also split this out on field type but I don't think the use case for it is strong enough
  var coll = db['_postings_' + coll_name];
  coll.ensureIndex({'term':1});
  return coll
}
  