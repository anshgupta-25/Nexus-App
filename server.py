# server.py
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from orchestrator import run
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow cross-origin calls (development convenience).
# In production replace ["*"] with the specific origins you trust.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # for dev: allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Instruction(BaseModel):
    query: str

@app.post("/run")
def run_agent(data: Instruction):
    result = run(data.query)
    if result is None:
        return {"success": False, "error": "Execution failed"}
    return {"success": True, "data": result}

if __name__ == "__main__":
    # run with reload for dev
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
