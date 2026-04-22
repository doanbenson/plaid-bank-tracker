import { BANKING_CORE_TABLE } from "./keys";

export const BANKING_CORE_GSI1 = "GSI1";
export const BANKING_CORE_GSI2 = "GSI2";

export type BankingCoreAttributeName =
  | "PK"
  | "SK"
  | "GSI1PK"
  | "GSI1SK"
  | "GSI2PK"
  | "GSI2SK";

export interface BankingCoreTableDefinition {
  readonly TableName: typeof BANKING_CORE_TABLE;
  readonly BillingMode: "PAY_PER_REQUEST";
  readonly KeySchema: readonly [
    { readonly AttributeName: "PK"; readonly KeyType: "HASH" },
    { readonly AttributeName: "SK"; readonly KeyType: "RANGE" }
  ];
  readonly AttributeDefinitions: ReadonlyArray<{
    readonly AttributeName: BankingCoreAttributeName;
    readonly AttributeType: "S";
  }>;
  readonly GlobalSecondaryIndexes: readonly [
    {
      readonly IndexName: typeof BANKING_CORE_GSI1;
      readonly KeySchema: readonly [
        { readonly AttributeName: "GSI1PK"; readonly KeyType: "HASH" },
        { readonly AttributeName: "GSI1SK"; readonly KeyType: "RANGE" }
      ];
      readonly Projection: { readonly ProjectionType: "ALL" };
    },
    {
      readonly IndexName: typeof BANKING_CORE_GSI2;
      readonly KeySchema: readonly [
        { readonly AttributeName: "GSI2PK"; readonly KeyType: "HASH" },
        { readonly AttributeName: "GSI2SK"; readonly KeyType: "RANGE" }
      ];
      readonly Projection: { readonly ProjectionType: "ALL" };
    }
  ];
}

export const bankingCoreTableDefinition: BankingCoreTableDefinition = {
  TableName: BANKING_CORE_TABLE,
  BillingMode: "PAY_PER_REQUEST",
  KeySchema: [
    { AttributeName: "PK", KeyType: "HASH" },
    { AttributeName: "SK", KeyType: "RANGE" }
  ],
  AttributeDefinitions: [
    { AttributeName: "PK", AttributeType: "S" },
    { AttributeName: "SK", AttributeType: "S" },
    { AttributeName: "GSI1PK", AttributeType: "S" },
    { AttributeName: "GSI1SK", AttributeType: "S" },
    { AttributeName: "GSI2PK", AttributeType: "S" },
    { AttributeName: "GSI2SK", AttributeType: "S" }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: BANKING_CORE_GSI1,
      KeySchema: [
        { AttributeName: "GSI1PK", KeyType: "HASH" },
        { AttributeName: "GSI1SK", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    },
    {
      IndexName: BANKING_CORE_GSI2,
      KeySchema: [
        { AttributeName: "GSI2PK", KeyType: "HASH" },
        { AttributeName: "GSI2SK", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    }
  ]
};
