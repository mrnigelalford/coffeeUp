const Firestore = require('@google-cloud/firestore');

const firestore = new Firestore();

var exports = (module.exports = {});

exports.getTodaysBrewedCoffee = (teamId) => {
  return firestore
    .collection('teams')
    .doc(teamId)
    .collection('coffee')
    .where('brew_date', '>', new Date().setHours(7))
    .where('brew_date', '<', new Date().setHours(19))
    .get()
    .then((records) => {
      count = 0;
      if (records.empty) {
        return [];
      } else {
        return records.docs.map((result) => result.data());
      }
    });
};

exports.nestedSave = (pantryItem, teamId) => {
  return firestore
    .collection('teams')
    .doc(teamId)
    .collection('coffee')
    .doc(pantryItem.id)
    .set(pantryItem, { merge: true })
    .then((doc) => {
      if (!doc) {
        return 'error saving your item, please try again or contact your admin';
      } else {
        return pantryItem;
      }
    })
    .catch((error) => {
      console.error(error);
    });
};

exports.nestedQuery = (teamId, query) => {
  return firestore
    .collection('teams')
    .doc(teamId)
    .collection('coffee')
    .where(query)
    .get()
    .then((records) => {
      if (records.empty) {
        return [];
      } else {
        return records.docs.map((result) => result.data());
      }
    })
    .catch((error) => {
      console.error(error);
    });
};

exports.nestedCompoundQuery = (bot, query) => {
  const first = query.query.first;
  const second = query.query.second;

  return firestore
    .collection('teams')
    .doc(bot.team_info.id)
    .collection('coffee')
    .where(first[0], first[1], first[2])
    .where(second[0], second[1], second[2])
    .get()
    .then((records) => {
      if (records.empty) {
        return 'nothing found, brew up and try again';
      } else {
        return records.docs.map((result) => result.data());
      }
    })
    .catch((error) => {
      console.error(error);
    });
};

exports.query = (collectionName) => {
  return firestore
    .collection(collectionName)
    .get()
    .then((records) => {
      if (records.empty) {
        return [];
      } else {
        return records.docs.map((result) => result.data());
      }
    })
    .catch((error) => {
      console.error(error);
    });
};

exports.save = (bot) => {
  return firestore
    .collection('teams')
    .doc(bot.team_id)
    .set(bot.config, { merge: true })
    .then((doc) => {
      if (!doc) {
        return [];
      } else {
        return doc;
      }
    })
    .catch((error) => {
      console.error(error);
    });
};
