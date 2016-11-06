var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('Conversation', new Schema({ 
	firstfbid: Number,
	secondfbid: Number,
	messages : [{
	    message : String,
	    username : String
	    }],
	messagecount : Number

}));