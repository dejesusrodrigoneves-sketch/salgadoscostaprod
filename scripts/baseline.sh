#!/bin/bash
# scripts/baseline.sh — Medidas de baseline para otimização
echo "=== Medidas de Baseline SIC.ia ==="
echo "Data: $(date)"
echo ""

# Suite de testes
echo "--- Suite de Testes ---"
cd backend && npx vitest run 2>&1 | tail -5
cd ..

# Tamanhos de arquivos
echo ""
echo "--- Tamanhos de Arquivos ---"
echo "Total HTML frontend:"
wc -l *.html view/*.html 2>/dev/null | tail -1
echo "Total CSS frontend:"
wc -l css/*.css 2>/dev/null | tail -1
echo "Total JS frontend:"
wc -l js/*.js js/services/*.js 2>/dev/null | tail -1
echo "Total backend:"
find backend/src -name "*.js" | xargs wc -l 2>/dev/null | tail -1

# Dependências CDN
echo ""
echo "--- Dependências CDN ---"
grep -roh 'https://[^"]*' *.html 2>/dev/null | sort | uniq -c | sort -rn

# JS/CSS inline
echo ""
echo "--- JS/CSS Inline ---"
for f in *.html; do
  inline_js=$(grep -c '<script>' "$f" 2>/dev/null || echo 0)
  inline_css=$(grep -c '<style>' "$f" 2>/dev/null || echo 0)
  echo "$f: script=$inline_js style=$inline_css"
done
