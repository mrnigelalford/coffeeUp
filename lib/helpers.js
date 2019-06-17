const request = require('request');
const db = require('./db');
const Storage = require('@google-cloud/storage');

const Firestore = require('@google-cloud/firestore');
const firestore = new Firestore();

const scope = {
  attachments: [],
  previousMsg: {
    timestamp: null,
    channel: null,
  },
  counter: 0,
  teamId: null,
  access_token: null,
};

function accessToken(teamId) {
  return firestore
    .collection('teams')
    .doc(teamId)
    .get()
    .then((team) => {
      return team.data().bot_access_token;
    });
}

function answerWhatsup() {
  const greetings = [
    "nm....chillin' like a villan",
    'drinking coffee and reading the paper, you?',
    "Now that you're here, my mood!",
    "If I told you, I'd have to kill you.",
    "'up' is a two letter english word.",
  ];

  return greetings[Math.floor(Math.random() * greetings.length)];
}

function setMessage(coffee) {
  var attachments = [];

  coffee.forEach(({ name, roaster, url, id, color }) => {
    attachments.push({
      text: `<${url}|${name}> by: *${roaster}*`,
      callback_id: 'coffee_like',
      attachment_type: 'default',
      fallback: 'Attachment ' + id + ' Fallback',
      color,
      actions: [
        {
          text: ':coffee:',
          name: 'brew',
          type: 'button',
          value: id, // send over id to give backend a lookup id, fix this
        },
        /* {
          text: ':thumbsup:', // add these buttons back when you have matching functionality
          name: 'like',
          type: 'button',
          value: id,
        },
        {
          text: ':thumbsdown:',
          name: 'dislike',
          type: 'button',
          value: id,
        }, */
        {
          text: ':wastebasket:',
          name: 'delete',
          type: 'button',
          value: id,
        },
      ],
    });
  });

  return attachments;
}

function getAllCoffee(teamId) {
  return firestore
    .collection('teams')
    .doc(teamId)
    .collection('coffee')
    .get()
    .then((records) => {
      if (records.empty) {
        return [];
      } else {
        return records.docs.map((result) => result.data());
      }
    });
}

function postMessage(msg) {
  if (!msg.text) {
    return false;
  }

  function post() {
    scope.counter++;
    request.post(
      {
        url: 'https://slack.com/api/chat.postMessage',
        form: {
          token: scope.access_token,
          text: msg.text,
          channel: msg.channel,
          attachments: msg.attachments,
          blocks: msg.blocks,
        },
      },
      (err, res, body) => {
        if (err) {
          console.error('error: ', err);
        }
        if (res) {
          console.log('sent: ', res);
        }
        if (body) {
          body = JSON.parse(body);
          scope.previousMsg.timestamp = body.ts;
          scope.previousMsg.channel = body.channel;
          if (scope.counter > 1) {
            deleteMSG(scope.previousMsg.timestamp, scope.previousMsg.channel);
          }
          scope.counter = 0;
          console.log(
            'body: ',
            scope.previousMsg.timestamp + ' : ' + scope.previousMsg.channel
          );
        }
      }
    );
  }

  if (!scope.access_token) {
    accessToken(msg.teamId).then((token) => {
      scope.access_token = token;
      post();
    });
  } else {
    post();
  }
}

/**
 * slack verification getter for a new bot installation.
 *
 * @param {Object} info
 *    [options]
 *        - code - string (required)
 *        - redirect_uri (required)
 *
 */

function requestAuth(info, callback) {
  var options = {
    uri:
      'https://slack.com/api/oauth.access?code=' +
      info.code +
      '&client_id=' +
      process.env.CLIENT_ID +
      '&client_secret=' +
      process.env.CLIENT_SECRET +
      '&redirect_uri=' +
      info.redirect_uri,
    method: 'GET',
  };

  request(options, (err, res, body) => {
    body = JSON.parse(body);
    if (!body.ok) {
      return callback({
        status: false,
        msg: 'Error encountered: \n' + JSON.stringify(body),
      });
    } else {
      db.save({
        team_id: body.team_id,
        config: body.bot,
      })
        .then(() => {})
        .catch((err) => {
          console.error(err);
        });

      return callback({
        status: true,
        msg: 'Success!',
      });
    }
  });
}

/**
 * Single JSON file reader
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */

function getDBKey() {
  const bucketName = 'pantry-api-240403.appspot.com';
  const fileName = 'pantry-api-secret.json';
  const storage = new Storage.Storage();
  const file = storage.bucket(bucketName).file(fileName);

  file.download((err, contents) => {
    // needs error handling
    return contents;
  });
}

/**
 * overwrite the previous message with a new message
 *
 * @param {Object} msg
 *    [options]
 *        - response_url: string (required)
 *        - text: string (required)
 *
 */

function replaceMessage(msg) {
  request.post({
    url: msg.response_url,
    json: true,
    body: {
      text: msg.text,
      replace_original: 'true',
    },
  });
}

function addCoffee(msg, teamId) {
  var name = msg
    .substring(msg.lastIndexOf('coffee: ') + 7, msg.lastIndexOf('by: '))
    .trim();
  var roaster = msg
    .substring(msg.lastIndexOf('by: ') + 4, msg.lastIndexOf('url'))
    .trim();
  var url = msg
    .substring(msg.lastIndexOf('url: ') + 5, msg.length)
    .replace(/[<>]/g, '')
    .trim();

  var newFood = {
    docId: teamId,
    subCollection: 'coffee',
    id: name
      .concat(roaster)
      .replace(/ /g, '')
      .toLowerCase(),
    name,
    roaster,
    brew_date: Date.now(),
    likes: 0,
    dislikes: 0,
    url: url,
  };

  return db.nestedSave(newFood, teamId).then((pantryItem) => pantryItem);
}

function currentMenu(attachment) {
  if (attachment) {
    scope.attachments = attachment;
  }
  return scope.attachments;
}

function deleteMSG(timestamp, channel) {
  if (
    scope.previousMsg.timestamp &&
    scope.previousMsg.channel &&
    scope.access_token
  ) {
    request.post({
      url: 'https://slack.com/api/chat.delete',
      form: {
        token: scope.access_token,
        ts: timestamp || scope.previousMsg.timestamp,
        channel: channel || scope.previousMsg.channel,
      },
    });
  }
}

module.exports = {
  greeting: {
    whatsUp: () => answerWhatsup(),
  },
  setSlackResponse: (coffee) => setMessage(coffee),
  postMessage: (msg) => postMessage(msg),
  addCoffee: (coffee, teamID) => addCoffee(coffee, teamID),
  replaceMessage: (msg) => replaceMessage(msg),
  getAllCoffee: (teamID) => getAllCoffee(teamID),
  getDBKey: () => getDBKey(),
  currentMenu: (attachment) => currentMenu(attachment),
  deleteMsg: (time, channel) => deleteMSG(time, channel),
  requestAuth: (msg, cb) => requestAuth(msg, cb),
};
