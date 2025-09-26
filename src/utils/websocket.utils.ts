import { DynamoDBDocumentClient, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { ChatRoom } from '../types/chat.types';

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'websocket-connections';
const CHAT_ROOMS_TABLE = process.env.CHAT_ROOMS_TABLE || 'hh-chat-rooms';

export interface ConnectionData {
  connectionId: string;
  userId?: string;
  nickname?: string;
  chatroomId?: string;
  timestamp: number;
}

export async function getConnectionData(connectionId: string, docClient: DynamoDBDocumentClient): Promise<ConnectionData | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      KeyConditionExpression: 'connectionId = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId,
      },
    }));

    return result.Items?.[0] as ConnectionData || null;
  } catch (error) {
    console.error('Error getting connection data:', error);
    return null;
  }
}

export async function sendToConnection(
  connectionId: string,
  data: any,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<void> {
  try {
    console.log('🎯 [sendToConnection] Sending to:', connectionId);
    console.log('🎯 [sendToConnection] Data:', JSON.stringify(data));

    await apiGwClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));

    console.log('🎯 [sendToConnection] Successfully sent to:', connectionId);
  } catch (error) {
    console.error(`❌ Failed to send to ${connectionId}:`, error);
    if ((error as any).statusCode === 410) {
      console.log('🎯 [sendToConnection] Connection stale, removing:', connectionId);
      await docClient.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
      }));
    }
  }
}

export async function broadcastToUsers(
  userIds: string[],
  data: any,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<void> {
  console.log('🎯 [broadcastToUsers] Broadcasting to userIds:', userIds);
  console.log('🎯 [broadcastToUsers] Data to broadcast:', JSON.stringify(data));

  for (const userId of userIds) {
    console.log('🎯 [broadcastToUsers] Getting connections for userId:', userId);
    const connections = await getUserConnections(userId, docClient);
    console.log('🎯 [broadcastToUsers] Found connections:', connections.length);

    for (const conn of connections) {
      console.log('🎯 [broadcastToUsers] Sending to connectionId:', conn.connectionId);
      await sendToConnection(conn.connectionId, data, apiGwClient, docClient);
      console.log('🎯 [broadcastToUsers] Send completed for:', conn.connectionId);
    }
  }
  console.log('🎯 [broadcastToUsers] All broadcasts completed');
}

export async function getUserConnections(userId: string, docClient: DynamoDBDocumentClient): Promise<ConnectionData[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  }));

  return result.Items as ConnectionData[];
}

export async function getRoomConnections(roomId: string, docClient: DynamoDBDocumentClient): Promise<ConnectionData[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'chatroomId = :chatroomId',
    ExpressionAttributeValues: {
      ':chatroomId': roomId,
    },
  }));

  return result.Items as ConnectionData[];
}

export async function findExistingRoom(sender: string, receiver: string, docClient: DynamoDBDocumentClient): Promise<ChatRoom | null> {
  const result = await docClient.send(new ScanCommand({
    TableName: CHAT_ROOMS_TABLE,
    FilterExpression: '(participants.sender = :sender AND participants.receiver = :receiver) OR (participants.sender = :receiver AND participants.receiver = :sender)',
    ExpressionAttributeValues: {
      ':sender': sender,
      ':receiver': receiver
    }
  }));

  return result.Items?.[0] as ChatRoom || null;
}

export async function getChatRoom(chatroomId: string, docClient: DynamoDBDocumentClient): Promise<ChatRoom | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: CHAT_ROOMS_TABLE,
    KeyConditionExpression: 'chatroomId = :chatroomId',
    ExpressionAttributeValues: { ':chatroomId': chatroomId }
  }));

  return result.Items?.[0] as ChatRoom || null;
}

export async function getUserChatRooms(userId: string, docClient: DynamoDBDocumentClient): Promise<ChatRoom[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: CHAT_ROOMS_TABLE,
    FilterExpression: 'participants.sender = :userId OR participants.receiver = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  }));

  const rooms = (result.Items as ChatRoom[]) || [];

  // 최근 활동 순으로 정렬 (lastActivity 내림차순)
  return rooms.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
}

export async function getUserNickname(userId: string, docClient: DynamoDBDocumentClient): Promise<string | null> {
  // 사용자의 연결 정보에서 nickname을 가져옴
  const connections = await getUserConnections(userId, docClient);
  if (connections.length > 0 && connections[0].nickname) {
    return connections[0].nickname;
  }

  // 연결 정보에 nickname이 없거나 연결이 없는 경우, 사용자 테이블에서 조회
  // (여기서는 간단히 연결 정보만 사용)
  return null;
}