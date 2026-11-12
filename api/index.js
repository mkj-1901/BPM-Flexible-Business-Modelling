import { createRequestHandler } from '../server.js';

const handler = createRequestHandler();

export default function vercelHandler(req, res) {
  return handler(req, res);
}

