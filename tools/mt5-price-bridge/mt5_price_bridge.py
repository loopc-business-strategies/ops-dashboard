import json
import os
import sys
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import MetaTrader5 as mt5
except ImportError:
    print("MetaTrader5 package missing. Run: pip install -r requirements.txt", file=sys.stderr)
    raise


DEFAULT_SYMBOLS = {
    "gold": "XAUUSD",
    "silver": "XAGUSD",
    "platinum": "XPTUSD",
}


def load_dotenv(path=".env"):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def env(name, default=""):
    return os.environ.get(name, default).strip()


def symbol_map():
    raw = env("MT5_SYMBOLS")
    if raw:
        result = {}
        for pair in raw.split(","):
            if "=" not in pair:
                continue
            key, value = pair.split("=", 1)
            key = key.strip().lower()
            value = value.strip()
            if key and value:
                result[key] = value
        return {**DEFAULT_SYMBOLS, **result}

    return {
        "gold": env("MT5_GOLD_SYMBOL", DEFAULT_SYMBOLS["gold"]),
        "silver": env("MT5_SILVER_SYMBOL", DEFAULT_SYMBOLS["silver"]),
        "platinum": env("MT5_PLATINUM_SYMBOL", DEFAULT_SYMBOLS["platinum"]),
    }


def connect_mt5():
    path = env("MT5_TERMINAL_PATH")
    login = env("MT5_LOGIN")
    password = env("MT5_PASSWORD")
    server = env("MT5_SERVER")

    kwargs = {}
    if path:
        kwargs["path"] = path
    if login:
        kwargs["login"] = int(login)
    if password:
        kwargs["password"] = password
    if server:
        kwargs["server"] = server

    if not mt5.initialize(**kwargs):
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")


def select_symbols(symbols):
    for symbol in symbols.values():
        if symbol and not mt5.symbol_select(symbol, True):
            print(f"warning: could not select MT5 symbol {symbol}: {mt5.last_error()}", file=sys.stderr)


def read_quotes(symbols):
    metals = {}
    raw_symbols = {}
    for metal, symbol in symbols.items():
        if not symbol:
            continue
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            print(f"warning: no tick for {symbol}: {mt5.last_error()}", file=sys.stderr)
            continue
        bid = float(tick.bid or 0)
        ask = float(tick.ask or 0)
        last = float(tick.last or 0)
        if bid <= 0 and ask <= 0 and last <= 0:
            continue
        metals[metal] = {
            "bid": bid,
            "ask": ask,
            "last": last,
            "time": int(getattr(tick, "time", 0) or 0),
        }
        raw_symbols[metal] = symbol
    return metals, raw_symbols


def post_rates(url, token, tenant, metals, symbols):
    payload = {
        "tenant": tenant,
        "source": "mt5-bridge",
        "currency": "USD",
        "unit": "toz",
        "symbols": symbols,
        "metals": metals,
        "sentAt": datetime.now(timezone.utc).isoformat(),
    }
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-tenant": tenant,
            "x-metal-rates-bridge-token": token,
        },
    )
    with urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode("utf-8"))


def main():
    load_dotenv()

    backend_url = env("ERP_BRIDGE_URL", "http://localhost:5000/api/erp-accounting/metal-rates/bridge")
    token = env("METAL_RATES_BRIDGE_TOKEN")
    tenant = env("ERP_TENANT", "mg").lower()
    interval = max(0.5, float(env("POLL_SECONDS", "1")))

    if not token:
        raise RuntimeError("METAL_RATES_BRIDGE_TOKEN is required")

    symbols = symbol_map()
    connect_mt5()
    select_symbols(symbols)
    print(f"MT5 bridge running for tenant={tenant}, interval={interval}s, symbols={symbols}")

    try:
        while True:
            metals, active_symbols = read_quotes(symbols)
            if "gold" in metals and "silver" in metals:
                try:
                    result = post_rates(backend_url, token, tenant, metals, active_symbols)
                    rates = result.get("rates", {})
                    print(
                        f"{datetime.now().strftime('%H:%M:%S')} "
                        f"XAU={rates.get('goldPrice')} XAG={rates.get('silverPrice')} "
                        f"XPT={rates.get('platinumPrice')} {rates.get('priceCurrency')}/{rates.get('priceUnit')}"
                    )
                except HTTPError as exc:
                    print(f"post failed HTTP {exc.code}: {exc.read().decode('utf-8', 'ignore')}", file=sys.stderr)
                except URLError as exc:
                    print(f"post failed: {exc.reason}", file=sys.stderr)
            else:
                print("waiting for gold and silver ticks...", file=sys.stderr)
            time.sleep(interval)
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
