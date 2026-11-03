import os
import time
import random
from typing import List, Optional
from itertools import cycle
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from openai import OpenAI, RateLimitError, APIError
import asyncio

load_dotenv()

api_keys_str = os.getenv("OPENROUTER_API_KEYS")

api_keys_str = os.getenv("OPENROUTER_API_KEYS")

if not api_keys_str:
    raise RuntimeError(
        "OPENROUTER_API_KEYS is missing or empty."
    )

api_keys = [
    key.strip()
    for key in api_keys_str.split(",") 
    if key.strip()
            ]

if not api_keys:
    raise RuntimeError(
        "No valid OpenRouter API keys configured."
    )

cycle_api_keys = cycle(api_keys)

def get_next_api_key() -> str:
    """Cycle se agli API key return karta hai"""
    return next(cycle_api_keys)


# --- Pydantic v2 Schemas ---
class CompetitorProductItem(BaseModel):
    title: str = Field(description="Exact title of the product, listing, or job")
    price_or_budget: str = Field(description="Price, rent, or budget details (e.g., $150, AED 150,000/yr, N/A)")
    key_features_or_specs: List[str] = Field(description="Main specifications, features, or key bullet points")
    status_or_availability: Optional[str] = Field(description="In Stock, Out of Stock, Available, or N/A", default="N/A")

class EnterpriseCompetitorReport(BaseModel):
    competitor_name: str = Field(description="Website, brand, or company name")
    overall_market_summary: str = Field(description="Concise 3-4 line business summary of the extracted data")
    items_found: List[CompetitorProductItem] = Field(description="Complete list of extracted products or properties")
    pricing_strategy_insight: str = Field(description="Critical analysis of the competitor's pricing strategy")


# --- Main Parsing Function ---
async def parse_raw_data_with_llm(raw_data: str, max_retries: int = 3) -> Optional[EnterpriseCompetitorReport]:
    if not raw_data or not raw_data.strip():
        print("⚠️ Warning: Empty text passed to parser!")
        return None

    MAX_CHARS = 100000
    clean_markdown_text = raw_data
    if len(raw_data) > MAX_CHARS:
        print(f"✂️ Text too long ({len(raw_data)} chars). Truncating to {MAX_CHARS} chars to save tokens...")
        clean_markdown_text = raw_data[:MAX_CHARS]

    model_name = os.getenv("llm_model_name") or "nvidia/nemotron-3-ultra-550b-a55b:free"

    def sync_run_llm():
        for attempt in range(1, max_retries + 1):
            try:
                current_api_key = get_next_api_key()
                
                with OpenAI(
                        base_url="https://openrouter.ai/api/v1",
                        api_key=current_api_key,
                        timeout=45.0,
                        max_retries=0
                    ) as client:
                
                    print(f"🤖 [Attempt {attempt}/{max_retries}] Starting extraction using OpenRouter...")
                    
                    completion = client.beta.chat.completions.parse(
                        model=model_name,
                        messages=[
                                {
                                    "role": "system",
                                    "content": (
                                        "You are an expert Enterprise Data Extraction and Market Intelligence Agent. "
                                        "Extract accurate information strictly and exclusively from the provided text. "
                                        "Do not hallucinate, assume, guess, or invent any external details. "
                                        "Adhere strictly to the requested Pydantic JSON schema output format."
                                    )
                                },
                                {
                                    "role": "user",
                                    "content": f"Here is the clean web page text to analyze:\n\n{clean_markdown_text}"
                                }
                                        ],
                                        
                        response_format=EnterpriseCompetitorReport,
                        timeout=45.0
                    )

                    return completion.choices[0].message.parsed

            except RateLimitError as rle:
                sleep_time = (2 ** attempt) + random.uniform(1, 3)
                print(f"⚠️ Rate Limit (429) hit. Switching API key and retrying in {sleep_time:.2f}s... (Error: {rle})")
                if attempt == max_retries:
                    print("❌ Max retries reached for Rate Limit.")
                    return None
                time.sleep(sleep_time)

            except APIError as ae:
                print(f"❌ OpenRouter API Error (Check model status / 404 / Server error): {ae}")
                return None

            except Exception as e:
                print(f"❌ Unexpected Parsing Error: {e}")
                return None

        return None

    return await asyncio.to_thread(sync_run_llm)


# --- Test Block ---
if __name__ == "__main__":
    sample = "Test listing: MacBook Pro M3, Price $2000, In Stock."
    res = asyncio.run(parse_raw_data_with_llm(sample))
    if res:
        print("\n✅ Extracted Output:")
        print(res.model_dump_json(indent=4))
