var express = require('express');
var router = express.Router();
var config = require('config');
var request = require('request');
var util = require('util');

var slack = require('../app_modules/slack')
/* GET users listing. */
router.get('/', function(req, res, next) {
	if(req.session.user){
		slack.getUser(req.session.user.user_id,req.session.user.access_token,function(err,user){
console.log('user is %s',util.inspect(user))
			res.render('index/welcome-user',{
				user: user
			});
		})

	}else if(req.session.team){
		res.render('index/welcome',{
			team: req.session.team
		});
	}else{
		res.render('index/index',{
			config: config
		});
	}
});

router.get('/logout', function(req, res, next) {
	delete req.session.team;
	delete req.session.user;
	res.redirect('/');
});

router.get('/privacy', function(req, res, next) {
	res.render('index/privacy',{});
});

module.exports = router;
