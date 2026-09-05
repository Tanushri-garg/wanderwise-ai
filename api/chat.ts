import { handleChatRequest } from '../src/server/chatHandler';

export default async function handler(req: any, res: any) {
  return handleChatRequest(req, res);
}
