const bearychat = require('bearychat');
const readline = require('mz/readline');
const co = require('co');
const invariant = require('invariant');
const RTMClient = require('bearychat-rtm-client/RTMClient');
const RTMClientEvents = require('bearychat-rtm-client/RTMClientEvents');
const RTMClientState = require('bearychat-rtm-client/RTMClientState');
const HTTPClient = bearychat.HTTPClient;
const P2PMessageBuilder = require('./src/builders/P2PMessageBuilder');
const ChannelMessageBuilder = require('./src/builders/ChannelMessageBuilder');
const WebSocket = require('ws');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const token = process.env.HUBOT_TOKEN;

if (!token) {
  console.error('Auth token required');
  process.exit(1);
}

const httpClient = new HTTPClient(token);
const rtmClient = new RTMClient({
  url() {
    return httpClient.rtm.start()
      .then(data => data.ws_host);
  },
  WebSocket: WebSocket
});

start();

let me;

function start() {
  rtmClient.on(RTMClientEvents.ONLINE, () => {
    console.log('Client online.');
    co(function *() {
      me = yield httpClient.user.me();

      yield selectFunction();
    });
  });
  rtmClient.on(RTMClientEvents.OFFLINE, () => {
    console.log('Client offline.');
  });
  rtmClient.on(RTMClientEvents.CLOSE, () => {
    console.log('Client closed.');
    rl.close();
  });
  rtmClient.on(RTMClientEvents.EVENT, (message) => {
    switch (message.type) {
      case bearychat.rtm.message.type.P2P_MESSAGE:
      case bearychat.rtm.message.type.CHANNEL_MESSAGE:
        handleMessage(message);
        break;
      default:
    }
  });
  rtmClient.on(RTMClientEvents.ERROR, (error) => {
    console.error('Error: ', error);
  });
}

function handleMessage(message) {
  co(function *() {
    if (message.uid !== me.id) {
      yield printMessage(message);
    }
  });
}

function *printMessage(message) {
  const user = yield httpClient.user.info({
    user_id: message.uid
  });
  console.log(`${getUserDiaplay(user)}: ${message.text}`);
}

function *selectFunction() {
  const config = [{
    label: 'P2P对话',
    func: talkToUser
  }, {
    label: '讨论组对话',
    func: talkInChannel
  }];

  config.forEach((funcConfig, index) => {
    console.log(`${index + 1}. ${funcConfig.label}`);
  });

  while (true) {
    const answer = yield rl.question('Select function:');
    const number = parseInt(answer, 10);
    if (number > 0 && number <= config.length) {
      const func = config[number - 1].func;
      yield func();
      break;
    }
  }
}

function *talkToUser() {
  const p2pInfo = yield selectUser();
  const user = p2pInfo.user;
  const vchannel = p2pInfo.vchannel;

  yield printVchannelHistory(vchannel.id);

  const builder = new P2PMessageBuilder()
    .withVchannelID(vchannel.id)
    .withUserID(user.id);

  while (rtmClient.getState() === RTMClientState.CONNECTED) {
    const messageText = yield rl.question('Message(empty line to exit): ');
    if (messageText) {
      const message = builder.withText(messageText).build();
      rtmClient.send(message);
    } else {
      rtmClient.close();
      break;
    }
  }
}

function *talkInChannel() {
  let channel = yield selectChannel();

  if (!channel.is_member) {
    channel = yield httpClient.channel.join({
      channel_id: channel.id
    });
  }

  yield printVchannelHistory(channel.vchannel_id);

  const builder = new ChannelMessageBuilder()
    .withVchannelID(channel.vchannel_id)
    .withChannelID(channel.id);

  while (rtmClient.getState() === RTMClientState.CONNECTED) {
    const messageText = yield rl.question('Message(empty line to exit): ');
    if (messageText) {
      const message = builder.withText(messageText).build();
      rtmClient.send(message);
    } else {
      rtmClient.close();
      break;
    }
  }
}

function *selectUser() {
  const users = yield getUserList();
  users.forEach((user, index) =>
    console.log(`${index + 1}. ${getUserDiaplay(user)}`));

  let user;
  while (true) {
    const answer = yield rl.question('Who are you talking to?');

    // try index
    const number = parseInt(answer, 10);
    if (number > 0 && number <= users.length) {
      user = users[number - 1];
      break;
    }

    // try name
    user = users.find(u => u.name === answer);
    if (user) {
      break;
    }
  }

  return {
    user: yield httpClient.user.info({
      user_id: user.id
    }),
    vchannel: yield httpClient.p2p.create({
      user_id: user.id
    })
  }
}

function *selectChannel() {
  const channels = yield httpClient.channel.list();
  channels.forEach((channel, index) =>
    console.log(`${index + 1}. ${channel.name}`));

  let channel;
  while (true) {
    const answer = yield rl.question('Which channel are you talking in?');

    // try index
    const number = parseInt(answer, 10);
    if (number > 0 && number <= channels.length) {
      channel = channels[number - 1];
      break;
    }

    // try name
    channel = channels.find(c => c.name === answer);
    if (channel) {
      break;
    }
  }

  return yield httpClient.channel.info({
    channel_id: channel.id
  });
}

function *getUserList() {
  const users = yield httpClient.user.list();
  return users.filter(user => !user.inactive && user.type === 'normal');
}

function getUserDiaplay(user) {
  return `${user.name}(${user.full_name})`;
}

function *getLatestMessageForVchannelID(vchannelID, limit) {
  limit = limit || 20;
  return yield httpClient.message.query({
    vchannel_id: vchannelID,
    query: {
      latest: {
        limit: limit
      }
    }
  });
}

function *printVchannelHistory(vchannelID) {
  const history = yield getLatestMessageForVchannelID(vchannelID);
  console.log('\n******** history start ********');
  for (let i = 0; i < history.messages.length; ++i) {
    yield printMessage(history.messages[i]);
  }
  console.log('********* history end *********\n');
}
