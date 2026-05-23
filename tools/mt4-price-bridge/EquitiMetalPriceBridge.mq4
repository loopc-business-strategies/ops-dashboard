#property strict
#property version   "1.01"
#property description "Posts live Equiti MT4 metal quotes to the Ops Dashboard backend."

input string BridgeUrl = "http://localhost:5000/api/erp-accounting/metal-rates/bridge";
input string BridgeToken = "";
input string Tenant = "mg";
input string GoldSymbol = "XAUUSD";
input string SilverSymbol = "XAGUSD";
input string PlatinumSymbol = "XPTUSD";
input int PostEverySeconds = 1;
input int RequestTimeoutMs = 5000;
input bool PrintSuccessfulPosts = true;

datetime lastPostAt = 0;

string JsonEscape(string value)
{
   string out = value;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   StringReplace(out, "\r", "\\r");
   StringReplace(out, "\n", "\\n");
   return out;
}

bool ReadQuote(string symbol, double &bid, double &ask, double &mid)
{
   string cleanSymbol = StringTrimLeft(StringTrimRight(symbol));
   if (cleanSymbol == "") return false;

   SymbolSelect(cleanSymbol, true);
   RefreshRates();

   bid = MarketInfo(cleanSymbol, MODE_BID);
   ask = MarketInfo(cleanSymbol, MODE_ASK);

   if (bid <= 0 && cleanSymbol == Symbol()) bid = Bid;
   if (ask <= 0 && cleanSymbol == Symbol()) ask = Ask;

   if (bid <= 0 && ask <= 0) return false;
   if (bid > 0 && ask > 0) mid = (bid + ask) / 2.0;
   else mid = bid > 0 ? bid : ask;

   return mid > 0;
}

string QuoteJson(string metal, string symbol, bool required, bool &ok)
{
   double bid = 0;
   double ask = 0;
   double mid = 0;

   if (!ReadQuote(symbol, bid, ask, mid))
   {
      if (required)
      {
         Print("MT4 metal bridge: missing tick for ", symbol, ". Check Market Watch symbol name.");
         ok = false;
      }
      return "";
   }

   string json = "\"" + metal + "\":{";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"bid\":" + DoubleToString(bid, 6) + ",";
   json += "\"ask\":" + DoubleToString(ask, 6) + ",";
   json += "\"mid\":" + DoubleToString(mid, 6);
   json += "}";
   return json;
}

bool PostQuotes()
{
   if (StringTrimLeft(StringTrimRight(BridgeToken)) == "")
   {
      Print("MT4 metal bridge: BridgeToken is empty.");
      return false;
   }

   bool ok = true;
   string gold = QuoteJson("gold", GoldSymbol, true, ok);
   string silver = QuoteJson("silver", SilverSymbol, true, ok);
   string platinum = QuoteJson("platinum", PlatinumSymbol, false, ok);
   if (!ok) return false;

   string metals = gold + "," + silver;
   if (platinum != "") metals += "," + platinum;

   string payload = "{";
   payload += "\"source\":\"mt4-bridge\",";
   payload += "\"tenant\":\"" + JsonEscape(Tenant) + "\",";
   payload += "\"account\":" + IntegerToString(AccountNumber()) + ",";
   payload += "\"server\":\"" + JsonEscape(AccountServer()) + "\",";
   payload += "\"currency\":\"USD\",";
   payload += "\"unit\":\"TOZ\",";
   payload += "\"metals\":{" + metals + "},";
   payload += "\"symbols\":{";
   payload += "\"gold\":\"" + JsonEscape(GoldSymbol) + "\",";
   payload += "\"silver\":\"" + JsonEscape(SilverSymbol) + "\",";
   payload += "\"platinum\":\"" + JsonEscape(PlatinumSymbol) + "\"";
   payload += "}";
   payload += "}";

   char data[];
   char result[];
   string resultHeaders = "";
   StringToCharArray(payload, data, 0, StringLen(payload), CP_UTF8);
   int dataSize = ArraySize(data);
   if (dataSize > 0 && data[dataSize - 1] == 0) dataSize -= 1;

   string headers = "Content-Type: application/json\r\n";
   headers += "x-metal-rates-bridge-token: " + BridgeToken + "\r\n";
   headers += "x-tenant: " + Tenant + "\r\n";

   ResetLastError();
   int status = WebRequest("POST", BridgeUrl, "", "", RequestTimeoutMs, data, dataSize, result, resultHeaders);
   if (status < 200 || status >= 300)
   {
      string body = CharArrayToString(result, 0, -1, CP_UTF8);
      int errorCode = GetLastError();
      string hint = "";
      if (errorCode == 4014) hint = " Allow WebRequest for the backend origin in Tools > Options > Expert Advisors.";
      if (errorCode == 4029) hint = " Check the BridgeUrl, allowed WebRequest URL, and that localhost:5000 is reachable from Windows.";
      Print("MT4 metal bridge: POST failed. status=", status, " lastError=", errorCode, hint, " body=", body);
      return false;
   }

   if (PrintSuccessfulPosts)
   {
      Print("MT4 metal bridge: posted Gold/Silver/Platinum ticks from ", AccountNumber(), " ", AccountServer());
   }
   return true;
}

int OnInit()
{
   EventSetTimer(1);
   Print("MT4 metal bridge started. Account=", AccountNumber(), " Server=", AccountServer(), " Url=", BridgeUrl);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("MT4 metal bridge stopped.");
}

void OnTimer()
{
   int interval = MathMax(1, PostEverySeconds);
   datetime now = TimeCurrent();
   if (lastPostAt > 0 && now - lastPostAt < interval) return;
   lastPostAt = now;
   PostQuotes();
}
