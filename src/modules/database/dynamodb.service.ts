import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName = process.env.DYNAMODB_TABLE_NAME || 'hellohere-users';

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-west-1',
      // Lambda에서는 IAM 역할을 자동으로 사용하므로 credentials 생략
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async put(item: any): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: item,
    });
    await this.client.send(command);
  }

  async get(userId: string): Promise<any> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { userId },
    });
    const result = await this.client.send(command);
    return result.Item;
  }

  async update(userId: string, updates: any): Promise<any> {
    const updateExpression = Object.keys(updates)
      .map(key => `#${key} = :${key}`)
      .join(', ');

    const expressionAttributeNames = Object.keys(updates)
      .reduce((acc, key) => ({ ...acc, [`#${key}`]: key }), {});

    const expressionAttributeValues = Object.keys(updates)
      .reduce((acc, key) => ({ ...acc, [`:${key}`]: updates[key] }), {});

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { userId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await this.client.send(command);
    return result.Attributes;
  }

  async delete(userId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: { userId },
    });
    await this.client.send(command);
  }

  async scanActiveUsers(): Promise<any[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: { ':isActive': true },
    });
    const result = await this.client.send(command);
    return result.Items || [];
  }

  async findNearbyUsers(latitude: number, longitude: number, radiusKm: number): Promise<any[]> {
    const allUsers = await this.scanActiveUsers();

    return allUsers.filter(user => {
      if (!user.location) return false;

      const distance = this.calculateDistance(
        latitude, longitude,
        user.location.latitude, user.location.longitude
      );

      return distance <= radiusKm;
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // WebSocket 연결 관리 메서드들
  async saveConnection(connectionId: string, userId: string): Promise<void> {
    const updates = {
      activeConnectionId: connectionId,
      connectedAt: new Date().toISOString(),
      updatedAt: Date.now()
    };
    await this.update(userId, updates);
  }

  async removeConnection(connectionId: string): Promise<void> {
    // connectionId로 사용자를 찾아서 activeConnectionId 제거
    const users = await this.scanActiveUsers();
    const user = users.find(u => u.activeConnectionId === connectionId);

    if (user) {
      const updates = {
        activeConnectionId: null,
        updatedAt: Date.now()
      };
      await this.update(user.userId, updates);
    }
  }

  async getActiveConnections(): Promise<Array<{ connectionId: string; userId: string }>> {
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'attribute_exists(activeConnectionId)',
    });

    const result = await this.client.send(command);
    return (result.Items || [])
      .filter(item => item.activeConnectionId)
      .map(item => ({
        connectionId: item.activeConnectionId,
        userId: item.userId
      }));
  }
}