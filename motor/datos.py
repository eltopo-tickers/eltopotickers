"""ELTOPO - Sistema de datos con failover automatico."""

import yfinance as yf
import pandas as pd

from .config import TIMEFRAMES, PERIODOS, CACHE_TTL, MIN_VELAS
from .cache import guardar_cache, leer_cache


def _df_a_registros(df):
    """Convierte DataFrame a lista de dicts serializable en JSON."""
    df_copy = df.copy()
    for col in df_copy.columns:
        if pd.api.types.is_datetime64_any_dtype(df_copy[col]):
            df_copy[col] = df_copy[col].astype(str)
        elif pd.api.types.is_numeric_dtype(df_copy[col]):
            df_copy[col] = df_copy[col].astype(float)
    return df_copy.to_dict("records")


def obtener_datos(ticker, motor="swing"):
    ticker = ticker.upper()
    intervalo = TIMEFRAMES[motor]
    periodo = PERIODOS[motor]
    cache_key = "ohlcv_" + ticker + "_" + intervalo

    cache = leer_cache(cache_key, ttl=CACHE_TTL[motor])
    if cache is not None:
        df = pd.DataFrame(cache)
        if len(df) >= MIN_VELAS[motor]:
            print("[OK] " + ticker + " [" + motor + "] desde cache (" + str(len(df)) + " velas)")
            return df

    df = _obtener_yfinance(ticker, periodo, intervalo)
    if df is not None and len(df) >= MIN_VELAS[motor]:
        print("[OK] " + ticker + " [" + motor + "] desde yfinance (" + str(len(df)) + " velas)")
        guardar_cache(cache_key, _df_a_registros(df))
        return df

    cache = leer_cache(cache_key, ttl=999999)
    if cache is not None:
        print("[AVISO] " + ticker + " [" + motor + "] desde cache ANTIGUA")
        return pd.DataFrame(cache)

    print("[ERROR] " + ticker + " [" + motor + "] sin datos")
    return None


def _obtener_yfinance(ticker, periodo, intervalo):
    try:
        df = yf.download(
            ticker,
            period=periodo,
            interval=intervalo,
            progress=False,
            auto_adjust=True
        )
        if df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.reset_index()
        return df
    except Exception as e:
        print("  yfinance fallo: " + str(e))
        return None


def obtener_fundamental(ticker):
    """Obtiene datos fundamentales ampliados."""
    ticker = ticker.upper()
    cache_key = "fund_" + ticker

    cache = leer_cache(cache_key, ttl=86400)
    if cache:
        return cache

    try:
        t = yf.Ticker(ticker)
        info = t.info

        def _safe(key):
            val = info.get(key)
            if val is None:
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return val

        data = {
            "nombre": info.get("longName"),
            "sector": info.get("sector"),
            "industria": info.get("industry"),
            "pais": info.get("country"),
            "empleados": info.get("fullTimeEmployees"),

            # Crecimiento
            "ingresos_yoy": _safe("revenueGrowth"),
            "beneficios_yoy": _safe("earningsGrowth"),
            "crecimiento_beneficios_q": _safe("earningsQuarterlyGrowth"),

            # Margenes
            "margen_bruto": _safe("grossMargins"),
            "margen_operativo": _safe("operatingMargins"),
            "margen_neto": _safe("profitMargins"),

            # Valoracion
            "per": _safe("trailingPE"),
            "per_forward": _safe("forwardPE"),
            "ps": _safe("priceToSalesTrailing12Months"),
            "pb": _safe("priceToBook"),
            "ev_ebitda": _safe("enterpriseToEbitda"),

            # Solvencia
            "deuda_equity": _safe("debtToEquity"),
            "current_ratio": _safe("currentRatio"),
            "quick_ratio": _safe("quickRatio"),

            # Rentabilidad
            "roe": _safe("returnOnEquity"),
            "roa": _safe("returnOnAssets"),

            # Dividendos
            "dividend_yield": _safe("dividendYield"),
            "payout_ratio": _safe("payoutRatio"),

            # Tamano
            "market_cap": _safe("marketCap"),
            "enterprise_value": _safe("enterpriseValue"),

            # Otros
            "beta": _safe("beta"),
            "precio_objetivo": _safe("targetMeanPrice"),
            "recomendacion": info.get("recommendationKey"),
        }

        guardar_cache(cache_key, data)
        print("[OK] " + ticker + " fundamental ampliado")
        return data

    except Exception as e:
        print("  fundamental fallo: " + str(e))
        return {}
