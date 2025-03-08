const http = require("http");
const dotenv = require('dotenv');
dotenv.config();

// create a server with a very basic callback function to handle the http request
// NOTE: The callback function inside createServer() method will never execute if the http request contains Upgrade headers. In that case, the 'upgrade' event will be triggered (This is handled by node's http module)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Hello, I am server.");
});

// listen to the http requests
server.listen(process.env.SERVER_PORT, () => {
  console.log("Http server is listening on port", process.env.SERVER_PORT);
});