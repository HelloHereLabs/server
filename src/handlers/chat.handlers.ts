import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ChatRoom, ChatMessage } from '../types/chat.types';
import {
  getConnectionData,
  sendToConnection,
  broadcastToUsers,
  findExistingRoom,
  getChatRoom,
  getUserChatRooms,
  getUserNickname
} from '../utils/websocket.utils';

const CHAT_ROOMS_TABLE = process.env.CHAT_ROOMS_TABLE || 'hh-chat-rooms';
const CHAT_MESSAGES_TABLE = process.env.CHAT_MESSAGES_TABLE || 'hh-chat-messages';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'websocket-connections';

export async function handleCreateChatRoom(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  console.log('🎯 handleCreateChatRoom STARTED');
  const connectionId = event.requestContext.connectionId!;
  console.log('🎯 connectionId:', connectionId);
  const body = JSON.parse(event.body || '{}');
  console.log('🎯 parsed body:', body);
  const { sender, receiver } = body.data || {};
  console.log('🎯 sender:', sender, 'receiver:', receiver);

  console.log('🎯 Getting connection data...');
  const connectionData = await getConnectionData(connectionId, docClient);
  console.log('🎯 connectionData:', connectionData);
  if (!connectionData || !connectionData.userId) {
    console.log('🎯 UNAUTHORIZED: Invalid connection');
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  console.log('🎯 Checking sender authorization...');
  if (sender !== connectionData.userId) {
    console.log('🎯 FORBIDDEN: Sender mismatch -', 'sender:', sender, 'userId:', connectionData.userId);
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Sender must be the authenticated user' }),
    };
  }

  console.log('🎯 Finding existing room...');
  // 기존 채팅방 확인
  const existingRoom = await findExistingRoom(sender, receiver, docClient);
  console.log('🎯 existingRoom:', existingRoom);
  if (existingRoom) {
    console.log('🎯 Found existing room, sending response...');
    await sendToConnection(connectionId, {
      action: 'roomCreated',
      data: existingRoom
    }, apiGwClient, docClient);

    console.log('🎯 Existing room response sent');
    return { statusCode: 200, body: JSON.stringify({ message: 'Room found' }) };
  }

  console.log('🎯 Creating new room...');
  // 새 채팅방 생성 (기본값: accepted 상태로 호환성 유지)
  const roomId = uuidv4();
  console.log('🎯 Generated roomId:', roomId);
  const newRoom: ChatRoom = {
    id: roomId,
    chatroomId: roomId,    // DynamoDB 키와 동일하게
    participants: { sender, receiver },
    status: 'accepted',    // 기존 createRoom은 바로 활성화
    updatedAt: new Date().toISOString(),
    lastActivity: Date.now()
  };
  console.log('🎯 newRoom object:', newRoom);

  console.log('🎯 Saving room to DynamoDB...');
  await docClient.send(new PutCommand({
    TableName: CHAT_ROOMS_TABLE,
    Item: newRoom,
  }));
  console.log('🎯 Room saved to DynamoDB');

  console.log('🎯 Sending room created response...');
  await sendToConnection(connectionId, {
    action: 'roomCreated',
    data: newRoom
  }, apiGwClient, docClient);
  console.log('🎯 Room created response sent');

  console.log('🎯 handleCreateChatRoom COMPLETED');
  return { statusCode: 200, body: JSON.stringify({ message: 'Room created' }) };
}

export async function handleSendChatMessage(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { sender, chatroomId, message, type = 'text', attachments = [] } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  if (sender !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Sender must be the authenticated user' }),
    };
  }

  // 채팅방 존재 및 상태 확인
  const room = await getChatRoom(chatroomId, docClient);
  if (!room) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Chat room not found' }),
    };
  }

  if (room.status !== 'accepted') {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Chat room is not active. Status: ' + room.status }),
    };
  }

  // 권한 확인
  if (room.participants.sender !== connectionData.userId && room.participants.receiver !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Not a participant of this room' }),
    };
  }

  // 메시지 저장
  const chatMessage: ChatMessage = {
    id: uuidv4(),
    chatroomId,
    sender,
    senderNickname: connectionData.nickname, // JWT에서 가져온 닉네임
    message,
    timestamp: Date.now(),
    type,
    attachments,
    read: false
  };

  await docClient.send(new PutCommand({
    TableName: CHAT_MESSAGES_TABLE,
    Item: chatMessage,
  }));

  // 채팅방 정보 업데이트
  await docClient.send(new UpdateCommand({
    TableName: CHAT_ROOMS_TABLE,
    Key: { chatroomId: chatroomId },
    UpdateExpression: 'SET lastMessage = :msg, lastActivity = :activity, updatedAt = :updated',
    ExpressionAttributeValues: {
      ':msg': message,
      ':activity': Date.now(),
      ':updated': new Date().toISOString()
    }
  }));

  // 참가자들에게 메시지 전송
  const participants = [room.participants.sender, room.participants.receiver];
  await broadcastToUsers(participants, {
    action: 'newMsg',
    data: { chatroomId, message: chatMessage }
  }, apiGwClient, docClient);

  return { statusCode: 200, body: JSON.stringify({ message: 'Message sent' }) };
}

