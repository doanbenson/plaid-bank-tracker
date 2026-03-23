from flask import request, jsonify
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.auth_get_request import AuthGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.sandbox_public_token_create_request import SandboxPublicTokenCreateRequest
from plaid.model.products import Products
from app.config import plaid_client, PLAID_PRODUCTS, PLAID_COUNTRY_CODES
from app.models import items_store, accounts_store, transactions_store
import datetime

def create_link_token(user_id='user-sandbox'):
    """Create a link token for Plaid Link initialization"""
    try:
        request_data = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(
                client_user_id=user_id
            ),
            client_name="Plaid Bank App",
            products=[Products('auth'), Products('transactions')],
            country_codes=PLAID_COUNTRY_CODES,
            language='en'
        )
        
        response = plaid_client.link_token_create(request_data)
        
        return {
            'link_token': response.link_token,
            'expiration': response.expiration.isoformat() if hasattr(response, 'expiration') else None
        }
    except Exception as e:
        print(f"Error creating link token: {str(e)}")
        return {'error': str(e)}, 500


def create_sandbox_public_token(user_id='user-sandbox'):
    """Create a sandbox public token for testing (sandbox only)"""
    try:
        # Create a sandbox public token with a test institution
        request_data = SandboxPublicTokenCreateRequest(
            institution_id='ins_109508',  # Chase (sandbox)
            initial_products=[Products('auth'), Products('transactions')]
        )
        
        response = plaid_client.sandbox_public_token_create(request_data)
        
        # Convert response to dict - response is a Plaid API response object
        return {
            'public_token': response.public_token,
            'message': 'Sandbox public token created successfully'
        }
    except Exception as e:
        print(f"Error creating sandbox public token: {str(e)}")
        return {'error': str(e)}, 500


def exchange_public_token(public_token, user_id='user-sandbox'):
    """Exchange public token for access token and fetch initial account data"""
    try:
        # Exchange public token for access token
        exchange_request = ItemPublicTokenExchangeRequest(
            public_token=public_token
        )
        exchange_response = plaid_client.item_public_token_exchange(exchange_request)
        
        access_token = exchange_response.access_token
        item_id = exchange_response.item_id
        
        # Store the item
        items_store[item_id] = {
            'access_token': access_token,
            'item_id': item_id,
            'user_id': user_id,
            'created_at': datetime.datetime.now().isoformat()
        }
        
        # Fetch account information
        auth_request = AuthGetRequest(access_token=access_token)
        auth_response = plaid_client.auth_get(auth_request)
        
        # Fetch balances
        balance_request = AccountsBalanceGetRequest(access_token=access_token)
        balance_response = plaid_client.accounts_balance_get(balance_request)
        
        # Store accounts
        for account in balance_response.accounts:
            account_id = account.account_id
            accounts_store[account_id] = {
                'account_id': account_id,
                'item_id': item_id,
                'name': account.name,
                'mask': account.mask,
                'type': str(account.type) if account.type else None,
                'subtype': str(account.subtype) if account.subtype else None,
                'balance': {
                    'available': account.balances.available,
                    'current': account.balances.current,
                    'limit': account.balances.limit
                }
            }
        
        # Sync transactions
        sync_transactions(access_token, item_id)
        
        return {
            'item_id': item_id,
            'accounts': list(accounts_store.values()),
            'message': 'Successfully linked account'
        }
        
    except Exception as e:
        print(f"Error exchanging public token: {str(e)}")
        return {'error': str(e)}, 500


def sync_transactions(access_token, item_id):
    """Sync transactions for a linked item"""
    try:
        # Get transactions using sync endpoint
        cursor = None
        has_more = True
        added = []
        
        while has_more:
            request_data = TransactionsSyncRequest(
                access_token=access_token,
                cursor=cursor
            )
            response = plaid_client.transactions_sync(request_data)
            
            # Add new transactions
            for transaction in response.added:
                transaction_id = transaction.transaction_id
                transactions_store[transaction_id] = {
                    'transaction_id': transaction_id,
                    'account_id': transaction.account_id,
                    'item_id': item_id,
                    'amount': float(transaction.amount),
                    'date': str(transaction.date),
                    'name': transaction.name,
                    'merchant_name': getattr(transaction, 'merchant_name', None),
                    'category': transaction.category if hasattr(transaction, 'category') else [],
                    'pending': transaction.pending
                }
                added.append(transactions_store[transaction_id])
            
            has_more = response.has_more
            cursor = response.next_cursor
        
        return {
            'added': len(added),
            'transactions': added
        }
        
    except Exception as e:
        print(f"Error syncing transactions: {str(e)}")
        return {'error': str(e)}, 500


def get_accounts(user_id=None):
    """Get all accounts, optionally filtered by user_id"""
    if user_id:
        # Filter by user_id through items
        user_items = [item_id for item_id, item in items_store.items() if item['user_id'] == user_id]
        accounts = [acc for acc in accounts_store.values() if acc['item_id'] in user_items]
        return accounts
    return list(accounts_store.values())


def get_transactions(user_id=None, account_id=None):
    """Get transactions, optionally filtered by user_id or account_id"""
    transactions = list(transactions_store.values())
    
    if account_id:
        transactions = [t for t in transactions if t['account_id'] == account_id]
    elif user_id:
        user_items = [item_id for item_id, item in items_store.items() if item['user_id'] == user_id]
        transactions = [t for t in transactions if t['item_id'] in user_items]
    
    # Sort by date (most recent first)
    transactions.sort(key=lambda x: x['date'], reverse=True)
    return transactions