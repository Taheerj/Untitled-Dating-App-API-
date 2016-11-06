// =================================================================
// get the packages we need ========================================
// =================================================================
var express 	= require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var fs = require('fs');
var zlib = require('zlib');
var formidable = require('formidable');
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
var jwt    = require('jsonwebtoken'); 
var config = require('./config'); 
var User   = require('./app/models/user'); 
var Conversation   = require('./app/models/conversation'); 

// =================================================================
// configuration ===================================================
// =================================================================
var port = process.env.PORT || 8080; 
mongoose.connect(config.database); // connect to database
app.set('', config.secret); // secret variable - it's a secret so don't bother trying to find it

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

//config aws
//AWS.config.region = 'eu-west-1';

// ================================================================= 
// routes ==========================================================
// =================================================================


app.post('/register', function(req, res) {

	// find the user
	User.findOne({
		facebookid: req.body.facebookid
	}, function(err, user) {

		if (err) { 
			res.json({ success: false, message: err });		
		} else {
			if (!user) {
				// create a sample user
				var newuser = new User({ 
					facebookid: req.body.facebookid,
					username: req.body.username, 
					fullname: req.body.fullname,
					bio: "",
					gender: req.body.gender,
					birthday: req.body.birthday,
					email: req.body.email,
					prefgender: req.body.prefgender,
					photo: "",
					phototwo: "",
					photothree: "",
					token: ""
				});

				var token = jwt.sign(newuser, app.get('superSecret'), {
						expiresInMinutes: 99999999999 // expires never
				});

				newuser.token = token;

				newuser.save(function(err) {
					if (err) {
						res.json({ success: false, message: err });		
					} else {
						//req.newData.token = token;
						console.log('User Registered');
						res.json(newuser);
					}
				});

			} else if (user) {	
				res.json({ success: true, message: 'Already Registed, heres the token.', token: user.token });
			}
		}

	});

	
});

// basic route (http://localhost:8080) for testing
app.get('/', function(req, res) {
	res.send('Whats up!');
});

// ---------------------------------------------------------
// get an instance of the router for api routes
// ---------------------------------------------------------
var apiRoutes = express.Router(); 

// ---------------------------------------------------------
// route middleware to authenticate and check token
// ---------------------------------------------------------
apiRoutes.use(function(req, res, next) {

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.param('token') || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {			
			if (err) {
				return res.json({ success: false, message: 'Failed to authenticate token.' });		
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;	
				next();
			}
		});

	} else {
		// if there is no token
		// return an error
		return res.status(403).send({ 
			success: false, 
			message: 'No token provided.'
		});
		
	}
	
});

// ---------------------------------------------------------
// authenticated routes
// ---------------------------------------------------------
//URL/api/ - For testing only
//GET
apiRoutes.get('/', function(req, res) {
	res.json({ message: 'This is the API!' });
});

//URL/api/users - Shows all users
//GET
apiRoutes.get('/users', function(req, res) {
	User.find({}, function(err, users) {
		res.json(users);
	});
});

//Updates photos assigned to the user
//URL/api/updatephotos
//POST
//params: formdata: facebookid, photonumber (one,two,three), imagefile
apiRoutes.post('/updatephotos', function(req, res) {
	var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
    if(err) {
      next(err);
    } else {
        var body = fs.createReadStream(files.file.path);
		var s3obj = new AWS.S3({params: {Bucket: 'dating-app-bucket', Key: req.param('token') + "/" + fields.photonumber + "/" + files.file.name}});
		s3obj.upload({Body: body}).
		  on('httpUploadProgress', function(evt) { console.log(evt); }).
		  send(function(err, data) {
			 console.log("image uploaded" + data.Location);
			 User.findOne({
				token: req.param('token')
			}, function(err, user) {
				if (err) {
					res.json({ success: false, message: err });		
				} else {

					if (!user) {
						//no user, no update
						res.json({ success: false, message: 'User not found'});
					} else if (user) {	
						if(fields.photonumber == "one"){
							user.photo = data.Location;
						}else if(fields.photonumber == "two"){
							user.phototwo = data.Location;
						} else if(fields.photonumber == "three"){
							user.photothree = data.Location;
						}
						user.save(function(err) {
							if (err) {
								res.json({ success: false, message: err });		
							} else {
								//req.newData.token = token;
								console.log(user._id + ' photos Updated');
								res.json({
									success: true
								});
							}	
						});
					}
				}

			});
		 });

		  

    }
  });


});

//Updates bio assigned to the user
//URL/api/updatebio
//POST
//params: facebookid, bio
apiRoutes.post('/updatebio', function(req, res) {
	// find the user
	User.findOne({
		token: req.body.token
	}, function(err, user) {
		if (err) {
			res.json({ success: false, message: err });		
		} else {

			if (!user) {
				//no user, no update
				res.json({ success: false, message: 'User not found'});
			} else if (user) {	
				user.bio = req.body.bio
				user.save(function(err) {
					if (err) {
						res.json({ success: false, message: err });		
					} else {
						//req.newData.token = token;
						console.log(user._id + ' Bio Updated');
						res.json({
							success: true
						});
					}	
				});
			}
		}

	});
});

//Updates prefs assigned to the user
//URL/api/updateprefs
//POST
apiRoutes.post('/updateprefs', function(req, res) {
	// find the user
	User.findOne({
		token: req.body.token
	}, function(err, user) {
		if (err) {
			res.json({ success: false, message: err });		
		} else {

			if (!user) {
				//no user, no update
				res.json({ success: false, message: 'User not found'});
			} else if (user) {	

				user.gender = req.body.gender
				user.searchdist = req.body.searchdist
				user.prefgender = req.body.prefgender

				user.save(function(err) {
					if (err) {
						res.json({ success: false, message: err });		
					} else {
						//req.newData.token = token;
						console.log(user._id + ' prefs Updated');
						res.json({
							success: true
						});
					}	
				});
			}
		}

	});
});

//Get single user
//URL/api/updateprefs
//POST
//params facebookid
apiRoutes.post('/getuser', function(req, res) {
	// find the user
	User.findOne({
		token: req.body.token
	}, function(err, user) {
		if (err) {
			res.json({ success: false, message: err });		
		} else {

			if (!user) {
				//no user, no update
				res.json({ success: false, message: 'User not found'});
			} else if (user) {	
				res.json(user);	
			}
		}

	});
});

//Initialises a chat conversation
//URL/api/startchat
//POST
apiRoutes.post('/startchat', function(req, res) {
	res.json({ message: 'To be continued' });
});

//Closes the chat conversation based on room id or name
//URL/api/closechat
//POST
apiRoutes.post('/closechat', function(req, res) {
	res.json({ message: 'To be continued' });
});

app.use('/api', apiRoutes);

// =================================================================
// start the server ================================================
// =================================================================
app.listen(process.env.PORT);
console.log('The magic happens at: ' + process.env.PORT);
