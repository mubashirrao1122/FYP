"""
FastAPI server for the SolRush AI chatbot.
Provides SSE streaming endpoint for the LangGraph agent.
"""

import json
import asyncio
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from agent import create_agent
from db.database import engine, get_db
from db.models import Base
from db import crud

load_dotenv()

# Global agent instance
agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agent and DB tables on startup."""
    global agent
    # Create DB tables if they don't exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables ready")
    except Exception as e:
        print(f"DB init warning (is PostgreSQL running?): {e}")

    # Init AI agent
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
    wallet_address: Optional[str] = None  # forward wallet to AI for portfolio queries


class ChatResponse(BaseModel):
    response: str
    tool_calls: list[dict] = []


# ─────────────────────────────────────────────────────────────
# Pydantic models for trade/portfolio endpoints
# ─────────────────────────────────────────────────────────────

class TradeRequest(BaseModel):
    wallet_address: str
    type: str                  # SWAP | PERP_OPEN | PERP_CLOSE | LP_ADD | LP_REMOVE | REWARD
    token_in: Optional[str] = None
    token_out: Optional[str] = None
    amount_in: Optional[float] = None
    amount_out: Optional[float] = None
    price_usd: Optional[float] = None
    value_usd: Optional[float] = None
    fee_usd: Optional[float] = 0.0
    tx_hash: Optional[str] = None
    description: Optional[str] = None


class PositionRequest(BaseModel):
    wallet_address: str
    market: str                # e.g. "SOL/USD"
    side: str                  # LONG | SHORT
    size_usd: float
    collateral_usd: float
    entry_price: float
    leverage: float = 1.0
    liquidation_price: Optional[float] = None
    tx_hash: Optional[str] = None


class ClosePositionRequest(BaseModel):
    exit_price: float
    tx_hash: Optional[str] = None
    wallet_address: Optional[str] = None
    market: Optional[str] = None


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
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)


# ═══════════════════════════════════════════════════════════════
# TRADE & PORTFOLIO REST API ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/api/trades", status_code=201)
async def create_trade(req: TradeRequest, db: AsyncSession = Depends(get_db)):
    """
    Record a completed trade (swap, perp open/close, LP add/remove, reward).
    Called by the frontend after a successful on-chain transaction.
    """
    try:
        trade = await crud.record_trade(db, req.wallet_address, req.model_dump())
        return {"success": True, "trade_id": trade.id, "message": "Trade recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record trade: {str(e)}")


@app.get("/api/history/{wallet}")
async def get_trade_history(wallet: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """
    Get paginated trade history for a wallet.
    Used by the History page in the frontend.
    """
    try:
        trades = await crud.get_trade_history(db, wallet, limit=min(limit, 100))
        return {
            "wallet": wallet,
            "trades": [crud._trade_to_dict(t) for t in trades],
            "count": len(trades),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@app.post("/api/positions", status_code=201)
async def open_position(req: PositionRequest, db: AsyncSession = Depends(get_db)):
    """
    Record a newly opened perpetual position.
    Called by the frontend after a successful perp open transaction.
    """
    try:
        pos = await crud.open_position(db, req.wallet_address, req.model_dump())
        return {"success": True, "position_id": pos.id, "message": "Position opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open position: {str(e)}")


@app.put("/api/positions/{position_id}/close")
async def close_position(
    position_id: str,
    req: ClosePositionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Close an existing perpetual position and calculate realized PnL.
    """
    try:
        pos = await crud.close_position(
            db, 
            position_id, 
            req.exit_price, 
            req.tx_hash,
            wallet=req.wallet_address,
            market=req.market
        )
        if not pos:
            raise HTTPException(status_code=404, detail="Position not found or already closed")
        return {
            "success": True,
            "position_id": pos.id,
            "realized_pnl": pos.realized_pnl,
            "message": f"Position closed with PnL: ${pos.realized_pnl:+.2f}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close position: {str(e)}")


@app.get("/api/portfolio/{wallet}")
async def get_portfolio(wallet: str, db: AsyncSession = Depends(get_db)):
    """
    Full portfolio summary for a wallet.
    Used by the Portfolio page and the AI chatbot tool.
    Includes: trade stats, realized PnL, open positions, LP positions, recent trades.
    """
    try:
        summary = await crud.get_portfolio_summary(db, wallet)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio: {str(e)}")
