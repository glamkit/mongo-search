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
conf.update({'collection_name' : 'ranking_works'},
  {'collection_name' : 'ranking_works', 
  'indexes': {'default_': {'fields': {'title': 5, 'content': 1}}, 
              'title': {'fields': {'title': 1}}}},
  true);


mft.get('util').load_records_from_list(fixture, 'ranking_works');
var search = mft.get('search');
search.mapReduceIndexTheLot('ranking_works');

var result ;

// TODO: add index on collection name (should we have an _id attribute too?)
result = search.mapReduceRawSearch('ranking_works', 'fish');
result = db[result.result].find().sort({"value.score": 1}).toArray();

// print(result, "Search result for 'fish'");

assert.eq(result, [
        {
                "_id" : 1,

                "value" : 0.7215048205855952
        },
        {
                "_id" : 3,
                "value" : 0.6868028197434451
        }
]);


result = search.mapReduceRawSearch('ranking_works', 'Dory');
result = db[result.result].find().sort({"value.score": 1}).toArray();

// print(result, "Search result for 'Dory'");

assert.eq(result, [ { "_id" : 1, "value" : 0.390985091628235 } ]);
