# orchestrator.py (final stable with enforced schema)
import json, re, urllib.parse
import requests
from datetime import datetime
from playwright.sync_api import sync_playwright

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "gemma:2b"   # keep small model for low RAM

# ----------------------------
# 1) Ask LLM for a plan (JSON)
# ----------------------------
def ask_for_plan(user_instruction):
    prompt = (
        "You are an assistant that converts a user's instruction into a plan JSON.\n"
        "Return ONLY a single JSON object with this exact schema:\n"
        "{\n"
        '  "task_type": "<one of: generate_meal | get_news | get_weather | search | search_deep | todo | multi>",\n'
        '  "steps": [\n'
        '    {\n'
        '      "action": "<generate_meal|get_news|get_weather|search|search_deep|todo>",\n'
        '      "params": { ... }\n'
        '    }\n'
        '  ]\n'
        "}\n"
        "Rules:\n"
        "- Return JSON only, no extra words.\n"
        "- If multiple requests in one instruction, use \"task_type\":\"multi\".\n"
        "- If the instruction mentions keywords like 'plan tasks', 'to-do', 'schedule', 'study plan', 'daily plan', or is about planning tasks, scheduling, or listing to-dos, use \"task_type\":\"todo\" only (do not use generate_meal or search for these).\n"
        "- For todo, extract tasks into params.tasks, assigning priorities (high for urgent/important, med for moderate, low for leisure) and deadlines if mentioned.\n"
        "- If the instruction begins with 'search_deep:', strip 'search_deep:' and use the remaining text as params.query, set task_type to \"search_deep\", action to \"search_deep\", max_results to 3, depth to 1.\n"
        "- If the instruction includes phrases like 'deep search', 'search deeply', 'browse deeply', 'browse websites', 'find detailed info', ALWAYS use \"task_type\":\"search_deep\" and NEVER use \"search\". Extract the query into params.query, set max_results to 3 and depth to 1.\n"
        "- Fill params correctly from the instruction.\n"
        "- For get_weather, params must include {\"location\": \"<extracted location from instruction>\"}.\n"
        "- For get_news, params can include {\"topic\": \"<topic>\", \"country\": \"<optional country>\", \"max_results\": <optional number>}.\n"
        "- For search, params include {\"query\": \"<query>\", \"max_results\": <optional number>}.\n"
        "- For generate_meal, params include {\"target_kcal\": <number>, \"when\": \"<breakfast|lunch|dinner|day>\", \"diet\": \"<optional string>\"}.\n"
        "- For todo, params include {\"tasks\": [ { \"title\": string, \"deadline\": ISO8601 or null, \"priority\":\"low|med|high\" } ] }.\n"
        "- For search_deep, params include {\"query\": \"<query>\", \"max_results\": 3, \"depth\": 1}.\n\n"
        "User instruction: " + user_instruction + "\n"
        "Produce JSON only. No extra text."
    )
    payload = {"model": MODEL, "messages":[{"role":"user","content":prompt}], "stream": False}
    r = requests.post(OLLAMA_URL, json=payload, timeout=60)
    r.raise_for_status()
    body = r.json()

    text = body.get("message", {}).get("content", "")
    if not text and "choices" in body:
        text = "".join(c.get("message", {}).get("content", "") for c in body["choices"])

    text = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.DOTALL)
    return json.loads(text)


