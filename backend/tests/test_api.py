from fastapi.testclient import TestClient

from app.main import app
from app.rag import build_messages


def test_health_reports_missing_services():
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is False
    assert body["services"]["openai"]["configured"] is False
    assert body["services"]["mongodb"]["connected"] is False
    assert body["services"]["pinecone"]["configured"] is False
    assert body["problems"]


def test_document_list_requires_services():
    with TestClient(app) as client:
        response = client.get("/api/documents")
    assert response.status_code == 503


def test_upload_rejects_unsupported_type_before_services():
    with TestClient(app) as client:
        response = client.post(
            "/api/documents",
            files={"file": ("virus.exe", b"not-a-policy", "application/octet-stream")},
        )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_empty_question_is_rejected():
    with TestClient(app) as client:
        response = client.post("/api/questions", json={"question": "  "})
    assert response.status_code == 400


def test_question_without_services_is_unavailable():
    with TestClient(app) as client:
        response = client.post("/api/questions", json={"question": "What is the leave policy?"})
    assert response.status_code == 503


def test_prompt_requires_citations_and_excerpts():
    messages = build_messages(
        "How many leave days?",
        [{"filename": "Leave.pdf", "text": "Employees receive 18 annual leave days."}],
        [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "How can I help?"}],
    )
    assert messages[0]["role"] == "system"
    assert "[1]" in messages[0]["content"]
    assert "Leave.pdf" in messages[-1]["content"]
    assert "How many leave days?" in messages[-1]["content"]
    assert messages[1]["content"] == "Hello"
