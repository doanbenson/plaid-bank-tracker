from flask import Blueprint, request, jsonify
from app.handlers import plaid_handler

bp = Blueprint('accounts', __name__, url_prefix='/api/accounts')

@bp.route('/', methods=['GET'])
def get_accounts():
    """Get all accounts"""
    user_id = request.args.get('user_id')
    accounts = plaid_handler.get_accounts(user_id)
    return jsonify({'accounts': accounts})


@bp.route('/<account_id>', methods=['GET'])
def get_account(account_id):
    """Get a specific account"""
    from app.models import accounts_store
    
    if account_id not in accounts_store:
        return jsonify({'error': 'Account not found'}), 404
    
    return jsonify({'account': accounts_store[account_id]})
