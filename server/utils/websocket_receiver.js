class WebSocketReceiver {
  constructor(socket) {
    this._socket = socket;
    this._buffer = Buffer.alloc(0); // buffer to accumulate the data packets received from TCP socket
    this._state = "FRAME_HEADER"; // to keep track of current stage of parsing a frame - FRAME_HEADER, FRAME_PAYLOAD_LENGTH, MASK, FRAME_PAYLOAD
    // frame properties
    this._fin = false;
    this._opcode = null;
    this._masked = false;
    this._payloadLengthIndicator = 0;
    this._framePayloadLength = 0;
    this._maskKey = Buffer.alloc(4); // empty buffer of 4 bytes to store maskKey
    this._fragments = [];
  }

  //#region - private methods
  // to consume first n-bytes from buffer and update the buffersArray and bufferBytesLength
  #consumeBufferBytes(n) {
    const consumedBytes = this._buffer.slice(0, n);
    this._buffer = this._buffer.slice(n);
    return consumedBytes;
  }

  #parseFrameHeader() {
    // if we have less than 2 bytes of data in buffer, wait for data
    if (this._buffer.length < 2) return;

    // first byte => fin bit, rsv bits and op-code
    const firstByteBuffer = this.#consumeBufferBytes(1);
    const firstByte = firstByteBuffer[0];

    this._fin = (firstByte & 0b10000000) === 0b10000000; // 1 bit
    // next 3 bits for rsv so leave it for now
    this._opcode = firstByte & 0b00001111; // 4 bits

    // second byte => 'mask' flag (to tell if the payload if masked or not) and payload length
    const secondByteBuffer = this.#consumeBufferBytes(1);
    const secondByte = secondByteBuffer[0];

    this._masked = (secondByte & 0b10000000) === 0b10000000; // 1 bit
    this._payloadLengthIndicator = secondByte & 0b01111111; // 7 bits

    this._state = "FRAME_PAYLOAD_LENGTH";
  }

  #parseFramePayloadLength() {
    // The values of a 7 bit data ( in our case it is "payloadLengthIndicator" ) can lie between 0 to 127.
    // case-1: payload length is small(between 0 to 125 bytes) => if the value of these 7 bits lies between 0 to 125 bytes, then the value of 7 bits is the payload length.
    if (this._payloadLengthIndicator >= 0 && this._payloadLengthIndicator <= 125) {
      this._framePayloadLength = this._payloadLengthIndicator;
    }
    // case-2: payload length is medium(between 126 bytes to 65,535 bytes) => if the value of these 7 bits is '126' it indicates that the 16 bits following these 7 bits is the payload length.
    else if (this._payloadLengthIndicator === 126) {
      // if buffer contains less than 2 bytes, then wait for more data
      if (this._buffer.length < 2) return;
      // parse next 2 bytes to get the frame payload length
      const payloadLengthBuffer = this.#consumeBufferBytes(2);
      this._framePayloadLength = payloadLengthBuffer.readUInt16BE();
    }
    // case-3: payload length is large(greater than 65,535 bytes) => if the value of these 7 bits is '127' it indicates that the 64 bits following these 7 bits is the payload length.
    else if (this._payloadLengthIndicator === 127) {
      // if buffer contains less than 8 bytes, then wait for more data
      if (this._buffer.length < 8) return;
      // parse next 8 bytes to get the frame payload length
      const payloadLengthBuffer = this.#consumeBufferBytes(8);
      this._framePayloadLength = Number(payloadLengthBuffer.readBigUInt64BE()); //readUInt64BE results in a BigInt so we converted it to Number
    }

    this._state = this._masked ? "MASK" : "FRAME_PAYLOAD";
  }

  #parseMaskKey() {
    // if buffer contains less than 4 bytes, then wait for more data
    if (this._buffer.length < 4) return;
    // mask key buffer bytes
    this._maskKey = this.#consumeBufferBytes(4); // 4 bytes
    this._state = "FRAME_PAYLOAD";
  }

  #parseFramePayload() {
    // if buffer length is less than framePayloadLength, then wait for more data
    if (this._buffer.length < this._framePayloadLength) return;
    // once the entire payload is available, parse it
    const payloadBuffer = this.#consumeBufferBytes(this._framePayloadLength);
    if (this._masked) {
      // unmask the frame payload, by taking xor of each frame payload byte with maskKey byte
      for (let i = 0; i < payloadBuffer.length; i++) {
        payloadBuffer[i] = payloadBuffer[i] ^ this._maskKey[i % 4];
      }
    }
    // push the unmasked frame payload in fragments array
    this._fragments.push(payloadBuffer);
    // if fin bit is not true, then more frames need to be processed
    if(!this._fin) {
      this._state = "FRAME_HEADER";
    } else {
      console.log("COLLECTED FRAGMENTS: ", this._fragments.map((fragment) => fragment.toString("utf8")));
    }
  }

  #startProcessing() {
    // keep looping on buffer as long as there is some data inside buffer
    while (this._buffer.length > 0) {
      switch (this._state) {
        case "FRAME_HEADER":
          this.#parseFrameHeader();
          break;
        case "FRAME_PAYLOAD_LENGTH":
          this.#parseFramePayloadLength();
          break;
        case "MASK":
          this.#parseMaskKey();
          break;
        case "FRAME_PAYLOAD":
          this.#parseFramePayload();
          break;
      }
    }
  }
  //#endregion

  //#region - public methods
  processChunk(chunk) {
    // keep buffering the received chunks from TCP socket
    this._buffer = Buffer.concat([this._buffer, chunk]);
    this.#startProcessing();
  }
  //#endregion
}

module.exports = WebSocketReceiver;
