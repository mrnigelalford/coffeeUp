function answerWhatsup() {
  const greetings = [
    "nm....chillin' like a villan",
    'drinking coffee and reading the paper, you?',
    "Now that you're here, my mood!",
    "If I told you, I'd have to kill you.",
    "'up' is a two letter english word."
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
          value: id // send over id to give backend a lookup id, fix this
        },
        {
          text: ':thumbsup:',
          name: 'like',
          type: 'button',
          value: id
        },
        {
          text: ':thumbsdown:',
          name: 'dislike',
          type: 'button',
          value: id
        }
      ]
    });
  });

  return attachments;
}

module.exports = {
  greeting: {
    whatsUp: () => answerWhatsup()
  },
  setSlackResponse: coffee => setMessage(coffee)
};
