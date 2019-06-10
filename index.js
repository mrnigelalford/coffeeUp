require('dotenv').config();
const request = require('request');
const Firestore = require('@google-cloud/firestore');
const db = require('./lib/db');
const helper = require('./lib/helpers');

const COLLECTION_NAME = process.env.FIREBASE_COLLECTION;
const firestore = new Firestore();

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

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */

exports.coffeeHTTP = (req, res) => {
  switch (req.method) {
    case 'DELETE':
      throw 'not yet built';
    case 'POST':
      // store/insert a new document
      var data = JSON.parse(req.body.payload);
      var increment = Firestore.FieldValue.increment(1);
      var id = data.actions[0].value;
      var actionName = data.actions[0].name;
      var teamId = data.team.id;
      const firestoreRef = firestore
        .collection('teams')
        .doc(teamId)
        .collection('coffee')
        .doc(id);

      // const name = query(teamId, id).then(doc => {
      //   if(doc) {
      //     return itemName = doc[0].name
      //   }
      // });

      switch (actionName) {
        case 'like':
          return firestoreRef
            .update({ likes: increment })
            .then(() => {
              return res
                .status(200)
                .send(
                  `thanks, your like has been noted, I'll try to keep that coffee around for you`
                );
            }) // send a slack formatted message back
            .catch(err =>
              res.status(404).send({ error: 'unable to store', err })
            );
        case 'dislike':
          return firestoreRef
            .update({ dislikes: increment })
            .then(() =>
              res
                .status(200)
                .send(
                  "thanks, your dislike has been noted, I'll work on getting less of that coffee "
                )
            )
            .catch(err =>
              res.status(404).send({ error: 'unable to store', err })
            );
        case 'brew':
          return firestoreRef
            .update({ brew_date: Date.now() })
            .then(() =>
              res
                .status(200)
                .send('excellent, I love when more coffee is brewed')
            )
            .catch(err =>
              res.status(404).send({ error: 'unable to store', err })
            );
        default:
          return firestoreRef
            .set({
              id,
              name: data.name,
              roaster: data.roaster,
              brew_date: null,
              likes: 0,
              dislikes: 0,
            })
            .then(() => {
              return res.status(200).send(doc);
            })
            .catch(err =>
              res.status(404).send({ error: 'unable to store', err })
            );
      }
    case 'GET': // read/retrieve an existing document by id
      if (!(req.query && req.query.id)) {
        return res.status(404).send({ error: 'No Id' });
      }
      var id = req.query.id.replace(/[^a-zA-Z0-9]/g, '').trim();
      if (!(id && id.length)) {
        return res.status(404).send({ error: 'Empty Id' });
      }
      return firestore
        .collection(COLLECTION_NAME)
        .doc(id)
        .then(doc => {
          if (!(doc && doc.exists)) {
            return res
              .status(404)
              .send({ error: 'Unable to find the document' });
          }
          return res.status(200).send(doc.data());
        })
        .catch(err => res.status(404).send({ error: err }));
  }
};

exports.coffeeEvents = (req, res) => {
  let response_text;
  // always respond with a 200 when recieved.
  // process results in a seperate function and send a new call back when needed
  var payload = req.body;
  if (payload.challenge) {
    return res
      .status(200)
      .type('json')
      .send({
        challenge: payload.challenge,
      });
  }

  // send body to factory for processing
  res.sendStatus(200);

  if (payload.event.type !== 'message' && !payload.event.text) {
    return false;
  }

  const channel = req.body.event.channel;
  const teamId = payload.team_id;

  if (payload.event.text.match(/(sup)/gi)) {
    postMessage({ text: helper.greeting.whatsUp(), channel: channel });
  }

  if (payload.event.text.match(/(add coffee: )/gi)) {
    addCoffee(payload.event.text, teamId).then(coffee =>
      postMessage({
        text: 'congrats *' + coffee.name + '* was saved, happy snacking!',
        channel: channel,
      })
    );
  }

  if (payload.event.text.match(/(menu)/g)) {
    postMessage({
      text:
        'searching while drinking coffee, nothing to see here or worry about...',
      channel: channel,
    });

    db.getTodaysBrewedCoffee(teamId).then(coffee => {
      count = 0;
      if (coffee) {
        return postMessage({
          channel: channel,
          attachments: helper.setSlackResponse(coffee),
          text: "I am a test message http://slack.com",
        });
      } else {
        return postMessage({
          text: 'no coffee found, brew up and try again',
          channel: channel,
        });
      }
    });
  }

  function postMessage(msg) {
    if(msg.text) {
      request.post(
        {
          url: 'https://slack.com/api/chat.postMessage',
          form: {
            token: process.env.SLACK_TOKEN,
            text: msg.text,
            channel: msg.channel,
            attachments: msg.attachments,
            blocks: msg.blocks
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
};
