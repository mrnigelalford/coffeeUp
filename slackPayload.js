const slackPayload = {
  type: 'interactive_message',
  actions: [{ name: 'like', type: 'button', value: 'coffeeId' }],
  callback_id: 'coffee_like',
  team: { id: 'TG1PAA6M7', domain: 'alfordfam' },
  channel: { id: 'DJ3NSA011', name: 'directmessage' },
  user: { id: 'UG1KCNYPJ', name: 'ngalford' },
  action_ts: '1559162700.662479',
  message_ts: '1559162699.002700',
  attachment_id: '1',
  token: 'IqLSvWI77L6YEVdj7HtIj46Y',
  is_app_unfurl: false,
  original_message: {
    bot_id: 'BJF5MQ4N9',
    type: 'message',
    text: '',
    user: 'UJH1RK7RD',
    ts: '1559162699.002700',
    attachments: [
      {
        callback_id: 'coffee_like',
        fallback: 'ranking is down, check back later',
        text: '<http://test.com|test.com|wed> by: *test roaster*',
        id: 1,
        actions: [
          {
            id: '1',
            name: 'brew',
            text: ':coffee:',
            type: 'button',
            value: 'coffee_brew',
            style: ''
          },
          {
            id: '2',
            name: 'like',
            text: ':thumbsup:',
            type: 'button',
            value: 'coffee_like',
            style: ''
          },
          {
            id: '3',
            name: 'dislike',
            text: ':thumbsdown:',
            type: 'button',
            value: 'coffee_dislike',
            style: ''
          }
        ]
      }
    ]
  },
  response_url:
    'https://hooks.slack.com/actions/TG1PAA6M7/651575592279/XL3bXdDTwX2pxXH0epxp1Jr4',
  trigger_id: '638324049666.545792346721.5ff232117d0ad2e2ba8d20379c231e8f'
};