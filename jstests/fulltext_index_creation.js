load('mongo-fulltext/_load.js');
var mftsearch = mft.get('search');

coll_name = 'fulltext_index_creation';
var s = db[coll_name];
s.drop();
var i = db[mftsearch.indexName(coll_name)];
i.drop()

var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
]

mft.get('util').load_records_from_list(fixture, 'fulltext_index_creation');

var result ;
var conf = db.fulltext_config;
conf.insert({'collection_name' : 'fulltext_index_creation', 'fields': {'title': 5, 'content': 1}});

// TODO: add index on collection name (should we have an _id attribute too?)

// map reduce from db.eval is not supported - http://groups.google.com/group/mongodb-user/browse_frm/thread/546380c7f546cb94/e1d9c7cc9807f213#e1d9c7cc9807f213
// all mapreduce-generated doucments have the form {_id: 123, value: doc}

mftsearch.mapReduceIndex('fulltext_index_creation');

assert.eq(i.find().toArray(), [
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