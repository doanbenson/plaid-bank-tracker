import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

export interface TransferWorkflowProps {
  databaseTable: dynamodb.Table;
}

export class TransferWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: TransferWorkflowProps) {
    super(scope, id);

    // 1. Define the processing Lambdas
    const processTransferLambda = new lambda.NodejsFunction(this, 'ProcessTransfer', {
      entry: path.join(__dirname, '../../src/process-transfer-leg.ts'),
      environment: { TABLE_NAME: props.databaseTable.tableName },
    });

    const compensateTransferLambda = new lambda.NodejsFunction(this, 'CompensateTransfer', {
      entry: path.join(__dirname, '../../src/compensate-transfer-leg.ts'),
      environment: { TABLE_NAME: props.databaseTable.tableName },
    });

    // 2. Grant DB permissions to the Lambdas
    props.databaseTable.grantReadWriteData(processTransferLambda);
    props.databaseTable.grantReadWriteData(compensateTransferLambda);

    // 3. Define the Step Function
    this.stateMachine = new sfn.StateMachine(this, 'SplitTransferStateMachine', {
      definitionBody: sfn.DefinitionBody.fromFile(path.join(__dirname, '../../state-machines/split-transfer.asl.json')),
      definitionSubstitutions: {
        ProcessTransferArn: processTransferLambda.functionArn,
        CompensateTransferArn: compensateTransferLambda.functionArn,
      },
    });

    // 4. Grant Step Function permission to invoke the Lambdas
    processTransferLambda.grantInvoke(this.stateMachine);
    compensateTransferLambda.grantInvoke(this.stateMachine);
  }
}