#!/usr/bin/env bash
cd "$(dirname "$0")"
./deploy.sh
echo ""
read -n 1 -s -r -p "按任意鍵結束..."
echo ""
