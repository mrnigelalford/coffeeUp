require('dotenv').config();
require('@google-cloud/debug-agent').start();

const Firestore = require('@google-cloud/firestore');
const bodyParser = require('body-parser');

const helper = require('./lib/helpers');

const firestore = new Firestore({
  projectId: 'pantry-api-240403',
  keyFilename: helper.getDBKey(),
});

const express = require('express');
const app = express();


/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */

coffeeHTTP = (req, res) => {
  switch (req.method) {
    case 'DELETE':
      throw 'not yet built';
    case 'POST':
      // store/insert a new document
      if (!req.body.payload)
        return res
          .status(400)
          .send('please send a body payload or reformat your call');

      var data = req.body.payload;
      var increment = Firestore.FieldValue.increment(1);
      var id = data.actions[0].value;
      var actionName = data.actions[0].name;
      var teamId = data.team.id;
      var response_url = data.response_url;
      var color =
        data.original_message.attachments[Number(data.attachment_id) - 1].color;
      var text = '';

      const firestoreRef = firestore
        .collection('teams')
        .doc(teamId)
        .collection('coffee')
        .doc(id);

      res.status(200).send('');

      switch (actionName) {
        case 'like':
          return firestoreRef
            .update({ likes: increment })
            .then(() =>
              helper.replaceMessage({
                response_url,
                text: `thanks, your like has been noted, I'll try to keep that coffee around for you`,
              })
            ) // send a slack formatted message back
            .catch((err) =>
              helper.replaceMessage({
                response_url,
                text: err.message,
              })
            );
        case 'dislike':
          return firestoreRef
            .update({ dislikes: increment })
            .then(() =>
              helper.replaceMessage({
                response_url,
                text:
                  "thanks, your dislike has been noted, I'll work on getting less of that coffee ",
              })
            )
            .catch((err) =>
              helper.replaceMessage({
                response_url,
                text: err,
              })
            );
        case 'brew':
          if (color) {
            color = '';
            text = 'mmmm....Good to the last drop :smile:';
          } else {
            color = '#32CD32';
            text = 'excellent, I love when more coffee is brewed :coffee:';
          }

          return firestoreRef
            .update({ brew_date: Date.now(), color })
            .then(() =>
              helper.replaceMessage({
                response_url,
                text,
              })
            )
            .catch((err) =>
              helper.replaceMessage({
                response_url,
                text: err,
              })
            );
        case 'delete':
          return firestoreRef
            .delete()
            .then(() =>
              helper.replaceMessage({
                response_url,
                text: 'that coffee is out of here!',
              })
            )
            .catch((err) =>
              helper.replaceMessage({
                response_url,
                text: err,
              })
            );
      }
  }
};

coffeeEvents = (req, res) => {
  // always respond with a 200 when recieved.
  var payload = req.body;
  if (payload.challenge) {
    res
      .status(200)
      .type('json')
      .send({
        challenge: payload.challenge,
      });
  }

  res.status(200).send('');

  // improve this protection
  if (payload.event && payload.event.type === 'message') {
    const text = payload.event.text;
    const channel = payload.event.channel;
    const teamId = payload.team_id;

    if (text && text.match(/(sup)/gi)) {
      helper.postMessage({ text: helper.greeting.whatsUp(), channel, teamId });
    }

    if (text && text.match(/(add coffee: )/gi)) {
      helper.addCoffee(text, teamId).then((coffee) =>
        helper.postMessage({
          channel,
          teamId,
          text:
            'congrats *' + coffee.name + '* was saved, lets pour a cup now!',
        })
      );
    }

    if (text && text.match(/(menu)/gi)) {
      const currentMenu = helper.currentMenu();
      if (currentMenu.length) {
        helper.postMessage({
          channel,
          teamId,
          attachments: currentMenu,
          text: "Here's what I found",
        });
      }

      firestore
        .collection('teams')
        .doc(teamId)
        .collection('coffee')
        .get()
        .then((coffee) => {
          coffee = coffee.docs.map((result) => result.data());
          if (coffee.length > 0) {
            const attachments = JSON.stringify(helper.setSlackResponse(coffee));
            if (attachments !== currentMenu) {
              helper.currentMenu(attachments);
              helper.deleteMsg();
              helper.postMessage({
                channel,
                attachments,
                teamId,
                text: "Here's what I found",
              });
            }
          } else {
            helper.postMessage({
              channel,
              text: 'no coffee found, brew up and try again',
              teamId,
            });
          }
        });
    }
  }
};

oauth = (req, res) => {
  if (!req.subdomains.length) {
    return res.redirect('http://coffeeup.co');
  }

  helper.requestAuth(
    {
      code: req.query.code,
      redirect_uri: process.env.REDIRECT_URI,
    },
    (result) => {
      if (result.status) {
        res
          .status(200)
          .send(
            'congratulations! You are now able to coffeeUp your workspace!'
          );
      } else {
        res.status(500).send(result.msg);
      }
    }
  );
};

auth = (req, res) => {
  res.sendFile(__dirname + '/add_to_slack.html');
};

app.use(bodyParser.json({ type: 'application/json' }));

app.post('/coffeeEvents', (req, res) => {
  return coffeeEvents(req, res);
});

app.post('/coffeeHttp', (req, res) => {
  console.log('heard http');
  return coffeeHTTP(req, res);
});

app.post('/oauth', (req, res) => {
  return oauth(req, res);
});

app.post('/auth', (req, res) => {
  return auth(req, res);
});

app.listen(8080, () => {
  console.log('loading');
});
