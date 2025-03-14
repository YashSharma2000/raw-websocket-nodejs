const crypto = require("crypto");
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
};

module.exports = {
  checkIfRequestDataRFC6455Compliant,
  upgradeConectionToWebsocket,
};
