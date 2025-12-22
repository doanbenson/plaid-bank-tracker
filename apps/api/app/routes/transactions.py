from flask import Blueprint, request, jsonify
from app.handlers import plaid_handler

bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')

@bp.route('/', methods=['GET'])
def get_transactions():
    """Get transactions"""
    user_id = request.args.get('user_id')
    account_id = request.args.get('account_id')
    
    transactions = plaid_handler.get_transactions(user_id, account_id)
    
    return jsonify({
        'transactions': transactions,
        'count': len(transactions)
    })
