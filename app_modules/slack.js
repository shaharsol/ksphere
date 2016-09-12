var async = require('async')

module.exports = {
  handlePayload: function(db,payload,callback){

    async.waterfall([
      function(callback){
        var users = db.get('users');
        users.findOne({user_id: payload.user.id},function(err,user){
          callback(err,user)
        })
      },
      function(callback){
        var questions = db.get('questions');
        questions.findOne({_id: payload.callback_id},function(err,question){
          callback(err,user,question)
        })
      }
    ],function(err){

    })

    console.log('HERE')
    callback()
    // async.waterfall([
    //
    // ],function(err){
    //
    // })
  }
}

function processChannel(accessToken,question,callback){
  async.waterfall([
    // create channel
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
    // invite matched ppl
    function(channel,callback){

    },
  ],function(err){
    callback(err)
  })
}
