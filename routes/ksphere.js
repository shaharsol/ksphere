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
var slack = require('../app_modules/slack');


router.post('/', function(req, res, next) {

  // first response to slack
  res.send('thinking...');

  console.log('recieved post: %s', util.inspect(req.body))
  var usersArray = [];
  if(req.body.token != config.get('slack.command_token')){
    console.log('somebody spoofing us!')
    // res.sendStatus(500);
  }else if(!req.body.text){
    answerSlack(req.body.response_url,{text: 'Can\'t search an empty string partner'},function(err){
      if(err){
        console.log('error answering slack: %s',err)
      }
    })
  }else{

    async.waterfall([
      function(callback){
        getTeam(req.db,req.body.team_id,function(err,team){
          callback(err,team)
        })
      },
      function(team,callback){
        logQuestion(req.db,req.body,function(err,question){
          callback(err,team,question)
        })
      },
      function(team,question,callback){
        console.log('giot team: %s',util.inspect(team))
        searchSlack(team.access_token,req.body.text,function(err,matches){
          if(err){
            callback(err)
          }else{
            console.log('matches are: %s',util.inspect(matches))
            if(matches.length == 0){
              callback(null,team,question,null);
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

                }
              })

              // sort the array accoridng to count desc
              usersArray = _.sortBy(usersArray,'count').reverse();

              var matchedUsers = [];
              console.log('users array is: %s',util.inspect(usersArray));

              var maxIndex = usersArray.length > 3 ? 3 : usersArray.length;
              // answer += util.format('Your best matches for *%s* are:\n',req.body.text);
              for(var i=0;i<maxIndex;i++){
                matchedUsers.push(usersArray[i]);
                // answer += util.format('%d. <@%s|%s>\n',i+1,usersArray[i].user_id,usersArray[i].username);
              }
              // callback(null,answer)
              callback(null,team,question,matchedUsers)
            }


          }
        })


      },
      function(team,question,matchedUsers,callback){
        if(!matchedUsers){
          callback(null,question,null)
        }else{
          addPeopleToQuestion(req.db,question,matchedUsers,function(err,question){
            if(err){
              callback(err)
            }else{
              var answer = util.format('Your best matches for *%s* are:\n',req.body.text);
              for(var i=0;i<matchedUsers.length;i++){
                answer += util.format('%d. <@%s|%s>\n',i+1,matchedUsers[i].user_id,matchedUsers[i].username);
              }
              callback(null,question,answer)
            }

          })
        }

      },
      function(question,answer,callback){
        if(answer){
          var answerToSend = {
            text: answer,
            attachments: [
              {
                text: 'Would you like to open it to discussion and invite the above mentioned people to answer?',
                fallback: 'You are unable to post it as question',
                callback_id: question._id.toString(),
                attachment_type: 'default',
                actions: [
                  {
                    name: 'channel',
                    text: 'Start a public discussion',
                    type: 'button',
                    value: 'channel'
                  },
                  {
                    name: 'group',
                    text: 'Start a private discussion',
                    type: 'button',
                    value: 'group'
                  },

                ]
              }
            ]
          }

        }else{
          answerToSend = {text: util.format('Sorry pal. Nobody knows anything about *%s*...',req.body.text)}
        }
        answerSlack(req.body.response_url,answerToSend,function(err){
          callback(err)
        })
      }
    ],function(err){
      if(err){
        console.log('error in kspdhere: %s',err)
      }
    })

  }
});


router.post('/button-pressed', function(req, res, next) {

  res.send('processing...');

  console.log('body is: %s',util.inspect(req.body.payload))
  var payload = JSON.parse(req.body.payload);

  getUser(req.db,payload.user.id,function(err,user){
    if(err){

    }else if(!user){
      handleUnregisteredUser(req.db,payload,function(err){
          console.log('error in handleUnregisteredUser: %s',err)
      })
    }else{
      slack.handlePayload(req.db,payload,function(err){
        console.log('error in handlePayload: %s',err)

      })
    }
  })

})

function handleUnregisteredUser(db,payload,callback){
  async.waterfall([
    function(callback){
      savePayload(db,payload,function(err,payload){
        callback(err,payload)
      })
    },
    function(payload,callback){
      answerSlack(payload.response_url,{text: util.format('To complete thw action, please authorize us at http://%s/slack/authorize-user/%s',config.get('app.domain'),payload._id)},function(err){
        callback(err)
      })
    }
  ],function(err){
    callback(err)
  })
}

function savePayload(db,payload,callback){
  var payloads = db.get('payloads');
  paylaods.insert(payload,function(err,payload){
    callback(err,payload)
  })
}

function channelJoinAndInvite(accessToken,question,callback){
  async.waterfall([
    function(callback){
      var form = {
        token: accessToken,
        name: util.format('KSphere %s',question._id.toString())
      }
      request.post('https://slack.com/api/channels.join',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,data.channel)
        }
      })
    }
  ],function(err){
    callback(err)
  })
}

function getTeam(db,teamID,callback){
  var teams = db.get('teams');
  teams.findOne({team_id: teamID},function(err,team){
    callback(err,team)
  })
}

function getQuestion(db,questionID,callback){
  var questions = db.get('questions');
  questions.findOne({_id: questionID},function(err,question){
    callback(err,question)
  })
}

function getUser(db,slackUserID,callback){
  var users = db.get('users');
  users.findOne({slack_user_id: slackUserID},function(err,user){
    callback(err,user)
  })
}

function logQuestion(db,slackPost,callback){
  var questions = db.get('questions');
  questions.insert({
    slack: slackPost
  },function(err,question){
    callback(err,question)
  })
}

function addPeopleToQuestion(db,question,macthedUsers,callback){
  var questions = db.get('questions');
  questions.findOneAndUpdate({
    _id: question._id
  },{
    $set: {
      matched_users: macthedUsers
    }
  },{
    new: true
  },function(err,question){
    callback(err,question)
  })
}
function answerSlack(responseUrl,answer,callback){
  request.post(responseUrl,{body: JSON.stringify(answer)},function(error,response,body){
    if(error){
      callback(error)
    }else if(response.statusCode > 300){
      callback(response.statusCode + ' : ' + body)
    }else{
      callback(null)
    }
  })
}

function searchSlack(accessToken,query,callback){
  var matches = [];
  var page = 1;


  async.whilst(
  	function(){
  		return page;
  	},
  	function(callback){
      var qs = {
        token: accessToken,
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
