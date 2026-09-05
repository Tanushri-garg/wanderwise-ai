import { handleWeatherRequest } from '../src/server/weatherHandler';

export default async function handler(req: any, res: any) {
  return handleWeatherRequest(req, res);
}
