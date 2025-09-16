import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi';
import * as jwt from 'jsonwebtoken';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'websocket-connections';
const MESSAGES_TABLE = process.env.MESSAGES_TABLE || 'chat-messages';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

interface ConnectionData {
  connectionId: string;
  userId?: string;
  roomId?: string;
  timestamp: number;
}

interface MessageData {
  messageId: string;
  roomId: string;
  userId: string;
  message: string;
  timestamp: number;
}

function verifyJWT(token: string): any {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export const websocketHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Full event:', JSON.stringify(event, null, 2));

  // WebSocket 이벤트 확인
  if (!event.requestContext) {
    console.error('No requestContext found');
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid event format' }),
    };
  }

  const { routeKey, connectionId } = event.requestContext;
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  const apiGwClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`,
    region: process.env.AWS_REGION,
  });

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId!, event);

      case '$disconnect':
        return await handleDisconnect(connectionId!);

      case 'sendMessage':
        return await handleSendMessage(event, apiGwClient);

      case 'joinRoom':
        return await handleJoinRoom(event, apiGwClient);

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Unknown route' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};

async function handleConnect(connectionId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // JWT 토큰 검증 (query string에서 추출 후 디코딩)
  const rawToken = event.queryStringParameters?.token;
  if (!rawToken) {
    console.error('No token provided');
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: No token provided' }),
    };
  }

  const token = decodeURIComponent(rawToken);
  console.log('Decoded token:', token);
  console.log('JWT_SECRET:', JWT_SECRET);

  const decoded = verifyJWT(token);
  if (!decoded) {
    console.error('Invalid token:', token.substring(0, 50) + '...');
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid token' }),
    };
  }

  console.log('JWT verified for user:', decoded);

  const connectionData: ConnectionData = {
    connectionId,
    userId: decoded.userId || decoded.id,
    timestamp: Date.now(),
  };

  await docClient.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: connectionData,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Connected successfully',
      userId: decoded.userId || decoded.id
    }),
  };
}

async function handleDisconnect(connectionId: string): Promise<APIGatewayProxyResult> {
  await docClient.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Disconnected' }),
  };
}

async function handleSendMessage(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient
): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { roomId, message, userId } = body;

  if (!roomId || !message || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing required fields' }),
    };
  }

  // 메시지를 데이터베이스에 저장
  const messageData: MessageData = {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    roomId,
    userId,
    message,
    timestamp: Date.now(),
  };

  await docClient.send(new PutCommand({
    TableName: MESSAGES_TABLE,
    Item: messageData,
  }));

  // 해당 룸의 모든 연결된 사용자에게 메시지 브로드캐스트
  const connections = await getRoomConnections(roomId);

  const messagePayload = {
    type: 'message',
    data: messageData,
  };

  const sendPromises = connections.map(async (conn) => {
    try {
      await apiGwClient.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: JSON.stringify(messagePayload),
      }));
    } catch (error) {
      console.error(`Failed to send message to ${conn.connectionId}:`, error);
      // 연결이 끊어진 경우 데이터베이스에서 제거
      if ((error as any).statusCode === 410) {
        await docClient.send(new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId: conn.connectionId },
        }));
      }
    }
  });

  await Promise.all(sendPromises);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Message sent' }),
  };
}

async function handleJoinRoom(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient
): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { roomId, userId } = body;

  if (!roomId || !userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing roomId or userId' }),
    };
  }

  // 연결 정보 업데이트
  await docClient.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      userId,
      roomId,
      timestamp: Date.now(),
    },
  }));

  // 룸 참여 알림을 다른 참가자들에게 전송
  const connections = await getRoomConnections(roomId);
  const joinPayload = {
    type: 'userJoined',
    data: {
      userId,
      roomId,
      timestamp: Date.now(),
    },
  };

  const sendPromises = connections
    .filter(conn => conn.connectionId !== connectionId)
    .map(async (conn) => {
      try {
        await apiGwClient.send(new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: JSON.stringify(joinPayload),
        }));
      } catch (error) {
        console.error(`Failed to send join notification to ${conn.connectionId}:`, error);
        if ((error as any).statusCode === 410) {
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: conn.connectionId },
          }));
        }
      }
    });

  await Promise.all(sendPromises);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Joined room' }),
  };
}

async function getRoomConnections(roomId: string): Promise<ConnectionData[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'roomId = :roomId',
    ExpressionAttributeValues: {
      ':roomId': roomId,
    },
  }));

  return result.Items as ConnectionData[];
}