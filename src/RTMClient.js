const bearychat = require('bearychat');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const RTMClientState = require('./RTMClientState');
const RTMClientEvents = require('./RTMClientEvents');
const RTMConnection = require('./RTMConnection');
const RTMConnectionEvents = require('./RTMConnectionEvents');
const co = require('co');
const delay = require('delay');
const invariant = require('invariant');

class RTMTimeoutError extends Error {
  constructor(errorMessage, rtmMessage) {
    super(errorMessage);
    this.rtmMessage = rtmMessage;
  }
}

/**
 *                    INITIAL
 *                       +
 *          error        |
 *      +-------------+  |
 *      v             +  v        connect
 *  RECONNECT+------->CONNECTING<---------+CLOSED
 *      ^                +                    ^
 *      |                |                    |
 *      |    server      |                    |
 *      |    close/      v        close       +
 *      +------------+CONNECTED+---------->CLOSING
 *           error
 */
class RTMClient extends EventEmitter {
  constructor(token) {
    super();

    this._eventHandlerMap = {
      [RTMConnectionEvents.OPEN]: this._handleConnectionOpen.bind(this),
      [RTMConnectionEvents.CLOSE]: this._handleConnectionClose.bind(this),
      [RTMConnectionEvents.ERROR]: this._handleConnectionError.bind(this),
      [RTMConnectionEvents.MESSAGE]: this._handleConnectionMessage.bind(this)
    };

    this._token = token;
    this._state = RTMClientState.INITIAL;
    this._connection = null;
    this._forceClose = false;
    this.connect();
  }

  connect() {
    invariant(
      this._state === RTMClientState.INITIAL ||
      this._state === RTMClientState.CLOSED ||
      this._state === RTMClientState.RECONNECT,
      'Invalid state: connect() should always be called when current state ' +
      'is "%s", "%s" or "%s" but the current state is "%s".',
      RTMClientState.INITIAL,
      RTMClientState.CLOSED,
      RTMClientState.RECONNECT,
      this._state
    );

    const self = this;
    co(function *() {
      self._state = RTMClientState.CONNECTING;
      let rtmData;
      try {
        const response = yield bearychat.rtm.start({token: self._token});
        rtmData = yield response.json();
      } catch (e) {
        self._state = RTMClientState.RECONNECT;
        self.emit(RTMClientEvents.ERROR, e);
        self.connect();
        return;
      }
      self._setConnection(new RTMConnection(rtmData.ws_host));
    });
  }

  close() {
    invariant(
      this._state === RTMClientState.CONNECTED ||
      this._state === RTMClientState.CONNECTING,
      'Invalid state: cloase() should always be called when current state ' +
      'is "%s" or "%s" but the current state is "%s".',
      RTMClientState.CONNECTED,
      RTMClientState.CONNECTING,
      this._state
    );

    this._state = RTMClientState.CLOSING;
    this._forceClose = true;
    this._connection.close();
  }

  getState() {
    return this._state;
  }

  send(message, timeout) {
    if (!timeout || timeout < 0) {
      timeout = Infinity;
    }
    const sendPromise = this._connection.send(message);
    if (!Number.isFinite(timeout)) {
      return sendPromise;
    }

    const timeoutPromise = new Promise((resolve, reject) => {
      co(function *() {
        yield delay(timeout);
        reject(new RTMTimeoutError('RTM message send timeout.', message));
      });
    });

    return Promise.race([sendPromise, timeoutPromise]);
  }

  _setConnection(connection) {
    invariant(
      !this._connection,
      'Should not set connection when connection already exists.'
    );

    this._connection = connection;
    _.each(this._eventHandlerMap, (handler, eventName) => {
      connection.on(eventName, handler);
    });
  }

  _removeConnection() {
    const connection = this._connection;

    invariant(
      connection,
      'Connection not set or already removed.'
    );

    _.each(this._eventHandlerMap, (handler, eventName) => {
      connection.removeListener(eventName, handler);
    });
    this._connection = null;
  }

  _handleConnectionOpen() {
    this._state = RTMClientState.CONNECTED;
    this.emit(RTMClientEvents.ONLINE);
  }

  _handleConnectionClose() {
    this._removeConnection();
    this.emit(RTMClientEvents.OFFLINE);
    if (this._forceClose) {
      // client close, close normally
      this._state = RTMClientState.CLOSED;
      this.emit(RTMClientEvents.CLOSE);
      this._forceClose = false;
    } else {
      // server close or error, re-connect
      this._state = RTMClientState.RECONNECT;
      this.connect();
    }
  }

  _handleConnectionError(error) {
    this.emit(RTMClientEvents.ERROR, error);
  }

  _handleConnectionMessage(message) {
    this.emit(RTMClientEvents.MESSAGE, message);
  }
}

exports.default = RTMClient;
module.exports = exports.default;
