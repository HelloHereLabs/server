import { ScheduledEvent, Context } from 'aws-lambda';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBService } from './modules/database/dynamodb.service';
import { UpdateUserLocation } from './types/websocket.types';

// 30초마다 실행될 위치 업데이트 요청 배치 함수
export const locationUpdateScheduler = async (
  event: ScheduledEvent,
  context: Context
): Promise<{ statusCode: number; message: string }> => {
  console.log('Location update scheduler triggered');

  const updateMessage: UpdateUserLocation = {
    action: 'updateUserLocation',
    data: {}
  };

  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT
  });

  // DynamoDB에서 활성 WebSocket 연결 목록 조회
  const dynamoDBService = new DynamoDBService();
  const activeConnections = await getActiveConnections(dynamoDBService);

  const promises = activeConnections.map(async (connection) => {
    try {
      const command = new PostToConnectionCommand({
        ConnectionId: connection.connectionId,
        Data: JSON.stringify(updateMessage)
      });
      await apiGatewayClient.send(command);
      console.log(`Location update requested for connection ${connection.connectionId} (user: ${connection.userId})`);
    } catch (error) {
      console.error(`Failed to send location update request to ${connection.connectionId}:`, error);
      // 연결이 끊어진 경우 DynamoDB에서 제거
      await removeStaleConnection(dynamoDBService, connection.connectionId);
    }
  });

  await Promise.allSettled(promises);
  console.log(`Location update requests sent to ${activeConnections.length} connections`);

  return {
    statusCode: 200,
    message: `Location update requests sent to ${activeConnections.length} connections`
  };
};

// 활성 WebSocket 연결 목록 조회
async function getActiveConnections(dynamoDBService: DynamoDBService): Promise<Array<{ connectionId: string; userId: string }>> {
  return await dynamoDBService.getActiveConnections();
}

// 끊어진 연결 정보 제거
async function removeStaleConnection(dynamoDBService: DynamoDBService, connectionId: string): Promise<void> {
  try {
    await dynamoDBService.removeConnection(connectionId);
    console.log(`Removed stale connection: ${connectionId}`);
  } catch (error) {
    console.error(`Failed to remove stale connection ${connectionId}:`, error);
  }
}