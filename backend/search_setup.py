import os
import time, random
from tavily import TavilyClient
from itertools import cycle
from dotenv import load_dotenv

load_dotenv()
api_keys_str = os.getenv("TAVILY_API_KEYS")
if not api_keys_str:
    print("❌🔑 ERROR: 'TAVILY_API_KEYS' Not Found. Please add it to your .env file.")
    exit()

api_keys = [key.strip() for key in api_keys_str.split(",") if key.strip()]
if not api_keys:
    print("❌⚠️ ERROR: No Valid API key found in configuration!")
    exit()

cycle_api_keys = cycle(api_keys)

def get_next_client():
    next_key = next(cycle_api_keys)
    return TavilyClient(api_key=next_key)

def search_web_urls(query: str, max_results: int = 2):
    try:
        print(f"🔍 Searching web for query: '{query}'...")
        client = get_next_client()
        response = client.search(
            query = query,
            max_results=max_results,
            search_depth = "advanced"
        )

        urls = [result["url"] for result in response.get("results" , [])]

        unwanted_domains = [
        "youtube.com", "youtu.be", "facebook.com", 
        "instagram.com", "tiktok.com", "vimeo.com", "fb.watch"
    ]
        clean_urls = []
        for url in urls:
            is_unwanted = any(domain in url for domain in unwanted_domains)
            if not is_unwanted:
                clean_urls.append(url)

        return clean_urls


    except Exception as e:
        print(f"❌ Error aagaya search ke douran: {e}")
        return [] and e