# ----------------------------
# 2) Ask LLM for meal plan (JSON)
# ----------------------------
def ask_for_meal(params):
    prompt = (
        "You are a nutrition assistant. Return ONLY a single JSON object matching EXACTLY this schema:\n"
        "{\n"
        '  "target_kcal": number,\n'
        '  "when": "breakfast|lunch|dinner|day",\n'
        '  "diet": string or null,\n'
        '  "meals": [\n'
        '    {\n'
        '      "name": "Breakfast|Lunch|Snack|Dinner",\n'
        '      "items": [\n'
        '        { "name": string, "qty": string, "kcal": number, "protein_g": number or null }\n'
        '      ],\n'
        '      "meal_kcal": number\n'
        '    }\n'
        '  ],\n'
        '  "total_kcal": number,\n'
        '  "adjustment_note": string or null,\n'
        '  "disclaimer": "Not medical advice. Consult a professional."\n'
        "}\n"
        "Rules:\n"
        "- total_kcal MUST equal the sum of all meal_kcal.\n"
        "- Provide at least 3 meals (breakfast, lunch, dinner) and optionally 1 snack.\n"
        "- Keep portions realistic.\n"
        "- Output JSON only, no text or markdown.\n\n"
        "Params: " + json.dumps(params) + "\n"
        "Produce JSON only. No extra text."
    )
    payload = {"model": MODEL, "messages":[{"role":"user","content":prompt}], "stream": False}
    r = requests.post(OLLAMA_URL, json=payload, timeout=5)  # 5s timeout for meal
    r.raise_for_status()
    body = r.json()

    text = body.get("message", {}).get("content", "")
    if not text and "choices" in body:
        text = "".join(c.get("message", {}).get("content", "") for c in body["choices"])

    text = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.DOTALL)
    return json.loads(text)


# ----------------------------
# 3) Ask for weather (JSON)
# ----------------------------
def ask_for_weather(params):
    location = params.get("location", "")
    if not location:
        return {"error": "location is required"}

    try:
        # Geocode location to lat/lon using Open-Meteo geocoding
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(location)}&count=1&language=en&format=json"
        geo_r = requests.get(geo_url, timeout=10)
        geo_r.raise_for_status()
        geo_data = geo_r.json()
        if not geo_data.get("results"):
            return {"error": "location not found"}
        lat = geo_data["results"][0]["latitude"]
        lon = geo_data["results"][0]["longitude"]
        loc_name = geo_data["results"][0]["name"]

        # Fetch weather from Open-Meteo
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&hourly=temperature_2m,weather_code&forecast_days=1"
        weather_r = requests.get(weather_url, timeout=10)
        weather_r.raise_for_status()
        weather_data = weather_r.json()

        # Map weather codes to conditions
        def weather_condition(code):
            codes = {
                0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
                45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
                56: "Light freezing drizzle", 57: "Dense freezing drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
                66: "Light freezing rain", 67: "Heavy freezing rain", 71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
                77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
                85: "Slight snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
            }
            return codes.get(code, "Unknown")

        current = weather_data.get("current", {})
        current_temp = current.get("temperature_2m")
        current_code = current.get("weather_code")
        feels_like = current.get("apparent_temperature")
        humidity = current.get("relative_humidity_2m")

        hourly = weather_data.get("hourly", {})
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        codes = hourly.get("weather_code", [])

        forecast = []
        for i in range(0, min(len(times), 24), 3):  # every 3 hours, up to 24h, max 8 entries
            forecast.append({
                "time": times[i],
                "temp_c": temps[i],
                "condition": weather_condition(codes[i])
            })

        return {
            "location": loc_name,
            "current": {
                "temp_c": current_temp,
                "condition": weather_condition(current_code),
                "feels_like_c": feels_like,
                "humidity": humidity
            },
            "forecast_next_24h": forecast
        }
    except Exception as e:
        return {"error": f"failed to fetch weather: {str(e)}"}


