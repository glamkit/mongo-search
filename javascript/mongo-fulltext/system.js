INDEXED_FIELDS_AND_WEIGHTS = {
  'items':  {
      'title': 5,
      'content': 1
  }
}

STEMMING = 'porter'; // doesn't do anything yet
TOKENIZING = 'standard';// doesn't do anything yet

function index_record(coll_name, record_id) {
  rec = db[coll_name].find_one({'_id': record_id});
  coll_fields = INDEXED_FIELDS_AND_WEIGHTS[coll_name]
  for (var f in coll_fields) {
    extract_and_store_field_tokens(coll_name, rec, f);
  }
}

function extract_and_store_field_tokens(coll_name, record, field) {
  contents = record[field];
  processed_contents = stem_and_tokenise(contents);
  store_postings(coll_name, record, field, processed_contents); // we want it in postings list
  record['_extracted_' + field] = processed_contents; // but also in the record, for various reasons.
}

function stem_and_tokenise(field_contents) {
  return field_contents.split(' '); // TODO: stemming and smart tokenising (should look at the config vars above)
}

function store_postings(coll_name, record_id, field, processed_contents) {
  postings_coll = get_postings_collection(coll_name);
  for (var i = 0; i < processed_contents.length; i++) {
    term = processed_contents[i];
    store_postings_term(postings_coll, record_id, term)
  }
}

function store_postings_term(postings_collection, record_id, term) {
  term_postings = postings_collection.upsert({'term': term}, {'term': term, $push: {'document_ids': record_id}});
  // this is assuming we don't need to do duplicate checking, which will do for now.
} 

function get_postings_collection(coll_name) { // we could also split this out on field type but I don't think the use case for it is strong enough
  coll = db['_postings_' + coll_name];
  coll.ensureIndex({'term':1});
  return coll
}
  