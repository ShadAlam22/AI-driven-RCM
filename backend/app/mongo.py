import os

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

_client: MongoClient | None = None


def get_mongo_db() -> Database:
    global _client
    if _client is None:
        url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        _client = MongoClient(url)
    db_name = os.environ.get("MONGO_DB", "rcm")
    return _client[db_name]


def get_notes_collection() -> Collection:
    return get_mongo_db()["clinical_notes"]