# ----------------------------
# 4) Ask for todo plan (JSON)
# ----------------------------
def ask_for_todo(params):
    tasks = params.get("tasks", [])
    if not tasks:
        return {"generated_plan": [], "advice": "No tasks provided"}

    generated_plan = []
    for task in tasks:
        title = task.get("title", "")
        deadline = task.get("deadline")
        priority = task.get("priority", "med")

        # Determine when
        if deadline:
            # Parse ISO8601, assume date part
            from datetime import datetime, date
            try:
                dt = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                task_date = dt.date()
                today = date.today()
                if task_date == today:
                    when = "today"
                elif task_date == today.replace(day=today.day + 1):
                    when = "tomorrow"
                else:
                    when = task_date.isoformat()
            except:
                when = "today"  # fallback
        else:
            when = "today"

        # Assign duration_min based on priority
        if priority == "high":
            duration_min = 120
        elif priority == "med":
            duration_min = 90
        else:  # low
            duration_min = 60

        generated_plan.append({
            "title": title,
            "when": when,
            "duration_min": duration_min,
            "priority": priority
        })

    advice = "Stay focused and get things done!"

    return {
        "generated_plan": generated_plan,
        "advice": advice
    }


# ----------------------------
# 5) Ask for news (JSON array)
# ----------------------------
def ask_for_news(params):
    topic = params.get("topic", "")
    country = params.get("country")
    max_results = int(params.get("max_results", 5))

    query = "news " + topic
    if country:
        query += " " + country

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=False, slow_mo=300)
            page = browser.new_page()
            url = "https://www.bing.com/search?q=" + urllib.parse.quote_plus(query)
            page.goto(url, wait_until="domcontentloaded")

            page.wait_for_selector("li.b_algo h2 a", timeout=10000)
            items = page.query_selector_all("li.b_algo")

            news = []
            for i, it in enumerate(items[:max_results]):
                title_el = it.query_selector("h2 a")
                snippet_el = it.query_selector("p")
                link = title_el.get_attribute("href") if title_el else ""
                headline = title_el.inner_text().strip() if title_el else ""
                summary = snippet_el.inner_text().strip() if snippet_el else headline.split('.')[0]
                if not summary:
                    summary = headline.split('.')[0]
                source = urllib.parse.urlparse(link).netloc if link else ""
                timestamp = datetime.now().isoformat()
                news.append({
                    "headline": headline,
                    "summary": summary[:200],  # approx max 40 words
                    "source": source,
                    "url": link,
                    "timestamp": timestamp
                })
            browser.close()
            return news
    except Exception as e:
        print(f"Failed to fetch news: {e}")
        return [{"error": "failed to fetch news"}]


