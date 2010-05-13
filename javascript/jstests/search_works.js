load('mongo-fulltext/_load.js');
var s = db.search_works;
s.drop();
var full_vector_norm = false;



var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
];
var conf = db.fulltext_config;
conf.insert({'collection_name' : 'search_works', 'fields': {'title': 5, 'content': 1}, 'params': {'full_vector_norm': full_vector_norm}});


mft.get('util').load_records_from_list(fixture, 'search_works');
var search = mft.get('search');
search.mapReduceIndex('search_works');
search.mapReduceTermScore('search_works');

var ranks_result ;
var search_result ;

// TODO: add index on collection name (should we have an _id attribute too?)
ranks_result = search.mapReduceSearch('search_works', 'fish', true);

search_result = search.mapReduceNiceSearch("search_works", "fish");
// print(result, "Search result for 'fish'");

assert.eq(search_result.toArray(), [
    { "_id" : 1, "value" : { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory", "score" : 1.6666666666666667 } },
    { "_id" : 3, "value" : { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers", "score" : 1.386750490563073 } }],
    "search_works_1"
);

