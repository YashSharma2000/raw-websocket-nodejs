const http = require("http");
const dotenv = require("dotenv");
const {
  checkIfRequestDataRFC6455Compliant,
  upgradeConectionToWebsocket,
} = require("./utils/websocket_methods");

dotenv.config();

// server with a very basic callback function to handle the http requests
// NOTE: The callback function inside createServer() method will never execute if the http request contains Upgrade headers. In that case, the 'upgrade' event will be triggered (This is handled by node's http module)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Hello, I am server.");
});

// listen to the http requests
server.listen(process.env.SERVER_PORT, () => {
  console.log("Http server is listening on port", process.env.SERVER_PORT);
});

// handling the 'upgrade' event
server.on("upgrade", (req, socket, head) => {
  const isRequestDataComplyingWithRFC6455 =
    checkIfRequestDataRFC6455Compliant(req);
  if (isRequestDataComplyingWithRFC6455) {
    upgradeConectionToWebsocket(req, socket, head);
  } else {
    // According to RFC6455, if the client's request does not comply with it, then server MUST stop the handshake and return a HTTP response with appropriate error code
    const errMessage =
      "Connection failed as the request does not comply with RFC6455";
    const responseHeaders = [
      "HTTP/1.1 400 Bad Request",
      "Connection: close",
      "Content-Type: text/plain",
      `Content-Length: ${errMessage.length}`,
      "",
      errMessage,
    ].join("\r\n");

    socket.write(responseHeaders);

    // close the TCP connection
    socket.end();
  }
});
