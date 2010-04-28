load('mongo-fulltext/_load.js');
var s = db.fulltext_index_creation;
s.drop();
var i = db.fulltext_index_creation__fulltext_index;
i.drop();

var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
]

mft.get('util').load_records_from_list(fixture, 'fulltext_index_creation');
db.eval("mftsearch = mft.get('search');");

var result ;
var conf = db.fulltext_config
conf.insert({'collection_name' : 'fulltext_index_creation', 'fields': {'title': 5, 'content': 1}});

// TODO: add index on collection name (should we have an _id attribute too?)
db.eval("mftsearch.mapReduceIndex('fulltext_index_creation');");

assert.eq(i.find().toArray(), [
  { "_id" : 1, "_extracted_terms" : [ "fish", "fish", "fish", "fish", "fish", "grouper", "like", "john", "dori"
  ] },
  { "_id" : 2,  "_extracted_terms" : [ "dog", "dog", "dog", "dog", "dog", "whippet", "kick", "mongrel" ] },
  { "_id" : 3,  "_extracted_terms" : [ "dog", "fish", "dog", "fish", "dog", "fish", "dog", "fish", "dog", "fish", "whippet", "kick", "grouper"
  ] }
])