const bearychat = require('bearychat');
const invariant = require('invariant');

class ChannelMessageBuilder {
  constructor() {
    this.vchannel_id = null;
    this.channel_id = null;
    this.text = null;
    this.refer_key = null;
  }

  withVchannelID(vchannelID) {
    this.vchannel_id = vchannelID;
    return this;
  }

  withChannelID(channelID) {
    this.channel_id = channelID;
    return this;
  }

  withText(text) {
    this.text = text;
    return this;
  }

  withReferKey(referKey) {
    this.refer_key = referKey;
  }

  build() {
    invariant(
      this.vchannel_id,
      'vchannel_id is required to build a channel message.'
    );

    invariant(
      this.channel_id,
      'channel_id is required to build a channel message.'
    );

    invariant(
      this.text,
      'text is required to build a channel message'
    );

    return {
      type: bearychat.rtm.message.type.CHANNEL_MESSAGE,
      vchannel_id: this.vchannel_id,
      channel_id: this.channel_id,
      text: this.text,
      refer_key: this.refer_key
    };
  }
}

exports.default = ChannelMessageBuilder;
module.exports = exports.default;
