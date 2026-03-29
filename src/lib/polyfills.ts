import 'web-streams-polyfill';

// Polyfill for ReadableStream.prototype.values and [Symbol.asyncIterator]
// which is missing in some environments (like Safari) and causes 
// "undefined is not a function (near '...value of readableStream...')" in PDF.js
if (typeof window !== 'undefined' && typeof ReadableStream !== 'undefined') {
  const proto = ReadableStream.prototype as any;
  const asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

  if (!proto.values || !proto[asyncIterator]) {
    const polyfill = function() {
      const reader = (this as any).getReader();
      return {
        next() {
          return reader.read();
        },
        async return() {
          reader.releaseLock();
          return { done: true, value: undefined };
        },
        [asyncIterator]() {
          return this;
        }
      };
    };

    if (!proto.values) {
      proto.values = polyfill;
    }
    if (!proto[asyncIterator]) {
      proto[asyncIterator] = proto.values;
    }
  }
}
