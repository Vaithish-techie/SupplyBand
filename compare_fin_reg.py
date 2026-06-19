with open("agents/financial_exposure.py") as f:
    fin = f.read()
with open("agents/regulatory_trade.py") as f:
    reg = f.read()

fin_start = fin.find("already_responded = any(")
fin_end = fin.find("async with httpx.AsyncClient", fin_start)

reg_start = reg.find("already_responded = any(")
reg_end = reg.find("async with httpx.AsyncClient", reg_start)

print("--- FINANCIAL EXPOSURE ---")
print(fin[fin_start:fin_end])
print("\n--- REGULATORY TRADE ---")
print(reg[reg_start:reg_end])
