"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankingCoreTableDefinition = exports.BANKING_CORE_GSI2 = exports.BANKING_CORE_GSI1 = void 0;
const keys_1 = require("./keys");
exports.BANKING_CORE_GSI1 = "GSI1";
exports.BANKING_CORE_GSI2 = "GSI2";
exports.bankingCoreTableDefinition = {
    TableName: keys_1.BANKING_CORE_TABLE,
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
            IndexName: exports.BANKING_CORE_GSI1,
            KeySchema: [
                { AttributeName: "GSI1PK", KeyType: "HASH" },
                { AttributeName: "GSI1SK", KeyType: "RANGE" }
            ],
            Projection: { ProjectionType: "ALL" }
        },
        {
            IndexName: exports.BANKING_CORE_GSI2,
            KeySchema: [
                { AttributeName: "GSI2PK", KeyType: "HASH" },
                { AttributeName: "GSI2SK", KeyType: "RANGE" }
            ],
            Projection: { ProjectionType: "ALL" }
        }
    ]
};
