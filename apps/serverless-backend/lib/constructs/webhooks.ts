import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda_core from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';

export interface BankingWebhooksProps {
  databaseTable: dynamodb.Table;
  stateMachine: sfn.StateMachine;
}

export interface BankingApiHandlers {
  readonly accountsGet: lambda.NodejsFunction;
  readonly transactionsGet: lambda.NodejsFunction;
  readonly plaidCreateLinkToken: lambda.NodejsFunction;
  readonly plaidSandboxCreate: lambda.NodejsFunction;
  readonly plaidExchangeToken: lambda.NodejsFunction;
  readonly plaidSync: lambda.NodejsFunction;
  readonly transfersPost: lambda.NodejsFunction;
  readonly transfersGet: lambda.NodejsFunction;
  readonly sandboxTransferSimulate: lambda.NodejsFunction;
}

export class BankingWebhooks extends Construct {
  public readonly apiHandlers: BankingApiHandlers;

  constructor(scope: Construct, id: string, props: BankingWebhooksProps) {
    super(scope, id);

    // -----------------------------------------------------------------------
    // LocalStack / endpoint config
    // -----------------------------------------------------------------------
    const dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;
    const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL || '';

    // SSM prefix — the path under which Plaid credentials live in Parameter Store.
    // Lambdas use this env var to know where to look; the actual secret values are
    // never baked into the Lambda environment.
    const ssmPrefix = process.env.PLAID_SSM_PREFIX || '/banking-bento/plaid';

    // -----------------------------------------------------------------------
    // Non-secret environment variables injected into every Lambda.
    // Plaid credentials (client-id, secrets) are intentionally excluded here;
    // they are resolved at runtime via SSM.
    // -----------------------------------------------------------------------
    const environmentVars: Record<string, string> = {
      TABLE_NAME: props.databaseTable.tableName,
      STATE_MACHINE_ARN: props.stateMachine.stateMachineArn,
      // Tells each Lambda which SSM prefix to use when fetching credentials.
      PLAID_SSM_PREFIX: ssmPrefix,
      // Non-secret config that is fine to keep in the environment.
      PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
      PLAID_CLIENT_NAME: process.env.PLAID_CLIENT_NAME || 'Banking Bento',
      PLAID_PRODUCTS: process.env.PLAID_PRODUCTS || 'transactions',
      PLAID_COUNTRY_CODES: process.env.PLAID_COUNTRY_CODES || 'US',
      PLAID_LANGUAGE: process.env.PLAID_LANGUAGE || 'en',
      PLAID_SANDBOX_INSTITUTION_ID: process.env.PLAID_SANDBOX_INSTITUTION_ID || 'ins_109508',
      PLAID_REDIRECT_URI: process.env.PLAID_REDIRECT_URI || '',
      PLAID_WEBHOOK_URL: process.env.PLAID_WEBHOOK_URL || '',
      ...(dynamoEndpoint ? { DYNAMODB_ENDPOINT: dynamoEndpoint } : {}),
      // Allows the SSM client inside the Lambda to point to LocalStack.
      ...(localstackEndpoint ? { LOCALSTACK_ENDPOINT: localstackEndpoint } : {}),
    };

    // -----------------------------------------------------------------------
    // IAM policy: allows Lambdas to read Plaid params from SSM.
    // -----------------------------------------------------------------------
    const ssmReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      // Scope to just the Plaid prefix to follow least-privilege.
      resources: [
        `arn:aws:ssm:*:*:parameter${ssmPrefix}`,
        `arn:aws:ssm:*:*:parameter${ssmPrefix}/*`,
      ],
    });

    // -----------------------------------------------------------------------
    // Lambda defaults
    // -----------------------------------------------------------------------
    const nodejsFunctionDefaults = {
      runtime: lambda_core.Runtime.NODEJS_20_X,
      bundling: {
        // Both @aws-sdk/* packages are available in the Lambda runtime —
        // externalising them keeps the bundle small and avoids version conflicts.
        externalModules: ['@aws-sdk/*'],
      },
    };

    // -----------------------------------------------------------------------
    // 1. Plaid Webhook ingress (not a Plaid-API caller, no SSM needed)
    // -----------------------------------------------------------------------
    const plaidLambda = new lambda.NodejsFunction(this, 'PlaidWebhook', {
      entry: path.join(__dirname, '../../src/lambdas/plaid-webhook-ingress.ts'),
      environment: environmentVars,
      ...nodejsFunctionDefaults,
    });
    const plaidUrl = plaidLambda.addFunctionUrl({ authType: lambda_core.FunctionUrlAuthType.NONE });

    // 2. Grant table + state-machine permissions to the webhook ingress.
    props.databaseTable.grantReadWriteData(plaidLambda);
    props.stateMachine.grantStartExecution(plaidLambda);

    // -----------------------------------------------------------------------
    // 3. Factory for API Lambdas
    // -----------------------------------------------------------------------
    const createApiLambda = (id: string, filename: string, needsSsm = false) => {
      const fn = new lambda.NodejsFunction(this, id, {
        entry: path.join(__dirname, '../../src/lambdas/', filename),
        environment: environmentVars,
        ...nodejsFunctionDefaults,
      });
      props.databaseTable.grantReadWriteData(fn);
      if (needsSsm) {
        fn.addToRolePolicy(ssmReadPolicy);
      }
      return fn;
    };

    // -----------------------------------------------------------------------
    // 4. API Lambdas — Plaid-facing ones get SSM access.
    // -----------------------------------------------------------------------
    const accountsGet      = createApiLambda('ApiAccountsGet',          'api-accounts-get.ts');
    const transactionsGet  = createApiLambda('ApiTransactionsGet',      'api-transactions-get.ts');
    const plaidCreateLinkToken = createApiLambda('ApiPlaidCreateLinkToken', 'api-plaid-create-link-token.ts', true);
    const plaidSandboxCreate   = createApiLambda('ApiPlaidSandboxCreate',   'api-plaid-sandbox-create.ts',   true);
    const plaidExchangeToken   = createApiLambda('ApiPlaidExchangeToken',   'api-plaid-exchange-token.ts',   true);
    const plaidSyncFn          = createApiLambda('ApiPlaidSync',            'api-plaid-sync.ts',             true);
    const transfersPostFn      = createApiLambda('ApiTransfersPost',        'api-transfers-post.ts');
    const transfersGetFn       = createApiLambda('ApiTransfersGet',         'api-transfers-get.ts');
    const sandboxTransferSimulateFn = createApiLambda('ApiSandboxTransferSimulate', 'api-sandbox-transfer-simulate.ts', true);

    // Grant Step Functions start-execution permission to the transfers lambda
    props.stateMachine.grantStartExecution(transfersPostFn);

    this.apiHandlers = {
      accountsGet,
      transactionsGet,
      plaidCreateLinkToken,
      plaidSandboxCreate,
      plaidExchangeToken,
      plaidSync: plaidSyncFn,
      transfersPost: transfersPostFn,
      transfersGet: transfersGetFn,
      sandboxTransferSimulate: sandboxTransferSimulateFn,
    };

    plaidLambda.addEnvironment('PLAID_SYNC_LAMBDA_NAME', plaidSyncFn.functionName);
    plaidSyncFn.grantInvoke(plaidLambda);

    // 5. Output the webhook URL for Plaid dashboard / local testing.
    new cdk.CfnOutput(this, 'PlaidWebhookUrl', { value: plaidUrl.url });
  }
}
