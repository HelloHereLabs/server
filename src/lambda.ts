import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// WebSocket 핸들러 import
import { websocketHandler } from './websocket-handler';

// WebSocket 전용 Lambda 핸들러
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  return websocketHandler(event, context);
};

// WebSocket 핸들러 별도 export
export { websocketHandler };