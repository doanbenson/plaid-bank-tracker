import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';

export interface BankingWebhooksProps {
  databaseTable: dynamodb.Table;
  stateMachine: sfn.StateMachine;
}

export class BankingWebhooks extends Construct {
  constructor(scope: Construct, id: string, props: BankingWebhooksProps) {
    super(scope, id);

    const environmentVars = {
      TABLE_NAME: props.databaseTable.tableName,
      STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
    };

    // 1. Lithic Webhook
    const lithicLambda = new lambda.NodejsFunction(this, 'LithicWebhook', {
      entry: path.join(__dirname, '../../src/lithic-webhook-ingress.ts'),
      environment: environmentVars,
    });
    const lithicUrl = lithicLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // 2. Plaid Webhook
    const plaidLambda = new lambda.NodejsFunction(this, 'PlaidWebhook', {
      entry: path.join(__dirname, '../../src/plaid-webhook-ingress.ts'),
      environment: environmentVars,
    });
    const plaidUrl = plaidLambda.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // 3. Grant Permissions
    props.databaseTable.grantReadWriteData(lithicLambda);
    props.databaseTable.grantReadWriteData(plaidLambda);
    props.stateMachine.grantStartExecution(lithicLambda);
    props.stateMachine.grantStartExecution(plaidLambda);

    // 4. Output the URLs for LocalStack testing
    new cdk.CfnOutput(this, 'LithicWebhookUrl', { value: lithicUrl.url });
    new cdk.CfnOutput(this, 'PlaidWebhookUrl', { value: plaidUrl.url });
  }
}