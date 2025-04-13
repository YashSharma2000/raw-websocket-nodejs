const crypto = require("crypto");
const WebSocketReceiver = require("./websocket_receiver");
const {
  UPGRADE_HEADER_VALUE,
  CONNECTION_HEADER_VALUE,
  VERSION_HEADER_VALUE,
  REQUEST_METHOD_VALUE,
  ALLOWED_ORIGINS,
  WEBSOCKET_GUID,
} = require("../constants/websocket_constants");

const checkIfRequestDataRFC6455Compliant = (req) => {
  // fetch the required data from request object
  const reqHeader = req.headers;
  // checks for request header sent by the client as per the RFC 6455
  const isUpgradeHeaderCorrect =
    reqHeader["upgrade"].toLowerCase() === UPGRADE_HEADER_VALUE;
  const isConnectionHeaderCorrect =
    reqHeader["connection"].toLowerCase() === CONNECTION_HEADER_VALUE;
  const isVersionHeaderCorrect =
    reqHeader["sec-websocket-version"] === VERSION_HEADER_VALUE;
  const isRequestMethodCorrect = req.method === REQUEST_METHOD_VALUE;

  // check if origin is allowed
  const origin = reqHeader["origin"];
  const isOriginAllowed = ALLOWED_ORIGINS.includes(origin);

  if (
    isUpgradeHeaderCorrect &&
    isConnectionHeaderCorrect &&
    isVersionHeaderCorrect &&
    isRequestMethodCorrect &&
    isOriginAllowed
  ) {
    return true;
  } else {
    return false;
  }
};

const generateServerWebsocketKey = (clientKey) => {
  // concatenate the client key with the GUID (global unique identifier) -> encrypt using SHA-1 (to get a 20 byte value) -> encode to base-64 -> return generated server's key
  const concatenatedClientKeyWithGUID = clientKey + WEBSOCKET_GUID;
  const hashObject = crypto.createHash("sha1");
  hashObject.update(concatenatedClientKeyWithGUID);
  const serverKey = hashObject.digest("base64");
  return serverKey;
};

const upgradeConectionToWebsocket = (req, socket, head) => {
  const clientKey = req.headers["sec-websocket-key"];
  const websocketKey = generateServerWebsocketKey(clientKey);
  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${websocketKey}`,
    "",
    "",
  ].join("\r\n");
  socket.write(headers);
  // start websocket communication
  startWebsocketCommunication(socket);
};

function startWebsocketCommunication(socket) {
  console.log("Websocket connection has been established");
  // initiate the custom WebsocketReceiver instance
  const receiver = new WebSocketReceiver(socket);
  // We need to bind/register an event handler (callback function) to the 'data' event on socket object for handling the extraction of data and without this event handler, the data will be lost.
  // This event is emitted whenever server receives data from the client over a websocket connection.

  /**
   * VERY IMPORTANT NOTE: Understanding Websocket Frame Fragmentation
   * ---------------------------------------------------------------
   *
   * Websocket Protocol vs Network Layer Behavior:
   * - Websocket protocol sends data in complete frames
   * - Network layer protocols (like TCP) split data into packets
   * - This means we may receive incomplete frames in a chunk if the frame size is large
   *
   * Example Scenario:
   * 1. Let's say that websocket created 2 frames to send a complete message
   * 2. But, TCP splits the first frame into 2 packets due to large size
   * 3. Second frame remains unsplit due to small size
   * 4. Result: First and second chunks contain fragmented frames, while the third chunk is a complete frame
   * 5. The 'data' event will trigger 3 times in total
   *
   * Implementation Consideration:
   * When parsing payload from a frame, always verify whether the complete frame has been received.
   * If incomplete, wait for additional chunks to complete the frame.
   *
   * Terminology Note:
   * In the 'data' event listener below, we refer to received data as "chunk" rather than "frame".
   * Depending on frame size, we may receive either:
   *   - FULL FRAME: Complete websocket frame in a single chunk
   *   - FRAGMENTED FRAME: Partial websocket frame requiring multiple chunks
   */

  socket.on("data", (chunk) => {
    receiver.processChunk(chunk);
  });
}

module.exports = {
  checkIfRequestDataRFC6455Compliant,
  upgradeConectionToWebsocket,
};
