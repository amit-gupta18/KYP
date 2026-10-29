# Policy QA

Ask questions over company policy documents. Upload a handbook or guideline, and the app answers from that text with the passages it used.

This is a single workspace. There is no sign-in, access token, or refresh token.

## Stack

- Next.js and React, JavaScript only, styled with Tailwind CSS
- FastAPI for upload, indexing, and answers
- OpenAI for embeddings (`text-embedding-3-small`) and answers (`gpt-4o-mini`)
- MongoDB for policies, passages, and question history
- Pinecone for vector search

The interface uses one design system: a light blue Atlassian-style theme (brand `#0C66E4`, ink `#172B4D`, canvas `#F7F8F9`). Components are built with Tailwind only.

## What you add

Copy the example env file and fill in the three keys:

```bash
cp .env.example backend/.env
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Embeddings and answers |
| `MONGODB_URI` | Document library and question history |
| `PINECONE_API_KEY` | Vector index |

Optional settings in `.env.example`: chat model, embedding model, Pinecone index name (`policy-qa`), cloud (`aws`), region (`us-east-1`), and company name. The API creates the Pinecone index on the first upload if it does not exist. The index dimension must stay `1536` for `text-embedding-3-small`. If you change the embedding model, set `EMBEDDING_DIMENSION` and a new `PINECONE_INDEX`.

Restart the API after changing `backend/.env`.

## Run

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend, in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API docs are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Until the three keys are set, the app stays usable and shows what is missing. Uploads and questions start working after the API can reach OpenAI, MongoDB, and Pinecone.

## Use it

1. Open **Policies** and upload a PDF, Word (`.docx`), Markdown, or text file. A sample is in `samples/workplace-policy.md`.
2. Wait until the status is **Ready**.
3. Open **Ask**, choose all policies or a few of them, and ask a question.
4. The answer cites passages as `[1]`, `[2]`, with the file name and excerpt under the answer.

Follow-up questions stay in the same conversation. Removing a policy deletes it from MongoDB and from Pinecone. Old questions remain in history.

Run on a private network. Anyone who can reach the server can upload and read policies, because this build does not include authentication.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Which services are configured |
| `GET` | `/api/stats` | Counts for the overview |
| `GET` | `/api/documents` | Policy library |
| `POST` | `/api/documents` | Upload a file |
| `GET` | `/api/documents/{id}` | Metadata and a short preview |
| `DELETE` | `/api/documents/{id}` | Remove a policy and its vectors |
| `GET` | `/api/conversations` | Question history |
| `GET` | `/api/conversations/{id}` | One conversation |
| `DELETE` | `/api/conversations/{id}` | Remove a conversation |
| `POST` | `/api/questions` | Ask a question |

`POST /api/questions` body:

```json
{
  "question": "How many annual leave days do employees get?",
  "conversation_id": null,
  "document_ids": null
}
```

`document_ids: null` searches every ready policy.

## Tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Tests cover text extraction, chunking, and the API checks that run before the external services are configured.
