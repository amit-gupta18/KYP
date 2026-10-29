const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function messageFrom(payload, status) {
  const detail = payload?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const text = detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  if (status === 503) return "Connect OpenAI, MongoDB, and Pinecone in backend/.env, then restart the API.";
  return "Something went wrong. Try again.";
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Can't reach the API. Start the backend on port 8000.");
  }
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw new Error(messageFrom(payload, response.status));
  }
  return payload;
}

export function getHealth() {
  return request("/api/health");
}

export function getStats() {
  return request("/api/stats");
}

export function listDocuments() {
  return request("/api/documents");
}

export function getDocument(id) {
  return request(`/api/documents/${id}`);
}

export function deleteDocument(id) {
  return request(`/api/documents/${id}`, { method: "DELETE" });
}

export function uploadDocument(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/documents`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }
      reject(new Error(messageFrom(payload, xhr.status)));
    };
    xhr.onerror = () => reject(new Error("Can't reach the API. Start the backend on port 8000."));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export function listConversations() {
  return request("/api/conversations");
}

export function getConversation(id) {
  return request(`/api/conversations/${id}`);
}

export function deleteConversation(id) {
  return request(`/api/conversations/${id}`, { method: "DELETE" });
}

export function askQuestion(body) {
  return request("/api/questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
