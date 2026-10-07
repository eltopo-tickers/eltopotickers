"""ELTOPO - API REST con FastAPI."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import json

from motor.motores import analizar_ticker

app = FastAPI(title="ELTOPO API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WEB_DIR = Path(__file__).parent.parent / "web"
TICKERS_FILE = Path(__file__).parent.parent / "motor" / "tickers.json"


class AnalyzeRequest(BaseModel):
    ticker: str
    modo: str = "auto"


_tickers_cache = None


def _cargar_tickers():
    """Carga la lista de tickers (cacheada en memoria)."""
    global _tickers_cache
    if _tickers_cache is None:
        try:
            with open(TICKERS_FILE, "r", encoding="utf-8") as f:
                _tickers_cache = json.load(f)
        except Exception:
            _tickers_cache = {}
    return _tickers_cache


@app.get("/")
def raiz():
    """Sirve el frontend."""
    index = WEB_DIR / "index.html"
    if not index.exists():
        return {"mensaje": "ELTOPO API funcionando", "version": "1.0"}
    return FileResponse(index)


@app.get("/api/health")
def health():
    """Health check."""
    return {"status": "ok"}


@app.get("/api/buscar")
def buscar(q: str):
    """Busca tickers por simbolo o nombre."""
    q = q.strip().lower()
    if not q:
        return {"resultados": []}

    tickers = _cargar_tickers()
    resultados = []
    ya_incluidos = set()

    # Primero los que empiezan por el termino (mas relevante)
    for symbol, nombre in tickers.items():
        if symbol.lower().startswith(q) or nombre.lower().startswith(q):
            resultados.append({"symbol": symbol, "nombre": nombre})
            ya_incluidos.add(symbol)
            if len(resultados) >= 10:
                break

    # Si no hay suficientes, anadir los que contienen
    if len(resultados) < 10:
        for symbol, nombre in tickers.items():
            if symbol in ya_incluidos:
                continue
            if q in symbol.lower() or q in nombre.lower():
                resultados.append({"symbol": symbol, "nombre": nombre})
                if len(resultados) >= 10:
                    break

    return {"resultados": resultados}


@app.post("/api/analyze")
def analizar(req: AnalyzeRequest):
    """Analiza un ticker con el motor completo."""
    ticker = req.ticker.strip().upper()

    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker vacio")

    if len(ticker) > 10:
        raise HTTPException(status_code=400, detail="Ticker demasiado largo")

    try:
        resultado = analizar_ticker(ticker)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error: " + str(e))


# Servir archivos estaticos (CSS, JS)
app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")
