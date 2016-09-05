var express = require('express');
var router = express.Router();
var config = require('config');
var request = require('request');
var util = require('util');
var _ = require('underscore');
var us = require('underscore.string');
var querystring = require('querystring');
var url = require('url');
var async = require('async');
var nl2br = require('nl2br');
var marked = require('marked');

// var errorHandler = require('../app_modules/error');
// var github = require('../app_modules/github');


router.post('/', function(req, res, next) {
  console.log('recieved query: %s',req.body.text)
  // var users = {};
  var usersArray = [];
  var answer = '';
  if(req.body.token != config.get('slack.command_token')){
    console.log('somebody spoofing us!')
    res.sendStatus(500);
  }else{
    searchSlack(req.body.text,function(err,matches){
      if(err){
        console.log('error in searchSlack: %s',err)
        res.sendStatus(500)
      }else{
        console.log('matches are: %s',util.inspect(matches))
        if(matches.length == 0){
          answer = util.format('Sorry pal. Nobody knows anything about *%s*...',req.body.text)
        }else{
          _.each(matches,function(match){
            if(match.user){

              // do we have this user in this array already?
              var userIndex = _.findIndex(usersArray,function(user){
                return user.username == match.username
              });

              if(userIndex == -1){
                usersArray.push({
                  username: match.username,
                  user_id: match.user,
                  count: 1
                })
              }else{
                usersArray[userIndex].count += 1;
              }

              // if(!(match.username in users)){
              //   users[match.username] = 1;
              // }else{
              //   users[match.username] += 1;
              // }
            }
          })

          // sort the array accoridng to count desc
          usersArray = _.sortBy(usersArray,'count').reverse();

          console.log('users array is: %s',util.inspect(usersArray));

          var maxIndex = usersArray.length > 3 ? 3 : usersArray.length;
          answer += util.format('Your best matches for *%s* are:\n',req.body.text);
          for(var i=0;i<maxIndex;i++){
            answer += util.format('%d. <@%s|%s>\n',i+1,usersArray[i].user_id,usersArray[i].username);
          }

          // console.log('users list is: %s',util.inspect(users))
          // var bestUser = Object.keys(users).reduce(function(a, b){ return users[a] > users[b] ? a : b });
          // console.log('sorted users list is: %s',util.inspect(bestUser))
          // answer = bestUser;
        }

        request.post(req.body.response_url,{body: JSON.stringify({text: answer})},function(error,response,body){
          if(error){
            console.log('error posting answer to slack: %s',error)
    				res.sendStatus(500)
    			}else if(response.statusCode > 300){
            console.log('error posting answer to slack: %s : %s',response.statusCode,body)
            res.sendStatus(500)
    			}else{
            // all is cool
            console.log('responded successful to slack')
          }
        })
      }
    })

  }
});

function searchSlack(query,callback){
  var matches = [];
  var page = 1;


  async.whilst(
  	function(){
  		return page;
  	},
  	function(callback){
      var qs = {
        token: config.get('slack.user_token'),
        query: query,
        page: page
      }
      request('https://slack.com/api/search.messages',{qs: qs},function(error,response,body){
  			if(error){
  				callback(error);
  			}else if(response.statusCode > 300){
  				callback(response.statusCode + ' : ' + body);
  			}else{
  				var data = JSON.parse(body)
  				matches = matches.concat(data.messages.matches);
  				page = (data.messages.paging.page ==  data.messages.paging.page ? false : data.messages.paging.page + 1);
  				callback(null,matches);
  			}
  		});
  	},
  	function(err,matches){
  		callback(err,matches)
  	}
  );
}

module.exports = router;
