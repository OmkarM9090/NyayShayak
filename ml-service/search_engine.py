import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Nyay-Sahayak RAG Core Microservice", version="2.0.0")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. INITIALIZE OPEN-SOURCE LEGAL EMBEDDING MODEL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
print("Loading Semantic Embedding Model (bge-small-en-v1.5)...")
embedding_model = SentenceTransformer('BAAI/bge-small-en-v1.5')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. VECTOR DATABASE PERSISTENCE SETUP (ChromaDB)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "chroma_db")

chroma_client = chromadb.PersistentClient(path=DB_PATH)
# Legal knowledge repository collection
collection = chroma_client.get_or_create_collection(name="legal_knowledge_base")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. SEED EXISTING DATASET ON STARTUP (Automatic Knowledge Seeding)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def seed_knowledge_base():
    if collection.count() == 0:
        dataset_path = os.path.join(BASE_DIR, "dataset", "final_chunk.json")
        if not os.path.exists(dataset_path):
            print(f"Warning: Dataset path not found at {dataset_path}. Skipping seed.")
            return
            
        print("Seeding initial legal reference dataset into Vector DB...")
        with open(dataset_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
            
        documents = []
        embeddings = []
        metadatas = []
        ids = []
        
        for idx, item in enumerate(raw_data):
            text_content = item.get("text", "") if isinstance(item, dict) else str(item)
            if not text_content.strip():
                continue
                
            # Generate numeric embedding dense vector
            vector = embedding_model.encode(text_content).tolist()
            
            documents.append(text_content)
            embeddings.append(vector)
            # Standard Production Metadata Tracking Schema
            metadatas.append({
                "source": "final_chunk.json",
                "doc_type": "Standard Law Reference/Agreement",
                "section_id": idx
            })
            ids.append(f"ref_law_{idx}")
            
        # Bulk insertion into Chroma DB
        collection.add(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Successfully seeded {collection.count()} legal clauses into local database.")
    else:
        print(f"Vector DB already active with {collection.count()} initialized records.")

# Run seeding routine
seed_knowledge_base()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. CUSTOM PRODUCTION CHARACTER TEXT SPLITTER (LangChain Alternative)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def recursive_character_splitter(text: str, chunk_size: int = 1000, chunk_overlap: int = 200):
    """
    Splits long legal texts smoothly without breaking mid-sentence structure.
    Optimizes token consumption and saves context.
    """
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        
        # Try to align split with paragraph or sentence boundries to keep structure clean
        if end < text_len:
            last_space = text.rfind(' ', start, end)
            last_newline = text.rfind('\n', start, end)
            if last_newline > start + (chunk_size // 2):
                end = last_newline
            elif last_space > start + (chunk_size // 2):
                end = last_space
                
        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append(chunk_text)
            
        start = end - chunk_overlap if end < text_len else end
        if start >= text_len or (end == text_len):
            break
            
    return chunks

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. REST API SCHEMAS & REQUEST PIPELINES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class AnalyzeQueryPayload(BaseModel):
    documentText: str

@app.post("/api/rag/retrieve")
async def retrieve_legal_context(payload: AnalyzeQueryPayload):
    """
    Receives uploaded masked document text, extracts structural chunks,
    performs semantic similarity search against local law databases,
    and returns context rich matches to minimize Gemini Prompt token cost.
    """
    try:
        raw_text = payload.documentText
        if not raw_text.strip():
            raise HTTPException(status_code=400, detail="Document text cannot be empty")
            
        # Step A: Perform Custom Adaptive Chunking
        document_chunks = recursive_character_splitter(raw_text, chunk_size=1200, chunk_overlap=200)
        
        compiled_contexts = []
        
        # Step B: Semantic Similarity Matching Loop for top references
        # To avoid hitting tokens limits, we query references based on core content blocks
        for i, chunk in enumerate(document_chunks[:5]):  # Process up to top 5 prominent chunks to optimize performance
            chunk_embedding = embedding_model.encode(chunk).tolist()
            
            # Query the Vector Base
            query_results = collection.query(
                query_embeddings=[chunk_embedding],
                n_results=1 # Fetch top contextually closest reference clause per block
            )
            
            if query_results and query_results["documents"] and query_results["documents"][0]:
                matched_document = query_results["documents"][0][0]
                match_score = query_results["distances"][0][0] if "distances" in query_results else 0.0
                
                # ChromaDB calculates distance (Lower distance = More similar)
                # Filter out irrelevant matches (threshold config)
                if match_score < 1.5:  
                    compiled_contexts.append(matched_document)
                    
        # Remove duplicates from references
        unique_contexts = list(set(compiled_contexts))
        
        return {
            "success": True,
            "total_chunks_analyzed": len(document_chunks),
            "retrieved_references": unique_contexts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)