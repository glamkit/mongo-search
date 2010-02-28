// copy and paste this into the mongo shell do generate a nice set
// TODO: extyract exhibition items as well - this doesn't work yet because
// looking at the schema of the harvested exhibition items in my DB gave me
// a headache and i went for some lower hanging fruit -dan

db.temp.drop()

var wanted_gallery_collection_items_ids = ['24427', '2443', '24434', '2444', '24443', '24446', '2445', '24452', '24454', '24455', '24456', '24457', '24458', '24459', '2446', '30965', '10022'];
var wanted_colls = ["av_items", "department_items", "document_items", "gallery_collection_items", "location_items", "person_items", "subject_class_items", "exhibition_items"];
var all_wanted_ids = {};
// initialise wanted id dict
for (var i in wanted_colls) { all_wanted_ids[wanted_colls[i]] = []}
all_wanted_ids.gallery_collection_items = wanted_gallery_collection_items_ids;
var collection_items = db.gallery_collection_items.find({_id:{'$in': wanted_gallery_collection_items_ids}}).toArray();

//hunt DBRefs so that we get dependencies
for (var i in collection_items) {
  for (var j in collection_items[i]) {
    for (var k in collection_items[i][j]) {
      if (collection_items[i][j][k]["$ref"]) {
          all_wanted_ids[collection_items[i][j][k]["$ref"]].push(
          collection_items[i][j][k]["$id"]
        )
      }
      //this is catches AV items - it shouldn't do anything once we've denormalised AV items.
      for (var m in collection_items[i][j][k]) {
        if (collection_items[i][j][k][m]["$ref"]) {
            all_wanted_ids[collection_items[i][j][k][m]["$ref"]].push(
            collection_items[i][j][k][m]["$id"]
          )
        }        
      }
    }
  }
}

// This is where a loop over the gallery_colletion_items to find the 
// wanted exhibition ids would be good


//the resulting av_items, subject and department should be empty, as we've denormalised all the references

var all_items = {};
for (var coll_name in all_wanted_ids) {
  var wanted_ids_in_this_coll = all_wanted_ids[coll_name];
  print(coll_name, wanted_ids_in_this_coll);
  these_items = db[coll_name].find(
    {_id:{'$in': wanted_ids_in_this_coll}}
  ).toArray();
  for (var i in these_items) {
    var item = these_items[i];
    delete(item._ns);
    if (coll_name== 'gallery_collection_items'){
      delete(item.accession_slug);}
    if (coll_name== 'person_items'){
      delete(item['name']);}
  }
  all_items[coll_name] = these_items;
}
db.temp.save(all_items);

// now do  ./mongoexport -d agnsw(2) -c temp
// put in simplefixture.json, take out the first _id = $oid (if there is one)
// then run ./manage.py shell_plus
// >>> from collection.tests.simplefixture import pythonise_sample_json_data
// >>> pythonise_sample_json_data()
