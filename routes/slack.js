var express = require('express');
var router = express.Router();
var config = require('config');
var request = require('request');
var util = require('util');

/* GET users listing. */
router.get('/authorize', function(req, res, next) {
	res.writeHead(302, {'Location': 'https://slack.com/oauth/authorize?client_id=' + config.get('slack.client_id') + '&scope=chat:write:bot' });
	res.end();
});

router.get('/authorized', function(req, res, next) {
	console.log('code is %s',req.query.code);
	var form = {
		client_id: config.get('slack.client_id'),
		client_secret: config.get('slack.client_secret'),
		code: req.query.code,
	}
	request.post('https://slack.com/api/oauth.access',{form: form},function(error,response,body){
		if(error){
			console.log('error in slack oath %s',error);
		}else if(response.statusCode > 300){
			console.log('error in slack oath %s %s',response.statusCode,body);
		}else{
			var data = JSON.parse(body);
console.log('receievd this from slack: %s',util.inspect(data))
			var teams = req.db.get('teams');
			teams.findAndModify({'team_id': data.team_id},data,{upsert: true,new: true},function(err,team){
				if(err){
					console.log('error inserting user %s',err);
				}else{
					req.session.team = team;
					res.redirect('/');
				}

			});
		}
	})
});

module.exports = router;
