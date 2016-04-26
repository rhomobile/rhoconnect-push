exports.validate = function(schema, obj) {
    var schemaType = typeOf(schema);
    var objType = typeOf(obj);
    if(schemaType == 'array' && objType == 'array') {
	return validateArray(schema, obj);
    }
    else if(schemaType == 'object' && objType == 'object') {
	return validateObject(schema, obj);
    }
    else if(schemaType != objType) {
	return [ false, 'object/schema type mismatch (' + objType + ' != ' + schemaType + ')' ];
    }
    return [ true, '' ];
};

function validateObject(schema, obj) {
    for(var schemaField in schema) {
	// console.log('looking for field ' + schemaField + ' (' + typeOf(schema[schemaField]) + ')');
	var optional = false;
	var objectField = schemaField;
	if(schemaField.charAt(schemaField.length-1) == '?') {
	    optional = true;
	    objectField = schemaField.slice(0,-1);
	}

	if(objectField in obj) {
	    // console.log('Found ' + objectField + ' (' + typeOf(obj[objectField]) + ')');
	    var valid = exports.validate(schema[schemaField], obj[objectField]);
	    if(!valid[0]) {
		return valid;
	    }
	}
	else if(!optional) {
	    return [ false, 'required field ' + schemaField + ' missing' ];
	}
    }
    return [ true, '' ];
}

function validateArray(schema, obj) {
    // Build a map of schema array member types to schema objects
    var typeMap = {};
    for(var i=0; i<schema.length; i++) {
	var type = typeOf(schema[i]);
	// console.log('schema array includes ' + type + ' type objects');
	typeMap[type] = schema[i];
    }

    for(var i=0; i<obj.length; i++) {
	// console.log('validating array element ' + i);
	var type = typeOf(obj[i]);
	var subSchema = typeMap[type];
	if(subSchema == undefined) {
	    return [ false, 'array member type invalid (' + type + ')' ];
	}

	var valid = exports.validate(subSchema, obj[i]);
	if(!valid[0]) {
	    return valid;
	}
    }
    return [ true, '' ];
}

function typeOf(obj) {
    if(obj instanceof Array) {
	return 'array';
    }
    return typeof obj;
}
