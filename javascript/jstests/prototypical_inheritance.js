    //currently this prints outputs and doesn't do any nice asserts
    //this si for clarity of bug reporting

    var s = db.system.js;

    PrototypicalInheritanceObject = function () {
        this.constructor_assigned_property = 'this constructor_assigned_property exists';
    }

    PrototypicalInheritanceObject.own_property = 'this own_property exists';

    PrototypicalInheritanceObject.own_method = function () {
        return "this own_method exists";
    }

    PrototypicalInheritanceObject.prototype.prototypical_property = 'this prototypical_property exists';

    PrototypicalInheritanceObject.prototype.prototypical_method = function () {
        return "this prototypical_method exists";
    }

    print("======================================");
    print("Client side");
    print("======================================");

    //test that this behaves as normal in the shell interpreter
    var p = new PrototypicalInheritanceObject();
    print("constructor property - shell interpreter:");
    print(p.constructor_assigned_property);
    print("");
    print("own property - shell interpreter:");
    print(p.own_property);
    print("");
    print("own method - shell interpreter:");
    print(tojson(p.own_method));
    print("");
    print("prototypical property - shell interpreter:");
    print(p.prototypical_property);
    print("");
    print("prototypical method - shell interpreter:");
    print(tojson(p.prototypical_method));

    print("======================================");
    print("server side");
    print("======================================");
    s.insert( { _id : "PrototypicalInheritanceObject", value : PrototypicalInheritanceObject});
    print("constructor property - server interpreter:");
    print(db.eval("var p = new PrototypicalInheritanceObject(); return p.constructor_assigned_property"));
    print("");
    print("own property - server interpreter:");
    print(db.eval("var p = new PrototypicalInheritanceObject(); return p.own_property"));
    print("");
    print("own method - server interpreter:");
    print(db.eval("var p = new PrototypicalInheritanceObject(); return tojson(p.own_method)"));
    print("");
    print("prototypical property - server interpreter:");
    print(db.eval("var p = new PrototypicalInheritanceObject(); return p.prototypical_property"));
    print("");
    print("prototypical method - server interpreter:");
    print(db.eval("var p = new PrototypicalInheritanceObject(); return tojson(p.prototypical_property)"));