# ----------------------------
# 6) Ask for deep search (JSON array)
# ----------------------------
def ask_for_search_deep(params):
    query = params.get("query", "")
    max_results = int(params.get("max_results", 3))
    depth = int(params.get("depth", 1))
    if depth > 2:
        depth = 2

    results = []

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=False, slow_mo=300)
            page = browser.new_page()

            # Step 1: Bing search
            url = "https://www.bing.com/search?q=" + urllib.parse.quote_plus(query)
            page.goto(url, wait_until="domcontentloaded")

            page.wait_for_selector("li.b_algo h2 a", timeout=10000)
            items = page.query_selector_all("li.b_algo")[:max_results]

            urls = []
            for it in items:
                title_el = it.query_selector("h2 a")
                if title_el:
                    link = title_el.get_attribute("href")
                    if link:
                        urls.append(link)

            # Now visit each URL
            for rank, url in enumerate(urls, 1):
                try:
                    page.goto(url, timeout=10000)
                    page.wait_for_load_state("domcontentloaded")

                    # Extract title
                    title = page.title() or None

                    # Extract domain
                    domain = urllib.parse.urlparse(url).netloc

                    # Check robots.txt (simple check, assume allowed if not /robots.txt blocks)
                    robots_url = f"https://{domain}/robots.txt"
                    try:
                        robots_page = browser.new_page()
                        robots_page.goto(robots_url, timeout=5000)
                        robots_text = robots_page.inner_text("body")
                        robots_page.close()
                        if "Disallow: /" in robots_text:
                            results.append({
                                "rank": rank,
                                "title": title,
                                "url": url,
                                "domain": domain,
                                "skipped": True,
                                "skip_reason": "robots.txt disallows",
                                "snippet": "",
                                "content": "",
                                "links_followed": []
                            })
                            continue
                    except:
                        pass  # assume allowed

                    # Extract content: try to get main text, remove nav/ads
                    try:
                        # Simple: get body text, remove scripts/styles
                        content = page.inner_text("body")
                        # Remove common nav/ads selectors if possible
                        # For simplicity, take first 2000 chars
                        content = content[:2000]
                    except:
                        content = ""

                    snippet = content[:200] if content else ""

                    links_followed = []
                    if depth > 1:
                        # Find up to 2 internal links
                        internal_links = []
                        links = page.query_selector_all("a[href]")
                        for link in links[:10]:  # check first 10
                            href = link.get_attribute("href")
                            if href and href.startswith("/") and not href.startswith("//"):
                                full_url = urllib.parse.urljoin(url, href)
                                if urllib.parse.urlparse(full_url).netloc == domain:
                                    internal_links.append(full_url)
                                    if len(internal_links) >= 2:
                                        break

                        for link_url in internal_links:
                            try:
                                page.goto(link_url, timeout=10000)
                                page.wait_for_load_state("domcontentloaded")
                                link_title = page.title() or None
                                link_content = page.inner_text("body")[:1000] if page.inner_text("body") else None
                                link_snippet = link_content[:200] if link_content else ""
                                links_followed.append({
                                    "url": link_url,
                                    "title": link_title,
                                    "snippet": link_snippet,
                                    "content": link_content
                                })
                                # Delay
                                page.wait_for_timeout(500 + 500)  # 500-1000ms
                            except:
                                pass

                    results.append({
                        "rank": rank,
                        "title": title,
                        "url": url,
                        "domain": domain,
                        "skipped": False,
                        "skip_reason": None,
                        "snippet": snippet,
                        "content": content,
                        "links_followed": links_followed
                    })

                    # Delay between pages
                    page.wait_for_timeout(500 + 500)

                except Exception as e:
                    results.append({
                        "rank": rank,
                        "title": None,
                        "url": url,
                        "domain": urllib.parse.urlparse(url).netloc,
                        "skipped": True,
                        "skip_reason": str(e),
                        "snippet": "",
                        "content": "",
                        "links_followed": []
                    })

            browser.close()
    except Exception as e:
        results.append({"error": f"failed deep search: {str(e)}"})

    return results


# --------------------------------
# 4) Execute plan with Playwright (Bing direct URL)
# --------------------------------
def execute_plan(plan):
    results = []
    steps = plan.get("steps", [])
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=300)
        page = browser.new_page()
        for step in steps:
            if step.get("action") == "search":
                query = step.get("query", "")
                max_r = int(step.get("max_results", 5))

                url = "https://www.bing.com/search?q=" + urllib.parse.quote_plus(query)
                page.goto(url, wait_until="domcontentloaded")

                page.wait_for_selector("li.b_algo h2 a", timeout=10000)
                items = page.query_selector_all("li.b_algo")

                for i, it in enumerate(items[:max_r]):
                    title_el = it.query_selector("h2 a")
                    snippet_el = it.query_selector("p")
                    link = title_el.get_attribute("href") if title_el else ""
                    title = title_el.inner_text().strip() if title_el else ""
                    snippet = snippet_el.inner_text().strip() if snippet_el else ""
                    results.append({
                        "rank": len(results)+1,
                        "title": title,
                        "snippet": snippet,
                        "url": link
                    })
        browser.close()
    return results

