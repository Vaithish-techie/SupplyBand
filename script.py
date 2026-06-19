with open("agents/alt_sourcing.py") as f:
    alt = f.read()

with open("agents/financial_exposure.py") as f:
    fin = f.read()

print("ALT_SOURCING:")
print(alt[alt.find("while True:"):alt.find("if \"supplier_impact\" in found") + 110])
print("\nFINANCIAL_EXPOSURE:")
print(fin[fin.find("while True:"):fin.find("if supplier_impact_data:") + 40])
