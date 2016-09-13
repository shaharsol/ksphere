var async = require('async')
var util = require('util')
var request = require('request')

module.exports = {
  handlePayload: function(db,payload,callback){


    async.waterfall([
      function(callback){
        var users = db.get('users');
        users.findOne({user_id: payload.user.id},function(err,user){
          console.log('user is %s',util.inspect(user))
          callback(err,user)
        })
      },
      function(user,callback){
        var questions = db.get('questions');
        questions.findOne({_id: payload.callback_id},function(err,question){
          console.log('q is %s',util.inspect(question))
          callback(err,user,question)
        })
      },
      function(user,question,callback){
        console.log('payload is %s',util.inspect(payload))
        if(payload.actions[0].value == 'channel'){
          processChannel(user.access_token,question,function(err,channel){
            callback(err,channel)
          })
        }else if(payload.actions[0].value == 'group'){
          processGroup(user.access_token,question,function(err,group){
            callback(err,group)
          })
        }else{
          callback('unrecognized action')
        }
      },
      // respond to user
      function(channel,callback){
        var answer = util.format('%s <#%s|%s> has been created and the relevant people invited',('is_group' in channel ? 'Private group' : 'Channel'),channel.id,channel.name)
        request.post(payload.response_url,{body: JSON.stringify({text: answer})},function(error,response,body){
          if(error){
            callback(error)
          }else if(response.statusCode > 300){
            callback(response.statusCode + ' : ' + body)
          }else{
            callback(null)
          }
        })
      },
      // delete payload
      function(callback){
        var payloads = db.get('payloads');
        payloads.remove({callback_id: payload.callback_id},function(err){
          callback(err)
        })
      }
    ],function(err){
      callback(err)
    })

  },
  getUser: function(userID,accessToken,callback){
    var qs = {
      token: accessToken,
      user: userID
    }
    request.post('https://slack.com/api/users.profile.get',{qs: qs},function(error,response,body){
      if(error){
        callback(error)
      }else if(response.statusCode > 300){
        callback(response.statusCode + ' : ' + body)
      }else{
        var data = JSON.parse(body)
        callback(null,data)
      }
    })
  }
}

function processChannel(accessToken,question,callback){
  async.waterfall([
    // create channel
    function(callback){
      var form = {
        token: accessToken,
        name: util.format('KSphere %s',question._id.toString())
        // name: util.format('ksp-%s',question.slack.text)
      }
      request.post('https://slack.com/api/channels.join',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
// console.log(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,data.channel)
        }
      })
    },
    // set topic
    function(channel,callback){
      var form = {
        token: accessToken,
        channel: channel.id,
        topic: question.slack.text
      }
      request.post('https://slack.com/api/channels.setTopic',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,channel)
        }
      })

    },
    // set purpose
    function(channel,callback){
      var form = {
        token: accessToken,
        channel: channel.id,
        purpose: util.format('To discuss my question: %s',question.slack.text)
      }
      request.post('https://slack.com/api/channels.setPurpose',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,channel)
        }
      })

    },
    // post question as first message
    function(channel,callback){
      var form = {
        token: accessToken,
        channel: channel.id,
        text: question.slack.text
      }
      request.post('https://slack.com/api/chat.postMessage',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,channel)
        }
      })

    },
    // invite matched ppl
    function(channel,callback){
      async.each(question.matched_users,function(matchedUser,callback){
        var form = {
          token: accessToken,
          channel: channel.id,
          user: matchedUser.user_id
        }
        request.post('https://slack.com/api/channels.invite',{form: form},function(error,response,body){
          if(error){
            callback(error)
          }else if(response.statusCode > 300){
            console.log('errir us %s',response.statusCode + ' : ' + body)
            callback(response.statusCode + ' : ' + body)
          }else{
            callback()
          }
        })

      },function(err){
        console.log('channel at the end of async is %s',util.inspect(channel))
        callback(err,channel)
      })
    },
  ],function(err,channel){
    callback(err,channel)
  })
}

function processGroup(accessToken,question,callback){
  async.waterfall([
    // create channel
    function(callback){
      var form = {
        token: accessToken,
        name: util.format('KSphere %s',question._id.toString())
      }
      request.post('https://slack.com/api/groups.create',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
// console.log(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,data.group)
        }
      })
    },
    // set topic
    function(channel,callback){
      var form = {
        token: accessToken,
        channel: channel.id,
        topic: question.slack.text
      }
      request.post('https://slack.com/api/groups.setTopic',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,channel)
        }
      })

    },
    // set purpose
    function(channel,callback){
      var form = {
        token: accessToken,
        channel: channel.id,
        purpose: util.format('To discuss my question: %s',question.slack.text)
      }
      request.post('https://slack.com/api/groups.setPurpose',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,channel)
        }
      })

    },
    // post question as first message
    function(channel,callback){
      var form = {
        token: accessToken,
        channel: channel.id,
        text: question.slack.text
      }
      request.post('https://slack.com/api/chat.postMessage',{form: form},function(error,response,body){
        if(error){
          callback(error)
        }else if(response.statusCode > 300){
          callback(response.statusCode + ' : ' + body)
        }else{
          var data = JSON.parse(body)
          callback(null,channel)
        }
      })

    },
    // invite matched ppl
    function(channel,callback){
      async.each(question.matched_users,function(matchedUser,callback){
        var form = {
          token: accessToken,
          channel: channel.id,
          user: matchedUser.user_id
        }
        request.post('https://slack.com/api/groups.invite',{form: form},function(error,response,body){
          if(error){
            callback(error)
          }else if(response.statusCode > 300){
            console.log('errir us %s',response.statusCode + ' : ' + body)
            callback(response.statusCode + ' : ' + body)
          }else{
            callback()
          }
        })

      },function(err){
        console.log('channel at the end of async is %s',util.inspect(channel))
        callback(err,channel)
      })
    },
  ],function(err,channel){
    callback(err,channel)
  })
}
