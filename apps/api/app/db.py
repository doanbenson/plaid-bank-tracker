import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/plaid_bank?authSource=admin")

_client = MongoClient(MONGO_URI)
db = _client.get_default_database()
