"""
FastAPI server for the SolRush AI chatbot.
Provides SSE streaming endpoint for the LangGraph agent.
"""

import json
import asyncio
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from agent import create_agent

load_dotenv()

# Global agent instance
agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agent on startup."""
    global agent
    try:
        agent = create_agent()
        print("SolRush AI Agent initialized successfully")
    except Exception as e:
        print(f"Failed to initialize agent: {e}")
    yield


app = FastAPI(
    title="SolRush AI Chatbot",
    description="AI-powered investment advisor for SolRush DEX",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    response: str
    tool_calls: list[dict] = []


def _convert_history(history: list[dict]) -> list:
    """Convert frontend message format to LangChain messages."""
    messages = []
    for msg in history[-10:]:  # Keep last 10 messages for context
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    return messages


async def _stream_agent_response(message: str, history: list[dict]) -> AsyncGenerator[str, None]:
    """Stream agent response via SSE."""
    global agent
    if agent is None:
        yield f"data: {json.dumps({'type': 'error', 'content': 'Agent not initialized. Check GOOGLE_API_KEY.'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    messages = _convert_history(history)
    messages.append(HumanMessage(content=message))

    try:
        tool_calls_data = []
        full_response = ""

        # Run agent with streaming
        async for event in agent.astream_events(
            {"messages": messages},
            version="v2",
        ):
            kind = event.get("event", "")

            # Stream LLM tokens
            if kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    content = chunk.content
                    if isinstance(content, str) and content:
                        full_response += content
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"

            # Capture tool calls
            elif kind == "on_tool_start":
                tool_name = event.get("name", "")
                tool_input = event.get("data", {}).get("input", {})
                yield f"data: {json.dumps({'type': 'tool_start', 'tool': tool_name, 'input': tool_input})}\n\n"

            elif kind == "on_tool_end":
                tool_name = event.get("name", "")
                tool_output = event.get("data", {}).get("output", "")
                
                # Parse tool output
                try:
                    if hasattr(tool_output, "content"):
                        output_data = json.loads(tool_output.content) if isinstance(tool_output.content, str) else tool_output.content
                    elif isinstance(tool_output, str):
                        output_data = json.loads(tool_output)
                    else:
                        output_data = str(tool_output)
                except (json.JSONDecodeError, AttributeError):
                    output_data = str(tool_output)

                tool_calls_data.append({
                    "tool": tool_name,
                    "output": output_data,
                })
                yield f"data: {json.dumps({'type': 'tool_end', 'tool': tool_name, 'output': output_data})}\n\n"

        # Send final complete event
        yield f"data: {json.dumps({'type': 'done', 'tool_calls': tool_calls_data})}\n\n"
        yield "data: [DONE]\n\n"

    except Exception as e:
        error_msg = str(e)
        print(f"Agent error: {error_msg}")
        yield f"data: {json.dumps({'type': 'error', 'content': f'Sorry, I encountered an error: {error_msg}'})}\n\n"
        yield "data: [DONE]\n\n"


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """Non-streaming chat endpoint."""
    global agent
    if agent is None:
        return JSONResponse(
            status_code=503,
            content={"error": "Agent not initialized. Check GOOGLE_API_KEY."},
        )

    messages = _convert_history(request.history)
    messages.append(HumanMessage(content=request.message))

    try:
        result = await agent.ainvoke({"messages": messages})
        final_messages = result.get("messages", [])
        
        # Get the last AI message
        response_text = ""
        tool_calls = []
        for msg in reversed(final_messages):
            if isinstance(msg, AIMessage) and msg.content:
                response_text = msg.content
                break
            elif isinstance(msg, ToolMessage):
                try:
                    tool_data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                except json.JSONDecodeError:
                    tool_data = msg.content
                tool_calls.append({"tool": msg.name, "output": tool_data})

        return ChatResponse(response=response_text, tool_calls=tool_calls)

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Agent error: {str(e)}"},
        )


@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """SSE streaming chat endpoint."""
    return StreamingResponse(
        _stream_agent_response(request.message, request.history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "agent_ready": agent is not None,
        "service": "SolRush AI Chatbot",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
