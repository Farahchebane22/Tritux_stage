from __future__ import annotations

from typing import Any, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from llm_client import llm_client
from ml_engine import engine

app = FastAPI(
    title="Tritux AI Assistant",
    description="Classification ML + chatbot conversationnel (Gemini/OpenAI)",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TicketAnalysisRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(default="")


class TicketAnalysisResponse(BaseModel):
    category: str
    priority: str
    confidence: int
    suggestedResponse: str
    model: str = "tfidf_nb_custom"
    canSelfResolve: bool = False
    selfHelpSteps: list[str] = []
    matchedIntent: Optional[str] = None


class ChatMessage(BaseModel):
    role: str = "user"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    canSelfResolve: bool = False
    steps: list[str] = []
    suggestTicket: bool = False
    category: Optional[str] = None
    priority: Optional[str] = None
    confidence: int = 0
    intent: Optional[str] = None
    provider: Optional[str] = None


@app.get("/health")
async def health_check() -> dict[str, Any]:
    return {
        "status": "UP",
        "service": "ai-service",
        "modelReady": engine.ready,
        "llmProvider": llm_client.provider,
        "llmReady": llm_client.available,
        "knowledgeBaseEntries": len(engine.knowledge_base),
        "metrics": engine.metrics.get("metrics") if engine.metrics else None,
    }


@app.get("/model/info")
async def model_info() -> dict[str, Any]:
    return {
        "ready": engine.ready,
        "llmProvider": llm_client.provider,
        "llmReady": llm_client.available,
        "metrics": engine.metrics,
        "knowledgeBaseSize": len(engine.knowledge_base),
        "hint": None
        if llm_client.available
        else "Ajoutez GEMINI_API_KEY dans backend/ai-service/.env pour un chat type Gemini",
    }


@app.post("/analyze", response_model=TicketAnalysisResponse)
async def analyze_ticket(request: TicketAnalysisRequest) -> TicketAnalysisResponse:
    result = engine.analyze(request.title, request.description)
    return TicketAnalysisResponse(**result)


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    history = [{"role": m.role, "content": m.content} for m in request.history]
    result = await engine.chat_async(request.message, history)
    return ChatResponse(**result)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
