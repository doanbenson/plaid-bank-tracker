from pymongo import MongoClient, ASCENDING, DESCENDING
from app.config import MONGO_URI, MONGO_DB_NAME

_client = None
_db = None


def _get_db():
    global _client, _db
    if _db is None:
        _client = MongoClient(MONGO_URI)
        _db = _client[MONGO_DB_NAME]
    return _db


def init_mongo():
    db = _get_db()
    db.items.create_index([('item_id', ASCENDING)], unique=True)
    db.items.create_index([('user_id', ASCENDING)])
    db.accounts.create_index([('account_id', ASCENDING)], unique=True)
    db.accounts.create_index([('item_id', ASCENDING)])
    db.transactions.create_index([('transaction_id', ASCENDING)], unique=True)
    db.transactions.create_index([('account_id', ASCENDING)])
    db.transactions.create_index([('item_id', ASCENDING)])
    db.transactions.create_index([('date', DESCENDING)])


def _without_id(document):
    if not document:
        return None
    clean_document = dict(document)
    clean_document.pop('_id', None)
    return clean_document


def upsert_item(item):
    db = _get_db()
    db.items.update_one({'item_id': item['item_id']}, {'$set': item}, upsert=True)


def get_item(item_id):
    db = _get_db()
    return _without_id(db.items.find_one({'item_id': item_id}))


def get_user_item_ids(user_id):
    db = _get_db()
    return [item['item_id'] for item in db.items.find({'user_id': user_id}, {'item_id': 1, '_id': 0})]


def upsert_account(account):
    db = _get_db()
    db.accounts.update_one({'account_id': account['account_id']}, {'$set': account}, upsert=True)


def get_account(account_id):
    db = _get_db()
    return _without_id(db.accounts.find_one({'account_id': account_id}))


def get_accounts(user_id=None):
    db = _get_db()
    query = {}
    if user_id:
        item_ids = get_user_item_ids(user_id)
        if not item_ids:
            return []
        query = {'item_id': {'$in': item_ids}}

    return [_without_id(account) for account in db.accounts.find(query)]


def upsert_transaction(transaction):
    db = _get_db()
    db.transactions.update_one(
        {'transaction_id': transaction['transaction_id']},
        {'$set': transaction},
        upsert=True
    )


def delete_transactions(transaction_ids):
    if not transaction_ids:
        return
    db = _get_db()
    db.transactions.delete_many({'transaction_id': {'$in': transaction_ids}})


def get_transactions(user_id=None, account_id=None):
    db = _get_db()
    query = {}

    if account_id:
        query['account_id'] = account_id
    elif user_id:
        item_ids = get_user_item_ids(user_id)
        if not item_ids:
            return []
        query['item_id'] = {'$in': item_ids}

    return [_without_id(tx) for tx in db.transactions.find(query).sort('date', DESCENDING)]
