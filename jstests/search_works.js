load('mongo-fulltext/_load.js');
var s = db.search_works;
s.drop();

var full_vector_norm = true;

var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory", "category": "A"  },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels", "category": "B" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers", "category": "B" }
];
var conf = db.fulltext_config;
conf.insert({'collection_name' : 'search_works', 'fields': {'title': 5, 'content': 1}, 'params': {'full_vector_norm': full_vector_norm}});


mft.get('util').load_records_from_list(fixture, 'search_works');
var search = mft.get('search');

search.mapReduceIndexTheLot('search_works');

var ranks_result ;
var search_result ;

search_result = search.mapReduceSearch("search_works", "fish");
// print(result, "Search result for 'fish'");

assert.eq(search_result.toArray(), [
        {
                "_id" : 1,
                "value" : {
                        "_id" : 1,
                        "title" : "fish",
                        "content" : "groupers like John Dory",
                        "category" : "A",
                        "score" : 0.7215048205855952
                }
        },
        {
                "_id" : 3,
                "value" : {
                        "_id" : 3,
                        "title" : "dogs & fish",
                        "content" : "whippets kick groupers",
                        "category" : "B",
                        "score" : 0.6868028197434451
                }
        }
  ], "search_works_1"
);

search_result = search.mapReduceSearch("search_works", "fish", {category: "B"});
assert.eq(search_result.toArray(), [
        {
                "_id" : 3,
                "value" : {
                        "_id" : 3,
                        "title" : "dogs & fish",
                        "content" : "whippets kick groupers",
                        "category" : "B",
                        "score" : 0.6868028197434451
                }
        }
  ], "search_works_2"
);

