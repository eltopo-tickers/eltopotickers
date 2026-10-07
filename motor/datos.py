# -*- coding: utf-8 -*-
"""ELTOPO - Sistema de datos con failover automatico."""

import yfinance as yf
import pandas as pd

from .config import TIMEFRAMES, PERIODOS, CACHE_TTL, MIN_VELAS
from .cache import guardar_cache, leer_cache


# Sesion global con curl_cffi (impersona Chrome real)
_sesion_curl = None


def _get_sesion():
    """Crea/obtiene una sesion de curl_cffi que impersona Chrome."""
    global _sesion_curl
    if _sesion_curl is None:
        try:
            from curl_cffi import requests as curl_requests
            _sesion_curl = curl_requests.Session(impersonate="chrome")
            print("[OK] Sesion curl_cffi creada (impersonate=chrome)")
        except Exception as e:
            print("[AVISO] curl_cffi no disponible: " + str(e))
            _sesion_curl = False
    return _sesion_curl if _sesion_curl is not False else None


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
        sesion = _get_sesion()
        if sesion is not None:
            df = yf.download(
                ticker,
                period=periodo,
                interval=intervalo,
                progress=False,
                auto_adjust=True,
                session=sesion,
            )
        else:
            df = yf.download(
                ticker,
                period=periodo,
                interval=intervalo,
                progress=False,
                auto_adjust=True,
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


def _fundamental_desde_yfinance(ticker):
    """Intenta obtener fundamental desde yfinance con curl_cffi."""
    try:
        sesion = _get_sesion()
        if sesion is not None:
            t = yf.Ticker(ticker, session=sesion)
        else:
            t = yf.Ticker(ticker)

        info = t.info

        if not info or not info.get("longName"):
            return None

        def _safe(key):
            val = info.get(key)
            if val is None:
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return val

        return {
            "nombre": info.get("longName"),
            "sector": info.get("sector"),
            "industria": info.get("industry"),
            "pais": info.get("country"),
            "empleados": info.get("fullTimeEmployees"),
            "ingresos_yoy": _safe("revenueGrowth"),
            "beneficios_yoy": _safe("earningsGrowth"),
            "crecimiento_beneficios_q": _safe("earningsQuarterlyGrowth"),
            "margen_bruto": _safe("grossMargins"),
            "margen_operativo": _safe("operatingMargins"),
            "margen_neto": _safe("profitMargins"),
            "per": _safe("trailingPE"),
            "per_forward": _safe("forwardPE"),
            "ps": _safe("priceToSalesTrailing12Months"),
            "pb": _safe("priceToBook"),
            "ev_ebitda": _safe("enterpriseToEbitda"),
            "deuda_equity": _safe("debtToEquity"),
            "current_ratio": _safe("currentRatio"),
            "quick_ratio": _safe("quickRatio"),
            "roe": _safe("returnOnEquity"),
            "roa": _safe("returnOnAssets"),
            "dividend_yield": _safe("dividendYield"),
            "payout_ratio": _safe("payoutRatio"),
            "market_cap": _safe("marketCap"),
            "enterprise_value": _safe("enterpriseValue"),
            "beta": _safe("beta"),
            "precio_objetivo": _safe("targetMeanPrice"),
            "recomendacion": info.get("recommendationKey"),
        }
    except Exception as e:
        print("  yfinance fundamental fallo: " + str(e))
        return None


def _fundamental_desde_finnhub(ticker):
    """Fallback: obtiene fundamental desde Finnhub."""
    try:
        from .sentimiento import obtener_fundamental_finnhub
        return obtener_fundamental_finnhub(ticker)
    except Exception as e:
        print("  finnhub fundamental fallo: " + str(e))
        return None


def obtener_fundamental(ticker):
    """Obtiene datos fundamentales con failover: yfinance -> Finnhub."""
    ticker = ticker.upper()
    cache_key = "fund_" + ticker

    cache = leer_cache(cache_key, ttl=86400)
    if cache and cache.get("nombre"):
        return cache

    # Intento 1: yfinance con curl_cffi
    data = _fundamental_desde_yfinance(ticker)

    # Intento 2: Finnhub (fallback)
    if not data or not data.get("nombre"):
        print("[AVISO] yfinance fundamental vacio, probando Finnhub...")
        data = _fundamental_desde_finnhub(ticker)

    # Intento 3: valores vacios
    if not data:
        print("[ERROR] fundamental sin datos en todas las fuentes")
        data = {
            "nombre": None, "sector": None, "industria": None, "pais": None,
            "empleados": None, "ingresos_yoy": None, "beneficios_yoy": None,
            "crecimiento_beneficios_q": None, "margen_bruto": None,
            "margen_operativo": None, "margen_neto": None, "per": None,
            "per_forward": None, "ps": None, "pb": None, "ev_ebitda": None,
            "deuda_equity": None, "current_ratio": None, "quick_ratio": None,
            "roe": None, "roa": None, "dividend_yield": None,
            "payout_ratio": None, "market_cap": None, "enterprise_value": None,
            "beta": None, "precio_objetivo": None, "recomendacion": None,
        }

    guardar_cache(cache_key, data)
    print("[OK] " + ticker + " fundamental (fuente: " + ("yfinance" if data.get("nombre") else "vacio") + ")")
    return data
