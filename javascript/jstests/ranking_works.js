load('mongo-fulltext/_load.js');
var s = db.ranking_works;
s.drop();
var full_vector_norm = false;

var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
];
var conf = db.fulltext_config;
conf.insert({'collection_name' : 'ranking_works', 'fields': {'title': 5, 'content': 1}, 'params': {'full_vector_norm': full_vector_norm}});


mft.get('util').load_records_from_list(fixture, 'ranking_works');
var search = mft.get('search');
search.mapReduceIndex('ranking_works');

var result ;

// TODO: add index on collection name (should we have an _id attribute too?)
result = search.mapReduceSearch('ranking_works', 'fish').toArray();

// print(result, "Search result for 'fish'");

assert.eq(result, [
        {
                "_id" : 1,
                "value" : 1.6666666666666667
        },
        {
                "_id" : 3,
                "value" : 1.386750490563073
        }
]);

result = search.mapReduceSearch('ranking_works', 'Dory').toArray();

// print(result, "Search result for 'Dory'");

assert.eq(result, [ { "_id" : 1, "value" : 0.3333333333333333 } ]);
