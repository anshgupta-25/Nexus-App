# NexusApp (Nexus-Voyager)

This repository (local copy) contains the Nexus-Voyager project — a multi-part application with backend and frontend components, many feature READMEs, and auxiliary scripts to start services and run the project.

This top-level README is a short summary and pointer index. There are many more detailed README and guide files in the repository; see the list below.

## Quick pointers

- Main repo name: `NexusApp` (as requested)
- Primary branch: `main`
- Backend code: `backend/`
- Frontend static site: `frontend/` (contains `index.html`, `script.js`, `styles.css`)

## Important documentation files (selection)

- `README.md` (this file)
- `README-MODEL-PICKER.md`
- `README-VIDEO-CALL-DEMO.md`
- `README.md` (existing project readme files, see root for many variants)
- `DEPLOYMENT_GUIDE.md`
- `HOW_TO_RUN.txt`
- `QUICK_START.txt`
- `ONE_CLICK_START.md`
- `NVIDIA_GPU_CONFIG.md`
- `PRODUCT_SCRAPER_README.md`
- `TABLE_GALLERY_GUIDE.md`

There are many other guide/notes and feature-readme files in the root — please open them for implementation-specific instructions.

## How to push this exact repository to GitHub (recommended)

1. Create a new repository on GitHub under your account `mu` named `NexusApp`. Leave it empty (do not add a README, license, or .gitignore) to make pushing simpler.

2. On your machine (this repo folder), run:

```bash
cd "/Users/anshgupta/Ansh/untitled folder/Nexus-Voyager"
# point origin at your GitHub repo
git remote set-url origin https://github.com/mu/NexusApp.git
# push the main branch
git push -u origin main
```

If you prefer SSH, replace the URL with `git@github.com:mu/NexusApp.git`.

If you want me to create the GitHub repo and push from this environment, I can attempt that when `gh` is available here and authenticated, or if you provide a Personal Access Token (PAT) locally — but I will not ask you to paste a token here. The simplest flow is: create the empty repo on github.com, then I can push from this environment or you can run the commands above locally.

## Next steps I can take for you

- If you create the repo on GitHub and tell me when it's ready, I'll run the push here and confirm.
- If you want me to create the repo from here, install and authenticate the GitHub CLI (`gh`) or configure credentials and tell me and I will create and push.

## Contact / support
If you want changes to this README's content, tell me what to include and I'll update and commit it.

---
Generated: 22 Oct 2025
# 🌟 Nexus AI - ChatGPT-Style AI Assistant

