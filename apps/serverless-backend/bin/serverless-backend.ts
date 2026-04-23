#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BankingCoreStack } from '../lib/banking-core-stack';

const app = new cdk.App();
new BankingCoreStack(app, 'BankingCoreStack', {
  env: { account: '000000000000', region: 'us-east-1' } 
});