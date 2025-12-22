from flask import Blueprint, request, jsonify
from app.handlers import plaid_handler

bp = Blueprint('plaid', __name__, url_prefix='/api/plaid')

@bp.route('/create-link-token', methods=['POST'])
def create_link_token():
    """Create a Plaid Link token"""
    data = request.get_json() or {}
    user_id = data.get('user_id', 'user-sandbox')
    
    result = plaid_handler.create_link_token(user_id)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result)


@bp.route('/exchange-token', methods=['POST'])
def exchange_token():
    """Exchange public token for access token"""
    data = request.get_json()
    
    if not data or 'public_token' not in data:
        return jsonify({'error': 'public_token is required'}), 400
    
    public_token = data['public_token']
    user_id = data.get('user_id', 'user-sandbox')
    
    result = plaid_handler.exchange_public_token(public_token, user_id)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result)


@bp.route('/sync-transactions/<item_id>', methods=['POST'])
def sync_transactions(item_id):
    """Manually sync transactions for an item"""
    from app.models import items_store
    
    if item_id not in items_store:
        return jsonify({'error': 'Item not found'}), 404
    
    access_token = items_store[item_id]['access_token']
    result = plaid_handler.sync_transactions(access_token, item_id)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result)