![Nexus AI](https://img.shields.io/badge/Nexus-AI-6366f1?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.13-blue?style=for-the-badge&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.1-green?style=for-the-badge&logo=flask)
![Playwright](https://img.shields.io/badge/Playwright-Latest-orange?style=for-the-badge)

**Nexus AI** is an intelligent autonomous agent that combines the power of local LLM (Ollama Mistral) with advanced web search capabilities. It features a beautiful ChatGPT-style interface and sophisticated prioritization system for accurate, up-to-date answers.

---

## ✨ Key Features

### 🧠 **Smart Local AI**
- Uses **Ollama Mistral** model running locally
- Fast responses without internet dependency
- Privacy-focused - your data stays on your machine

### 🌐 **Advanced Web Search**
- **CAPTCHA-free** DuckDuckGo search integration
- Anti-detection browser automation with Playwright
- Multi-source answer compilation

### 📚 **Wikipedia Priority**
- **Supreme priority (+5000)** for historical range queries (e.g., "2003 to 2006")
- Comprehensive multi-article compilation
- Perfect for research and historical data

### 🔥 **Today First Priority**
- **Recency scoring system** prioritizes current information
- Today's data gets +1000 boost
- Old articles penalized (-800) to ensure freshness

### 📅 **Specific Date Matching**
- **Exact date detection** with +3000 priority boost
- Handles formats like "10 oct 2025", "October 10, 2025"
- Visual 📅 markers for date-specific results

### 🎨 **Modern UI**
- **ChatGPT-inspired** dark theme interface
- Smooth animations and transitions
- Responsive design for all devices
- Real-time status indicators

---

## 🚀 Quick Start

### Prerequisites
1. **Python 3.13+** installed
2. **Ollama** installed with Mistral model
3. **Chrome browser** installed
4. **Git** (optional)

### Installation

1. **Clone or Download** this repository
2. **Install Python dependencies:**
```bash
cd "d:\Nexus AI\backend"
pip install flask flask-cors playwright requests
playwright install chrome
```

3. **Start Ollama** (in a separate terminal):
```bash
ollama serve
ollama pull mistral
```

4. **Start the Backend:**
   - Double-click `start_backend.bat`
   - OR run: `python backend/app.py`

5. **Open Frontend:**
   - Open `frontend/index.html` in your browser
   - OR use a local server:
   ```bash
   cd frontend
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

---

## 📁 Project Structure

```
Nexus AI/
├── backend/
│   ├── agent_step3.py      # Main agent logic
│   ├── app.py              # Flask API server
│   └── agent_state/        # Agent state files
├── frontend/
│   ├── index.html          # Main interface
│   ├── styles.css          # Styling
│   └── script.js           # Frontend logic
├── start_backend.bat       # Windows startup script
└── README.md              # This file
```

---

## 🎯 Usage Examples

### Today's Information
```
❓ What's the weather today?
✅ Gets latest weather data with +1000 priority boost
```

### Historical Ranges
```
❓ What happened between 2003 and 2006?
✅ Wikipedia articles prioritized with +5000 boost
```

### Specific Dates
```
❓ What's happening on October 10, 2025?
✅ Exact date match with +3000 priority, marked with 📅
```

### General Knowledge
```
❓ Who is the current president of USA?
🧠 Mistral answers instantly from local knowledge
```

---

## 🔧 Configuration

### API Endpoint
Edit `frontend/script.js`:
```javascript
const API_URL = 'http://localhost:5000';
```

### Ollama Settings
Edit `backend/agent_step3.py`:
```python
OLLAMA_API = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "mistral"
```

### Browser Settings
Edit `backend/agent_step3.py`:
```python
channel="chrome"  # or "msedge"
headless=False    # Set True for headless mode
```

---

## 🎨 Features Overview

| Feature | Description | Priority Boost |
|---------|-------------|----------------|
| 🧠 Local AI | Ollama Mistral for fast responses | - |
| 🌐 Web Search | DuckDuckGo CAPTCHA-free search | +0 |
| 📚 Wikipedia | General Wikipedia results | +500 |
| 🔥 Recent | Today's information priority | +1000 |
| 📅 Exact Date | Specific date matching | +3000 |
| ⭐ Range + Wiki | Historical ranges (2003-2006) | +5000 |

---

## 🛠️ Technical Details

### Priority Scoring System
```python
# 5-Tier Weighted Priority System
Supreme Priority: +5000 (Wikipedia + Historical Range)
Ultimate Priority: +3000 (Exact Date Match)
High Priority: +1000 (Recent/Today)
Medium Priority: +500 (Wikipedia General)
Regular: +0 (Standard Results)
Penalty: -200 to -800 (Old Content)
```

### Anti-Detection Features
- Hidden `navigator.webdriver`
- Spoofed Chrome runtime
- Fake plugins array
- Geolocation set to Hyderabad
- Human-like user agent

### Search Flow
1. User asks question
2. Mistral checks local knowledge
3. If uncertain → Web search (DuckDuckGo)
4. Priority scoring applied
5. Multi-source compilation
6. Natural language response

---

## 📝 API Endpoints

### `GET /health`
Health check endpoint
```json
Response: {"status": "ok", "message": "Nexus AI Backend is running"}
```

### `POST /ask`
Main question endpoint
```json
Request: {"question": "What's the weather today?"}
Response: {
  "answer": "...",
  "method": "web",
  "sources": ["https://..."]
}
```

### `POST /shutdown`
Cleanup and shutdown
```json
Response: {"message": "Backend shutdown complete"}
```

---

## 🐛 Troubleshooting

### Backend Won't Start
- Check if port 5000 is available
- Ensure Flask is installed: `pip install flask flask-cors`
- Verify Ollama is running: `ollama list`

### Frontend Not Connecting
- Check console for CORS errors
- Verify API_URL in `script.js`
- Make sure backend is running on port 5000

### Chrome Not Opening
- Install Chrome: `playwright install chrome`
- Check if Chrome is in PATH
- Try changing to Edge: `channel="msedge"`

### CAPTCHA Appearing
- Should not happen with DuckDuckGo
- Check if using correct search engine
- Verify anti-detection scripts loaded

---

## 📊 Performance

- **Local AI Response:** < 5 seconds
- **Web Search:** 5-15 seconds (depending on query)
- **Memory Usage:** ~500MB (with browser open)
- **Concurrent Users:** Supports multiple requests

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🙏 Acknowledgments

- **Ollama** for the amazing local LLM platform
- **Mistral AI** for the powerful Mistral model
- **Playwright** for browser automation
- **DuckDuckGo** for CAPTCHA-free search
- **Wikipedia** for comprehensive knowledge base

---

## 📞 Support

Having issues? Check the troubleshooting section or open an issue on GitHub.

---

## 🎉 Enjoy Nexus AI!

**Made with ❤️ for intelligent, privacy-focused AI assistance**

---

### Quick Commands Reference

```bash
# Start Backend
python backend/app.py

# Start Ollama
ollama serve
ollama pull mistral

# Install Dependencies
pip install flask flask-cors playwright requests
playwright install chrome

# Check Health
curl http://localhost:5000/health

# Test API
curl -X POST http://localhost:5000/ask -H "Content-Type: application/json" -d '{"question":"Hello"}'
```

---

**Version:** 1.0.0  
**Last Updated:** October 2024  
**Status:** ✅ Production Ready
