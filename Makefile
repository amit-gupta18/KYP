.PHONY: api web test

api:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

web:
	cd frontend && npm run dev

test:
	cd backend && . .venv/bin/activate && pytest -q
