"""
tools/vector_store.py — Local document memory using ChromaDB

This replaces Pinecone. ChromaDB runs 100% on your Mac.
No API key, no cloud, no data leaves your machine.

What it's used for:
  - Storing SBV circulars, deal templates, and regulatory docs
  - Semantic search: "find all sections mentioning single borrower limits"
  - RAG (Retrieval Augmented Generation): agents retrieve relevant context
    before generating responses, reducing hallucination

Setup:
  1. Drop documents into ./data/knowledge_base/
  2. Run: python tools/vector_store.py  (indexes all documents)
  3. Agents will automatically query it when building analysis

Usage:
    from tools.vector_store import VectorStore
    vs = VectorStore()
    vs.add_document("SBV Circular 22/2019", text_content)
    results = vs.search("single borrower credit limit")
"""

import os
from pathlib import Path
from typing import List, Optional
from config import settings


class VectorStore:
    """
    Local vector database using ChromaDB + sentence-transformers.
    Stores and retrieves documents by semantic meaning, not just keywords.
    """

    def __init__(self, collection_name: str = "sf_knowledge_base"):
        self.collection_name = collection_name
        self._client = None
        self._collection = None
        self._embedder = None

    def _init(self):
        """Lazy initialisation — only load heavy libraries when first used."""
        if self._client is not None:
            return

        try:
            import chromadb
            from sentence_transformers import SentenceTransformer

            db_path = settings.chroma_db_path
            os.makedirs(db_path, exist_ok=True)

            self._client = chromadb.PersistentClient(path=db_path)
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "SF knowledge base — SBV circulars, deal templates"}
            )
            # Local embedding model — no API key needed
            # 'all-MiniLM-L6-v2' is small (80MB) and fast on Apple Silicon
            self._embedder = SentenceTransformer("all-MiniLM-L6-v2")
            print(f"[VectorStore] Initialised at {db_path}")

        except ImportError as e:
            print(f"[VectorStore] Libraries not installed: {e}")
            print("  Install: pip install chromadb sentence-transformers")
            raise

    def add_document(
        self,
        doc_id: str,
        text: str,
        metadata: dict = None,
        chunk_size: int = 500
    ):
        """
        Add a document to the knowledge base.
        Long documents are split into chunks for better retrieval.

        Args:
            doc_id:     Unique identifier (e.g. "SBV_Circular_22_2019")
            text:       Full document text
            metadata:   Optional dict (e.g. {"type": "circular", "year": 2019})
            chunk_size: Characters per chunk (default 500 = ~100 words)
        """
        self._init()

        # Split into chunks
        chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        embeddings = self._embedder.encode(chunks).tolist()

        meta = metadata or {}
        metadatas = [{**meta, "doc_id": doc_id, "chunk": i} for i in range(len(chunks))]

        self._collection.upsert(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas
        )
        print(f"[VectorStore] Added '{doc_id}' ({len(chunks)} chunks)")

    def search(self, query: str, n_results: int = 5, filter_metadata: dict = None) -> List[dict]:
        """
        Find the most relevant document chunks for a query.

        Args:
            query:           What to search for (natural language)
            n_results:       How many chunks to return
            filter_metadata: Optional filter, e.g. {"type": "circular"}

        Returns:
            List of dicts with: text, doc_id, chunk, distance (similarity score)
        """
        self._init()

        query_embedding = self._embedder.encode([query]).tolist()

        kwargs = {
            "query_embeddings": query_embedding,
            "n_results": min(n_results, self._collection.count() or 1),
            "include": ["documents", "metadatas", "distances"]
        }
        if filter_metadata:
            kwargs["where"] = filter_metadata

        results = self._collection.query(**kwargs)

        output = []
        for i in range(len(results["documents"][0])):
            output.append({
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "similarity": 1 - results["distances"][0][i],  # Convert distance to similarity
            })

        return output

    def index_knowledge_base(self, folder_path: str = None):
        """
        Scan the knowledge base folder and index all .txt and .pdf files.
        Run this once after adding new documents to the folder.
        """
        folder = Path(folder_path or settings.knowledge_base_path)
        if not folder.exists():
            print(f"[VectorStore] Knowledge base folder not found: {folder}")
            return

        from tools.ocr import extract_text_from_pdf

        indexed = 0
        for file_path in folder.glob("**/*"):
            if file_path.suffix.lower() in (".txt", ".md"):
                text = file_path.read_text(encoding="utf-8", errors="ignore")
                doc_id = file_path.stem.replace(" ", "_")
                self.add_document(doc_id, text, {"source": str(file_path), "type": "text"})
                indexed += 1

            elif file_path.suffix.lower() == ".pdf":
                result = extract_text_from_pdf(str(file_path))
                if result["text"]:
                    doc_id = file_path.stem.replace(" ", "_")
                    self.add_document(
                        doc_id, result["text"],
                        {"source": str(file_path), "type": "pdf", "quality": result["quality"]}
                    )
                    indexed += 1

        print(f"[VectorStore] Indexed {indexed} documents from {folder}")
        return indexed


# Module-level instance for easy import
_store = None

def get_store() -> VectorStore:
    """Get the shared VectorStore instance."""
    global _store
    if _store is None:
        _store = VectorStore()
    return _store


if __name__ == "__main__":
    # Run this script directly to index your knowledge base:
    # python tools/vector_store.py
    print("Indexing knowledge base...")
    store = get_store()
    store.index_knowledge_base()
    print("Done. Run a test search:")
    results = store.search("single borrower credit limit SBV")
    for r in results:
        print(f"  [{r['similarity']:.2f}] {r['text'][:100]}...")
