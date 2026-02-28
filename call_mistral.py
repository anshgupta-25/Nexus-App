# call_mistral.py
import traceback
import json

# Try to import the official ollama package; fall back to requests if needed.
try:
    import ollama
    USING_OLLAMA_PKG = True
except Exception:
    USING_OLLAMA_PKG = False
    import requests

def call_with_ollama_pkg():
    messages = [
        {"role": "system", "content": "You are a helpful assistant that plans browser steps."},
        {"role": "user", "content": "Search for laptops under 50k (INR) and list top 5 with title and price."}
    ]
    try:
        resp = ollama.chat(model="gemma:2b", messages=messages, stream=False)
        print("=== RAW RESPONSE (ollama pkg) ===")
        print(json.dumps(resp, indent=2, default=str))
        # try to extract assistant text
        if isinstance(resp, dict) and "choices" in resp:
            try:
                txt = "".join(
                    c.get("message", {}).get("content", "") for c in resp["choices"]
                )
                print("\n=== ASSISTANT TEXT ===\n", txt)
            except Exception:
                print("\n(Could not parse 'choices' for text.)")
        else:
            print("\n(Resp has no 'choices' key.)")
    except Exception:
        print("ERROR calling ollama.chat:")
        traceback.print_exc()

def call_with_http():
    url = "http://localhost:11434/api/chat"
    payload = {
      "model": "mistral",
      "messages": [
        {"role": "system", "content": "You are a helpful assistant that plans browser steps."},
        {"role": "user", "content": "Search for laptops under 50k (INR) and list top 5 with title and price."}
      ],
      "stream": False
    }
    try:
        import requests
        r = requests.post(url, json=payload, timeout=120)
        print("HTTP STATUS:", r.status_code)
        print("HTTP BODY:")
        print(r.text)
    except Exception:
        print("ERROR calling Ollama HTTP API:")
        traceback.print_exc()

if __name__ == "__main__":
    print("Using ollama package:", USING_OLLAMA_PKG)
    if USING_OLLAMA_PKG:
        call_with_ollama_pkg()
    else:
        call_with_http()
