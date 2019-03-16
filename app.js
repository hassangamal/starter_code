var express = require('express');
var cfenv = require('cfenv');
var app = express();
var request = require('request');
var Cloudant = require('cloudant');
var path = require('path');
var bodyParser = require('body-parser');
var json2csv = require('json2csv');
var fs = require('fs');
app.use(express.static(__dirname + '/public'));

//To Store URL of Cloudant VCAP Services as found under environment variables on from App Overview page
var cloudant_url;
var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
// Check if services are bound to your project
if(process.env.VCAP_SERVICES)
{
	services = JSON.parse(process.env.VCAP_SERVICES);
	if(services.cloudantNoSQLDB) //Check if cloudantNoSQLDB service is bound to your project
	{
		cloudant_url = services.cloudantNoSQLDB[0].credentials.url;  //Get URL and other paramters
	}
}

//Connect using cloudant npm and URL obtained from previous step
var cloudant = Cloudant({url: cloudant_url});
//Edit this variable value to change name of database.
var dbname = 'hadeer';
var db;

//Create database
cloudant.db.create(dbname, function(err, data) {
  	if(err) //If database already exists
	    console.log("Database exists. Error : ", err); //NOTE: A Database can be created through the GUI interface as well
  	else
	    console.log("Created database.");

  	//Use the database for further operations like create view, update doc., read doc., delete doc. etc, by assigning dbname to db.
  	db = cloudant.db.use(dbname);
    //Create a design document. It stores the structure of the database and contains the design and map of views too
    //A design doc. referred by _id = "_design/<any name your choose>"
    //A view is used to limit the amount of data returned
    //A design document is similar to inserting any other document, except _id starts with _design/.
    //Name of the view and database are the same. It can be changed if desired.
    //This view returns (i.e. emits) the id, revision number and new_city_name variable of all documents in the DB
  	db.insert(
	 {
		  	_id: "_design/names_database",
		    views: {
	  				  "names_database":
	  				   {
	      					"map": "function (doc) {\n  emit(doc._id, [doc._rev, doc.new_name]);\n}"
	    			   }
      	   		   }
     },
	 function(err, data) {
	    	if(err)
	    			console.log("View already exsits. Error: ", err); //NOTE: A View can be created through the GUI interface as well
	    	else
	    		console.log("names_database view has been created");
	 });

});

app.get('/add_name',function(req, res){ //to add a city into the database
	console.log("Name to be added : = " + req.query.new_name);
	req.query.new_name = req.query.new_name.toUpperCase(); //convert to uppercase and trim white space before inserting
	req.query.new_name = req.query.new_name.trim();

	//Search through the DB completely to check for duplicate name, before adding a new name
	var url = cloudant_url + "/names_database/_design/names_database/_view/names_database";
	var name_present = 0; //flag variable for checking if name is already present before inserting
	var name_string; //variable to store update for front end.

	//In this case, check if the ID is already present, else, insert a new document
	request({
			 url: url,
			 json: true
			}, function (error, response, body) {
				db.insert(req.query, function(err, data){
					if (!err)
					{
						console.log("Added new name");
						name_string="{\"added\":\"Yes\"}";
						res.contentType('application/json'); //res.contentType and res.send is added inside every block as code returns immediately
						res.send(JSON.parse(name_string));
					}
					else
					{
						console.log("Error inserting into DB " + err);
						name_string="{\"added\":\"DB insert error\"}";
						res.contentType('application/json');
						res.send(JSON.parse(name_string));

					}
				});
	});
});


var appEnv = cfenv.getAppEnv();
app.listen(appEnv.port, '0.0.0.0', function() {
  console.log("server starting on " + appEnv.url);
});