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

      var body = req.body.payload;

      if (!body)
        return res
          .status(400)
          .send('please send a body payload or reformat your call');

      body = JSON.parse(body);

      var increment = Firestore.FieldValue.increment(1);
      var id = body.actions[0].value;
      var actionName = body.actions[0].name;
      var teamId = body.team.id;
      var response_url = body.response_url;
      var color =
        body.original_message.attachments[Number(body.attachment_id) - 1].color;
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
  var body = req.body;
  if (body.challenge) {
    res
      .status(200)
      .type('json')
      .send({
        challenge: body.challenge,
      });
  } else {
    res.status(200).send('');

    // improve this protection
    if (body.event && body.event.type === 'message') {
      const text = body.event.text;
      const channel = body.event.channel;
      const teamId = body.team_id;

      if (text && text.match(/(sup)/gi)) {
        helper.postMessage({
          text: helper.greeting.whatsUp(),
          channel,
          teamId,
        });
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
        firestore
          .collection('teams')
          .doc(teamId)
          .collection('coffee')
          .get()
          .then((coffee) => {
            coffee = coffee.docs.map((result) => result.data());
            if (coffee.length > 0) {
              const attachments = JSON.stringify(
                helper.setSlackResponse(coffee)
              );
              helper.postMessage({
                channel,
                attachments,
                teamId,
                text: "Here's what I found",
              });
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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/events', (req, res) => coffeeEvents(req, res));

app.post('/http', (req, res) => coffeeHTTP(req, res));

app.post('/oauth', (req, res) => oauth(req, res));

app.post('/auth', (req, res) => auth(req, res));

app.listen(8080, () => console.log('coffee has been brewed'));
