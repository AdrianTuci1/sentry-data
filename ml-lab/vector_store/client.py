import chromadb
from chromadb.config import Settings
import os

class VectorStoreClient:
    """
    Client for interacting with ChromaDB.
    Stores semantic embeddings of columns and generated queries to optimize the DAG execution.
    """
    def __init__(self, persist_dir: str = "./vector_db"):
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_dir)
        
        # Collection for schema embeddings
        self.schema_collection = self.client.get_or_create_collection(name="schema_semantics")
        # Collection for historical goals and successes (Reinforcement Learning context)
        self.goals_collection = self.client.get_or_create_collection(name="agent_goals")
        
    def store_schema_context(self, tenant_id: str, col_name: str, embedding: list, metadata: dict):
        unique_id = f"{tenant_id}_{col_name}"
        self.schema_collection.upsert(
            documents=[col_name],
            embeddings=[embedding],
            metadatas=[metadata],
            ids=[unique_id]
        )
        
    def query_similar_columns(self, embedding: list, n_results: int = 3):
        results = self.schema_collection.query(
            query_embeddings=[embedding],
            n_results=n_results
        )
        return results