export async function handleGetChatHistory(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { chatroomId, limit = 50, before } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  // 채팅방 존재 및 권한 확인
  const room = await getChatRoom(chatroomId, docClient);
  if (!room || (room.participants.sender !== connectionData.userId && room.participants.receiver !== connectionData.userId)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Access denied' }),
    };
  }

  // 메시지 조회
  let queryExpression = 'chatroomId = :chatroomId';
  let expressionValues: any = { ':chatroomId': chatroomId };

  if (before) {
    queryExpression += ' AND #timestamp < :before';
    expressionValues[':before'] = before;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: CHAT_MESSAGES_TABLE,
    KeyConditionExpression: queryExpression,
    ExpressionAttributeNames: before ? { '#timestamp': 'timestamp' } : undefined,
    ExpressionAttributeValues: expressionValues,
    ScanIndexForward: false,
    Limit: limit
  }));

  const messages = (result.Items as ChatMessage[]).reverse();

  await sendToConnection(connectionId, {
    action: 'chatHistory',
    data: { chatroomId, messages }
  }, apiGwClient, docClient);

  return { statusCode: 200, body: JSON.stringify({ message: 'History sent' }) };
}

export async function handleLeaveChatRoom(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { chatroomId, userId: requestUserId } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  if (requestUserId !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Can only leave as yourself' }),
    };
  }

  // 채팅방 정보 가져오기
  const room = await getChatRoom(chatroomId, docClient);
  if (!room) {
    await sendToConnection(connectionId, {
      action: 'leaveRoomResponse',
      data: { chatroomId, success: false, error: 'Room not found' }
    }, apiGwClient, docClient);
    return { statusCode: 404, body: JSON.stringify({ message: 'Room not found' }) };
  }

  // 권한 확인 - 참가자인지 체크
  if (room.participants.sender !== connectionData.userId && room.participants.receiver !== connectionData.userId) {
    await sendToConnection(connectionId, {
      action: 'leaveRoomResponse',
      data: { chatroomId, success: false, error: 'Not a participant' }
    }, apiGwClient, docClient);
    return { statusCode: 403, body: JSON.stringify({ message: 'Not a participant of this room' }) };
  }

  // 연결에서 채팅방 제거
  await docClient.send(new UpdateCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: 'REMOVE chatroomId'
  }));

  // 1:1 채팅방이므로 방 자체를 삭제
  await docClient.send(new DeleteCommand({
    TableName: CHAT_ROOMS_TABLE,
    Key: { chatroomId: chatroomId }
  }));

  // 상대방에게 알림
  const otherUser = room.participants.sender === connectionData.userId ?
    room.participants.receiver : room.participants.sender;

  await broadcastToUsers([otherUser], {
    action: 'roomLeft',
    data: { chatroomId, userId: connectionData.userId }
  }, apiGwClient, docClient);

  await sendToConnection(connectionId, {
    action: 'leaveRoomResponse',
    data: { chatroomId, success: true }
  }, apiGwClient, docClient);

  return { statusCode: 200, body: JSON.stringify({ message: 'Left room' }) };
}

export async function handleOpenChatRoom(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { chatroomId, userId: requestUserId } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  if (requestUserId !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Invalid user' }),
    };
  }

  // 연결에 채팅방 정보 추가
  await docClient.send(new UpdateCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: 'SET chatroomId = :chatroomId',
    ExpressionAttributeValues: { ':chatroomId': chatroomId }
  }));

  // 읽음 처리
  const lastReadTimestamp = Date.now();

  // 상대방에게 읽음 알림
  const room = await getChatRoom(chatroomId, docClient);
  if (room) {
    const otherUser = room.participants.sender === connectionData.userId ?
      room.participants.receiver : room.participants.sender;

    await broadcastToUsers([otherUser], {
      action: 'updateRead',
      data: { chatroomId, userId: connectionData.userId, lastReadTimestamp }
    }, apiGwClient, docClient);
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Opened room' }) };
}

