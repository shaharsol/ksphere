var express = require('express');
var router = express.Router();
var config = require('config');
var request = require('request');
var util = require('util');
var async = require('async');

var slack = require('../app_modules/slack')

/* GET users listing. */
router.get('/authorize', function(req, res, next) {
	res.writeHead(302, {'Location': 'https://slack.com/oauth/authorize?client_id=' + config.get('slack.client_id') + '&scope=chat:write:bot' });
	res.end();
});

router.get('/authorize-user/:payload_id/:team_id', function(req, res, next) {
	req.session.payloadID = req.params.payload_id;
	res.writeHead(302, {'Location': 'https://slack.com/oauth/authorize?client_id=' + config.get('slack.client_id') + '&redirect_uri=http://' + config.get('app.domain') + '/slack/authorized-user&team=' + req.params.team_id + '&scope=channels:write,groups:write,chat:write:user' });
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

router.get('/authorized-user', function(req, res, next) {
	console.log('code is %s',req.query.code);
	var form = {
		client_id: config.get('slack.client_id'),
		client_secret: config.get('slack.client_secret'),
		redirect_uri: 'http://' + config.get('app.domain') + '/slack/authorized-user',
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
			var users = req.db.get('users');
			users.findAndModify({'user_id': data.user_id},data,{upsert: true,new: true},function(err,user){
				if(err){
					console.log('error inserting user %s',err);
				}else{
					req.session.user = user;
console.log('AAA')
					async.waterfall([
						function(callback){
							var payloads = req.db.get('payloads');
							payloads.findOne({_id: req.session.payloadID},function(err,payload){
								console.log('BBB')
								callback(err,payload)
							})
						},
						function(payload,callback){
							slack.handlePayload(req.db,payload,function(err){
								console.log('CCC')
								callback(err)
							});
						}
					],function(err){
						if(err){
							console.log('err in dealing with payload: %s',err)
						}else{
							delete req.session.payloadID
							res.redirect('/');
						}
					})





				}

			});
		}
	})
});
module.exports = router;