# --------------------------------
# 3) Ask LLM to structure results
# --------------------------------
def ask_to_structure(user_instruction, raw_results):
    compact = [
        {"rank": r["rank"], "title": r["title"], "url": r["url"], "snippet": r["snippet"][:120]}
        for r in raw_results
    ]

    content = (
        "You are a strict JSON generator.\n"
        "Return ONLY a JSON array.\n"
        "Each object must have exactly 4 fields:\n"
        '{ \"rank\": number, \"title\": string, \"url\": string, \"price\": number or null }\n\n'
        "Rules:\n"
        "- Always keep the given rank, title, and url.\n"
        "- Copy title/url from input as-is.\n"
        "- Try to extract price if present (₹45,999 -> 45999). If not found, use null.\n"
        "- Do not add extra text, markdown, or commentary.\n\n"
        "Raw results:\n" + json.dumps(compact, indent=2) + "\n\n"
        "User asked: " + user_instruction + "\n"
        "Return valid JSON only."
    )

    payload = {"model": MODEL, "messages":[{"role":"user","content":content}], "stream": False}
    r = requests.post(OLLAMA_URL, json=payload, timeout=180)
    r.raise_for_status()
    body = r.json()

    text = body.get("message", {}).get("content", "")
    if not text and "choices" in body:
        text = "".join(c.get("message", {}).get("content", "") for c in body["choices"])

    text = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.DOTALL)

    try:
        return json.loads(text)
    except Exception:
        print("\n⚠️ LLM returned invalid JSON. Raw output:\n", text)
        return {"items": compact}

# ----------------------------
# Summarizer
# ----------------------------
def ask_for_summary(results_actions):
    # results_actions is list of (json_result, action_type)
    prompt = (
        "You are a helpful assistant. Convert the following list of JSON results into a single, user-friendly text answer.\n\n"
        "Rules:\n"
        "- If a JSON contains meals → describe them as a daily meal plan.\n"
        "- If a JSON contains news → list top headlines with sources.\n"
        "- If a JSON contains weather → describe current condition and forecast in plain English.\n"
        "- If a JSON contains todo tasks → list them as a clear to-do plan with advice.\n"
        "- If a JSON contains search_deep results → summarize the content into a direct answer, with key points.\n"
        "- Combine all results into a single natural text answer.\n"
        "- Never show raw JSON to the user.\n\n"
        "Results: " + json.dumps([{"action": action, "result": result} for result, action in results_actions]) + "\n\n"
        "Produce the combined text answer only. No extra text."
    )
    payload = {"model": MODEL, "messages":[{"role":"user","content":prompt}], "stream": False}
    r = requests.post(OLLAMA_URL, json=payload, timeout=60)
    r.raise_for_status()
    body = r.json()

    text = body.get("message", {}).get("content", "")
    if not text and "choices" in body:
        text = "".join(c.get("message", {}).get("content", "") for c in body["choices"])

    return text.strip()

# -------------------
# 4) Main orchestrator
# -------------------
def run(user_instruction):
    try:
        print("Requesting plan from LLM...")
        plan = ask_for_plan(user_instruction)
        print("Plan:", json.dumps(plan, indent=2))

        # Execute the plan
        results = []
        actions = []
        for step in plan.get("steps", []):
            action = step.get("action")
            params = step.get("params", {})
            if action == "generate_meal":
                print("Executing generate_meal...")
                result = ask_for_meal(params)
                results.append(result)
                actions.append(action)
            elif action == "get_news":
                print("Executing get_news...")
                result = ask_for_news(params)
                results.append(result)
                actions.append(action)
            elif action == "get_weather":
                print("Executing get_weather...")
                result = ask_for_weather(params)
                results.append(result)
                actions.append(action)
            elif action == "todo":
                print("Executing todo...")
                result = ask_for_todo(params)
                results.append(result)
                actions.append(action)
            elif action == "search_deep":
                print("Executing search_deep...")
                result = ask_for_search_deep(params)
                results.append(result)
                actions.append(action)
            # Add other actions here if needed
            else:
                print(f"Unknown action: {action}")
                results.append({"error": f"Unknown action: {action}"})
                actions.append(action)

        # Summarize all results together
        results_actions = list(zip(results, actions))
        final_text = ask_for_summary(results_actions)

        return {"success": True, "data": final_text}

    except Exception as e:
        print("Failed to run:", e)
        return {"success": False, "data": str(e)}

if __name__ == "__main__":
    instruction = "Search for laptops under 50k INR and list top 5 with title and price."
    run(instruction)
