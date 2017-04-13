const bearychat = require('bearychat');
const invariant = require('invariant');

class P2PMessageBuilder {
  constructor() {
    this.vchannel_id = null;
    this.to_uid = null;
    this.text = null;
    this.refer_key = null;
  }

  withVchannelID(vchannelID) {
    this.vchannel_id = vchannelID;
    return this;
  }

  withUserID(userID) {
    this.to_uid = userID;
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
      'vchannel_id is required to build a p2p message.'
    );

    invariant(
      this.to_uid,
      'user_id is required to build a p2p message.'
    );

    invariant(
      this.text,
      'text is required to build a p2p message'
    );

    return {
      type: bearychat.rtm.message.type.P2P_MESSAGE,
      vchannel_id: this.vchannel_id,
      to_uid: this.to_uid,
      text: this.text,
      refer_key: this.refer_key
    };
  }
}

exports.default = P2PMessageBuilder;
module.exports = exports.default;
