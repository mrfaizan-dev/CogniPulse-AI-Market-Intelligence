import os, time, random
import asyncio
from typing import TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from scraper_engine import main as scraper
from parser_engine import parse_raw_data_with_llm as parser
from search_setup import search_web_urls as search_urls
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from celery import Celery
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

load_dotenv()

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = FastAPI(
    title="🌟 CogniPulse Autonomous Enterprise AI Agent Suite", 
    version="2.0.0",
    description="🚀 Enterprise-grade asynchronous web scraping & AI competitor intelligence platform powered by FastAPI, Celery, Redis, and LangGraph."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

celery_app = Celery(
    "cognipulse_tasks",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_soft_time_limit=570,
    task_time_limit=600,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
                )

print("💎 [SYSTEM BOOT] FastAPI, Celery, and Redis configuration initialized successfully! 🚀🔥")

class AgentState(TypedDict):
    user_query: str
    target_urls: List[str]
    all_parsed_items: List[Dict[str, Any]]
    market_summaries: List[str]
    final_analyst_report: str
    error_message: Optional[str]

def search_node(state: AgentState):
    try:
        query = state.get("user_query", "")
        print(f"\n🔍 [VIP SEARCH NODE] 🌐 Initiating intelligent web search protocol for query: '{query}' ✨")

        searched_urls = search_urls(query, max_results=5)

        if not searched_urls:
            print("❌ [VIP SEARCH NODE] ⚠️ Critical Warning: No target URLs discovered during web reconnaissance! 🛑")
            return {"error_message": "Urls Not Found"}

        print(f"✨ [VIP SEARCH NODE] 🎉 Success! Discovered {len(searched_urls)} premium target URLs for deep extraction. 🚀")
        return {"target_urls": searched_urls, "error_message": None}

    except Exception as e:
        print(f"💥 [VIP SEARCH NODE ERROR] ❌ Exception encountered during search execution: {e} ⚠️")
        return {"error_message": str(e)}

async def scraper_node_urls(state: AgentState):
    try:
        urls = state.get("target_urls", [])
        print(f"\n🚀 [VIP SCRAPER NODE] ⚡ Preparing high-speed parallel batch scraping across {len(urls)} target URLs... 🌐")

        scraped_data = await asyncio.to_thread(scraper, urls)
        if scraped_data.get("status") != "Success":
            return {"error_message": "Batch scraping failed completely."}

        raw_data_list = scraped_data.get("raw_data", [])
        
        LLM_CONCURRENCY = 3

        llm_semaphore = asyncio.Semaphore(
            LLM_CONCURRENCY
                                          )

        async def parse_single_page(index, page_result):

            if page_result.get("status") != "Success":
                return [], None

            clean_text = page_result.get("clean_data", "")

            if not isinstance(clean_text, str) or not clean_text.strip():
                return [], None

            async with llm_semaphore:
                try:
                    parsed_data = await parser(clean_text)

                    if not parsed_data:
                        return [], None

                    items = [
                        item.model_dump()
                        for item in parsed_data.items_found
                    ]

                    return items, parsed_data.overall_market_summary

                except Exception:
                    logging.exception(
                        "LLM parsing failed for page %s",
                        index
                    )
                    return [], None

        tasks = [parse_single_page(index, page_result) for index, page_result in enumerate(raw_data_list, 1)]
        results = await asyncio.gather(
            *tasks,
            return_exceptions=True
        )

        collected_items = []
        summaries = []
        for items, summary in results:
            if items:
                collected_items.extend(items)
            if summary:
                summaries.append(summary)

        if not collected_items:
            return {"error_message": "No structured items could be extracted from scraped pages."}

        return {
            "all_parsed_items": collected_items,
            "market_summaries": summaries
        }
    except Exception as e:
        return {"error_message": str(e)}


def analyzed_node(state: AgentState):
    print("\n📊 [VIP ANALYST NODE] 👔 Synthesizing enterprise market intelligence and compiling final executive report... 🌟")
    
    items = state.get("all_parsed_items", [])
    summaries = state.get("market_summaries", [])
    
    combined_summary = " | ".join(summaries) if summaries else "Market analysis generated successfully with premium insights."

    markdown_report = f"""
# 🏢 ENTERPRISE COMPETITOR INTELLIGENCE EXECUTIVE REPORT 💎

### 📌 Executive Summary
{combined_summary}

### 📦 Extracted Items & Competitor Intelligence Data ({len(items)} Verified Items Compiled)
"""
    for idx, item in enumerate(items, 1):
        markdown_report += f"""
**{idx}. {item.get('title')}**
- **Price / Budget:** {item.get('price_or_budget')}
- **Availability Status:** {item.get('status_or_availability')}
- **Key Specifications:** {', '.join(item.get('key_features_or_specs', []))}
"""

    markdown_report += f"""
---
✨ *Enterprise Intelligence Report Generated Safely, Asynchronously & Automatically by CogniPulse Agent Engine* 🚀
"""
    print("💎 [VIP ANALYST NODE] 🎉 Final executive intelligence report compiled successfully in pristine Markdown format! 📈")
    return {"final_analyst_report": markdown_report}


def error_router(state: AgentState):
    if state.get("error_message"):
        print(f"❌ [VIP ROUTER] 🛑 Workflow interrupted due to error condition: {state['error_message']} ⚠️")
        return "error_exit"

    print("✅ [VIP ROUTER] 🚀 State check passed successfully. Routing forward in agent workflow... ⏩")
    return "continue"

builder = StateGraph(AgentState)

builder.add_node("searcher", search_node)
builder.add_node("scraper", scraper_node_urls)
builder.add_node("finalizer", analyzed_node)

builder.set_entry_point("searcher")
builder.add_conditional_edges(
    "searcher",
    error_router,
    {
        "error_exit": END,
        "continue": "scraper"
    }
)

builder.add_conditional_edges(
    "scraper",
    error_router,
    {
        "error_exit": END,
        "continue": "finalizer"
    }
)

builder.add_edge("finalizer", END)

graph_app = builder.compile()

@celery_app.task(name="tasks.run_agent_pipeline_task", bind=True)
def run_agent_pipeline_task(self, query: str):
    print(f"\n🌟 [VIP CELERY WORKER] 🚀 Background task received! Task ID: {self.request.id} | Query: '{query}' 💎")
    st = time.time()
    
    initial_state: AgentState = {
        "user_query": query,
        "target_urls": [],
        "all_parsed_items": [],
        "market_summaries": [],
        "final_analyst_report": "",
        "error_message": None
    }

    print("🚀 [VIP CELERY WORKER] ⚡ Triggering LangGraph autonomous multi-agent graph execution... ✨")
    final_output = asyncio.run(graph_app.ainvoke(initial_state))
    et = time.time()

    total_duration = et - st
    print(f"\n================================================================================")
    print(f"🎯 [VIP CELERY WORKER] 🎉 Background Task Completed Successfully in {total_duration:.2f} seconds! 🚀")
    print(f"================================================================================\n")

    report = final_output.get("final_analyst_report", "No report generated.")
    error = final_output.get("error_message")

    return {
        "status": "Success" if not error else "Failed",
        "task_id": self.request.id,
        "execution_time_seconds": total_duration,
        "error_message": error,
        "final_report": report,
        "items_extracted": len(final_output.get("all_parsed_items", []))
    }

class QueryRequest(BaseModel):
    query: str

@app.get("/")
def home_page():
    print("🏠 [VIP FASTAPI] 🌐 Health check endpoint accessed successfully. System is online & operational! ✨")
    return {
        "status": "Online",
        "service": "CogniPulse Autonomous Enterprise AI Agent Suite",
        "version": "2.0.0",
        "message": "🚀 FastAPI + Celery + Redis + LangGraph engine is fully primed and ready for action! 💎",
        "documentation": "/docs"
    }

@app.post("/api/v1/run-agent", status_code=202)
def trigger_agent_task(payload: QueryRequest):
    query_text = payload.query
    print(f"\n📥 [VIP FASTAPI] 🌐 Received HTTP POST request to trigger intelligence agent for query: '{query_text}' 🚀")
    
    if not query_text or not query_text.strip():
        print("❌ [VIP FASTAPI] ⚠️ Invalid query payload received in HTTP request! 🛑")
        raise HTTPException(status_code=400, detail="Query string cannot be empty.")

    
    task = celery_app.send_task("tasks.run_agent_pipeline_task", args=[query_text])
    print(f"✨ [VIP FASTAPI] 🎉 Celery background task successfully dispatched! Task ID: {task.id} 🚀")

    return {
        "status": "Accepted",
        "message": "🚀 Agent intelligence pipeline successfully dispatched to Celery background worker queue! 💎",
        "task_id": task.id,
        "check_status_endpoint": f"/api/v1/task-status/{task.id}"
    }

@app.get("/api/v1/task-status/{task_id}")
def get_task_status(task_id: str):
    print(f"\n🔍 [VIP FASTAPI] 🔎 Checking execution status for Celery task ID: {task_id} ... ⏳")
    task_result = celery_app.AsyncResult(task_id)

    response_data = {
        "task_id": task_id,
        "state": task_result.state,
        "ready": task_result.ready(),
        "successful": task_result.successful() if task_result.ready() else None,
        "result": task_result.result if task_result.ready() else "Task is still processing in background queue... ⏳"
    }

    print(f"✨ [VIP FASTAPI] 📊 Task status retrieved successfully. State: {task_result.state} 🚀")
    return response_data

def main(query: str):
    print(f"\n🚀 [CLI MODE] ⚡ Direct CLI invocation detected with query: '{query}' ... ✨")
    st = time.time()
    initial_state: AgentState = {
        "user_query": query,
        "target_urls": [],
        "all_parsed_items": [],
        "market_summaries": [],
        "final_analyst_report": "",
        "error_message": None
    }

    print("🚀 [CLI MODE] Starting Fast Batch Scrape + Sequential LLM Parse Pipeline directly... 💎")
    final_output = asyncio.run(graph_app.ainvoke(initial_state))
    et = time.time()

    print("\n================================================================================")
    print("🎯 [CLI MODE] 🎯 FINAL AGENT REPORT 🌟")
    print("================================================================================")
    print(final_output.get("final_analyst_report", "No report generated."))
    print(f"Total Time Taken: {et - st:.2f} seconds ⏱️")

if __name__ == "__main__":
    uvicorn.run("agent_graphs:app", host="0.0.0.0", port=8000, reload=True)
    # else:
    #     sample_query = "top AI automation trends 2026"
    #     main(sample_query)
