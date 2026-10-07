"""ELTOPO - Modulo de sentimiento (Finnhub)."""

import finnhub

from .config import FINNHUB_API_KEY
from .cache import guardar_cache, leer_cache


def obtener_sentimiento(ticker):
    """Obtiene datos de sentimiento desde Finnhub."""
    ticker = ticker.upper()
    cache_key = "sent_" + ticker

    cache = leer_cache(cache_key, ttl=21600)
    if cache:
        return cache

    data = {
        "recomendacion_analistas": None,
        "precio_objetivo": None,
        "insider_compras": None,
        "insider_ventas": None,
        "nota": "Pendiente",
    }

    if not FINNHUB_API_KEY:
        data["nota"] = "Sin API key"
        return data

    try:
        client = finnhub.Client(api_key=FINNHUB_API_KEY)

        # Recomendaciones de analistas
        try:
            reco = client.recommendation_trends(ticker)
            if reco and len(reco) > 0:
                ult = reco[0]
                data["recomendacion_analistas"] = {
                    "strong_buy": ult.get("strongBuy", 0),
                    "buy": ult.get("buy", 0),
                    "hold": ult.get("hold", 0),
                    "sell": ult.get("sell", 0),
                    "strong_sell": ult.get("strongSell", 0),
                    "periodo": ult.get("period", ""),
                }
        except Exception as e:
            print("  reco fallo: " + str(e))

        # Insider transactions (ultimos 90 dias)
        try:
            from datetime import datetime, timedelta
            hoy = datetime.now()
            hace_90 = hoy - timedelta(days=90)
            insider = client.stock_insider_transactions(
                ticker,
                hace_90.strftime("%Y-%m-%d"),
                hoy.strftime("%Y-%m-%d"),
            )
            if insider and insider.get("data"):
                trans = insider["data"]
                compras = sum(1 for t in trans if t.get("change", 0) > 0)
                ventas = sum(1 for t in trans if t.get("change", 0) < 0)
                data["insider_compras"] = compras
                data["insider_ventas"] = ventas
        except Exception as e:
            print("  insider fallo: " + str(e))

        data["nota"] = "OK"

    except Exception as e:
        print("  sentimiento fallo: " + str(e))
        data["nota"] = "Error: " + str(e)

    guardar_cache(cache_key, data)
    return data
