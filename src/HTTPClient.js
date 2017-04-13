const bearychat = require('bearychat');
const _ = require('lodash');
const warning = require('warning');

const httpMethodPaths = [
  'team.info',

  'user.info',
  'user.me',
  'user.list',

  'channel.info',
  'channel.list',
  'channel.create',
  'channel.archive',
  'channel.unarchive',
  'channel.leave',
  'channel.join',
  'channel.invite',
  'channel.kick',

  'session_channel.info',
  'session_channel.list',
  'session_channel.create',
  'session_channel.archive',
  'session_channel.convert_to_channel',
  'session_channel.leave',
  'session_channel.invite',
  'session_channel.kick',

  'p2p.info',
  'p2p.list',
  'p2p.create',

  'message.query',
  'message.info',
  'message.create',
  'message.delete',
  'message.update_text',

  'emoji.list',

  'sticker.list',

  'rtm.start',
];

class HTTPClient {
  constructor(token) {
    httpMethodPaths.forEach(methodPath => {
      const func = _.get(bearychat, methodPath);
      _.set(this, methodPath, genMethodWithToken(func, token));
    });
  }
}

function genMethodWithToken(func, token) {
  return function(params) {
    params = _.clone(params) || {};
    warning(
      !params.token,
      'Calling HTTP method with another token other than the one used to initialize HTTPClient.'
    );
    params.token = token;

    return func.call(this, params).then(parseJSON);
  }
}

function parseJSON(resp) {
  return resp.json();
}

exports.default = HTTPClient;
module.exports = exports.default;
