load('mongo-fulltext/_load.js');
var mftsearch = mft.get('search');

var result ;
var conf = db.search_.config;
conf.update({'collection_name' : 'fulltext_index_creation'},
  {'collection_name' : 'fulltext_index_creation', 
  'indexes': {'default_': {'fields': {'title': 5, 'content': 1}}, 
              'title': {'fields': {'title': 1}}}},
  true);

coll_name = 'fulltext_index_creation';
var s = db[coll_name];
s.drop();
for (index_name in mftsearch.getAllIndexNames(coll_name)) {
  mft.debug_print(index_name, "index_name");
  db[mftsearch.indexCollName(coll_name, index_name)].drop();
}


var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
]

mft.get('util').load_records_from_list(fixture, 'fulltext_index_creation');


// TODO: add index on collection name (should we have an _id attribute too?)

// map reduce from db.eval is not supported - http://groups.google.com/group/mongodb-user/browse_frm/thread/546380c7f546cb94/e1d9c7cc9807f213#e1d9c7cc9807f213
// all mapreduce-generated doucments have the form {_id: 123, value: doc}

mftsearch.mapReduceIndexTheLot('fulltext_index_creation');

var default_idx = db[mftsearch.indexCollName(coll_name, 'default_')];

assert.eq(default_idx.find().toArray(), [
    { "_id" : 1,
      "value" : { "_extracted_terms" : [
            "fish",
            "fish",
            "fish",
            "fish",
            "fish",
            "grouper",
            "like",
            "john",
            "dori"
    ] } },
    { "_id" : 2,
      "value" : { "_extracted_terms" : [
            "dog",
            "dog",
            "dog",
            "dog",
            "dog",
            "whippet",
            "kick",
            "mongrel"
    ] } },
    { "_id" : 3,
      "value" : { "_extracted_terms" : [
            "dog",
            "fish",
            "dog",
            "fish",
            "dog",
            "fish",
            "dog",
            "fish",
            "dog",
            "fish",
            "whippet",
            "kick",
            "grouper"
    ] } }
], 'index_works')