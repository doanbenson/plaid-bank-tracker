export interface DynamoConditionExpression {
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
}

export interface PutItemInput extends DynamoConditionExpression {
  TableName: string;
  Item: Record<string, unknown>;
}

export interface GetItemInput {
  TableName: string;
  Key: Record<string, unknown>;
}

export interface QueryItemsInput {
  TableName: string;
  IndexName?: string;
  KeyConditionExpression: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
}

export interface UpdateItemInput extends DynamoConditionExpression {
  TableName: string;
  Key: Record<string, unknown>;
  UpdateExpression: string;
  ReturnValues?: "NONE" | "ALL_NEW";
}

export interface DynamoRepositoryClient {
  put(params: PutItemInput): Promise<void>;
  get<TItem extends Record<string, unknown>>(
    params: GetItemInput
  ): Promise<{ Item?: TItem }>;
  query<TItem extends Record<string, unknown>>(
    params: QueryItemsInput
  ): Promise<{ Items?: TItem[] }>;
  update<TAttributes extends Record<string, unknown>>(
    params: UpdateItemInput
  ): Promise<{ Attributes?: TAttributes }>;
}
