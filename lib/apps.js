require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require(process.env.FIRESTORE_SECRET);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const fireStore = require('botkit-storage-firestore-v2')({
  database: db,
  methods: ['coffee']
});

var Botkit = require('botkit');

var _bots = {};

function _trackBot(bot) {
  _bots[bot.config.token] = bot;
}

function die(err) {
  console.log(err);
  process.exit(1);
}

module.exports = {
  pantryBot: () => {
    var controller = Botkit.slackbot({
      storage: fireStore
    }).configureSlackApp({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      scopes: ['bot']
    });

    controller.setupWebserver(process.env.PORT, function(err, webserver) {
      controller.createWebhookEndpoints(webserver);

      controller.createOauthEndpoints(webserver, function(err, req, res) {
        if (err) {
          res.status(500).send('ERROR: ' + err);
        } else {
          res.send('Success!');
        }
      });
    });

    controller.on('create_bot', function(bot, config) {
      if (_bots[bot.config.token]) {
        // already online! do nothing.
      } else {
        bot.startRTM(function(err) {
          if (err) {
            die(err);
          }

          _trackBot(bot);

          // save team info if it's not in the db
          controller.storage.teams.get({ id: bot.team_info.id }).then((team) => {
            if(!team.length) {
              controller.storage.teams.save(bot.config)
            }
          });

          // init the botkit with a welcome message
          bot.startPrivateConversation({ user: config.createdBy }, function(
            err,
            convo
          ) {
            if (err) {
              console.log(err);
            } else {
              convo.say(
                'I am your pantry assistant, lets eat, drink and be merry!'
              );
              convo.say(
                'You must now /invite me to a channel so that I can be of use!'
              );
            }
          });
        });
      }
    });

    // doing a blank document search via all is blowing up, fix this
    // this assumes a team has been seeded to the db
    // connect all teams with bots up to slack!

    controller.storage.teams.all(function(err, teams) {
      if (err) throw new Error(err);

      if (teams.length) {
        for (var t in teams) {
          if (teams[t].bot) {
            var bot = controller.spawn(teams[t]).startRTM(function(err) {
              if (err) {
                console.log('Error connecting bot to Slack:', err);
              } else {
                _trackBot(bot);
              }
            });
          }
        }
      }
    });

    return controller;
  }
};
