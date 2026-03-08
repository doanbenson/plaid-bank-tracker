from app.db import db

# MongoDB collections (replaces in-memory dicts)
items_collection = db["items"]
accounts_collection = db["accounts"]
transactions_collection = db["transactions"]


# ---------------------------------------------------------------------------
# Helper wrappers that keep the same dict-like interface used by the rest
# of the codebase while persisting data in MongoDB.
# ---------------------------------------------------------------------------

class _MongoStore:
    """Thin dict-like wrapper around a MongoDB collection keyed by `_key`."""

    def __init__(self, collection, key_field: str):
        self._col = collection
        self._key = key_field

    # --- dict-like read access ---

    def __getitem__(self, key):
        doc = self._col.find_one({self._key: key}, {"_id": 0})
        if doc is None:
            raise KeyError(key)
        return doc

    def __contains__(self, key):
        return self._col.find_one({self._key: key}) is not None

    def __setitem__(self, key, value):
        value[self._key] = key
        self._col.replace_one({self._key: key}, value, upsert=True)

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def values(self):
        return list(self._col.find({}, {"_id": 0}))

    def items(self):
        docs = self._col.find({}, {"_id": 0})
        return [(doc[self._key], doc) for doc in docs]


items_store = _MongoStore(items_collection, "item_id")
accounts_store = _MongoStore(accounts_collection, "account_id")
transactions_store = _MongoStore(transactions_collection, "transaction_id")
