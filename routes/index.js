var express = require('express');
var router = express.Router();
var config = require('config');
var request = require('request');
var util = require('util');

/* GET users listing. */
router.get('/', function(req, res, next) {
	if(req.session.team){
		res.render('index/welcome',{
			team: req.session.team
		});
	}else{
		res.render('index/index');
	}
});

router.get('/logout', function(req, res, next) {
	delete req.session.team;
	res.redirect('/');
});

module.exports = router;
