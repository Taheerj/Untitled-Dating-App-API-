var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('User', new Schema({ 
	facebookid: Number,
	username: String, 
	fullname: String,
	bio: String,
	gender: String,
	searchdist: Number,
	birthday: String,
	email: String,
	prefgender: String,
	photo: String,
	phototwo: String,
	photothree: String,
	token: String
}));


