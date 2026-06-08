import json
import numpy as np
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(BASE_DIR, "dataset", "final_chunk.json")

with open(dataset_path, "r", encoding="utf-8") as f:
    data = json.load(f)

texts = [item["text"] for item in data]

print("Building TF-IDF model...")

vectorizer = TfidfVectorizer(stop_words="english")
dataset_vectors = vectorizer.fit_transform(texts)

print("Model ready!")


def search(query, k=5):
    query_vector = vectorizer.transform([query])
    similarities = cosine_similarity(query_vector, dataset_vectors)[0]
    top_indices = np.argsort(similarities)[-k:][::-1]

    results = []
    for idx in top_indices:
        results.append(
            {
                "text": texts[idx],
                "score": float(similarities[idx]),
            }
        )

    return results
