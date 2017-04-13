const WebSocket = require('ws');
const bearychat = require('bearychat');
const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
const co = require('co');
const delay = require('delay');
const RTMConnectionEvents = require('./RTMConnectionEvents');
const RTMConnectionState = require('./RTMConnectionState');
const warning = require('warning');


/**
 *    INITIAL
 *       +
 *       |
 *       |
 *       v
 *   CONNECTED +-+
 *       +       |
 * client|       |
 * close |       | server
 *       v       | close/
 *    CLOSING    | error
 *       +       |
 *       |       |
 *       |       |
 *       v       |
 *    CLOSED <---+
 */
class RTMConnection extends EventEmitter {
  constructor(url) {
    super();
    this._currentCallId = 0;
    this._state = RTMConnectionState.INITIAL;
    this._ws = new WebSocket(url);
    this._callbackMap = new Map();

    this._ws.on('open', this._handleOpen.bind(this));
    this._ws.on('close', this._handleClose.bind(this));
    this._ws.on('message', this._handleMessage.bind(this));
    this._ws.on('error', this._handleError.bind(this));
  }

  _handleOpen() {
    this._state = RTMConnectionState.CONNECTED;
    this.emit(RTMConnectionEvents.OPEN);
    this._startLoop();
  }

  _handleClose() {
    this._state = RTMConnectionState.CLOSED;
    this.emit(RTMConnectionEvents.CLOSE);
  }

  _handleMessage(data) {
    const message = JSON.parse(data);
    switch(message.type) {
      case bearychat.rtm.message.type.PONG:
      case bearychat.rtm.message.type.OK:
        // ignore deprecated events
        break;
      case bearychat.rtm.message.type.REPLY:
        this._handleReplyMessage(message);
        break;
      default:
        this.emit(RTMConnectionEvents.MESSAGE, message);
    }
  }

  _handleReplyMessage(message) {
    const callbackMap = this._callbackMap;
    const callId = message.call_id;

    warning(
      callbackMap.has(callId),
      'Call id replied without sending: %s',
      callId
    );

    const callback = callbackMap.get(callId);
    callbackMap.delete(callId);
    callback(message);
  }

  _handleError(error) {
    this.emit(RTMConnectionEvents.ERROR, error);
  }

  _getNextCallId() {
    return this._currentCallId++;
  }

  send(message) {
    if (!message.call_id) {
      message = _.assign({}, message, {
        call_id: this._getNextCallId()
      });
    }

    const callIdMap = this._callbackMap;
    const callId = message.call_id;
    warning(
      !callIdMap.has(callId),
      'Duplicate call id %s',
      callId
    );

    return new Promise((resolve) => {
      callIdMap.set(callId, resolve);
      this._ws.send(JSON.stringify(message));
    });
  }

  _ping() {
    this.send({
      type: bearychat.rtm.message.type.PING
    });
  }

  _startLoop() {
    const process = function *() {
      while (this._state === RTMConnectionState.CONNECTED) {
        this._ping();
        yield delay(5000);
      }
    };
    co(process.bind(this));
  }

  close() {
    this._state = RTMConnectionState.CLOSING;
    this._ws.close();
  }

  getState() {
    return this._state;
  }
}

exports.default = RTMConnection;
module.exports = exports.default;