export async function handleGetChatRooms(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  console.log('🎯 handleGetChatRooms STARTED');
  const connectionId = event.requestContext.connectionId!;
  console.log('🎯 connectionId:', connectionId);

  const connectionData = await getConnectionData(connectionId, docClient);
  console.log('🎯 connectionData:', connectionData);
  if (!connectionData || !connectionData.userId) {
    console.log('🎯 UNAUTHORIZED: Invalid connection');
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  console.log('🎯 Getting user chat rooms...');
  // 사용자의 모든 채팅방 조회
  const rooms = await getUserChatRooms(connectionData.userId, docClient);
  console.log('🎯 Found rooms:', rooms.length);

  await sendToConnection(connectionId, {
    action: 'chatRoomsList',
    data: { rooms }
  }, apiGwClient, docClient);

  console.log('🎯 Chat rooms list sent');
  return { statusCode: 200, body: JSON.stringify({ message: 'Chat rooms sent' }) };
}

// ===============================
// 새로운 채팅 요청/수락/거절 핸들러들
// ===============================

export async function handleRequestNewChat(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  console.log('🎯 handleRequestNewChat STARTED');
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { sender, receiver } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  if (sender !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Sender must be the authenticated user' }),
    };
  }

  // 기존 채팅방 확인
  const existingRoom = await findExistingRoom(sender, receiver, docClient);
  if (existingRoom) {
    await sendToConnection(connectionId, {
      action: 'chatRequestSent',
      data: {
        chatRoomId: existingRoom.id,
        receiver,
        status: existingRoom.status
      }
    }, apiGwClient, docClient);

    return { statusCode: 200, body: JSON.stringify({ message: 'Existing room found' }) };
  }

  // 새 채팅방 생성 (waiting 상태)
  const roomId = uuidv4();
  const newRoom: ChatRoom = {
    id: roomId,
    chatroomId: roomId,
    participants: { sender, receiver },
    status: 'waiting',
    updatedAt: new Date().toISOString(),
    lastActivity: Date.now()
  };

  await docClient.send(new PutCommand({
    TableName: CHAT_ROOMS_TABLE,
    Item: newRoom,
  }));

  // 수신자에게 채팅 요청 알림 전송
  const senderNickname = await getUserNickname(sender, docClient);
  await broadcastToUsers([receiver], {
    action: 'receiveNewChat',
    data: {
      sender,
      senderNickname: senderNickname || 'Unknown User',
      chatRoomId: roomId,
      receiver,
    }
  }, apiGwClient, docClient);

  // 요청자에게 성공 응답
  await sendToConnection(connectionId, {
    action: 'chatRequestSent',
    data: {
      chatRoomId: roomId,
      receiver,
      status: 'waiting'
    }
  }, apiGwClient, docClient);

  console.log('🎯 handleRequestNewChat COMPLETED');
  return { statusCode: 200, body: JSON.stringify({ message: 'Chat request sent' }) };
}

export async function handleAcceptNewChat(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  console.log('🎯 handleAcceptNewChat STARTED');
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { sender, receiver, chatRoomId } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  if (receiver !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Only the receiver can accept the request' }),
    };
  }

  // 채팅방 존재 확인
  const room = await getChatRoom(chatRoomId, docClient);
  if (!room || room.status !== 'waiting') {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Chat room not found or not in waiting status' }),
    };
  }

  // 채팅방 상태를 'accepted'로 변경
  await docClient.send(new UpdateCommand({
    TableName: CHAT_ROOMS_TABLE,
    Key: { chatroomId: chatRoomId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updated',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'accepted',
      ':updated': new Date().toISOString()
    }
  }));

  // 요청자에게 수락 알림
  const receiverNickname = await getUserNickname(receiver, docClient);
  await broadcastToUsers([sender], {
    action: 'chatAccepted',
    data: {
      chatRoomId,
      receiver,
      receiverNickname: receiverNickname || 'Unknown User',
    }
  }, apiGwClient, docClient);

  // 수락자에게 성공 응답
  await sendToConnection(connectionId, {
    action: 'chatAcceptSuccess',
    data: { chatRoomId }
  }, apiGwClient, docClient);

  console.log('🎯 handleAcceptNewChat COMPLETED');
  return { statusCode: 200, body: JSON.stringify({ message: 'Chat request accepted' }) };
}

export async function handleRejectNewChat(
  event: APIGatewayProxyEvent,
  apiGwClient: ApiGatewayManagementApiClient,
  docClient: DynamoDBDocumentClient
): Promise<APIGatewayProxyResult> {
  console.log('🎯 handleRejectNewChat STARTED');
  const connectionId = event.requestContext.connectionId!;
  const body = JSON.parse(event.body || '{}');
  const { sender, receiver, chatRoomId } = body.data || {};

  const connectionData = await getConnectionData(connectionId, docClient);
  if (!connectionData || !connectionData.userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized: Invalid connection' }),
    };
  }

  if (receiver !== connectionData.userId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Only the receiver can reject the request' }),
    };
  }

  // 채팅방 존재 확인
  const room = await getChatRoom(chatRoomId, docClient);
  if (!room || room.status !== 'waiting') {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Chat room not found or not in waiting status' }),
    };
  }

  // 채팅방 상태를 'rejected'로 변경
  await docClient.send(new UpdateCommand({
    TableName: CHAT_ROOMS_TABLE,
    Key: { chatroomId: chatRoomId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updated',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'rejected',
      ':updated': new Date().toISOString()
    }
  }));

  // 요청자에게 거절 알림
  const receiverNickname = await getUserNickname(receiver, docClient);
  await broadcastToUsers([sender], {
    action: 'chatRejected',
    data: {
      chatRoomId,
      receiver,
      receiverNickname: receiverNickname || 'Unknown User',
    }
  }, apiGwClient, docClient);

  // 거절자에게 성공 응답
  await sendToConnection(connectionId, {
    action: 'chatRejectSuccess',
    data: { chatRoomId }
  }, apiGwClient, docClient);

  console.log('🎯 handleRejectNewChat COMPLETED');
  return { statusCode: 200, body: JSON.stringify({ message: 'Chat request rejected' }) };
}