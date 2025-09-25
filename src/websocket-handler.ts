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
import { getConnectionData, ConnectionData } from './utils/websocket.utils';
import {
  handleCreateChatRoom,
  handleSendChatMessage,
  handleGetChatHistory,
  handleGetChatRooms,
  handleLeaveChatRoom,
  handleOpenChatRoom,
  handleRequestNewChat,
  handleAcceptNewChat,
  handleRejectNewChat
} from './handlers/chat.handlers';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'websocket-connections';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

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

  console.log('🔥 BEFORE SWITCH - routeKey:', routeKey);
  console.log('🔥 IMPORTS CHECK:', {
    handleCreateChatRoom: typeof handleCreateChatRoom,
    docClient: typeof docClient,
    apiGwClient: typeof apiGwClient
  });

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId!, event);

      case '$disconnect':
        return await handleDisconnect(connectionId!);

      // 채팅 요청 관련 Route Keys
      case 'requestNewChat':
        console.log('🚨 ENTERING requestNewChat case');
        return await handleRequestNewChat(event, apiGwClient, docClient);

      case 'acceptNewChat':
        console.log('🚨 ENTERING acceptNewChat case');
        return await handleAcceptNewChat(event, apiGwClient, docClient);

      case 'rejectNewChat':
        console.log('🚨 ENTERING rejectNewChat case');
        return await handleRejectNewChat(event, apiGwClient, docClient);

      // 기존 채팅 관련 Route Keys
      case 'createRoom':
        console.log('🚨 ENTERING createRoom case');
        return await handleCreateChatRoom(event, apiGwClient, docClient);

      case 'sendChatMsg':
        console.log('🚨 ENTERING sendChatMsg case');
        return await handleSendChatMessage(event, apiGwClient, docClient);

      case 'getChatHistory':
        console.log('🚨 ENTERING getChatHistory case');
        return await handleGetChatHistory(event, apiGwClient, docClient);

      case 'getChatRooms':
        console.log('🚨 ENTERING getChatRooms case');
        return await handleGetChatRooms(event, apiGwClient, docClient);

      case 'leaveChatRoom':
        console.log('🚨 ENTERING leaveChatRoom case');
        return await handleLeaveChatRoom(event, apiGwClient, docClient);

      case 'openChatRoom':
        console.log('🚨 ENTERING openChatRoom case');
        return await handleOpenChatRoom(event, apiGwClient, docClient);

      default:
        console.log('❌ UNKNOWN ROUTE:', routeKey);
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Unknown route' }),
        };
    }
  } catch (error) {
    console.error('💥 SWITCH ERROR:', error);
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
    nickname: decoded.nickname,
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


