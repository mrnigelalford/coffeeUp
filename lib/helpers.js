const request = require('request');

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

  coffee.forEach(({ name, roaster, url, id }) => {
    attachments.push({
      text: `<${url}|${name}> by: *${roaster}*`,
      callback_id: 'coffee_like',
      attachment_type: 'default',
      fallback: 'Attachment ' + id + ' Fallback',
      actions: [
        {
          text: ':coffee:',
          name: 'brew',
          type: 'button',
          value: id, // send over id to give backend a lookup id, fix this
        },
        {
          text: ':thumbsup:',
          name: 'like',
          type: 'button',
          value: id,
        },
        {
          text: ':thumbsdown:',
          name: 'dislike',
          type: 'button',
          value: id,
        },
      ],
    });
  });

  return attachments;
}

function query(teamId, docId) {
  return firestore
    .collection('teams')
    .doc(teamId)
    .collection('coffee')
    .doc(docId)
    .get()
    .then(records => {
      if (records.empty) {
        return [];
      } else {
        return records.docs.map(result => result.data());
      }
    });
}

function postMessage(msg) {
  if (msg.text) {
    request.post(
      {
        url: 'https://slack.com/api/chat.postMessage',
        form: {
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
          console.log('body: ', body);
        }
      }
    );
  }
  //
}

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

  return db.nestedSave(newFood, teamId).then(pantryItem => pantryItem);
}

module.exports = {
  greeting: {
    whatsUp: () => answerWhatsup(),
  },
  setSlackResponse: coffee => setMessage(coffee),
  postMessage: msg => postMessage(msg),
  addCoffee: (coffee, teamID) => addCoffee(coffee, teamID),
  replaceMessage: msg => replaceMessage(msg),
};
