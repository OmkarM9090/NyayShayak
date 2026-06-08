import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Nyay-Sahayak Multilingual RAG Engine", version="3.0.0")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. CROSS-LINGUAL MULTILINGUAL MODEL SPACE SELECTION (LaBSE Alternative)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Using 'paraphrase-multilingual-MiniLM-L12-v2' as it supports 50+ languages 
# including Hindi, Marathi, Hinglish, and perfectly maps them to English legal databases.
print("Loading Multilingual Semantic Embedding Model (paraphrase-multilingual)...")
embedding_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. PERSISTENT VECTOR DB INITIALIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "chroma_db_multilingual") # Fresh path for clean vector mapping

chroma_client = chromadb.PersistentClient(path=DB_PATH)
collection = chroma_client.get_or_create_collection(name="multilingual_legal_vault")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. KNOWLEDGE SEEDING PIPELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def seed_knowledge_base():
    if collection.count() == 0:
        dataset_path = os.path.join(BASE_DIR, "dataset", "final_chunk.json")
        if not os.path.exists(dataset_path):
            print(f"Warning: Baseline records not found at {dataset_path}")
            return
            
        print("Embedding standard compliance files into Multilingual Space vectors...")
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
                
            # Model mathematically calculates weights bridging English legal text to regional variants
            vector = embedding_model.encode(text_content).tolist()
            
            documents.append(text_content)
            embeddings.append(vector)
            metadatas.append({
                "source": "final_chunk.json",
                "doc_type": "Standard Compliance Base",
                "original_index": idx
            })
            ids.append(f"multilingual_law_{idx}")
            
        collection.add(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Successfully vectorized and persisted {collection.count()} multilingual benchmark items.")
    else:
        print(f"Multilingual Persistent Layer active with {collection.count()} structural arrays.")

seed_knowledge_base()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. ADAPTIVE SPLITTER UTILITY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def recursive_character_splitter(text: str, chunk_size: int = 1000, chunk_overlap: int = 200):
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
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
    return chunks

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. HIGH-SPEED REST ROUTING ENDPOINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class AnalyzeQueryPayload(BaseModel):
    documentText: str

@app.post("/api/rag/retrieve")
async def retrieve_legal_context(payload: AnalyzeQueryPayload):
    """
    Accepts text inputs globally across any target localized regional formats, 
    breaks sentences cleanly, performs cross-lingual cosine queries against ChromaDB,
    and forwards clean structured contexts back to our Node.js runtime layers.
    """
    try:
      raw_text = payload.documentText
      if not raw_text.strip():
          raise HTTPException(status_code=400, detail="Text parameters empty.")
          
      document_chunks = recursive_character_splitter(raw_text, chunk_size=1200, chunk_overlap=200)
      compiled_contexts = []
      
      # Process primary descriptive text chunks
      for chunk in document_chunks[:5]:
          chunk_embedding = embedding_model.encode(chunk).tolist()
          
          query_results = collection.query(
              query_embeddings=[chunk_embedding],
              n_results=1
          )
          
          if query_results and query_results["documents"] and query_results["documents"][0]:
              matched_document = query_results["documents"][0][0]
              match_score = query_results["distances"][0][0] if "distances" in query_results else 0.0
              
              # Distances configuration threshold for multilingual cross mapping
              if match_score < 1.65:  
                  compiled_contexts.append(matched_document)
                  
      return {
          "success": True,
          "total_chunks_analyzed": len(document_chunks),
          "retrieved_references": list(set(compiled_contexts))
      }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)