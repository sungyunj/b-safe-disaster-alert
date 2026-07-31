#!/bin/bash

OUTPUT="results/2026-07-27/vm-failure/backend-watch.txt"

while true
do
    NOW=$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')

    RESPONSE=$(curl -s \
        --max-time 3 \
        -H 'Connection: close' \
        http://20.249.156.9/alerts)

    if echo "$RESPONSE" | grep -qi 'alert-server-a'; then
        echo "$NOW VM-A" | tee -a "$OUTPUT"

    elif echo "$RESPONSE" | grep -qi 'alert-server-b'; then
        echo "$NOW VM-B" | tee -a "$OUTPUT"

    else
        echo "$NOW FAILED response=$RESPONSE" | tee -a "$OUTPUT"
    fi

    sleep 1
done
