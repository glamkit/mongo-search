load('mongo-fulltext/_load.js');
var s = db.search_works;
s.drop();

var full_vector_norm = true;

var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory are not dogs", "category": "A"  },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels and no fish are involved", "category": "B" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers", "category": "B" }
];
var search = mft.get('search');

search.configureSearchIndexFields('per_field_works', {'title': 5, 'content': 1});
search.configureSearchIndexFields('per_field_works', {'title': 1}, 'title');

mft.get('util').load_records_from_list(fixture, 'per_field_works');

search.mapReduceIndexTheLot('per_field_works');

var search_result ;

search_result = search.mapReduceSearch("per_field_works", "dog");
assert.eq(search_result.toArray(), [
    {"_id": 3, "value":{ "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers", "category": "B", "score": 0.6868028197434451  }},
    {"_id": 2, "value":{ "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels and no fish are involved", "category": "B", "score": 0.6544715337073237  }},
    {"_id": 1, "value": { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory are not dogs", "category": "A", "score": 0.13203025163465576 }}
    ],
 "per_field_works_1");

var search_result_2 = search.mapReduceSearch("per_field_works", {'default_': "dog"});
assert.eq(search_result.toArray(), search_result_2.toArray(),
 "per_field_works_2");

search_result = search.mapReduceSearch("per_field_works", {title: "dog"});
assert.eq(search_result.toArray(), [
    {"_id": 2, "value":{ "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels and no fish are involved", "category": "B", "score": 1  }},
    {"_id": 3, "value":{ "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers", "category": "B", "score": 0.7071067811865475  }}],
 "per_field_works_3");

search_result = search.mapReduceSearch("per_field_works", {content: "dogs"});
assert.eq(search_result.toArray(), [
    {"_id": 1, "value": { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory are not dogs", "category": "A", "score": 0.1757748711858504 }}],
    "per_field_works_4");
    
search_result = search.mapReduceSearch("per_field_works", {"title": "fish"}, {category: "B"});
assert.eq(search_result.toArray(), [
    {"_id": 3, "value":{ "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers", "category": "B", "score": 0.7071067811865475  }}],
  "per_field_works_5");
 

